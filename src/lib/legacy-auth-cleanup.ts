import { getDb, getVaultCollections } from "./mongodb";

export const LEGACY_BETTER_AUTH_COLLECTIONS = [
  "session",
  "verification",
  "account",
  "user",
] as const;

export interface LegacyCleanupResult {
  migratedItems: number;
  migratedPins: number;
  droppedCollections: string[];
  remainingLegacyCollections: string[];
}

async function listExistingLegacyCollections(): Promise<string[]> {
  const db = await getDb();
  const cols = await db.listCollections({}, { nameOnly: true }).toArray();
  const names = new Set(cols.map((c) => c.name));
  return LEGACY_BETTER_AUTH_COLLECTIONS.filter((name) => names.has(name));
}

export async function getLegacyBetterAuthCollectionsStatus(): Promise<{
  hasLegacyCollections: boolean;
  collections: string[];
}> {
  try {
    const collections = await listExistingLegacyCollections();
    return {
      hasLegacyCollections: collections.length > 0,
      collections,
    };
  } catch {
    return { hasLegacyCollections: false, collections: [] };
  }
}

/**
 * Migrates ALL legacy Better Auth `ownerUserId` references in `vault_items`
 * and `vault_pin_configs` over to canonical SSE Accounts `sub` IDs, and then
 * drops the unused Better Auth collections (`session`, `verification`, `account`, `user`).
 */
export async function migrateAndDropBetterAuthCollections(currentUser?: {
  sub: string;
  email?: string | null;
}): Promise<LegacyCleanupResult> {
  const existing = await listExistingLegacyCollections();
  if (existing.length === 0) {
    return {
      migratedItems: 0,
      migratedPins: 0,
      droppedCollections: [],
      remainingLegacyCollections: [],
    };
  }

  const { db, vaultItems, vaultPinConfigs } = await getVaultCollections();
  const existingSet = new Set(existing);

  // Build map: legacy Better Auth userId -> canonical SSE Accounts `sub`
  const legacyToSub = new Map<string, string>();

  if (existingSet.has("account")) {
    const accounts = await db.collection("account").find({}).toArray();
    for (const acc of accounts) {
      const accountId =
        typeof acc.accountId === "string" ? acc.accountId.trim() : "";
      const userId = acc.userId ? String(acc.userId).trim() : "";
      if (accountId && userId && userId !== accountId) {
        legacyToSub.set(userId, accountId);
      }
    }
  }

  if (existingSet.has("user") && currentUser?.sub && currentUser.email) {
    const emailLower = currentUser.email.trim().toLowerCase();
    const users = await db.collection("user").find({}).toArray();
    for (const u of users) {
      const uEmail =
        typeof u.email === "string" ? u.email.trim().toLowerCase() : "";
      if (uEmail && uEmail === emailLower) {
        if (u._id) {
          const idStr = String(u._id).trim();
          if (idStr && idStr !== currentUser.sub) {
            legacyToSub.set(idStr, currentUser.sub);
          }
        }
        if (typeof u.id === "string" && u.id.trim() && u.id.trim() !== currentUser.sub) {
          legacyToSub.set(u.id.trim(), currentUser.sub);
        }
      }
    }
  }

  let migratedItems = 0;
  let migratedPins = 0;

  for (const [legacyUserId, canonicalSub] of legacyToSub.entries()) {
    const itemRes = await vaultItems.updateMany(
      { ownerUserId: legacyUserId },
      { $set: { ownerUserId: canonicalSub } }
    );
    migratedItems += itemRes.modifiedCount;

    const existingTargetPin = await vaultPinConfigs.findOne({
      ownerUserId: canonicalSub,
    });
    if (existingTargetPin) {
      await vaultPinConfigs.deleteMany({ ownerUserId: legacyUserId });
    } else {
      const pinRes = await vaultPinConfigs.updateOne(
        { ownerUserId: legacyUserId },
        { $set: { ownerUserId: canonicalSub } }
      );
      migratedPins += pinRes.modifiedCount;
    }
  }

  // Drop all unneeded Better Auth collections from the database
  const droppedCollections: string[] = [];
  for (const colName of existing) {
    try {
      await db.dropCollection(colName);
      droppedCollections.push(colName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("ns not found")) {
        droppedCollections.push(colName);
      } else {
        console.error(`[LegacyCleanup] Failed dropping ${colName}:`, err);
      }
    }
  }

  const remainingLegacyCollections = await listExistingLegacyCollections();
  return {
    migratedItems,
    migratedPins,
    droppedCollections,
    remainingLegacyCollections,
  };
}
