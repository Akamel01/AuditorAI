"use client";
// Workspace identity: a random key generated in the browser, stored locally,
// sent as x-workspace-key. Server stores only its hash.
import { useCallback, useEffect, useState } from "react";

const KEY_ITEM = "auditorai.workspace_key";

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

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const key = ensureWorkspaceKey();
  const headers = new Headers(init?.headers);
  headers.set("x-workspace-key", key);
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(path, { ...init, headers, body });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data;
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
