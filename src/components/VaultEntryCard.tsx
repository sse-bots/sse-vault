"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronDown,
  CreditCard,
  History,
  Layers,
  Share2,
  StickyNote,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Mail,
  RotateCcw,
  ShieldAlert,
  Star,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { useVault } from "@/components/VaultContext";
import { SiteIcon } from "@/components/SiteIcon";
import { TotpLiveWidget } from "@/components/TotpLiveWidget";
import { ShareSecretModal } from "@/components/ShareSecretModal";
import { evaluatePasswordStrength } from "@/lib/domain";
import { extractSecurityCodesFromText } from "@/lib/parse-codes";
import {
  findParentOAuthAccount,
  getAccountDetailHref,
  getConnectedOAuthEntries,
  resolveOAuthProviderDomain,
} from "@/lib/oauth-links";
import {
  VAULT_CATEGORIES,
  type VaultItemDTO,
  type VaultSecurityCodeDTO,
} from "@/lib/vault-types";

export function VaultEntryCard({
  item,
  lockedDomain,
  isDetailView = false,
  onAfterDelete,
}: {
  item: VaultItemDTO;
  lockedDomain?: string;
  isDetailView?: boolean;
  onAfterDelete?: () => void;
}) {
  const {
    items,
    privacyBlur,
    openEditModal,
    upsertItem,
    removeItem,
    showToast,
    copySensitiveText,
  } = useVault();
  const quickTxtRef = useRef<HTMLInputElement | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [revealedCf, setRevealedCf] = useState<Record<string, boolean>>({});
  const [revealedCard, setRevealedCard] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [busyCodeId, setBusyCodeId] = useState<string | null>(null);
  const [uploadingTxt, setUploadingTxt] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const unusedCount = item.securityCodes.filter((c) => !c.used).length;
  const totalCodes = item.securityCodes.length;
  const pwdStrength =
    item.authType === "password" && item.password
      ? evaluatePasswordStrength(item.password)
      : null;

  const categoryMeta =
    VAULT_CATEGORIES.find((c) => c.id === item.category) || VAULT_CATEGORIES[0];

  const accountDetailHref = useMemo(() => getAccountDetailHref(item), [item]);
  const parentOAuthAccount = useMemo(
    () => findParentOAuthAccount(item, items),
    [item, items]
  );
  const connectedOAuths = useMemo(
    () => getConnectedOAuthEntries(item, items),
    [item, items]
  );

  const oauthDomain =
    parentOAuthAccount?.domainKey || resolveOAuthProviderDomain(item) || "";

  async function copyField(field: string, value: string, label: string) {
    await copySensitiveText(value, label);
    setCopiedField(field);
    window.setTimeout(() => {
      setCopiedField((prev) => (prev === field ? null : prev));
    }, 1500);
  }

  async function toggleFavorite() {
    const res = await fetch(`/api/vault/${item.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !item.favorite }),
    });
    if (res.ok) {
      const j = await res.json();
      if (j.item) upsertItem(j.item);
    }
  }

  async function handleDelete() {
    const identity = item.email || item.username || item.label;
    if (
      !confirm(
        `Move "${identity}" to the 30-day Trash Bin? You can restore it anytime within 30 days.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/vault/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        removeItem(item.id);
        showToast("Moved to Trash (recoverable for 30 days).");
        onAfterDelete?.();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleUseCode(codeObj: VaultSecurityCodeDTO) {
    if (codeObj.used || codeObj.locked || busyCodeId) return;
    if (codeObj.code) {
      await copySensitiveText(codeObj.code, "Security code");
    }
    setBusyCodeId(codeObj.id);
    try {
      const res = await fetch(`/api/vault/${item.id}/codes`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          codeId: codeObj.id,
          used: true,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.item) upsertItem(j.item);
        showToast("Security key copied & masked as used!");
      }
    } finally {
      setBusyCodeId(null);
    }
  }

  async function handleRestoreCode(codeObj: VaultSecurityCodeDTO) {
    if (!codeObj.used || busyCodeId) return;
    setBusyCodeId(codeObj.id);
    try {
      const res = await fetch(`/api/vault/${item.id}/codes`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          codeId: codeObj.id,
          used: false,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.item) upsertItem(j.item);
        showToast("Security code restored.");
      }
    } finally {
      setBusyCodeId(null);
    }
  }

  async function handleQuickTxtImport(file: File) {
    setUploadingTxt(true);
    try {
      const text = await file.text();
      const codes = extractSecurityCodesFromText(text);
      if (codes.length === 0) {
        showToast("No security codes detected in that .txt file.");
        return;
      }
      const res = await fetch(`/api/vault/${item.id}/codes`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "append", codes }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.item) upsertItem(j.item);
        showToast(`Imported ${codes.length} code(s) — .txt file discarded.`);
      }
    } finally {
      setUploadingTxt(false);
      if (quickTxtRef.current) quickTxtRef.current.value = "";
    }
  }

  const primaryTitle =
    item.label !== item.appName
      ? item.label
      : item.username || item.email || item.appName;

  return (
    <article className="vault-card flex min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-3xl p-4 sm:p-5">
      <div className="min-w-0 space-y-3.5">
        {/* Account Card Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {isDetailView ? (
                <h2 className="vault-text-primary truncate text-base font-extrabold">
                  {primaryTitle}
                </h2>
              ) : (
                <Link
                  href={accountDetailHref}
                  className="vault-text-primary inline-flex max-w-full items-center gap-1 truncate text-base font-extrabold transition hover:text-amber-500"
                >
                  <span className="truncate">{primaryTitle}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                </Link>
              )}

              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: `${categoryMeta.color}1e`,
                  color: categoryMeta.color,
                }}
              >
                {categoryMeta.label}
              </span>
              {item.hasPasskey && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-500">
                  <Fingerprint className="h-2.5 w-2.5" />
                  Passkey
                </span>
              )}
            </div>

            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="vault-text-muted mt-0.5 inline-flex max-w-full items-center gap-1 font-mono text-[11px] hover:text-amber-500 hover:underline"
            >
              <span className="truncate">{item.url}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={toggleFavorite}
              title={item.favorite ? "Remove favorite" : "Favorite"}
              className={`rounded-xl p-2 transition hover:bg-amber-500/10 ${
                item.favorite ? "text-amber-500" : "vault-text-muted"
              }`}
            >
              <Star
                className="h-4 w-4"
                fill={item.favorite ? "currentColor" : "none"}
              />
            </button>
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              title="Share once (self-destructing link)"
              className="vault-text-muted rounded-xl p-2 transition hover:bg-amber-500/10 hover:text-amber-500"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => openEditModal(item, lockedDomain || item.domainKey)}
              title="Edit account"
              className="vault-text-muted rounded-xl p-2 transition hover:bg-amber-500/10 hover:text-amber-500"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              title="Delete account"
              className="vault-text-muted rounded-xl p-2 transition hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Conditional Key Recovery / Locked Alert */}
        {item.decryptionStatus === "locked" && (
          <div className="flex items-start justify-between gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-[11px] text-rose-400">
            <div className="flex min-w-0 items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Encrypted with an old secret key. Enter your old 64-char hex key
                in Settings to unlock.
              </span>
            </div>
            <Link
              href="/vault/settings#key-recovery"
              className="shrink-0 rounded-lg bg-rose-500 px-2.5 py-1 text-[10px] font-bold text-white"
            >
              Unlock
            </Link>
          </div>
        )}

        {(item.decryptionStatus === "recovered_db_hex" ||
          item.decryptionStatus === "recovered_legacy_env") && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[10px] font-semibold text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              Decoded via saved fallback hexcode — re-encrypt in Settings.
            </span>
          </div>
        )}

        {/* OAuth Login Block OR Standard Credentials Table */}
        {item.authType === "oauth" ? (
          <div className="vault-inset space-y-2.5 rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <SiteIcon
                  domainOrUrl={oauthDomain || item.oauthProvider || "google.com"}
                  label={item.oauthProvider || "OAuth"}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-500">
                    Sign in with {item.oauthProvider || "OAuth"}
                  </div>
                  <div
                    className={`vault-text-primary truncate font-mono text-xs font-semibold ${
                      privacyBlur ? "blur-sm select-none" : ""
                    }`}
                  >
                    {item.email || "No email saved"}
                  </div>
                </div>
              </div>

              {item.email && (
                <button
                  type="button"
                  onClick={() => copyField("email", item.email!, "OAuth email")}
                  className="vault-card vault-text-muted shrink-0 rounded-xl p-2 hover:text-amber-500"
                  title="Copy email"
                >
                  {copiedField === "email" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>

            {parentOAuthAccount ? (
              <Link
                href={getAccountDetailHref(parentOAuthAccount)}
                className="vault-card flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[11px] font-bold transition hover:border-amber-500"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-emerald-500">
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    Open {parentOAuthAccount.appName} Account (
                    {parentOAuthAccount.username ||
                      parentOAuthAccount.email ||
                      parentOAuthAccount.label}
                    )
                  </span>
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              </Link>
            ) : oauthDomain ? (
              <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px]">
                <span className="vault-text-muted">
                  Not linked to a saved {item.oauthProvider || "provider"} card yet
                </span>
                <button
                  type="button"
                  onClick={() =>
                    openEditModal(item, lockedDomain || item.domainKey)
                  }
                  className="font-bold text-amber-500 hover:underline"
                >
                  Connect Account
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          (item.email || item.username || item.password) && (
            <div className="vault-inset divide-y rounded-2xl">
              {item.email && (
                <div className="vault-divider flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Mail className="vault-text-muted h-3.5 w-3.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="vault-text-muted text-[9px] font-bold uppercase tracking-wider">
                        Email
                      </div>
                      <div
                        className={`vault-text-primary truncate font-mono text-xs ${
                          privacyBlur ? "blur-sm select-none" : ""
                        }`}
                      >
                        {item.email}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyField("email", item.email!, "Email")}
                    className="vault-text-muted shrink-0 rounded-lg p-1.5 hover:text-amber-500"
                  >
                    {copiedField === "email" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )}

              {item.username && (
                <div className="vault-divider flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <User className="vault-text-muted h-3.5 w-3.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="vault-text-muted text-[9px] font-bold uppercase tracking-wider">
                        Username
                      </div>
                      <div
                        className={`vault-text-primary truncate font-mono text-xs ${
                          privacyBlur ? "blur-sm select-none" : ""
                        }`}
                      >
                        {item.username}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyField("username", item.username!, "Username")
                    }
                    className="vault-text-muted shrink-0 rounded-lg p-1.5 hover:text-amber-500"
                  >
                    {copiedField === "username" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )}

              {item.password && (
                <div className="vault-divider flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Lock className="vault-text-muted h-3.5 w-3.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="vault-text-muted text-[9px] font-bold uppercase tracking-wider">
                          Password
                        </span>
                        {pwdStrength && (
                          <span
                            className="rounded px-1 text-[9px] font-bold uppercase"
                            style={{
                              backgroundColor: `${pwdStrength.color}20`,
                              color: pwdStrength.color,
                            }}
                          >
                            {pwdStrength.label}
                          </span>
                        )}
                      </div>
                      <div
                        className={`vault-text-primary truncate font-mono text-xs ${
                          privacyBlur ? "blur-sm select-none" : ""
                        }`}
                      >
                        {showPassword ? item.password : "••••••••••••"}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="vault-text-muted rounded-lg p-1.5 hover:text-amber-500"
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        copyField("password", item.password!, "Password")
                      }
                      className="vault-text-muted rounded-lg p-1.5 hover:text-amber-500"
                    >
                      {copiedField === "password" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* Live TOTP Widget */}
        {item.totpSecret && (
          <TotpLiveWidget
            secret={item.totpSecret}
            privacyBlur={privacyBlur}
            onCopied={(code) => copySensitiveText(code, "TOTP code")}
          />
        )}

        {/* Backup Security Keys */}
        <div className="vault-inset space-y-2.5 rounded-2xl p-3 sm:p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-amber-500" />
              <span className="vault-text-secondary text-[10px] font-bold uppercase tracking-widest">
                Security Keys
              </span>
              {totalCodes > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    unusedCount === 0
                      ? "bg-rose-500/15 text-rose-500"
                      : unusedCount <= 2
                        ? "bg-amber-500/15 text-amber-500"
                        : "bg-emerald-500/15 text-emerald-500"
                  }`}
                >
                  {unusedCount}/{totalCodes} left
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={uploadingTxt}
              onClick={() => quickTxtRef.current?.click()}
              className="vault-card vault-text-secondary inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold hover:border-amber-500 hover:text-amber-500 disabled:opacity-50"
            >
              {uploadingTxt ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              Import .txt
            </button>
            <input
              ref={quickTxtRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleQuickTxtImport(f);
              }}
            />
          </div>

          {totalCodes === 0 ? (
            <p className="vault-text-muted text-[11px]">
              No backup security keys saved yet.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-500/20">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.round((unusedCount / Math.max(1, totalCodes)) * 100)}%`,
                        backgroundColor:
                          unusedCount === 0
                            ? "#ef4444"
                            : unusedCount <= 2
                              ? "#f59e0b"
                              : "#10b981",
                      }}
                    />
                  </div>
                  <span className="vault-text-muted shrink-0 font-mono text-[10px]">
                    {Math.round((unusedCount / Math.max(1, totalCodes)) * 100)}%
                  </span>
                </div>

                {unusedCount > 0 && (
                  <button
                    type="button"
                    disabled={busyCodeId !== null}
                    onClick={() => {
                      const nextUnused = item.securityCodes.find(
                        (x) => !x.used && !x.locked
                      );
                      if (nextUnused) void handleUseCode(nextUnused);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[10px] font-extrabold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
                  >
                    <Copy className="h-3 w-3" />
                    Use Next Key
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-1.5 min-[380px]:grid-cols-2">
                {item.securityCodes.map((c) => {
                  const isBusy = busyCodeId === c.id;
                  if (c.locked) {
                    return (
                      <div
                        key={c.id}
                        className="vault-card flex items-center justify-between gap-1.5 rounded-xl border-rose-500/30 px-2.5 py-2 text-[11px] text-rose-400"
                      >
                        <span className="truncate font-mono">LOCKED</span>
                        <Lock className="h-3 w-3 shrink-0" />
                      </div>
                    );
                  }
                  if (c.used) {
                    return (
                      <div
                        key={c.id}
                        title={
                          c.usedAt
                            ? `Used on ${new Date(c.usedAt).toLocaleString()}`
                            : "Used code"
                        }
                        className="vault-card flex min-w-0 items-center justify-between gap-1.5 rounded-xl px-2.5 py-2 opacity-65"
                      >
                        <span className="vault-text-muted truncate font-mono text-xs font-extrabold tracking-wider select-none">
                          {c.masked}
                        </span>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleRestoreCode(c)}
                          title="Undo / Restore code"
                          className="vault-text-muted shrink-0 rounded-md p-1 hover:text-amber-500"
                        >
                          {isBusy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleUseCode(c)}
                      title="Click to copy & mask as used (-------)"
                      className="vault-card group flex min-w-0 items-center justify-between gap-1.5 rounded-xl px-2.5 py-2 text-left transition hover:border-amber-500 hover:bg-amber-500/10 disabled:opacity-50"
                    >
                      <span
                        className={`truncate font-mono text-xs font-bold text-amber-500 ${
                          privacyBlur ? "blur-sm select-none" : ""
                        }`}
                      >
                        {c.code || c.masked}
                      </span>
                      {isBusy ? (
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-amber-500" />
                      ) : (
                        <Copy className="vault-text-muted h-3 w-3 shrink-0 opacity-60 transition group-hover:text-amber-500 group-hover:opacity-100" />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Connected OAuths Preview Footer (on /vault/[domain] cards) */}
        {!isDetailView && (
          <Link
            href={`${accountDetailHref}#oauths`}
            className="vault-inset flex items-center justify-between gap-2.5 rounded-2xl px-3.5 py-2.5 transition hover:border-amber-500/60"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="vault-text-secondary truncate text-xs font-bold">
                {connectedOAuths.length > 0
                  ? `${connectedOAuths.length} Connected OAuth${connectedOAuths.length === 1 ? "" : "s"}`
                  : "Open Account & OAuths"}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {connectedOAuths.slice(0, 3).map((conn) => (
                <SiteIcon
                  key={conn.id}
                  domainOrUrl={conn.domainKey}
                  label={conn.appName}
                  size="sm"
                  className="!h-6 !w-6 !rounded-lg"
                />
              ))}
              {connectedOAuths.length > 3 && (
                <span className="vault-card vault-text-muted rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold">
                  +{connectedOAuths.length - 3}
                </span>
              )}
              <ArrowUpRight className="h-3.5 w-3.5 text-amber-500" />
            </div>
          </Link>
        )}

        {/* Payment Card Details Block */}
        {item.entryType === "card" && item.cardDetails && (
          <div className="vault-inset space-y-2.5 rounded-2xl p-3.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-500">
                <CreditCard className="h-3.5 w-3.5" />
                Payment Card
              </span>
              <button
                type="button"
                onClick={() => setRevealedCard((v) => !v)}
                className="vault-text-muted inline-flex items-center gap-1 text-[10px] font-bold hover:text-amber-500"
              >
                {revealedCard ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {revealedCard ? "Hide" : "Reveal"}
              </button>
            </div>
            {item.cardDetails.cardholderName && (
              <div className="vault-text-primary font-bold">{item.cardDetails.cardholderName}</div>
            )}
            {item.cardDetails.cardNumber && (
              <div className="flex items-center justify-between gap-2">
                <span className={`vault-text-primary font-mono text-sm font-extrabold tracking-wider ${privacyBlur ? "blur-sm select-none" : ""}`}>
                  {revealedCard
                    ? item.cardDetails.cardNumber
                    : `•••• •••• •••• ${item.cardDetails.cardNumber.replace(/\s+/g, "").slice(-4)}`}
                </span>
                <button
                  type="button"
                  onClick={() => copyField("cardNum", item.cardDetails!.cardNumber, "Card number")}
                  className="vault-text-muted rounded-lg p-1 hover:text-amber-500"
                >
                  {copiedField === "cardNum" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
              {item.cardDetails.expiry && (
                <span className="vault-text-secondary">EXP: <strong>{item.cardDetails.expiry}</strong></span>
              )}
              {item.cardDetails.cvv && (
                <button
                  type="button"
                  onClick={() => copyField("cvv", item.cardDetails!.cvv, "CVV")}
                  className="vault-text-secondary hover:text-amber-500"
                >
                  CVV: <strong>{revealedCard && !privacyBlur ? item.cardDetails.cvv : "•••"}</strong>
                </button>
              )}
              {item.cardDetails.billingZip && (
                <span className="vault-text-muted">ZIP: {item.cardDetails.billingZip}</span>
              )}
            </div>
          </div>
        )}

        {/* Custom Fields & Developer Secrets */}
        {item.customFields && item.customFields.length > 0 && (
          <div className="vault-inset divide-y rounded-2xl">
            <div className="vault-divider flex items-center gap-1.5 px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-wider text-amber-500">
              <Layers className="h-3 w-3" />
              Custom Fields ({item.customFields.length})
            </div>
            {item.customFields.map((cf) => {
              const isVisible = !cf.hidden || Boolean(revealedCf[cf.id]);
              return (
                <div key={cf.id} className="vault-divider flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs">
                  <div className="min-w-0">
                    <div className="vault-text-muted text-[9px] font-bold uppercase tracking-wider">{cf.label}</div>
                    <div className={`vault-text-primary break-all font-mono text-xs ${privacyBlur ? "blur-sm select-none" : ""}`}>
                      {isVisible ? cf.value : "••••••••••••"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {cf.hidden && (
                      <button
                        type="button"
                        onClick={() => setRevealedCf((p) => ({ ...p, [cf.id]: !p[cf.id] }))}
                        className="vault-text-muted rounded-lg p-1.5 hover:text-amber-500"
                      >
                        {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => copyField(`cf_${cf.id}`, cf.value, cf.label)}
                      className="vault-text-muted rounded-lg p-1.5 hover:text-amber-500"
                    >
                      {copiedField === `cf_${cf.id}` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Collapsible Password History Drawer */}
        {item.passwordHistory && item.passwordHistory.length > 0 && (
          <div className="vault-inset rounded-2xl p-3">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="flex w-full items-center justify-between text-xs font-bold"
            >
              <span className="vault-text-secondary inline-flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-amber-500" />
                Password History ({item.passwordHistory.length})
              </span>
              <ChevronDown className={`vault-text-muted h-4 w-4 transition ${showHistory ? "rotate-180" : ""}`} />
            </button>
            {showHistory && (
              <div className="mt-2.5 space-y-1.5">
                {item.passwordHistory.map((h, idx) => (
                  <div key={idx} className="vault-card flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[11px]">
                    <div className="min-w-0">
                      <div className={`vault-text-primary truncate font-mono font-semibold ${privacyBlur ? "blur-sm select-none" : ""}`}>
                        {h.locked ? "LOCKED" : h.password || "—"}
                      </div>
                      <div className="vault-text-muted text-[9px]">
                        Changed {new Date(h.changedAt).toLocaleString()}
                      </div>
                    </div>
                    {h.password && (
                      <button
                        type="button"
                        onClick={() => copyField(`hist_${idx}`, h.password!, "Previous password")}
                        className="vault-text-muted shrink-0 rounded-lg p-1.5 hover:text-amber-500"
                      >
                        {copiedField === `hist_${idx}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {item.notes && (
          <div className="vault-inset rounded-xl px-3 py-2.5 text-xs">
            {item.entryType === "note" && (
              <div className="mb-1 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-500">
                <StickyNote className="h-3 w-3" />
                Secure Note
              </div>
            )}
            <p
            className={`vault-inset vault-text-muted break-words rounded-xl px-3 py-2 text-[11px] ${
              privacyBlur ? "blur-sm select-none" : ""
            }`}
          >
            {item.notes}
            </p>
          </div>
        )}
      </div>
      {showShareModal && (
        <ShareSecretModal
          itemId={item.id}
          itemTitle={primaryTitle}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </article>
  );
}
