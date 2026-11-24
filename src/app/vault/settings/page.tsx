"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
} from "lucide-react";
import { useVault } from "@/components/VaultContext";

const PASSPHRASE_WORDS = [
  "amber",
  "cobalt",
  "falcon",
  "orbit",
  "cipher",
  "quartz",
  "prism",
  "velvet",
  "zenith",
  "summit",
  "nova",
  "titan",
  "spruce",
  "ember",
  "lunar",
  "beacon",
  "vortex",
  "atlas",
  "harbor",
  "matrix",
  "pulse",
  "cedar",
  "spark",
  "delta",
];

function buildRandomPassword(len: number, symbols: boolean): string {
  const base = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pool = symbols ? `${base}!@#$%^&*-_+=?` : base;
  const arr = new Uint32Array(len);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, (n) => pool[n % pool.length]).join("");
}

function buildPassphrase(): string {
  const arr = new Uint32Array(4);
  window.crypto.getRandomValues(arr);
  const words = Array.from(
    arr,
    (n) => PASSPHRASE_WORDS[n % PASSPHRASE_WORDS.length]
  );
  const num = (arr[0] % 90) + 10;
  return `${words[0]}-${words[1]}-${num}-${words[2]}-${words[3]}`;
}

export default function VaultSettingsPage() {
  const {
    user,
    authLoading,
    pinStatus,
    setPinStatus,
    lockVault,
    items,
    activeKeyFingerprint,
    storesHexcodeInDb,
    recoveredCount,
    lockedCount,
    clipboardAutoClear,
    setClipboardAutoClear,
    lockOnBackground,
    setLockOnBackground,
    privacyBlur,
    setPrivacyBlur,
    openImportExportModal,
    refreshVault,
    showToast,
    copySensitiveText,
  } = useVault();

  // Change 6-Digit PIN State
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // Key Recovery & Re-Encryption State
  const [oldHexKey, setOldHexKey] = useState("");
  const [reencryptBusy, setReencryptBusy] = useState(false);
  const [reencryptMsg, setReencryptMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // Built-in Generator State
  const [genMode, setGenMode] = useState<"random" | "passphrase">("random");
  const [genLength, setGenLength] = useState(20);
  const [genSymbols, setGenSymbols] = useState(true);
  const [generated, setGenerated] = useState(() =>
    typeof window !== "undefined" ? buildRandomPassword(20, true) : ""
  );
  const [copiedGen, setCopiedGen] = useState(false);
  const [platformInfo, setPlatformInfo] = useState<{
    native: boolean;
    version: string | null;
  }>({ native: false, version: null });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void CapacitorApp.getInfo()
      .then((info) => {
        setPlatformInfo({ native: true, version: info.version || "1.0.0" });
      })
      .catch(() => {
        setPlatformInfo({ native: true, version: "1.0.0" });
      });
  }, []);

  function regenerate(mode = genMode, len = genLength, sym = genSymbols) {
    setGenerated(
      mode === "passphrase" ? buildPassphrase() : buildRandomPassword(len, sym)
    );
  }

  async function handleCopyGenerated() {
    if (!generated) return;
    await copySensitiveText(generated, "Generated password");
    setCopiedGen(true);
    window.setTimeout(() => setCopiedGen(false), 1500);
  }

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(currentPin) || !/^\d{6}$/.test(newPin)) {
      setPinMsg({ type: "err", text: "PINs must be exactly 6 digits." });
      return;
    }
    if (newPin !== confirmPin) {
      setPinMsg({ type: "err", text: "New PIN and confirmation do not match." });
      return;
    }

    setPinBusy(true);
    setPinMsg(null);
    try {
      const res = await fetch("/api/vault/pin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change",
          currentPin,
          newPin,
          confirmPin,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setPinMsg({ type: "err", text: j.error || "Could not update PIN." });
        return;
      }
      if (j.pinStatus) setPinStatus(j.pinStatus);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setPinMsg({
        type: "ok",
        text: "6-digit Vault PIN updated! Other devices will need to enter the new PIN.",
      });
      showToast("6-digit Vault PIN updated.");
    } finally {
      setPinBusy(false);
    }
  }

  async function handleAutoLockChange(minutes: number) {
    const res = await fetch("/api/vault/pin", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preferences", autoLockMinutes: minutes }),
    });
    if (res.ok) {
      const j = await res.json();
      if (j.pinStatus) setPinStatus(j.pinStatus);
      showToast(
        minutes === 0
          ? "Auto-lock set to browser session."
          : `Vault will auto-lock after ${minutes} minutes.`
      );
    }
  }

  async function handleReencrypt(useManualOldKey: boolean) {
    if (useManualOldKey && oldHexKey.trim().length < 16) {
      setReencryptMsg({
        type: "err",
        text: "Paste your previous 64-character hex secret key first.",
      });
      return;
    }

    setReencryptBusy(true);
    setReencryptMsg(null);
    try {
      const res = await fetch("/api/vault/reencrypt", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          useManualOldKey ? { oldHexKey: oldHexKey.trim() } : {}
        ),
      });
      const j = await res.json();
      if (!res.ok) {
        setReencryptMsg({
          type: "err",
          text: j.error || "Key recovery failed.",
        });
        return;
      }

      await refreshVault();
      setOldHexKey("");

      if (j.migratedCount > 0) {
        setReencryptMsg({
          type: "ok",
          text: `Successfully re-encrypted ${j.migratedCount} entry(s) with your current active secret (${j.activeKeyFingerprint}).${
            j.stillLockedCount > 0
              ? ` ${j.stillLockedCount} entry(s) remain locked under a different older key.`
              : ""
          }`,
        });
        showToast(`Re-encrypted ${j.migratedCount} vault entry(s)!`);
      } else if (j.stillLockedCount > 0) {
        setReencryptMsg({
          type: "err",
          text: `That hex key did not unlock the ${j.stillLockedCount} remaining locked entry(s).`,
        });
      } else {
        setReencryptMsg({
          type: "ok",
          text: "All entries are already encrypted with your current active secret.",
        });
      }
    } finally {
      setReencryptBusy(false);
    }
  }

  if (authLoading) {
    return (
      <div className="vault-text-muted py-20 text-center text-sm">
        Loading settings...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="vault-card mx-auto mt-12 max-w-md rounded-3xl p-8 text-center">
        <Lock className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <Link
          href="/sign-in?next=/vault/settings"
          className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-zinc-950"
        >
          <LogIn className="h-4 w-4" />
          Sign in with SSE Accounts
        </Link>
      </div>
    );
  }

  const hasKeyIssue = recoveredCount > 0 || lockedCount > 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="vault-text-primary text-2xl font-black sm:text-3xl">
          Vault Settings, PIN &amp; Transfers
        </h1>
        <p className="vault-text-muted mt-1 text-xs">
          Manage your mandatory 6-digit Vault PIN, import/export passwords,
          encryption key status, and privacy tools.
        </p>
      </div>

      {/* 1. 6-Digit Vault PIN & Auto-Lock Manager */}
      <section className="vault-card space-y-4 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="vault-text-primary text-base font-extrabold">
                6-Digit Vault PIN Lock
              </h2>
              <p className="vault-text-muted mt-0.5 text-xs">
                Required before opening any vault page or decrypting data from
                the server.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={lockVault}
            className="vault-inset inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-xl px-3.5 py-2 text-xs font-bold text-rose-500 hover:border-rose-500/50 sm:self-center"
          >
            <Lock className="h-3.5 w-3.5" />
            Lock Vault Now
          </button>
        </div>

        {/* Auto-Lock Duration */}
        <div className="vault-inset flex flex-col justify-between gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
          <div>
            <div className="vault-text-primary text-xs font-bold">
              Auto-Lock Timer
            </div>
            <p className="vault-text-muted text-[11px]">
              Automatically require your 6-digit PIN again after this duration.
            </p>
          </div>
          <select
            value={pinStatus?.autoLockMinutes ?? 30}
            onChange={(e) => handleAutoLockChange(Number(e.target.value))}
            className="vault-input rounded-xl px-3 py-2 text-xs font-bold"
          >
            <option value={5}>5 Minutes</option>
            <option value={15}>15 Minutes</option>
            <option value={30}>30 Minutes</option>
            <option value={60}>1 Hour</option>
            <option value={0}>Until Browser Closes</option>
          </select>
        </div>

        {/* Change 6-Digit PIN Form */}
        <form onSubmit={handleChangePin} className="space-y-3 pt-1">
          <div className="vault-text-secondary text-xs font-bold">
            Change 6-Digit PIN
          </div>

          {pinMsg && (
            <div
              className={`rounded-xl border p-3 text-xs ${
                pinMsg.type === "ok"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-400"
              }`}
            >
              {pinMsg.text}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              value={currentPin}
              onChange={(e) =>
                setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="Current 6-digit PIN"
              className="vault-input rounded-xl px-3.5 py-2.5 font-mono text-xs tracking-widest"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              value={newPin}
              onChange={(e) =>
                setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="New 6-digit PIN"
              className="vault-input rounded-xl px-3.5 py-2.5 font-mono text-xs tracking-widest"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              value={confirmPin}
              onChange={(e) =>
                setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="Confirm new PIN"
              className="vault-input rounded-xl px-3.5 py-2.5 font-mono text-xs tracking-widest"
            />
          </div>

          <button
            type="submit"
            disabled={pinBusy}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-extrabold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {pinBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Update 6-Digit PIN
          </button>
        </form>
      </section>

      {/* 2. Import & Export Passwords (Chrome, Firefox, Bitwarden, Safari, SSE Vault) */}
      <section className="vault-card space-y-4 rounded-3xl p-5 sm:p-6">
        <div>
          <h2 className="vault-text-primary text-base font-extrabold">
            Import &amp; Export Passwords
          </h2>
          <p className="vault-text-muted mt-0.5 text-xs">
            Import from Google Chrome, Edge, Firefox, Safari/iCloud, Bitwarden,
            or SSE Vault — automatically checks if each account is already
            present before importing.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => openImportExportModal("import")}
            className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-xs font-extrabold text-zinc-950 shadow-md shadow-amber-500/20 transition hover:bg-amber-400"
          >
            <Upload className="h-4 w-4" />
            Import CSV / JSON
          </button>

          <a
            href="/api/vault/export?format=json"
            className="vault-inset vault-text-primary flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold transition hover:border-amber-500"
          >
            <Download className="h-4 w-4 text-amber-500" />
            Export Full JSON
          </a>

          <a
            href="/api/vault/export?format=csv"
            className="vault-inset vault-text-primary flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold transition hover:border-cyan-500"
          >
            <FileSpreadsheet className="h-4 w-4 text-cyan-500" />
            Export Universal CSV
          </a>
        </div>
      </section>

      {/* 3. Encryption Key Status + Conditional Recovery Console */}
      <section
        id="key-recovery"
        className="vault-card space-y-4 rounded-3xl p-5 sm:p-6"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                lockedCount > 0
                  ? "bg-rose-500/15 text-rose-500"
                  : recoveredCount > 0
                    ? "bg-amber-500/15 text-amber-500"
                    : "bg-emerald-500/15 text-emerald-500"
              }`}
            >
              {lockedCount > 0 ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="vault-text-primary text-base font-extrabold">
                AES-256-GCM Encryption Key Protection
              </h2>
              <p className="vault-text-muted mt-0.5 text-xs leading-relaxed">
                Active Vercel key fingerprint:{" "}
                <code className="font-mono font-bold text-amber-500">
                  {activeKeyFingerprint || "ACTIVE"}
                </code>{" "}
                · Per-record DB <code>hexcode</code> fallback:{" "}
                <strong
                  className={
                    storesHexcodeInDb
                      ? "text-emerald-500"
                      : "vault-text-secondary"
                  }
                >
                  {storesHexcodeInDb ? "Enabled" : "Disabled"}
                </strong>
              </p>
            </div>
          </div>

          <span
            className={`self-start rounded-full px-3 py-1 text-[10px] font-bold uppercase sm:self-center ${
              lockedCount > 0
                ? "bg-rose-500/15 text-rose-500"
                : recoveredCount > 0
                  ? "bg-amber-500/15 text-amber-500"
                  : "bg-emerald-500/15 text-emerald-500"
            }`}
          >
            {lockedCount > 0
              ? `${lockedCount} Locked`
              : recoveredCount > 0
                ? `${recoveredCount} Recovered via DB Hex`
                : `All ${items.length} Entries Healthy`}
          </span>
        </div>

        {reencryptMsg && (
          <div
            className={`rounded-2xl border p-3.5 text-xs ${
              reencryptMsg.type === "ok"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                : "border-rose-500/40 bg-rose-500/10 text-rose-400"
            }`}
          >
            {reencryptMsg.text}
          </div>
        )}

        {hasKeyIssue ? (
          <div className="space-y-4 border-t border-zinc-500/15 pt-4">
            {recoveredCount > 0 && (
              <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-2.5 text-xs">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div>
                    <div className="vault-text-primary font-bold">
                      {recoveredCount} entry(s) decoded via fallback DB hexcode
                    </div>
                    <p className="vault-text-secondary mt-0.5">
                      Re-encrypt them now under your active Vercel secret.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={reencryptBusy}
                  onClick={() => handleReencrypt(false)}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-extrabold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  {reencryptBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Re-Encrypt All Now
                </button>
              </div>
            )}

            {lockedCount > 0 && (
              <div className="space-y-3 rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4">
                <div className="flex items-start gap-2.5 text-xs">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  <div>
                    <div className="vault-text-primary font-bold">
                      Unlock {lockedCount} Locked Entry(s) with Previous Hex Key
                    </div>
                    <p className="vault-text-secondary mt-0.5">
                      Paste your previous 64-character hex secret below to
                      unlock and migrate them to your new Vercel secret.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="password"
                    value={oldHexKey}
                    onChange={(e) => setOldHexKey(e.target.value)}
                    placeholder="Paste previous 64-character VAULT_ENCRYPTION_SECRET..."
                    className="vault-input min-w-0 flex-1 rounded-xl px-3.5 py-2.5 font-mono text-xs"
                  />
                  <button
                    type="button"
                    disabled={reencryptBusy || !oldHexKey.trim()}
                    onClick={() => handleReencrypt(true)}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-rose-400 disabled:opacity-50"
                  >
                    {reencryptBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="h-3.5 w-3.5" />
                    )}
                    Unlock &amp; Re-Encrypt
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              All vault entries decoded natively with your active secret.
              Recovery tools stay hidden until needed.
            </span>
          </div>
        )}
      </section>

      {/* 4. Built-in Password & Passphrase Generator */}
      <section className="vault-card space-y-4 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="vault-text-primary text-base font-extrabold">
              Password &amp; Passphrase Generator
            </h2>
          </div>

          <div className="vault-inset flex items-center gap-1 rounded-full p-1 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => {
                setGenMode("random");
                regenerate("random", genLength, genSymbols);
              }}
              className={`rounded-full px-3 py-1 ${
                genMode === "random"
                  ? "bg-amber-500 text-zinc-950"
                  : "vault-text-muted"
              }`}
            >
              Random
            </button>
            <button
              type="button"
              onClick={() => {
                setGenMode("passphrase");
                regenerate("passphrase", genLength, genSymbols);
              }}
              className={`rounded-full px-3 py-1 ${
                genMode === "passphrase"
                  ? "bg-amber-500 text-zinc-950"
                  : "vault-text-muted"
              }`}
            >
              Passphrase
            </button>
          </div>
        </div>

        <div className="vault-inset flex items-center justify-between gap-2 rounded-2xl px-3.5 py-3">
          <code className="vault-text-primary min-w-0 flex-1 break-all font-mono text-sm font-bold">
            {generated || "Click refresh to generate"}
          </code>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => regenerate()}
              title="Regenerate"
              className="vault-card vault-text-secondary rounded-xl p-2 hover:text-amber-500"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleCopyGenerated}
              title="Copy password"
              className="rounded-xl bg-amber-500 p-2 text-zinc-950 hover:bg-amber-400"
            >
              {copiedGen ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {genMode === "random" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="vault-text-secondary flex flex-1 items-center gap-3 text-xs font-semibold">
              <span className="shrink-0">Length: {genLength}</span>
              <input
                type="range"
                min={10}
                max={36}
                value={genLength}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setGenLength(n);
                  regenerate("random", n, genSymbols);
                }}
                className="w-full accent-amber-500"
              />
            </label>

            <label className="vault-text-secondary flex cursor-pointer items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={genSymbols}
                onChange={(e) => {
                  setGenSymbols(e.target.checked);
                  regenerate("random", genLength, e.target.checked);
                }}
                className="h-4 w-4 accent-amber-500"
              />
              Include Symbols (!@#$%)
            </label>
          </div>
        )}
      </section>

      {/* 5. Privacy Preferences & Legal */}
      <section className="vault-card space-y-3 rounded-3xl p-5 sm:p-6">
        <h2 className="vault-text-primary text-base font-extrabold">
          Privacy &amp; Safety Preferences
        </h2>

        <label className="vault-inset flex cursor-pointer items-center justify-between gap-4 rounded-2xl p-4">
          <div className="min-w-0">
            <div className="vault-text-primary text-xs font-bold">
              Auto-Clear Clipboard After 30 Seconds
            </div>
            <p className="vault-text-muted mt-0.5 text-[11px]">
              Automatically wipes copied passwords, TOTP codes, and security
              keys from your clipboard after 30s.
            </p>
          </div>
          <input
            type="checkbox"
            checked={clipboardAutoClear}
            onChange={(e) => setClipboardAutoClear(e.target.checked)}
            className="h-4 w-4 shrink-0 accent-amber-500"
          />
        </label>

        <label className="vault-inset flex cursor-pointer items-center justify-between gap-4 rounded-2xl p-4">
          <div className="min-w-0">
            <div className="vault-text-primary text-xs font-bold">
              Enable Privacy Blur Curtain
            </div>
            <p className="vault-text-muted mt-0.5 text-[11px]">
              Blurs emails, usernames, passwords, TOTP codes, and recovery keys
              on screen until you unblur them.
            </p>
          </div>
          <input
            type="checkbox"
            checked={privacyBlur}
            onChange={(e) => {
              const next = e.target.checked;
              setPrivacyBlur(next);
              window.localStorage.setItem("sse-vault-blur", String(next));
            }}
            className="h-4 w-4 shrink-0 accent-amber-500"
          />
        </label>

        <label className="vault-inset flex cursor-pointer items-center justify-between gap-4 rounded-2xl p-4">
          <div className="min-w-0">
            <div className="vault-text-primary text-xs font-bold">
              Lock Immediately When Switching Apps / Tabs
            </div>
            <p className="vault-text-muted mt-0.5 text-[11px]">
              Locks your vault right away whenever you minimize the Android APK
              or switch browser tabs.
            </p>
          </div>
          <input
            type="checkbox"
            checked={lockOnBackground}
            onChange={(e) => setLockOnBackground(e.target.checked)}
            className="h-4 w-4 shrink-0 accent-amber-500"
          />
        </label>

        {/* Android APK & Platform Card */}
        <div className="vault-inset flex flex-col justify-between gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="min-w-0">
              <div className="vault-text-primary text-xs font-bold">
                {platformInfo.native
                  ? `SSE Vault Android App (v${platformInfo.version})`
                  : "SSE Vault Android APK"}
              </div>
              <p className="vault-text-muted mt-0.5 text-[11px]">
                {platformInfo.native
                  ? "Running inside the native Android APK shell with auto-update checks."
                  : "Download the latest signed Android APK release directly from GitHub."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href="/apk"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-extrabold text-zinc-950 hover:bg-amber-400"
            >
              <Download className="h-3.5 w-3.5" />
              APK Page
            </Link>
            <a
              href="https://github.com/sse-bots/sse-vault/releases/latest"
              target="_blank"
              rel="noreferrer"
              className="vault-card vault-text-primary inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold hover:border-amber-500 hover:text-amber-500"
            >
              GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Link
            href="/privacy"
            className="vault-inset vault-text-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold hover:border-amber-500"
          >
            <Scale className="h-3.5 w-3.5 text-amber-500" />
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="vault-inset vault-text-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold hover:border-amber-500"
          >
            <FileText className="h-3.5 w-3.5 text-amber-500" />
            Terms of Service
          </Link>
        </div>
      </section>
    </div>
  );
}
