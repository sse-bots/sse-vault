import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getVaultSession } from "@/lib/session";
import { getVaultCollections } from "@/lib/mongodb";
import { encryptSecret, generateCodeId } from "@/lib/crypto";
import {
  extractDomainKey,
  getAppNameForDomain,
  isUrlAllowedForDomain,
  normalizeWebsiteUrl,
} from "@/lib/domain";
import { serializeVaultDoc } from "@/lib/vault-serializer";
import type { StoredSecurityCode } from "@/lib/vault-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateItemSchema = z.object({
  label: z.string().trim().max(80).optional(),
  url: z.string().trim().min(1).max(300).optional(),
  expectedDomain: z.string().trim().max(120).optional(),
  email: z.string().trim().max(160).optional(),
  username: z.string().trim().max(120).optional(),
  password: z.string().max(512).optional(),
  totpSecret: z.string().trim().max(512).optional(),
  notes: z.string().trim().max(1000).optional(),
  favorite: z.boolean().optional(),
  securityCodesMode: z.enum(["keep", "append", "replace"]).optional(),
  securityCodes: z.array(z.string().trim().min(1).max(128)).max(100).optional(),
});

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
  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid update data." },
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

  const d = parsed.data;
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (d.url !== undefined) {
    const cleanUrl = normalizeWebsiteUrl(d.url);
    const domainKey = extractDomainKey(cleanUrl);
    if (!domainKey) {
      return NextResponse.json(
        { error: "Please enter a valid website URL." },
        { status: 400 }
      );
    }
    if (d.expectedDomain && !isUrlAllowedForDomain(cleanUrl, d.expectedDomain)) {
      const expectedKey = extractDomainKey(d.expectedDomain);
      const expectedName = getAppNameForDomain(expectedKey);
      return NextResponse.json(
        {
          error: `Only ${expectedKey} URLs are allowed inside ${expectedName}.`,
        },
        { status: 400 }
      );
    }
    updates.url = cleanUrl;
    updates.domainKey = domainKey;
    updates.appName = getAppNameForDomain(domainKey);
  }

  if (d.label !== undefined) {
    const fallbackApp =
      (updates.appName as string) ||
      String(existing.appName || getAppNameForDomain(extractDomainKey(String(existing.url || ""))));
    updates.label = d.label.trim() || fallbackApp;
  }
  if (d.email !== undefined) updates.email = d.email.trim() || null;
  if (d.username !== undefined) updates.username = d.username.trim() || null;
  if (d.password !== undefined) {
    updates.encryptedPassword = d.password ? encryptSecret(d.password) : null;
  }
  if (d.totpSecret !== undefined) {
    updates.encryptedTotpSecret = d.totpSecret
      ? encryptSecret(d.totpSecret)
      : null;
  }
  if (d.notes !== undefined) {
    updates.encryptedNotes = d.notes ? encryptSecret(d.notes) : null;
  }
  if (d.favorite !== undefined) {
    updates.favorite = d.favorite;
  }

  if (
    d.securityCodes !== undefined &&
    d.securityCodesMode &&
    d.securityCodesMode !== "keep"
  ) {
    const freshUnique = Array.from(
      new Set(d.securityCodes.map((c) => c.trim()).filter(Boolean))
    );
    const newEntries: StoredSecurityCode[] = freshUnique.map((code) => ({
      id: generateCodeId(),
      encryptedCode: encryptSecret(code),
      length: code.length,
      used: false,
      usedAt: null,
    }));

    if (d.securityCodesMode === "replace") {
      updates.securityCodes = newEntries;
    } else if (d.securityCodesMode === "append") {
      const prev: StoredSecurityCode[] = Array.isArray(existing.securityCodes)
        ? (existing.securityCodes as StoredSecurityCode[])
        : [];
      updates.securityCodes = [...prev, ...newEntries].slice(0, 150);
    }
  }

  await vaultItems.updateOne(
    { _id: oid, ownerUserId: ctx.userId },
    { $set: updates }
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

export async function DELETE(
  _req: Request,
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

  const { vaultItems } = await getVaultCollections();
  const res = await vaultItems.deleteOne({
    _id: new ObjectId(id),
    ownerUserId: ctx.userId,
  });

  if (res.deletedCount === 0) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
