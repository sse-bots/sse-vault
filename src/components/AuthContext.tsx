"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

export interface VaultUser {
  userId: string;
  name: string;
  username: string | null;
  email: string;
  image: string | null;
  discordId: string | null;
  sseRole: string;
  accountsUrl: string;
}

interface AuthContextValue {
  user: VaultUser | null;
  loading: boolean;
  refreshUser: () => Promise<VaultUser | null>;
  clearUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<VaultUser | null>(null);
  const [loading, setLoading] = useState(true);
  const inflightRef = useRef<Promise<VaultUser | null> | null>(null);

  const fetchMeOnce = useCallback(async () => {
    const res = await fetch("/api/me", {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return { ok: false, user: null as VaultUser | null };
    const d = (await res.json()) as {
      authenticated?: boolean;
      user?: VaultUser | null;
    };
    return {
      ok: true,
      user: d.authenticated && d.user ? d.user : null,
    };
  }, []);

  const refreshUser = useCallback(async (): Promise<VaultUser | null> => {
    if (inflightRef.current) return inflightRef.current;

    const promise = (async () => {
      try {
        let result = await fetchMeOnce();
        if (!result.ok) {
          await new Promise((r) => setTimeout(r, 450));
          result = await fetchMeOnce();
        }
        if (result.ok) {
          setUser(result.user);
          return result.user;
        }
        return null;
      } catch {
        return null;
      } finally {
        setLoading(false);
        inflightRef.current = null;
      }
    })();

    inflightRef.current = promise;
    return promise;
  }, [fetchMeOnce]);

  const clearUser = useCallback(() => {
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [pathname, refreshUser]);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, clearUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
