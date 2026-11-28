import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVault } from "../vault";
import { usePrefs } from "../prefs";
import { formatCode, generateTotp, parseTotp, secondsLeft } from "../totp";
import { Empty, SiteIcon, Toast, copySecret, useToast } from "../ui";
import { c, radius } from "../theme";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function Countdown({ left, period }: { left: number; period: number }) {
  const pct = left / period;
  const color = left <= 5 ? c.danger : c.accent;
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 3,
        borderColor: c.border,
        alignItems: "center",
        justifyContent: "center",
        borderTopColor: color,
        borderRightColor: pct > 0.25 ? color : c.border,
        borderBottomColor: pct > 0.5 ? color : c.border,
        borderLeftColor: pct > 0.75 ? color : c.border,
      }}
    >
      <Text style={{ color: c.muted, fontSize: 11, fontWeight: "700" }}>
        {left}
      </Text>
    </View>
  );
}

export default function Authenticator({
  onOpen,
}: {
  onOpen: (id: string) => void;
}) {
  const { items } = useVault();
  const { privacyBlur } = usePrefs();
  const now = useNow();
  const toast = useToast();
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .map((i) => ({ i, cfg: parseTotp(i.totpSecret) }))
      .filter((x) => Boolean(x.cfg))
      .filter(({ i }) => {
        if (!q) return true;
        return [i.appName, i.label, i.domainKey, i.email, i.username].some((v) =>
          (v || "").toLowerCase().includes(q)
        );
      });
  }, [items, query]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <Text style={{ color: c.text, fontSize: 28, fontWeight: "800" }}>
          Authenticator
        </Text>
        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.card,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: c.borderStrong,
            paddingHorizontal: 12,
          }}
        >
          <Ionicons name="search" size={16} color={c.faint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search app, email or username..."
            placeholderTextColor={c.faint}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              color: c.text,
              paddingVertical: 10,
              paddingHorizontal: 8,
              fontSize: 13,
            }}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={16} color={c.faint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(x) => x.i.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ListEmptyComponent={
          <Empty
            icon="timer-outline"
            title={query ? "No matching 2FA codes" : "No 2FA codes yet"}
            body={
              query
                ? "Try searching a different app name, email, or username."
                : "Add a TOTP secret to a login and its live code appears here."
            }
          />
        }
        renderItem={({ item: { i, cfg } }) => {
          const code = generateTotp(cfg!, now);
          const left = secondsLeft(cfg!, now);
          const accountIdentity =
            i.username && i.email
              ? `@${i.username} · ${i.email}`
              : i.email || i.username || i.domainKey;
          const showLabelBadge =
            Boolean(i.label) &&
            i.label.toLowerCase() !== i.appName.toLowerCase() &&
            i.label.toLowerCase() !== (i.email || "").toLowerCase() &&
            i.label.toLowerCase() !== (i.username || "").toLowerCase();

          return (
            <Pressable
              onPress={async () => {
                await copySecret(code);
                toast.show(`${i.appName} code copied`);
              }}
              onLongPress={() => onOpen(i.id)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 14,
                marginBottom: 8,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: pressed ? c.card2 : c.card,
              })}
            >
              <SiteIcon domain={i.domainKey} name={i.appName} size={42} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: c.text,
                      fontSize: 14,
                      fontWeight: "800",
                      flexShrink: 1,
                    }}
                  >
                    {i.appName}
                  </Text>
                  {showLabelBadge ? (
                    <View
                      style={{
                        backgroundColor: c.card2,
                        borderRadius: 999,
                        paddingHorizontal: 7,
                        paddingVertical: 1,
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          color: c.muted,
                          fontSize: 10,
                          fontWeight: "700",
                        }}
                      >
                        {i.label}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text
                  numberOfLines={1}
                  style={{
                    color: c.muted,
                    fontSize: 12,
                    fontFamily: "monospace",
                    marginTop: 1,
                  }}
                >
                  {privacyBlur ? "••••••••••" : accountIdentity}
                </Text>

                <Text
                  style={{
                    color: left <= 5 ? c.danger : c.text,
                    fontSize: 26,
                    fontWeight: "900",
                    letterSpacing: 3,
                    marginTop: 4,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {privacyBlur ? "••• •••" : formatCode(code)}
                </Text>
              </View>
              <Countdown left={left} period={cfg!.period} />
            </Pressable>
          );
        }}
      />
      <Toast message={toast.msg} />
    </View>
  );
}
