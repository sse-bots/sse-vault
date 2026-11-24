import { NextResponse } from "next/server";
import { getVaultSession } from "@/lib/session";
import { getVaultCollections } from "@/lib/mongodb";
import { serializeVaultDoc } from "@/lib/vault-serializer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getVaultSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultItems } = await getVaultCollections();
  const docs = await vaultItems
    .find({ ownerUserId: ctx.userId })
    .sort({ domainKey: 1, updatedAt: -1 })
    .toArray();

  const payload = {
    exportedAt: new Date().toISOString(),
    owner: { name: ctx.name, email: ctx.email },
    totalEntries: docs.length,
    entries: docs.map(serializeVaultDoc),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="sse-vault-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
