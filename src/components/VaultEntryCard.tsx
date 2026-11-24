"use client";

import { useRef, useState } from "react";
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RotateCcw,
  Star,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { useVault } from "@/components/VaultContext";
import { TotpLiveWidget } from "@/components/TotpLiveWidget";
import { evaluatePasswordStrength } from "@/lib/domain";
import { extractSecurityCodesFromText } from "@/lib/parse-codes";
import type { VaultItemDTO, VaultSecurityCodeDTO } from "@/lib/vault-types";

export function VaultEntryCard({
  item,
  lockedDomain,
}: {
  item: VaultItemDTO;
  lockedDomain?: string;
}) {
  const { privacyBlur, openEditModal, upsertItem, removeItem, showToast } =
    useVault();
  const quickTxtRef = useRef<HTMLInputElement | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [busyCodeId, setBusyCodeId] = useState<string | null>(null);
  const [uploadingTxt, setUploadingTxt] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const unusedCount = item.securityCodes.filter((c) => !c.used).length;
  const totalCodes = item.securityCodes.length;
  const pwdStrength = item.password
    ? evaluatePasswordStrength(item.password)
    : null;

  async function copyField(field: string, value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      showToast(`${label} copied to clipboard.`);
      window.setTimeout(() => {
        setCopiedField((prev) => (prev === field ? null : prev));
      }, 1500);
    } catch {
      // ignore
    }
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
        `Permanently delete "${identity}" from ${item.appName} along with all TOTP & recovery keys?`
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
        showToast("Entry deleted from vault.");
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleUseCode(codeObj: VaultSecurityCodeDTO) {
    if (codeObj.used || busyCodeId) return;
    if (codeObj.code) {
      await navigator.clipboard.writeText(codeObj.code).catch(() => {});
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
        showToast("Security code copied & masked as used!");
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

  const primaryTitle = item.label !== item.appName
    ? item.label
    : item.email || item.username || item.appName;

  return (
    <article className="vault-card flex flex-col justify-between gap-4 rounded-3xl p-5">
      <div className="space-y-4">
        {/* Account Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="vault-text-primary truncate text-base font-extrabold">
              {primaryTitle}
            </h3>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="vault-text-muted mt-0.5 inline-flex max-w-full items-center gap-1 truncate font-mono text-[11px] hover:text-amber-500 hover:underline"
            >
              <span className="truncate">{item.url}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>

          <div className="flex shrink-0 items-center gap-1">
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

        {/* Credentials Table */}
        {(item.email || item.username || item.password) && (
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
                          className="rounded px-1 py-0.2 text-[9px] font-bold uppercase"
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
        )}

        {/* Live TOTP Widget */}
        {item.totpSecret && (
          <TotpLiveWidget
            secret={item.totpSecret}
            privacyBlur={privacyBlur}
            onCopied={() => showToast("TOTP code copied to clipboard.")}
          />
        )}

        {/* Click-to-Consume Backup Security Keys */}
        <div className="vault-inset space-y-2.5 rounded-2xl p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
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
              No backup security keys yet. Tap <strong>Import .txt</strong> to
              extract codes without storing the file.
            </p>
          ) : (
            <>
              <p className="vault-text-muted text-[10px]">
                Click any unused key to copy &amp; turn it into{" "}
                <code>-------</code> (exact code length).
              </p>

              <div className="grid grid-cols-2 gap-1.5">
                {item.securityCodes.map((c) => {
                  const isBusy = busyCodeId === c.id;
                  if (c.used) {
                    return (
                      <div
                        key={c.id}
                        title={
                          c.usedAt
                            ? `Used on ${new Date(c.usedAt).toLocaleString()}`
                            : "Used code"
                        }
                        className="vault-card flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-2 opacity-65"
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
                      className="vault-card group flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-2 text-left transition hover:border-amber-500 hover:bg-amber-500/10 disabled:opacity-50"
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

        {item.notes && (
          <p
            className={`vault-inset vault-text-muted rounded-xl px-3 py-2 text-[11px] ${
              privacyBlur ? "blur-sm select-none" : ""
            }`}
          >
            {item.notes}
          </p>
        )}
      </div>
    </article>
  );
}
