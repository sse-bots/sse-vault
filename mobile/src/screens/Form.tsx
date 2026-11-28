import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { api } from "../api";
import { useVault } from "../vault";
import {
  CATEGORIES,
  type Category,
  type ItemInput,
  type VaultItem,
} from "../types";
import {
  Button,
  Card,
  Chip,
  Field,
  IconButton,
  Inset,
  SiteIcon,
  StrengthMeter,
} from "../ui";
import {
  evaluatePasswordStrength,
  extractDomainKey,
  getAppNameForDomain,
  isUrlAllowedForDomain,
} from "../lib/domain";
import { extractSecurityCodesFromText } from "../lib/parse-codes";
import {
  buildOAuthProviderCatalog,
  findParentOAuthAccount,
  resolveOAuthProviderDomain,
} from "../lib/oauth-links";
import { formatCode, generateTotp, parseTotp, secondsLeft } from "../totp";
import { Countdown, useNow } from "./Authenticator";
import { c, radius } from "../theme";

const POOL =
  "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_";

function generateStrongPassword(len = 20): string {
  const bytes = Crypto.getRandomBytes(len * 2);
  let out = "";
  for (let i = 0; i < bytes.length && out.length < len; i++) {
    if (bytes[i] < 256 - (256 % POOL.length)) {
      out += POOL[bytes[i] % POOL.length];
    }
  }
  return out;
}

export default function Form({
  id,
  presetUrl,
  lockedDomain,
  presetParentId,
  onClose,
}: {
  id?: string;
  presetUrl?: string;
  lockedDomain?: string;
  presetParentId?: string;
  onClose: () => void;
}) {
  const { items, groups, refresh } = useVault();
  const now = useNow();

  const existing = id ? items.find((i) => i.id === id) : undefined;
  const presetParent = presetParentId
    ? items.find((i) => i.id === presetParentId) || null
    : null;
  const isEdit = Boolean(existing);

  const initialResolvedParent = useMemo(() => {
    if (presetParent) return presetParent;
    if (existing && existing.authType === "oauth") {
      return findParentOAuthAccount(existing, items);
    }
    return null;
  }, [presetParent, existing, items]);

  const initialProviderDomain = useMemo(() => {
    if (presetParent) return presetParent.domainKey;
    if (existing && existing.authType === "oauth") {
      return (
        resolveOAuthProviderDomain(existing) ||
        initialResolvedParent?.domainKey ||
        "google.com"
      );
    }
    return "google.com";
  }, [presetParent, existing, initialResolvedParent]);

  const [url, setUrl] = useState(
    existing?.url ||
      (lockedDomain ? `https://${lockedDomain}` : presetUrl || "")
  );
  const [label, setLabel] = useState(existing?.label || "");
  const [category, setCategory] = useState<Category>(
    existing?.category || "personal"
  );

  // Login Method: Password Login vs OAuth / Connect
  const [authType, setAuthType] = useState<"password" | "oauth">(
    presetParent ? "oauth" : existing?.authType || "password"
  );
  const [oauthSearch, setOauthSearch] = useState("");
  const [selectedProviderDomain, setSelectedProviderDomain] = useState<string>(
    initialProviderDomain
  );
  const [selectedProviderName, setSelectedProviderName] = useState<string>(
    presetParent?.appName ||
      existing?.oauthProvider ||
      getAppNameForDomain(initialProviderDomain) ||
      "Google"
  );
  const [isCustomProvider, setIsCustomProvider] = useState(false);
  const [customProviderName, setCustomProviderName] = useState("");
  const [customProviderDomain, setCustomProviderDomain] = useState("");
  const [oauthLinkedItemId, setOauthLinkedItemId] = useState<string>(
    presetParent?.id || initialResolvedParent?.id || ""
  );

  // Inline Quick-Create Provider Account
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickEmail, setQuickEmail] = useState("");
  const [quickUsername, setQuickUsername] = useState("");
  const [quickPassword, setQuickPassword] = useState("");
  const [quickCreating, setQuickCreating] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const [email, setEmail] = useState(
    presetParent?.email || presetParent?.username || existing?.email || ""
  );
  const [username, setUsername] = useState(existing?.username || "");
  const [password, setPassword] = useState(existing?.password || "");
  const [showPassword, setShowPassword] = useState(false);

  // Exact Website Security Extras Checkboxes
  const [enableTotp, setEnableTotp] = useState(Boolean(existing?.totpSecret));
  const [totpSecret, setTotpSecret] = useState(existing?.totpSecret || "");

  const [enableSecurityCodes, setEnableSecurityCodes] = useState(
    Boolean(existing && existing.securityCodes.length > 0)
  );
  const [codesMode, setCodesMode] = useState<"keep" | "append" | "replace">(
    isEdit ? "keep" : "replace"
  );
  const [parsedCodes, setParsedCodes] = useState<string[]>([]);
  const [manualCodeInput, setManualCodeInput] = useState("");
  const [fileFeedback, setFileFeedback] = useState<string | null>(null);

  const [hasPasskey, setHasPasskey] = useState(Boolean(existing?.hasPasskey));
  const [notes, setNotes] = useState(existing?.notes || "");
  const [favorite, setFavorite] = useState(Boolean(existing?.favorite));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectedDomain = useMemo(() => extractDomainKey(url), [url]);
  const detectedAppName = useMemo(
    () => (detectedDomain ? getAppNameForDomain(detectedDomain) : ""),
    [detectedDomain]
  );

  const matchedExistingGroup = useMemo(
    () => groups.find((g) => g.domainKey === detectedDomain) || null,
    [groups, detectedDomain]
  );

  const domainMismatch = Boolean(
    lockedDomain && url.trim() && !isUrlAllowedForDomain(url, lockedDomain)
  );
  const lockedAppName = lockedDomain ? getAppNameForDomain(lockedDomain) : "";
  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);
  const previewTotpCfg = useMemo(() => parseTotp(totpSecret), [totpSecret]);

  // All providers: 6 built-ins + EVERY website/app saved in the vault
  const providerCatalog = useMemo(
    () =>
      buildOAuthProviderCatalog(
        items,
        lockedDomain || detectedDomain || null,
        existing?.id || null
      ),
    [items, lockedDomain, detectedDomain, existing?.id]
  );

  const oauthSearchResults = useMemo(() => {
    const q = oauthSearch.trim().toLowerCase();
    if (!q) {
      return {
        providers: providerCatalog,
        directAccounts: [] as VaultItem[],
      };
    }

    const providers = providerCatalog.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.domain.toLowerCase().includes(q) ||
        p.accounts.some(
          (a) =>
            (a.email || "").toLowerCase().includes(q) ||
            (a.username || "").toLowerCase().includes(q) ||
            a.label.toLowerCase().includes(q)
        )
    );

    const directAccounts = items
      .filter((a) => a.id !== existing?.id)
      .filter((a) => {
        const curDom = (lockedDomain || detectedDomain || "").toLowerCase();
        if (curDom && a.domainKey.toLowerCase() === curDom) return false;
        return (
          a.appName.toLowerCase().includes(q) ||
          a.domainKey.toLowerCase().includes(q) ||
          (a.email || "").toLowerCase().includes(q) ||
          (a.username || "").toLowerCase().includes(q) ||
          a.label.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);

    return { providers, directAccounts };
  }, [
    oauthSearch,
    providerCatalog,
    items,
    existing?.id,
    lockedDomain,
    detectedDomain,
  ]);

  const activeProviderOption = useMemo(
    () =>
      providerCatalog.find(
        (p) => p.domain === selectedProviderDomain.toLowerCase()
      ) || null,
    [providerCatalog, selectedProviderDomain]
  );

  const linkedAccountObj = useMemo(
    () => items.find((i) => i.id === oauthLinkedItemId) || null,
    [items, oauthLinkedItemId]
  );

  function selectProvider(domain: string, name: string) {
    setIsCustomProvider(false);
    setSelectedProviderDomain(domain);
    setSelectedProviderName(name);
    setShowQuickCreate(false);
    setQuickError(null);
    if (linkedAccountObj && linkedAccountObj.domainKey !== domain) {
      setOauthLinkedItemId("");
    }
  }

  function connectVaultAccount(acc: VaultItem) {
    setIsCustomProvider(false);
    setSelectedProviderDomain(acc.domainKey);
    setSelectedProviderName(acc.appName);
    setOauthLinkedItemId(acc.id);
    setEmail(acc.email || acc.username || acc.label || "");
    setShowQuickCreate(false);
    setQuickError(null);
  }

  async function handleQuickCreateProviderAccount() {
    setQuickError(null);
    const targetDomain = isCustomProvider
      ? extractDomainKey(customProviderDomain || customProviderName)
      : selectedProviderDomain;

    if (!targetDomain) {
      setQuickError("Enter a valid provider domain (e.g. gitlab.com) first.");
      return;
    }
    if (!quickEmail.trim() && !quickUsername.trim()) {
      setQuickError("Enter at least an email or username for the new account.");
      return;
    }

    setQuickCreating(true);
    try {
      const res = await api.createItem({
        url: `https://${targetDomain}`,
        label: isCustomProvider
          ? customProviderName.trim() || getAppNameForDomain(targetDomain)
          : selectedProviderName,
        authType: "password",
        email: quickEmail.trim(),
        username: quickUsername.trim(),
        password: quickPassword,
        category,
      });
      await refresh();
      if (res?.item) {
        connectVaultAccount(res.item);
      }
      setQuickEmail("");
      setQuickUsername("");
      setQuickPassword("");
      setShowQuickCreate(false);
    } catch (e) {
      setQuickError((e as Error).message || "Could not create provider account.");
    } finally {
      setQuickCreating(false);
    }
  }

  async function pickTxtBackupFile() {
    setError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["text/plain", "*/*"],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      if (asset.size && asset.size > 512 * 1024) {
        setError("Please select a plain .txt file smaller than 512 KB.");
        await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => {});
        return;
      }
      const text = await FileSystem.readAsStringAsync(asset.uri);
      // Zero-storage guarantee: immediately wipe temporary cache copy
      await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => {});

      const extracted = extractSecurityCodesFromText(text);
      if (extracted.length === 0) {
        setError(
          `No security codes could be detected inside "${asset.name}". Try pasting them below.`
        );
        return;
      }
      setParsedCodes((prev) => Array.from(new Set([...prev, ...extracted])));
      if (isEdit && codesMode === "keep") setCodesMode("append");
      setFileFeedback(
        `Extracted ${extracted.length} security code(s) from "${asset.name}" in memory — file discarded and never stored.`
      );
    } catch (e) {
      setError((e as Error).message || "Could not read that .txt file.");
    }
  }

  function handleAddManualCodes() {
    const extracted = extractSecurityCodesFromText(manualCodeInput);
    if (extracted.length === 0) return;
    setParsedCodes((prev) => Array.from(new Set([...prev, ...extracted])));
    if (isEdit && codesMode === "keep") setCodesMode("append");
    setManualCodeInput("");
  }

  async function handleSave() {
    setError(null);
    if (!url.trim()) {
      setError("Website URL is required (e.g. github.com or vercel.com).");
      return;
    }
    if (domainMismatch) {
      setError(`Only ${lockedDomain} URLs are allowed inside ${lockedAppName}.`);
      return;
    }

    const resolvedOAuthEmail =
      email.trim() ||
      linkedAccountObj?.email ||
      linkedAccountObj?.username ||
      "";

    if (authType === "oauth" && !resolvedOAuthEmail) {
      setError(
        "Select an existing provider account or enter the email used for OAuth sign-in."
      );
      return;
    }

    const resolvedOAuthProvider = isCustomProvider
      ? customProviderName.trim() || "OAuth"
      : linkedAccountObj?.appName || selectedProviderName || "Google";

    const resolvedOAuthDomain = isCustomProvider
      ? extractDomainKey(customProviderDomain) || ""
      : linkedAccountObj?.domainKey || selectedProviderDomain || "";

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

    const payload: ItemInput = {
      label: label.trim(),
      url: url.trim(),
      expectedDomain: lockedDomain || undefined,
      authType,
      oauthProvider: authType === "oauth" ? resolvedOAuthProvider : "",
      oauthProviderDomain: authType === "oauth" ? resolvedOAuthDomain : "",
      oauthLinkedItemId: authType === "oauth" ? oauthLinkedItemId : "",
      category,
      hasPasskey,
      email: authType === "oauth" ? resolvedOAuthEmail : email.trim(),
      username: authType === "oauth" ? "" : username.trim(),
      password: authType === "oauth" ? "" : password,
      totpSecret: finalTotp,
      notes: notes.trim(),
      favorite,
      ...(isEdit
        ? { securityCodesMode: finalCodesMode, securityCodes: finalCodes }
        : { securityCodes: finalCodes || [] }),
    };

    setSaving(true);
    try {
      if (existing) {
        await api.updateItem(existing.id, payload);
      } else {
        await api.createItem(payload);
      }
      await refresh();
      onClose();
    } catch (e) {
      const msg = (e as Error).message || "Could not save vault entry.";
      setError(msg);
      Alert.alert("Couldn't save", msg);
    } finally {
      setSaving(false);
    }
  }

  const headerTitle = isEdit
    ? `Edit ${existing?.appName}`
    : lockedDomain
      ? `Add ${lockedAppName} Account`
      : presetParent
        ? `Connect to ${presetParent.appName}`
        : detectedAppName
          ? `Save to ${detectedAppName}`
          : "New Vault Entry";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Existing App Header Bar — kept untouched! */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <IconButton icon="close" onPress={onClose} label="Close" />
        <Text
          numberOfLines={1}
          style={{
            color: c.text,
            fontSize: 17,
            fontWeight: "800",
            flex: 1,
            textAlign: "center",
          }}
        >
          {headerTitle}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Live Website Icon & Subtitle Card (matches Website Modal Header) */}
        <Card
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <SiteIcon
            domain={url || lockedDomain || ""}
            name={detectedAppName || lockedAppName || "New"}
            size={44}
          />
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ color: c.text, fontSize: 15, fontWeight: "800" }}
            >
              {headerTitle}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: c.muted, fontSize: 11, marginTop: 2 }}
            >
              {lockedDomain
                ? `Only ${lockedDomain} URLs allowed here`
                : "Auto-groups by domain & fetches website icon"}
            </Text>
          </View>
        </Card>

        {error ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
              backgroundColor: c.danger + "1a",
              borderWidth: 1,
              borderColor: c.danger + "66",
              borderRadius: radius.lg,
              padding: 12,
              marginBottom: 14,
            }}
          >
            <Ionicons
              name="warning-outline"
              size={16}
              color={c.danger}
              style={{ marginTop: 1 }}
            />
            <Text style={{ color: c.danger, fontSize: 12, flex: 1 }}>
              {error}
            </Text>
          </View>
        ) : null}

        {/* 1. Website URL + Account Label + Live Segregation Pill */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <Text style={{ color: c.muted, fontSize: 12, fontWeight: "700" }}>
            Website URL *
          </Text>
          {lockedDomain ? (
            <View
              style={{
                backgroundColor: c.accentSoft,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
              }}
            >
              <Text
                style={{
                  color: c.accentLabel,
                  fontSize: 10,
                  fontWeight: "800",
                  fontFamily: "monospace",
                }}
              >
                Only {lockedDomain}
              </Text>
            </View>
          ) : null}
        </View>
        <Field
          icon="globe-outline"
          value={url}
          onChangeText={setUrl}
          placeholder={
            lockedDomain
              ? `https://${lockedDomain}`
              : "vercel.com, render.com, github.com..."
          }
          keyboardType="url"
          errorBorder={domainMismatch}
        />

        <Field
          label="Account Label (optional)"
          value={label}
          onChangeText={setLabel}
          placeholder="e.g. Personal, Dev, Gaming"
          autoCapitalize="words"
        />

        {/* Domain Mismatch or Live Group Segregation Feedback */}
        {domainMismatch ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: c.danger + "1a",
              borderColor: c.danger + "66",
              borderWidth: 1,
              borderRadius: radius.md,
              padding: 10,
              marginBottom: 14,
            }}
          >
            <Ionicons name="warning" size={15} color={c.danger} />
            <Text style={{ color: c.danger, fontSize: 11, fontWeight: "700", flex: 1 }}>
              Only {lockedDomain} URLs are allowed inside {lockedAppName}.
            </Text>
          </View>
        ) : detectedDomain && !isEdit ? (
          <Inset
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 9,
              marginBottom: 14,
            }}
          >
            <Ionicons
              name={matchedExistingGroup ? "folder-open-outline" : "folder-outline"}
              size={15}
              color={matchedExistingGroup ? c.ok : c.accentLabel}
            />
            <Text style={{ color: c.muted, fontSize: 11, flex: 1 }}>
              {matchedExistingGroup ? (
                <>
                  Existing{" "}
                  <Text style={{ color: c.text, fontWeight: "800" }}>
                    {matchedExistingGroup.appName}
                  </Text>{" "}
                  group ({matchedExistingGroup.items.length}) — will add inside it.
                </>
              ) : (
                <>
                  Will create new{" "}
                  <Text style={{ color: c.text, fontWeight: "800" }}>
                    {detectedAppName}
                  </Text>{" "}
                  ({detectedDomain}) app group.
                </>
              )}
            </Text>
          </Inset>
        ) : null}

        {/* 2. Login Method Switcher (Exact Website 2-Tab Pill) */}
        <Text
          style={{
            color: c.muted,
            fontSize: 12,
            fontWeight: "700",
            marginBottom: 8,
          }}
        >
          Login Method
        </Text>
        <View
          style={{
            flexDirection: "row",
            gap: 6,
            backgroundColor: c.card2,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.lg,
            padding: 5,
            marginBottom: 14,
          }}
        >
          <Pressable
            onPress={() => setAuthType("password")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 10,
              borderRadius: radius.md,
              backgroundColor: authType === "password" ? c.accent : "transparent",
            }}
          >
            <Ionicons
              name="lock-closed-outline"
              size={15}
              color={authType === "password" ? c.accentText : c.muted}
            />
            <Text
              style={{
                color: authType === "password" ? c.accentText : c.muted,
                fontSize: 12,
                fontWeight: "800",
              }}
            >
              Password Login
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setAuthType("oauth")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 10,
              borderRadius: radius.md,
              backgroundColor: authType === "oauth" ? c.accent : "transparent",
            }}
          >
            <Ionicons
              name="link-outline"
              size={15}
              color={authType === "oauth" ? c.accentText : c.muted}
            />
            <Text
              style={{
                color: authType === "oauth" ? c.accentText : c.muted,
                fontSize: 12,
                fontWeight: "800",
              }}
            >
              OAuth / Connect
            </Text>
          </Pressable>
        </View>

        {authType === "oauth" ? (
          <Inset style={{ gap: 12, marginBottom: 14 }}>
            {/* Active Linked Account Pill */}
            {linkedAccountObj ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  backgroundColor: c.ok + "1a",
                  borderWidth: 1,
                  borderColor: c.ok + "66",
                  borderRadius: radius.lg,
                  padding: 10,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    flex: 1,
                  }}
                >
                  <SiteIcon
                    domain={linkedAccountObj.domainKey}
                    name={linkedAccountObj.appName}
                    size={32}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: c.ok,
                        fontSize: 10,
                        fontWeight: "900",
                        letterSpacing: 0.5,
                      }}
                    >
                      CONNECTED TO {linkedAccountObj.appName.toUpperCase()}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: c.text,
                        fontSize: 12,
                        fontWeight: "700",
                        fontFamily: "monospace",
                        marginTop: 2,
                      }}
                    >
                      {linkedAccountObj.username
                        ? `${linkedAccountObj.username}${linkedAccountObj.email ? ` · ${linkedAccountObj.email}` : ""}`
                        : linkedAccountObj.email || linkedAccountObj.label}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => setOauthLinkedItemId("")}
                  style={{
                    backgroundColor: c.card,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: radius.sm,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    style={{ color: c.danger, fontSize: 11, fontWeight: "800" }}
                  >
                    Unlink
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Unified Search Box across ALL Providers & Existing Vault Accounts */}
            <View>
              <Text
                style={{
                  color: c.muted,
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 0.6,
                  marginBottom: 6,
                }}
              >
                SEARCH PROVIDERS OR VAULT ACCOUNTS
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.borderStrong,
                  borderRadius: radius.md,
                  paddingHorizontal: 10,
                }}
              >
                <Ionicons name="search" size={16} color={c.faint} />
                <TextInput
                  value={oauthSearch}
                  onChangeText={setOauthSearch}
                  placeholder="Search Google, GitHub, Discord, email, username..."
                  placeholderTextColor={c.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    color: c.text,
                    paddingVertical: 9,
                    paddingHorizontal: 8,
                    fontSize: 13,
                  }}
                />
                {oauthSearch ? (
                  <Pressable onPress={() => setOauthSearch("")}>
                    <Ionicons name="close-circle" size={16} color={c.faint} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* Matching Vault Accounts Direct Tap-to-Connect */}
            {oauthSearch.trim() &&
            oauthSearchResults.directAccounts.length > 0 ? (
              <View style={{ gap: 6 }}>
                <Text
                  style={{
                    color: c.faint,
                    fontSize: 10,
                    fontWeight: "800",
                    letterSpacing: 0.5,
                  }}
                >
                  MATCHING VAULT ACCOUNTS (TAP TO CONNECT)
                </Text>
                {oauthSearchResults.directAccounts.map((acc) => {
                  const isConn = oauthLinkedItemId === acc.id;
                  return (
                    <Pressable
                      key={acc.id}
                      onPress={() => connectVaultAccount(acc)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        backgroundColor: isConn ? c.ok + "1a" : c.card,
                        borderWidth: 1,
                        borderColor: isConn ? c.ok : c.border,
                        borderRadius: radius.md,
                        padding: 10,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          flex: 1,
                        }}
                      >
                        <SiteIcon
                          domain={acc.domainKey}
                          name={acc.appName}
                          size={28}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: c.text,
                              fontSize: 12,
                              fontWeight: "800",
                            }}
                          >
                            {acc.appName}
                            {acc.label !== acc.appName ? ` · ${acc.label}` : ""}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: c.muted,
                              fontSize: 10,
                              fontFamily: "monospace",
                            }}
                          >
                            {acc.username && acc.email
                              ? `@${acc.username} · ${acc.email}`
                              : acc.email || acc.username || acc.domainKey}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={{
                          backgroundColor: isConn ? c.ok : c.accentSoft,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: radius.sm,
                        }}
                      >
                        <Text
                          style={{
                            color: isConn ? "#09090b" : c.accentLabel,
                            fontSize: 10,
                            fontWeight: "900",
                          }}
                        >
                          {isConn ? "Linked" : "Connect"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {/* Provider Chips Grid (Built-In + All Vault Apps + Custom) */}
            <View>
              <Text
                style={{
                  color: c.faint,
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 0.5,
                  marginBottom: 8,
                }}
              >
                SELECT PROVIDER
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {oauthSearchResults.providers.map((p) => {
                  const active =
                    !isCustomProvider &&
                    selectedProviderDomain.toLowerCase() === p.domain;
                  return (
                    <Pressable
                      key={p.domain}
                      onPress={() => selectProvider(p.domain, p.name)}
                      style={{
                        width: "48%",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                        paddingHorizontal: 9,
                        paddingVertical: 8,
                        borderRadius: radius.md,
                        backgroundColor: active ? c.accentSoft : c.card,
                        borderWidth: 1,
                        borderColor: active ? c.accent : c.border,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          flex: 1,
                        }}
                      >
                        <SiteIcon domain={p.domain} name={p.name} size={24} />
                        <Text
                          numberOfLines={1}
                          style={{
                            color: active ? c.accentLabel : c.text,
                            fontSize: 12,
                            fontWeight: "800",
                            flex: 1,
                          }}
                        >
                          {p.name}
                        </Text>
                      </View>
                      {p.accounts.length > 0 ? (
                        <View
                          style={{
                            backgroundColor: c.card2,
                            borderRadius: 999,
                            paddingHorizontal: 6,
                            paddingVertical: 1,
                          }}
                        >
                          <Text
                            style={{
                              color: c.muted,
                              fontSize: 10,
                              fontWeight: "800",
                              fontFamily: "monospace",
                            }}
                          >
                            {p.accounts.length}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}

                <Pressable
                  onPress={() => {
                    setIsCustomProvider(true);
                    setOauthLinkedItemId("");
                    setShowQuickCreate(false);
                  }}
                  style={{
                    width: "48%",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: radius.md,
                    backgroundColor: isCustomProvider ? c.accentSoft : c.card,
                    borderWidth: 1,
                    borderColor: isCustomProvider ? c.accent : c.border,
                  }}
                >
                  <Ionicons
                    name="globe-outline"
                    size={15}
                    color={isCustomProvider ? c.accentLabel : c.muted}
                  />
                  <Text
                    style={{
                      color: isCustomProvider ? c.accentLabel : c.text,
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    Custom
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Custom Provider Inputs OR Existing Accounts under Selected Provider */}
            {isCustomProvider ? (
              <View style={{ gap: 4 }}>
                <Field
                  value={customProviderName}
                  onChangeText={setCustomProviderName}
                  placeholder="Provider name (e.g. GitLab, Steam)"
                />
                <Field
                  value={customProviderDomain}
                  onChangeText={setCustomProviderDomain}
                  placeholder="Provider domain (e.g. gitlab.com)"
                />
              </View>
            ) : (
              <Card style={{ padding: 12, gap: 10 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      color: c.text,
                      fontSize: 12,
                      fontWeight: "800",
                      flex: 1,
                    }}
                  >
                    Your {selectedProviderName} Accounts (
                    {activeProviderOption?.accounts.length || 0})
                  </Text>
                  <Pressable
                    onPress={() => {
                      setShowQuickCreate((v) => !v);
                      setQuickError(null);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: c.accentSoft,
                      paddingHorizontal: 9,
                      paddingVertical: 5,
                      borderRadius: radius.sm,
                    }}
                  >
                    <Ionicons
                      name={showQuickCreate ? "close" : "person-add-outline"}
                      size={13}
                      color={c.accentLabel}
                    />
                    <Text
                      style={{
                        color: c.accentLabel,
                        fontSize: 11,
                        fontWeight: "800",
                      }}
                    >
                      {showQuickCreate
                        ? "Cancel New"
                        : `Add New ${selectedProviderName}`}
                    </Text>
                  </Pressable>
                </View>

                {/* Inline Quick-Create Provider Account */}
                {showQuickCreate ? (
                  <Inset style={{ gap: 8 }}>
                    <Text
                      style={{
                        color: c.muted,
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      Create new {selectedProviderName} account in{" "}
                      {selectedProviderDomain} &amp; connect immediately:
                    </Text>
                    {quickError ? (
                      <Text
                        style={{
                          color: c.danger,
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {quickError}
                      </Text>
                    ) : null}
                    <Field
                      value={quickEmail}
                      onChangeText={setQuickEmail}
                      placeholder={`${selectedProviderName} email`}
                      keyboardType="email-address"
                    />
                    <Field
                      value={quickUsername}
                      onChangeText={setQuickUsername}
                      placeholder="Username (optional)"
                    />
                    <Field
                      value={quickPassword}
                      onChangeText={setQuickPassword}
                      placeholder="Password (optional)"
                      secureTextEntry
                    />
                    <Button
                      title="Create & Connect"
                      icon="add"
                      loading={quickCreating}
                      onPress={handleQuickCreateProviderAccount}
                      style={{ height: 42 }}
                    />
                  </Inset>
                ) : null}

                {activeProviderOption &&
                activeProviderOption.accounts.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    {activeProviderOption.accounts.map((acc) => {
                      const selected = oauthLinkedItemId === acc.id;
                      return (
                        <Pressable
                          key={acc.id}
                          onPress={() => connectVaultAccount(acc)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 9,
                            borderRadius: radius.md,
                            backgroundColor: selected ? c.accentSoft : c.card2,
                            borderWidth: 1,
                            borderColor: selected ? c.accent : c.border,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              numberOfLines={1}
                              style={{
                                color: c.text,
                                fontSize: 12,
                                fontWeight: "800",
                              }}
                            >
                              {acc.username
                                ? `${acc.username}${acc.label !== acc.appName && acc.label !== acc.username ? ` (${acc.label})` : ""}`
                                : acc.email || acc.label}
                            </Text>
                            {acc.email && acc.username ? (
                              <Text
                                numberOfLines={1}
                                style={{
                                  color: c.muted,
                                  fontSize: 10,
                                  fontFamily: "monospace",
                                  marginTop: 2,
                                }}
                              >
                                {acc.email}
                              </Text>
                            ) : null}
                          </View>
                          {selected ? (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 3,
                                backgroundColor: c.accent,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: radius.sm,
                              }}
                            >
                              <Ionicons
                                name="checkmark"
                                size={12}
                                color={c.accentText}
                              />
                              <Text
                                style={{
                                  color: c.accentText,
                                  fontSize: 10,
                                  fontWeight: "900",
                                }}
                              >
                                Connected
                              </Text>
                            </View>
                          ) : (
                            <Text
                              style={{
                                color: c.muted,
                                fontSize: 11,
                                fontWeight: "700",
                              }}
                            >
                              Select
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={{ color: c.muted, fontSize: 11, lineHeight: 16 }}>
                    No {selectedProviderName} accounts saved yet. Tap{" "}
                    <Text style={{ color: c.text, fontWeight: "700" }}>
                      Add New {selectedProviderName}
                    </Text>{" "}
                    above to save &amp; connect one, or type an email below.
                  </Text>
                )}
              </Card>
            )}

            {/* OAuth Email Input */}
            <Field
              label="OAuth Account Email *"
              icon="mail-outline"
              value={email}
              onChangeText={(val) => {
                setEmail(val);
                if (
                  linkedAccountObj &&
                  val.trim() !==
                    (linkedAccountObj.email || linkedAccountObj.username || "")
                ) {
                  setOauthLinkedItemId("");
                }
              }}
              placeholder="Email or username used with this OAuth provider"
              keyboardType="email-address"
            />
          </Inset>
        ) : (
          /* STANDARD PASSWORD LOGIN FIELDS */
          <View>
            <Field
              label="Email (optional)"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
            />
            <Field
              label="Username (optional — either or both)"
              icon="person-outline"
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. sseworld"
            />

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <Text style={{ color: c.muted, fontSize: 12, fontWeight: "700" }}>
                Password
              </Text>
              <Pressable
                onPress={() => {
                  setPassword(generateStrongPassword(20));
                  setShowPassword(true);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Ionicons name="refresh" size={12} color={c.accentLabel} />
                <Text
                  style={{
                    color: c.accentLabel,
                    fontSize: 11,
                    fontWeight: "800",
                  }}
                >
                  Generate Strong
                </Text>
              </Pressable>
            </View>
            <Field
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Account password"
              secureTextEntry={!showPassword}
              style={{ fontFamily: "monospace" }}
              right={
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  style={{ padding: 6 }}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={c.muted}
                  />
                </Pressable>
              }
            />
            {password ? (
              <StrengthMeter
                score={strength.score}
                label={strength.label}
                color={strength.color}
              />
            ) : null}
          </View>
        )}

        {/* 3. Security Extras Checkboxes (Exact 3 Website Checkboxes!) */}
        <Text
          style={{
            color: c.muted,
            fontSize: 12,
            fontWeight: "700",
            marginBottom: 8,
            marginTop: 4,
          }}
        >
          Security Extras (Toggle What You Need)
        </Text>
        <View style={{ gap: 8, marginBottom: 12 }}>
          <SecurityCheckboxRow
            checked={enableTotp}
            onPress={() => setEnableTotp((v) => !v)}
            icon="phone-portrait-outline"
            label="TOTP 2FA"
            activeColor={c.info}
          />
          <SecurityCheckboxRow
            checked={enableSecurityCodes}
            onPress={() => setEnableSecurityCodes((v) => !v)}
            icon="key-outline"
            label="Security Keys"
            activeColor={c.accent}
          />
          <SecurityCheckboxRow
            checked={hasPasskey}
            onPress={() => setHasPasskey((v) => !v)}
            icon="finger-print-outline"
            label="Passkey Active"
            activeColor={c.ok}
          />
        </View>

        {/* Conditional TOTP Secret + Live Preview */}
        {enableTotp ? (
          <Inset style={{ marginBottom: 14, gap: 8 }}>
            <Field
              label="TOTP Secret Key or otpauth:// URI"
              value={totpSecret}
              onChangeText={setTotpSecret}
              placeholder="e.g. JBSWY3DPEHPK3PXP or otpauth://totp/..."
              style={{ fontFamily: "monospace" }}
            />
            {previewTotpCfg ? (
              <Card
                style={{
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View>
                  <Text
                    style={{
                      color: c.info,
                      fontSize: 10,
                      fontWeight: "800",
                      letterSpacing: 0.7,
                    }}
                  >
                    LIVE TOTP PREVIEW
                  </Text>
                  <Text
                    style={{
                      color: c.text,
                      fontSize: 24,
                      fontWeight: "900",
                      letterSpacing: 3,
                      fontFamily: "monospace",
                      marginTop: 2,
                    }}
                  >
                    {formatCode(generateTotp(previewTotpCfg, now))}
                  </Text>
                </View>
                <Countdown
                  left={secondsLeft(previewTotpCfg, now)}
                  period={previewTotpCfg.period}
                />
              </Card>
            ) : null}
          </Inset>
        ) : null}

        {/* Conditional Backup Security Keys (.txt Zero-Storage Importer + Manual) */}
        {enableSecurityCodes ? (
          <Inset style={{ marginBottom: 14, gap: 10 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <View style={{ flex: 1, minWidth: 160 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={15}
                    color={c.accentLabel}
                  />
                  <Text
                    style={{ color: c.text, fontSize: 12, fontWeight: "800" }}
                  >
                    Backup Security Keys (.txt Importer)
                  </Text>
                </View>
                <Text style={{ color: c.muted, fontSize: 11, marginTop: 2 }}>
                  Parsed in memory —{" "}
                  <Text style={{ color: c.ok, fontWeight: "800" }}>
                    the .txt file is never stored.
                  </Text>
                </Text>
              </View>

              {isEdit && existing && existing.securityCodes.length > 0 ? (
                <View
                  style={{
                    flexDirection: "row",
                    backgroundColor: c.card,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: radius.sm,
                    padding: 3,
                    gap: 3,
                  }}
                >
                  {(["keep", "append", "replace"] as const).map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setCodesMode(m)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: Math.max(4, radius.sm - 2),
                        backgroundColor:
                          codesMode === m ? c.accent : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: codesMode === m ? c.accentText : c.muted,
                          fontSize: 10,
                          fontWeight: "800",
                          textTransform: "capitalize",
                        }}
                      >
                        {m}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Dashed .txt File Picker Box */}
            <Pressable
              onPress={pickTxtBackupFile}
              style={({ pressed }) => ({
                borderWidth: 1.5,
                borderStyle: "dashed",
                borderColor: pressed ? c.accent : c.borderStrong,
                borderRadius: radius.lg,
                padding: 16,
                alignItems: "center",
                backgroundColor: pressed ? c.accentSoft : c.card,
              })}
            >
              <Ionicons
                name="cloud-upload-outline"
                size={22}
                color={c.accentLabel}
              />
              <Text
                style={{
                  color: c.text,
                  fontSize: 12,
                  fontWeight: "800",
                  marginTop: 6,
                }}
              >
                Tap to Upload .txt Backup Codes File
              </Text>
              <Text style={{ color: c.muted, fontSize: 11, marginTop: 2 }}>
                GitHub, Discord, Google &amp; SSE recovery files
              </Text>
            </Pressable>

            {fileFeedback ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 6,
                  backgroundColor: c.ok + "1a",
                  borderWidth: 1,
                  borderColor: c.ok + "55",
                  borderRadius: radius.md,
                  padding: 10,
                }}
              >
                <Ionicons name="checkmark-circle" size={14} color={c.ok} />
                <Text style={{ color: c.ok, fontSize: 11, flex: 1 }}>
                  {fileFeedback}
                </Text>
              </View>
            ) : null}

            {/* Manual Code Entry Row */}
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput
                value={manualCodeInput}
                onChangeText={setManualCodeInput}
                onSubmitEditing={handleAddManualCodes}
                placeholder="Or paste / type security code(s)..."
                placeholderTextColor={c.faint}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  flex: 1,
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.borderStrong,
                  borderRadius: radius.md,
                  color: c.text,
                  paddingHorizontal: 11,
                  paddingVertical: 9,
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
              />
              <Pressable
                onPress={handleAddManualCodes}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.borderStrong,
                  borderRadius: radius.md,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                }}
              >
                <Ionicons name="add" size={15} color={c.text} />
                <Text style={{ color: c.text, fontSize: 12, fontWeight: "800" }}>
                  Add
                </Text>
              </Pressable>
            </View>

            {/* Removable Parsed Code Chips */}
            {parsedCodes.length > 0 ? (
              <View style={{ gap: 8 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{ color: c.muted, fontSize: 11, fontWeight: "700" }}
                  >
                    Separated Codes Ready ({parsedCodes.length}):
                  </Text>
                  <Pressable
                    onPress={() => {
                      setParsedCodes([]);
                      setFileFeedback(null);
                    }}
                  >
                    <Text
                      style={{
                        color: c.danger,
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      Clear All
                    </Text>
                  </Pressable>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                    backgroundColor: c.card,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: radius.md,
                    padding: 10,
                  }}
                >
                  {parsedCodes.map((code) => (
                    <View
                      key={code}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: c.card2,
                        borderWidth: 1,
                        borderColor: c.border,
                        borderRadius: radius.sm,
                        paddingHorizontal: 9,
                        paddingVertical: 5,
                      }}
                    >
                      <Text
                        style={{
                          color: c.accentLabel,
                          fontSize: 12,
                          fontWeight: "700",
                          fontFamily: "monospace",
                        }}
                      >
                        {code}
                      </Text>
                      <Pressable
                        onPress={() =>
                          setParsedCodes((prev) =>
                            prev.filter((x) => x !== code)
                          )
                        }
                        hitSlop={6}
                      >
                        <Ionicons name="close" size={13} color={c.faint} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </Inset>
        ) : null}

        {/* 4. Category Pills + Encrypted Notes + Favorite Checkbox */}
        <Text
          style={{
            color: c.muted,
            fontSize: 12,
            fontWeight: "700",
            marginBottom: 8,
          }}
        >
          Category
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
          {CATEGORIES.map((k) => (
            <Chip
              key={k.id}
              label={k.label}
              color={k.color}
              active={category === k.id}
              onPress={() => setCategory(k.id)}
            />
          ))}
        </View>

        <Field
          label="Encrypted Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Recovery hints, security questions, billing notes..."
          multiline
          autoCapitalize="sentences"
        />

        <Pressable
          onPress={() => setFavorite((v) => !v)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 8,
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 5,
              borderWidth: 1.5,
              borderColor: favorite ? c.accent : c.borderStrong,
              backgroundColor: favorite ? c.accent : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {favorite ? (
              <Ionicons name="checkmark" size={14} color={c.accentText} />
            ) : null}
          </View>
          <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>
            Mark as Favorite (pins app &amp; account to top)
          </Text>
        </Pressable>
      </ScrollView>

      {/* Sticky Bottom Action Bar (matches Website Modal Footer) */}
      <View
        style={{
          flexDirection: "row",
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.card,
        }}
      >
        <Button
          title="Cancel"
          variant="ghost"
          onPress={onClose}
          style={{ flex: 1, height: 44 }}
        />
        <Button
          title={
            isEdit
              ? "Save Changes"
              : lockedDomain
                ? `Add to ${lockedAppName}`
                : "Encrypt & Save"
          }
          icon="shield-checkmark-outline"
          loading={saving}
          disabled={domainMismatch}
          onPress={handleSave}
          style={{ flex: 2, height: 44 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function SecurityCheckboxRow({
  checked,
  onPress,
  icon,
  label,
  activeColor,
}: {
  checked: boolean;
  onPress: () => void;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  activeColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 11,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: checked ? activeColor : c.border,
        backgroundColor: checked ? activeColor + "1a" : c.card2,
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          borderWidth: 1.5,
          borderColor: checked ? activeColor : c.borderStrong,
          backgroundColor: checked ? activeColor : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? <Ionicons name="checkmark" size={12} color="#09090b" /> : null}
      </View>
      <Ionicons
        name={icon}
        size={17}
        color={checked ? activeColor : c.muted}
      />
      <Text
        style={{
          color: checked ? activeColor : c.text,
          fontSize: 13,
          fontWeight: "800",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
