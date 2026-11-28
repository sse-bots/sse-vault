import { NextResponse } from "next/server";
import { requireUnlockedVaultSession } from "@/lib/vault-pin";
import { getRecentVaultActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const events = await getRecentVaultActivity(guard.session.userId, 30);
  return NextResponse.json({ events }, { headers: { "Cache-Control": "no-store" } });
}
