export const SANDBOX_DECIMALS = 9;
export const SANDBOX_FEE_BPS = 30;

export const SANDBOX_TOKEN_A = {
  symbol: "TA",
  name: "Token A",
  decimals: SANDBOX_DECIMALS,
} as const;

export const SANDBOX_TOKEN_B = {
  symbol: "TB",
  name: "Token B",
  decimals: SANDBOX_DECIMALS,
} as const;

/** Human-readable amount for inputs (no thousands separators). */
export function formatUnitsRaw(
  raw: bigint | string | number,
  decimals = SANDBOX_DECIMALS,
  maxFractionDigits = 6,
): string {
  const value =
    typeof raw === "bigint"
      ? raw
      : BigInt(typeof raw === "number" ? Math.trunc(raw) : raw);
  if (value === 0n) return "0";

  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = abs % base;

  let formatted = whole.toString();
  if (fraction > 0n) {
    let fracStr = fraction.toString().padStart(decimals, "0");
    if (maxFractionDigits < decimals) {
      fracStr = fracStr.slice(0, maxFractionDigits);
    }
    fracStr = fracStr.replace(/0+$/, "");
    if (fracStr) formatted += `.${fracStr}`;
  }

  return negative ? `-${formatted}` : formatted;
}

export function formatUnits(
  raw: bigint | string | number,
  decimals = SANDBOX_DECIMALS,
  maxFractionDigits = 6,
): string {
  const value =
    typeof raw === "bigint"
      ? raw
      : BigInt(typeof raw === "number" ? Math.trunc(raw) : raw);
  if (value === 0n) return "0";

  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = abs % base;

  let formatted = whole.toLocaleString();
  if (fraction > 0n) {
    let fracStr = fraction.toString().padStart(decimals, "0");
    if (maxFractionDigits < decimals) {
      fracStr = fracStr.slice(0, maxFractionDigits);
    }
    fracStr = fracStr.replace(/0+$/, "");
    if (fracStr) formatted += `.${fracStr}`;
  }

  return negative ? `-${formatted}` : formatted;
}

export function parseUnits(
  human: string,
  decimals = SANDBOX_DECIMALS,
): bigint {
  const trimmed = human.trim().replace(/,/g, "");
  if (!trimmed) {
    throw new Error("Enter an amount.");
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Invalid amount format.");
  }

  const [wholePart, fractionPart = ""] = trimmed.split(".");
  if (fractionPart.length > decimals) {
    throw new Error(`Max ${decimals} decimal places for this token.`);
  }

  const whole = BigInt(wholePart || "0");
  const fraction = BigInt(
    (fractionPart + "0".repeat(decimals)).slice(0, decimals) || "0",
  );
  const base = 10n ** BigInt(decimals);
  const amount = whole * base + fraction;
  if (amount <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }
  return amount;
}

export function estimateSwapOutput(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps = SANDBOX_FEE_BPS,
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const amountInAfterFee = (amountIn * BigInt(10000 - feeBps)) / 10000n;
  return (amountInAfterFee * reserveOut) / (reserveIn + amountInAfterFee);
}

/** Minimum acceptable swap output after slippage tolerance (default 1%). */
export function minSwapOutput(
  estimatedOut: bigint,
  slippageBps = 100,
): bigint {
  if (estimatedOut <= 0n) return 0n;
  return (estimatedOut * BigInt(10000 - slippageBps)) / 10000n;
}

export function formatPriceBPerA(
  reserveA: bigint,
  reserveB: bigint,
  decimalsA = SANDBOX_DECIMALS,
  decimalsB = SANDBOX_DECIMALS,
): string | null {
  if (reserveA === 0n) return null;
  const aHuman = Number(reserveA) / 10 ** decimalsA;
  const bHuman = Number(reserveB) / 10 ** decimalsB;
  if (aHuman === 0) return null;
  return (bHuman / aHuman).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
}

export function shortObjectId(id: string, head = 6, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}