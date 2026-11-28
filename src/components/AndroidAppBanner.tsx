"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Smartphone, X } from "lucide-react";

const DISMISS_KEY = "sse-vault-apk-banner-dismissed-until";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function AndroidAppBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [isAndroidBrowser, setIsAndroidBrowser] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    try {
      const until = Number(window.localStorage.getItem(DISMISS_KEY) || "0");
      if (until > Date.now()) return;
    } catch {
      /* ignore */
    }
    const ua = navigator.userAgent || "";
    setIsAndroidBrowser(/android/i.test(ua));
    setVisible(true);
    fetch("/api/apk/latest")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.release?.version) setVersion(String(d.release.version));
      })
      .catch(() => {});
  }, []);

  if (!visible || pathname === "/apk" || pathname === "/download") return null;

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + SEVEN_DAYS_MS));
    } catch {
      /* ignore */
    }
  }

  return (
    <aside
      aria-label="SSE Vault Android App"
      className="mx-auto mt-3 flex w-[calc(100%-1.75rem)] max-w-6xl items-center justify-between gap-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 sm:w-[calc(100%-3rem)] sm:px-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-zinc-950 shadow-sm">
          <Smartphone className="h-4 w-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="vault-text-primary truncate text-xs font-extrabold">
              {isAndroidBrowser ? "SSE Vault Native Android App" : "Get SSE Vault for Android"}
            </span>
            {version && (
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-500">
                v{version}
              </span>
            )}
          </div>
          <p className="vault-text-muted mt-0.5 truncate text-[11px]">
            Biometric unlock, encrypted offline access, QR scanner &amp; live 2FA.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href="/apk"
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-[11px] font-extrabold text-zinc-950 transition hover:bg-amber-400"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Get APK</span>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss Android app banner"
          className="vault-text-muted rounded-lg p-1.5 hover:bg-amber-500/15 hover:text-amber-500"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}
