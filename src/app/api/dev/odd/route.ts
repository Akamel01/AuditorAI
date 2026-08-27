// GET /api/dev/odd — admin-gated ODD declaration via domain/odd.ts
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { getOddDeclaration } from "@/domain/odd";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const decl = getOddDeclaration();
    return NextResponse.json(decl);
  } catch (e) {
    return serverError(e);
  }
}
