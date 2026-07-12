import type { MoveModule } from "./types";

export const MODULE_TESTING: MoveModule = {
  id: "testing",
  order: 14,
  title: "Testing Move",
  description: "Unit tests, test_scenario, and proving correctness before publish.",
  accent: "#c4b5fd",
  icon: "🧪",
  lessons: [
    {
      id: "test-unit",
      title: "Unit tests with #[test]",
      duration: "12 min",
      summary: "Pure functions tested in isolation.",
      goal: "Write and run #[test] functions with assert!.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `#[test]
fun add_works() {
    assert!(add(2, 3) == 5, 0);
}`,
        },
      ],
    },
    {
      id: "test-scenario",
      title: "test_scenario",
      duration: "16 min",
      summary: "Simulate publish and entry calls.",
      goal: "Use Scenario for object lifecycle tests.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `#[test_only]
use sui::test_scenario::{Self as ts};

#[test]
fun flow() {
    let mut s = ts::begin(@0xA);
    ts::end(s);
}`,
        },
      ],
    },
    {
      id: "test-addresses",
      title: "Test addresses",
      duration: "8 min",
      summary: "Switch sender with next_tx.",
      goal: "Test multi-user flows.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `ts::next_tx(&mut scenario, @0xALICE);
ts::next_tx(&mut scenario, @0xBOB);`,
        },
      ],
    },
    {
      id: "test-expected-failure",
      title: "Testing aborts",
      duration: "10 min",
      summary: "#[expected_failure] on security paths.",
      goal: "Prove unauthorized calls abort.",
      blocks: [
        {
          type: "list",
          items: [
            "Test wrong sender aborts.",
            "Test missing cap aborts.",
            "Match abort_code to E_* const.",
          ],
        },
      ],
    },
    {
      id: "test-coverage",
      title: "Pre-publish checklist",
      duration: "10 min",
      summary: "What every package should test.",
      goal: "Cover init, entries, and failure modes.",
      blocks: [
        {
          type: "list",
          items: [
            "init treasury/cap ownership.",
            "Every entry happy + sad path.",
            "sui move test in CI.",
          ],
        },
      ],
    },
  ],
};