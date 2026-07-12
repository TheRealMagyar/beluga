import type { MoveEntryFunction, MoveEntryParam } from "./project-loader";

export type EntryArgsState = Record<string, Record<string, string>>;

const DEFAULT_VALUES: Record<string, string> = {
  ticket_price: "1000000000",
  amount: "1000000000",
};

export function entryKey(entry: MoveEntryFunction): string {
  return `${entry.module}::${entry.name}`;
}

export function callableParams(entry: MoveEntryFunction): MoveEntryParam[] {
  return (entry.params ?? []).filter((param) => param.kind !== "tx_context");
}

export function paramValueKey(param: MoveEntryParam): string {
  if (param.kind === "coin") return `${param.name}_amount`;
  return param.name;
}

export function defaultValueForParam(param: MoveEntryParam): string {
  switch (param.kind) {
    case "u64":
      return DEFAULT_VALUES[param.name] ?? "0";
    case "u32":
    case "u8":
      return "0";
    case "bool":
      return "false";
    case "address":
      return "0x0";
    case "coin":
      return DEFAULT_VALUES.ticket_price ?? "1000000000";
    case "object":
      return "";
    default:
      return "";
  }
}

export function buildDefaultEntryArgs(
  entries: MoveEntryFunction[],
): EntryArgsState {
  const state: EntryArgsState = {};
  for (const entry of entries) {
    const key = entryKey(entry);
    state[key] = {};
    for (const param of callableParams(entry)) {
      state[key][paramValueKey(param)] = defaultValueForParam(param);
    }
  }
  return state;
}

export function mergeEntryArgs(
  prev: EntryArgsState,
  entries: MoveEntryFunction[],
): EntryArgsState {
  const defaults = buildDefaultEntryArgs(entries);
  const merged: EntryArgsState = {};

  for (const entry of entries) {
    const key = entryKey(entry);
    merged[key] = { ...defaults[key], ...prev[key] };
  }

  return merged;
}

export function paramInputLabel(param: MoveEntryParam): string {
  switch (param.kind) {
    case "coin":
      return `${param.name} — ${param.typeText} (MIST)`;
    case "object":
      return `${param.name} — ${param.typeText}`;
    case "u64":
    case "u32":
    case "u8":
      return `${param.name} — ${param.kind}`;
    case "bool":
      return `${param.name} — bool`;
    case "address":
      return `${param.name} — address`;
    default:
      return `${param.name} — ${param.typeText}`;
  }
}

export function paramInputHint(param: MoveEntryParam): string | null {
  switch (param.kind) {
    case "coin":
      return "Split from your gas coin. Must match on-chain amount if required.";
    case "object":
      return "Object ID (0x…). Run create_* first or pick from created objects.";
    case "u64":
      return param.name === "ticket_price"
        ? "1 SUI = 1_000_000_000 MIST"
        : null;
    default:
      return null;
  }
}

export function validateEntryArgs(
  entry: MoveEntryFunction,
  values: Record<string, string> | undefined,
  packageId?: string,
): string | null {
  for (const param of callableParams(entry)) {
    const key = paramValueKey(param);
    const raw = values?.[key] ?? "";
    const val = raw.trim();

    if (param.kind === "object") {
      if (!val) {
        return `${entry.module}::${entry.name}: "${param.name}" object ID is required`;
      }
      if (packageId && val === packageId) {
        return `${entry.module}::${entry.name}: "${param.name}" must be an object ID, not the package ID`;
      }
    }

    if (param.kind === "address" && !val) {
      return `${entry.module}::${entry.name}: "${param.name}" address is required`;
    }

    if (
      (param.kind === "u64" || param.kind === "coin") &&
      val &&
      !/^\d+$/.test(val)
    ) {
      return `${entry.module}::${entry.name}: "${param.name}" must be a non-negative integer`;
    }
  }

  return null;
}

export function syncCoinAmounts(
  state: EntryArgsState,
  entries: MoveEntryFunction[],
  amount: string,
): EntryArgsState {
  const next: EntryArgsState = { ...state };

  for (const entry of entries) {
    const key = entryKey(entry);
    const current = { ...next[key] };

    for (const param of callableParams(entry)) {
      if (param.kind !== "coin") continue;
      current[paramValueKey(param)] = amount;
    }

    next[key] = current;
  }

  return next;
}

export function fillObjectParams(
  state: EntryArgsState,
  entries: MoveEntryFunction[],
  objectId: string,
  onlyEmpty = true,
): EntryArgsState {
  const next: EntryArgsState = { ...state };

  for (const entry of entries) {
    const key = entryKey(entry);
    const current = { ...next[key] };

    for (const param of callableParams(entry)) {
      if (param.kind !== "object") continue;
      const field = paramValueKey(param);
      if (!onlyEmpty || !current[field]?.trim()) {
        current[field] = objectId;
      }
    }

    next[key] = current;
  }

  return next;
}