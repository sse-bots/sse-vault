"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  Home,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { useAuth } from "@/components/AuthContext";
import { ThemeCustomizer } from "@/components/ThemeCustomizer";
import {
  DEFAULT_THEME_STATE,
  PRIMARY_COLORS,
  THEME_PRESETS,
  ThemeState,
  applyThemeToDocument,
  loadSavedTheme,
  saveThemeState,
} from "@/lib/theme-config";

const ACCOUNTS_URL = (
  process.env.NEXT_PUBLIC_SSE_ACCOUNTS_URL || "https://sse-account.vercel.app"
).replace(/\/+$/, "");

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading, clearUser } = useAuth();
  const [dockOpen, setDockOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeState>(DEFAULT_THEME_STATE);

  useEffect(() => {
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
    setDockOpen(false);
  }, [pathname]);

  function updateTheme(next: ThemeState) {
    setTheme(next);
    saveThemeState(next);
    applyThemeToDocument(next);
  }

  async function handleSignOut() {
    setDockOpen(false);
    try {
      await signOut();
    } finally {
      clearUser();
      window.location.assign("/");
    }
  }

  const navLinks = [
    { href: "/", label: "Overview", icon: Home, exact: true },
    ...(user
      ? [{ href: "/vault", label: "My Vault", icon: KeyRound, exact: false }]
      : [{ href: "/sign-in", label: "Sign In", icon: LogIn, exact: true }]),
  ];

  const activePrimaryColor =
    PRIMARY_COLORS.find((c) => c.id === theme.primary) || PRIMARY_COLORS[6];
  const activePresetLabel =
    THEME_PRESETS.find((p) => p.id === theme.preset)?.label || "Default";

  function renderNavLink(
    href: string,
    label: string,
    Icon: typeof Home,
    exact: boolean
  ) {
    const active = exact
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        key={href}
        href={href}
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
          active
            ? "bg-indigo-600/20 text-indigo-300"
            : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 lg:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-800/80 lg:bg-[#0a0d14]">
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-extrabold text-white shadow-lg shadow-indigo-500/25">
              <Lock className="h-4 w-4" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-bold text-white">
                SSE Vault
              </div>
              <div className="truncate text-[11px] text-slate-400">
                TOTP &amp; Security Keys
              </div>
            </div>
          </Link>

          <ThemeCustomizer theme={theme} onChange={updateTheme} align="left" />
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          <div>
            <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Vault
            </div>
            <nav className="space-y-1">
              {navLinks.map((l) =>
                renderNavLink(l.href, l.label, l.icon, l.exact)
              )}
            </nav>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              AES-256-GCM Vault
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Passwords, TOTP secrets &amp; recovery codes are encrypted at rest.
              Uploaded <code>.txt</code> files are parsed in memory and never
              stored.
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-800/80 p-3">
          <a
            href={`${ACCOUNTS_URL}/account`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-indigo-400"
          >
            SSE Accounts SSO
            <ExternalLink className="h-3 w-3" />
          </a>

          {authLoading ? (
            <div className="h-11 animate-pulse rounded-xl bg-slate-800/70" />
          ) : user ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-2">
              <div className="flex min-w-0 items-center gap-2.5">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt={user.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-white">
                    {user.name}
                  </div>
                  <div className="truncate text-[10px] text-slate-400">
                    {user.email}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-300"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              <LogIn className="h-4 w-4" />
              Sign in with SSE
            </Link>
          )}
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-800/80 bg-[#0a0d14]/85 px-4 backdrop-blur-md lg:hidden">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
              <Lock className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-tight text-white">
                SSE Vault
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: activePrimaryColor.c500 }}
                />
                <span>{user ? user.name : activePresetLabel}</span>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeCustomizer
              theme={theme}
              onChange={updateTheme}
              align="right"
            />
            <button
              type="button"
              onClick={() =>
                updateTheme({
                  ...theme,
                  mode: theme.mode === "light" ? "dark" : "light",
                })
              }
              aria-label="Toggle theme mode"
              className="rounded-xl border border-slate-800 bg-slate-900/90 p-2 text-slate-200 transition hover:border-indigo-500 active:scale-95"
            >
              {theme.mode === "light" ? (
                <Moon className="h-4 w-4 text-indigo-400" />
              ) : (
                <Sun className="h-4 w-4 text-amber-400" />
              )}
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-14 lg:pt-8">
          {children}
        </main>
      </div>

      {/* Mobile Menu Sheet */}
      {dockOpen && (
        <div className="animate-backdrop-in fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-sm lg:hidden">
          <div className="flex-1" onClick={() => setDockOpen(false)} />
          <div className="animate-sheet-up max-h-[82vh] overflow-y-auto rounded-t-3xl border-t border-slate-800 bg-[#0b0e16] px-4 pb-24 pt-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-700" />

            <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-3.5 py-2.5">
              <div className="text-xs font-bold text-white">
                SSE Vault · {activePresetLabel}
              </div>
              <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900 p-0.5">
                <button
                  type="button"
                  onClick={() => updateTheme({ ...theme, mode: "light" })}
                  className={`rounded-lg p-1.5 ${
                    theme.mode === "light"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400"
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateTheme({ ...theme, mode: "dark" })}
                  className={`rounded-lg p-1.5 ${
                    theme.mode === "dark"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400"
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateTheme({ ...theme, mode: "system" })}
                  className={`rounded-lg p-1.5 ${
                    theme.mode === "system"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-white">
                  {user ? user.name : "Not signed in"}
                </div>
                <div className="truncate text-[11px] text-slate-400">
                  {user ? user.email : "Sign in via SSE Accounts"}
                </div>
              </div>
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </button>
              ) : (
                <Link
                  href="/sign-in"
                  className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white"
                >
                  Sign In
                </Link>
              )}
            </div>

            <div className="space-y-1">
              {navLinks.map((l) =>
                renderNavLink(l.href, l.label, l.icon, l.exact)
              )}
              <a
                href={`${ACCOUNTS_URL}/account`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/70"
              >
                <ExternalLink className="h-4 w-4" />
                SSE Accounts
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Dock */}
      <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 lg:hidden">
        <div className="flex items-center rounded-2xl border border-slate-700/80 bg-[#111520]/95 p-1.5 shadow-[0_10px_35px_rgba(0,0,0,0.65)] backdrop-blur-md">
          <Link
            href={user ? "/vault" : "/sign-in"}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800/80"
          >
            <KeyRound className="h-3.5 w-3.5 text-indigo-400" />
            <span>{user ? "Vault" : "Sign In"}</span>
          </Link>
          <div className="mx-1 h-5 w-px bg-slate-700/80" />
          <button
            type="button"
            onClick={() => setDockOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800/80"
          >
            {dockOpen ? (
              <X className="h-4 w-4 text-rose-400" />
            ) : (
              <Menu className="h-4 w-4 text-indigo-400" />
            )}
            <span>Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
