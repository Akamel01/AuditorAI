"use client";
// Workspace identity: a random key generated in the browser, stored locally,
// sent as x-workspace-key. Server stores only its hash. api()/adminApi() are
// the only browser→API transports: workspace surfaces authenticate via the
// workspace key, dev-console surfaces via the admin key (localStorage names
// are the single source here).
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_AUDITOR_PSEUDONYM } from "@/domain/outcome-contracts";

const KEY_ITEM = "auditorai.workspace_key";
const ADMIN_KEY_ITEM = "auditorai.admin_key";
const AUDITOR_PSEUDONYM_ITEM = "auditorai.auditor_pseudonym";

export function getWorkspaceKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY_ITEM);
}

export function ensureWorkspaceKey(): string {
  let k = getWorkspaceKey();
  if (!k) {
    k = crypto.randomUUID() + crypto.randomUUID().split("-")[0];
    localStorage.setItem(KEY_ITEM, k);
  }
  return k;
}

export function getAdminKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ADMIN_KEY_ITEM) ?? "";
}

export function setAdminKey(key: string): void {
  localStorage.setItem(ADMIN_KEY_ITEM, key);
}

/** ADR-0009 §4: pseudonymous stable auditor id for outcome logging. Empty
 *  input clears the override so the ADR default applies again. */
export function getAuditorPseudonym(): string {
  if (typeof window === "undefined") return DEFAULT_AUDITOR_PSEUDONYM;
  return localStorage.getItem(AUDITOR_PSEUDONYM_ITEM) || DEFAULT_AUDITOR_PSEUDONYM;
}

export function setAuditorPseudonym(pseudonym: string): void {
  const v = pseudonym.trim();
  if (v) localStorage.setItem(AUDITOR_PSEUDONYM_ITEM, v);
  else localStorage.removeItem(AUDITOR_PSEUDONYM_ITEM);
}

type ApiInit = RequestInit & { json?: unknown };

function prepare(init?: ApiInit): { headers: Headers; body: BodyInit | null | undefined } {
  const headers = new Headers(init?.headers);
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  return { headers, body };
}

async function send<T>(path: string, init: ApiInit | undefined, authorize: (h: Headers) => void): Promise<T> {
  const { headers, body } = prepare(init);
  authorize(headers);
  const res = await fetch(path, { ...init, headers, body });
  let data: (T & { error?: string }) | undefined;
  try {
    data = (await res.json()) as T & { error?: string };
  } catch {
    data = undefined;
  }
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export function api<T>(path: string, init?: ApiInit): Promise<T> {
  return send<T>(path, init, (h) => h.set("x-workspace-key", ensureWorkspaceKey()));
}

export function adminApi<T>(path: string, init?: ApiInit): Promise<T> {
  return send<T>(path, init, (h) => h.set("x-admin-key", getAdminKey()));
}

export function useWorkspaceKey(): string | null {
  const [k, setK] = useState<string | null>(null);
  useEffect(() => setK(ensureWorkspaceKey()), []);
  return k;
}

export function useResetWorkspace() {
  return useCallback(() => {
    localStorage.removeItem(KEY_ITEM);
    location.reload();
  }, []);
}
