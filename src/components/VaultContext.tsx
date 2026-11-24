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
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import type {
  VaultAppGroupSummary,
  VaultCategory,
  VaultItemDTO,
} from "@/lib/vault-types";

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

export interface ClientPinStatus {
  hasPin: boolean;
  unlocked: boolean;
  autoLockMinutes: number;
  failedAttempts: number;
  lockedUntil: string | null;
}

interface ModalRequest {
  open: boolean;
  editingItem: VaultItemDTO | null;
  lockedDomain: string | null;
}

interface VaultContextValue {
  user: VaultUser | null;
  authLoading: boolean;
  pinStatus: ClientPinStatus | null;
  isVaultUnlocked: boolean;
  setPinStatus: (next: ClientPinStatus | null) => void;
  lockVault: () => Promise<void>;
  items: VaultItemDTO[];
  vaultLoading: boolean;
  vaultError: string | null;
  activeKeyFingerprint: string | null;
  storesHexcodeInDb: boolean;
  recoveredCount: number;
  lockedCount: number;
  appGroups: VaultAppGroupSummary[];
  privacyBlur: boolean;
  setPrivacyBlur: (val: boolean | ((prev: boolean) => boolean)) => void;
  clipboardAutoClear: boolean;
  setClipboardAutoClear: (val: boolean) => void;
  lockOnBackground: boolean;
  setLockOnBackground: (val: boolean) => void;
  clipboardCountdown: number;
  copySensitiveText: (value: string, label: string) => Promise<void>;
  spotlightOpen: boolean;
  setSpotlightOpen: (val: boolean) => void;
  modal: ModalRequest;
  openAddModal: (lockedDomain?: string | null) => void;
  openEditModal: (item: VaultItemDTO, lockedDomain?: string | null) => void;
  closeModal: () => void;
  importExportModal: { open: boolean; tab: "import" | "export" };
  openImportExportModal: (tab?: "import" | "export") => void;
  closeImportExportModal: () => void;
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
  const [pinStatus, setPinStatus] = useState<ClientPinStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [items, setItems] = useState<VaultItemDTO[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [activeKeyFingerprint, setActiveKeyFingerprint] = useState<string | null>(
    null
  );
  const [storesHexcodeInDb, setStoresHexcodeInDb] = useState(true);

  const [privacyBlur, setPrivacyBlur] = useState(false);
  const [clipboardAutoClear, setClipboardAutoClearState] = useState(true);
  const [lockOnBackground, setLockOnBackgroundState] = useState(false);
  const [clipboardCountdown, setClipboardCountdown] = useState(0);

  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [modal, setModal] = useState<ModalRequest>({
    open: false,
    editingItem: null,
    lockedDomain: null,
  });
  const [importExportModal, setImportExportModal] = useState<{
    open: boolean;
    tab: "import" | "export";
  }>({ open: false, tab: "import" });

  const [toast, setToast] = useState<string | null>(null);

  const inflightAuthRef = useRef<Promise<VaultUser | null> | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const clipTimerRef = useRef<number | null>(null);

  const isVaultUnlocked = Boolean(
    user && pinStatus?.hasPin && pinStatus?.unlocked
  );

  useEffect(() => {
    const savedClip = window.localStorage.getItem("sse-vault-clip-clear");
    if (savedClip === "false") setClipboardAutoClearState(false);
    const savedBlur = window.localStorage.getItem("sse-vault-blur");
    if (savedBlur === "true") setPrivacyBlur(true);
    const savedBgLock = window.localStorage.getItem("sse-vault-bg-lock");
    if (savedBgLock === "true") setLockOnBackgroundState(true);
  }, []);

  const setClipboardAutoClear = useCallback((val: boolean) => {
    setClipboardAutoClearState(val);
    window.localStorage.setItem("sse-vault-clip-clear", String(val));
  }, []);

  const setLockOnBackground = useCallback((val: boolean) => {
    setLockOnBackgroundState(val);
    window.localStorage.setItem("sse-vault-bg-lock", String(val));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3200);
  }, []);

  const copySensitiveText = useCallback(
    async (value: string, label: string) => {
      try {
        await navigator.clipboard.writeText(value);
        showToast(
          clipboardAutoClear
            ? `${label} copied · auto-clears in 30s`
            : `${label} copied to clipboard.`
        );
        if (clipTimerRef.current) {
          window.clearInterval(clipTimerRef.current);
          clipTimerRef.current = null;
        }
        if (clipboardAutoClear) {
          setClipboardCountdown(30);
          clipTimerRef.current = window.setInterval(() => {
            setClipboardCountdown((prev) => {
              if (prev <= 1) {
                if (clipTimerRef.current) {
                  window.clearInterval(clipTimerRef.current);
                  clipTimerRef.current = null;
                }
                navigator.clipboard.writeText("").catch(() => {});
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      } catch {
        showToast(`Could not copy ${label}.`);
      }
    },
    [clipboardAutoClear, showToast]
  );

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
          pinStatus?: ClientPinStatus | null;
        };
        const nextUser = d.authenticated && d.user ? d.user : null;
        setUser(nextUser);
        setPinStatus(nextUser ? d.pinStatus || null : null);
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
      if (res.status === 423) {
        const j = await res.json().catch(() => ({}));
        setItems([]);
        setPinStatus((prev) => ({
          hasPin: Boolean(j.hasPin ?? prev?.hasPin),
          unlocked: false,
          autoLockMinutes: prev?.autoLockMinutes ?? 30,
          failedAttempts: prev?.failedAttempts ?? 0,
          lockedUntil: prev?.lockedUntil ?? null,
        }));
        return;
      }
      const j = await res.json();
      if (!res.ok) {
        setVaultError(j.error || "Could not load vault.");
        return;
      }
      setItems(Array.isArray(j.items) ? j.items : []);
      if (typeof j.activeKeyFingerprint === "string") {
        setActiveKeyFingerprint(j.activeKeyFingerprint);
      }
      if (typeof j.storesHexcodeInDb === "boolean") {
        setStoresHexcodeInDb(j.storesHexcodeInDb);
      }
    } catch {
      setVaultError("Network error while syncing vault.");
    } finally {
      setVaultLoading(false);
    }
  }, []);

  const lockVault = useCallback(async () => {
    try {
      await fetch("/api/vault/pin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lock" }),
      });
    } catch {
      // ignore network error; lock UI anyway
    }
    setItems([]);
    setSpotlightOpen(false);
    setModal({ open: false, editingItem: null, lockedDomain: null });
    setImportExportModal({ open: false, tab: "import" });
    setPinStatus((prev) => (prev ? { ...prev, unlocked: false } : prev));
    showToast("Vault locked.");
  }, [showToast]);

  useEffect(() => {
    refreshUser();
  }, [pathname, refreshUser]);

  // Only fetch encrypted vault entries AFTER 6-digit PIN is verified & unlocked!
  useEffect(() => {
    if (!authLoading && isVaultUnlocked) {
      refreshVault();
    } else if (!authLoading && !isVaultUnlocked) {
      setItems([]);
    }
  }, [authLoading, isVaultUnlocked, refreshVault]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isVaultUnlocked) return;
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
  }, [isVaultUnlocked]);

  // Auto-lock on inactivity based on user's configured autoLockMinutes
  useEffect(() => {
    if (!isVaultUnlocked) return;
    const mins = pinStatus?.autoLockMinutes ?? 30;
    if (mins <= 0) return;

    let idleTimer: number | null = null;
    const resetTimer = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        void lockVault();
      }, mins * 60 * 1000);
    };

    resetTimer();
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
    ];
    for (const ev of events) {
      window.addEventListener(ev, resetTimer, { passive: true });
    }
    return () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      for (const ev of events) {
        window.removeEventListener(ev, resetTimer);
      }
    };
  }, [isVaultUnlocked, pinStatus?.autoLockMinutes, lockVault]);

  // Optional immediate lock when switching tabs or minimizing Android APK
  useEffect(() => {
    if (!isVaultUnlocked || !lockOnBackground) return;

    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        void lockVault();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    let removeCapListener: (() => void) | null = null;
    if (Capacitor.isNativePlatform()) {
      void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          void lockVault();
        }
      }).then((handle) => {
        removeCapListener = () => {
          void handle.remove();
        };
      });
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      removeCapListener?.();
    };
  }, [isVaultUnlocked, lockOnBackground, lockVault]);


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
    setPinStatus(null);
    setItems([]);
    setAuthLoading(false);
  }, []);

  const openAddModal = useCallback(
    (lockedDomain: string | null = null) => {
      if (!isVaultUnlocked) return;
      setModal({ open: true, editingItem: null, lockedDomain });
    },
    [isVaultUnlocked]
  );

  const openEditModal = useCallback(
    (item: VaultItemDTO, lockedDomain: string | null = null) => {
      if (!isVaultUnlocked) return;
      setModal({ open: true, editingItem: item, lockedDomain });
    },
    [isVaultUnlocked]
  );

  const closeModal = useCallback(() => {
    setModal({ open: false, editingItem: null, lockedDomain: null });
  }, []);

  const openImportExportModal = useCallback(
    (tab: "import" | "export" = "import") => {
      if (!isVaultUnlocked) return;
      setImportExportModal({ open: true, tab });
    },
    [isVaultUnlocked]
  );

  const closeImportExportModal = useCallback(() => {
    setImportExportModal((prev) => ({ ...prev, open: false }));
  }, []);

  const recoveredCount = useMemo(
    () =>
      items.filter(
        (i) =>
          i.decryptionStatus === "recovered_db_hex" ||
          i.decryptionStatus === "recovered_legacy_env"
      ).length,
    [items]
  );

  const lockedCount = useMemo(
    () => items.filter((i) => i.decryptionStatus === "locked").length,
    [items]
  );

  const appGroups = useMemo<VaultAppGroupSummary[]>(() => {
    const map = new Map<
      string,
      { domainKey: string; appName: string; items: VaultItemDTO[] }
    >();

    for (const item of items) {
      const key = item.domainKey || "other";
      let group = map.get(key);
      if (!group) {
        group = { domainKey: key, appName: item.appName || key, items: [] };
        map.set(key, group);
      }
      group.items.push(item);
    }

    return Array.from(map.values())
      .map((g) => {
        const oauthCount = g.items.filter((i) => i.authType === "oauth").length;
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
        const hasLockedOrRecovered = g.items.some(
          (i) => i.decryptionStatus !== "ok"
        );
        const categories = Array.from(
          new Set(g.items.map((i) => i.category as VaultCategory))
        );
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
          oauthCount,
          totpCount,
          unusedCodesCount,
          totalCodesCount,
          hasFavorite,
          hasLockedOrRecovered,
          categories,
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
        pinStatus,
        isVaultUnlocked,
        setPinStatus,
        lockVault,
        items,
        vaultLoading,
        vaultError,
        activeKeyFingerprint,
        storesHexcodeInDb,
        recoveredCount,
        lockedCount,
        appGroups,
        privacyBlur,
        setPrivacyBlur,
        clipboardAutoClear,
        setClipboardAutoClear,
        lockOnBackground,
        setLockOnBackground,
        clipboardCountdown,
        copySensitiveText,
        spotlightOpen,
        setSpotlightOpen,
        modal,
        openAddModal,
        openEditModal,
        closeModal,
        importExportModal,
        openImportExportModal,
        closeImportExportModal,
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
