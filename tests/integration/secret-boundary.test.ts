// The service-role secret boundary, proven by a source scan of src/** (+ scripts/**).
//
// The rule (C4 — one owner, applied everywhere):
//   - the service-role ENV NAMES (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY)
//     are read in exactly ONE module of src/: src/lib/db/admin.ts. scripts/**
//     is the other allowlisted place. src/lib/db/config.ts is NOT on the
//     allowlist — it resolves the non-secret names only.
//   - no "use client" module may name a service-role key, the JWT secret or a
//     connection string at all.
//   - the only public Supabase names are URL / ANON_KEY / PUBLISHABLE_KEY.
//   - no client module may import src/lib/db/* (the database seam is
//     server-only; a client import would pull `pg` into the browser bundle).
//
// The scan is a pure function over a list of files, so the SAME scanner is
// exercised against a THROWAWAY COPY of the tree (outside the repository) that
// has a deliberate leak in it: the negative test proves the scan FAILS when a
// client module references the service-role key, instead of merely asserting
// that the clean tree passes.

import { describe, expect, it } from "vitest";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO_ROOT = process.cwd();

/** A source file, relative to the scanned root (e.g. "src/lib/db/admin.ts"). */
interface ScannedFile {
  rel: string;
  content: string;
}

/** The service-role ENV NAMES — the only owner is src/lib/db/admin.ts. */
const SERVICE_ROLE_NAMES = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"];

/** Nothing a client module may ever name. */
const CLIENT_FORBIDDEN = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "service_role",
  "SUPABASE_JWT_SECRET",
  "POSTGRES_URL",
];

/** The only public Supabase names that may exist at all. */
const ALLOWED_PUBLIC_SUPABASE = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

/** Where the service-role names are allowed to appear. */
const SERVICE_ROLE_ALLOWLIST = ["src/lib/db/admin.ts"];

/** The server-only database seam a client module may not import. */
const DB_SEAM_PREFIX = "src/lib/db/";

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".sh",
  ".md",
  ".css",
  ".yml",
  ".yaml",
  ".html",
]);

const CLIENT_DIRECTIVE = /(^|\n)\s*["']use client["']/;

function isClientModule(file: ScannedFile): boolean {
  return CLIENT_DIRECTIVE.test(file.content);
}

/** Every source file under src/ and scripts/ of the given root. */
function collectFiles(root: string): ScannedFile[] {
  const files: ScannedFile[] = [];

  function walk(absolute: string): void {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      const full = path.join(absolute, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!TEXT_EXTENSIONS.has(path.extname(entry.name))) continue;
      files.push({
        rel: path.relative(root, full).split(path.sep).join("/"),
        content: readFileSync(full, "utf8"),
      });
    }
  }

  for (const dir of ["src", "scripts"]) {
    const base = path.join(root, dir);
    if (existsSync(base)) walk(base);
  }
  return files;
}

/** The import specifiers of a module. */
function importSpecifiers(content: string): string[] {
  const specs: string[] = [];
  const re = /(?:from|import|require)\s*\(?\s*["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) specs.push(match[1]);
  return specs;
}

/** Resolve a relative import to a path relative to the scanned root. */
function resolveImport(rel: string, spec: string): string | null {
  if (spec.startsWith("@/")) return `src/${spec.slice(2)}`;
  if (spec.startsWith("./") || spec.startsWith("../")) {
    return path.posix
      .normalize(path.posix.join(path.posix.dirname(rel), spec))
      .replace(/\.tsx?$/, "");
  }
  return null;
}

/** Every boundary violation in the scanned tree. */
function scan(files: ScannedFile[]): string[] {
  const violations: string[] = [];

  for (const file of files) {
    const client = isClientModule(file);

    // Rule 1: no client module names a secret or a connection string.
    if (client) {
      for (const token of CLIENT_FORBIDDEN) {
        if (file.content.includes(token)) {
          violations.push(`${file.rel}: client module references ${token}`);
        }
      }
      // Rule 3: no client module imports the server-only database seam.
      for (const spec of importSpecifiers(file.content)) {
        const resolved = resolveImport(file.rel, spec);
        if (resolved && resolved.startsWith(DB_SEAM_PREFIX)) {
          violations.push(`${file.rel}: client module imports ${resolved}`);
        }
      }
    }

    // Rule 2: only the three public Supabase names may exist.
    const publicNames = file.content.match(/NEXT_PUBLIC_SUPABASE_[A-Z0-9_]*/g) ?? [];
    for (const name of publicNames) {
      if (!ALLOWED_PUBLIC_SUPABASE.includes(name)) {
        violations.push(`${file.rel}: unexpected public Supabase name ${name}`);
      }
    }

    // Rule 4: the service-role names live only in the admin module and scripts.
    const allowed =
      SERVICE_ROLE_ALLOWLIST.includes(file.rel) || file.rel.startsWith("scripts/");
    if (!allowed) {
      for (const name of SERVICE_ROLE_NAMES) {
        if (file.content.includes(name)) {
          violations.push(`${file.rel}: service-role name ${name} outside the allowlist`);
        }
      }
    }
  }

  return violations;
}

describe("secret boundary", () => {
  it("finds no violation in the repository source tree", () => {
    const files = collectFiles(REPO_ROOT);
    // The scan is not vacuous: there ARE client modules to check.
    expect(files.filter(isClientModule).length).toBeGreaterThan(0);
    expect(scan(files)).toEqual([]);
  });

  it("keeps the service-role names in the admin module only (C4)", () => {
    const files = collectFiles(REPO_ROOT);
    const admin = files.find((f) => f.rel === "src/lib/db/admin.ts");
    expect(admin).toBeDefined();
    for (const name of SERVICE_ROLE_NAMES) {
      expect(admin?.content).toContain(name);
    }
    // src/lib/db/config.ts is explicitly NOT on the allowlist.
    const config = files.find((f) => f.rel === "src/lib/db/config.ts");
    expect(config).toBeDefined();
    for (const name of SERVICE_ROLE_NAMES) {
      expect(config?.content).not.toContain(name);
    }
  });

  it("FAILS when a client module references the service-role key (negative control)", () => {
    // A throwaway copy of the tree OUTSIDE the repository, with a deliberate
    // leak. Nothing in the repository is touched.
    const tmp = mkdtempSync(path.join(os.tmpdir(), "auditorai-secret-boundary-"));
    try {
      cpSync(path.join(REPO_ROOT, "src"), path.join(tmp, "src"), { recursive: true });
      cpSync(path.join(REPO_ROOT, "scripts"), path.join(tmp, "scripts"), {
        recursive: true,
      });

      writeFileSync(
        path.join(tmp, "src/app/_components/leaky-client.tsx"),
        '"use client";\nexport const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
      );
      writeFileSync(
        path.join(tmp, "src/app/_components/leaky-importer.tsx"),
        '"use client";\nimport { APP_ROLE } from "@/lib/db/sql";\nexport const r = APP_ROLE;\n',
      );

      const violations = scan(collectFiles(tmp));

      // The exact violations the scanner must raise — pinned, so a scanner that
      // silently stopped looking would fail this suite.
      expect(violations.sort()).toEqual([
        "src/app/_components/leaky-client.tsx: client module references SUPABASE_SERVICE_ROLE_KEY",
        "src/app/_components/leaky-client.tsx: service-role name SUPABASE_SERVICE_ROLE_KEY outside the allowlist",
        "src/app/_components/leaky-importer.tsx: client module imports src/lib/db/sql",
      ]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
