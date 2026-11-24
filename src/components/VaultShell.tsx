"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LayoutGrid,
  LogIn,
  LogOut,
  Moon,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sun,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { useVault } from "@/components/VaultContext";
import { VaultItemModal } from "@/components/VaultItemModal";
import { SpotlightModal } from "@/components/SpotlightModal";

const ACCOUNTS_URL = (
  process.env.NEXT_PUBLIC_SSE_ACCOUNTS_URL || "https://sse-account.vercel.app"
).replace(/\/+$/, "");

export function VaultShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    user,
    authLoading,
    privacyBlur,
    setPrivacyBlur,
    setSpotlightOpen,
    modal,
    openAddModal,
    clearUser,
    toast,
  } = useVault();

  const [mode, setMode] = useState<"dark" | "light">("dark");
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("sse-vault-mode");
    const initial: "dark" | "light" = saved === "light" ? "light" : "dark";
    setMode(initial);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(initial);
  }, []);

  useEffect(() => {
    setUserMenuOpen(false);
  }, [pathname]);

  function toggleMode() {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    window.localStorage.setItem("sse-vault-mode", next);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(next);
  }

  async function handleSignOut() {
    setUserMenuOpen(false);
    try {
      await signOut();
    } finally {
      clearUser();
      window.location.assign("/");
    }
  }

  // Detect if user is currently inside a domain page (/vault/[domain]) so "+ Add" locks to that app!
  const currentLockedDomain = (() => {
    if (!pathname.startsWith("/vault/")) return null;
    const seg = pathname.slice("/vault/".length).split("/")[0];
    if (!seg || seg === "authenticator" || seg === "health") return null;
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
      !pathname.startsWith("/vault/health"));

  return (
    <div className="flex min-h-screen flex-col">
      {/* Sticky Frosted Top Command Bar */}
      <header className="vault-header sticky top-0 z-40 h-16">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          {/* Left: Distinct Titanium-Gold Vault Brand */}
          <Link href={user ? "/vault" : "/"} className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 shadow-md shadow-amber-500/25">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="vault-text-primary flex items-center gap-1.5 text-sm font-black tracking-tight">
                <span>SSE Vault</span>
                <span className="hidden rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-amber-500 sm:inline">
                  AES-256
                </span>
              </div>
              <div className="vault-text-muted text-[10px] font-medium">
                Passwords · TOTP · Keys
              </div>
            </div>
          </Link>

          {/* Center (Desktop): Pill Segmented Navigation */}
          {user && (
            <nav className="vault-inset hidden items-center gap-1 rounded-full p-1 md:flex">
              <Link
                href="/vault"
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
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
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
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
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  pathname.startsWith("/vault/health")
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "vault-text-secondary hover:text-amber-500"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Security Check
              </Link>
            </nav>
          )}

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {user && (
              <>
                <button
                  type="button"
                  onClick={() => setSpotlightOpen(true)}
                  title="Search Vault (Ctrl+K)"
                  className="vault-inset vault-text-muted inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium transition hover:border-amber-500/50 hover:text-amber-500 sm:px-3"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">Search...</span>
                  <kbd className="vault-card hidden rounded px-1.5 py-0.5 font-mono text-[10px] lg:inline">
                    ⌘K
                  </kbd>
                </button>

                <button
                  type="button"
                  onClick={() => setPrivacyBlur((v) => !v)}
                  title={privacyBlur ? "Disable Privacy Blur" : "Blur All Secrets"}
                  className={`rounded-xl border p-2 transition ${
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
                  onClick={() => openAddModal(currentLockedDomain)}
                  className="hidden items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-extrabold text-zinc-950 shadow-sm transition hover:bg-amber-400 sm:inline-flex"
                >
                  <Plus className="h-4 w-4" />
                  New Entry
                </button>
              </>
            )}

            <button
              type="button"
              onClick={toggleMode}
              aria-label="Toggle Light/Dark Mode"
              className="vault-inset vault-text-secondary rounded-xl p-2 transition hover:border-amber-500/50"
            >
              {mode === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-amber-600" />
              )}
            </button>

            {authLoading ? (
              <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-500/20" />
            ) : user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-amber-500/50 bg-amber-500/15 text-xs font-extrabold text-amber-500"
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
                      <div className="mt-1 space-y-1">
                        <a
                          href={`${ACCOUNTS_URL}/account`}
                          target="_blank"
                          rel="noreferrer"
                          className="vault-text-secondary flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium hover:bg-amber-500/10"
                        >
                          <span>SSE Accounts Profile</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
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
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-extrabold text-zinc-950 hover:bg-amber-400"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-12 lg:pt-8">
        {children}
      </main>

      {/* Native Mobile Bottom Tab Bar (distinct from floating Find|Menu dock!) */}
      {user && (
        <nav className="vault-bottom-bar fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 px-2 py-1.5 md:hidden">
          <Link
            href="/vault"
            className={`flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-bold ${
              isAppsActive ? "text-amber-500" : "vault-text-muted"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Apps</span>
          </Link>

          <Link
            href="/vault/authenticator"
            className={`flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-bold ${
              pathname.startsWith("/vault/authenticator")
                ? "text-amber-500"
                : "vault-text-muted"
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>2FA Codes</span>
          </Link>

          <Link
            href="/vault/health"
            className={`flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-bold ${
              pathname.startsWith("/vault/health")
                ? "text-amber-500"
                : "vault-text-muted"
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Health</span>
          </Link>

          <button
            type="button"
            onClick={() => openAddModal(currentLockedDomain)}
            className="flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-extrabold text-amber-500"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-zinc-950">
              <Plus className="h-3.5 w-3.5" />
            </span>
            <span>Add</span>
          </button>
        </nav>
      )}

      {/* Global Toast Notification */}
      {toast && (
        <div className="animate-vault-modal fixed bottom-20 left-1/2 z-[70] -translate-x-1/2 md:bottom-6">
          <div className="vault-card flex items-center gap-2 rounded-full border-emerald-500/40 px-4 py-2 text-xs font-bold shadow-2xl">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="vault-text-primary">{toast}</span>
          </div>
        </div>
      )}

      {/* Global Modals */}
      {modal.open && <VaultItemModal />}
      <SpotlightModal />
    </div>
  );
}
