"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BellRing,
  CloudOff,
  Download,
  ExternalLink,
  FileDown,
  Fingerprint,
  KeyRound,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { formatApkSize, type ApkReleaseInfo } from "@/lib/apk-release";

const APK_FEATURES = [
  {
    icon: Fingerprint,
    title: "Biometric & 6-Digit PIN Lock",
    desc: "Unlock instantly with Android fingerprint/face ID backed by Keystore SecureStore and auto-lock when minimized.",
  },
  {
    icon: CloudOff,
    title: "Encrypted Offline Access & Sync",
    desc: "AES-256-CTR + HMAC local cache lets you view, add, edit, and consume backup keys offline and auto-syncs online.",
  },
  {
    icon: QrCode,
    title: "Camera & Gallery QR TOTP Scanner",
    desc: "Scan authenticator QR codes with your camera or upload a QR screenshot for instant SHA-1, SHA-256, and SHA-512 TOTP.",
  },
  {
    icon: BellRing,
    title: "Built-in Release Updates",
    desc: "Checks official SSE Vault releases automatically and alerts you in-app whenever a newer signed APK is ready.",
  },
];

const INSTALL_STEPS = [
  {
    step: "01",
    title: "Download the Official APK",
    desc: "Tap Download Android APK above to save the signed native SSE Vault installer directly to your phone.",
  },
  {
    step: "02",
    title: "Allow Install Unknown Apps",
    desc: "Open the downloaded .apk file from Downloads. If Android prompts, enable 'Allow from this source' for your browser.",
  },
  {
    step: "03",
    title: "Install & Unlock with SSE",
    desc: "Launch SSE Vault, sign in with SSE Accounts SSO, and unlock with your 6-digit Vault PIN or biometrics.",
  },
];

export function ApkDownloadView({ initialRelease }: { initialRelease: ApkReleaseInfo }) {
  const release = initialRelease;
  const primaryDownloadUrl = release.apkUrl || release.releaseUrl;
  const formattedSize = formatApkSize(release.apkSizeBytes);
  const publishedDate = release.publishedAt
    ? new Date(release.publishedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/" className="vault-text-muted inline-flex items-center gap-1.5 text-xs font-bold hover:text-amber-500">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to SSE Vault
      </Link>

      <section className="vault-card relative overflow-hidden rounded-3xl p-6 sm:p-9">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-[11px] font-extrabold text-amber-500">
                <Smartphone className="h-3.5 w-3.5" />
                Native Android App
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
              <h1 className="vault-text-primary text-2xl font-black tracking-tight sm:text-4xl">SSE Vault for Android</h1>
              <p className="vault-text-secondary max-w-xl text-xs leading-relaxed sm:text-sm">
                Full native Android app with fingerprint unlock, encrypted offline access with auto-sync, camera &amp; gallery QR TOTP setup, two-way OAuth linking, and screenshot protection.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href={primaryDownloadUrl}
                target={primaryDownloadUrl.startsWith("/") ? undefined : "_blank"}
                rel={primaryDownloadUrl.startsWith("/") ? undefined : "noreferrer"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3.5 text-sm font-extrabold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {release.apkUrl ? `Download APK${release.version ? ` (v${release.version})` : ""}` : "Download from GitHub Releases"}
              </a>

              {!release.isPrivateProxied && (
                <a
                  href={release.releasesListUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="vault-inset vault-text-primary inline-flex w-full items-center justify-center gap-1.5 rounded-2xl px-4 py-3.5 text-xs font-bold transition hover:border-amber-500 hover:text-amber-500 sm:w-auto"
                >
                  All Releases on GitHub
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <div className="vault-text-muted flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 font-mono text-[11px]">
              <span>Package: com.sse.vault</span>
              <span>Android 8.0+</span>
              {publishedDate && <span>Released {publishedDate}</span>}
              {release.downloadCount > 0 && <span>{release.downloadCount.toLocaleString()} downloads</span>}
            </div>
          </div>

          <div className="vault-inset hidden shrink-0 flex-col items-center justify-center rounded-3xl p-6 text-center md:flex md:w-48">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 shadow-xl shadow-amber-500/25">
              <KeyRound className="h-8 w-8" />
            </div>
            <div className="vault-text-primary mt-3 text-sm font-black">SSE Vault</div>
            <div className="vault-text-muted mt-0.5 font-mono text-[10px]">{release.apkName || "SSE-Vault.apk"}</div>
            <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-500">
              <Sparkles className="h-3 w-3" />
              Native · Signed
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {APK_FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="vault-card rounded-3xl p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="vault-text-primary text-sm font-extrabold">{f.title}</h2>
              <p className="vault-text-muted mt-1 text-xs leading-relaxed">{f.desc}</p>
            </div>
          );
        })}
      </section>

      <section className="vault-card space-y-4 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <FileDown className="h-5 w-5 text-amber-500" />
          <h2 className="vault-text-primary text-base font-extrabold">How to Install on Android</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {INSTALL_STEPS.map((s) => (
            <div key={s.step} className="vault-inset rounded-2xl p-4">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 font-mono text-xs font-black text-zinc-950">
                {s.step}
              </span>
              <h3 className="vault-text-primary mt-3 text-xs font-extrabold">{s.title}</h3>
              <p className="vault-text-muted mt-1 text-[11px] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {release.changelog && (
        <section className="vault-card space-y-3 rounded-3xl p-5 sm:p-6">
          <h2 className="vault-text-primary text-base font-extrabold">
            What&apos;s New in {release.releaseName || `v${release.version}`}
          </h2>
          <pre className="vault-inset vault-text-secondary overflow-x-auto whitespace-pre-wrap rounded-2xl p-4 font-sans text-xs leading-relaxed">
            {release.changelog}
          </pre>
        </section>
      )}

      <section className="vault-inset flex items-start gap-3 rounded-2xl p-4 text-xs">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <p className="vault-text-secondary leading-relaxed">
          <strong>Official Build Only:</strong> Signed APKs are compiled directly via GitHub Actions from <code>{release.repo}</code> with screenshot protection and Android Keystore encryption enabled.
        </p>
      </section>
    </div>
  );
}
