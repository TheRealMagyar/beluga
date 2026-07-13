import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  Coins,
  Droplets,
  Layers,
  RefreshCw,
  Settings2,
  TrendingUp,
  Waves,
} from "lucide-react";
import { useWallet } from "../../components/Walletcontext";
import { NetworkSwitcher } from "../../components/NetworkSwitcher";
import { PlaygroundConsole } from "./PlaygroundConsole";
import { SuiClientPanel } from "./SuiClientPanel";
import type { ConsoleLog } from "./types";
import { NETWORK_CONFIG } from "./constants";
import { uid } from "./utils";
import {
  addSandboxLiquidity,
  buildDefiSandboxPackage,
  clearDefiSandboxDeployment,
  createDefiPool,
  fetchSandboxPoolSnapshot,
  fetchSandboxPoolSummaries,
  loadDefiSandboxDeployment,
  resolveActivePool,
  setActiveSandboxPool,
  mintSandboxTokenA,
  mintSandboxTokenB,
  mintSandboxTokensBoth,
  publishDefiSandboxPackage,
  swapSandboxAForB,
  swapSandboxBForA,
  type DefiSandboxDeployment,
} from "./defi-playground";
import { SandboxFaucetTab } from "./SandboxFaucetTab";
import { SandboxPoolsTab } from "./SandboxPoolsTab";
import { SandboxSetupTab } from "./SandboxSetupTab";
import { SandboxSwapTab } from "./SandboxSwapTab";
import {
  DefiAlert,
  DefiSandboxTabs,
  DefiTabContent,
  type SandboxTab,
} from "./defi-ui";
import { useSandboxPoolData } from "./useSandboxPoolData";
import {
  SUI_COIN_TYPE,
  type SandboxCoinInfo,
  findCoinByType,
  listPoolCoinOptions,
  sandboxTokenA,
  sandboxTokenB,
} from "./defi-coin-catalog";
import {
  estimateSwapOutput,
  formatUnits,
  minSwapOutput,
  parseUnits,
} from "./defi-sandbox-utils";
import {
  clearDeepBookState,
  createDeepBookBalanceManager,
  depositIntoDeepBookManager,
  fetchDeepBookLevel2,
  fetchDeepBookMidPrice,
  fetchManagerBalance,
  isDeepBookNetwork,
  listDeepBookPools,
  loadDeepBookState,
  placeDeepBookLimitOrder,
  type DeepBookPlaygroundState,
} from "./deepbook-playground";

type DefiPanel = "sandbox" | "deepbook";

export function DefiPlayground() {
  const { walletInfo, network, localNetRunning } = useWallet();
  const walletAddress = walletInfo?.address ?? null;

  const [panel, setPanel] = useState<DefiPanel>("sandbox");
  const [sandboxTab, setSandboxTab] = useState<SandboxTab>("pools");
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [deployment, setDeployment] = useState<DefiSandboxDeployment | null>(
    loadDefiSandboxDeployment,
  );

  useEffect(() => {
    const syncDeployment = () => {
      setDeployment(loadDefiSandboxDeployment());
    };
    window.addEventListener("beluga-defi-deployment-changed", syncDeployment);
    return () => {
      window.removeEventListener("beluga-defi-deployment-changed", syncDeployment);
    };
  }, []);
  const {
    poolSummaries,
    poolSnapshot,
    refreshing: poolLoading,
    refresh: refreshPoolsData,
    invalidateSnapshot,
  } = useSandboxPoolData(deployment, walletAddress, panel === "sandbox");
  const [faucetAmountA, setFaucetAmountA] = useState("1000");
  const [faucetAmountB, setFaucetAmountB] = useState("1000");
  const [liquidityAmountA, setLiquidityAmountA] = useState("1");
  const [liquidityAmountB, setLiquidityAmountB] = useState("100");
  const [swapAmount, setSwapAmount] = useState("1");
  const [swapDirection, setSwapDirection] = useState<"a-for-b" | "b-for-a">(
    "a-for-b",
  );
  const [coinOptions, setCoinOptions] = useState<SandboxCoinInfo[]>([]);
  const [selectedCoinTypeA, setSelectedCoinTypeA] = useState(SUI_COIN_TYPE);
  const [selectedCoinTypeB, setSelectedCoinTypeB] = useState("");
  const [deepBookState, setDeepBookState] = useState<DeepBookPlaygroundState | null>(
    loadDeepBookState,
  );
  const [selectedPool, setSelectedPool] = useState("SUI_DBUSDC");
  const [orderPrice, setOrderPrice] = useState("1");
  const [orderQuantity, setOrderQuantity] = useState("1");
  const [orderIsBid, setOrderIsBid] = useState(true);
  const [depositAmount, setDepositAmount] = useState("10");
  const [depositCoin, setDepositCoin] = useState("SUI");
  const [midPrice, setMidPrice] = useState<number | null>(null);
  const [managerBalances, setManagerBalances] = useState<Record<string, number>>(
    {},
  );

  const [busy, setBusy] = useState<string | null>(null);

  const addLog = useCallback(
    (level: ConsoleLog["level"], message: string) => {
      const entry = { id: uid(), level, message, timestamp: Date.now() };
      setLogs((prev) => [...prev, entry]);
      void window.belugaConsole.appendPlaygroundLog(entry);
    },
    [],
  );

  const refreshCoinOptions = useCallback(async () => {
    const options = await listPoolCoinOptions(
      network,
      walletAddress,
      deployment?.packageId,
    );
    setCoinOptions(options);

    setSelectedCoinTypeA((prev) =>
      options.some((c) => c.coinType === prev) ? prev : SUI_COIN_TYPE,
    );
    setSelectedCoinTypeB((prev) => {
      if (prev && options.some((c) => c.coinType === prev)) return prev;
      const tb =
        deployment?.packageId
          ? sandboxTokenB(deployment.packageId).coinType
          : options[1]?.coinType ?? "";
      return tb;
    });
  }, [network, walletAddress, deployment?.packageId]);

  const activePool = useMemo(
    () => (deployment ? resolveActivePool(deployment) : null),
    [deployment],
  );

  const pendingCoinA = useMemo(
    () => findCoinByType(coinOptions, selectedCoinTypeA),
    [coinOptions, selectedCoinTypeA],
  );
  const pendingCoinB = useMemo(
    () => findCoinByType(coinOptions, selectedCoinTypeB),
    [coinOptions, selectedCoinTypeB],
  );

  const poolCoins = useMemo(() => {
    if (poolSnapshot) {
      return { coinA: poolSnapshot.coinA, coinB: poolSnapshot.coinB };
    }
    if (activePool) {
      return { coinA: activePool.coinA, coinB: activePool.coinB };
    }
    return null;
  }, [poolSnapshot, activePool]);

  const deploymentNetworkMismatch = Boolean(
    deployment?.packageId && deployment.network !== network,
  );

  const showSandboxFaucet = Boolean(
    deployment?.faucetAId && deployment?.faucetBId,
  );

  const sandboxFaucetCoins = useMemo(() => {
    if (!deployment?.packageId) return null;
    return {
      tokenA: sandboxTokenA(deployment.packageId),
      tokenB: sandboxTokenB(deployment.packageId),
    };
  }, [deployment?.packageId]);

  const deepBookPools = useMemo(() => {
    if (!isDeepBookNetwork(network)) return [];
    return listDeepBookPools(network);
  }, [network]);

  const swapEstimate = useMemo(() => {
    if (!poolSnapshot || !swapAmount.trim() || !poolCoins) return null;
    try {
      const decimals =
        swapDirection === "a-for-b"
          ? poolCoins.coinA.decimals
          : poolCoins.coinB.decimals;
      const amountIn = parseUnits(swapAmount, decimals);
      if (swapDirection === "a-for-b") {
        return estimateSwapOutput(
          amountIn,
          poolSnapshot.reserveA,
          poolSnapshot.reserveB,
        );
      }
      return estimateSwapOutput(
        amountIn,
        poolSnapshot.reserveB,
        poolSnapshot.reserveA,
      );
    } catch {
      return null;
    }
  }, [poolSnapshot, swapAmount, swapDirection, poolCoins]);

  const refreshDeepBookData = useCallback(async () => {
    if (!walletAddress || !isDeepBookNetwork(network)) {
      setMidPrice(null);
      setManagerBalances({});
      return;
    }

    try {
      const price = await fetchDeepBookMidPrice(
        walletAddress,
        network,
        selectedPool,
        deepBookState?.balanceManagerId,
      );
      setMidPrice(price);
    } catch (e: unknown) {
      setMidPrice(null);
      const message = e instanceof Error ? e.message : "Failed to load mid price.";
      addLog("warn", message);
    }

    if (!deepBookState?.balanceManagerId) {
      setManagerBalances({});
      return;
    }

    try {
      const [suiBal, quoteBal] = await Promise.all([
        fetchManagerBalance(
          walletAddress,
          network,
          deepBookState.balanceManagerId,
          "SUI",
        ),
        fetchManagerBalance(
          walletAddress,
          network,
          deepBookState.balanceManagerId,
          depositCoin,
        ).catch(() => ({ balance: 0 })),
      ]);
      setManagerBalances({
        SUI: suiBal.balance,
        [depositCoin]: quoteBal.balance,
      });
    } catch {
      setManagerBalances({});
    }
  }, [
    walletAddress,
    network,
    selectedPool,
    deepBookState,
    depositCoin,
    addLog,
  ]);

  useEffect(() => {
    void refreshCoinOptions();
  }, [refreshCoinOptions]);

  useEffect(() => {
    if (panel === "deepbook") {
      void refreshDeepBookData();
    }
  }, [panel, refreshDeepBookData]);

  useEffect(() => {
    if (deepBookState && deepBookState.network !== network) {
      setDeepBookState(null);
    }
  }, [network, deepBookState]);

  const runAction = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    try {
      await action();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Action failed.";
      addLog("error", message);
    } finally {
      setBusy(null);
    }
  };

  const handleDeploySandbox = () =>
    runAction("deploy", async () => {
      if (!walletAddress) {
        addLog("warn", "Connect a wallet before deploying.");
        return;
      }
      if (network === "mainnet") {
        addLog("warn", "Deploy the DeFi sandbox on Localnet or Testnet first.");
        return;
      }

      addLog("info", "Building DeFi sandbox package...");
      const build = await buildDefiSandboxPackage();
      addLog(
        "success",
        `Build OK — ${build.modules.length} module(s). Publishing...`,
      );

      const next = await publishDefiSandboxPackage(build, walletAddress, network);
      setDeployment(next);
      addLog("success", `Sandbox published: ${next.packageId}`);
      if (next.faucetAId) addLog("info", `Token A faucet: ${next.faucetAId}`);
      if (next.faucetBId) addLog("info", `Token B faucet: ${next.faucetBId}`);
      await refreshCoinOptions();
    });

  const handleCreatePool = () =>
    runAction("pool", async () => {
      if (!deployment || !walletAddress || !pendingCoinA || !pendingCoinB) return;
      if (deploymentNetworkMismatch) {
        addLog("warn", "Switch to the deployment network before creating a pool.");
        return;
      }
      const duplicate = (deployment.pools ?? []).some(
        (pool) =>
          pool.coinA.coinType === pendingCoinA.coinType &&
          pool.coinB.coinType === pendingCoinB.coinType,
      );
      if (duplicate) {
        addLog(
          "warn",
          `${pendingCoinA.symbol}/${pendingCoinB.symbol} pool already exists — selecting it.`,
        );
        const existing = (deployment.pools ?? []).find(
          (pool) =>
            pool.coinA.coinType === pendingCoinA.coinType &&
            pool.coinB.coinType === pendingCoinB.coinType,
        );
        if (existing) handleSelectPool(existing.poolId);
        return;
      }
      addLog(
        "info",
        `Creating ${pendingCoinA.symbol}/${pendingCoinB.symbol} pool...`,
      );
      const { result, deployment: next } = await createDefiPool(
        deployment,
        walletAddress,
        pendingCoinA,
        pendingCoinB,
      );
      setDeployment(next);
      addLog("success", `Pool created — digest ${result.digest}`);
      if (next.activePoolId) addLog("info", `Pool object: ${next.activePoolId}`);
      setSandboxTab("pools");
      await refreshPoolsData();
      await refreshCoinOptions();
    });

  const refreshAfterFaucet = async () => {
    await refreshPoolsData();
    await refreshCoinOptions();
  };

  const handleSelectPool = (poolId: string) => {
    if (!deployment || deployment.activePoolId === poolId) return;
    try {
      const next = setActiveSandboxPool(deployment, poolId);
      setDeployment(next);
      invalidateSnapshot();
      void refreshPoolsData();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not select pool.";
      addLog("error", message);
    }
  };

  const handleFaucetA = () =>
    runAction("faucet-a", async () => {
      if (!deployment || !walletAddress || !sandboxFaucetCoins) return;
      const { tokenA } = sandboxFaucetCoins;
      let amount: bigint;
      try {
        amount = parseUnits(faucetAmountA, tokenA.decimals);
      } catch (e: unknown) {
        addLog("warn", e instanceof Error ? e.message : "Invalid amount.");
        return;
      }
      addLog(
        "info",
        `Faucet ${formatUnits(amount, tokenA.decimals)} ${tokenA.symbol}...`,
      );
      const result = await mintSandboxTokenA(deployment, walletAddress, amount);
      addLog("success", `Faucet ${tokenA.symbol} — digest ${result.digest}`);
      await refreshAfterFaucet();
    });

  const handleFaucetB = () =>
    runAction("faucet-b", async () => {
      if (!deployment || !walletAddress || !sandboxFaucetCoins) return;
      const { tokenB } = sandboxFaucetCoins;
      let amount: bigint;
      try {
        amount = parseUnits(faucetAmountB, tokenB.decimals);
      } catch (e: unknown) {
        addLog("warn", e instanceof Error ? e.message : "Invalid amount.");
        return;
      }
      addLog(
        "info",
        `Faucet ${formatUnits(amount, tokenB.decimals)} ${tokenB.symbol}...`,
      );
      const result = await mintSandboxTokenB(deployment, walletAddress, amount);
      addLog("success", `Faucet ${tokenB.symbol} — digest ${result.digest}`);
      await refreshAfterFaucet();
    });

  const handleFaucetBoth = () =>
    runAction("faucet-both", async () => {
      if (!deployment || !walletAddress || !sandboxFaucetCoins) return;
      const { tokenA, tokenB } = sandboxFaucetCoins;
      let amountA: bigint;
      let amountB: bigint;
      try {
        amountA = parseUnits(faucetAmountA, tokenA.decimals);
        amountB = parseUnits(faucetAmountB, tokenB.decimals);
      } catch (e: unknown) {
        addLog("warn", e instanceof Error ? e.message : "Invalid amounts.");
        return;
      }
      addLog(
        "info",
        `Faucet ${formatUnits(amountA, tokenA.decimals)} ${tokenA.symbol} + ${formatUnits(amountB, tokenB.decimals)} ${tokenB.symbol}...`,
      );
      const result = await mintSandboxTokensBoth(
        deployment,
        walletAddress,
        amountA,
        amountB,
      );
      addLog("success", `Faucet TA + TB — digest ${result.digest}`);
      await refreshAfterFaucet();
    });

  const handleAddLiquidity = () =>
    runAction("liquidity", async () => {
      if (!deployment || !walletAddress || !poolCoins || !activePool) return;
      let amountA: bigint;
      let amountB: bigint;
      try {
        amountA = parseUnits(liquidityAmountA, poolCoins.coinA.decimals);
        amountB = parseUnits(liquidityAmountB, poolCoins.coinB.decimals);
      } catch (e: unknown) {
        addLog("warn", e instanceof Error ? e.message : "Invalid amounts.");
        return;
      }
      addLog(
        "info",
        `Adding ${formatUnits(amountA, poolCoins.coinA.decimals)} ${poolCoins.coinA.symbol} + ${formatUnits(amountB, poolCoins.coinB.decimals)} ${poolCoins.coinB.symbol}...`,
      );
      const result = await addSandboxLiquidity(
        deployment,
        walletAddress,
        amountA,
        amountB,
      );
      addLog("success", `Liquidity added — digest ${result.digest}`);
      await refreshPoolsData();
      setSandboxTab("swap");
    });

  const handleSwap = () =>
    runAction(swapDirection === "a-for-b" ? "swap-ab" : "swap-ba", async () => {
      if (!deployment || !walletAddress || !poolCoins || !activePool) return;
      const inCoin =
        swapDirection === "a-for-b" ? poolCoins.coinA : poolCoins.coinB;
      const outCoin =
        swapDirection === "a-for-b" ? poolCoins.coinB : poolCoins.coinA;
      let amountIn: bigint;
      try {
        amountIn = parseUnits(swapAmount, inCoin.decimals);
      } catch (e: unknown) {
        addLog("warn", e instanceof Error ? e.message : "Invalid swap amount.");
        return;
      }
      const label = `${inCoin.symbol} → ${outCoin.symbol}`;

      const freshSnapshot = await fetchSandboxPoolSnapshot(
        deployment,
        walletAddress,
      );
      if (!freshSnapshot) {
        addLog("warn", "Could not load current pool reserves. Refresh and retry.");
        return;
      }

      const reserveIn =
        swapDirection === "a-for-b"
          ? freshSnapshot.reserveA
          : freshSnapshot.reserveB;
      const reserveOut =
        swapDirection === "a-for-b"
          ? freshSnapshot.reserveB
          : freshSnapshot.reserveA;
      const estimatedOut = estimateSwapOutput(amountIn, reserveIn, reserveOut);
      const minOut = minSwapOutput(estimatedOut);

      addLog(
        "info",
        `Swapping ${formatUnits(amountIn, inCoin.decimals)} ${label}` +
          (estimatedOut > 0n
            ? ` (min out ${formatUnits(minOut, outCoin.decimals)} ${outCoin.symbol})...`
            : "..."),
      );

      const result =
        swapDirection === "a-for-b"
          ? await swapSandboxAForB(
              deployment,
              walletAddress,
              amountIn,
              minOut,
            )
          : await swapSandboxBForA(
              deployment,
              walletAddress,
              amountIn,
              minOut,
            );
      addLog("success", `Swap succeeded — digest ${result.digest}`);
      await refreshPoolsData();
    });

  const handleCreateBalanceManager = () =>
    runAction("bm", async () => {
      if (!walletAddress || !isDeepBookNetwork(network)) return;
      addLog("info", "Creating DeepBook balance manager...");
      const { result, state } = await createDeepBookBalanceManager(
        walletAddress,
        network,
      );
      setDeepBookState(state);
      addLog("success", `Balance manager created — ${state.balanceManagerId}`);
      addLog("info", `Digest: ${result.digest}`);
      await refreshDeepBookData();
    });

  const handleDeposit = () =>
    runAction("deposit", async () => {
      if (!walletAddress || !deepBookState?.balanceManagerId) return;
      if (!isDeepBookNetwork(network)) return;
      const amount = Number(depositAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        addLog("warn", "Enter a positive deposit amount.");
        return;
      }
      addLog("info", `Depositing ${amount} ${depositCoin} into balance manager...`);
      const result = await depositIntoDeepBookManager(
        walletAddress,
        network,
        depositCoin,
        amount,
        deepBookState.balanceManagerId,
      );
      addLog("success", `Deposit succeeded — digest ${result.digest}`);
      await refreshDeepBookData();
    });

  const handlePlaceOrder = () =>
    runAction("order", async () => {
      if (!walletAddress || !deepBookState?.balanceManagerId) return;
      if (!isDeepBookNetwork(network)) return;
      const price = Number(orderPrice);
      const quantity = Number(orderQuantity);
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
        addLog("warn", "Enter valid price and quantity.");
        return;
      }
      addLog(
        "info",
        `Placing ${orderIsBid ? "bid" : "ask"} on ${selectedPool} @ ${price} x ${quantity}...`,
      );
      const result = await placeDeepBookLimitOrder(
        walletAddress,
        network,
        deepBookState.balanceManagerId,
        {
          poolKey: selectedPool,
          price,
          quantity,
          isBid: orderIsBid,
        },
      );
      addLog("success", `Limit order placed — digest ${result.digest}`);
    });

  const handlePreviewBook = () =>
    runAction("book", async () => {
      if (!walletAddress || !isDeepBookNetwork(network)) return;
      const low = midPrice ? midPrice * 0.9 : 0.5;
      const high = midPrice ? midPrice * 1.1 : 2;
      const book = await fetchDeepBookLevel2(
        walletAddress,
        network,
        selectedPool,
        deepBookState?.balanceManagerId,
        low,
        high,
        true,
      );
      addLog(
        "info",
        `Level 2 (${selectedPool}) — ${book.prices.length} price level(s) loaded`,
      );
    });

  const handleFlipSwapDirection = () => {
    setSwapDirection((prev) => (prev === "a-for-b" ? "b-for-a" : "a-for-b"));
  };

  const sandboxTabs = useMemo(
    () => [
      { id: "pools" as const, label: "Pools", icon: <Layers size={14} /> },
      { id: "swap" as const, label: "Swap", icon: <ArrowLeftRight size={14} /> },
      { id: "faucet" as const, label: "Faucet", icon: <Droplets size={14} /> },
      { id: "setup" as const, label: "Setup", icon: <Settings2 size={14} /> },
    ],
    [],
  );

  const resetSandbox = () => {
    if (!window.confirm("Clear saved DeFi sandbox deployment state?")) return;
    clearDefiSandboxDeployment();
    setDeployment(null);
    invalidateSnapshot();
    addLog("info", "Cleared DeFi sandbox state.");
  };

  const resetDeepBook = () => {
    if (!window.confirm("Clear saved DeepBook balance manager?")) return;
    clearDeepBookState();
    setDeepBookState(null);
    setManagerBalances({});
    addLog("info", "Cleared DeepBook playground state.");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-[#101018]">
        <div className="flex items-center rounded-xl border border-[#2a2a3c] bg-[#0d0d14] p-0.5">
          <button
            onClick={() => setPanel("sandbox")}
            className={`h-7 px-3 rounded-lg text-[11px] border-none cursor-pointer transition-colors ${
              panel === "sandbox"
                ? "bg-[#34d399]/14 text-[#34d399] font-medium"
                : "bg-transparent text-[#8888a0] hover:text-[#f0f0f5]"
            }`}
          >
            Sandbox
          </button>
          <button
            onClick={() => setPanel("deepbook")}
            className={`h-7 px-3 rounded-lg text-[11px] border-none cursor-pointer transition-colors ${
              panel === "deepbook"
                ? "bg-[#34d399]/14 text-[#34d399] font-medium"
                : "bg-transparent text-[#8888a0] hover:text-[#f0f0f5]"
            }`}
          >
            DeepBook
          </button>
        </div>

        <div className="flex-1" />
        <NetworkSwitcher compact />
        <button
          onClick={() => {
            void refreshPoolsData();
            void refreshDeepBookData();
          }}
          title="Refresh"
          className="h-8 w-8 flex items-center justify-center rounded-xl border border-[#2a2a3c] bg-[#0d0d14] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer"
        >
          <RefreshCw size={14} />
        </button>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-y-auto">
          {panel === "sandbox" ? (
            <div className="p-5 space-y-5">
              <div className="flex flex-col gap-4 min-w-0">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-[#34d399]/12 flex items-center justify-center text-[#34d399] flex-shrink-0">
                    <Waves size={18} />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-[16px] font-semibold text-[#f0f0f5] leading-snug">
                      DeFi Sandbox
                    </h1>
                    <p className="text-[12px] text-[#8888a0] mt-0.5 truncate">
                      AMM pools & swaps on {NETWORK_CONFIG[network].label}
                    </p>
                  </div>
                </div>
                <div className="min-w-0 w-full">
                  <DefiSandboxTabs
                    active={sandboxTab}
                    onChange={setSandboxTab}
                    tabs={sandboxTabs}
                  />
                </div>
              </div>

              {network !== "localnet" && (
                <DefiAlert tone="warn">
                  <span className="inline-flex items-start gap-2">
                    <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
                    DeFi Sandbox works best on <strong>Localnet</strong> — free
                    faucet, no rate limits.
                  </span>
                </DefiAlert>
              )}

              {deploymentNetworkMismatch && (
                <DefiAlert tone="warn">
                  Saved deployment is on{" "}
                  <strong>{NETWORK_CONFIG[deployment!.network].label}</strong> but
                  wallet is on <strong>{NETWORK_CONFIG[network].label}</strong>.
                  Switch network or redeploy in Setup.
                </DefiAlert>
              )}

              {!deployment?.packageId && sandboxTab !== "setup" && (
                <DefiAlert tone="info">
                  Deploy the sandbox package in <strong>Setup</strong> before using
                  pools, swap, or faucet.
                </DefiAlert>
              )}

              {sandboxTab === "pools" && (
                <DefiTabContent tabKey="pools">
                <SandboxPoolsTab
                  deployment={deployment}
                  pools={poolSummaries}
                  activePool={activePool}
                  poolSnapshot={poolSnapshot}
                  poolLoading={poolLoading}
                  poolCoins={poolCoins}
                  coinOptions={coinOptions}
                  selectedCoinTypeA={selectedCoinTypeA}
                  selectedCoinTypeB={selectedCoinTypeB}
                  pendingCoinA={pendingCoinA}
                  pendingCoinB={pendingCoinB}
                  liquidityAmountA={liquidityAmountA}
                  liquidityAmountB={liquidityAmountB}
                  busy={busy}
                  onRefreshPool={() => void refreshPoolsData()}
                  onRefreshPools={() => void refreshPoolsData()}
                  onRefreshCoins={() => void refreshCoinOptions()}
                  onSelectPool={handleSelectPool}
                  onSelectCoinA={setSelectedCoinTypeA}
                  onSelectCoinB={setSelectedCoinTypeB}
                  onLiquidityAChange={setLiquidityAmountA}
                  onLiquidityBChange={setLiquidityAmountB}
                  onCreatePool={() => void handleCreatePool()}
                  onAddLiquidity={() => void handleAddLiquidity()}
                />
                </DefiTabContent>
              )}

              {sandboxTab === "swap" && (
                <DefiTabContent tabKey="swap">
                <SandboxSwapTab
                  pools={poolSummaries}
                  activePool={activePool}
                  poolSnapshot={poolSnapshot}
                  poolLoading={poolLoading}
                  poolCoins={poolCoins}
                  swapAmount={swapAmount}
                  swapDirection={swapDirection}
                  swapEstimate={swapEstimate}
                  busy={busy}
                  onRefreshPool={() => void refreshPoolsData()}
                  onSelectPool={handleSelectPool}
                  onSwapAmountChange={setSwapAmount}
                  onFlipDirection={handleFlipSwapDirection}
                  onSwap={() => void handleSwap()}
                />
                </DefiTabContent>
              )}

              {sandboxTab === "faucet" &&
                (showSandboxFaucet && sandboxFaucetCoins ? (
                  <DefiTabContent tabKey="faucet">
                  <SandboxFaucetTab
                    tokenA={sandboxFaucetCoins.tokenA}
                    tokenB={sandboxFaucetCoins.tokenB}
                    faucetAmountA={faucetAmountA}
                    faucetAmountB={faucetAmountB}
                    busy={busy}
                    onFaucetAChange={setFaucetAmountA}
                    onFaucetBChange={setFaucetAmountB}
                    onFaucetA={() => void handleFaucetA()}
                    onFaucetB={() => void handleFaucetB()}
                    onFaucetBoth={() => void handleFaucetBoth()}
                  />
                  </DefiTabContent>
                ) : (
                  <DefiTabContent tabKey="faucet-empty">
                  <DefiAlert tone="info">
                    Deploy the package in Setup to enable the TA/TB faucet.
                  </DefiAlert>
                  </DefiTabContent>
                ))}

              {sandboxTab === "setup" && (
                <DefiTabContent tabKey="setup">
                <SandboxSetupTab
                  deployment={deployment}
                  network={network}
                  busy={busy}
                  walletConnected={Boolean(walletAddress)}
                  onDeploy={() => void handleDeploySandbox()}
                  onReset={resetSandbox}
                />
                </DefiTabContent>
              )}
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {!isDeepBookNetwork(network) ? (
                <div className="rounded-2xl border border-[#ffb347]/30 bg-[#ffb347]/10 p-4 flex gap-3">
                  <AlertCircle className="text-[#ffb347] flex-shrink-0" size={18} />
                  <div>
                    <p className="text-[13px] font-medium text-[#ffb347]">
                      DeepBook requires Testnet or Mainnet
                    </p>
                    <p className="text-[12px] text-[#c7a56a] mt-1 leading-relaxed">
                      DeepBook pools are not deployed on localnet. Switch network to
                      testnet or mainnet, or use the Sandbox panel for local AMM
                      practice.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <section className="rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4">
                    <h2 className="text-[14px] font-semibold text-[#f0f0f5]">
                      DeepBook v3 ({network})
                    </h2>
                    <p className="text-[12px] text-[#8888a0] mt-1 leading-relaxed">
                      Create a balance manager, deposit coins, and place a limit order
                      on a live DeepBook pool.
                    </p>
                    {midPrice !== null && (
                      <p className="mt-2 text-[12px] text-[#34d399] font-mono">
                        {selectedPool} mid price: {midPrice}
                      </p>
                    )}
                  </section>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ActionCard
                      icon={<Coins size={16} />}
                      title="Balance manager"
                      description={
                        deepBookState?.balanceManagerId
                          ? `Active: ${deepBookState.balanceManagerId.slice(0, 18)}…`
                          : "Required before deposits and orders."
                      }
                      actionLabel={busy === "bm" ? "Creating..." : "Create manager"}
                      disabled={!!busy || !walletAddress}
                      onClick={() => void handleCreateBalanceManager()}
                    />
                    <ActionCard
                      icon={<TrendingUp size={16} />}
                      title="Deposit"
                      description="Fund the balance manager from your wallet."
                      actionLabel={busy === "deposit" ? "Depositing..." : "Deposit"}
                      disabled={!!busy || !deepBookState?.balanceManagerId}
                      onClick={() => void handleDeposit()}
                      extra={
                        <div className="mt-2 flex gap-2">
                          <select
                            value={depositCoin}
                            onChange={(e) => setDepositCoin(e.target.value)}
                            className="h-8 px-2 rounded-lg text-[11px] bg-[#0d0d14] border border-[#2a2a3c] text-[#d8d8ea]"
                          >
                            <option value="SUI">SUI</option>
                            <option value="DBUSDC">DBUSDC</option>
                            <option value="DBUSDT">DBUSDT</option>
                            <option value="DEEP">DEEP</option>
                          </select>
                          <input
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            className="h-8 flex-1 px-2 rounded-lg text-[11px] bg-[#0d0d14] border border-[#2a2a3c] text-[#d8d8ea]"
                            placeholder="Amount"
                          />
                        </div>
                      }
                    />
                  </div>

                  <section className="rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4 space-y-3">
                    <h3 className="text-[12px] font-bold text-[#8888a0] uppercase tracking-[1.2px]">
                      Limit order
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[11px] text-[#8888a0]">Pool</span>
                        <select
                          value={selectedPool}
                          onChange={(e) => setSelectedPool(e.target.value)}
                          className="mt-1 w-full h-9 px-3 rounded-xl text-[12px] bg-[#0d0d14] border border-[#2a2a3c] text-[#f0f0f5]"
                        >
                          {deepBookPools.map((pool) => (
                            <option key={pool.key} value={pool.key}>
                              {pool.key}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-[#8888a0]">Side</span>
                        <select
                          value={orderIsBid ? "bid" : "ask"}
                          onChange={(e) => setOrderIsBid(e.target.value === "bid")}
                          className="mt-1 w-full h-9 px-3 rounded-xl text-[12px] bg-[#0d0d14] border border-[#2a2a3c] text-[#f0f0f5]"
                        >
                          <option value="bid">Bid (buy base)</option>
                          <option value="ask">Ask (sell base)</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-[#8888a0]">Price</span>
                        <input
                          value={orderPrice}
                          onChange={(e) => setOrderPrice(e.target.value)}
                          className="mt-1 w-full h-9 px-3 rounded-xl text-[12px] bg-[#0d0d14] border border-[#2a2a3c] text-[#f0f0f5]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-[#8888a0]">Quantity</span>
                        <input
                          value={orderQuantity}
                          onChange={(e) => setOrderQuantity(e.target.value)}
                          className="mt-1 w-full h-9 px-3 rounded-xl text-[12px] bg-[#0d0d14] border border-[#2a2a3c] text-[#f0f0f5]"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void handlePlaceOrder()}
                        disabled={!!busy || !deepBookState?.balanceManagerId}
                        className="h-9 px-4 rounded-xl text-[12px] border border-[#34d399]/30 bg-[#34d399]/10 text-[#34d399] cursor-pointer disabled:opacity-50"
                      >
                        {busy === "order" ? "Placing..." : "Place limit order"}
                      </button>
                      <button
                        onClick={() => void handlePreviewBook()}
                        disabled={!!busy}
                        className="h-9 px-4 rounded-xl text-[12px] border border-[#2a2a3c] bg-[#0d0d14] text-[#8888a0] cursor-pointer disabled:opacity-50"
                      >
                        {busy === "book" ? "Loading..." : "Preview order book"}
                      </button>
                    </div>
                  </section>

                  {deepBookState?.balanceManagerId && (
                    <section className="rounded-xl border border-[#2a2a3c] bg-[#1e1e1e] p-3">
                      <p className="text-[10px] text-[#8888a0] uppercase tracking-wide mb-2">
                        Manager balances
                      </p>
                      <div className="flex flex-wrap gap-3 text-[11px] font-mono text-[#c7c7d8]">
                        {Object.entries(managerBalances).map(([coin, balance]) => (
                          <span key={coin}>
                            {coin}: {balance}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={resetDeepBook}
                        className="mt-2 text-[11px] text-[#8888a0] hover:text-[#f0f0f5] bg-transparent border-none cursor-pointer"
                      >
                        Reset DeepBook state
                      </button>
                    </section>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <aside className="w-[320px] flex-shrink-0 overflow-y-auto p-4 bg-[#12121a] border-l border-white/[0.06]">
          <p className="text-[11px] font-bold text-[#8888a0] uppercase tracking-[1.2px] mb-3">
            Network
          </p>
          <SuiClientPanel
            mode="move"
            walletAddress={walletAddress}
            onLog={addLog}
          />
          {!walletAddress && (
            <p className="mt-3 text-[11px] text-[#55556a] leading-relaxed">
              Connect your wallet to deploy packages and send DeFi transactions.
            </p>
          )}
          {localNetRunning && panel === "sandbox" && (
            <p className="mt-3 text-[11px] text-[#34d399] leading-relaxed">
              Localnet is running — ideal for the sandbox wizard.
            </p>
          )}
        </aside>
      </div>

      <PlaygroundConsole logs={logs} onClear={() => setLogs([])} />
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  actionLabel,
  disabled,
  onClick,
  extra,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  disabled?: boolean;
  onClick: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4 flex flex-col">
      <div className="flex items-center gap-2 text-[#34d399]">
        {icon}
        <h3 className="text-[13px] font-semibold text-[#f0f0f5]">{title}</h3>
      </div>
      <p className="text-[11px] text-[#8888a0] mt-2 leading-relaxed flex-1">
        {description}
      </p>
      {extra}
      <button
        onClick={onClick}
        disabled={disabled}
        className="mt-3 h-9 px-4 rounded-xl text-[12px] font-medium border border-[#34d399]/30 bg-[#34d399]/10 text-[#34d399] cursor-pointer disabled:opacity-50 self-start"
      >
        {actionLabel}
      </button>
    </div>
  );
}