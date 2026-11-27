import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { loadOffline, saveOffline } from "./offline";
import type { VaultItem } from "./types";

export interface AppGroup {
  domainKey: string;
  appName: string;
  items: VaultItem[];
}

interface VaultCtx {
  items: VaultItem[];
  groups: AppGroup[];
  loading: boolean;
  error: string | null;
  savedAt: number | null;
  refresh: () => Promise<void>;
}
const Ctx = createContext<VaultCtx>(null as unknown as VaultCtx);
export const useVault = () => useContext(Ctx);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { phase, offline, user, pinStatus } = useAuth();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (offline) {
        const snap = await loadOffline();
        setItems(snap?.items ?? []);
        setSavedAt(snap?.savedAt ?? null);
        if (!snap) setError("Offline copy is unavailable. Reconnect to load your vault.");
      } else {
        const fresh = await api.items();
        setItems(fresh);
        setSavedAt(Date.now());
        // Keep the encrypted offline copy current.
        void saveOffline({ items: fresh, user, pinStatus }).catch(() => {});
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [offline, user, pinStatus]);

  useEffect(() => {
    if (phase === "unlocked") void refresh();
    else setItems([]); // never keep decrypted secrets in memory while locked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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

  return <Ctx.Provider value={{ items, groups, loading, error, savedAt, refresh }}>{children}</Ctx.Provider>;
}
