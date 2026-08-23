import { parse as parseYaml } from "yaml";

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const PROSE_TYPES = ["journal", "decision", "research-note", "gotcha"];
export const STATUSES = ["open", "settled", "superseded"];

export function splitFrontMatter(text, file) {
  const m = text.match(FRONT_MATTER_RE);
  if (!m) throw new Error(`${file}: missing front-matter block (must start with ---)`);
  return { raw: m[1], bodyStart: m[0].length };
}

export function parseFrontMatter(text, file) {
  const { raw, bodyStart } = splitFrontMatter(text, file);
  let doc;
  try {
    doc = parseYaml(guardPlainScalars(raw));
  } catch (e) {
    throw new Error(`${file}: invalid front-matter YAML (${firstLine(e.message)})`);
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error(`${file}: front-matter must be a YAML mapping`);
  }
  return { fields: doc, bodyStart };
}

function guardPlainScalars(block) {
  return block
    .split("\n")
    .map((line) => {
      const m = /^(\s*(?:-\s)?)([A-Za-z_][A-Za-z0-9_]*):(?:[ ](.*))?$/.exec(line);
      if (!m || m[3] === undefined || m[3].trim() === "") return line;
      const value = m[3].trim();
      if (/^["'[{&*!>|]/.test(value)) return `${m[1]}${m[2]}: ${guardFlowItems(value)}`;
      if (/^(null|Null|NULL|~)$/.test(value)) return line;
      if (!/(^|\s)#/.test(value) && !/:\s|:$/.test(value)) return line;
      return `${m[1]}${m[2]}: ${quoteScalar(value)}`;
    })
    .join("\n");
}

function guardFlowItems(value) {
  const m = /^\[(.*)\]$/.exec(value);
  if (!m) return value;
  const items = m[1].split(",");
  if (!items.some((it) => {
    const t = it.trim();
    return t.startsWith("#") || /^0\d+$/.test(t);
  })) return value;
  const guarded = items.map((it) => {
    const t = it.trim();
    if ((t.startsWith("#") || /^0\d+$/.test(t)) && !(t.startsWith("'") || t.startsWith('"'))) return `'${t}'`;
    return it;
  });
  return `[${guarded.join(", ")}]`;
}

function quoteScalar(value) {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function firstLine(message) {
  const i = message.indexOf("\n");
  return i === -1 ? message : message.slice(0, i);
}

export function scalarToString(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  throw new Error(`unsupported scalar type (${typeof v})`);
}

export function validateNoteFrontMatter(file, fields, expectedType) {
  for (const req of ["title", "type", "date", "owner"]) {
    if (!(req in fields) || fields[req] === null || fields[req] === "") {
      throw new Error(`${file}: front-matter missing required field '${req}' (charter §front-matter contract)`);
    }
  }
  const type = scalarToString(fields.type);
  if (!PROSE_TYPES.includes(type)) {
    throw new Error(`${file}: unknown type '${type}' (chartered types: ${PROSE_TYPES.join(", ")})`);
  }
  if (expectedType && type !== expectedType) {
    throw new Error(`${file}: type '${type}' does not match chartered zone '${expectedType}'`);
  }
  const date = scalarToString(fields.date);
  if (!DATE_RE.test(date ?? "")) {
    throw new Error(`${file}: 'date' must be YYYY-MM-DD, got '${date}'`);
  }
  const owner = scalarToString(fields.owner);
  if (!["human", "agent"].includes(owner)) {
    throw new Error(`${file}: 'owner' must be human|agent per charter conflict rules, got '${owner}'`);
  }
  if (type !== "journal") {
    const status = scalarToString(fields.status);
    if (status === null) {
      throw new Error(`${file}: front-matter missing required field 'status' (charter §front-matter contract)`);
    }
    if (!STATUSES.includes(status)) {
      throw new Error(`${file}: 'status' must be open|settled|superseded, got '${status}'`);
    }
  }
  return { type, status: scalarToString(fields.status), owner };
}

export function normalizeLinks(file, fields) {
  const links = fields.links ?? {};
  const pick = (key) => {
    const v = links[key];
    if (v === null || v === undefined) return [];
    if (!Array.isArray(v)) throw new Error(`${file}: links.${key} must be an array per charter §front-matter contract`);
    return v.map(scalarToString).map((s) => {
      if (s === null) throw new Error(`${file}: links.${key} must not contain empty entries`);
      return s;
    });
  };
  return { evidence_ids: pick("evidence_ids"), issues: pick("issues"), adr: pick("adr") };
}

export function emitFrontMatter(entries) {
  const lines = ["---"];
  for (const [k, v] of entries) {
    if (typeof v === "object") throw new Error(`emitFrontMatter: field '${k}' is not a flat scalar`);
    lines.push(`${k}: ${v}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}
