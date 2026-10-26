"use client";

import { useState } from "react";

/** The email sign-in form. It posts JSON to the server route so the shared
 *  request validator owns the body shape; the browser never receives a token. */
export function SignInForm() {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const workspaceId = String(form.get("workspace_id") ?? "").trim();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          ...(workspaceId ? { workspace_id: workspaceId } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; notice?: string };
      if (res.ok) {
        if (data.notice) {
          setNotice(data.notice);
          return;
        }
        window.location.assign("/");
        return;
      }
      setError(data.error ?? "sign-in failed");
    } catch {
      setError("sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border border-line bg-transparent px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border border-line bg-transparent px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Workspace ID (only if you belong to more than one)
        <input
          name="workspace_id"
          autoComplete="off"
          className="rounded border border-line bg-transparent px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded border border-line px-3 py-2 text-sm font-medium disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in with email"}
      </button>
      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm">
          {notice}
        </p>
      ) : null}
    </form>
  );
}
