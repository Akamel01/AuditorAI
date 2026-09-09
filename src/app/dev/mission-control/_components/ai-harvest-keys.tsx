"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/client";
import { Panel } from "@/app/_components/ui/panel";
import { Eyebrow } from "@/app/_components/ui/chips";
import { InlineNotice } from "@/app/_components/ui/inline-notice";

type Presence = {
  enabled: boolean;
  hasExaKey: boolean;
  hasOpencodeKey: boolean;
  live: boolean;
};

// Reach keys panel (H11) — Apple-design: same Panel/Eyebrow/input/button
// language as the admin-key gate; status first, inputs second, Clear as a
// forgiving secondary (reverts to server env, no confirm needed). Presence
// only — values are never echoed. No new motion: inherits pressable scale.
export function AiHarvestKeys() {
  const [presence, setPresence] = useState<Presence | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [exaKey, setExaKey] = useState("");
  const [opencodeKey, setOpencodeKey] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    adminApi<Presence>("/api/dev/harvest-stream/secrets")
      .then((p) => {
        if (!live) return;
        setPresence(p);
        setEnabled(p.enabled);
      })
      .catch((e) => {
        if (live) setErr((e as Error).message);
      });
    return () => {
      live = false;
    };
  }, []);

  const missing: string[] = [];
  if (presence && !presence.enabled) missing.push("enable the toggle");
  if (presence && !presence.hasExaKey) missing.push("Exa key");
  if (presence && !presence.hasOpencodeKey) missing.push("OpenCode key");

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const p = await adminApi<Presence>("/api/dev/harvest-stream/secrets", {
        method: "POST",
        json: {
          enabled,
          ...(exaKey ? { exaKey } : {}),
          ...(opencodeKey ? { opencodeKey } : {}),
        },
      });
      setPresence(p);
      setExaKey("");
      setOpencodeKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const p = await adminApi<Presence>("/api/dev/harvest-stream/secrets", { method: "DELETE" });
      setPresence(p);
      setEnabled(p.enabled);
      setExaKey("");
      setOpencodeKey("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "min-w-0 flex-1 rounded-md border border-hairline bg-surface px-3 py-1.5 font-mono text-[12px] text-text placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

  return (
    <Panel className="space-y-3 px-4 py-4" data-testid="reach-keys-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow code="CH AI">Reach keys · Exa + OpenCode</Eyebrow>
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${presence?.live ? "text-ok" : "text-muted"}`}
          data-testid="reach-keys-status"
        >
          <span
            className={`h-2 w-2 rounded-full ${presence?.live ? "bg-ok" : "bg-sunken ring-1 ring-hairline"}`}
            aria-hidden
          />
          {presence == null ? "checking…" : presence.live ? "Reach live" : "Reach off"}
        </span>
      </div>

      <p className="font-mono text-[11px] leading-snug text-muted">
        {presence == null ? (
          "Loading key status…"
        ) : presence.live ? (
          <>Start harvests via real reach-out (Exa search + Jina read, gpt-5-nano qualifies).</>
        ) : (
          <>Off — provider returns []. Needs {missing.join(" · ") || "keys"}.</>
        )}
      </p>

      {err && <InlineNotice>{err}</InlineNotice>}

      <label className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          aria-label="enable agent reach"
          data-testid="reach-keys-enabled"
          className="h-3.5 w-3.5 rounded border-hairline text-accent focus:ring-accent"
        />
        enable agent reach (AGENT_REACH_ENABLED)
      </label>

      <div className="flex flex-wrap gap-2">
        <input
          type={show ? "text" : "password"}
          value={exaKey}
          onChange={(e) => setExaKey(e.target.value)}
          placeholder={presence?.hasExaKey ? "•••••••• set — paste to replace" : "paste EXA_API_KEY"}
          aria-label="Exa API key"
          data-testid="reach-keys-exa"
          className={inputCls}
          autoComplete="off"
          spellCheck={false}
        />
        <input
          type={show ? "text" : "password"}
          value={opencodeKey}
          onChange={(e) => setOpencodeKey(e.target.value)}
          placeholder={presence?.hasOpencodeKey ? "•••••••• set — paste to replace" : "paste OPENCODE_API_KEY"}
          aria-label="OpenCode API key"
          data-testid="reach-keys-opencode"
          className={inputCls}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          data-testid="reach-keys-save"
          className="inline-flex items-center rounded-md bg-accent px-4 py-1.5 font-mono text-[11px] font-medium tracking-[0.04em] text-[color:var(--accent-contrast)] hover:bg-accent-strong disabled:bg-sunken disabled:text-faint active:scale-[0.98]"
        >
          {busy ? "Saving…" : "Save keys"}
        </button>
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          data-testid="reach-keys-show"
          className="rounded-md border border-hairline bg-surface px-3 py-1.5 font-mono text-[11px] text-text hover:bg-sunken active:scale-[0.98]"
        >
          {show ? "Hide" : "Show"}
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={busy}
          data-testid="reach-keys-clear"
          title="Clear UI keys, fall back to server env"
          className="rounded-md border border-hairline bg-surface px-3 py-1.5 font-mono text-[11px] text-text hover:bg-sunken disabled:bg-sunken disabled:text-faint active:scale-[0.98]"
        >
          Clear
        </button>
        {saved && (
          <span className="font-mono text-[11px] text-ok" role="status">
            {presence?.live ? "Saved — reach live" : "Saved"}
          </span>
        )}
      </div>

      <p className="font-mono text-[10.5px] leading-snug text-faint">
        Keys stay server-side (KV/file, admin-gated) and are never echoed — status shows presence only. Permanent
        keys belong in Vercel env; Clear falls back to env.
      </p>
    </Panel>
  );
}
