#!/usr/bin/env node
// Vault determinism guard: compile vault state from the COMMITTED tree (HEAD) via a
// throwaway worktree, so parallel sessions holding uncommitted journal edits can never
// poison state/vault-notes.json. Fails loudly if the working tree would diverge.
// Usage: node scripts/vault-sync.mjs [--check]
//   --check : CI mode — exit 1 if committed vault-notes.json differs from compiled HEAD.
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const check = process.argv.includes("--check");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vault-head-"));

try {
  execSync(`git worktree add --detach ${tmp} HEAD`, { cwd: root, stdio: "pipe" });
  const nm = path.join(root, "node_modules");
  if (fs.existsSync(nm)) fs.symlinkSync(nm, path.join(tmp, "node_modules"), "dir");
  const opts = { cwd: tmp, stdio: "pipe", encoding: "utf8" };
  execSync("node scripts/vault-import.mjs", opts);
  execSync("node scripts/vault-export.mjs", opts);

  const compiled = fs.readFileSync(path.join(tmp, "state", "vault-notes.json"));
  const live = path.join(root, "state", "vault-notes.json");

  if (check) {
    const committed = execSync("git show HEAD:state/vault-notes.json", {
      cwd: root, stdio: "pipe",
    });
    if (!committed.equals(compiled)) {
      console.error(
        "[vault-sync] DETERMINISM FAILURE: committed state/vault-notes.json differs from HEAD-compiled output.",
      );
      console.error("[vault-sync] Fix: run `node scripts/vault-sync.mjs`, then commit the refreshed file.");
      process.exit(1);
    }
    console.log("[vault-sync] committed vault state matches HEAD compilation");
  } else {
    // Sync mode: write the HEAD-compiled notes into the working tree so the next
    // commit carries determinism-clean state regardless of foreign journal edits.
    fs.writeFileSync(live, compiled);
    console.log("[vault-sync] state/vault-notes.json refreshed from HEAD compilation");
  }
} finally {
  try {
    execSync(`git worktree remove --force ${tmp}`, { cwd: root, stdio: "pipe" });
  } catch {
    /* best effort */
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
