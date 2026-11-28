import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import {
  enqueueOfflineOp,
  loadOffline,
  loadOfflineQueue,
  saveOffline,
  saveOfflineQueue,
  type OfflineQueuedOp,
} from "./offline";
import { extractDomainKey, getAppNameForDomain, normalizeWebsiteUrl } from "./lib/domain";
import { clearPendingAutofillSaves, loadPendingAutofillSaves, syncVaultToAutofill, type PendingAutofillSave } from "./autofill";
import type { ItemInput, VaultItem } from "./types";

export interface AppGroup {
  domainKey: string;
  appName: string;
  items: VaultItem[];
}

interface VaultCtx {
  items: VaultItem[];
  groups: AppGroup[];
  loading: boolean;
  syncing: boolean;
  pendingSyncCount: number;
  error: string | null;
  savedAt: number | null;
  pendingAutofillSaves: PendingAutofillSave[];
  dismissPendingAutofillSaves: () => Promise<void>;
  refresh: () => Promise<void>;
  syncQueue: () => Promise<void>;
  createItemSafe: (body: ItemInput) => Promise<VaultItem | null>;
  updateItemSafe: (id: string, body: ItemInput) => Promise<void>;
  toggleCodeSafe: (itemId: string, codeId: string, used: boolean) => Promise<void>;
  deleteItemSafe: (id: string) => Promise<void>;
}

const Ctx = createContext<VaultCtx>(null as unknown as VaultCtx);
export const useVault = () => useContext(Ctx);

function normalizeVaultItem(raw: VaultItem): VaultItem {
  return {
    ...raw,
    entryType: raw.entryType === "note" || raw.entryType === "card" ? raw.entryType : "login",
    securityCodes: Array.isArray(raw.securityCodes) ? raw.securityCodes : [],
    customFields: Array.isArray(raw.customFields) ? raw.customFields : [],
    passwordHistory: Array.isArray(raw.passwordHistory) ? raw.passwordHistory : [],
    cardDetails: raw.cardDetails ?? null,
  };
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { phase, offline, user, pinStatus } = useAuth();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pendingAutofillSaves, setPendingAutofillSaves] = useState<PendingAutofillSave[]>([]);

  const dismissPendingAutofillSaves = useCallback(async () => {
    await clearPendingAutofillSaves();
    setPendingAutofillSaves([]);
  }, []);

  const persistLocalItems = useCallback(
    async (nextItems: VaultItem[]) => {
      setItems(nextItems);
      setSavedAt(Date.now());
      void syncVaultToAutofill(nextItems).catch(() => {});
      await saveOffline({ items: nextItems, user, pinStatus }).catch(() => {});
    },
    [user, pinStatus]
  );

  const syncQueue = useCallback(async () => {
    if (offline) return;
    const queue = await loadOfflineQueue();
    setPendingSyncCount(queue.length);
    if (queue.length === 0) return;

    setSyncing(true);
    const remaining: OfflineQueuedOp[] = [];
    const tempIdMap = new Map<string, string>();
    try {
      for (const op of queue) {
        try {
          if (op.kind === "create") {
            const res = await api.createItem(op.body);
            if (res?.item?.id) tempIdMap.set(op.tempId, res.item.id);
          } else if (op.kind === "update") {
            const targetId = tempIdMap.get(op.itemId) || op.itemId;
            if (!targetId.startsWith("offline_")) {
              await api.updateItem(targetId, op.body);
            }
          } else if (op.kind === "toggleCode") {
            const targetId = tempIdMap.get(op.itemId) || op.itemId;
            if (!targetId.startsWith("offline_")) {
              await api.toggleCode(targetId, op.codeId, op.used);
            }
          } else if (op.kind === "delete") {
            const targetId = tempIdMap.get(op.itemId) || op.itemId;
            if (!targetId.startsWith("offline_")) {
              await api.deleteItem(targetId);
            }
          }
        } catch {
          remaining.push(op);
        }
      }
      await saveOfflineQueue(remaining);
      setPendingSyncCount(remaining.length);
    } finally {
      setSyncing(false);
    }
  }, [offline]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = await loadOfflineQueue();
      setPendingSyncCount(q.length);

      if (offline) {
        const snap = await loadOffline();
        const normalized = (snap?.items ?? []).map(normalizeVaultItem);
        setItems(normalized);
        void syncVaultToAutofill(normalized).catch(() => {});
        setSavedAt(snap?.savedAt ?? null);
        if (!snap) setError("Offline copy is unavailable. Reconnect to load your vault.");
      } else {
        if (q.length > 0) await syncQueue();
        const fresh = (await api.items()).map(normalizeVaultItem);
        setItems(fresh);
        setSavedAt(Date.now());
        void syncVaultToAutofill(fresh).catch(() => {});
        void saveOffline({ items: fresh, user, pinStatus }).catch(() => {});
        void loadPendingAutofillSaves().then(setPendingAutofillSaves).catch(() => {});
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [offline, user, pinStatus, syncQueue]);

  useEffect(() => {
    if (phase === "unlocked") void refresh();
    else setItems([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, offline]);

  const createItemSafe = useCallback(
    async (body: ItemInput): Promise<VaultItem | null> => {
      if (!offline) {
        const res = await api.createItem(body);
        await refresh();
        return res?.item ?? null;
      }
      const tempId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const entryType = body.entryType || "login";
      const cleanUrl = body.url
        ? normalizeWebsiteUrl(body.url)
        : entryType === "note"
          ? "https://secure-note.local"
          : entryType === "card"
            ? "https://payment-cards.local"
            : "";
      const dom =
        extractDomainKey(cleanUrl) ||
        (entryType === "note" ? "secure-note.local" : entryType === "card" ? "payment-cards.local" : "other");
      const appName = getAppNameForDomain(dom);
      const localItem: VaultItem = {
        id: tempId,
        entryType,
        domainKey: dom,
        appName,
        label: body.label?.trim() || appName,
        url: cleanUrl,
        authType: body.authType || "password",
        oauthProvider: body.authType === "oauth" ? body.oauthProvider || "Google" : null,
        oauthProviderDomain: body.authType === "oauth" ? body.oauthProviderDomain || null : null,
        oauthLinkedItemId: body.authType === "oauth" ? body.oauthLinkedItemId || null : null,
        category: body.category || "personal",
        hasPasskey: Boolean(body.hasPasskey),
        email: body.email?.trim() || null,
        username: body.username?.trim() || null,
        password: body.password || null,
        totpSecret: body.totpSecret?.trim() || null,
        securityCodes: (body.securityCodes || []).map((c, idx) => ({
          id: `tmp_${idx}_${Date.now()}`,
          code: c,
          masked: "-".repeat(c.length),
          length: c.length,
          used: false,
          usedAt: null,
          locked: false,
        })),
        customFields: body.customFields || [],
        cardDetails: body.cardDetails || null,
        passwordHistory: [],
        notes: body.notes?.trim() || null,
        favorite: Boolean(body.favorite),
        decryptionStatus: "ok",
        updatedAt: new Date().toISOString(),
      };
      const q = await enqueueOfflineOp({
        id: `op_${Date.now()}`,
        kind: "create",
        tempId,
        body,
        queuedAt: Date.now(),
      });
      setPendingSyncCount(q.length);
      await persistLocalItems([localItem, ...items]);
      return localItem;
    },
    [offline, items, persistLocalItems, refresh]
  );

  const updateItemSafe = useCallback(
    async (id: string, body: ItemInput) => {
      if (!offline) {
        await api.updateItem(id, body);
        await refresh();
        return;
      }
      const q = await enqueueOfflineOp({
        id: `op_${Date.now()}`,
        kind: "update",
        itemId: id,
        body,
        queuedAt: Date.now(),
      });
      setPendingSyncCount(q.length);
      const next = items.map((it) =>
        it.id !== id
          ? it
          : {
              ...it,
              ...(body.entryType !== undefined ? { entryType: body.entryType } : {}),
              ...(body.label !== undefined ? { label: body.label || it.appName } : {}),
              ...(body.email !== undefined ? { email: body.email || null } : {}),
              ...(body.username !== undefined ? { username: body.username || null } : {}),
              ...(body.password !== undefined ? { password: body.password || null } : {}),
              ...(body.totpSecret !== undefined ? { totpSecret: body.totpSecret || null } : {}),
              ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
              ...(body.category !== undefined ? { category: body.category } : {}),
              ...(body.favorite !== undefined ? { favorite: body.favorite } : {}),
              ...(body.hasPasskey !== undefined ? { hasPasskey: body.hasPasskey } : {}),
              ...(body.customFields !== undefined ? { customFields: body.customFields } : {}),
              ...(body.cardDetails !== undefined ? { cardDetails: body.cardDetails } : {}),
              updatedAt: new Date().toISOString(),
            }
      );
      await persistLocalItems(next);
    },
    [offline, items, persistLocalItems, refresh]
  );

  const toggleCodeSafe = useCallback(
    async (itemId: string, codeId: string, used: boolean) => {
      if (!offline) {
        await api.toggleCode(itemId, codeId, used);
        await refresh();
        return;
      }
      const q = await enqueueOfflineOp({
        id: `op_${Date.now()}`,
        kind: "toggleCode",
        itemId,
        codeId,
        used,
        queuedAt: Date.now(),
      });
      setPendingSyncCount(q.length);
      const next = items.map((it) =>
        it.id !== itemId
          ? it
          : {
              ...it,
              securityCodes: it.securityCodes.map((sc) =>
                sc.id !== codeId
                  ? sc
                  : {
                      ...sc,
                      used,
                      usedAt: used ? new Date().toISOString() : null,
                    }
              ),
            }
      );
      await persistLocalItems(next);
    },
    [offline, items, persistLocalItems, refresh]
  );

  const deleteItemSafe = useCallback(
    async (id: string) => {
      if (!offline) {
        await api.deleteItem(id);
        await refresh();
        return;
      }
      const q = await enqueueOfflineOp({
        id: `op_${Date.now()}`,
        kind: "delete",
        itemId: id,
        queuedAt: Date.now(),
      });
      setPendingSyncCount(q.length);
      await persistLocalItems(items.filter((i) => i.id !== id));
    },
    [offline, items, persistLocalItems, refresh]
  );

  const groups = useMemo<AppGroup[]>(() => {
    const map = new Map<string, AppGroup>();
    for (const i of items) {
      const key = i.domainKey || "other";
      const g = map.get(key) || { domainKey: key, appName: i.appName || key, items: [] };
      g.items.push(i);
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => a.appName.localeCompare(b.appName));
  }, [items]);

  return (
    <Ctx.Provider
      value={{
        items,
        groups,
        loading,
        syncing,
        pendingSyncCount,
        error,
        savedAt,
        pendingAutofillSaves,
        dismissPendingAutofillSaves,
        refresh,
        syncQueue,
        createItemSafe,
        updateItemSafe,
        toggleCodeSafe,
        deleteItemSafe,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
