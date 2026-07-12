import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { getAgent } from "../main/agent";
import {
  buildPlaygroundPackage,
  type PlaygroundFileInput,
} from "./playground-cli";
import { refreshLocalNetworkStatus } from "./sui-client-manager";

const LOCALNET_RPC = "http://127.0.0.1:9000";

export type PublishNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

function createClient(network: PublishNetwork) {
  return new SuiJsonRpcClient({
    url: network === "localnet" ? LOCALNET_RPC : getJsonRpcFullnodeUrl(network),
    network: network === "localnet" ? "testnet" : network,
  });
}

async function resolveNetwork(
  requested?: PublishNetwork,
): Promise<PublishNetwork> {
  if (requested) return requested;
  const local = await refreshLocalNetworkStatus();
  if (local.rpcReady) return "localnet";
  return "testnet";
}

async function signAndExecute(
  client: SuiJsonRpcClient,
  address: string,
  transaction: Transaction,
  network: PublishNetwork,
) {
  const agent = (await getAgent()) as {
    address: () => string;
    keypair: {
      signTransaction: (bytes: Buffer) => Promise<{ signature: string }>;
    };
  };

  transaction.setSender(address);

  if (network === "localnet") {
    const [{ epoch }, coins] = await Promise.all([
      client.getLatestSuiSystemState(),
      client.getCoins({ owner: address, coinType: "0x2::sui::SUI" }),
    ]);
    transaction.setExpiration({ Epoch: String(BigInt(epoch) + 5n) });
    const gasCoin = coins.data[0];
    if (!gasCoin) {
      throw new Error("No SUI gas on localnet. Request faucet first.");
    }
    transaction.setGasPayment([
      {
        objectId: gasCoin.coinObjectId,
        version: gasCoin.version,
        digest: gasCoin.digest,
      },
    ]);
  }

  const txBytes = await transaction.build({ client });
  const txBytesB64 = Buffer.from(txBytes).toString("base64");
  const { signature } = await agent.keypair.signTransaction(
    Buffer.from(txBytes),
  );

  const result = await client.executeTransactionBlock({
    transactionBlock: txBytesB64,
    signature,
    options: { showEffects: true, showObjectChanges: true },
  });

  const status = result.effects?.status;
  if (status && "error" in status && status.status !== "success") {
    throw new Error(status.error ?? "Publish transaction failed.");
  }

  return result;
}

function extractPackageId(result: {
  objectChanges?: Array<{
    type?: string;
    packageId?: string;
    package?: string;
  }>;
}): string | null {
  for (const change of result.objectChanges ?? []) {
    if (change.type?.toLowerCase() !== "published") continue;
    const raw = change.packageId ?? change.package;
    if (!raw) continue;
    try {
      return normalizeSuiAddress(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

export async function buildAndPublishPlayground(params: {
  files: PlaygroundFileInput[];
  network?: PublishNetwork;
}) {
  const build = await buildPlaygroundPackage(params.files);
  const network = await resolveNetwork(params.network);

  const agent = (await getAgent()) as { address: () => string };
  const address = agent.address();
  const client = createClient(network);

  const tx = new Transaction();
  const [upgradeCap] = tx.publish({
    modules: build.modules,
    dependencies: build.dependencies,
  });
  tx.transferObjects([upgradeCap], address);

  const result = await signAndExecute(client, address, tx, network);
  const packageId = extractPackageId(result);

  if (!packageId) {
    throw new Error(
      "Publish succeeded but package ID was not found in object changes.",
    );
  }

  return {
    packageId,
    digest: result.digest,
    network,
    moduleCount: build.modules.length,
    stdout: build.stdout,
    stderr: build.stderr,
  };
}