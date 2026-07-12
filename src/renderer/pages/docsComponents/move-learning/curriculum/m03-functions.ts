import type { MoveModule } from "./types";

export const MODULE_FUNCTIONS: MoveModule = {
  id: "functions",
  order: 3,
  title: "Functions",
  description: "Define behavior, pass data in, get results out.",
  accent: "#6c63ff",
  icon: "ƒ",
  lessons: [
    {
      id: "fn-define",
      title: "Defining a function",
      duration: "10 min",
      summary: "fun, parameters, return type, and the function body.",
      goal: "Write a function that takes two numbers and returns their sum.",
      blocks: [
        {
          type: "prose",
          text: "Functions are named pieces of logic you can reuse. Syntax: fun name(param: Type, ...): ReturnType { body }. Parameters are inputs; the return type is the output. Everything inside { } runs when the function is called.",
        },
        {
          type: "prose",
          text: "Move functions are not methods on objects like in Java. You call them as add(2, 3) or module::add(2, 3) from outside. The data you pass in can be moved, borrowed with &, or mutably borrowed with &mut — that choice controls who keeps ownership after the call.",
        },
        {
          type: "code",
          language: "move",
          code: `module my_package::math;

public fun add(a: u64, b: u64): u64 {
    a + b
}

public fun greet(): bool {
    true
}`,
        },
        {
          type: "subtitle",
          text: "Implicit return",
        },
        {
          type: "prose",
          text: "If the last line is an expression without ;, it becomes the return value. add returns a + b because there is no semicolon after it. If you add a semicolon (a + b;), the function returns () — unit, meaning \"no value\" — which is wrong for a function declared to return u64.",
        },
      ],
      exercise: {
        prompt: "Add public fun double(n: u64): u64 that returns n * 2.",
        hint: "Multiply with * — same as other C-like languages.",
        solution: "public fun double(n: u64): u64 { n * 2 }",
      },
    },
    {
      id: "fn-call",
      title: "Calling functions",
      duration: "6 min",
      summary: "How one function uses another in the same module.",
      goal: "Chain small functions into readable logic.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public fun triple(n: u64): u64 {
    let two = double(n);
    add(two, n)
}`,
        },
        {
          type: "prose",
          text: "Call with name(arg1, arg2). Arguments are evaluated left to right. Functions in the same module call each other by name alone. From another file in your package you still need public or public(package). From a different published package you need public.",
        },
        {
          type: "prose",
          text: "Splitting logic into small functions (double, add, triple) is not just style — each piece is easier to #[test] and audit. Entry functions often call several private helpers in sequence.",
        },
      ],
    },
    {
      id: "fn-visibility",
      title: "public & entry",
      duration: "12 min",
      summary: "Who can call your function — internal, package, or users.",
      goal: "Choose the right visibility for each function.",
      blocks: [
        {
          type: "list",
          items: [
            "(none) — private to this module only.",
            "public — callable from any module.",
            "public(package) — callable only inside this package.",
            "public entry fun — users can call it in a transaction (wallet / SDK).",
          ],
        },
        {
          type: "code",
          language: "move",
          code: `fun internal_only() { }

public(package) fun package_helper() { }

public fun api_for_other_modules() { }

public entry fun user_calls_this() { }`,
        },
        {
          type: "subtitle",
          text: "In plain terms",
        },
        {
          type: "prose",
          text: "private (no keyword) — only this .move file. public(package) — any module in your published package. public — any other package on Sui can call it. public entry — wallets and SDKs can put it in a transaction PTB. Users never call private functions directly; they only sign transactions that call entry functions.",
        },
        {
          type: "prose",
          text: "Parameters: Counter by value takes ownership (caller loses it). &Counter lets you read without taking. &mut Counter lets you modify in place (caller keeps ownership). Entry functions almost always take &mut for objects the user owns, or objects by value when consuming them (e.g. paying with a Coin).",
        },
        {
          type: "tip",
          tone: "info",
          text: "Only mark entry what end-users need. Keep helpers private — smaller attack surface and clearer API.",
        },
      ],
    },
    {
      id: "fn-underscore",
      title: "Discarding values with _",
      duration: "5 min",
      summary: "When you must consume a value but don't need it.",
      goal: "Use _ to silence unused-value errors.",
      blocks: [
        {
          type: "prose",
          text: "Move does not let you silently ignore values that lack the drop ability. If a function returns something you do not use, and it cannot be dropped, the compiler errors. Prefix with _ or use let _ = ... to explicitly discard when allowed.",
        },
        {
          type: "code",
          language: "move",
          code: `let _unused = expensive_value();
// Or destructure:
let (a, _b) = (1u64, 2u64);`,
        },
      ],
    },
    {
      id: "fn-tuple-return",
      title: "Returning multiple values",
      duration: "10 min",
      summary: "Tuples let one function return several values at once.",
      goal: "Return and destructure tuples.",
      blocks: [
        {
          type: "prose",
          text: "Sometimes one function needs to give back two related numbers — quotient and remainder, or an amount and a flag. Tuples group them: (u64, u64) is one value with two parts. Destructure with let (q, r) = div_mod(10, 3);",
        },
        {
          type: "code",
          language: "move",
          code: `public fun div_mod(a: u64, b: u64): (u64, u64) {
    (a / b, a % b)
}

public fun use_it() {
    let (q, r) = div_mod(10, 3);
}`,
        },
      ],
    },
    {
      id: "fn-no-return",
      title: "Functions that return nothing",
      duration: "5 min",
      summary: "Omit return type when there is no meaningful value.",
      goal: "Write side-effect-only functions correctly.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public fun log_value(v: u64) {
    let _ = v;  // consume v — no return
}`,
        },
        {
          type: "prose",
          text: "Functions with no return type return unit (), written as empty in signatures. Side-effect-only code — emitting events, mutating through &mut — often returns (). Callers cannot use a result because there is none.",
        },
      ],
    },
    {
      id: "fn-module-friends",
      title: "Same module helpers",
      duration: "8 min",
      summary: "Organize code with private helpers next to public API.",
      goal: "Split logic into small private functions.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `fun validate(n: u64) {
    assert!(n > 0, 0);
}

public entry fun create(n: u64) {
    validate(n);
    // ...
}`,
        },
        {
          type: "prose",
          text: "validate runs first and aborts if n is invalid — the entry never reaches dangerous logic. This pattern keeps user-facing entry small: check sender, check inputs, delegate to private code.",
        },
        {
          type: "tip",
          tone: "info",
          text: "Keep entry functions thin — validate, then call private helpers. Easier to test and audit.",
        },
      ],
    },
  ],
};