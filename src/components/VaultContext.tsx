"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type { VaultAppGroupSummary, VaultItemDTO } from "@/lib/vault-types";

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

interface ModalRequest {
  open: boolean;
  editingItem: VaultItemDTO | null;
  lockedDomain: string | null;
}

interface VaultContextValue {
  user: VaultUser | null;
  authLoading: boolean;
  items: VaultItemDTO[];
  vaultLoading: boolean;
  vaultError: string | null;
  appGroups: VaultAppGroupSummary[];
  privacyBlur: boolean;
  setPrivacyBlur: (val: boolean | ((prev: boolean) => boolean)) => void;
  spotlightOpen: boolean;
  setSpotlightOpen: (val: boolean) => void;
  modal: ModalRequest;
  openAddModal: (lockedDomain?: string | null) => void;
  openEditModal: (item: VaultItemDTO, lockedDomain?: string | null) => void;
  closeModal: () => void;
  refreshUser: () => Promise<VaultUser | null>;
  refreshVault: () => Promise<void>;
  upsertItem: (item: VaultItemDTO) => void;
  removeItem: (id: string) => void;
  clearUser: () => void;
  toast: string | null;
  showToast: (msg: string) => void;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<VaultUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [items, setItems] = useState<VaultItemDTO[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);

  const [privacyBlur, setPrivacyBlur] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [modal, setModal] = useState<ModalRequest>({
    open: false,
    editingItem: null,
    lockedDomain: null,
  });
  const [toast, setToast] = useState<string | null>(null);

  const inflightAuthRef = useRef<Promise<VaultUser | null> | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3200);
  }, []);

  const refreshUser = useCallback(async (): Promise<VaultUser | null> => {
    if (inflightAuthRef.current) return inflightAuthRef.current;

    const promise = (async () => {
      try {
        let res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 400));
          res = await fetch("/api/me", {
            cache: "no-store",
            credentials: "include",
          });
        }
        if (!res.ok) return null;
        const d = (await res.json()) as {
          authenticated?: boolean;
          user?: VaultUser | null;
        };
        const nextUser = d.authenticated && d.user ? d.user : null;
        setUser(nextUser);
        return nextUser;
      } catch {
        return null;
      } finally {
        setAuthLoading(false);
        inflightAuthRef.current = null;
      }
    })();

    inflightAuthRef.current = promise;
    return promise;
  }, []);

  const refreshVault = useCallback(async () => {
    setVaultLoading(true);
    setVaultError(null);
    try {
      const res = await fetch("/api/vault", {
        cache: "no-store",
        credentials: "include",
      });
      if (res.status === 401) {
        setItems([]);
        return;
      }
      const j = await res.json();
      if (!res.ok) {
        setVaultError(j.error || "Could not load vault.");
        return;
      }
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch {
      setVaultError("Network error while syncing vault.");
    } finally {
      setVaultLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [pathname, refreshUser]);

  useEffect(() => {
    if (!authLoading && user) {
      refreshVault();
    } else if (!authLoading && !user) {
      setItems([]);
    }
  }, [authLoading, user, refreshVault]);

  // Global keyboard shortcuts: Ctrl/Cmd+K (Spotlight), Shift+P (Privacy Blur)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSpotlightOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setSpotlightOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const upsertItem = useCallback((saved: VaultItemDTO) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      const next = exists
        ? prev.map((i) => (i.id === saved.id ? saved : i))
        : [saved, ...prev];
      return next.sort(
        (a, b) =>
          Number(b.favorite) - Number(a.favorite) ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearUser = useCallback(() => {
    setUser(null);
    setItems([]);
    setAuthLoading(false);
  }, []);

  const openAddModal = useCallback((lockedDomain: string | null = null) => {
    setModal({ open: true, editingItem: null, lockedDomain });
  }, []);

  const openEditModal = useCallback(
    (item: VaultItemDTO, lockedDomain: string | null = null) => {
      setModal({ open: true, editingItem: item, lockedDomain });
    },
    []
  );

  const closeModal = useCallback(() => {
    setModal({ open: false, editingItem: null, lockedDomain: null });
  }, []);

  // Automatically segregate all vault entries into domain-based App Groups
  const appGroups = useMemo<VaultAppGroupSummary[]>(() => {
    const map = new Map<
      string,
      {
        domainKey: string;
        appName: string;
        items: VaultItemDTO[];
      }
    >();

    for (const item of items) {
      const key = item.domainKey || "other";
      let group = map.get(key);
      if (!group) {
        group = {
          domainKey: key,
          appName: item.appName || key,
          items: [],
        };
        map.set(key, group);
      }
      group.items.push(item);
    }

    return Array.from(map.values())
      .map((g) => {
        const totpCount = g.items.filter((i) => Boolean(i.totpSecret)).length;
        const unusedCodesCount = g.items.reduce(
          (acc, i) => acc + i.securityCodes.filter((c) => !c.used).length,
          0
        );
        const totalCodesCount = g.items.reduce(
          (acc, i) => acc + i.securityCodes.length,
          0
        );
        const hasFavorite = g.items.some((i) => i.favorite);
        const previewIdentities = g.items
          .map((i) => i.email || i.username || i.label)
          .filter(Boolean)
          .slice(0, 2);
        const latestUpdatedAt = g.items.reduce(
          (max, i) => (i.updatedAt > max ? i.updatedAt : max),
          g.items[0]?.updatedAt || ""
        );

        return {
          domainKey: g.domainKey,
          appName: g.appName,
          accountCount: g.items.length,
          totpCount,
          unusedCodesCount,
          totalCodesCount,
          hasFavorite,
          previewIdentities,
          latestUpdatedAt,
        };
      })
      .sort(
        (a, b) =>
          Number(b.hasFavorite) - Number(a.hasFavorite) ||
          b.accountCount - a.accountCount ||
          a.appName.localeCompare(b.appName)
      );
  }, [items]);

  return (
    <VaultContext.Provider
      value={{
        user,
        authLoading,
        items,
        vaultLoading,
        vaultError,
        appGroups,
        privacyBlur,
        setPrivacyBlur,
        spotlightOpen,
        setSpotlightOpen,
        modal,
        openAddModal,
        openEditModal,
        closeModal,
        refreshUser,
        refreshVault,
        upsertItem,
        removeItem,
        clearUser,
        toast,
        showToast,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used inside <VaultProvider>");
  return ctx;
}
