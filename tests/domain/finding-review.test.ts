// Reviewer adjudication payload policy (ADR-0003): status action vocabulary
// excludes draft, and buildFindingUpdate is the single construction point for
// a finding_updates PATCH entry.
import { describe, expect, it } from "vitest";
import {
  REVIEWER_STATUS_ACTIONS,
  buildFindingUpdate,
} from "@/domain/finding-review";

describe("REVIEWER_STATUS_ACTIONS", () => {
  it("offers exactly the four auditor actions, never draft", () => {
    expect([...REVIEWER_STATUS_ACTIONS]).toEqual([
      "accepted",
      "accepted_with_edits",
      "rejected",
      "escalated",
    ]);
  });
});

describe("buildFindingUpdate", () => {
  const cases: {
    name: string;
    input: Parameters<typeof buildFindingUpdate>[0];
    expected: Record<string, unknown>;
  }[] = [
    {
      name: "status action present → reviewer_status included",
      input: { finding_id: "F-1", reviewer_status: "accepted_with_edits", recommendation: "R", reviewer_note: "n" },
      expected: { finding_id: "F-1", reviewer_status: "accepted_with_edits", recommendation: "R", reviewer_note: "n" },
    },
    {
      name: "no status (save edits) → reviewer_status key absent",
      input: { finding_id: "F-1", recommendation: "R", reviewer_note: "" },
      expected: { finding_id: "F-1", recommendation: "R", reviewer_note: null },
    },
    {
      name: "blank recommendation and note are stored as null",
      input: { finding_id: "F-2", reviewer_status: "rejected", recommendation: "", reviewer_note: "" },
      expected: { finding_id: "F-2", reviewer_status: "rejected", recommendation: null, reviewer_note: null },
    },
    {
      name: "undefined text fields become null",
      input: { finding_id: "F-3" },
      expected: { finding_id: "F-3", recommendation: null, reviewer_note: null },
    },
    {
      name: "whitespace-only text is preserved verbatim, not nulled",
      input: { finding_id: "F-4", recommendation: "  ", reviewer_note: "\t" },
      expected: { finding_id: "F-4", recommendation: "  ", reviewer_note: "\t" },
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(buildFindingUpdate(c.input)).toEqual(c.expected);
    });
  }

  it("emits no reviewer_status key when omitted (server leaves draft untouched)", () => {
    const update = buildFindingUpdate({ finding_id: "F-5" });
    expect(Object.prototype.hasOwnProperty.call(update, "reviewer_status")).toBe(false);
  });
});
