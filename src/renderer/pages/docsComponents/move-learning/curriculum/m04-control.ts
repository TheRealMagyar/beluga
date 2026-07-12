import type { MoveModule } from "./types";

export const MODULE_CONTROL: MoveModule = {
  id: "control",
  order: 4,
  title: "Decisions & Loops",
  description: "if/else, loops, and failing safely with assert.",
  accent: "#00d4aa",
  icon: "🔀",
  lessons: [
    {
      id: "ctrl-if",
      title: "if and else",
      duration: "8 min",
      summary: "Branch logic based on conditions.",
      goal: "Write conditional code that returns different values.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public fun max(a: u64, b: u64): u64 {
    if (a >= b) {
        a
    } else {
        b
    }
}`,
        },
        {
          type: "prose",
          text: "if (condition) { ... } else { ... } picks one branch. The condition must be bool — not a number, not an address. In Move, if (5) is illegal; you need if (x == 5).",
        },
        {
          type: "prose",
          text: "When if is used as an expression (returns a value), both branches must return the same type. max returns u64 from both branches. When used as a statement (only side effects), else is optional.",
        },
      ],
    },
    {
      id: "ctrl-ops",
      title: "Operators",
      duration: "6 min",
      summary: "Comparisons and arithmetic you'll use every day.",
      goal: "Read and write conditions confidently.",
      blocks: [
        {
          type: "list",
          items: [
            "Arithmetic: +, -, *, /, % (integers only).",
            "Compare: ==, !=, <, >, <=, >=",
            "Logic: &&, ||, !",
            "Bitwise: &, |, ^, <<, >>",
          ],
        },
        {
          type: "compare",
          bad: "if (x = 5)  // assignment, not compare",
          good: "if (x == 5)  // equality test",
        },
      ],
    },
    {
      id: "ctrl-loops",
      title: "while and loop",
      duration: "10 min",
      summary: "Repeat work — carefully on-chain.",
      goal: "Understand loops and why bounded loops matter for gas.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public fun sum_to_n(n: u64): u64 {
    let mut i = 0;
    let mut total = 0;
    while (i < n) {
        total = total + i;
        i = i + 1;
    };
    total
}`,
        },
        {
          type: "tip",
          tone: "warning",
          text: "Unbounded loops can hit gas limits. Prefer fixed iteration counts or vector::length-bounded loops in smart contracts.",
        },
      ],
    },
    {
      id: "ctrl-assert",
      title: "assert! and errors",
      duration: "10 min",
      summary: "Stop execution when a rule is violated.",
      goal: "Guard functions with assert! and meaningful error codes.",
      blocks: [
        {
          type: "prose",
          text: "assert!(condition, error_code) is how you say \"this must be true, or stop everything.\" If condition is false, the entire transaction aborts immediately — no partial updates, no try/catch. On Sui, that means all object changes in that tx are rolled back as if it never ran.",
        },
        {
          type: "prose",
          text: "The second argument is a u64 abort code — not a message string. Wallets and explorers show the number; your frontend maps 0 → \"Insufficient balance\", 1 → \"Not admin\", etc. Name constants E_* so you remember what each code means.",
        },
        {
          type: "code",
          language: "move",
          code: `const E_NOT_ADMIN: u64 = 0;
const E_INSUFFICIENT: u64 = 1;

public fun withdraw(amount: u64, balance: u64) {
    assert!(amount <= balance, E_INSUFFICIENT);
}`,
        },
        {
          type: "steps",
          steps: [
            {
              title: "Define error constants",
              body: "const E_SOMETHING: u64 = 0; at module level.",
            },
            {
              title: "Check preconditions early",
              body: "assert at the top of the function before mutating state.",
            },
            {
              title: "Use unique codes",
              body: "Different failures get different numbers for debugging.",
            },
          ],
        },
      ],
    },
    {
      id: "ctrl-break",
      title: "break & continue",
      duration: "6 min",
      summary: "Control loop flow inside while and loop.",
      goal: "Exit early or skip iterations.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `let mut i = 0;
while (i < 10) {
    i = i + 1;
    if (i == 5) {
        continue  // skip rest, next iteration
    };
    if (i == 8) {
        break     // exit loop
    };
};`,
        },
      ],
    },
    {
      id: "ctrl-nested-if",
      title: "Nested conditions",
      duration: "8 min",
      summary: "Combine checks without deep nesting spaghetti.",
      goal: "Write readable guard clauses.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public fun withdraw(balance: u64, amount: u64, is_paused: bool) {
    assert!(!is_paused, 1);
    assert!(amount > 0, 2);
    assert!(amount <= balance, 3);
    // safe to proceed
}`,
        },
        {
          type: "tip",
          tone: "success",
          text: "Guard clauses at the top (early assert) beat nested if/else pyramids.",
        },
      ],
    },
    {
      id: "ctrl-logical",
      title: "Combining conditions",
      duration: "6 min",
      summary: "&&, ||, and short-circuit thinking.",
      goal: "Express compound rules in one assert.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `assert!(amount > 0 && amount <= balance, 0);
assert!(is_admin || is_delegate, 1);`,
        },
      ],
    },
  ],
};