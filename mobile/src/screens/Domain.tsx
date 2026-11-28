import React, { useMemo, useState } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVault } from "../vault";
import { useAuth } from "../auth";
import { usePrefs } from "../prefs";
import { CATEGORIES } from "../types";
import { getAppNameForDomain } from "../lib/domain";
import {
  getAccountTitle,
  getConnectedOAuthEntries,
  resolveOAuthProviderDomain,
} from "../lib/oauth-links";
import { Button, Card, IconButton, Inset, SiteIcon } from "../ui";
import { c, radius } from "../theme";

export default function Domain({
  domainKey,
  onBack,
  onOpen,
  onAdd,
}: {
  domainKey: string;
  onBack: () => void;
  onOpen: (id: string) => void;
  onAdd: (lockedDomain: string) => void;
}) {
  const { items, groups } = useVault();
  const { offline } = useAuth();
  const { privacyBlur } = usePrefs();
  const [search, setSearch] = useState("");

  const group = groups.find((g) => g.domainKey === domainKey);
  const appName = group?.appName || getAppNameForDomain(domainKey);

  const appItems = useMemo(() => {
    const base = group?.items || [];
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        (i.email || "").toLowerCase().includes(q) ||
        (i.username || "").toLowerCase().includes(q) ||
        (i.oauthProvider || "").toLowerCase().includes(q) ||
        i.url.toLowerCase().includes(q)
    );
  }, [group, search]);

  const stats = useMemo(() => {
    const base = group?.items || [];
    const totpCount = base.filter((i) => Boolean(i.totpSecret)).length;
    const unusedKeys = base.reduce(
      (sum, i) => sum + i.securityCodes.filter((k) => !k.used).length,
      0
    );
    return { totpCount, unusedKeys };
  }, [group]);

  const header = (
    <View style={{ gap: 12, marginBottom: 12 }}>
      {/* Dedicated App Banner Card (Matches Website /vault/[domain] Banner!) */}
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <SiteIcon domain={domainKey} name={appName} size={56} />
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
                style={{ color: c.text, fontSize: 21, fontWeight: "900" }}
              >
                {appName}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: c.accentSoft,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                }}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={11}
                  color={c.accentLabel}
                />
                <Text
                  style={{
                    color: c.accentLabel,
                    fontSize: 10,
                    fontWeight: "800",
                    fontFamily: "monospace",
                  }}
                >
                  Only {domainKey}
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 4,
              }}
            >
              <Pressable
                onPress={() =>
                  Linking.openURL(`https://${domainKey}`).catch(() => {})
                }
                style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
              >
                <Text
                  style={{
                    color: c.muted,
                    fontSize: 12,
                    fontFamily: "monospace",
                  }}
                >
                  {domainKey}
                </Text>
                <Ionicons name="open-outline" size={11} color={c.muted} />
              </Pressable>
              <Text style={{ color: c.faint }}>·</Text>
              <Text style={{ color: c.text, fontSize: 12, fontWeight: "700" }}>
                {(group?.items.length || 0)}{" "}
                {(group?.items.length || 0) === 1 ? "Account" : "Accounts"}
              </Text>
              {stats.totpCount > 0 ? (
                <Text style={{ color: c.info, fontSize: 11, fontWeight: "800" }}>
                  · {stats.totpCount} TOTP
                </Text>
              ) : null}
              {stats.unusedKeys > 0 ? (
                <Text
                  style={{
                    color: c.accentLabel,
                    fontSize: 11,
                    fontWeight: "800",
                  }}
                >
                  · {stats.unusedKeys} Keys
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {!offline && (
          <Button
            title={`Add ${appName} Account`}
            icon="add"
            onPress={() => onAdd(domainKey)}
            style={{ height: 44 }}
          />
        )}
      </Card>

      {(group?.items.length || 0) > 1 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.borderStrong,
            borderRadius: radius.lg,
            paddingHorizontal: 12,
          }}
        >
          <Ionicons name="search" size={16} color={c.faint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={`Filter ${appName} accounts...`}
            placeholderTextColor={c.faint}
            autoCapitalize="none"
            style={{
              flex: 1,
              color: c.text,
              paddingVertical: 10,
              paddingHorizontal: 8,
              fontSize: 13,
            }}
          />
        </View>
      )}
    </View>
  );

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
        <Text style={{ color: c.muted, fontSize: 13, fontWeight: "700" }}>
          Back to All Apps
        </Text>
      </View>

      <FlatList
        data={appItems}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 44 }}
        renderItem={({ item }) => {
          const title = getAccountTitle(item);
          const cat =
            CATEGORIES.find((k) => k.id === item.category) || CATEGORIES[0];
          const connected = getConnectedOAuthEntries(item, items);
          const unusedKeys = item.securityCodes.filter((k) => !k.used).length;
          const oauthDom = resolveOAuthProviderDomain(item);

          return (
            <Pressable
              onPress={() => onOpen(item.id)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? c.card2 : c.card,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: radius.xl,
                padding: 15,
                marginBottom: 12,
                gap: 10,
              })}
            >
              {/* Card Title + Category + Badges */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
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
                        fontSize: 16,
                        fontWeight: "800",
                      }}
                    >
                      {title}
                    </Text>
                    <View
                      style={{
                        backgroundColor: cat.color + "22",
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: 999,
                      }}
                    >
                      <Text
                        style={{
                          color: cat.color,
                          fontSize: 9,
                          fontWeight: "800",
                          textTransform: "uppercase",
                        }}
                      >
                        {cat.label}
                      </Text>
                    </View>
                    {item.hasPasskey ? (
                      <View
                        style={{
                          backgroundColor: c.ok + "22",
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 999,
                        }}
                      >
                        <Text
                          style={{
                            color: c.ok,
                            fontSize: 9,
                            fontWeight: "800",
                            textTransform: "uppercase",
                          }}
                        >
                          Passkey
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
                    {item.url}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {item.favorite && (
                    <Ionicons name="star" size={16} color={c.accent} />
                  )}
                  <Ionicons
                    name="arrow-up-outline"
                    size={16}
                    color={c.accentLabel}
                    style={{ transform: [{ rotate: "45deg" }] }}
                  />
                </View>
              </View>

              {/* Login Preview Inset */}
              <Inset
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  paddingVertical: 10,
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
                  {item.authType === "oauth" ? (
                    <SiteIcon
                      domain={oauthDom || item.oauthProvider || "google.com"}
                      name={item.oauthProvider || "OAuth"}
                      size={28}
                    />
                  ) : (
                    <Ionicons name="mail-outline" size={16} color={c.faint} />
                  )}
                  <View style={{ flex: 1 }}>
                    {item.authType === "oauth" ? (
                      <Text
                        style={{
                          color: c.accentLabel,
                          fontSize: 9,
                          fontWeight: "800",
                          letterSpacing: 0.6,
                        }}
                      >
                        SIGN IN WITH{" "}
                        {(item.oauthProvider || "OAuth").toUpperCase()}
                      </Text>
                    ) : null}
                    <Text
                      numberOfLines={1}
                      style={{
                        color: c.text,
                        fontSize: 12,
                        fontFamily: "monospace",
                        fontWeight: "700",
                      }}
                    >
                      {privacyBlur
                        ? "••••••••••"
                        : item.email || item.username || "—"}
                    </Text>
                  </View>
                </View>

                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  {item.totpSecret ? (
                    <View
                      style={{
                        backgroundColor: c.info + "22",
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: 999,
                      }}
                    >
                      <Text
                        style={{
                          color: c.info,
                          fontSize: 10,
                          fontWeight: "800",
                        }}
                      >
                        TOTP
                      </Text>
                    </View>
                  ) : null}
                  {item.securityCodes.length > 0 ? (
                    <View
                      style={{
                        backgroundColor: c.accentSoft,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: 999,
                      }}
                    >
                      <Text
                        style={{
                          color: c.accentLabel,
                          fontSize: 10,
                          fontWeight: "800",
                        }}
                      >
                        {unusedKeys}/{item.securityCodes.length}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Inset>

              {/* Connected OAuths Preview Footer (matches VaultEntryCard.tsx!) */}
              <Inset
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  paddingHorizontal: 11,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Ionicons name="link" size={14} color={c.accentLabel} />
                  <Text
                    style={{ color: c.muted, fontSize: 12, fontWeight: "700" }}
                  >
                    {connected.length > 0
                      ? `${connected.length} Connected OAuth${connected.length === 1 ? "" : "s"}`
                      : "Open Account & OAuths"}
                  </Text>
                </View>

                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                >
                  {connected.slice(0, 3).map((conn) => (
                    <SiteIcon
                      key={conn.id}
                      domain={conn.domainKey}
                      name={conn.appName}
                      size={22}
                    />
                  ))}
                  {connected.length > 3 ? (
                    <Text
                      style={{
                        color: c.muted,
                        fontSize: 10,
                        fontWeight: "800",
                        fontFamily: "monospace",
                      }}
                    >
                      +{connected.length - 3}
                    </Text>
                  ) : null}
                  <Ionicons
                    name="chevron-forward"
                    size={15}
                    color={c.accentLabel}
                  />
                </View>
              </Inset>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
