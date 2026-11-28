import { headers } from "next/headers";
import { getVaultCollections } from "./mongodb";
import type { VaultActivityDTO } from "./vault-types";

export type VaultActivityEvent =
  | "sign_in"
  | "pin_setup"
  | "pin_unlock"
  | "pin_failed"
  | "pin_change"
  | "pin_reset"
  | "security_questions"
  | "webauthn_register"
  | "webauthn_unlock"
  | "export"
  | "share_created"
  | "trash_empty"
  | "auto_categorize"
  | "reencrypt";

export const ACTIVITY_RETENTION_SECONDS = 24 * 60 * 60; // 24 hours
const ACTIVITY_RETENTION_MS = ACTIVITY_RETENTION_SECONDS * 1000;

let ttlIndexReady: Promise<void> | null = null;

async function ensureActivityTtlIndex(): Promise<void> {
  if (!ttlIndexReady) {
    ttlIndexReady = (async () => {
      try {
        const { vaultActivityLogs } = await getVaultCollections();
        await vaultActivityLogs.createIndex(
          { createdAt: 1 },
          {
            name: "vault_activity_ttl_24h",
            expireAfterSeconds: ACTIVITY_RETENTION_SECONDS,
          }
        );
      } catch {
        // Ignore if index already exists with same key
      }
    })();
  }
  await ttlIndexReady;
}

export async function purgeExpiredVaultActivities(): Promise<void> {
  try {
    await ensureActivityTtlIndex();
    const { vaultActivityLogs } = await getVaultCollections();
    const cutoff = new Date(Date.now() - ACTIVITY_RETENTION_MS);
    await vaultActivityLogs.deleteMany({ createdAt: { $lte: cutoff } });
  } catch {
    /* non-fatal */
  }
}

export async function logVaultActivity(
  ownerUserId: string,
  event: VaultActivityEvent,
  label: string
): Promise<void> {
  try {
    let client: "web" | "native" = "web";
    let userAgent: string | null = null;
    try {
      const h = await headers();
      if (h.get("x-sse-client") === "native") client = "native";
      const ua = h.get("user-agent");
      if (ua) userAgent = ua.slice(0, 140);
    } catch {
      /* ignore */
    }

    await ensureActivityTtlIndex();
    const { vaultActivityLogs } = await getVaultCollections();
    const now = new Date();
    const cutoff = new Date(now.getTime() - ACTIVITY_RETENTION_MS);

    await vaultActivityLogs.insertOne({
      ownerUserId,
      event,
      label,
      client,
      userAgent,
      createdAt: now,
    });

    // Immediately clean up any activities older than 24 hours across the collection
    await vaultActivityLogs.deleteMany({ createdAt: { $lte: cutoff } });

    // Also cap at latest 50 events within the 24h window per user
    const oldDocs = await vaultActivityLogs
      .find({ ownerUserId })
      .sort({ createdAt: -1 })
      .skip(50)
      .project({ _id: 1 })
      .toArray();
    if (oldDocs.length > 0) {
      await vaultActivityLogs.deleteMany({
        _id: { $in: oldDocs.map((d) => d._id) },
      });
    }
  } catch {
    /* non-fatal */
  }
}

export async function getRecentVaultActivity(
  ownerUserId: string,
  limit = 30
): Promise<VaultActivityDTO[]> {
  await purgeExpiredVaultActivities();
  const { vaultActivityLogs } = await getVaultCollections();
  const cutoff = new Date(Date.now() - ACTIVITY_RETENTION_MS);
  const docs = await vaultActivityLogs
    .find({ ownerUserId, createdAt: { $gte: cutoff } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return docs.map((d) => ({
    id: String(d._id),
    event: String(d.event || "activity"),
    label: String(d.label || ""),
    client: d.client === "native" ? "native" : "web",
    userAgent: typeof d.userAgent === "string" ? d.userAgent : null,
    createdAt: d.createdAt
      ? new Date(d.createdAt as string | Date).toISOString()
      : new Date().toISOString(),
  }));
}
