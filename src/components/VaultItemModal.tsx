"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  FolderPlus,
  Folders,
  Globe,
  Loader2,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Upload,
  User,
  X,
} from "lucide-react";
import { useVault } from "@/components/VaultContext";
import { SiteIcon } from "@/components/SiteIcon";
import { TotpLiveWidget } from "@/components/TotpLiveWidget";
import {
  evaluatePasswordStrength,
  extractDomainKey,
  getAppNameForDomain,
  isUrlAllowedForDomain,
} from "@/lib/domain";
import { extractSecurityCodesFromText } from "@/lib/parse-codes";
import type { VaultItemDTO } from "@/lib/vault-types";

function generateStrongPassword(len = 20): string {
  const chars =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_";
  const arr = new Uint32Array(len);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

export function VaultItemModal() {
  const { modal, closeModal, appGroups, upsertItem, showToast } = useVault();
  const initialItem = modal.editingItem;
  const lockedDomain = modal.lockedDomain;
  const isEdit = Boolean(initialItem);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [url, setUrl] = useState(
    initialItem?.url || (lockedDomain ? `https://${lockedDomain}` : "")
  );
  const [label, setLabel] = useState(initialItem?.label || "");
  const [email, setEmail] = useState(initialItem?.email || "");
  const [username, setUsername] = useState(initialItem?.username || "");
  const [password, setPassword] = useState(initialItem?.password || "");
  const [showPassword, setShowPassword] = useState(false);
  const [totpSecret, setTotpSecret] = useState(initialItem?.totpSecret || "");
  const [notes, setNotes] = useState(initialItem?.notes || "");
  const [favorite, setFavorite] = useState(Boolean(initialItem?.favorite));

  const [codesMode, setCodesMode] = useState<"keep" | "append" | "replace">(
    isEdit ? "keep" : "replace"
  );
  const [parsedCodes, setParsedCodes] = useState<string[]>([]);
  const [manualCodeInput, setManualCodeInput] = useState("");
  const [fileFeedback, setFileFeedback] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectedDomain = useMemo(() => extractDomainKey(url), [url]);
  const detectedAppName = useMemo(
    () => (detectedDomain ? getAppNameForDomain(detectedDomain) : ""),
    [detectedDomain]
  );

  const matchedExistingGroup = useMemo(
    () => appGroups.find((g) => g.domainKey === detectedDomain) || null,
    [appGroups, detectedDomain]
  );

  const domainMismatch = Boolean(
    lockedDomain && url.trim() && !isUrlAllowedForDomain(url, lockedDomain)
  );

  const lockedAppName = lockedDomain ? getAppNameForDomain(lockedDomain) : "";
  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);

  async function processTxtFile(file: File) {
    setError(null);
    if (file.size > 512 * 1024) {
      setError("Please select a plain .txt file smaller than 512 KB.");
      return;
    }
    try {
      const text = await file.text();
      const extracted = extractSecurityCodesFromText(text);
      if (extracted.length === 0) {
        setError(
          `No security codes could be detected inside "${file.name}". Try pasting them below.`
        );
        return;
      }
      setParsedCodes((prev) => Array.from(new Set([...prev, ...extracted])));
      if (isEdit && codesMode === "keep") setCodesMode("append");
      setFileFeedback(
        `Extracted ${extracted.length} security code(s) from "${file.name}" in memory — file discarded and never stored.`
      );
    } catch {
      setError("Could not read that .txt file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleAddManualCodes() {
    const extracted = extractSecurityCodesFromText(manualCodeInput);
    if (extracted.length === 0) return;
    setParsedCodes((prev) => Array.from(new Set([...prev, ...extracted])));
    if (isEdit && codesMode === "keep") setCodesMode("append");
    setManualCodeInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (domainMismatch) {
      setError(
        `Only ${lockedDomain} URLs are allowed inside ${lockedAppName}.`
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const endpoint = isEdit ? `/api/vault/${initialItem!.id}` : "/api/vault";
      const method = isEdit ? "PATCH" : "POST";

      const payload = isEdit
        ? {
            label,
            url,
            expectedDomain: lockedDomain || undefined,
            email,
            username,
            password,
            totpSecret,
            notes,
            favorite,
            securityCodesMode: parsedCodes.length > 0 ? codesMode : "keep",
            securityCodes: parsedCodes.length > 0 ? parsedCodes : undefined,
          }
        : {
            label,
            url,
            expectedDomain: lockedDomain || undefined,
            email,
            username,
            password,
            totpSecret,
            securityCodes: parsedCodes,
            notes,
            favorite,
          };

      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Could not save vault entry.");
        setSaving(false);
        return;
      }

      if (j.item) {
        const savedItem = j.item as VaultItemDTO;
        upsertItem(savedItem);
        if (isEdit) {
          showToast(`Updated ${savedItem.appName} entry.`);
        } else if (j.addedToExistingGroup) {
          showToast(`Added into existing ${savedItem.appName} vault.`);
        } else {
          showToast(`Created new ${savedItem.appName} app group!`);
        }
      }
      closeModal();
    } catch {
      setError("Network error while saving vault entry.");
      setSaving(false);
    }
  }

  return (
    <div className="animate-vault-fade fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="animate-vault-modal vault-card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        {/* Header with Live Fetched Website Icon */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <SiteIcon
              domainOrUrl={url || lockedDomain || ""}
              label={detectedAppName || lockedAppName || "New"}
              size="md"
            />
            <div className="min-w-0">
              <h2 className="vault-text-primary truncate text-lg font-extrabold">
                {isEdit
                  ? `Edit ${initialItem?.appName} Account`
                  : lockedDomain
                    ? `Add ${lockedAppName} Account`
                    : detectedAppName
                      ? `Save to ${detectedAppName}`
                      : "Add New Vault Entry"}
              </h2>
              <p className="vault-text-muted truncate text-[11px]">
                {lockedDomain
                  ? `Strictly locked to ${lockedDomain} URLs`
                  : "Automatically groups by website domain & fetches its real icon"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="vault-inset vault-text-muted rounded-xl p-2 hover:text-amber-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* 1. Website URL + Smart Segregation Indicator */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="vault-text-secondary text-xs font-semibold">
                    Website URL *
                  </label>
                  {lockedDomain && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-500">
                      Only {lockedDomain}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Globe className="vault-text-muted pointer-events-none absolute left-3 top-2.5 h-4 w-4" />
                  <input
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={
                      lockedDomain
                        ? `https://${lockedDomain}`
                        : "google.com, github.com, discord.com..."
                    }
                    className={`vault-input w-full rounded-xl py-2.5 pl-9 pr-3 text-xs ${
                      domainMismatch ? "!border-rose-500" : ""
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="vault-text-secondary mb-1 block text-xs font-semibold">
                  Account Label (optional)
                </label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Personal, Work, Bot Dev"
                  className="vault-input w-full rounded-xl px-3.5 py-2.5 text-xs"
                />
              </div>
            </div>

            {/* Live Domain Segregation Feedback Pill */}
            {domainMismatch ? (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Only <code>{lockedDomain}</code> URLs are allowed inside{" "}
                  <strong>{lockedAppName}</strong>.
                </span>
              </div>
            ) : detectedDomain && !isEdit ? (
              <div className="vault-inset flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[11px]">
                <div className="flex min-w-0 items-center gap-2">
                  {matchedExistingGroup ? (
                    <>
                      <Folders className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span className="vault-text-secondary truncate">
                        Existing{" "}
                        <strong className="vault-text-primary">
                          {matchedExistingGroup.appName}
                        </strong>{" "}
                        app found ({matchedExistingGroup.accountCount} account
                        {matchedExistingGroup.accountCount === 1 ? "" : "s"}) —
                        will add inside it.
                      </span>
                    </>
                  ) : (
                    <>
                      <FolderPlus className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span className="vault-text-secondary truncate">
                        Will create a new{" "}
                        <strong className="vault-text-primary">
                          {detectedAppName}
                        </strong>{" "}
                        (<code>{detectedDomain}</code>) app group.
                      </span>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* 2. Email & Username (Either or Both) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="vault-text-secondary mb-1 block text-xs font-semibold">
                Email (optional)
              </label>
              <div className="relative">
                <Mail className="vault-text-muted pointer-events-none absolute left-3 top-2.5 h-4 w-4" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="vault-input w-full rounded-xl py-2.5 pl-9 pr-3 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="vault-text-secondary mb-1 block text-xs font-semibold">
                Username (optional — use either or both)
              </label>
              <div className="relative">
                <User className="vault-text-muted pointer-events-none absolute left-3 top-2.5 h-4 w-4" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. sseofficial"
                  className="vault-input w-full rounded-xl py-2.5 pl-9 pr-3 text-xs"
                />
              </div>
            </div>
          </div>

          {/* 3. Password + Live Strength Bar + Generator */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="vault-text-secondary text-xs font-semibold">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setPassword(generateStrongPassword(20));
                  setShowPassword(true);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                Generate Strong
              </button>
            </div>
            <div className="relative">
              <Lock className="vault-text-muted pointer-events-none absolute left-3 top-2.5 h-4 w-4" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Account password"
                className="vault-input w-full rounded-xl py-2.5 pl-9 pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="vault-text-muted absolute right-2.5 top-2 rounded-lg p-1 hover:text-amber-500"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {password && (
              <div className="flex items-center gap-2 pt-0.5">
                <div className="flex flex-1 gap-1">
                  {[1, 2, 3, 4].map((lvl) => (
                    <div
                      key={lvl}
                      className="h-1 flex-1 rounded-full transition-all"
                      style={{
                        backgroundColor:
                          strength.score >= lvl
                            ? strength.color
                            : "var(--v-border-strong)",
                      }}
                    />
                  ))}
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: strength.color }}
                >
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          {/* 4. TOTP Secret + Live Preview */}
          <div className="space-y-2.5">
            <div>
              <label className="vault-text-secondary mb-1 block text-xs font-semibold">
                TOTP Secret Key or <code>otpauth://</code> URI (optional)
              </label>
              <input
                value={totpSecret}
                onChange={(e) => setTotpSecret(e.target.value)}
                placeholder="e.g. JBSWY3DPEHPK3PXP or otpauth://totp/..."
                className="vault-input w-full rounded-xl px-3.5 py-2.5 font-mono text-xs"
              />
            </div>

            {totpSecret.trim().length >= 8 && (
              <TotpLiveWidget secret={totpSecret} compact />
            )}
          </div>

          {/* 5. Zero-Storage .txt Security Key Importer */}
          <div className="vault-inset space-y-3 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="vault-text-primary flex items-center gap-1.5 text-xs font-bold">
                  <FileText className="h-4 w-4 text-amber-500" />
                  Backup Security Keys (.txt Importer)
                </div>
                <p className="vault-text-muted mt-0.5 text-[11px]">
                  Upload any <code>.txt</code> codes file — codes are extracted
                  in memory &amp; encrypted individually.{" "}
                  <strong className="text-emerald-500">
                    The .txt file is never stored.
                  </strong>
                </p>
              </div>
              {isEdit && initialItem && initialItem.securityCodes.length > 0 && (
                <div className="vault-card flex items-center gap-1 rounded-xl p-1 text-[10px] font-bold">
                  {(["keep", "append", "replace"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCodesMode(m)}
                      className={`rounded-lg px-2 py-1 capitalize ${
                        codesMode === m
                          ? "bg-amber-500 text-zinc-950"
                          : "vault-text-muted"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) processTxtFile(dropped);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition ${
                isDragging
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-zinc-500/30 hover:border-amber-500/70"
              }`}
            >
              <Upload className="mb-2 h-6 w-6 text-amber-500" />
              <div className="vault-text-primary text-xs font-bold">
                Tap or Drop <code>.txt</code> Backup Codes File
              </div>
              <div className="vault-text-muted mt-0.5 text-[11px]">
                Auto-separates GitHub, Discord, Google &amp; SSE recovery kits
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processTxtFile(f);
                }}
              />
            </div>

            {fileFeedback && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-500">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{fileFeedback}</span>
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddManualCodes();
                  }
                }}
                placeholder="Or paste / type security code(s) manually..."
                className="vault-input flex-1 rounded-xl px-3 py-2 font-mono text-xs"
              />
              <button
                type="button"
                onClick={handleAddManualCodes}
                className="vault-card vault-text-primary inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold hover:border-amber-500"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>

            {parsedCodes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="vault-text-secondary font-semibold">
                    Separated Codes Ready ({parsedCodes.length}):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedCodes([]);
                      setFileFeedback(null);
                    }}
                    className="font-semibold text-rose-500 hover:underline"
                  >
                    Clear All
                  </button>
                </div>

                <div className="vault-card flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl p-2.5">
                  {parsedCodes.map((code) => (
                    <span
                      key={code}
                      className="vault-inset inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-xs font-semibold text-amber-500"
                    >
                      <span>{code}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setParsedCodes((prev) =>
                            prev.filter((c) => c !== code)
                          )
                        }
                        className="vault-text-muted hover:text-rose-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 6. Notes & Pin */}
          <div className="space-y-3">
            <div>
              <label className="vault-text-secondary mb-1 block text-xs font-semibold">
                Encrypted Notes (optional)
              </label>
              <textarea
                rows={2}
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any extra recovery notes or security question hints..."
                className="vault-input w-full rounded-xl px-3.5 py-2 text-xs"
              />
            </div>

            <label className="vault-text-secondary flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
                className="h-4 w-4 accent-amber-500"
              />
              Mark as Favorite (pins app &amp; account to top)
            </label>
          </div>
        </div>

        <div className="vault-divider mt-6 flex items-center justify-end gap-2.5 border-t pt-4">
          <button
            type="button"
            onClick={closeModal}
            className="vault-inset vault-text-secondary rounded-xl px-4 py-2.5 text-xs font-semibold hover:opacity-80"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || domainMismatch}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {isEdit
              ? "Save Changes"
              : lockedDomain
                ? `Add to ${lockedAppName}`
                : "Encrypt & Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
