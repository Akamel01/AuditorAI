// GET /api/jurisdictions — registry for UI selection.
import { NextResponse } from "next/server";
import { listJurisdictions } from "@/domain/packs";
import { serverError } from "@/lib/api";

export async function GET() {
  try {
    return NextResponse.json({ jurisdictions: listJurisdictions() });
  } catch (e) {
    return serverError(e);
  }
}
