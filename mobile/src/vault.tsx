import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import type { VaultItem } from "./types";

interface VaultCtx {
  items: VaultItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
const Ctx = createContext<VaultCtx>(null as unknown as VaultCtx);
export const useVault = () => useContext(Ctx);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { phase } = useAuth();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.items());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (phase === "unlocked") void refresh();
    else setItems([]); // never keep decrypted secrets in memory while locked
  }, [phase, refresh]);

  return <Ctx.Provider value={{ items, loading, error, refresh }}>{children}</Ctx.Provider>;
}
