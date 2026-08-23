// V2 gates: vault compile determinism — export/import are idempotent
// (byte-identical across runs) and malformed chartered front-matter fails
// with an actionable error.
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import os from "node:os";

function hashTree(dir: string): string {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d).sort()) {
      const p = path.join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(`${path.relative(dir, p)}:${readFileSync(p).toString("base64")}`);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out.join("|");
}

describe("vault compile determinism (V2)", () => {
  it("export is byte-idempotent across runs", () => {
    execSync("node scripts/vault-export.mjs", { cwd: process.cwd() });
    const first = hashTree(path.join(process.cwd(), "vault", "views"));
    execSync("node scripts/vault-export.mjs", { cwd: process.cwd() });
    const second = hashTree(path.join(process.cwd(), "vault", "views"));
    expect(second).toBe(first);
    expect(first.length).toBeGreaterThan(0); // views actually rendered
  });

  it("import is byte-idempotent and compiles all chartered prose zones", () => {
    execSync("node scripts/vault-import.mjs", { cwd: process.cwd() });
    const first = readFileSync(path.join(process.cwd(), "state", "vault-notes.json"), "utf8");
    execSync("node scripts/vault-import.mjs", { cwd: process.cwd() });
    const second = readFileSync(path.join(process.cwd(), "state", "vault-notes.json"), "utf8");
    expect(second).toBe(first);
    expect(JSON.parse(first).schema_version).toBe("1.0.0");
  });

  it("malformed chartered front-matter fails with an actionable error", () => {
    const tmp = mkdtemp();
    mkdirSync(path.join(tmp, "vault/decisions"), { recursive: true });
    // Missing title/date; unknown type.
    writeFileSync(
      path.join(tmp, "vault/decisions/bad.md"),
      "---\ntype: nonsense\n---\n\nbody\n",
    );
    let failed = false;
    try {
      execSync(`node ${path.join(process.cwd(), "scripts", "vault-import.mjs")}`, { cwd: tmp, stdio: "pipe" });
    } catch (e) {
      failed = true;
      const stderr = String((e as { stderr?: Buffer }).stderr ?? "");
      expect(stderr).toContain("bad.md");
      expect(stderr).toContain("front-matter");
    }
    expect(failed).toBe(true);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("unknown zones are ignored safely by import", () => {
    const tmp = mkdtemp();
    mkdirSync(path.join(tmp, "vault/annotations"), { recursive: true }); // not chartered for import
    writeFileSync(
      path.join(tmp, "vault/annotations/x.md"),
      "---\ntitle: t\ntype: annotation\ndate: bad-date\nowner: agent\n---\n",
    );
    const out = execSync(`node ${path.join(process.cwd(), "scripts", "vault-import.mjs")}`, { cwd: tmp, stdio: "pipe" }).toString();
    expect(out).toContain("0 chartered notes");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("well-formed chartered notes compile into the registry view", () => {
    const tmp = mkdtemp();
    mkdirSync(path.join(tmp, "vault/research-notes"), { recursive: true });
    writeFileSync(
      path.join(tmp, "vault/research-notes/hawk-comprehension.md"),
      [
        "---",
        "title: HAWK driver comprehension",
        "type: research-note",
        "date: 2026-08-22",
        "status: open",
        "owner: human",
        "links:",
        "  evidence_ids: [EV-US-001]",
        "  issues: [#18]",
        "---",
        "",
        "Note body.",
      ].join("\n"),
    );
    execSync(`node ${path.join(process.cwd(), "scripts", "vault-import.mjs")}`, { cwd: tmp, stdio: "pipe" });
    const compiled = JSON.parse(
      readFileSync(path.join(tmp, "state", "vault-notes.json"), "utf8"),
    );
    expect(compiled.note_count).toBe(1);
    expect(compiled.notes[0].title).toBe("HAWK driver comprehension");
    expect(compiled.notes[0].status).toBe("open");
    expect(compiled.notes[0].links.evidence_ids).toEqual(["EV-US-001"]);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("journals compile without status and keep titles containing # intact", () => {
    const tmp = mkdtemp();
    mkdirSync(path.join(tmp, "vault/journal"), { recursive: true });
    writeFileSync(
      path.join(tmp, "vault/journal/2026-08-23-x.md"),
      "---\ntitle: closed issue #20 synced and shut\ntype: journal\ndate: 2026-08-23\nowner: agent\n---\n\nBody.\n",
    );
    execSync(`node ${path.join(process.cwd(), "scripts", "vault-import.mjs")}`, { cwd: tmp, stdio: "pipe" });
    const compiled = JSON.parse(readFileSync(path.join(tmp, "state", "vault-notes.json"), "utf8"));
    expect(compiled.note_count).toBe(1);
    expect(compiled.notes[0].status).toBeNull();
    expect(compiled.notes[0].title).toBe("closed issue #20 synced and shut");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("curated notes require status per charter", () => {
    const tmp = mkdtemp();
    mkdirSync(path.join(tmp, "vault/gotchas"), { recursive: true });
    writeFileSync(
      path.join(tmp, "vault/gotchas/no-status.md"),
      "---\ntitle: t\ntype: gotcha\ndate: 2026-08-22\nowner: agent\n---\n\nBody.\n",
    );
    let failed = false;
    try {
      execSync(`node ${path.join(process.cwd(), "scripts", "vault-import.mjs")}`, { cwd: tmp, stdio: "pipe" });
    } catch (e) {
      failed = true;
      const stderr = String((e as { stderr?: Buffer }).stderr ?? "");
      expect(stderr).toContain("no-status.md");
      expect(stderr).toContain("'status'");
    }
    expect(failed).toBe(true);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("evidence_ids must resolve in the compiled registry (charter §front-matter contract)", () => {
    const tmp = mkdtemp();
    mkdirSync(path.join(tmp, "vault/research-notes"), { recursive: true });
    writeFileSync(
      path.join(tmp, "vault/research-notes/bad-link.md"),
      [
        "---",
        "title: Bad link",
        "type: research-note",
        "date: 2026-08-23",
        "status: open",
        "owner: human",
        "links:",
        "  evidence_ids: [EV-US-001, EV-ZZ-999]",
        "---",
        "",
        "Note body.",
      ].join("\n"),
    );
    let failed = false;
    try {
      execSync(`node ${path.join(process.cwd(), "scripts", "vault-import.mjs")}`, { cwd: tmp, stdio: "pipe" });
    } catch (e) {
      failed = true;
      const stderr = String((e as { stderr?: Buffer }).stderr ?? "");
      expect(stderr).toContain("bad-link.md");
      expect(stderr).toContain("EV-ZZ-999");
      expect(stderr).toContain("evidence-registry.json");
      expect(stderr).not.toContain("EV-ZZ-999,");
    }
    expect(failed).toBe(true);
    rmSync(tmp, { recursive: true, force: true });
  });
});

function mkdtemp(): string {
  return mkdtempSyncIn(os.tmpdir(), "vault-import-test-");
}
import { mkdtempSync } from "node:fs";
function mkdtempSyncIn(base: string, prefix: string): string {
  return mkdtempSync(path.join(base, prefix));
}
