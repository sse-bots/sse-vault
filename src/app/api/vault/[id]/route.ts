import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireUnlockedVaultSession } from "@/lib/vault-pin";
import { getVaultCollections } from "@/lib/mongodb";
import {
  decryptWithFallback,
  encryptSecret,
  generateCodeId,
  getActiveKeyHex,
  getKeyFingerprint,
  shouldStoreHexcodeInDb,
} from "@/lib/crypto";
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
  authType: z.enum(["password", "oauth"]).optional(),
  oauthProvider: z.string().trim().max(60).optional(),
  category: z
    .enum(["personal", "work", "dev", "gaming", "finance", "social", "other"])
    .optional(),
  hasPasskey: z.boolean().optional(),
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
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

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
  const activeHex = getActiveKeyHex();
  const storeHex = shouldStoreHexcodeInDb();
  const existingHex =
    typeof existing.hexcode === "string" ? existing.hexcode : null;

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
      String(
        existing.appName ||
          getAppNameForDomain(extractDomainKey(String(existing.url || "")))
      );
    updates.label = d.label.trim() || fallbackApp;
  }

  const nextAuthType =
    d.authType ?? (existing.authType === "oauth" ? "oauth" : "password");
  if (d.authType !== undefined) updates.authType = nextAuthType;
  if (d.oauthProvider !== undefined || d.authType !== undefined) {
    updates.oauthProvider =
      nextAuthType === "oauth"
        ? (d.oauthProvider ?? String(existing.oauthProvider || "Google")).trim() || "Google"
        : null;
  }
  if (d.category !== undefined) updates.category = d.category;
  if (d.hasPasskey !== undefined) updates.hasPasskey = d.hasPasskey;
  if (d.email !== undefined) updates.email = d.email.trim() || null;

  if (nextAuthType === "oauth") {
    updates.username = null;
    updates.encryptedPassword = null;
  } else {
    if (d.username !== undefined) updates.username = d.username.trim() || null;
    if (d.password !== undefined) {
      updates.encryptedPassword = d.password ? encryptSecret(d.password) : null;
    }
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

  // Handle security codes updates cleanly
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
      ...(storeHex ? { hexcode: activeHex } : {}),
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

  // Whenever secret fields are edited, also re-seal any remaining untouched secret fields with the active key
  const editedSecrets =
    d.password !== undefined ||
    d.totpSecret !== undefined ||
    d.notes !== undefined ||
    (d.securityCodesMode && d.securityCodesMode !== "keep");

  if (editedSecrets) {
    if (nextAuthType !== "oauth" && d.password === undefined && existing.encryptedPassword) {
      const dec = decryptWithFallback(String(existing.encryptedPassword), existingHex);
      if (dec.value !== null && dec.source !== "primary") {
        updates.encryptedPassword = encryptSecret(dec.value);
      }
    }
    if (d.totpSecret === undefined && existing.encryptedTotpSecret) {
      const dec = decryptWithFallback(String(existing.encryptedTotpSecret), existingHex);
      if (dec.value !== null && dec.source !== "primary") {
        updates.encryptedTotpSecret = encryptSecret(dec.value);
      }
    }
    if (d.notes === undefined && existing.encryptedNotes) {
      const dec = decryptWithFallback(String(existing.encryptedNotes), existingHex);
      if (dec.value !== null && dec.source !== "primary") {
        updates.encryptedNotes = encryptSecret(dec.value);
      }
    }
    updates.keyFingerprint = getKeyFingerprint(activeHex);
    if (storeHex) updates.hexcode = activeHex;
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
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

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
