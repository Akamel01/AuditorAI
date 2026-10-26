// Drift detector for the request-body trust boundary (ticket #46, G-6).
// The rule the whole repo must keep: NO route file reads a request body
// itself. The only body readers are readJsonBody / validateFormFields in
// src/lib/request-schema.ts, so every route that HAS a body (per the
// committed registry contracts/api-surface.json) must import the shared
// validator. A new route that parses its own body fails here, and the
// failure names the offending file and line.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const REPO = process.cwd();
const APP_ROOT = path.join(REPO, "src/app");
const VALIDATOR_MODULE = "@/lib/request-schema";
const UPLOAD_ROUTE = "src/app/api/upload/route.ts";

interface SurfaceEntry {
  method: string;
  path: string;
  body: "none" | "json" | "multipart";
}

const registry = JSON.parse(
  readFileSync(path.join(REPO, "contracts/api-surface.json"), "utf8"),
) as { handlers: SurfaceEntry[] };

/** The reader that owns each body kind. */
const READER_FOR: Record<Exclude<SurfaceEntry["body"], "none">, string> = {
  json: "readJsonBody",
  multipart: "validateFormFields",
};

interface Violation {
  file: string;
  line: number;
  text: string;
}

function routeFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...routeFiles(full));
    else if (entry.name === "route.ts") found.push(full);
  }
  return found;
}

/** Every route file on disk, read at test time — no hardcoded file list.
 *  Next serves any src/app/**\/route.ts, so the scan covers all of them. */
const ROUTES = routeFiles(APP_ROOT).map((file) => {
  const source = readFileSync(file, "utf8");
  const rel = path.relative(REPO, file).split(path.sep).join("/");
  return {
    file,
    rel,
    routePath: "/" + path.relative(APP_ROOT, file).split(path.sep).join("/").replace(/route\.ts$/, "").replace(/\/$/, ""),
    source,
    lines: source.split("\n"),
  };
});

function lineOf(source: string, pattern: RegExp): number {
  const index = source.search(pattern);
  return index === -1 ? 0 : source.slice(0, index).split("\n").length;
}

/** A body read on a request: req.json(), req.clone().json(), r.text() where r
 *  came from req, req.body (the raw stream), req.clone() (a second copy of the
 *  body). Limit: a route that hides the request behind a function argument
 *  (parseBody(req)) escapes this scan — the shared-validator import check in
 *  the third test is the backstop. */
const CHAIN = "([A-Za-z_$][\\w$]*(?:\\s*\\.\\s*[A-Za-z_$][\\w$]*)*(?:\\s*\\(\\s*\\))?)";
const BODY_READ = new RegExp(
  `${CHAIN}\\s*\\.\\s*(json|text|arrayBuffer|blob)\\s*\\(`,
  "g",
);
const CLONE_READ = new RegExp(`${CHAIN}\\s*\\.\\s*clone\\s*\\(`, "g");
const BODY_STREAM = new RegExp(`${CHAIN}\\s*\\.\\s*body\\b`, "g");
const REQUEST_NAME = /^(req|request)$/i;

/** The identifiers that hold a request in this file: req/request themselves
 *  and any name assigned from one (`const r = req`). */
function requestRoots(source: string): Set<string> {
  const roots = new Set<string>(["req", "request"]);
  for (const match of source.matchAll(
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:req|request)(?:\.clone\(\))?\s*[;,)]/g,
  )) {
    roots.add(match[1]);
  }
  return roots;
}

/** Is this receiver chain request-derived? Strip the request segments from the
 *  receiver expression: what is left is empty (the receiver IS the request)
 *  or a request-derived chain (req.clone(), r, …). */
function isRequestChain(chain: string, roots: Set<string>): boolean {
  return chain
    .split(".")
    .map((segment) => segment.trim().replace(/\(\)$/, ""))
    .some((segment) => roots.has(segment) || REQUEST_NAME.test(segment));
}

/** Every direct body read in one source file, with the line it sits on. */
function bodyReads(source: string): { line: number; text: string }[] {
  const roots = requestRoots(source);
  const found: { line: number; text: string }[] = [];
  source.split("\n").forEach((text, index) => {
    const chained = (re: RegExp) => {
      for (const match of text.matchAll(re)) {
        if (isRequestChain(match[1], roots)) return true;
      }
      return false;
    };
    if (chained(BODY_READ) || chained(CLONE_READ) || chained(BODY_STREAM)) {
      found.push({ line: index + 1, text: text.trim() });
    }
  });
  return found;
}

/** The names a route file imports from the shared validator module. */
function importedValidators(source: string): Set<string> {
  const names = new Set<string>();
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${VALIDATOR_MODULE}["']`, "g");
  for (const match of source.matchAll(re)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name) names.add(name);
    }
  }
  return names;
}

/** The body readers a route file imports from the shared validator module. */
function importedReaders(source: string): string[] {
  const names = importedValidators(source);
  return Object.values(READER_FOR).filter((reader) => names.has(reader));
}

/** The body kind a set of readers stands for. */
function bodyKind(readers: string[]): string {
  if (readers.includes("readJsonBody")) return "json";
  if (readers.includes("validateFormFields")) return "multipart";
  return "none";
}

function format(violations: Violation[]): string[] {
  return violations.map((v) => `${v.file}:${v.line} ${v.text}`);
}

function report(violations: Violation[]): string {
  return violations.map((v) => `  ${v.file}:${v.line} — ${v.text}`).join("\n");
}

describe("request body sources", () => {
  it("no route file reads the request body directly", () => {
    const violations: Violation[] = [];
    for (const route of ROUTES) {
      for (const read of bodyReads(route.source)) {
        violations.push({
          file: route.rel,
          line: read.line,
          text: `reads the request body outside the shared validator: ${read.text}`,
        });
      }
    }
    expect(
      format(violations),
      `A route file reads the request body itself. The only body reader is src/lib/request-schema.ts:\n${report(violations)}`,
    ).toEqual([]);
  });

  it("flags every way a route could read a body it does not own", () => {
    const flagged = (source: string) => bodyReads(source).length;
    expect(flagged("const body = await req.json();")).toBe(1);
    expect(flagged("const body = await req.clone().json();")).toBe(1);
    expect(flagged("const body = await req.text();")).toBe(1);
    expect(flagged("const body = await req.arrayBuffer();")).toBe(1);
    expect(flagged("const body = await req.blob();")).toBe(1);
    expect(flagged("const copy = req.clone();")).toBe(1);
    expect(flagged("const stream = req.body;")).toBe(1);
    expect(flagged("const res = new Response(req.body);")).toBe(1);
    expect(flagged("const r = req;\nconst body = await r.text();")).toBe(1);
    // Legal: a response is not a request, and NextResponse.json() is the reply.
    expect(flagged("return NextResponse.json({ ok: true });")).toBe(0);
    expect(flagged("const res = await fetch(url);\nconst data = await res.json();")).toBe(0);
  });

  it("reads formData only in the single multipart route", () => {
    const violations: Violation[] = [];
    for (const route of ROUTES) {
      if (route.rel === UPLOAD_ROUTE) continue;
      route.lines.forEach((line, index) => {
        if (line.includes(".formData(")) {
          violations.push({
            file: route.rel,
            line: index + 1,
            text: `reads formData outside the single multipart route ${UPLOAD_ROUTE}: ${line.trim()}`,
          });
        }
      });
    }
    expect(
      format(violations),
      `Only ${UPLOAD_ROUTE} may read a multipart body:\n${report(violations)}`,
    ).toEqual([]);
  });

  it("every route with a body imports the shared validator", () => {
    const byPath = new Map(ROUTES.map((route) => [route.routePath, route]));
    const violations: Violation[] = [];
    for (const entry of registry.handlers) {
      if (entry.body === "none") continue;
      const route = byPath.get(entry.path);
      if (!route) {
        violations.push({
          file: "contracts/api-surface.json",
          line: 0,
          text: `${entry.method} ${entry.path} has a body (${entry.body}) but no route file exists`,
        });
        continue;
      }
      const reader = READER_FOR[entry.body];
      if (!importedValidators(route.source).has(reader)) {
        violations.push({
          file: route.rel,
          line: lineOf(route.source, new RegExp(`export async function ${entry.method}\\s*\\(`)),
          text: `${entry.method} ${entry.path} has a ${entry.body} body but does not import ${reader} from ${VALIDATOR_MODULE}`,
        });
      }
    }
    expect(
      format(violations),
      `A route with a body must read it through the shared validator (${VALIDATOR_MODULE}):\n${report(violations)}`,
    ).toEqual([]);
  });

  it("every route's imported reader matches the registry's body kind", () => {
    // Bidirectional: the registry's body column and the reader the route
    // actually imports must agree in BOTH directions.
    const required = new Map<string, Set<string>>();
    for (const entry of registry.handlers) {
      const set = required.get(entry.path) ?? new Set<string>();
      if (entry.body !== "none") set.add(READER_FOR[entry.body]);
      required.set(entry.path, set);
    }
    const violations: Violation[] = [];
    for (const route of ROUTES) {
      const want = required.get(route.routePath);
      if (!want) continue; // no registry entry: the api-surface census owns it
      const got = importedReaders(route.source).sort();
      const expected = [...want].sort();
      if (got.join(",") === expected.join(",")) continue;
      violations.push({
        file: route.rel,
        line: 0,
        text:
          `${route.routePath}: registry body "${bodyKind(expected)}" ` +
          `but the route imports ${got.length ? got.join(", ") : "no body reader"} from ${VALIDATOR_MODULE}`,
      });
    }
    expect(
      format(violations),
      `The registry's body column and the shared validator import must agree:\n${report(violations)}`,
    ).toEqual([]);
  });
});
