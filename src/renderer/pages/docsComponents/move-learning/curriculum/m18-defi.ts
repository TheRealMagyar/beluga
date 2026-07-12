import type { MoveModule } from "./types";

export const MODULE_DEFI: MoveModule = {
  id: "defi",
  order: 18,
  title: "DeFi Patterns",
  description: "Pools, swaps, liquidity, and oracle basics.",
  accent: "#34d399",
  icon: "💱",
  lessons: [
    {
      id: "defi-pool",
      title: "Liquidity pool mental model",
      duration: "12 min",
      summary: "Two coins in a shared Pool object.",
      goal: "Understand reserve A + reserve B state.",
      blocks: [
        {
          type: "prose",
          text: "A pool holds Coin<A> and Coin<B> in one shared object. Swaps move coins in/out using constant-product or stable-swap math. LPs deposit both sides and receive LP tokens.",
        },
        {
          type: "code",
          language: "move",
          code: `public struct Pool<phantom A, phantom B> has key {
    id: UID,
    reserve_a: Balance<A>,
    reserve_b: Balance<B>,
    fee_bps: u64,
}`,
        },
      ],
    },
    {
      id: "defi-swap",
      title: "Swap mechanics",
      duration: "14 min",
      summary: "Input coin → math → output coin.",
      goal: "Follow one swap without implementing full AMM.",
      blocks: [
        {
          type: "steps",
          steps: [
            { title: "User brings Coin<A>", body: "Exact input amount." },
            { title: "Pool calculates output", body: "Formula + fee deduction." },
            { title: "Pool updates reserves", body: "Mutates shared Pool." },
            { title: "Returns Coin<B>", body: "Transferred to user." },
          ],
        },
      ],
    },
    {
      id: "defi-lp",
      title: "LP tokens",
      duration: "10 min",
      summary: "Receipt for liquidity provided.",
      goal: "See LP token as fungible claim on pool share.",
      blocks: [
        {
          type: "prose",
          text: "Mint LP Coin when depositing; burn LP to withdraw pro-rata reserves. LP type is usually another phantom-branded Coin.",
        },
      ],
    },
    {
      id: "defi-oracle",
      title: "Price oracles (overview)",
      duration: "10 min",
      summary: "Off-chain price fed on-chain — use trusted sources.",
      goal: "Never trust user-supplied price for lending.",
      blocks: [
        {
          type: "compare",
          bad: "fn liquidate(price: u64) — user picks price.",
          good: "Read from Pyth/Switchboard object updated by validators.",
        },
      ],
    },
    {
      id: "defi-flash",
      title: "Flash loans (concept)",
      duration: "8 min",
      summary: "Borrow and repay in one PTB.",
      goal: "Understand atomic borrow-use-repay pattern.",
      blocks: [
        {
          type: "prose",
          text: "Flash loans work because PTBs are atomic — if repay fails, entire tx reverts including the borrow. Advanced; study audited protocols before building.",
        },
      ],
    },
    {
      id: "defi-fees",
      title: "Fees & treasury",
      duration: "10 min",
      summary: "Protocol fee accumulation.",
      goal: "Route swap fees to treasury Balance or admin.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `let fee = input_amount * fee_bps / 10_000;
// remainder goes through swap math`,
        },
      ],
    },
  ],
};