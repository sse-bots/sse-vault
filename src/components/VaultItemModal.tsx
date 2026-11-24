"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Fingerprint,
  FolderPlus,
  Folders,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
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
import {
  OAUTH_PROVIDER_PRESETS,
  VAULT_CATEGORIES,
  type VaultAuthType,
  type VaultCategory,
  type VaultItemDTO,
} from "@/lib/vault-types";

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
  const [category, setCategory] = useState<VaultCategory>(
    initialItem?.category || "personal"
  );

  // Standard Password vs OAuth (Email Only)
  const [authType, setAuthType] = useState<VaultAuthType>(
    initialItem?.authType || "password"
  );
  const [oauthProvider, setOauthProvider] = useState(
    initialItem?.oauthProvider || "Google"
  );
  const [customProvider, setCustomProvider] = useState(
    initialItem?.oauthProvider &&
      !OAUTH_PROVIDER_PRESETS.some((p) => p.name === initialItem.oauthProvider)
      ? initialItem.oauthProvider
      : ""
  );

  const [email, setEmail] = useState(initialItem?.email || "");
  const [username, setUsername] = useState(initialItem?.username || "");
  const [password, setPassword] = useState(initialItem?.password || "");
  const [showPassword, setShowPassword] = useState(false);

  // Explicit Checkboxes for TOTP, Backup Security Keys & Passkey
  const [enableTotp, setEnableTotp] = useState(
    Boolean(initialItem?.totpSecret)
  );
  const [totpSecret, setTotpSecret] = useState(initialItem?.totpSecret || "");

  const [enableSecurityCodes, setEnableSecurityCodes] = useState(
    Boolean(initialItem && initialItem.securityCodes.length > 0)
  );
  const [codesMode, setCodesMode] = useState<"keep" | "append" | "replace">(
    isEdit ? "keep" : "replace"
  );
  const [parsedCodes, setParsedCodes] = useState<string[]>([]);
  const [manualCodeInput, setManualCodeInput] = useState("");
  const [fileFeedback, setFileFeedback] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [hasPasskey, setHasPasskey] = useState(Boolean(initialItem?.hasPasskey));
  const [notes, setNotes] = useState(initialItem?.notes || "");
  const [favorite, setFavorite] = useState(Boolean(initialItem?.favorite));

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
    if (authType === "oauth" && !email.trim()) {
      setError("Enter the email address used for OAuth sign-in.");
      return;
    }

    setSaving(true);
    setError(null);

    const resolvedOAuthProvider =
      oauthProvider === "Custom"
        ? customProvider.trim() || "OAuth"
        : oauthProvider;

    const finalTotp = enableTotp ? totpSecret.trim() : "";

    let finalCodesMode: "keep" | "append" | "replace" = "keep";
    let finalCodes: string[] | undefined = undefined;

    if (!enableSecurityCodes) {
      if (isEdit) {
        finalCodesMode = "replace";
        finalCodes = [];
      } else {
        finalCodes = [];
      }
    } else if (parsedCodes.length > 0) {
      finalCodesMode = isEdit ? codesMode : "replace";
      finalCodes = parsedCodes;
    } else if (!isEdit) {
      finalCodes = [];
    }

    try {
      const endpoint = isEdit ? `/api/vault/${initialItem!.id}` : "/api/vault";
      const method = isEdit ? "PATCH" : "POST";

      const payload = {
        label,
        url,
        expectedDomain: lockedDomain || undefined,
        authType,
        oauthProvider: authType === "oauth" ? resolvedOAuthProvider : "",
        category,
        hasPasskey,
        email: email.trim(),
        username: authType === "oauth" ? "" : username.trim(),
        password: authType === "oauth" ? "" : password,
        totpSecret: finalTotp,
        notes,
        favorite,
        ...(isEdit
          ? {
              securityCodesMode: finalCodesMode,
              securityCodes: finalCodes,
            }
          : {
              securityCodes: finalCodes || [],
            }),
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
    <div className="animate-vault-fade fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="animate-vault-modal vault-card flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:rounded-3xl"
      >
        {/* Sticky Header */}
        <div className="vault-divider flex shrink-0 items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SiteIcon
              domainOrUrl={url || lockedDomain || ""}
              label={detectedAppName || lockedAppName || "New"}
              size="md"
            />
            <div className="min-w-0">
              <h2 className="vault-text-primary truncate text-base font-extrabold sm:text-lg">
                {isEdit
                  ? `Edit ${initialItem?.appName}`
                  : lockedDomain
                    ? `Add ${lockedAppName} Account`
                    : detectedAppName
                      ? `Save to ${detectedAppName}`
                      : "New Vault Entry"}
              </h2>
              <p className="vault-text-muted truncate text-[11px]">
                {lockedDomain
                  ? `Only ${lockedDomain} URLs allowed here`
                  : "Auto-groups by domain & fetches website icon"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="vault-inset vault-text-muted shrink-0 rounded-xl p-2 hover:text-amber-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Website URL + Account Label */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="vault-text-secondary text-xs font-semibold">
                    Website URL *
                  </label>
                  {lockedDomain && (
                    <span className="truncate rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-500">
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
                  placeholder="e.g. Personal, Dev, Gaming"
                  className="vault-input w-full rounded-xl px-3.5 py-2.5 text-xs"
                />
              </div>
            </div>

            {domainMismatch ? (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Only <code>{lockedDomain}</code> URLs are allowed inside{" "}
                  <strong>{lockedAppName}</strong>.
                </span>
              </div>
            ) : detectedDomain && !isEdit ? (
              <div className="vault-inset flex items-center gap-2 rounded-xl px-3 py-2 text-[11px]">
                {matchedExistingGroup ? (
                  <>
                    <Folders className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span className="vault-text-secondary min-w-0 truncate">
                      Existing{" "}
                      <strong className="vault-text-primary">
                        {matchedExistingGroup.appName}
                      </strong>{" "}
                      group ({matchedExistingGroup.accountCount}) — will add
                      inside it.
                    </span>
                  </>
                ) : (
                  <>
                    <FolderPlus className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span className="vault-text-secondary min-w-0 truncate">
                      Will create new{" "}
                      <strong className="vault-text-primary">
                        {detectedAppName}
                      </strong>{" "}
                      (<code>{detectedDomain}</code>) app group.
                    </span>
                  </>
                )}
              </div>
            ) : null}
          </div>

          {/* 2. Login Method Switcher: Password Login vs OAuth Sign-In */}
          <div className="space-y-3">
            <label className="vault-text-secondary block text-xs font-semibold">
              Login Method
            </label>
            <div className="vault-inset grid grid-cols-2 gap-1.5 rounded-2xl p-1.5">
              <button
                type="button"
                onClick={() => setAuthType("password")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
                  authType === "password"
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "vault-text-secondary hover:text-amber-500"
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                Password Login
              </button>
              <button
                type="button"
                onClick={() => setAuthType("oauth")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
                  authType === "oauth"
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "vault-text-secondary hover:text-amber-500"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                OAuth (Email Only)
              </button>
            </div>

            {authType === "oauth" ? (
              <div className="vault-inset space-y-3 rounded-2xl p-3.5">
                <div>
                  <label className="vault-text-secondary mb-2 block text-[11px] font-bold uppercase tracking-wider">
                    Signed In With Provider
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {OAUTH_PROVIDER_PRESETS.map((p) => {
                      const active = oauthProvider === p.name;
                      return (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => setOauthProvider(p.name)}
                          className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-bold transition ${
                            active
                              ? "border-amber-500 bg-amber-500/15 text-amber-500"
                              : "vault-card vault-text-secondary hover:border-amber-500/50"
                          }`}
                        >
                          <SiteIcon
                            domainOrUrl={p.domain}
                            label={p.name}
                            size="sm"
                            className="!h-6 !w-6 !rounded-lg"
                          />
                          <span className="truncate">{p.name}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setOauthProvider("Custom")}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold transition ${
                        oauthProvider === "Custom"
                          ? "border-amber-500 bg-amber-500/15 text-amber-500"
                          : "vault-card vault-text-secondary hover:border-amber-500/50"
                      }`}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Custom
                    </button>
                  </div>
                </div>

                {oauthProvider === "Custom" && (
                  <input
                    required
                    value={customProvider}
                    onChange={(e) => setCustomProvider(e.target.value)}
                    placeholder="Provider name (e.g. GitLab, Steam, Twitch)"
                    className="vault-input w-full rounded-xl px-3.5 py-2 text-xs"
                  />
                )}

                <div>
                  <label className="vault-text-secondary mb-1 block text-xs font-semibold">
                    OAuth Account Email *
                  </label>
                  <div className="relative">
                    <Mail className="vault-text-muted pointer-events-none absolute left-3 top-2.5 h-4 w-4" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email used with this OAuth provider"
                      className="vault-input w-full rounded-xl py-2.5 pl-9 pr-3 text-xs"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
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
                      Username (optional — either or both)
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

                {/* Password + Strength + Generator */}
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
              </div>
            )}
          </div>

          {/* 3. Checkboxes for TOTP, Backup Security Codes & Passkey */}
          <div className="space-y-3">
            <label className="vault-text-secondary block text-xs font-semibold">
              Security Extras (Toggle What You Need)
            </label>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border p-3 text-xs font-bold transition ${
                  enableTotp
                    ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-500"
                    : "vault-inset vault-text-secondary"
                }`}
              >
                <input
                  type="checkbox"
                  checked={enableTotp}
                  onChange={(e) => setEnableTotp(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-cyan-500"
                />
                <Smartphone className="h-4 w-4 shrink-0" />
                <span className="truncate">TOTP 2FA</span>
              </label>

              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border p-3 text-xs font-bold transition ${
                  enableSecurityCodes
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-500"
                    : "vault-inset vault-text-secondary"
                }`}
              >
                <input
                  type="checkbox"
                  checked={enableSecurityCodes}
                  onChange={(e) => setEnableSecurityCodes(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-amber-500"
                />
                <KeyRound className="h-4 w-4 shrink-0" />
                <span className="truncate">Security Keys</span>
              </label>

              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border p-3 text-xs font-bold transition ${
                  hasPasskey
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-500"
                    : "vault-inset vault-text-secondary"
                }`}
              >
                <input
                  type="checkbox"
                  checked={hasPasskey}
                  onChange={(e) => setHasPasskey(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-emerald-500"
                />
                <Fingerprint className="h-4 w-4 shrink-0" />
                <span className="truncate">Passkey Active</span>
              </label>
            </div>

            {/* Conditional TOTP Secret Section */}
            {enableTotp && (
              <div className="vault-inset space-y-2.5 rounded-2xl p-3.5">
                <div>
                  <label className="vault-text-secondary mb-1 block text-xs font-semibold">
                    TOTP Secret Key or <code>otpauth://</code> URI
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
            )}

            {/* Conditional Security Codes (.txt Zero-Storage Importer) */}
            {enableSecurityCodes && (
              <div className="vault-inset space-y-3 rounded-2xl p-3.5 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="vault-text-primary flex items-center gap-1.5 text-xs font-bold">
                      <FileText className="h-4 w-4 text-amber-500" />
                      Backup Security Keys (.txt Importer)
                    </div>
                    <p className="vault-text-muted mt-0.5 text-[11px]">
                      Parsed in memory —{" "}
                      <strong className="text-emerald-500">
                        the .txt file is never stored.
                      </strong>
                    </p>
                  </div>
                  {isEdit &&
                    initialItem &&
                    initialItem.securityCodes.length > 0 && (
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
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition ${
                    isDragging
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-zinc-500/30 hover:border-amber-500/70"
                  }`}
                >
                  <Upload className="mb-1.5 h-5 w-5 text-amber-500" />
                  <div className="vault-text-primary text-xs font-bold">
                    Tap or Drop <code>.txt</code> Backup Codes File
                  </div>
                  <div className="vault-text-muted mt-0.5 text-[11px]">
                    GitHub, Discord, Google &amp; SSE recovery files
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
                    placeholder="Or paste / type security code(s)..."
                    className="vault-input min-w-0 flex-1 rounded-xl px-3 py-2 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualCodes}
                    className="vault-card vault-text-primary inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold hover:border-amber-500"
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

                    <div className="vault-card flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-xl p-2.5">
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
            )}
          </div>

          {/* 4. Category Pills + Notes + Favorite */}
          <div className="space-y-3">
            <div>
              <label className="vault-text-secondary mb-1.5 block text-xs font-semibold">
                Category
              </label>
              <div className="flex flex-wrap gap-1.5">
                {VAULT_CATEGORIES.map((cat) => {
                  const active = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${
                        active
                          ? "border-amber-500 bg-amber-500/15 text-amber-500"
                          : "vault-inset vault-text-muted hover:text-amber-500"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="vault-text-secondary mb-1 block text-xs font-semibold">
                Encrypted Notes (optional)
              </label>
              <textarea
                rows={2}
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Recovery hints, security questions, billing notes..."
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

        {/* Sticky Footer */}
        <div className="vault-divider flex shrink-0 items-center justify-end gap-2.5 border-t px-4 py-3.5 sm:px-6">
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
