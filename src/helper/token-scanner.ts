import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
const LOCALNET_RPC = "http://127.0.0.1:9000";
import {
  isValidSuiAddress,
  isValidSuiObjectId,
  normalizeSuiAddress,
} from "@mysten/sui/utils";

export type ScannerNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type SignalSeverity = "info" | "good" | "warning" | "danger";

export interface RiskSignal {
  id: string;
  title: string;
  description: string;
  severity: SignalSeverity;
}

export interface LiquidityPool {
  dex: string;
  poolId: string;
  pair: string;
  locked: boolean | null;
  lockDetail: string;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  description: string;
  iconUrl: string | null;
}

export interface TreasuryCapInfo {
  exists: boolean;
  objectId: string | null;
  ownerType: string | null;
  ownerAddress: string | null;
  mintable: boolean;
}

export interface PackageInfo {
  version: number | null;
  immutable: boolean;
  moduleCount: number;
  upgradeCapHeld: boolean;
  upgradeCapOwner: string | null;
}

export interface TokenScanResult {
  coinType: string;
  packageId: string;
  metadata: TokenMetadata | null;
  supply: {
    raw: string;
    formatted: string;
  } | null;
  treasuryCap: TreasuryCapInfo;
  packageInfo: PackageInfo | null;
  liquidity: {
    checked: boolean;
    hasRoutes: boolean;
    pools: LiquidityPool[];
  };
  riskScore: number;
  riskLevel: RiskLevel;
  signals: RiskSignal[];
}

const COIN_TYPE_RE =
  /^0x[a-fA-F0-9]+::[a-zA-Z_][a-zA-Z0-9_]*::[a-zA-Z_][a-zA-Z0-9_]*$/;

const GRAPHQL_URLS: Record<Exclude<ScannerNetwork, "localnet">, string> = {
  mainnet: "https://graphql.mainnet.sui.io/graphql",
  testnet: "https://graphql.testnet.sui.io/graphql",
  devnet: "https://graphql.devnet.sui.io/graphql",
};

const IGNORED_STRUCTS = new Set([
  "Coin",
  "CoinMetadata",
  "TreasuryCap",
  "DenyCap",
  "DenyCapV2",
  "RegulatedCoinMetadata",
  "CurrencyCreated",
]);

function createClient(network: ScannerNetwork) {
  return new SuiJsonRpcClient({
    url: network === "localnet" ? LOCALNET_RPC : getJsonRpcFullnodeUrl(network),
    network: network === "localnet" ? "testnet" : network,
  });
}

function packageIdFromCoinType(coinType: string) {
  return normalizeSuiAddress(coinType.split("::")[0]);
}

async function graphqlRequest<T>(
  network: ScannerNetwork,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  if (network === "localnet") {
    throw new Error("GraphQL is not available on localnet.");
  }

  const response = await fetch(GRAPHQL_URLS[network], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }

  if (!payload.data) {
    throw new Error("GraphQL request returned no data.");
  }

  return payload.data;
}

function formatSupply(raw: string, decimals: number) {
  const value = BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  if (fraction === 0n) return whole.toLocaleString("en-US");
  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}.${fractionStr}`;
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 76) return "critical";
  if (score >= 51) return "high";
  if (score >= 26) return "medium";
  return "low";
}

function isCoinStruct(name: string, abilities: { abilities: string[] }) {
  if (IGNORED_STRUCTS.has(name)) return false;
  const caps = new Set(abilities.abilities ?? []);
  return caps.has("store") && (caps.has("key") || name.toUpperCase() === name);
}

async function resolveCoinTypeFromPackage(
  client: SuiJsonRpcClient,
  packageId: string,
): Promise<string> {
  let modules: Awaited<
    ReturnType<SuiJsonRpcClient["getNormalizedMoveModulesByPackage"]>
  >;
  try {
    modules = await client.getNormalizedMoveModulesByPackage({
      package: packageId,
    });
  } catch (err: any) {
    const message = err?.message ?? String(err);
    if (/does not exist/i.test(message)) {
      throw new Error(
        `${message} Scan on the same network where the token was deployed (e.g. localnet packages only exist on localnet).`,
      );
    }
    throw err;
  }

  const candidates: string[] = [];
  for (const [moduleName, moduleDef] of Object.entries(modules)) {
    for (const [structName, structDef] of Object.entries(
      moduleDef.structs ?? {},
    )) {
      if (!isCoinStruct(structName, structDef)) continue;
      candidates.push(`${packageId}::${moduleName}::${structName}`);
    }
  }

  if (!candidates.length) {
    throw new Error(
      "No coin struct found in package. Provide the full coin type (0x...::module::COIN).",
    );
  }

  for (const candidate of candidates) {
    const metadata = await client.getCoinMetadata({ coinType: candidate });
    if (metadata) return candidate;
  }

  return candidates[0];
}

async function resolveCoinTypeFromObject(
  client: SuiJsonRpcClient,
  objectId: string,
): Promise<string> {
  const object = await client.getObject({
    id: objectId,
    options: { showType: true, showContent: true },
  });

  const type = object.data?.type;
  if (!type) {
    throw new Error("Object has no type information.");
  }

  const treasuryMatch = type.match(/0x2::coin::TreasuryCap<(.+)>/);
  if (treasuryMatch?.[1]) return treasuryMatch[1];

  const currencyMatch = type.match(/0x2::coin_registry::Currency<(.+)>/);
  if (currencyMatch?.[1]) return currencyMatch[1];

  const coinMatch = type.match(/0x2::coin::Coin<(.+)>/);
  if (coinMatch?.[1]) return coinMatch[1];

  throw new Error(
    "Object is not a coin, treasury cap, or currency registry entry. Provide a coin type or package ID.",
  );
}

async function resolveCoinType(
  client: SuiJsonRpcClient,
  input: string,
): Promise<string> {
  const trimmed = input.trim();

  if (COIN_TYPE_RE.test(trimmed)) {
    return trimmed;
  }

  if (isValidSuiObjectId(trimmed)) {
    return resolveCoinTypeFromObject(client, trimmed);
  }

  if (isValidSuiAddress(trimmed)) {
    return resolveCoinTypeFromPackage(
      client,
      normalizeSuiAddress(trimmed),
    );
  }

  throw new Error(
    "Invalid input. Provide a coin type (0x...::module::COIN), package ID, or coin object ID.",
  );
}

async function fetchTreasuryCap(
  network: ScannerNetwork,
  coinType: string,
): Promise<TreasuryCapInfo> {
  const query = `
    query TreasuryCap($type: String!) {
      objects(first: 5, filter: { type: $type }) {
        nodes {
          address
          owner {
            __typename
            ... on AddressOwner { address { address } }
            ... on ObjectOwner { address { address } }
            ... on Shared { initialSharedVersion }
          }
        }
      }
    }
  `;

  const data = await graphqlRequest<{
    objects: {
      nodes: Array<{
        address: string;
        owner: {
          __typename: string;
          address?: { address: string };
          initialSharedVersion?: number;
        } | null;
      }>;
    };
  }>(network, query, { type: `0x2::coin::TreasuryCap<${coinType}>` });

  const node = data.objects.nodes[0];
  if (!node) {
    return {
      exists: false,
      objectId: null,
      ownerType: null,
      ownerAddress: null,
      mintable: false,
    };
  }

  const ownerType = node.owner?.__typename ?? null;
  const ownerAddress = node.owner?.address?.address ?? null;

  return {
    exists: true,
    objectId: node.address,
    ownerType,
    ownerAddress,
    mintable: true,
  };
}

async function fetchPackageInfo(
  network: ScannerNetwork,
  packageId: string,
): Promise<PackageInfo> {
  const query = `
    query PackageInfo($address: SuiAddress!) {
      object(address: $address) {
        owner { __typename }
        asMovePackage {
          version
          modules { nodes { name } }
        }
      }
      upgradeCaps: objects(first: 25, filter: { type: "0x2::package::UpgradeCap" }) {
        nodes {
          owner {
            __typename
            ... on AddressOwner { address { address } }
          }
          asMoveObject {
            contents { json }
          }
        }
      }
    }
  `;

  const data = await graphqlRequest<{
    object: {
      owner: { __typename: string } | null;
      asMovePackage: {
        version: number;
        modules: { nodes: Array<{ name: string }> };
      } | null;
    } | null;
    upgradeCaps: {
      nodes: Array<{
        owner: {
          __typename: string;
          address?: { address: string };
        } | null;
        asMoveObject: {
          contents: { json: Record<string, unknown> } | null;
        } | null;
      }>;
    };
  }>(network, query, { address: packageId });

  const pkg = data.object?.asMovePackage;
  const immutable = data.object?.owner?.__typename === "Immutable";

  const upgradeCap = data.upgradeCaps.nodes.find((node) => {
    const json = node.asMoveObject?.contents?.json;
    if (!json) return false;
    const serialized = JSON.stringify(json).toLowerCase();
    return serialized.includes(packageId.replace("0x", "").toLowerCase());
  });

  return {
    version: pkg?.version ?? null,
    immutable,
    moduleCount: pkg?.modules.nodes.length ?? 0,
    upgradeCapHeld: Boolean(upgradeCap),
    upgradeCapOwner: upgradeCap?.owner?.address?.address ?? null,
  };
}

interface CetusRoutePath {
  id?: string;
  provider?: string;
  from?: string;
  target?: string;
}

async function fetchLiquidity(coinType: string) {
  const target = "0x2::sui::SUI";
  const amount = 1_000_000;
  const url =
    "https://api-sui.cetus.zone/router_v3/find_routes?" +
    new URLSearchParams({
      from: coinType,
      target,
      amount: String(amount),
      by_amount_in: "true",
      v: "1010101",
    }).toString();

  const response = await fetch(url);
  const payload = (await response.json()) as {
    code: number;
    msg: string;
    data?: {
      paths?: CetusRoutePath[];
      routes?: Array<{ path?: CetusRoutePath[] }>;
    };
  };

  if (payload.code !== 200 || !payload.data) {
    return { hasRoutes: false, pools: [] as LiquidityPool[] };
  }

  const paths = payload.data.paths ?? [];
  const routePaths =
    payload.data.routes?.flatMap((route) => route.path ?? []) ?? [];
  const merged = [...paths, ...routePaths];

  const seen = new Set<string>();
  const pools: LiquidityPool[] = [];

  for (const hop of merged) {
    if (!hop.id || !hop.provider) continue;
    if (!hop.from?.includes(coinType.split("::")[0]) && hop.from !== coinType) {
      if (hop.target !== coinType && !hop.target?.includes(coinType.split("::")[0])) {
        continue;
      }
    }
    const key = `${hop.provider}:${hop.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    pools.push({
      dex: hop.provider,
      poolId: hop.id,
      pair: `${shortCoin(hop.from ?? "?")} / ${shortCoin(hop.target ?? "?")}`,
      locked: null,
      lockDetail: "LP lock status could not be verified automatically.",
    });
  }

  return {
    hasRoutes: pools.length > 0,
    pools: pools.slice(0, 8),
  };
}

function shortCoin(coin: string) {
  if (!coin.includes("::")) return coin.slice(0, 10);
  const [, module, symbol] = coin.split("::");
  return `${module}::${symbol}`;
}

function buildSignals(
  metadata: TokenMetadata | null,
  treasuryCap: TreasuryCapInfo,
  packageInfo: PackageInfo | null,
  liquidity: TokenScanResult["liquidity"],
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  if (!metadata) {
    signals.push({
      id: "no-metadata",
      title: "Missing coin metadata",
      description:
        "No on-chain metadata was found. The token may be unregistered or misconfigured.",
      severity: "warning",
    });
  } else {
    signals.push({
      id: "metadata-found",
      title: "Metadata on-chain",
      description: `${metadata.name} (${metadata.symbol}) with ${metadata.decimals} decimals.`,
      severity: "good",
    });
  }

  if (treasuryCap.exists) {
    if (treasuryCap.ownerType === "AddressOwner") {
      signals.push({
        id: "mint-wallet",
        title: "Mint authority in wallet",
        description:
          "TreasuryCap is held by a single address. The owner can mint additional supply.",
        severity: "danger",
      });
    } else if (treasuryCap.ownerType === "ObjectOwner") {
      signals.push({
        id: "mint-object",
        title: "Mint authority active",
        description:
          "TreasuryCap exists and is controlled by another object. Additional minting may still be possible.",
        severity: "warning",
      });
    } else if (treasuryCap.ownerType === "Shared") {
      signals.push({
        id: "mint-shared",
        title: "Shared mint authority",
        description:
          "TreasuryCap is a shared object. Minting rules depend on the contract logic.",
        severity: "warning",
      });
    } else {
      signals.push({
        id: "mint-unknown",
        title: "Mint authority present",
        description: "TreasuryCap exists on-chain.",
        severity: "warning",
      });
    }
  } else {
    signals.push({
      id: "no-treasury",
      title: "No active TreasuryCap",
      description:
        "No TreasuryCap object was found. Supply is likely fixed or managed by a registry.",
      severity: "good",
    });
  }

  if (packageInfo) {
    if (packageInfo.immutable) {
      signals.push({
        id: "pkg-immutable",
        title: "Package is immutable",
        description: "The publishing package cannot be upgraded in place.",
        severity: "good",
      });
    } else if (packageInfo.upgradeCapHeld) {
      signals.push({
        id: "pkg-upgradeable",
        title: "Package can be upgraded",
        description: packageInfo.upgradeCapOwner
          ? `UpgradeCap is held by ${packageInfo.upgradeCapOwner}. Contract logic could change.`
          : "An UpgradeCap exists for this package.",
        severity: "danger",
      });
    } else {
      signals.push({
        id: "pkg-mutable",
        title: "Package not immutable",
        description:
          "Package ownership is not immutable. Verify upgrade controls manually.",
        severity: "warning",
      });
    }
  }

  if (liquidity.checked) {
    if (liquidity.hasRoutes) {
      signals.push({
        id: "liquidity-found",
        title: "DEX liquidity detected",
        description: `Found ${liquidity.pools.length} tradable route(s) via aggregated DEX liquidity.`,
        severity: "good",
      });

      const unlocked = liquidity.pools.filter((pool) => pool.locked === false);
      if (unlocked.length) {
        signals.push({
          id: "lp-unlocked",
          title: "LP may not be locked",
          description:
            "Liquidity exists but lock status is unverified. Rug-pull risk remains if LP is not burned or locked.",
          severity: "warning",
        });
      } else {
        signals.push({
          id: "lp-lock-unknown",
          title: "LP lock unverified",
          description:
            "Liquidity pools were found, but lock/burn status could not be confirmed automatically.",
          severity: "warning",
        });
      }
    } else {
      signals.push({
        id: "no-liquidity",
        title: "No DEX liquidity found",
        description:
          "No swap routes to SUI were found. The token may be illiquid or not yet listed.",
        severity: "warning",
      });
    }
  } else {
    signals.push({
      id: "liquidity-skipped",
      title: "Liquidity scan limited",
      description:
        "DEX route scanning is only available on mainnet in this version.",
      severity: "info",
    });
  }

  return signals;
}

function computeRiskScore(signals: RiskSignal[]) {
  let score = 10;

  for (const signal of signals) {
    if (signal.severity === "danger") score += 22;
    if (signal.severity === "warning") score += 12;
    if (signal.severity === "good") score -= 6;
  }

  return Math.max(0, Math.min(100, score));
}

export async function scanToken(
  input: string,
  network: ScannerNetwork,
): Promise<TokenScanResult> {
  const client = createClient(network);
  const coinType = await resolveCoinType(client, input);
  const packageId = packageIdFromCoinType(coinType);

  const [metadataResult, supplyResult, treasuryCap, packageInfo] =
    await Promise.all([
      client.getCoinMetadata({ coinType }),
      client.getTotalSupply({ coinType }).catch(() => null),
      fetchTreasuryCap(network, coinType).catch(() => ({
        exists: false,
        objectId: null,
        ownerType: null,
        ownerAddress: null,
        mintable: false,
      })),
      fetchPackageInfo(network, packageId).catch(() => null),
    ]);

  const metadata = metadataResult
    ? {
        name: metadataResult.name,
        symbol: metadataResult.symbol,
        decimals: metadataResult.decimals,
        description: metadataResult.description ?? "",
        iconUrl: metadataResult.iconUrl ?? null,
      }
    : null;

  const supply =
    supplyResult?.value != null
      ? {
          raw: supplyResult.value,
          formatted: formatSupply(
            supplyResult.value,
            metadata?.decimals ?? 9,
          ),
        }
      : null;

  const liquidity =
    network === "mainnet"
      ? {
          checked: true,
          ...(await fetchLiquidity(coinType)),
        }
      : {
          checked: false,
          hasRoutes: false,
          pools: [] as LiquidityPool[],
        };

  const signals = buildSignals(metadata, treasuryCap, packageInfo, liquidity);
  const riskScore = computeRiskScore(signals);

  return {
    coinType,
    packageId,
    metadata,
    supply,
    treasuryCap,
    packageInfo,
    liquidity,
    riskScore,
    riskLevel: riskLevelFromScore(riskScore),
    signals,
  };
}