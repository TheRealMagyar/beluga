import { Transaction } from "@mysten/sui/transactions";
import type { MoveEntryFunction } from "./project-loader";
import {
  callableParams,
  defaultValueForParam,
  paramValueKey,
} from "./entry-test-ui";

export function buildEntryArgs(
  entry: MoveEntryFunction,
  tx: Transaction,
  values: Record<string, string> | undefined,
) {
  const args: Parameters<Transaction["moveCall"]>[0]["arguments"] = [];

  for (const param of entry.params ?? []) {
    if (param.kind === "tx_context") continue;

    const key = paramValueKey(param);
    const raw = values?.[key];

    switch (param.kind) {
      case "object": {
        const id = raw?.trim();
        if (!id) {
          throw new Error(`Object ID required for parameter "${param.name}"`);
        }
        args.push(tx.object(id));
        break;
      }
      case "u64": {
        const value = raw?.trim() || defaultValueForParam(param);
        args.push(tx.pure.u64(value));
        break;
      }
      case "u32": {
        const value = Number(raw?.trim() || defaultValueForParam(param));
        args.push(tx.pure.u32(value));
        break;
      }
      case "u8": {
        const value = Number(raw?.trim() || defaultValueForParam(param));
        args.push(tx.pure.u8(value));
        break;
      }
      case "bool": {
        args.push(tx.pure.bool(raw === "true"));
        break;
      }
      case "address": {
        args.push(tx.pure.address(raw?.trim() || defaultValueForParam(param)));
        break;
      }
      case "string": {
        const text = raw?.trim() ?? defaultValueForParam(param);
        args.push(
          tx.pure.vector(
            "u8",
            Array.from(new TextEncoder().encode(text)),
          ),
        );
        break;
      }
      case "coin": {
        const amount = raw?.trim() || defaultValueForParam(param);
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
        args.push(coin);
        break;
      }
      default:
        throw new Error(
          `Unsupported parameter "${param.name}: ${param.typeText}" in ${entry.module}::${entry.name}`,
        );
    }
  }

  return args;
}

export function entryHasUserArgs(entry: MoveEntryFunction): boolean {
  return callableParams(entry).length > 0;
}