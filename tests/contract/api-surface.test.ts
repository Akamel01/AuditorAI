// Contract test: the committed API surface registry (contracts/api-surface.json)
// must match the route files under src/app/api exactly, in BOTH directions — a
// new route without a registry entry fails here, and a registry entry without a
// route file fails here. The three public routes are pinned with their reason,
// every body_schema is resolved against the schema files on disk and against
// the shared Ajv instance, and the shared body reader's contract is proven.
import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { RequestContractError, serverError } from "@/lib/api";
import nextConfig from "../../next.config";
import {
  auditPatchRequest,
  createProjectRequest,
  devDiscoveryRunRequest,
  devHarvestStreamRequest,
  devRunEditRequest,
  devRunRequest,
  devRunStepRequest,
  devSecretsRequest,
  issueRequest,
  patchProjectRequest,
  readJsonBody,
  uploadFields,
  validateFormFields,
  type Validator,
} from "@/lib/request-schema";

const REPO = process.cwd();
const APP_ROOT = path.join(REPO, "src/app");

interface SurfaceEntry {
  method: string;
  path: string;
  auth: "public" | "workspace" | "admin";
  body: "none" | "json" | "multipart";
  body_schema: string | null;
  invalid_body_status: number | null;
  public_reason: string;
}

const registry = JSON.parse(
  readFileSync(path.join(REPO, "contracts/api-surface.json"), "utf8"),
) as { version: number; handlers: SurfaceEntry[] };

/** Every validator the shared module compiles — the $id of each is what the
 *  registry points at. */
const VALIDATORS: Record<string, Validator> = {
  createProjectRequest,
  patchProjectRequest,
  auditPatchRequest,
  issueRequest,
  uploadFields,
  devRunRequest,
  devRunEditRequest,
  devRunStepRequest,
  devDiscoveryRunRequest,
  devHarvestStreamRequest,
  devSecretsRequest,
};

function schemaId(validate: Validator): string | undefined {
  const schema = validate.schema as { $id?: string } | undefined;
  return schema && typeof schema === "object" ? schema.$id : undefined;
}

const COMPILED_IDS = new Set(Object.values(VALIDATORS).map(schemaId));

function routeFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...routeFiles(full));
    else if (entry.name === "route.ts") found.push(full);
  }
  return found;
}

// A Next.js handler may be exported as a function, as a const/let/var (with or
// without a type annotation) or re-exported from a named export list — all are
// legal, so the census must see all of them.
const HTTP_METHOD = "GET|POST|PUT|PATCH|DELETE";

const METHOD_EXPORTS: RegExp[] = [
  // export async function GET() {}
  new RegExp(`export\\s+(?:async\\s+)?function\\s+(${HTTP_METHOD})\\s*\\(`, "g"),
  // export const GET = …, export const GET: RouteHandler = …, export let GET, export var GET
  new RegExp(`export\\s+(?:const|let|var)\\s+(${HTTP_METHOD})\\b`, "g"),
];

// export { GET } / export { GET, POST } / export { GET } from "./handler"
const EXPORT_LIST = /export\s*\{([^}]*)\}/g;
const METHOD_IN_LIST = new RegExp(`\\b(${HTTP_METHOD})\\b`, "g");

/** Every HTTP method a route file exports, in either legal export form. */
function exportedMethods(source: string): string[] {
  const methods = new Set<string>();
  for (const re of METHOD_EXPORTS) {
    for (const match of source.matchAll(re)) methods.add(match[1]);
  }
  for (const list of source.matchAll(EXPORT_LIST)) {
    for (const match of list[1].matchAll(METHOD_IN_LIST)) methods.add(match[1]);
  }
  return [...methods];
}

interface RouteFile {
  file: string;
  routePath: string;
  methods: string[];
  source: string;
}

function routeFileList(): RouteFile[] {
  // Every route file Next serves, not just the ones under src/app/api.
  return routeFiles(APP_ROOT).map((file) => {
    const rel = path.relative(APP_ROOT, file).split(path.sep).join("/");
    const source = readFileSync(file, "utf8");
    return {
      file,
      routePath: "/" + rel.replace(/route\.ts$/, "").replace(/\/$/, ""),
      methods: exportedMethods(source),
      source,
    };
  });
}

/** The gate a route file actually calls. The gate is per file in this repo:
 *  no route file mixes two gates across its handlers. */
function derivedAuth(source: string): "public" | "workspace" | "admin" {
  const workspace = /requireWorkspace\s*\(/.test(source);
  const admin = /requireAdmin\s*\(/.test(source);
  if (workspace && admin) throw new Error("a route file calls both requireWorkspace and requireAdmin");
  if (workspace) return "workspace";
  if (admin) return "admin";
  return "public";
}

/** The filesystem census: one row per exported HTTP handler. */
function census(): { method: string; path: string }[] {
  const rows: { method: string; path: string }[] = [];
  for (const route of routeFileList()) {
    for (const method of route.methods) rows.push({ method, path: route.routePath });
  }
  return rows;
}

const key = (method: string, routePath: string) => `${method} ${routePath}`;

describe("api surface registry", () => {
  it("has one entry per exported handler (filesystem census)", () => {
    const fs = new Set(census().map((r) => key(r.method, r.path)));
    const reg = new Set(registry.handlers.map((h) => key(h.method, h.path)));
    // A route file with no registry entry.
    expect([...fs].filter((k) => !reg.has(k))).toEqual([]);
    // A registry entry with no route file.
    expect([...reg].filter((k) => !fs.has(k))).toEqual([]);
  });

  it("lists every handler exactly once", () => {
    const keys = registry.handlers.map((h) => key(h.method, h.path));
    expect(new Set(keys).size).toBe(keys.length);
    expect(registry.handlers.length).toBe(census().length);
  });

  it("traces exactly the route files that exist (next.config.ts API_ROUTES)", () => {
    // The tracing list is the repo's SECOND route list; when it drifts, the
    // routes it omits ship without their runtime files and 500 in production.
    const traced = Object.keys(nextConfig.outputFileTracingIncludes ?? {}).sort();
    const onDisk = routeFiles(APP_ROOT)
      .map((file) => "/" + path.relative(APP_ROOT, file).split(path.sep).join("/").replace(/route\.ts$/, "").replace(/\/$/, ""))
      .sort();
    expect(traced).toEqual(onDisk);
  });

  it("sees a handler exported as a const as well as one exported as a function", () => {
    expect(exportedMethods("export async function GET() {}")).toEqual(["GET"]);
    expect(exportedMethods("export const GET = async () => {};")).toEqual(["GET"]);
    expect(exportedMethods("export let POST = () => {};\nexport var PUT = () => {};")).toEqual([
      "POST",
      "PUT",
    ]);
  });

  it("sees every legal export form of a handler (typed const, re-export, let/var)", () => {
    expect(exportedMethods("export async function GET() {}")).toEqual(["GET"]);
    expect(exportedMethods("export const GET = async () => {};")).toEqual(["GET"]);
    expect(exportedMethods("export const GET: RouteHandler = async () => {};")).toEqual(["GET"]);
    expect(exportedMethods('export { GET } from "./handler";')).toEqual(["GET"]);
    expect(exportedMethods("export { GET };")).toEqual(["GET"]);
    expect(exportedMethods("export { GET, POST };")).toEqual(["GET", "POST"]);
    expect(exportedMethods("export let GET;\nexport var POST;")).toEqual(["GET", "POST"]);
  });

  it("derives every route's auth gate from the route source and matches the registry", () => {
    const routes = routeFileList();
    const derived = new Map(routes.map((r) => [r.routePath, derivedAuth(r.source)]));
    // The public set comes from the SOURCE, not from the registry.
    const publicRoutes = routes
      .filter((r) => derived.get(r.routePath) === "public")
      .flatMap((r) => r.methods.map((m) => key(m, r.routePath)))
      .sort();
    expect(publicRoutes).toEqual([
      "GET /api/health",
      "GET /api/inputs/[jur]",
      "GET /api/jurisdictions",
      "GET /api/jurisdictions/[jur]/stages",
      "GET /api/readiness",
    ]);
    for (const entry of registry.handlers) {
      const where = key(entry.method, entry.path);
      const actual = derived.get(entry.path);
      expect(
        actual,
        `${where}: registry auth "${entry.auth}" does not match the gate the route source calls (${actual ?? "no route file"})`,
      ).toBe(entry.auth);
    }
  });

  it("pins exactly the three public routes, each with a reason", () => {
    const publicRoutes = registry.handlers
      .filter((h) => h.auth === "public")
      .map((h) => key(h.method, h.path))
      .sort();
    expect(publicRoutes).toEqual([
      "GET /api/health",
      "GET /api/inputs/[jur]",
      "GET /api/jurisdictions",
      "GET /api/jurisdictions/[jur]/stages",
      "GET /api/readiness",
    ]);
    for (const entry of registry.handlers) {
      if (entry.auth === "public") {
        expect(entry.public_reason.trim().length, `${key(entry.method, entry.path)} has no public_reason`).toBeGreaterThan(0);
      } else {
        expect(entry.public_reason.trim(), `${key(entry.method, entry.path)} must not claim to be public`).toBe("");
      }
    }
  });

  it("resolves every body_schema to a committed schema compiled by the shared Ajv instance", () => {
    const dir = path.join(REPO, "contracts/schemas/api");
    const byId = new Map<string, { $id?: string; $schema?: string }>();
    for (const name of readdirSync(dir)) {
      const schema = JSON.parse(readFileSync(path.join(dir, name), "utf8")) as {
        $id?: string;
        $schema?: string;
      };
      byId.set(schema.$id as string, schema);
    }
    for (const entry of registry.handlers) {
      const where = key(entry.method, entry.path);
      if (entry.body === "none") {
        expect(entry.body_schema, `${where} has body "none" but a body_schema`).toBeNull();
        continue;
      }
      expect(entry.body_schema, `${where} has a body but no body_schema`).not.toBeNull();
      const schema = byId.get(entry.body_schema as string);
      expect(schema, `${where} references a schema that is not on disk: ${entry.body_schema}`).toBeDefined();
      expect(schema?.$schema, `${where} schema is not the 2020-12 dialect`).toBe(
        "https://json-schema.org/draft/2020-12/schema",
      );
      expect(schema?.$id, `${where} schema $id does not match the registry`).toBe(entry.body_schema);
      expect(
        COMPILED_IDS.has(entry.body_schema as string),
        `${where} schema is not compiled by the shared Ajv instance`,
      ).toBe(true);
    }
  });

  it("pairs every body kind with its invalid-body status", () => {
    const bodies = registry.handlers.filter((h) => h.body !== "none");
    expect(bodies.length).toBe(11);
    for (const entry of registry.handlers) {
      const where = key(entry.method, entry.path);
      if (entry.body === "json") expect(entry.invalid_body_status, where).toBe(422);
      else if (entry.body === "multipart") expect(entry.invalid_body_status, where).toBe(400);
      else expect(entry.invalid_body_status, where).toBeNull();
    }
  });
});

describe("shared request-body helper", () => {
  const post = (body: string) =>
    new Request("http://localhost/", { method: "POST", body });

  it("rejects an unparseable body with RequestContractError", async () => {
    await expect(readJsonBody(post("{not json"), createProjectRequest)).rejects.toBeInstanceOf(
      RequestContractError,
    );
    await expect(readJsonBody(post("{not json"), createProjectRequest)).rejects.toThrow(
      "request body is not valid JSON",
    );
  });

  it("reports a schema violation with the failing path", async () => {
    const err = await readJsonBody(post(JSON.stringify({ name: 123 })), createProjectRequest).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(RequestContractError);
    expect((err as Error).message).toMatch(
      /^request body failed schema validation: \/name must be string/,
    );
  });

  it("names the unknown property in a JSON body", async () => {
    const err = await readJsonBody(
      post(JSON.stringify({ name: "x", jurisdiction: "UK", foo: "bar" })),
      createProjectRequest,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RequestContractError);
    expect((err as Error).message).toMatch(
      /^request body failed schema validation: \/ must NOT have additional properties \(unexpected field 'foo'\)/,
    );
  });

  it("rejects a prototype key in input_values (422) and accepts a normal one", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // JSON.parse (not an object literal) — a literal would set the prototype
    // instead of creating the own key the schema has to reject.
    const proto = await readJsonBody(
      post('{"input_values":{"__proto__":{"state":"provided","value":"pwn"}}}'),
      patchProjectRequest,
    ).catch((e: unknown) => e);
    expect(proto).toBeInstanceOf(RequestContractError);
    expect(serverError(proto).status).toBe(422);
    // A normal input_values body still validates.
    await expect(
      readJsonBody(
        post('{"input_values":{"deck":{"state":"provided","value":"x"}}}'),
        patchProjectRequest,
      ),
    ).resolves.toEqual({ input_values: { deck: { state: "provided", value: "x" } } });
    spy.mockRestore();
  });

  it("accepts an empty body only when allowEmpty is set", async () => {
    await expect(readJsonBody(post(""), createProjectRequest)).rejects.toBeInstanceOf(
      RequestContractError,
    );
    await expect(
      readJsonBody(post(""), createProjectRequest, { allowEmpty: true }),
    ).resolves.toEqual({});
  });

  it("keeps the file part out of the validated field set", () => {
    const form = new FormData();
    form.append("file", new File(["x"], "a.txt"));
    form.append("kind", "image");
    expect(validateFormFields(form, uploadFields)).toEqual({
      ok: true,
      value: { kind: "image" },
    });
  });

  it("rejects a wrongly-typed form field instead of dropping it", () => {
    const fileForm = new FormData();
    fileForm.append("kind", new File(["x"], "kind.txt"));
    const fileResult = validateFormFields(fileForm, uploadFields);
    expect(fileResult.ok).toBe(false);
    expect(fileResult.ok === false ? fileResult.error : "").toBe(
      "invalid form field: /kind must be string",
    );

    const blobForm = new FormData();
    blobForm.append("project_id", new Blob(["p1"]));
    const blobResult = validateFormFields(blobForm, uploadFields);
    expect(blobResult.ok).toBe(false);
    expect(blobResult.ok === false ? blobResult.error : "").toBe(
      "invalid form field: /project_id must be string",
    );
  });

  it("keeps the first value of a repeated form key (FormData.get semantics)", () => {
    const form = new FormData();
    form.append("project_id", "p1");
    form.append("project_id", "p2");
    expect(validateFormFields(form, uploadFields)).toEqual({
      ok: true,
      value: { project_id: "p1" },
    });
  });

  it("names the offending form field", () => {
    const form = new FormData();
    form.append("foo", "bar");
    const result = validateFormFields(form, uploadFields);
    expect(result.ok).toBe(false);
    expect(result.ok === false ? result.error : "").toBe(
      "invalid form field: unexpected field 'foo'",
    );
  });
});
