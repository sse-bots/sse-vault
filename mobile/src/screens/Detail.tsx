import React, { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api";
import { useVault } from "../vault";
import { CATEGORIES } from "../types";
import { formatCode, generateTotp, parseTotp, secondsLeft } from "../totp";
import { Button, Card, IconButton, SiteIcon, Toast, copySecret, useToast } from "../ui";
import { Countdown, useNow } from "./Authenticator";
import { c, radius } from "../theme";

export default function Detail({ id, onBack, onEdit }: { id: string; onBack: () => void; onEdit: () => void }) {
  const { items, refresh } = useVault();
  const item = items.find((i) => i.id === id);
  const toast = useToast();
  const now = useNow();
  const [reveal, setReveal] = useState(false);

  if (!item) {
    return (
      <View style={{ flex: 1, padding: 20 }}>
        <IconButton icon="chevron-back" onPress={onBack} />
        <Text style={{ color: c.muted, textAlign: "center", marginTop: 40 }}>This item no longer exists.</Text>
      </View>
    );
  }

  const totp = parseTotp(item.totpSecret);
  const cat = CATEGORIES.find((k) => k.id === item.category);
  const copy = async (v: string | null, what: string) => {
    if (!v) return;
    await copySecret(v);
    toast.show(`${what} copied`);
  };

  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); await refresh(); } catch (e) { Alert.alert("Error", (e as Error).message); }
  };

  const confirmDelete = () =>
    Alert.alert("Delete this item?", `${item.label} will be permanently removed from your vault.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await api.deleteItem(item.id); await refresh(); onBack(); }
        catch (e) { Alert.alert("Error", (e as Error).message); }
      } },
    ]);

  const unused = item.securityCodes.filter((k) => !k.used).length;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
        <IconButton icon="chevron-back" onPress={onBack} label="Back" />
        <View style={{ flex: 1 }} />
        <IconButton icon={item.favorite ? "star" : "star-outline"} color={item.favorite ? c.accent : c.text}
          onPress={() => act(() => api.updateItem(item.id, { favorite: !item.favorite }))} />
        <IconButton icon="create-outline" onPress={onEdit} label="Edit" />
        <IconButton icon="trash-outline" color={c.danger} onPress={confirmDelete} label="Delete" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <View style={{ alignItems: "center", marginBottom: 20 }}>
          <SiteIcon domain={item.domainKey} name={item.label} size={72} />
          <Text style={{ color: c.text, fontSize: 24, fontWeight: "800", marginTop: 12 }}>{item.label}</Text>
          <Pressable onPress={() => item.url && Linking.openURL(item.url).catch(() => {})}>
            <Text style={{ color: c.accent, marginTop: 4 }}>{item.domainKey}</Text>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <Pill text={cat?.label || "Personal"} color={cat?.color || c.faint} />
            {item.authType === "oauth" && <Pill text={`Sign in with ${item.oauthProvider || "OAuth"}`} color={c.muted} />}
            {item.hasPasskey && <Pill text="Passkey" color={c.ok} />}
          </View>
        </View>

        {item.decryptionStatus !== "ok" && (
          <Card style={{ borderColor: c.danger, marginBottom: 12 }}>
            <Text style={{ color: c.danger, fontWeight: "700" }}>
              {item.decryptionStatus === "locked" ? "Some data could not be decrypted" : "Recovered with a fallback key"}
            </Text>
            <Text style={{ color: c.muted, marginTop: 4 }}>
              Open the website's Settings to re-encrypt this entry with the current key.
            </Text>
          </Card>
        )}

        <Card style={{ padding: 0 }}>
          {item.email ? <Row label="Email" value={item.email} onCopy={() => copy(item.email, "Email")} /> : null}
          {item.username ? <Row label="Username" value={item.username} onCopy={() => copy(item.username, "Username")} /> : null}
          {item.authType === "password" && (
            <Row label="Password" value={item.password ? (reveal ? item.password : "••••••••••••") : "—"}
              mono onCopy={item.password ? () => copy(item.password, "Password") : undefined}
              extra={item.password ? (
                <IconButton icon={reveal ? "eye-off-outline" : "eye-outline"} size={20} color={c.muted}
                  onPress={() => setReveal((r) => !r)} />
              ) : undefined} last={!item.notes && !totp} />
          )}
        </Card>

        {totp ? (
          <Card style={{ marginTop: 12 }}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>ONE-TIME CODE</Text>
            <Pressable onPress={() => copy(generateTotp(totp, now), "Code")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: c.text, fontSize: 34, fontWeight: "800", letterSpacing: 4 }}>
                {formatCode(generateTotp(totp, now))}
              </Text>
              <Countdown left={secondsLeft(totp, now)} period={totp.period} />
            </Pressable>
          </Card>
        ) : null}

        {item.securityCodes.length > 0 && (
          <Card style={{ marginTop: 12 }}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: "600", marginBottom: 10 }}>
              BACKUP CODES · {unused} of {item.securityCodes.length} unused
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {item.securityCodes.map((k) => (
                <Pressable key={k.id}
                  onPress={async () => {
                    if (k.locked) return;
                    if (!k.used && k.code) await copySecret(k.code);
                    await act(() => api.toggleCode(item.id, k.id, !k.used));
                  }}
                  style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.sm,
                    backgroundColor: c.card2, borderWidth: 1, borderColor: c.border, opacity: k.used ? 0.5 : 1 }}>
                  <Text style={{ color: k.locked ? c.danger : c.text, fontWeight: "700",
                    letterSpacing: k.used ? 1 : 0.5, fontFamily: "monospace" }}>
                    {k.locked ? "locked" : k.used ? k.masked : k.code}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ color: c.faint, fontSize: 12, marginTop: 10 }}>
              Tap a code to copy it and mark it used. Tap a used code to restore it.
            </Text>
          </Card>
        )}

        {item.notes ? (
          <Card style={{ marginTop: 12 }}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>NOTES</Text>
            <Text style={{ color: c.text, lineHeight: 21 }}>{item.notes}</Text>
          </Card>
        ) : null}

        <Text style={{ color: c.faint, fontSize: 12, textAlign: "center", marginTop: 20 }}>
          Updated {new Date(item.updatedAt).toLocaleString()}
        </Text>
      </ScrollView>
      <Toast message={toast.msg} />
    </View>
  );
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: color + "22" }}>
      <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

function Row({ label, value, onCopy, extra, mono, last }: {
  label: string; value: string; onCopy?: () => void; extra?: React.ReactNode; mono?: boolean; last?: boolean;
}) {
  return (
    <Pressable onPress={onCopy} style={{ flexDirection: "row", alignItems: "center", padding: 14,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.muted, fontSize: 12, fontWeight: "600" }}>{label}</Text>
        <Text selectable={false} style={{ color: c.text, fontSize: 16, marginTop: 3,
          fontFamily: mono ? "monospace" : undefined }}>{value}</Text>
      </View>
      {extra}
      {onCopy ? <Ionicons name="copy-outline" size={20} color={c.muted} style={{ marginLeft: 6 }} /> : null}
    </Pressable>
  );
}
