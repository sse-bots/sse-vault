import { NextResponse } from "next/server";
import { requireUnlockedVaultSession } from "@/lib/vault-pin";
import { migrateAndDropBetterAuthCollections } from "@/lib/legacy-auth-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const result = await migrateAndDropBetterAuthCollections({
    sub: ctx.userId,
    email: ctx.email,
  });

  return NextResponse.json(
    { ok: true, ...result },
    { headers: { "Cache-Control": "no-store" } }
  );
}
