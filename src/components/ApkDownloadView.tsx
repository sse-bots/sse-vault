"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Download,
  ExternalLink,
  FileDown,
  KeyRound,
  Lock,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { formatApkSize, type ApkReleaseInfo } from "@/lib/apk-release";

function parseVer(v: string): number[] {
  return v
    .trim()
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .slice(0, 3)
    .map((p) => Number.parseInt(p, 10) || 0);
}

function isNewer(latest: string, installed: string): boolean {
  const a = parseVer(latest);
  const b = parseVer(installed);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

const APK_FEATURES = [
  {
    icon: Lock,
    title: "Lock on App Switch",
    desc: "Automatically locks your 6-digit Vault PIN the moment you minimize or switch away from the Android app.",
  },
  {
    icon: KeyRound,
    title: "Instant 2FA & Keys",
    desc: "Copy live 30-second TOTP codes and tap Use Next Key to consume backup recovery keys in one touch.",
  },
  {
    icon: BellRing,
    title: "Built-in Update Alerts",
    desc: "Checks official GitHub releases automatically and notifies you inside the app whenever a new APK drops.",
  },
  {
    icon: ShieldCheck,
    title: "Synced AES-256 Vault",
    desc: "Signs in with SSE Accounts SSO and stays 100% synced with your encrypted web vault in real time.",
  },
];

const INSTALL_STEPS = [
  {
    step: "01",
    title: "Download the Official APK",
    desc: "Tap the Download Android APK button above to save the signed SSE Vault installer directly from GitHub Releases.",
  },
  {
    step: "02",
    title: "Allow Install Unknown Apps",
    desc: "Open the downloaded .apk file from your Downloads notification. If Android prompts, enable 'Allow from this source' for your browser.",
  },
  {
    step: "03",
    title: "Install & Unlock with SSE",
    desc: "Tap Install, launch SSE Vault from your home screen, sign in with SSE Accounts, and enter your 6-digit Vault PIN.",
  },
];

export function ApkDownloadView({
  initialRelease,
}: {
  initialRelease: ApkReleaseInfo;
}) {
  const [release] = useState<ApkReleaseInfo>(initialRelease);
  const [nativeState, setNativeState] = useState<{
    isNativeAndroid: boolean;
    installedVersion: string | null;
  }>({ isNativeAndroid: false, installedVersion: null });
  const [openingDownload, setOpeningDownload] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }
    void App.getInfo()
      .then((info) => {
        setNativeState({
          isNativeAndroid: true,
          installedVersion: info.version || "1.0.0",
        });
      })
      .catch(() => {
        setNativeState({ isNativeAndroid: true, installedVersion: "1.0.0" });
      });
  }, []);

  const primaryDownloadUrl = release.apkUrl || release.releaseUrl;
  const formattedSize = formatApkSize(release.apkSizeBytes);
  const publishedDate = release.publishedAt
    ? new Date(release.publishedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const hasUpdate = Boolean(
    nativeState.isNativeAndroid &&
      nativeState.installedVersion &&
      release.version &&
      isNewer(release.version, nativeState.installedVersion)
  );

  async function handleDownloadClick() {
    if (!nativeState.isNativeAndroid) {
      window.open(primaryDownloadUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setOpeningDownload(true);
    try {
      await Browser.open({ url: primaryDownloadUrl });
    } catch {
      window.open(primaryDownloadUrl, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningDownload(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/"
        className="vault-text-muted inline-flex items-center gap-1.5 text-xs font-bold hover:text-amber-500"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to SSE Vault
      </Link>

      {/* Hero Download Card */}
      <section className="vault-card relative overflow-hidden rounded-3xl p-6 sm:p-9">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-[11px] font-extrabold text-amber-500">
                <Smartphone className="h-3.5 w-3.5" />
                Official Android App
              </span>
              {release.version && (
                <span className="vault-inset vault-text-primary rounded-full px-2.5 py-1 font-mono text-[11px] font-bold">
                  v{release.version}
                </span>
              )}
              {formattedSize && (
                <span className="vault-inset vault-text-muted rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold">
                  {formattedSize}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <h1 className="vault-text-primary text-2xl font-black tracking-tight sm:text-4xl">
                SSE Vault for Android
              </h1>
              <p className="vault-text-secondary max-w-xl text-xs leading-relaxed sm:text-sm">
                Carry your encrypted passwords, live 2FA TOTP codes, and
                single-use backup security keys right on your Android home
                screen — protected by your 6-digit Vault PIN and SSE Accounts.
              </p>
            </div>

            {/* Native App Installed Banner */}
            {nativeState.isNativeAndroid && (
              <div
                className={`inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-bold ${
                  hasUpdate
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                }`}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  {hasUpdate
                    ? `Installed v${nativeState.installedVersion} — v${release.version} update is ready!`
                    : `Running native Android APK (v${nativeState.installedVersion}) — you are up to date.`}
                </span>
              </div>
            )}

            {/* Primary & Secondary CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                disabled={openingDownload}
                onClick={handleDownloadClick}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3.5 text-sm font-extrabold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:opacity-60 sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {openingDownload
                  ? "Opening Download..."
                  : release.apkUrl
                    ? `Download APK${release.version ? ` (v${release.version})` : ""}`
                    : "Download from GitHub Releases"}
              </button>

              <a
                href={release.releasesListUrl}
                target="_blank"
                rel="noreferrer"
                className="vault-inset vault-text-primary inline-flex w-full items-center justify-center gap-1.5 rounded-2xl px-4 py-3.5 text-xs font-bold transition hover:border-amber-500 hover:text-amber-500 sm:w-auto"
              >
                All Releases on GitHub
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Metadata Footnote */}
            <div className="vault-text-muted flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 font-mono text-[11px]">
              <span>Package: com.sse.vault</span>
              <span>Android 8.0+</span>
              {publishedDate && <span>Released {publishedDate}</span>}
              {release.downloadCount > 0 && (
                <span>{release.downloadCount.toLocaleString()} downloads</span>
              )}
            </div>
          </div>

          {/* Visual Android App Badge */}
          <div className="vault-inset hidden shrink-0 flex-col items-center justify-center rounded-3xl p-6 text-center md:flex md:w-48">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 shadow-xl shadow-amber-500/25">
              <KeyRound className="h-8 w-8" />
            </div>
            <div className="vault-text-primary mt-3 text-sm font-black">
              SSE Vault
            </div>
            <div className="vault-text-muted mt-0.5 font-mono text-[10px]">
              {release.apkName || "sse-vault.apk"}
            </div>
            <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-500">
              <Sparkles className="h-3 w-3" />
              HTTPS · Signed
            </span>
          </div>
        </div>
      </section>

      {/* Why Use the Android APK */}
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {APK_FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="vault-card rounded-3xl p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="vault-text-primary text-sm font-extrabold">
                {f.title}
              </h2>
              <p className="vault-text-muted mt-1 text-xs leading-relaxed">
                {f.desc}
              </p>
            </div>
          );
        })}
      </section>

      {/* 3-Step Installation Guide */}
      <section className="vault-card space-y-4 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <FileDown className="h-5 w-5 text-amber-500" />
          <h2 className="vault-text-primary text-base font-extrabold">
            How to Install on Android
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {INSTALL_STEPS.map((s) => (
            <div key={s.step} className="vault-inset rounded-2xl p-4">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 font-mono text-xs font-black text-zinc-950">
                {s.step}
              </span>
              <h3 className="vault-text-primary mt-3 text-xs font-extrabold">
                {s.title}
              </h3>
              <p className="vault-text-muted mt-1 text-[11px] leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Latest Release Notes */}
      {release.changelog && (
        <section className="vault-card space-y-3 rounded-3xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="vault-text-primary text-base font-extrabold">
              What&apos;s New in {release.releaseName || `v${release.version}`}
            </h2>
            <a
              href={release.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 hover:underline"
            >
              View Release
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <pre className="vault-inset vault-text-secondary overflow-x-auto whitespace-pre-wrap rounded-2xl p-4 font-sans text-xs leading-relaxed">
            {release.changelog}
          </pre>
        </section>
      )}

      {/* Trust & Verification Note */}
      <section className="vault-inset flex items-start gap-3 rounded-2xl p-4 text-xs">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <p className="vault-text-secondary leading-relaxed">
          <strong>Official Build Only:</strong> SSE Vault Android APKs are built
          automatically via GitHub Actions from{" "}
          <a
            href={`https://github.com/${release.repo}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono font-bold text-amber-500 hover:underline"
          >
            github.com/{release.repo}
          </a>{" "}
          and connect strictly over HTTPS (`cleartext: false`).
        </p>
      </section>
    </div>
  );
}
