import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getVaultSession } from "@/lib/session";
import { getVaultCollections } from "@/lib/mongodb";
import { encryptSecret, generateCodeId } from "@/lib/crypto";
import { serializeVaultDoc } from "@/lib/vault-serializer";
import type { StoredSecurityCode } from "@/lib/vault-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const codeActionSchema = z.union([
  z.object({
    action: z.literal("toggle"),
    codeId: z.string().min(1),
    used: z.boolean(),
  }),
  z.object({
    action: z.literal("append"),
    codes: z.array(z.string().trim().min(1).max(128)).min(1).max(100),
  }),
  z.object({
    action: z.literal("replace"),
    codes: z.array(z.string().trim().min(1).max(128)).min(1).max(100),
  }),
]);

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getVaultSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid entry ID." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = codeActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid security code action." },
      { status: 400 }
    );
  }

  const { vaultItems } = await getVaultCollections();
  const oid = new ObjectId(id);
  const existing = await vaultItems.findOne({
    _id: oid,
    ownerUserId: ctx.userId,
  });

  if (!existing) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  const prevCodes: StoredSecurityCode[] = Array.isArray(existing.securityCodes)
    ? (existing.securityCodes as StoredSecurityCode[])
    : [];

  let nextCodes: StoredSecurityCode[] = prevCodes;

  if (parsed.data.action === "toggle") {
    const { codeId, used } = parsed.data;
    const found = prevCodes.some((c) => String(c.id) === codeId);
    if (!found) {
      return NextResponse.json(
        { error: "Security code not found." },
        { status: 404 }
      );
    }
    nextCodes = prevCodes.map((c) =>
      String(c.id) === codeId
        ? {
            ...c,
            used,
            usedAt: used ? new Date() : null,
          }
        : c
    );
  } else {
    const uniqueFresh = Array.from(
      new Set(parsed.data.codes.map((c) => c.trim()).filter(Boolean))
    );
    const added: StoredSecurityCode[] = uniqueFresh.map((code) => ({
      id: generateCodeId(),
      encryptedCode: encryptSecret(code),
      length: code.length,
      used: false,
      usedAt: null,
    }));

    nextCodes =
      parsed.data.action === "replace"
        ? added
        : [...prevCodes, ...added].slice(0, 150);
  }

  await vaultItems.updateOne(
    { _id: oid, ownerUserId: ctx.userId },
    { $set: { securityCodes: nextCodes, updatedAt: new Date() } }
  );

  const updatedDoc = await vaultItems.findOne({
    _id: oid,
    ownerUserId: ctx.userId,
  });

  return NextResponse.json(
    { ok: true, item: updatedDoc ? serializeVaultDoc(updatedDoc) : null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
