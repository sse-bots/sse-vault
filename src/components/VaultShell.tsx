"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  LayoutGrid,
  Lock,
  LogIn,
  LogOut,
  Moon,
  Plus,
  Scale,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sun,
} from "lucide-react";
import { useVault } from "@/components/VaultContext";
import { VaultItemModal } from "@/components/VaultItemModal";
import { VaultImportExportModal } from "@/components/VaultImportExportModal";
import { VaultPinGate } from "@/components/VaultPinGate";
import { SpotlightModal } from "@/components/SpotlightModal";
import { Capacitor } from "@capacitor/core";
import { AndroidUpdateNotice } from "@/components/AndroidUpdateNotice";
import { AndroidAppBanner } from "@/components/AndroidAppBanner";
import { ThemeCustomizer } from "@/components/ThemeCustomizer";
import {
  DEFAULT_THEME_STATE,
  ThemeState,
  applyThemeToDocument,
  loadSavedTheme,
  saveThemeState,
} from "@/lib/theme-config";

const ACCOUNTS_URL = (
  process.env.NEXT_PUBLIC_SSE_ACCOUNTS_URL || "https://sse-account.vercel.app"
).replace(/\/+$/, "");

export function VaultShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    user,
    authLoading,
    isVaultUnlocked,
    lockVault,
    privacyBlur,
    setPrivacyBlur,
    clipboardCountdown,
    lockedCount,
    recoveredCount,
    setSpotlightOpen,
    modal,
    openAddModal,
    importExportModal,
    clearUser,
    toast,
  } = useVault();

  const [theme, setTheme] = useState<ThemeState>(DEFAULT_THEME_STATE);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);

  useEffect(() => {
    setIsNativeApp(Capacitor.isNativePlatform());
    const initial = loadSavedTheme();
    setTheme(initial);
    applyThemeToDocument(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function onSystemChange() {
      const latest = loadSavedTheme();
      if (latest.mode === "system") applyThemeToDocument(latest);
    }
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  useEffect(() => {
    setUserMenuOpen(false);
  }, [pathname]);

  function updateTheme(next: ThemeState) {
    setTheme(next);
    saveThemeState(next);
    applyThemeToDocument(next);
  }

  function quickToggleMode() {
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const effectiveDark =
      theme.mode === "dark" || (theme.mode === "system" && prefersDark);
    updateTheme({ ...theme, mode: effectiveDark ? "light" : "dark" });
  }

  async function handleSignOut() {
    setUserMenuOpen(false);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    } finally {
      clearUser();
      window.location.assign("/");
    }
  }

  const isVaultRoute = pathname === "/vault" || pathname.startsWith("/vault/");
  const mustShowPinGate = Boolean(
    !authLoading && user && isVaultRoute && !isVaultUnlocked
  );

  const currentLockedDomain = (() => {
    if (!pathname.startsWith("/vault/")) return null;
    const seg = pathname.slice("/vault/".length).split("/")[0];
    if (
      !seg ||
      seg === "authenticator" ||
      seg === "health" ||
      seg === "settings"
    ) {
      return null;
    }
    try {
      return decodeURIComponent(seg);
    } catch {
      return seg;
    }
  })();

  const isAppsActive =
    pathname === "/vault" ||
    (pathname.startsWith("/vault/") &&
      !pathname.startsWith("/vault/authenticator") &&
      !pathname.startsWith("/vault/health") &&
      !pathname.startsWith("/vault/settings"));

  const hasKeyAlert = lockedCount > 0 || recoveredCount > 0;

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-clip">
      {/* Rock-Solid Fixed Sticky Header (never scrolls away on Mobile, Android APK, or Desktop!) */}
      <header className="vault-header vault-app-header">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6">
          {/* Brand */}
          <Link
            href={user ? "/vault" : "/"}
            className="flex min-w-0 items-center gap-2 sm:gap-2.5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 shadow-md shadow-amber-500/25 sm:h-9 sm:w-9">
              <KeyRound className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="vault-text-primary flex items-center gap-1.5 text-sm font-black tracking-tight">
                <span className="truncate">SSE Vault</span>
                <span className="hidden rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-amber-500 sm:inline">
                  PIN + AES
                </span>
              </div>
              <div className="vault-text-muted hidden text-[10px] font-medium min-[380px]:block">
                Passwords · TOTP · Keys
              </div>
            </div>
          </Link>

          {/* Desktop Center Pill Navigation */}
          {isVaultUnlocked && (
            <nav className="vault-inset hidden items-center gap-1 rounded-full p-1 md:flex">
              <Link
                href="/vault"
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  isAppsActive
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "vault-text-secondary hover:text-amber-500"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Apps
              </Link>
              <Link
                href="/vault/authenticator"
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  pathname.startsWith("/vault/authenticator")
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "vault-text-secondary hover:text-amber-500"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                2FA Codes
              </Link>
              <Link
                href="/vault/health"
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  pathname.startsWith("/vault/health")
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "vault-text-secondary hover:text-amber-500"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Health
              </Link>
              <Link
                href="/vault/settings"
                className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  pathname.startsWith("/vault/settings")
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "vault-text-secondary hover:text-amber-500"
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
                {hasKeyAlert && (
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                )}
              </Link>
            </nav>
          )}

          {/* Right Action Controls */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {isVaultUnlocked && (
              <>
                <button
                  type="button"
                  onClick={() => setSpotlightOpen(true)}
                  title="Search Vault (Ctrl+K)"
                  className="vault-inset vault-text-muted inline-flex items-center gap-2 rounded-xl p-2 text-xs font-medium transition hover:border-amber-500/50 hover:text-amber-500 sm:px-3"
                >
                  <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden lg:inline">Search...</span>
                  <kbd className="vault-card hidden rounded px-1.5 py-0.5 font-mono text-[10px] lg:inline">
                    ⌘K
                  </kbd>
                </button>

                <button
                  type="button"
                  onClick={() => setPrivacyBlur((v) => !v)}
                  title={privacyBlur ? "Unblur Secrets" : "Privacy Blur"}
                  className={`hidden rounded-xl border p-2 transition min-[400px]:inline-flex ${
                    privacyBlur
                      ? "border-amber-500 bg-amber-500/15 text-amber-500"
                      : "vault-inset vault-text-muted hover:text-amber-500"
                  }`}
                >
                  {privacyBlur ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={lockVault}
                  title="Lock Vault Now (Require 6-Digit PIN)"
                  className="vault-inset vault-text-muted rounded-xl p-2 transition hover:border-rose-500/50 hover:text-rose-500"
                >
                  <Lock className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => openAddModal(currentLockedDomain)}
                  className="hidden items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-extrabold text-zinc-950 shadow-sm transition hover:bg-amber-400 sm:inline-flex"
                >
                  <Plus className="h-4 w-4" />
                  New Entry
                </button>
              </>
            )}

            {/* Quick Android APK Pill (shown on Web so users always see there's an app) */}
            {!isNativeApp && (
              <Link
                href="/apk"
                title="Download SSE Vault Android APK"
                className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-extrabold transition ${
                  pathname === "/apk"
                    ? "border-amber-500 bg-amber-500/15 text-amber-500"
                    : "vault-inset vault-text-secondary hover:border-amber-500/60 hover:text-amber-500"
                }`}
              >
                <Download className="h-3.5 w-3.5 text-amber-500" />
                <span className="hidden sm:inline">APK</span>
              </Link>
            )}

            {/* Full Multi-Color Vault Theme Customizer */}
            <ThemeCustomizer theme={theme} onChange={updateTheme} />

            {/* Quick Light / Dark Mode Switch */}
            <button
              type="button"
              onClick={quickToggleMode}
              aria-label="Toggle Light/Dark Mode"
              className="vault-inset vault-text-secondary hidden rounded-xl p-2 transition hover:border-amber-500/50 min-[360px]:inline-flex"
            >
              {theme.mode === "light" ? (
                <Moon className="h-4 w-4 text-amber-500" />
              ) : (
                <Sun className="h-4 w-4 text-amber-400" />
              )}
            </button>

            {authLoading ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-500/20 sm:h-9 sm:w-9" />
            ) : user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-amber-500/50 bg-amber-500/15 text-xs font-extrabold text-amber-500 sm:h-9 sm:w-9"
                >
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image}
                      alt={user.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    user.name.slice(0, 2).toUpperCase()
                  )}
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="animate-vault-modal vault-card absolute right-0 top-11 z-50 w-60 rounded-2xl p-2 shadow-2xl">
                      <div className="vault-divider border-b px-3 py-2.5">
                        <div className="vault-text-primary truncate text-xs font-bold">
                          {user.name}
                        </div>
                        <div className="vault-text-muted truncate text-[11px]">
                          {user.email}
                        </div>
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {isVaultUnlocked && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setPrivacyBlur((v) => !v);
                                setUserMenuOpen(false);
                              }}
                              className="vault-text-secondary flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium hover:bg-amber-500/10 min-[400px]:hidden"
                            >
                              {privacyBlur ? (
                                <Eye className="h-3.5 w-3.5 text-amber-500" />
                              ) : (
                                <EyeOff className="h-3.5 w-3.5" />
                              )}
                              {privacyBlur ? "Unblur Secrets" : "Privacy Blur"}
                            </button>
                            <Link
                              href="/vault/settings"
                              className="vault-text-secondary flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium hover:bg-amber-500/10"
                            >
                              <Settings className="h-3.5 w-3.5" />
                              Vault Settings &amp; PIN
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setUserMenuOpen(false);
                                lockVault();
                              }}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-amber-500 hover:bg-amber-500/10"
                            >
                              <Lock className="h-3.5 w-3.5" />
                              Lock Vault Now
                            </button>
                          </>
                        )}
                        <Link
                          href="/apk"
                          className="vault-text-secondary flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold hover:bg-amber-500/10"
                        >
                          <span className="flex items-center gap-2">
                            <Smartphone className="h-3.5 w-3.5 text-amber-500" />
                            Android APK App
                          </span>
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-500">
                            APK
                          </span>
                        </Link>
                        <a
                          href={`${ACCOUNTS_URL}/account`}
                          target="_blank"
                          rel="noreferrer"
                          className="vault-text-secondary flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium hover:bg-amber-500/10"
                        >
                          <span>SSE Accounts Profile</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <div className="vault-divider my-1 border-t" />
                        <Link
                          href="/privacy"
                          className="vault-text-muted flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-medium hover:bg-amber-500/10"
                        >
                          <Scale className="h-3.5 w-3.5" />
                          Privacy Policy
                        </Link>
                        <Link
                          href="/terms"
                          className="vault-text-muted flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-medium hover:bg-amber-500/10"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Terms of Service
                        </Link>
                        <div className="vault-divider my-1 border-t" />
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Sign Out of Vault
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-extrabold text-zinc-950 hover:bg-amber-400"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Content Wrapper offset cleanly below the Fixed Header */}
      <div className="vault-shell-body flex flex-1 flex-col">
        <AndroidUpdateNotice />
        <AndroidAppBanner />

        {/* Main Content — Strictly blocked behind 6-Digit PIN Gate on ALL /vault/* routes! */}
        <main className="vault-main-content mx-auto w-full max-w-6xl flex-1 min-w-0 px-3.5 pb-24 pt-5 sm:px-6 sm:pt-7 md:pb-10">
          {mustShowPinGate ? <VaultPinGate /> : children}
        </main>
      </div>

      {/* Footer */}
      <footer className="vault-divider hidden border-t py-5 md:block">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-xs">
          <span className="vault-text-muted">
            © {new Date().getFullYear()} SSE Vault · Protected by 6-Digit PIN &amp;
            AES-256-GCM
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/apk"
              className="font-bold text-amber-500 hover:underline"
            >
              Android APK
            </Link>
            <Link
              href="/privacy"
              className="vault-text-muted font-medium hover:text-amber-500"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="vault-text-muted font-medium hover:text-amber-500"
            >
              Terms of Service
            </Link>
            <a
              href={ACCOUNTS_URL}
              target="_blank"
              rel="noreferrer"
              className="vault-text-muted inline-flex items-center gap-1 font-medium hover:text-amber-500"
            >
              SSE Accounts
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>

      {/* Native 5-Slot Mobile Bottom Tab Bar */}
      {isVaultUnlocked && (
        <nav
          aria-label="Vault navigation"
          className="vault-bottom-bar vault-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 px-1.5 py-1.5 md:hidden"
        >
          <Link
            href="/vault"
            className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-bold ${
              isAppsActive ? "text-amber-500" : "vault-text-muted"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Apps</span>
          </Link>

          <Link
            href="/vault/authenticator"
            className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-bold ${
              pathname.startsWith("/vault/authenticator")
                ? "text-amber-500"
                : "vault-text-muted"
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>2FA</span>
          </Link>

          <button
            type="button"
            onClick={() => openAddModal(currentLockedDomain)}
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-extrabold text-amber-500"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/25">
              <Plus className="h-4 w-4" />
            </span>
            <span>Add</span>
          </button>

          <Link
            href="/vault/health"
            className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-bold ${
              pathname.startsWith("/vault/health")
                ? "text-amber-500"
                : "vault-text-muted"
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Health</span>
          </Link>

          <Link
            href="/vault/settings"
            className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-bold ${
              pathname.startsWith("/vault/settings")
                ? "text-amber-500"
                : "vault-text-muted"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
            {hasKeyAlert && (
              <span className="absolute right-4 top-1 h-2 w-2 rounded-full bg-rose-500" />
            )}
          </Link>
        </nav>
      )}

      {/* Toast & Clipboard Auto-Clear */}
      {(toast || clipboardCountdown > 0) && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-[70] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-1.5 px-4 md:bottom-6">
          {toast && (
            <div className="animate-vault-modal vault-card pointer-events-auto flex items-center gap-2 rounded-full border-emerald-500/40 px-4 py-2 text-xs font-bold shadow-2xl">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="vault-text-primary truncate">{toast}</span>
            </div>
          )}
          {clipboardCountdown > 0 && !toast && (
            <div className="vault-card pointer-events-auto rounded-full px-3.5 py-1 font-mono text-[10px] font-bold text-amber-500 shadow-lg">
              Clipboard clears in {clipboardCountdown}s
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {isVaultUnlocked && modal.open && <VaultItemModal />}
      {isVaultUnlocked && importExportModal.open && <VaultImportExportModal />}
      {isVaultUnlocked && <SpotlightModal />}
    </div>
  );
}
