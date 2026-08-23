// Negative-path coverage for the injectable pack loader: unreadable JSON,
// ajv schema violations, and evidence-integrity failures must surface as
// typed, jurisdiction-naming errors.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadPack, type PackIo } from "@/domain/packs";

function ioWith(readUtf8: PackIo["readUtf8"]): PackIo {
  return { cwd: () => process.cwd(), readUtf8 };
}

function ukPackText(): string {
  return readFileSync(path.join(process.cwd(), "policies/uk/pack.json"), "utf8");
}

describe("loadPack failure paths", () => {
  it("invalid JSON raises a readable error naming the jurisdiction", () => {
    expect(() => loadPack("UK", ioWith(() => "{ not json"))).toThrowError(
      /^policy pack unreadable for UK:/,
    );
  });

  it("ajv validation failure lists the schema violation", () => {
    let message = "";
    try {
      loadPack("UK", ioWith(() => "{}"));
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message).toMatch(/^policy pack invalid for UK: /);
    expect(message).toContain("required property");
  });

  it("unknown evidence id fails the integrity gate", () => {
    const mutated = JSON.parse(ukPackText()) as {
      framework: { evidence_ids: string[] };
    };
    mutated.framework.evidence_ids = ["EV-NOPE"];
    expect(() => loadPack("UK", ioWith(() => JSON.stringify(mutated)))).toThrowError(
      "policy pack UK cites unknown evidence id EV-NOPE",
    );
  });
});
