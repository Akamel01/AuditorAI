import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { getDataStore } from "@/lib/persistence/store";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const store = getDataStore();
    const bundle = await store.get("discovery:proof:bundle");
    // fallback to globalThis for tests
    const g = (globalThis as unknown as Record<string, unknown>).__HARVEST_PROOF_BUNDLE__ as unknown;
    return NextResponse.json({ bundle: bundle ?? g ?? null });
  } catch (e) {
    return serverError(e);
  }
}
