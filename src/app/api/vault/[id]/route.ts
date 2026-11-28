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
import { resolveOAuthProviderDomain } from "@/lib/oauth-links";
import type {
  StoredPasswordHistoryItem,
  StoredSecurityCode,
} from "@/lib/vault-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const customFieldSchema = z.object({
  id: z.string().trim().max(64).optional(),
  label: z.string().trim().max(80),
  value: z.string().max(2000),
  hidden: z.boolean().optional().default(false),
});

const cardDetailsSchema = z.object({
  cardholderName: z.string().trim().max(120).optional().default(""),
  cardNumber: z.string().trim().max(40).optional().default(""),
  expiry: z.string().trim().max(20).optional().default(""),
  cvv: z.string().trim().max(12).optional().default(""),
  billingZip: z.string().trim().max(24).optional().default(""),
});

const updateItemSchema = z.object({
  entryType: z.enum(["login", "note", "card"]).optional(),
  label: z.string().trim().max(80).optional(),
  url: z.string().trim().max(300).optional(),
  expectedDomain: z.string().trim().max(120).optional(),
  authType: z.enum(["password", "oauth"]).optional(),
  oauthProvider: z.string().trim().max(60).optional(),
  oauthProviderDomain: z.string().trim().max(120).optional(),
  oauthLinkedItemId: z.string().trim().max(64).optional(),
  category: z
    .enum(["personal", "work", "dev", "gaming", "finance", "social", "other"])
    .optional(),
  hasPasskey: z.boolean().optional(),
  email: z.string().trim().max(160).optional(),
  username: z.string().trim().max(120).optional(),
  password: z.string().max(512).optional(),
  totpSecret: z.string().trim().max(512).optional(),
  customFields: z.array(customFieldSchema).max(30).optional(),
  cardDetails: cardDetailsSchema.nullable().optional(),
  notes: z.string().trim().max(5000).optional(),
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
  const nextEntryType =
    d.entryType ??
    (existing.entryType === "note" || existing.entryType === "card"
      ? existing.entryType
      : "login");
  updates.entryType = nextEntryType;

  if (d.url !== undefined && d.url.trim()) {
    const cleanUrl = normalizeWebsiteUrl(d.url);
    const domainKey = extractDomainKey(cleanUrl);
    if (!domainKey) {
      return NextResponse.json(
        { error: "Please enter a valid website URL." },
        { status: 400 }
      );
    }
    if (
      nextEntryType === "login" &&
      d.expectedDomain &&
      !isUrlAllowedForDomain(cleanUrl, d.expectedDomain)
    ) {
      const targetApp = getAppNameForDomain(d.expectedDomain);
      return NextResponse.json(
        {
          error: `Only ${d.expectedDomain} URLs are allowed inside ${targetApp}.`,
        },
        { status: 400 }
      );
    }
    updates.url = cleanUrl;
    updates.domainKey = domainKey;
    updates.appName = getAppNameForDomain(domainKey);
  }

  if (d.label !== undefined) {
    updates.label =
      d.label.trim() ||
      String(updates.appName || existing.appName || "Account");
  }

  const nextAuthType =
    nextEntryType === "login"
      ? d.authType ?? (existing.authType === "oauth" ? "oauth" : "password")
      : "password";
  updates.authType = nextAuthType;

  if (
    d.oauthProvider !== undefined ||
    d.oauthProviderDomain !== undefined ||
    d.oauthLinkedItemId !== undefined ||
    d.authType !== undefined ||
    d.entryType !== undefined
  ) {
    if (nextAuthType === "oauth") {
      const nextProv =
        (d.oauthProvider ?? String(existing.oauthProvider || "Google")).trim() ||
        "Google";
      const rawDom =
        d.oauthProviderDomain !== undefined
          ? d.oauthProviderDomain.trim().toLowerCase()
          : typeof existing.oauthProviderDomain === "string"
            ? existing.oauthProviderDomain.trim().toLowerCase()
            : "";
      updates.oauthProvider = nextProv;
      updates.oauthProviderDomain =
        rawDom ||
        resolveOAuthProviderDomain({
          oauthProvider: nextProv,
          oauthProviderDomain: null,
        }) ||
        null;
      if (d.oauthLinkedItemId !== undefined) {
        updates.oauthLinkedItemId = d.oauthLinkedItemId.trim() || null;
      }
    } else {
      updates.oauthProvider = null;
      updates.oauthProviderDomain = null;
      updates.oauthLinkedItemId = null;
    }
  }

  if (d.category !== undefined) updates.category = d.category;
  if (d.hasPasskey !== undefined) updates.hasPasskey = d.hasPasskey;
  if (d.email !== undefined) updates.email = d.email.trim() || null;
  if (d.username !== undefined) {
    updates.username =
      nextAuthType === "oauth" ? null : d.username.trim() || null;
  } else if (nextAuthType === "oauth") {
    updates.username = null;
  }
  if (d.favorite !== undefined) updates.favorite = d.favorite;

  let reencryptedSecretField = false;
  if (nextAuthType === "oauth" || nextEntryType !== "login") {
    updates.encryptedPassword = null;
  } else if (d.password !== undefined) {
    const prevDec = decryptWithFallback(
      existing.encryptedPassword ? String(existing.encryptedPassword) : null,
      existingHex
    );
    const oldPlain = prevDec.value || "";
    if (oldPlain && oldPlain !== d.password) {
      const prevHist: StoredPasswordHistoryItem[] = Array.isArray(
        existing.passwordHistory
      )
        ? (existing.passwordHistory as StoredPasswordHistoryItem[])
        : [];
      updates.passwordHistory = [
        {
          encryptedPassword: encryptSecret(oldPlain),
          changedAt: new Date(),
          hexcode: storeHex ? activeHex : null,
        },
        ...prevHist,
      ].slice(0, 10);
    }

    updates.encryptedPassword = d.password ? encryptSecret(d.password) : null;
    reencryptedSecretField = true;
  }

  if (d.totpSecret !== undefined) {
    updates.encryptedTotpSecret = d.totpSecret.trim()
      ? encryptSecret(d.totpSecret.trim())
      : null;
    reencryptedSecretField = true;
  }
  if (d.notes !== undefined) {
    updates.encryptedNotes = d.notes.trim()
      ? encryptSecret(d.notes.trim())
      : null;
    reencryptedSecretField = true;
  }

  if (d.customFields !== undefined) {
    const cleaned = d.customFields
      .filter((f) => f.label.trim() || f.value.trim())
      .map((f) => ({
        id: f.id || generateCodeId(),
        label: f.label.trim() || "Field",
        value: f.value,
        hidden: Boolean(f.hidden),
      }));
    updates.encryptedCustomFields =
      cleaned.length > 0 ? encryptSecret(JSON.stringify(cleaned)) : null;
    reencryptedSecretField = true;
  }

  if (d.cardDetails !== undefined) {
    updates.encryptedCardDetails =
      nextEntryType === "card" && d.cardDetails
        ? encryptSecret(JSON.stringify(d.cardDetails))
        : null;
    reencryptedSecretField = true;
  }

  const existingCodes: StoredSecurityCode[] = Array.isArray(
    existing.securityCodes
  )
    ? (existing.securityCodes as StoredSecurityCode[])
    : [];

  if (d.securityCodesMode === "replace") {
    const unique = Array.from(
      new Set((d.securityCodes || []).map((c) => c.trim()).filter(Boolean))
    );
    updates.securityCodes = unique.map((raw) => ({
      id: generateCodeId(),
      encryptedCode: encryptSecret(raw),
      length: raw.length,
      used: false,
      usedAt: null,
    }));
    reencryptedSecretField = true;
  } else if (
    d.securityCodesMode === "append" &&
    d.securityCodes &&
    d.securityCodes.length > 0
  ) {
    const existingPlain = new Set<string>();
    for (const sc of existingCodes) {
      const dec = decryptWithFallback(sc.encryptedCode, sc.hexcode || existingHex);
      if (dec.value) existingPlain.add(dec.value);
    }
    const additions: StoredSecurityCode[] = [];
    for (const raw of d.securityCodes) {
      const trimmed = raw.trim();
      if (!trimmed || existingPlain.has(trimmed)) continue;
      existingPlain.add(trimmed);
      additions.push({
        id: generateCodeId(),
        encryptedCode: encryptSecret(trimmed),
        length: trimmed.length,
        used: false,
        usedAt: null,
        hexcode: storeHex ? activeHex : null,
      });
    }
    updates.securityCodes = [...existingCodes, ...additions];
  }

  if (reencryptedSecretField) {
    if (d.password === undefined && existing.encryptedPassword && nextAuthType === "password") {
      const p = decryptWithFallback(String(existing.encryptedPassword), existingHex);
      if (p.value !== null) updates.encryptedPassword = encryptSecret(p.value);
    }
    if (d.totpSecret === undefined && existing.encryptedTotpSecret) {
      const t = decryptWithFallback(String(existing.encryptedTotpSecret), existingHex);
      if (t.value !== null) updates.encryptedTotpSecret = encryptSecret(t.value);
    }
    if (d.notes === undefined && existing.encryptedNotes) {
      const n = decryptWithFallback(String(existing.encryptedNotes), existingHex);
      if (n.value !== null) updates.encryptedNotes = encryptSecret(n.value);
    }
    if (d.customFields === undefined && existing.encryptedCustomFields) {
      const cf = decryptWithFallback(String(existing.encryptedCustomFields), existingHex);
      if (cf.value !== null) updates.encryptedCustomFields = encryptSecret(cf.value);
    }
    if (d.cardDetails === undefined && existing.encryptedCardDetails) {
      const cd = decryptWithFallback(String(existing.encryptedCardDetails), existingHex);
      if (cd.value !== null) updates.encryptedCardDetails = encryptSecret(cd.value);
    }
    if (d.securityCodesMode !== "replace" && existingCodes.length > 0) {
      const sourceList = (updates.securityCodes as StoredSecurityCode[]) || existingCodes;
      updates.securityCodes = sourceList.map((sc) => {
        const dec = decryptWithFallback(sc.encryptedCode, sc.hexcode || existingHex);
        if (dec.value !== null) {
          return { ...sc, encryptedCode: encryptSecret(dec.value), hexcode: null };
        }
        return sc;
      });
    }
    updates.keyFingerprint = getKeyFingerprint(activeHex);
    updates.hexcode = storeHex ? activeHex : null;
  }

  await vaultItems.updateOne({ _id: oid, ownerUserId: ctx.userId }, { $set: updates });
  const updated = await vaultItems.findOne({ _id: oid });

  return NextResponse.json(
    { ok: true, item: updated ? serializeVaultDoc(updated) : null },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(
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

  const { searchParams } = new URL(req.url);
  const permanent = searchParams.get("permanent") === "1";

  const { vaultItems } = await getVaultCollections();
  const oid = new ObjectId(id);

  if (permanent) {
    const res = await vaultItems.deleteOne({
      _id: oid,
      ownerUserId: ctx.userId,
    });
    if (res.deletedCount === 0) {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, permanent: true });
  }

  const res = await vaultItems.updateOne(
    { _id: oid, ownerUserId: ctx.userId },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } }
  );
  if (res.matchedCount === 0) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, trashed: true });
}
