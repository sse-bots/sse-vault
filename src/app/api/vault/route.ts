import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUnlockedVaultSession } from "@/lib/vault-pin";
import { getVaultCollections } from "@/lib/mongodb";
import {
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
import type { StoredSecurityCode } from "@/lib/vault-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store" };
const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

const createItemSchema = z.object({
  entryType: z.enum(["login", "note", "card"]).optional().default("login"),
  label: z.string().trim().max(80).optional().default(""),
  url: z.string().trim().max(300).optional().default(""),
  expectedDomain: z.string().trim().max(120).optional(),
  authType: z.enum(["password", "oauth"]).optional().default("password"),
  oauthProvider: z.string().trim().max(60).optional().default(""),
  oauthProviderDomain: z.string().trim().max(120).optional().default(""),
  oauthLinkedItemId: z.string().trim().max(64).optional().default(""),
  category: z
    .enum(["personal", "work", "dev", "gaming", "finance", "social", "other"])
    .optional()
    .default("personal"),
  hasPasskey: z.boolean().optional().default(false),
  email: z.string().trim().max(160).optional().default(""),
  username: z.string().trim().max(120).optional().default(""),
  password: z.string().max(512).optional().default(""),
  totpSecret: z.string().trim().max(512).optional().default(""),
  securityCodes: z
    .array(z.string().trim().min(1).max(128))
    .max(100)
    .optional()
    .default([]),
  customFields: z.array(customFieldSchema).max(30).optional().default([]),
  cardDetails: cardDetailsSchema.nullable().optional().default(null),
  notes: z.string().trim().max(5000).optional().default(""),
  favorite: z.boolean().optional().default(false),
});

export async function GET(req: Request) {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const { searchParams } = new URL(req.url);
  const domainFilter = (searchParams.get("domain") || "").trim().toLowerCase();

  const { vaultItems } = await getVaultCollections();
  const cutoff = new Date(Date.now() - TRASH_TTL_MS);
  await vaultItems
    .deleteMany({ ownerUserId: ctx.userId, deletedAt: { $lte: cutoff } })
    .catch(() => {});

  const docs = await vaultItems
    .find({
      ownerUserId: ctx.userId,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
    .sort({ favorite: -1, updatedAt: -1 })
    .toArray();

  let items = docs.map(serializeVaultDoc);
  if (domainFilter) {
    const normalizedFilter = extractDomainKey(domainFilter) || domainFilter;
    items = items.filter((item) => item.domainKey === normalizedFilter);
  }

  return NextResponse.json(
    {
      items,
      activeKeyFingerprint: getKeyFingerprint(),
      storesHexcodeInDb: shouldStoreHexcodeInDb(),
    },
    { status: 200, headers: NO_CACHE }
  );
}

export async function POST(req: Request) {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const body = await req.json().catch(() => null);
  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid vault item." },
      { status: 400, headers: NO_CACHE }
    );
  }

  const d = parsed.data;
  const entryType = d.entryType;

  let cleanUrl = "";
  let domainKey = "";
  let appName = "";

  if (entryType === "note") {
    cleanUrl = d.url ? normalizeWebsiteUrl(d.url) : "https://secure-note.local";
    domainKey = d.url
      ? extractDomainKey(cleanUrl) || "secure-note.local"
      : "secure-note.local";
    appName = getAppNameForDomain(domainKey);
  } else if (entryType === "card") {
    cleanUrl = d.url ? normalizeWebsiteUrl(d.url) : "https://payment-cards.local";
    domainKey = d.url
      ? extractDomainKey(cleanUrl) || "payment-cards.local"
      : "payment-cards.local";
    appName = getAppNameForDomain(domainKey);
  } else {
    if (!d.url.trim()) {
      return NextResponse.json(
        { error: "Website URL is required." },
        { status: 400, headers: NO_CACHE }
      );
    }
    cleanUrl = normalizeWebsiteUrl(d.url);
    domainKey = extractDomainKey(cleanUrl);
    if (!domainKey) {
      return NextResponse.json(
        { error: "Please enter a valid website URL (e.g. github.com)." },
        { status: 400, headers: NO_CACHE }
      );
    }
    if (d.expectedDomain && !isUrlAllowedForDomain(cleanUrl, d.expectedDomain)) {
      const targetApp = getAppNameForDomain(d.expectedDomain);
      return NextResponse.json(
        {
          error: `Only ${d.expectedDomain} URLs can be added inside ${targetApp}.`,
        },
        { status: 400, headers: NO_CACHE }
      );
    }
    appName = getAppNameForDomain(domainKey);
  }

  if (entryType === "login" && d.authType === "oauth" && !d.email.trim()) {
    return NextResponse.json(
      { error: "Please enter the email address used for OAuth sign-in." },
      { status: 400, headers: NO_CACHE }
    );
  }

  const activeHex = getActiveKeyHex();
  const storeHex = shouldStoreHexcodeInDb();
  const keyFingerprint = getKeyFingerprint(activeHex);

  const uniqueCodes = Array.from(
    new Set(d.securityCodes.map((c) => c.trim()).filter(Boolean))
  );

  const storedCodes: StoredSecurityCode[] = uniqueCodes.map((raw) => ({
    id: generateCodeId(),
    encryptedCode: encryptSecret(raw),
    length: raw.length,
    used: false,
    usedAt: null,
  }));

  const cleanedCustomFields = d.customFields
    .filter((f) => f.label.trim() || f.value.trim())
    .map((f) => ({
      id: f.id || generateCodeId(),
      label: f.label.trim() || "Field",
      value: f.value,
      hidden: Boolean(f.hidden),
    }));

  const isOAuth = entryType === "login" && d.authType === "oauth";
  const now = new Date();
  const doc: Record<string, unknown> = {
    ownerUserId: ctx.userId,
    entryType,
    domainKey,
    appName,
    label: d.label.trim() || appName,
    url: cleanUrl,
    authType: isOAuth ? "oauth" : "password",
    oauthProvider: isOAuth ? d.oauthProvider.trim() || "Google" : null,
    oauthProviderDomain: isOAuth
      ? d.oauthProviderDomain.trim().toLowerCase() ||
        resolveOAuthProviderDomain({
          oauthProvider: d.oauthProvider.trim() || "Google",
          oauthProviderDomain: null,
        }) ||
        null
      : null,
    oauthLinkedItemId:
      isOAuth && d.oauthLinkedItemId.trim()
        ? d.oauthLinkedItemId.trim()
        : null,
    category: d.category,
    hasPasskey: entryType === "login" ? d.hasPasskey : false,
    email: d.email.trim() || null,
    username: isOAuth || entryType !== "login" ? null : d.username.trim() || null,
    encryptedPassword:
      isOAuth || entryType !== "login"
        ? null
        : d.password
          ? encryptSecret(d.password)
          : null,
    encryptedTotpSecret: d.totpSecret.trim()
      ? encryptSecret(d.totpSecret.trim())
      : null,
    securityCodes: storedCodes,
    encryptedCustomFields:
      cleanedCustomFields.length > 0
        ? encryptSecret(JSON.stringify(cleanedCustomFields))
        : null,
    encryptedCardDetails:
      entryType === "card" && d.cardDetails
        ? encryptSecret(JSON.stringify(d.cardDetails))
        : null,
    passwordHistory: [],
    encryptedNotes: d.notes.trim() ? encryptSecret(d.notes.trim()) : null,
    favorite: d.favorite,
    keyFingerprint,
    hexcode: storeHex ? activeHex : null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const { vaultItems } = await getVaultCollections();
  const existingGroupCount = await vaultItems.countDocuments({
    ownerUserId: ctx.userId,
    domainKey,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  });

  const inserted = await vaultItems.insertOne(doc);
  const created = await vaultItems.findOne({ _id: inserted.insertedId });

  return NextResponse.json(
    {
      ok: true,
      addedToExistingGroup: existingGroupCount > 0,
      item: created ? serializeVaultDoc(created) : null,
    },
    { status: 201, headers: NO_CACHE }
  );
}
