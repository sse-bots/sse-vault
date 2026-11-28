import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { api } from "../api";
import { useVault } from "../vault";
import { useAuth } from "../auth";
import { usePrefs } from "../prefs";
import { CATEGORIES, type SecurityCode } from "../types";
import { formatCode, generateTotp, parseTotp, secondsLeft } from "../totp";
import { evaluatePasswordStrength } from "../lib/domain";
import { extractSecurityCodesFromText } from "../lib/parse-codes";
import {
  findParentOAuthAccount,
  getAccountTitle,
  getConnectedOAuthEntries,
  resolveOAuthProviderDomain,
} from "../lib/oauth-links";
import {
  Button,
  Card,
  IconButton,
  Inset,
  SiteIcon,
  Toast,
  copySecret,
  useToast,
} from "../ui";
import { Countdown, useNow } from "./Authenticator";
import { c, radius } from "../theme";

export default function Detail({
  id,
  onBack,
  onEdit,
  onOpen,
  onOpenDomain,
  onGoHome,
  onConnectNew,
}: {
  id: string;
  onBack: () => void;
  onEdit: () => void;
  onOpen: (id: string) => void;
  onOpenDomain: (domainKey: string) => void;
  onGoHome: () => void;
  onConnectNew: (parentId: string) => void;
}) {
  const { items, refresh, updateItemSafe, toggleCodeSafe, deleteItemSafe } = useVault();
  const { offline } = useAuth();
  const { privacyBlur } = usePrefs();
  const item = items.find((i) => i.id === id);
  const toast = useToast();
  const now = useNow();

  const [revealPassword, setRevealPassword] = useState(false);
  const [showRawTotp, setShowRawTotp] = useState(false);
  const [busyCodeId, setBusyCodeId] = useState<string | null>(null);
  const [importingTxt, setImportingTxt] = useState(false);
  const [oauthFilter, setOauthFilter] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [revealCard, setRevealCard] = useState(false);
  const [revealCf, setRevealCf] = useState<Record<string, boolean>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [shareExp, setShareExp] = useState<"10" | "60" | "1440">("60");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  const parent = useMemo(
    () => (item ? findParentOAuthAccount(item, items) : null),
    [item, items]
  );
  const connectedOAuths = useMemo(
    () => (item ? getConnectedOAuthEntries(item, items) : []),
    [item, items]
  );
  const filteredConnected = useMemo(() => {
    const q = oauthFilter.trim().toLowerCase();
    if (!q) return connectedOAuths;
    return connectedOAuths.filter(
      (x) =>
        x.appName.toLowerCase().includes(q) ||
        x.domainKey.toLowerCase().includes(q) ||
        x.label.toLowerCase().includes(q) ||
        (x.email || "").toLowerCase().includes(q)
    );
  }, [connectedOAuths, oauthFilter]);

  if (!item) {
    return (
      <View style={{ flex: 1, padding: 20 }}>
        <IconButton icon="chevron-back" onPress={onBack} />
        <Text style={{ color: c.muted, textAlign: "center", marginTop: 40 }}>
          This item no longer exists.
        </Text>
      </View>
    );
  }

  const totp = parseTotp(item.totpSecret);
  const cat = CATEGORIES.find((k) => k.id === item.category) || CATEGORIES[0];
  const pwdStrength =
    item.authType === "password" && item.password
      ? evaluatePasswordStrength(item.password)
      : null;

  const oauthDomain =
    parent?.domainKey || resolveOAuthProviderDomain(item) || "";

  const displayTitle = getAccountTitle(item);
  const unusedCount = item.securityCodes.filter((k) => !k.used).length;
  const totalCodes = item.securityCodes.length;
  const pctUnused =
    totalCodes > 0 ? Math.round((unusedCount / totalCodes) * 100) : 0;

  const copy = async (v: string | null, what: string) => {
    if (!v) return;
    await copySecret(v);
    toast.show(`${what} copied · clears in 30s`);
  };

  const confirmDelete = () =>
    Alert.alert(
      "Move to Trash?",
      `${displayTitle} will stay recoverable in Trash for 30 days.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Move to Trash",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteItemSafe(item.id);
              onBack();
            } catch (e) {
              Alert.alert("Error", (e as Error).message);
            }
          },
        },
      ]
    );

  const handleUseCode = async (k: SecurityCode) => {
    if (k.used || k.locked || busyCodeId) return;
    if (k.code) await copySecret(k.code);
    setBusyCodeId(k.id);
    try {
      await toggleCodeSafe(item.id, k.id, true);
      toast.show(offline ? "Copied & queued for sync!" : "Security key copied & masked!");
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setBusyCodeId(null);
    }
  };

  const handleRestoreCode = async (k: SecurityCode) => {
    if (!k.used || busyCodeId) return;
    setBusyCodeId(k.id);
    try {
      await toggleCodeSafe(item.id, k.id, false);
      toast.show(offline ? "Restored (queued for sync)" : "Security code restored.");
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setBusyCodeId(null);
    }
  };

  const handleQuickTxtImport = async () => {
    if (offline || importingTxt) return;
    setImportingTxt(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["text/plain", "*/*"],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      const text = await FileSystem.readAsStringAsync(asset.uri);
      await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(
        () => {}
      );
      const codes = extractSecurityCodesFromText(text);
      if (codes.length === 0) {
        toast.show("No security codes detected in .txt");
        return;
      }
      await api.appendCodes(item.id, codes);
      await refresh();
      toast.show(`Imported ${codes.length} key(s) — .txt discarded`);
    } catch (e) {
      Alert.alert("Import failed", (e as Error).message);
    } finally {
      setImportingTxt(false);
    }
  };

  const maskValue = (val: string) => (privacyBlur ? "••••••••" : val);

  return (
    <View style={{ flex: 1 }}>
      {/* Existing App Header Bar — kept untouched! */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 8,
        }}
      >
        <IconButton icon="chevron-back" onPress={onBack} label="Back" />
        <View style={{ flex: 1 }} />
        {!offline && (
          <IconButton
            icon="share-social-outline"
            onPress={() => {
              setShareUrl(null);
              setShareOpen(true);
            }}
            label="Share once"
          />
        )}
        <IconButton
          icon={item.favorite ? "star" : "star-outline"}
          color={item.favorite ? c.accent : c.text}
          onPress={() => void updateItemSafe(item.id, { favorite: !item.favorite })}
        />
        <IconButton icon="create-outline" onPress={onEdit} label="Edit" />
        <IconButton
          icon="trash-outline"
          color={c.danger}
          onPress={confirmDelete}
          label="Move to Trash"
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 14 }}>
        {/* Breadcrumb matching /vault/[domain]/[account] */}
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
          <Pressable onPress={onGoHome}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: "700" }}>
              All Apps
            </Text>
          </Pressable>
          <Ionicons name="chevron-forward" size={12} color={c.faint} />
          <Pressable onPress={() => onOpenDomain(item.domainKey)}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: "700" }}>
              {item.appName}
            </Text>
          </Pressable>
          <Ionicons name="chevron-forward" size={12} color={c.faint} />
          <Text
            numberOfLines={1}
            style={{ color: c.text, fontSize: 12, fontWeight: "800", maxWidth: 160 }}
          >
            {displayTitle}
          </Text>
        </View>

        {/* Account Hero Summary Card (matches website /vault/[domain]/[account] Hero!) */}
        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <SiteIcon domain={item.domainKey} name={item.appName} size={56} />
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ color: c.text, fontSize: 19, fontWeight: "900" }}
                >
                  {displayTitle}
                </Text>
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
                    {item.appName}
                  </Text>
                </View>
              </View>

              <Text
                numberOfLines={1}
                style={{
                  color: c.muted,
                  fontSize: 12,
                  fontFamily: "monospace",
                  marginTop: 3,
                }}
              >
                {item.domainKey}
                {item.email && item.email !== displayTitle
                  ? ` · ${maskValue(item.email)}`
                  : ""}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 4,
                }}
              >
                <Ionicons name="link" size={12} color={c.accentLabel} />
                <Text
                  style={{
                    color: c.accentLabel,
                    fontSize: 11,
                    fontWeight: "800",
                  }}
                >
                  {connectedOAuths.length} Connected OAuth
                  {connectedOAuths.length === 1 ? "" : "s"}
                </Text>
              </View>
            </View>
          </View>

          {!offline && (
            <Button
              title="Connect New Website"
              icon="add"
              onPress={() => onConnectNew(item.id)}
              style={{ height: 42 }}
            />
          )}
        </Card>

        {/* Main Account Details Card (matches VaultEntryCard.tsx 1:1!) */}
        <Card style={{ gap: 14 }}>
          {/* Title, Category, Passkey & URL */}
          <View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              <Text
                style={{ color: c.text, fontSize: 16, fontWeight: "800" }}
              >
                {displayTitle}
              </Text>
              <Pill text={cat.label} color={cat.color} />
              {item.hasPasskey && (
                <Pill text="Passkey" color={c.ok} icon="finger-print-outline" />
              )}
            </View>
            <Pressable
              onPress={() => item.url && Linking.openURL(item.url).catch(() => {})}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 4,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: c.muted,
                  fontSize: 11,
                  fontFamily: "monospace",
                  flexShrink: 1,
                }}
              >
                {item.url}
              </Text>
              <Ionicons name="open-outline" size={12} color={c.muted} />
            </Pressable>
          </View>

          {/* Decryption Status Alert */}
          {item.decryptionStatus !== "ok" && (
            <View
              style={{
                backgroundColor:
                  (item.decryptionStatus === "locked" ? c.danger : c.warn) +
                  "1a",
                borderColor:
                  (item.decryptionStatus === "locked" ? c.danger : c.warn) +
                  "66",
                borderWidth: 1,
                borderRadius: radius.md,
                padding: 10,
              }}
            >
              <Text
                style={{
                  color: item.decryptionStatus === "locked" ? c.danger : c.warn,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {item.decryptionStatus === "locked"
                  ? "Encrypted with an older secret key"
                  : "Decoded via saved fallback hexcode — re-encrypt in Security check"}
              </Text>
            </View>
          )}

          {/* OAuth Login Block OR Divided Credentials Table */}
          {item.authType === "oauth" ? (
            <Inset style={{ gap: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
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
                    domain={oauthDomain || item.oauthProvider || "google.com"}
                    name={item.oauthProvider || "OAuth"}
                    size={36}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: c.accentLabel,
                        fontSize: 10,
                        fontWeight: "800",
                        letterSpacing: 0.6,
                      }}
                    >
                      SIGN IN WITH {(item.oauthProvider || "OAuth").toUpperCase()}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: c.text,
                        fontSize: 13,
                        fontWeight: "700",
                        fontFamily: "monospace",
                        marginTop: 2,
                      }}
                    >
                      {item.email ? maskValue(item.email) : "No email saved"}
                    </Text>
                  </View>
                </View>
                {item.email ? (
                  <Pressable
                    onPress={() => copy(item.email, "OAuth email")}
                    style={{
                      backgroundColor: c.card,
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: radius.md,
                      padding: 9,
                    }}
                  >
                    <Ionicons name="copy-outline" size={16} color={c.muted} />
                  </Pressable>
                ) : null}
              </View>

              {parent ? (
                <Pressable
                  onPress={() => onOpen(parent.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    backgroundColor: c.card,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: radius.md,
                    paddingHorizontal: 11,
                    paddingVertical: 9,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      flex: 1,
                    }}
                  >
                    <Ionicons name="link" size={14} color={c.ok} />
                    <Text
                      numberOfLines={1}
                      style={{
                        color: c.ok,
                        fontSize: 12,
                        fontWeight: "800",
                        flex: 1,
                      }}
                    >
                      Open {parent.appName} Account (
                      {parent.username || parent.email || parent.label})
                    </Text>
                  </View>
                  <Ionicons
                    name="arrow-up-outline"
                    size={14}
                    color={c.accentLabel}
                    style={{ transform: [{ rotate: "45deg" }] }}
                  />
                </Pressable>
              ) : !offline ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: c.faint, fontSize: 11 }}>
                    Not linked to a saved {item.oauthProvider || "provider"} card
                  </Text>
                  <Pressable onPress={onEdit}>
                    <Text
                      style={{
                        color: c.accentLabel,
                        fontSize: 11,
                        fontWeight: "800",
                      }}
                    >
                      Connect Account
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </Inset>
          ) : item.email || item.username || item.password ? (
            <Inset style={{ padding: 0, overflow: "hidden" }}>
              {item.email ? (
                <CredentialRow
                  icon="mail-outline"
                  label="EMAIL"
                  value={maskValue(item.email)}
                  onCopy={() => copy(item.email, "Email")}
                  last={!item.username && !item.password}
                />
              ) : null}
              {item.username ? (
                <CredentialRow
                  icon="person-outline"
                  label="USERNAME"
                  value={maskValue(item.username)}
                  onCopy={() => copy(item.username, "Username")}
                  last={!item.password}
                />
              ) : null}
              {item.password ? (
                <CredentialRow
                  icon="lock-closed-outline"
                  label="PASSWORD"
                  badge={pwdStrength ? { text: pwdStrength.label, color: pwdStrength.color } : undefined}
                  value={
                    revealPassword && !privacyBlur
                      ? item.password
                      : "••••••••••••"
                  }
                  onCopy={() => copy(item.password, "Password")}
                  extra={
                    <Pressable
                      onPress={() => setRevealPassword((v) => !v)}
                      hitSlop={8}
                      style={{ padding: 6 }}
                    >
                      <Ionicons
                        name={revealPassword ? "eye-off-outline" : "eye-outline"}
                        size={17}
                        color={c.muted}
                      />
                    </Pressable>
                  }
                  last
                />
              ) : null}
            </Inset>
          ) : null}

          {/* Live TOTP Widget (Exact Website Cyber-Cyan Layout) */}
          {totp ? (
            <Inset style={{ gap: 8 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                >
                  <Ionicons name="key-outline" size={13} color={c.info} />
                  <Text
                    style={{
                      color: c.info,
                      fontSize: 10,
                      fontWeight: "800",
                      letterSpacing: 0.8,
                    }}
                  >
                    LIVE TOTP
                  </Text>
                </View>
                <Pressable
                  onPress={() => setShowRawTotp((v) => !v)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Ionicons
                    name={showRawTotp ? "eye-off-outline" : "eye-outline"}
                    size={13}
                    color={c.muted}
                  />
                  <Text
                    style={{ color: c.muted, fontSize: 11, fontWeight: "700" }}
                  >
                    {showRawTotp ? "Hide Secret" : "Raw Secret"}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => copy(generateTotp(totp, now), "TOTP code")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: radius.md,
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                }}
              >
                <Text
                  style={{
                    color: c.text,
                    fontSize: 26,
                    fontWeight: "900",
                    letterSpacing: 4,
                    fontFamily: "monospace",
                  }}
                >
                  {privacyBlur
                    ? "••• •••"
                    : formatCode(generateTotp(totp, now))}
                </Text>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <Ionicons name="copy-outline" size={16} color={c.muted} />
                  <Countdown
                    left={secondsLeft(totp, now)}
                    period={totp.period}
                  />
                </View>
              </Pressable>

              {showRawTotp && item.totpSecret ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    backgroundColor: c.card,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: radius.md,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: c.muted,
                      fontSize: 11,
                      fontFamily: "monospace",
                      flex: 1,
                    }}
                  >
                    {item.totpSecret}
                  </Text>
                  <Pressable onPress={() => copy(item.totpSecret, "TOTP secret")}>
                    <Text
                      style={{
                        color: c.accentLabel,
                        fontSize: 11,
                        fontWeight: "800",
                      }}
                    >
                      Copy
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </Inset>
          ) : null}

          {/* Backup Security Keys (Exact Website Layout: Import .txt + Progress Bar + Use Next Key + 2-Col Grid!) */}
          <Inset style={{ gap: 10 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Ionicons name="key-outline" size={14} color={c.accentLabel} />
                <Text
                  style={{
                    color: c.muted,
                    fontSize: 10,
                    fontWeight: "800",
                    letterSpacing: 0.8,
                  }}
                >
                  SECURITY KEYS
                </Text>
                {totalCodes > 0 && (
                  <View
                    style={{
                      backgroundColor:
                        (unusedCount === 0
                          ? c.danger
                          : unusedCount <= 2
                            ? c.warn
                            : c.ok) + "24",
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 999,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          unusedCount === 0
                            ? c.danger
                            : unusedCount <= 2
                              ? c.warn
                              : c.ok,
                        fontSize: 10,
                        fontWeight: "800",
                      }}
                    >
                      {unusedCount}/{totalCodes} left
                    </Text>
                  </View>
                )}
              </View>

              {!offline && (
                <Pressable
                  disabled={importingTxt}
                  onPress={handleQuickTxtImport}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: c.card,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: radius.sm,
                    paddingHorizontal: 9,
                    paddingVertical: 5,
                  }}
                >
                  {importingTxt ? (
                    <ActivityIndicator size="small" color={c.accentLabel} />
                  ) : (
                    <Ionicons
                      name="cloud-upload-outline"
                      size={12}
                      color={c.muted}
                    />
                  )}
                  <Text
                    style={{ color: c.muted, fontSize: 10, fontWeight: "800" }}
                  >
                    Import .txt
                  </Text>
                </Pressable>
              )}
            </View>

            {totalCodes === 0 ? (
              <Text style={{ color: c.faint, fontSize: 12 }}>
                No backup security keys saved yet.
              </Text>
            ) : (
              <>
                {/* Progress Meter + 1-Tap Use Next Key */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: c.borderStrong,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          width: `${pctUnused}%`,
                          height: "100%",
                          borderRadius: 3,
                          backgroundColor:
                            unusedCount === 0
                              ? c.danger
                              : unusedCount <= 2
                                ? c.warn
                                : c.ok,
                        }}
                      />
                    </View>
                    <Text
                      style={{
                        color: c.faint,
                        fontSize: 10,
                        fontFamily: "monospace",
                      }}
                    >
                      {pctUnused}%
                    </Text>
                  </View>

                  {unusedCount > 0 && (
                    <Pressable
                      disabled={busyCodeId !== null}
                      onPress={() => {
                        const nextUnused = item.securityCodes.find(
                          (x) => !x.used && !x.locked
                        );
                        if (nextUnused) void handleUseCode(nextUnused);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: c.accent,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: radius.sm,
                      }}
                    >
                      <Ionicons
                        name="copy-outline"
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
                        Use Next Key
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* 2-Column Security Keys Grid */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {item.securityCodes.map((k) => {
                    const isBusy = busyCodeId === k.id;
                    if (k.locked) {
                      return (
                        <View
                          key={k.id}
                          style={{
                            width: "48%",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            backgroundColor: c.card,
                            borderWidth: 1,
                            borderColor: c.danger + "55",
                            borderRadius: radius.md,
                            paddingHorizontal: 10,
                            paddingVertical: 9,
                          }}
                        >
                          <Text
                            style={{
                              color: c.danger,
                              fontSize: 11,
                              fontFamily: "monospace",
                            }}
                          >
                            LOCKED
                          </Text>
                          <Ionicons
                            name="lock-closed"
                            size={12}
                            color={c.danger}
                          />
                        </View>
                      );
                    }

                    if (k.used) {
                      return (
                        <View
                          key={k.id}
                          style={{
                            width: "48%",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 4,
                            backgroundColor: c.card,
                            borderWidth: 1,
                            borderColor: c.border,
                            borderRadius: radius.md,
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            opacity: 0.65,
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            style={{
                              color: c.faint,
                              fontSize: 12,
                              fontWeight: "800",
                              fontFamily: "monospace",
                              letterSpacing: 1,
                              flex: 1,
                            }}
                          >
                            {k.masked}
                          </Text>
                          {!offline && (
                            <Pressable
                              disabled={isBusy}
                              onPress={() => void handleRestoreCode(k)}
                              hitSlop={8}
                              style={{ padding: 2 }}
                            >
                              {isBusy ? (
                                <ActivityIndicator
                                  size="small"
                                  color={c.accentLabel}
                                />
                              ) : (
                                <Ionicons
                                  name="arrow-undo-outline"
                                  size={14}
                                  color={c.muted}
                                />
                              )}
                            </Pressable>
                          )}
                        </View>
                      );
                    }

                    return (
                      <Pressable
                        key={k.id}
                        disabled={isBusy}
                        onPress={() => void handleUseCode(k)}
                        style={{
                          width: "48%",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 4,
                          backgroundColor: c.card,
                          borderWidth: 1,
                          borderColor: c.border,
                          borderRadius: radius.md,
                          paddingHorizontal: 10,
                          paddingVertical: 9,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            color: c.accentLabel,
                            fontSize: 12,
                            fontWeight: "800",
                            fontFamily: "monospace",
                            flex: 1,
                          }}
                        >
                          {privacyBlur ? "••••••••" : k.code || k.masked}
                        </Text>
                        {isBusy ? (
                          <ActivityIndicator
                            size="small"
                            color={c.accentLabel}
                          />
                        ) : (
                          <Ionicons
                            name="copy-outline"
                            size={13}
                            color={c.faint}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </Inset>

          {/* Payment Card Details */}
          {item.entryType === "card" && item.cardDetails ? (
            <Inset style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: c.accentLabel, fontSize: 10, fontWeight: "800", letterSpacing: 0.7 }}>
                  PAYMENT CARD
                </Text>
                <Pressable onPress={() => setRevealCard((v) => !v)}>
                  <Text style={{ color: c.muted, fontSize: 11, fontWeight: "700" }}>
                    {revealCard ? "Hide" : "Reveal"}
                  </Text>
                </Pressable>
              </View>
              {item.cardDetails.cardholderName ? (
                <Text style={{ color: c.text, fontSize: 14, fontWeight: "800" }}>
                  {item.cardDetails.cardholderName}
                </Text>
              ) : null}
              {item.cardDetails.cardNumber ? (
                <Pressable
                  onPress={() => copy(item.cardDetails!.cardNumber, "Card number")}
                  style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                >
                  <Text style={{ color: c.text, fontSize: 16, fontWeight: "800", fontFamily: "monospace", letterSpacing: 1.5 }}>
                    {revealCard && !privacyBlur
                      ? item.cardDetails.cardNumber
                      : `•••• •••• •••• ${item.cardDetails.cardNumber.replace(/\s+/g, "").slice(-4)}`}
                  </Text>
                  <Ionicons name="copy-outline" size={16} color={c.muted} />
                </Pressable>
              ) : null}
              <View style={{ flexDirection: "row", gap: 16 }}>
                {item.cardDetails.expiry ? (
                  <Text style={{ color: c.muted, fontSize: 12, fontFamily: "monospace" }}>
                    EXP {item.cardDetails.expiry}
                  </Text>
                ) : null}
                {item.cardDetails.cvv ? (
                  <Pressable onPress={() => copy(item.cardDetails!.cvv, "CVV")}>
                    <Text style={{ color: c.muted, fontSize: 12, fontFamily: "monospace" }}>
                      CVV {revealCard && !privacyBlur ? item.cardDetails.cvv : "•••"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Inset>
          ) : null}

          {/* Custom Fields & Developer Secrets */}
          {item.customFields && item.customFields.length > 0 ? (
            <Inset style={{ padding: 0, overflow: "hidden" }}>
              <View style={{ paddingHorizontal: 13, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <Text style={{ color: c.accentLabel, fontSize: 10, fontWeight: "800", letterSpacing: 0.7 }}>
                  CUSTOM FIELDS ({item.customFields.length})
                </Text>
              </View>
              {item.customFields.map((cf, idx) => {
                const vis = !cf.hidden || Boolean(revealCf[cf.id]);
                return (
                  <CredentialRow
                    key={cf.id}
                    icon="layers-outline"
                    label={cf.label.toUpperCase()}
                    value={vis && !privacyBlur ? cf.value : "••••••••••••"}
                    onCopy={() => copy(cf.value, cf.label)}
                    extra={
                      cf.hidden ? (
                        <Pressable
                          onPress={() => setRevealCf((p) => ({ ...p, [cf.id]: !p[cf.id] }))}
                          style={{ padding: 6 }}
                        >
                          <Ionicons name={vis ? "eye-off-outline" : "eye-outline"} size={16} color={c.muted} />
                        </Pressable>
                      ) : undefined
                    }
                    last={idx === item.customFields.length - 1}
                  />
                );
              })}
            </Inset>
          ) : null}

          {/* Collapsible Password History Drawer */}
          {item.passwordHistory && item.passwordHistory.length > 0 ? (
            <Inset style={{ gap: 8 }}>
              <Pressable
                onPress={() => setShowHistory((v) => !v)}
                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="time-outline" size={14} color={c.accentLabel} />
                  <Text style={{ color: c.text, fontSize: 12, fontWeight: "800" }}>
                    Password History ({item.passwordHistory.length})
                  </Text>
                </View>
                <Ionicons name={showHistory ? "chevron-up" : "chevron-down"} size={16} color={c.muted} />
              </Pressable>
              {showHistory ? (
                <View style={{ gap: 6 }}>
                  {item.passwordHistory.map((h, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => h.password && copy(h.password, "Previous password")}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: c.card,
                        borderWidth: 1,
                        borderColor: c.border,
                        borderRadius: radius.md,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ color: c.text, fontSize: 12, fontFamily: "monospace", fontWeight: "700" }}>
                          {h.locked ? "LOCKED" : privacyBlur ? "••••••••" : h.password || "—"}
                        </Text>
                        <Text style={{ color: c.faint, fontSize: 10 }}>
                          {new Date(h.changedAt).toLocaleString()}
                        </Text>
                      </View>
                      {h.password ? <Ionicons name="copy-outline" size={14} color={c.muted} /> : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Inset>
          ) : null}

          {item.notes ? (
            <Inset>
              <Text
                style={{
                  color: c.muted,
                  fontSize: 12,
                  lineHeight: 18,
                }}
              >
                {privacyBlur ? "••••••••••••" : item.notes}
              </Text>
            </Inset>
          ) : null}
        </Card>

        {/* Parent OAuth Provider Account Section (matches website!) */}
        {parent ? (
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="shield-checkmark" size={16} color={c.ok} />
              <Text
                style={{
                  color: c.ok,
                  fontSize: 11,
                  fontWeight: "900",
                  letterSpacing: 0.6,
                }}
              >
                PARENT OAUTH PROVIDER ACCOUNT
              </Text>
            </View>
            <Pressable
              onPress={() => onOpen(parent.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                backgroundColor: c.card2,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: radius.lg,
                padding: 12,
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
                  domain={parent.domainKey}
                  name={parent.appName}
                  size={34}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{ color: c.text, fontSize: 13, fontWeight: "800" }}
                  >
                    {parent.appName}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: c.muted,
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                  >
                    {maskValue(
                      parent.username || parent.email || parent.label
                    )}
                  </Text>
                </View>
              </View>
              <Ionicons
                name="arrow-up-outline"
                size={16}
                color={c.accentLabel}
                style={{ transform: [{ rotate: "45deg" }] }}
              />
            </Pressable>
          </Card>
        ) : null}

        {/* Dedicated Separate `Connected OAuths` Section (Exact Website Match!) */}
        <Card style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
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
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.md,
                  backgroundColor: c.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="link" size={18} color={c.accentLabel} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: c.text, fontSize: 15, fontWeight: "800" }}
                >
                  Connected OAuths ({connectedOAuths.length})
                </Text>
                <Text style={{ color: c.muted, fontSize: 11 }}>
                  Websites &amp; apps signed in using this {item.appName} account
                </Text>
              </View>
            </View>

            {!offline && (
              <Pressable
                onPress={() => onConnectNew(item.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: c.card2,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: radius.md,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                }}
              >
                <Ionicons name="add" size={14} color={c.accentLabel} />
                <Text style={{ color: c.text, fontSize: 11, fontWeight: "800" }}>
                  Connect Site
                </Text>
              </Pressable>
            )}
          </View>

          {connectedOAuths.length > 3 && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: c.card2,
                borderWidth: 1,
                borderColor: c.borderStrong,
                borderRadius: radius.md,
                paddingHorizontal: 10,
              }}
            >
              <Ionicons name="search" size={15} color={c.faint} />
              <TextInput
                value={oauthFilter}
                onChangeText={setOauthFilter}
                placeholder="Search connected websites..."
                placeholderTextColor={c.faint}
                autoCapitalize="none"
                style={{
                  flex: 1,
                  color: c.text,
                  paddingVertical: 8,
                  paddingHorizontal: 8,
                  fontSize: 12,
                }}
              />
            </View>
          )}

          {connectedOAuths.length === 0 ? (
            <Inset style={{ alignItems: "center", paddingVertical: 24 }}>
              <Ionicons name="link-outline" size={28} color={c.accentLabel} />
              <Text
                style={{
                  color: c.text,
                  fontSize: 14,
                  fontWeight: "800",
                  marginTop: 8,
                }}
              >
                No Connected OAuths Yet
              </Text>
              <Text
                style={{
                  color: c.muted,
                  fontSize: 12,
                  textAlign: "center",
                  marginTop: 4,
                  lineHeight: 18,
                }}
              >
                Whenever you add a website (like Vercel or Render) and choose
                OAuth → {item.appName} with this account, it appears right here
                automatically.
              </Text>
              {!offline && (
                <Button
                  title="Connect First Website"
                  icon="add"
                  onPress={() => onConnectNew(item.id)}
                  style={{ marginTop: 14, height: 40 }}
                />
              )}
            </Inset>
          ) : filteredConnected.length === 0 ? (
            <Inset style={{ alignItems: "center", paddingVertical: 18 }}>
              <Text style={{ color: c.muted, fontSize: 12 }}>
                No connected websites match &ldquo;{oauthFilter}&rdquo;.
              </Text>
            </Inset>
          ) : (
            <View style={{ gap: 8 }}>
              {filteredConnected.map((conn) => {
                const connUnused = conn.securityCodes.filter(
                  (x) => !x.used
                ).length;
                return (
                  <Pressable
                    key={conn.id}
                    onPress={() => onOpen(conn.id)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      backgroundColor: pressed ? c.card : c.card2,
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: radius.lg,
                      padding: 12,
                    })}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        flex: 1,
                      }}
                    >
                      <SiteIcon
                        domain={conn.domainKey}
                        name={conn.appName}
                        size={40}
                      />
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 6,
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            style={{
                              color: c.text,
                              fontSize: 14,
                              fontWeight: "800",
                            }}
                          >
                            {conn.appName}
                          </Text>
                          {conn.label && conn.label !== conn.appName ? (
                            <View
                              style={{
                                backgroundColor: c.card,
                                borderRadius: 999,
                                paddingHorizontal: 7,
                                paddingVertical: 2,
                              }}
                            >
                              <Text
                                style={{
                                  color: c.muted,
                                  fontSize: 10,
                                  fontWeight: "700",
                                }}
                              >
                                {conn.label}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: c.muted,
                            fontSize: 11,
                            fontFamily: "monospace",
                            marginTop: 2,
                          }}
                        >
                          {conn.domainKey}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 6,
                            marginTop: 6,
                          }}
                        >
                          {conn.totpSecret ? (
                            <Pill
                              text="TOTP"
                              color={c.info}
                              icon="phone-portrait-outline"
                            />
                          ) : null}
                          {conn.securityCodes.length > 0 ? (
                            <Pill
                              text={`${connUnused}/${conn.securityCodes.length} keys`}
                              color={c.accentLabel}
                              icon="key-outline"
                            />
                          ) : null}
                        </View>
                      </View>
                    </View>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: c.card,
                        borderWidth: 1,
                        borderColor: c.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="arrow-up-outline"
                        size={15}
                        color={c.accentLabel}
                        style={{ transform: [{ rotate: "45deg" }] }}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Card>

        <Text
          style={{
            color: c.faint,
            fontSize: 11,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          Updated {new Date(item.updatedAt).toLocaleString()}
        </Text>
      </ScrollView>

      <Modal visible={shareOpen} transparent animationType="fade" onRequestClose={() => setShareOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", padding: 20 }}>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: "800" }}>One-Time Secret Link</Text>
              <IconButton icon="close" onPress={() => setShareOpen(false)} />
            </View>
            <Text style={{ color: c.muted, fontSize: 12 }}>
              Self-destructs after 1 view or when the timer expires.
            </Text>
            {!shareUrl ? (
              <>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(
                    [
                      { id: "10", label: "10m" },
                      { id: "60", label: "1h" },
                      { id: "1440", label: "24h" },
                    ] as const
                  ).map((o) => (
                    <Pressable
                      key={o.id}
                      onPress={() => setShareExp(o.id)}
                      style={{
                        flex: 1,
                        alignItems: "center",
                        paddingVertical: 10,
                        borderRadius: radius.md,
                        backgroundColor: shareExp === o.id ? c.accentSoft : c.card2,
                        borderWidth: 1,
                        borderColor: shareExp === o.id ? c.accent : c.border,
                      }}
                    >
                      <Text style={{ color: shareExp === o.id ? c.accentLabel : c.text, fontWeight: "800", fontSize: 12 }}>
                        {o.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Button
                  title="Generate One-Time Link"
                  icon="share-social-outline"
                  loading={shareBusy}
                  onPress={async () => {
                    setShareBusy(true);
                    try {
                      const res = await api.createShare(item.id, shareExp);
                      setShareUrl(res.url);
                    } catch (e) {
                      Alert.alert("Error", (e as Error).message);
                    } finally {
                      setShareBusy(false);
                    }
                  }}
                />
              </>
            ) : (
              <>
                <Inset>
                  <Text selectable style={{ color: c.accentLabel, fontSize: 11, fontFamily: "monospace" }}>
                    {shareUrl}
                  </Text>
                </Inset>
                <Button
                  title="Copy Link"
                  icon="copy-outline"
                  onPress={async () => {
                    await copySecret(shareUrl);
                    toast.show("Share link copied!");
                    setShareOpen(false);
                  }}
                />
              </>
            )}
          </Card>
        </View>
      </Modal>
      <Toast message={toast.msg} />
    </View>
  );
}

function Pill({
  text,
  color,
  icon,
}: {
  text: string;
  color: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 999,
        backgroundColor: color + "22",
      }}
    >
      {icon ? <Ionicons name={icon} size={10} color={color} /> : null}
      <Text
        style={{
          color,
          fontSize: 10,
          fontWeight: "800",
          textTransform: "uppercase",
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function CredentialRow({
  icon,
  label,
  value,
  badge,
  onCopy,
  extra,
  last,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  badge?: { text: string; color: string };
  onCopy?: () => void;
  extra?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onCopy}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 13,
        paddingVertical: 11,
        gap: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
      }}
    >
      <Ionicons name={icon} size={15} color={c.faint} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text
            style={{
              color: c.faint,
              fontSize: 9,
              fontWeight: "800",
              letterSpacing: 0.7,
            }}
          >
            {label}
          </Text>
          {badge ? (
            <View
              style={{
                backgroundColor: badge.color + "22",
                paddingHorizontal: 5,
                paddingVertical: 1,
                borderRadius: 4,
              }}
            >
              <Text
                style={{
                  color: badge.color,
                  fontSize: 9,
                  fontWeight: "800",
                  textTransform: "uppercase",
                }}
              >
                {badge.text}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          style={{
            color: c.text,
            fontSize: 13,
            fontFamily: "monospace",
            marginTop: 2,
          }}
        >
          {value}
        </Text>
      </View>
      {extra}
      {onCopy ? (
        <Ionicons name="copy-outline" size={16} color={c.muted} />
      ) : null}
    </Pressable>
  );
}
