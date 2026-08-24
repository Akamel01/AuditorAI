"use client";

import { useWorkspaceKey, useResetWorkspace } from "@/lib/client";

/** Quiet escape hatch: reset the local workspace key when one exists. */
export function ResetKeyLink() {
  const key = useWorkspaceKey();
  const reset = useResetWorkspace();
  if (!key) return null;
  return (
    <button
      onClick={reset}
      className="cursor-pointer font-mono text-[10.5px] tracking-[0.06em] text-faint underline decoration-dotted underline-offset-2 transition-colors hover:text-subtle"
    >
      reset local workspace key
    </button>
  );
}
