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
  | "webauthn_register"
  | "webauthn_unlock"
  | "export"
  | "share_created"
  | "trash_empty"
  | "reencrypt";

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

    const { vaultActivityLogs } = await getVaultCollections();
    await vaultActivityLogs.insertOne({
      ownerUserId,
      event,
      label,
      client,
      userAgent,
      createdAt: new Date(),
    });

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
  const { vaultActivityLogs } = await getVaultCollections();
  const docs = await vaultActivityLogs
    .find({ ownerUserId })
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
