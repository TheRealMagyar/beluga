export type GrpcServiceId =
  | "ledger"
  | "state"
  | "movePackage"
  | "transactionExecution"
  | "nameService";

export interface GrpcQueryPreset {
  id: string;
  service: GrpcServiceId;
  method: string;
  label: string;
  description: string;
  defaultRequest: Record<string, unknown>;
}

export const GRPC_SERVICES: Array<{
  id: GrpcServiceId;
  label: string;
  description: string;
}> = [
  {
    id: "ledger",
    label: "LedgerService",
    description: "Objects, transactions, checkpoints, epochs",
  },
  {
    id: "state",
    label: "StateService",
    description: "Balances, owned objects, dynamic fields",
  },
  {
    id: "movePackage",
    label: "MovePackageService",
    description: "Packages, modules, functions",
  },
  {
    id: "transactionExecution",
    label: "TransactionExecutionService",
    description: "Simulate and execute transactions",
  },
  {
    id: "nameService",
    label: "NameService",
    description: "SuiNS name resolution",
  },
];

export const GRPC_QUERY_PRESETS: GrpcQueryPreset[] = [
  {
    id: "ledger.getServiceInfo",
    service: "ledger",
    method: "getServiceInfo",
    label: "Service info",
    description: "Chain id, epoch, checkpoint height, node version",
    defaultRequest: {},
  },
  {
    id: "ledger.getObject",
    service: "ledger",
    method: "getObject",
    label: "Get object",
    description: "Fetch a single on-chain object by ID",
    defaultRequest: {
      objectId: "0x0000000000000000000000000000000000000000000000000000000000000002",
    },
  },
  {
    id: "ledger.batchGetObjects",
    service: "ledger",
    method: "batchGetObjects",
    label: "Batch get objects",
    description: "Fetch multiple objects in one call",
    defaultRequest: {
      requests: [
        {
          objectId:
            "0x0000000000000000000000000000000000000000000000000000000000000002",
        },
      ],
    },
  },
  {
    id: "ledger.getTransaction",
    service: "ledger",
    method: "getTransaction",
    label: "Get transaction",
    description: "Fetch an executed transaction by digest",
    defaultRequest: {
      digest: "PASTE_TRANSACTION_DIGEST",
    },
  },
  {
    id: "ledger.getCheckpoint",
    service: "ledger",
    method: "getCheckpoint",
    label: "Get checkpoint",
    description: "Fetch checkpoint by sequence number",
    defaultRequest: {
      sequenceNumber: "0",
    },
  },
  {
    id: "ledger.getEpoch",
    service: "ledger",
    method: "getEpoch",
    label: "Get epoch",
    description: "Fetch epoch metadata",
    defaultRequest: {
      epoch: "0",
    },
  },
  {
    id: "state.getBalance",
    service: "state",
    method: "getBalance",
    label: "Get balance",
    description: "Coin balance for owner + coin type",
    defaultRequest: {
      owner: "0xPASTE_ADDRESS",
      coinType: "0x2::sui::SUI",
    },
  },
  {
    id: "state.listBalances",
    service: "state",
    method: "listBalances",
    label: "List balances",
    description: "All coin balances for an address",
    defaultRequest: {
      owner: "0xPASTE_ADDRESS",
      pageSize: 50,
    },
  },
  {
    id: "state.listOwnedObjects",
    service: "state",
    method: "listOwnedObjects",
    label: "List owned objects",
    description: "Objects owned by an address",
    defaultRequest: {
      owner: "0xPASTE_ADDRESS",
      pageSize: 25,
    },
  },
  {
    id: "state.listDynamicFields",
    service: "state",
    method: "listDynamicFields",
    label: "List dynamic fields",
    description: "Dynamic fields under a parent object",
    defaultRequest: {
      parent: "0xPASTE_PARENT_OBJECT_ID",
      pageSize: 50,
    },
  },
  {
    id: "state.getCoinInfo",
    service: "state",
    method: "getCoinInfo",
    label: "Get coin info",
    description: "Metadata and supply for a coin type",
    defaultRequest: {
      coinType: "0x2::sui::SUI",
    },
  },
  {
    id: "movePackage.getPackage",
    service: "movePackage",
    method: "getPackage",
    label: "Get package",
    description: "Move package at a specific version",
    defaultRequest: {
      packageId: "0xPASTE_PACKAGE_ID",
    },
  },
  {
    id: "movePackage.getFunction",
    service: "movePackage",
    method: "getFunction",
    label: "Get function",
    description: "Move function definition",
    defaultRequest: {
      packageId: "0xPASTE_PACKAGE_ID",
      moduleName: "module",
      functionName: "function",
    },
  },
  {
    id: "movePackage.listPackageVersions",
    service: "movePackage",
    method: "listPackageVersions",
    label: "List package versions",
    description: "Historical versions of a package",
    defaultRequest: {
      packageId: "0xPASTE_PACKAGE_ID",
      pageSize: 20,
    },
  },
  {
    id: "nameService.lookupName",
    service: "nameService",
    method: "lookupName",
    label: "Lookup name",
    description: "Resolve a SuiNS name to an address",
    defaultRequest: {
      name: "example.sui",
    },
  },
  {
    id: "nameService.reverseLookupName",
    service: "nameService",
    method: "reverseLookupName",
    label: "Reverse lookup",
    description: "Find SuiNS names for an address",
    defaultRequest: {
      address: "0xPASTE_ADDRESS",
    },
  },
];

export function getMethodsForService(service: GrpcServiceId): string[] {
  const methods = new Set<string>();
  for (const preset of GRPC_QUERY_PRESETS) {
    if (preset.service === service) methods.add(preset.method);
  }
  return [...methods].sort();
}