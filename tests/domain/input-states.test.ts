// §27 client input-state policy (pure domain): default-state table over every
// requirement_level × stored combination, stage filtering, the missing-state
// → select-value inverse, and attachment-list merge edge cases.
import { describe, expect, it } from "vitest";
import type { InputRequirementLevel, InputValueState } from "@/domain/types";
import { MAX_ATTACHMENTS_PER_PROJECT } from "@/domain/types";
import {
  deriveInputState,
  filterInputsForStage,
  isMissingState,
  mergeAttachment,
  missingStateFor,
  selectValueFor,
} from "@/domain/input-states";

const LEVELS: InputRequirementLevel[] = ["required", "recommended", "optional", "unknown"];

const MISSING_ALL: InputValueState[] = [
  "provided",
  "required_missing",
  "recommended_missing",
  "optional_missing",
  "unknown",
  "not_applicable",
  "not_available",
  "conflicting",
];

const EXPECTED_MISSING: Record<InputRequirementLevel, InputValueState> = {
  required: "required_missing",
  recommended: "recommended_missing",
  optional: "optional_missing",
  unknown: "unknown",
};

describe("missingStateFor / deriveInputState default table", () => {
  it.each(LEVELS)("level '%s' with no stored record derives the level-appropriate missing state", (level) => {
    expect(missingStateFor(level)).toBe(EXPECTED_MISSING[level]);
    expect(deriveInputState(level)).toBe(EXPECTED_MISSING[level]);
    expect(deriveInputState(level, undefined)).toBe(EXPECTED_MISSING[level]);
  });

  it("an unrecognized level falls back to 'unknown'", () => {
    expect(missingStateFor("mandatory")).toBe("unknown");
    expect(deriveInputState("")).toBe("unknown");
  });
});

describe("deriveInputState stored-record table (client canonical semantics)", () => {
  const cases: {
    name: string;
    stored: Parameters<typeof deriveInputState>[1];
    expected: InputValueState | null;
  }[] = [
    { name: "provided with text shows provided verbatim", stored: { state: "provided", value: "stats" }, expected: "provided" },
    { name: "provided with blank value still shows provided (divergence from AG-MANIFEST downgrade)", stored: { state: "provided", value: "" }, expected: "provided" },
    { name: "provided with whitespace-only value still shows provided", stored: { state: "provided", value: "   " }, expected: "provided" },
    { name: "provided with absent value field still shows provided", stored: { state: "provided" }, expected: "provided" },
    { name: "explicit not_applicable is shown verbatim", stored: { state: "not_applicable" }, expected: "not_applicable" },
    { name: "explicit not_available is shown verbatim", stored: { state: "not_available" }, expected: "not_available" },
    { name: "explicit conflicting is shown verbatim", stored: { state: "conflicting" }, expected: "conflicting" },
    { name: "explicit unknown is shown verbatim", stored: { state: "unknown" }, expected: "unknown" },
    { name: "stored required_missing survives as-is", stored: { state: "required_missing" }, expected: "required_missing" },
  ];

  for (const c of cases) {
    it(c.name, () => {
      for (const level of LEVELS) {
        expect(deriveInputState(level, c.stored)).toBe(c.expected);
      }
    });
  }
});

describe("filterInputsForStage", () => {
  const catalog = [
    { input_id: "a", stage_ids: ["uk:S1", "uk:S2"] },
    { input_id: "b", stage_ids: ["uk:S2"] },
    { input_id: "c", stage_ids: ["uk:S1"] },
    { input_id: "d", stage_ids: [] },
  ];

  it("keeps only inputs whose stage_ids include the selected native stage", () => {
    expect(filterInputsForStage(catalog, "uk:S2").map((i) => i.input_id)).toEqual(["a", "b"]);
    expect(filterInputsForStage(catalog, "uk:S1").map((i) => i.input_id)).toEqual(["a", "c"]);
  });

  it("returns nothing for a stage no input covers and never mutates the catalog", () => {
    expect(filterInputsForStage(catalog, "us-fhwa:planning")).toEqual([]);
    expect(catalog).toHaveLength(4);
  });
});

describe("selectValueFor (inverse of the derived-missing mapping)", () => {
  const cases: [InputValueState, string][] = [
    ["required_missing", ""],
    ["recommended_missing", ""],
    ["optional_missing", ""],
    ["provided", "provided"],
    ["unknown", "unknown"],
    ["not_applicable", "not_applicable"],
    ["not_available", "not_available"],
    ["conflicting", "conflicting"],
  ];

  it.each(cases)("%s → %j", (state, expected) => {
    expect(selectValueFor(state)).toBe(expected);
  });

  it("marks exactly the three derived missing states as missing", () => {
    expect(MISSING_ALL.filter(isMissingState)).toEqual([
      "required_missing",
      "recommended_missing",
      "optional_missing",
    ]);
  });
});

describe("mergeAttachment", () => {
  it("appends to an absent list", () => {
    expect(mergeAttachment(undefined, "ATT-1")).toEqual(["ATT-1"]);
  });

  it("appends preserving order", () => {
    expect(mergeAttachment(["ATT-1", "ATT-2"], "ATT-3")).toEqual(["ATT-1", "ATT-2", "ATT-3"]);
  });

  it("is idempotent for a duplicate id", () => {
    expect(mergeAttachment(["ATT-1", "ATT-2"], "ATT-1")).toEqual(["ATT-1", "ATT-2"]);
  });

  it("refuses to grow past MAX_ATTACHMENTS_PER_PROJECT", () => {
    const full = Array.from({ length: MAX_ATTACHMENTS_PER_PROJECT }, (_, i) => `ATT-${i}`);
    expect(mergeAttachment(full, "ATT-new")).toEqual(full);
  });

  it("still appends at one below the cap", () => {
    const almost = Array.from({ length: MAX_ATTACHMENTS_PER_PROJECT - 1 }, (_, i) => `ATT-${i}`);
    expect(mergeAttachment(almost, "ATT-new")).toEqual([...almost, "ATT-new"]);
  });

  it("never mutates the existing list", () => {
    const existing = ["ATT-1"];
    mergeAttachment(existing, "ATT-2");
    expect(existing).toEqual(["ATT-1"]);
  });
});
