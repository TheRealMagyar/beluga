import { ipcMain } from "electron";
import path from "node:path";
import { requestFaucetCoins } from "../helper/sui-faucet";
import {
  getSimpleTransactionHistory,
  getSimpleWalletBalance,
} from "../helper/sui-rpc";
import type { MainIpcContext } from "./context";

export function registerWalletIpc(ctx: MainIpcContext) {
  ipcMain.handle("wallet:exists", async () => {
    const { walletExists } = await import("@t2000/sdk");
    return walletExists();
  });

  ipcMain.handle("wallet:generate", async () => {
    try {
      const { T2000 } = await import("@t2000/sdk");
      const { agent, address } = await T2000.init();
      ctx.setAgent(agent);
      const publicKey = (agent as { keypair: { getPublicKey: () => { toSuiPublicKey: () => string } } })
        .keypair.getPublicKey()
        .toSuiPublicKey();
      return { success: true, address, publicKey };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("wallet:getInfo", async () => {
    try {
      const { T2000, walletExists } = await import("@t2000/sdk");
      if (!walletExists()) return null;
      const agent = await T2000.create();
      ctx.setAgent(agent);
      const address = agent.address();
      const publicKey = agent.keypair.getPublicKey().toSuiPublicKey();
      return { success: true, address, publicKey };
    } catch {
      return null;
    }
  });

  ipcMain.handle("wallet:import", async (_, privateKey: string) => {
    try {
      const { T2000, saveKey, keypairFromPrivateKey } =
        await import("@t2000/sdk");
      const keypair = keypairFromPrivateKey(privateKey);
      await saveKey(keypair, undefined);
      const agent = await T2000.create();
      ctx.setAgent(agent);
      return { success: true, address: agent.address() };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("wallet:load", async () => {
    try {
      const agent = (await ctx.getAgent()) as { address: () => string };
      return { address: agent.address() };
    } catch {
      return null;
    }
  });

  ipcMain.handle("wallet:exportPrivateKey", async () => {
    try {
      const agent = (await ctx.getAgent()) as { exportKey: () => string };
      return agent.exportKey();
    } catch {
      return null;
    }
  });

  ipcMain.handle("wallet:delete", async () => {
    const fs = await import("fs");
    const os = await import("os");
    const keyPath = path.join(os.homedir(), ".t2000", "wallet.key");
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
    ctx.resetAgent();
    return true;
  });

  ipcMain.handle(
    "wallet:signTransaction",
    async (_, { transactionBytesB64 }: { transactionBytesB64: string }) => {
      try {
        const agent = (await ctx.getAgent()) as {
          keypair: {
            signTransaction: (bytes: Buffer) => Promise<{
              signature: string;
              bytes: string | Uint8Array;
            }>;
          };
        };
        const bytes = Buffer.from(transactionBytesB64, "base64");
        const { signature, bytes: signedBytes } =
          await agent.keypair.signTransaction(bytes);
        return {
          success: true,
          bytes:
            typeof signedBytes === "string"
              ? signedBytes
              : Buffer.from(signedBytes).toString("base64"),
          signature,
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle(
    "wallet:signPersonalMessage",
    async (_, { messageB64 }: { messageB64: string }) => {
      try {
        const agent = (await ctx.getAgent()) as {
          keypair: {
            signPersonalMessage: (message: Buffer) => Promise<{
              signature: string;
              bytes: string | Uint8Array;
            }>;
          };
        };
        const message = Buffer.from(messageB64, "base64");
        const { signature, bytes: signedBytes } =
          await agent.keypair.signPersonalMessage(message);
        return {
          success: true,
          bytes:
            typeof signedBytes === "string"
              ? signedBytes
              : Buffer.from(signedBytes).toString("base64"),
          signature,
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle(
    "sui:getBalance",
    async (_, { network = "mainnet" }: { network?: string }) => {
      try {
        const agent = (await ctx.getAgent()) as {
          address: () => string;
          balance: () => Promise<unknown>;
        };
        const address = agent.address();

        if (
          network === "testnet" ||
          network === "devnet" ||
          network === "localnet"
        ) {
          const balance = await getSimpleWalletBalance(address, network);
          return { success: true, balance };
        }

        const balance = await agent.balance();
        return { success: true, balance };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle(
    "sui:getTransactions",
    async (
      _,
      { limit = 20, network = "mainnet" }: { limit?: number; network?: string },
    ) => {
      try {
        const agent = (await ctx.getAgent()) as {
          address: () => string;
          history: (opts: { limit: number }) => Promise<unknown>;
        };
        const address = agent.address();

        if (
          network === "testnet" ||
          network === "devnet" ||
          network === "localnet"
        ) {
          const transactions = await getSimpleTransactionHistory(
            address,
            network,
            limit,
          );
          return { success: true, transactions };
        }

        const transactions = await agent.history({ limit });
        return { success: true, transactions };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle(
    "sui:requestFaucet",
    async (
      _,
      {
        network,
        recipient,
      }: { network: "testnet" | "devnet" | "localnet"; recipient: string },
    ) => {
      try {
        const result = await requestFaucetCoins(network, recipient);
        return { success: true, ...result };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle(
    "sui:send",
    async (
      _,
      { to, amount, asset }: { to: string; amount: string; asset: string },
    ) => {
      try {
        const agent = (await ctx.getAgent()) as {
          send: (opts: {
            to: string;
            amount: number;
            asset: string;
          }) => Promise<{ digest: string }>;
        };
        const result = await agent.send({
          to,
          amount: Number(amount),
          asset,
        });
        return { success: true, digest: result.digest };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle("sui:swap", async (_, { from, to, amount, slippage }: {
    from: string;
    to: string;
    amount: string;
    slippage?: number;
  }) => {
    try {
      const agent = (await ctx.getAgent()) as {
        swap: (opts: {
          from: string;
          to: string;
          amount: number;
          slippage?: number;
        }) => Promise<unknown>;
      };
      const result = await agent.swap({
        from,
        to,
        amount: Number(amount),
        slippage,
      });
      return { success: true, result };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("sui:swapQuote", async (_, { from, to, amount }: {
    from: string;
    to: string;
    amount: string;
  }) => {
    try {
      const agent = (await ctx.getAgent()) as {
        swapQuote: (opts: {
          from: string;
          to: string;
          amount: number;
        }) => Promise<unknown>;
      };
      const quote = await agent.swapQuote({
        from,
        to,
        amount: Number(amount),
      });
      return { success: true, quote };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("sui:pay", async (_, { url, method, body, maxPrice }: {
    url: string;
    method: string;
    body?: unknown;
    maxPrice?: number;
  }) => {
    try {
      const agent = (await ctx.getAgent()) as {
        pay: (opts: {
          url: string;
          method: string;
          body?: unknown;
          maxPrice?: number;
        }) => Promise<unknown>;
      };
      const result = await agent.pay({ url, method, body, maxPrice });
      return { success: true, result };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("sui:resolveRecipient", async (_, input: unknown) => {
    try {
      const agent = (await ctx.getAgent()) as {
        resolveRecipient: (value: unknown) => Promise<unknown>;
      };
      const resolved = await agent.resolveRecipient(input);
      return { success: true, resolved };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  // ── NAVI lending (collateral / borrow — used for leveraged long/short) ──

  ipcMain.handle(
    "sui:naviSave",
    async (
      _,
      {
        amount,
        asset = "USDC",
      }: { amount: number | "all"; asset?: string },
    ) => {
      try {
        const agent = (await ctx.getAgent()) as {
          save: (opts: {
            amount: number | "all";
            asset?: string;
          }) => Promise<unknown>;
        };
        const result = await agent.save({ amount, asset });
        return { success: true, result };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle(
    "sui:naviWithdraw",
    async (
      _,
      {
        amount,
        asset = "USDC",
      }: { amount: number | "all"; asset?: string },
    ) => {
      try {
        const agent = (await ctx.getAgent()) as {
          withdraw: (opts: {
            amount: number | "all";
            asset?: string;
          }) => Promise<unknown>;
        };
        const result = await agent.withdraw({ amount, asset });
        return { success: true, result };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle(
    "sui:naviBorrow",
    async (
      _,
      { amount, asset = "USDC" }: { amount: number; asset?: string },
    ) => {
      try {
        const agent = (await ctx.getAgent()) as {
          borrow: (opts: {
            amount: number;
            asset?: string;
          }) => Promise<unknown>;
        };
        const result = await agent.borrow({ amount, asset });
        return { success: true, result };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle(
    "sui:naviRepay",
    async (
      _,
      {
        amount,
        asset = "USDC",
      }: { amount: number | "all"; asset?: string },
    ) => {
      try {
        const agent = (await ctx.getAgent()) as {
          repay: (opts: {
            amount: number | "all";
            asset?: string;
          }) => Promise<unknown>;
        };
        const result = await agent.repay({ amount, asset });
        return { success: true, result };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle("sui:naviPositions", async () => {
    try {
      const agent = (await ctx.getAgent()) as {
        positions: () => Promise<unknown>;
      };
      const result = await agent.positions();
      return { success: true, result };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("sui:naviHealth", async () => {
    try {
      const agent = (await ctx.getAgent()) as {
        healthFactor: () => Promise<unknown>;
        maxBorrow: () => Promise<unknown>;
      };
      const [health, maxBorrow] = await Promise.all([
        agent.healthFactor(),
        agent.maxBorrow().catch(() => null),
      ]);
      return { success: true, health, maxBorrow };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  /**
   * Open a long/short style trade via T2000 agent:
   * - long:  optional NAVI borrow USDC → swap USDC → market
   * - short: optional NAVI borrow market → swap market → USDC
   * Spot (no leverage): just the swap leg.
   */
  ipcMain.handle(
    "sui:openTrade",
    async (
      _,
      {
        side,
        market,
        amount,
        slippage = 1,
        leverage = 1,
        quoteAsset = "USDC",
      }: {
        side: "long" | "short";
        market: string;
        amount: string;
        slippage?: number;
        leverage?: number;
        quoteAsset?: string;
      },
    ) => {
      try {
        const agent = (await ctx.getAgent()) as {
          borrow: (opts: {
            amount: number;
            asset?: string;
          }) => Promise<unknown>;
          swap: (opts: {
            from: string;
            to: string;
            amount: number;
            slippage?: number;
          }) => Promise<unknown>;
        };

        const size = Number(amount);
        if (!Number.isFinite(size) || size <= 0) {
          return { success: false, error: "Invalid amount" };
        }

        const lev = Math.min(Math.max(Number(leverage) || 1, 1), 5);
        const steps: Array<{ step: string; result: unknown }> = [];

        if (side === "long") {
          // Spend `size` quote (USDC) to buy market. Extra (lev-1)*size borrowed if lev > 1.
          let spend = size;
          if (lev > 1) {
            const borrowAmt = size * (lev - 1);
            const borrowRes = await agent.borrow({
              amount: borrowAmt,
              asset: quoteAsset,
            });
            steps.push({ step: "borrow", result: borrowRes });
            spend = size * lev;
          }
          const swapRes = await agent.swap({
            from: quoteAsset,
            to: market,
            amount: spend,
            slippage,
          });
          steps.push({ step: "swap", result: swapRes });
          return { success: true, side, market, leverage: lev, steps };
        }

        // short: sell market for quote. With lev>1 borrow market first then sell total.
        let sell = size;
        if (lev > 1) {
          const borrowAmt = size * (lev - 1);
          const borrowRes = await agent.borrow({
            amount: borrowAmt,
            asset: market,
          });
          steps.push({ step: "borrow", result: borrowRes });
          sell = size * lev;
        }
        const swapRes = await agent.swap({
          from: market,
          to: quoteAsset,
          amount: sell,
          slippage,
        });
        steps.push({ step: "swap", result: swapRes });
        return { success: true, side, market, leverage: lev, steps };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );
}