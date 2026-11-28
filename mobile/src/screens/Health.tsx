import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api";
import { useAuth } from "../auth";
import { useVault } from "../vault";
import { evaluatePasswordStrength } from "../lib/domain";
import type { VaultItem } from "../types";
import { Banner, Button, Card, Empty, Field, SiteIcon, StatBox } from "../ui";
import { c, radius } from "../theme";

export default function Health({ onOpen }: { onOpen: (id: string) => void }) {
  const { items, refresh } = useVault();
  const { offline } = useAuth();
  const [busy, setBusy] = useState(false);
  const [oldHexKey, setOldHexKey] = useState("");
  const [checkingBreach, setCheckingBreach] = useState(false);
  const [breaches, setBreaches] = useState<{ checkedCount: number; compromised: Array<{ id: string; count: number }> } | null>(null);

  const audit = useMemo(() => {
    const weak: VaultItem[] = [];
    const noTotp: VaultItem[] = [];
    const lowKeys: { item: VaultItem; left: number; total: number }[] = [];
    const map = new Map<string, VaultItem[]>();
    let oauth = 0;
    for (const i of items) {
      if (i.authType === "oauth") oauth++;
      else if (i.password) {
        if (evaluatePasswordStrength(i.password).score <= 2) weak.push(i);
        map.set(i.password, [...(map.get(i.password) || []), i]);
      }
      if (i.authType === "password" && !i.totpSecret && !i.hasPasskey) noTotp.push(i);
      if (i.securityCodes.length) {
        const left = i.securityCodes.filter((k) => !k.used).length;
        if (left <= 2) lowKeys.push({ item: i, left, total: i.securityCodes.length });
      }
    }
    const reused = Array.from(map.values()).filter((g) => g.length > 1);
    const reusedCount = reused.reduce((n, g) => n + g.length, 0);
    const locked = items.filter((i) => i.decryptionStatus === "locked").length;
    const recovered = items.filter((i) => i.decryptionStatus !== "ok" && i.decryptionStatus !== "locked").length;
    let score = 100;
    if (items.length) {
      score -= weak.length * 14 + reused.length * 16 + Math.min(25, noTotp.length * 5) + lowKeys.length * 8 + locked * 12;
      score = Math.max(10, Math.min(100, score));
    }
    return { score, oauth, weak, reused, reusedCount, noTotp, lowKeys, locked, recovered };
  }, [items]);

  const color = audit.score >= 80 ? c.ok : audit.score >= 55 ? c.warn : c.danger;
  const clean = !audit.weak.length && !audit.reused.length && !audit.lowKeys.length && !audit.locked && !audit.recovered;

  const reencrypt = async (manualKey?: string) => {
    setBusy(true);
    try {
      const res = await api.reencrypt(manualKey?.trim() || undefined);
      setOldHexKey("");
      await refresh();
      Alert.alert(
        "Re-encryption complete",
        `Migrated ${res.migratedCount} entry(ies). ${res.stillLockedCount > 0 ? `${res.stillLockedCount} still locked.` : "All entries unlocked!"}`
      );
    } catch (e) {
      Alert.alert("Couldn't re-encrypt", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runBreachCheck = async () => {
    setCheckingBreach(true);
    try {
      const res = await api.breachCheck();
      setBreaches({ checkedCount: res.checkedCount, compromised: res.compromised || [] });
    } catch (e) {
      Alert.alert("Breach check failed", (e as Error).message);
    } finally {
      setCheckingBreach(false);
    }
  };

  if (!items.length) return <Empty icon="shield-checkmark-outline" title="Nothing to check yet" body="Add logins to your vault and they'll be audited here." />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={{ color: c.text, fontSize: 28, fontWeight: "900", marginBottom: 14 }}>Security check</Text>

      <Card style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 7, borderColor: color,
          alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: c.text, fontSize: 22, fontWeight: "900" }}>{audit.score}%</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: "800" }}>
            {audit.score >= 80 ? "Looking strong" : audit.score >= 55 ? "Could be better" : "Needs attention"}
          </Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 3 }}>
            Audited {items.length} account(s) ({audit.oauth} OAuth) for weak or reused passwords, missing 2FA and low backup codes.
          </Text>
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <StatBox icon="alert-circle" label="Weak" value={audit.weak.length} color={c.danger} />
        <StatBox icon="copy" label="Reused" value={audit.reusedCount} color={c.warn} />
        <StatBox icon="phone-portrait" label="No 2FA" value={audit.noTotp.length} color={c.info} />
        <StatBox icon="key" label="Low keys" value={audit.lowKeys.length} color="#f97316" />
      </View>

      {/* HIBP Breach Check */}
      {!offline && (
        <View style={{ marginTop: 14, gap: 10 }}>
          <Button
            title="Check Breaches (HIBP)"
            icon="flame-outline"
            loading={checkingBreach}
            onPress={() => void runBreachCheck()}
            style={{ height: 44 }}
          />
          {breaches ? (
            <Card style={{ borderColor: breaches.compromised.length ? c.danger : c.ok }}>
              <Text style={{ color: breaches.compromised.length ? c.danger : c.ok, fontWeight: "800", fontSize: 13 }}>
                {breaches.compromised.length === 0
                  ? `All ${breaches.checkedCount} password(s) clean in HIBP`
                  : `${breaches.compromised.length} password(s) exposed in public data breaches!`}
              </Text>
              {breaches.compromised.map((b) => {
                const it = items.find((x) => x.id === b.id);
                return it ? (
                  <View key={b.id} style={{ marginTop: 8 }}>
                    <Row item={it} onOpen={onOpen} note={`Seen ${b.count.toLocaleString()}×`} />
                  </View>
                ) : null;
              })}
            </Card>
          ) : null}
        </View>
      )}

      {(audit.locked > 0 || audit.recovered > 0) && (
        <View style={{ marginTop: 16 }}>
          <Banner icon="warning-outline" color={c.danger}
            title={audit.locked ? `${audit.locked} entr${audit.locked === 1 ? "y" : "ies"} can't be decrypted` : "Recovered with a fallback key"}
            body={audit.locked
              ? "These were encrypted with an older key. Re-encrypt to restore them if the key is still available on the server."
              : "Re-encrypt these entries with the current key to finish the recovery."} />
          {!offline && (
            <View style={{ gap: 10 }}>
              <Button title="Re-encrypt with current key" icon="refresh" loading={busy} onPress={() => void reencrypt()} />
              {audit.locked > 0 && (
                <Card style={{ gap: 8 }}>
                  <Text style={{ color: c.text, fontSize: 13, fontWeight: "800" }}>Manual Old Hex-Key Recovery</Text>
                  <Text style={{ color: c.muted, fontSize: 11 }}>
                    Paste your previous 64-char VAULT_ENCRYPTION_SECRET to rescue locked entries.
                  </Text>
                  <Field
                    value={oldHexKey}
                    onChangeText={setOldHexKey}
                    placeholder="Old 64-character hex key..."
                    secureTextEntry
                    style={{ fontFamily: "monospace" }}
                  />
                  <Button
                    title="Unlock & Re-encrypt with Old Key"
                    variant="ghost"
                    disabled={!oldHexKey.trim()}
                    loading={busy}
                    onPress={() => void reencrypt(oldHexKey)}
                    style={{ height: 42 }}
                  />
                </Card>
              )}
            </View>
          )}
        </View>
      )}

      {clean ? (
        <Card style={{ alignItems: "center", marginTop: 16 }}>
          <Ionicons name="checkmark-circle" size={44} color={c.ok} />
          <Text style={{ color: c.text, fontSize: 16, fontWeight: "800", marginTop: 8 }}>No critical issues found</Text>
          <Text style={{ color: c.muted, textAlign: "center", marginTop: 4 }}>
            Passwords are strong and unique, and your backup keys are healthy.
          </Text>
        </Card>
      ) : null}

      <Group title="Weak or fair passwords" color={c.danger} icon="alert-circle" items={audit.weak} onOpen={onOpen}
        note={(i) => evaluatePasswordStrength(i.password || "").label} />
      {audit.reused.length > 0 && (
        <Section title={`Reused passwords (${audit.reusedCount})`} color={c.warn} icon="copy">
          {audit.reused.map((g, n) => (
            <View key={n} style={{ marginBottom: 10 }}>
              <Text style={{ color: c.faint, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>SAME PASSWORD · {g.length} ACCOUNTS</Text>
              {g.map((i) => <Row key={i.id} item={i} onOpen={onOpen} />)}
            </View>
          ))}
        </Section>
      )}
      <Section title={`Low backup codes (${audit.lowKeys.length})`} color="#f97316" icon="key" hidden={!audit.lowKeys.length}>
        {audit.lowKeys.map(({ item, left, total }) => (
          <Row key={item.id} item={item} onOpen={onOpen} note={`${left} of ${total} left`} />
        ))}
      </Section>
      <Group title="No two-factor authentication" color={c.info} icon="phone-portrait" items={audit.noTotp.slice(0, 15)} onOpen={onOpen}
        note={() => "Add a TOTP secret"} />
    </ScrollView>
  );
}

function Section({ title, color, icon, children, hidden }: {
  title: string; color: string; icon: React.ComponentProps<typeof Ionicons>["name"]; children: React.ReactNode; hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <Card style={{ marginTop: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Ionicons name={icon} size={17} color={color} />
        <Text style={{ color, fontSize: 14, fontWeight: "800" }}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

function Group({ title, color, icon, items, onOpen, note }: {
  title: string; color: string; icon: React.ComponentProps<typeof Ionicons>["name"];
  items: VaultItem[]; onOpen: (id: string) => void; note: (i: VaultItem) => string;
}) {
  return (
    <Section title={`${title} (${items.length})`} color={color} icon={icon} hidden={!items.length}>
      {items.map((i) => <Row key={i.id} item={i} onOpen={onOpen} note={note(i)} />)}
    </Section>
  );
}

function Row({ item, onOpen, note }: { item: VaultItem; onOpen: (id: string) => void; note?: string }) {
  return (
    <Pressable onPress={() => onOpen(item.id)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10,
      padding: 10, marginBottom: 6, borderRadius: radius.md, backgroundColor: pressed ? c.card2 : c.card2 + "aa",
      borderWidth: 1, borderColor: c.border })}>
      <SiteIcon domain={item.domainKey} name={item.label} size={34} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontWeight: "700" }}>{item.label}</Text>
        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12 }}>{item.email || item.username || item.domainKey}</Text>
      </View>
      {note ? <Text style={{ color: c.muted, fontSize: 12, fontWeight: "600" }}>{note}</Text> : null}
    </Pressable>
  );
}
