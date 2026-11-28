import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
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
    <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: c.border,
      alignItems: "center", justifyContent: "center", borderTopColor: color,
      borderRightColor: pct > 0.25 ? color : c.border, borderBottomColor: pct > 0.5 ? color : c.border,
      borderLeftColor: pct > 0.75 ? color : c.border }}>
      <Text style={{ color: c.muted, fontSize: 11, fontWeight: "700" }}>{left}</Text>
    </View>
  );
}

export default function Authenticator({ onOpen }: { onOpen: (id: string) => void }) {
  const { items } = useVault();
  const { privacyBlur } = usePrefs();
  const now = useNow();
  const toast = useToast();
  const list = useMemo(
    () => items.map((i) => ({ i, cfg: parseTotp(i.totpSecret) })).filter((x) => x.cfg),
    [items]
  );

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: c.text, fontSize: 28, fontWeight: "800", paddingHorizontal: 16, marginBottom: 12 }}>
        Authenticator
      </Text>
      <FlatList
        data={list}
        keyExtractor={(x) => x.i.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ListEmptyComponent={<Empty icon="timer-outline" title="No 2FA codes yet"
          body="Add a TOTP secret to a login and its live code appears here." />}
        renderItem={({ item: { i, cfg } }) => {
          const code = generateTotp(cfg!, now);
          const left = secondsLeft(cfg!, now);
          return (
            <Pressable
              onPress={async () => { await copySecret(code); toast.show("Code copied"); }}
              onLongPress={() => onOpen(i.id)}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
                marginBottom: 8, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border,
                backgroundColor: pressed ? c.card2 : c.card })}>
              <SiteIcon domain={i.domainKey} name={i.label} size={40} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>{i.label}</Text>
                <Text style={{ color: left <= 5 ? c.danger : c.text, fontSize: 28, fontWeight: "800",
                  letterSpacing: 3, fontVariant: ["tabular-nums"] }}>{privacyBlur ? "••• •••" : formatCode(code)}</Text>
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
