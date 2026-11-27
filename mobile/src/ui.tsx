import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput,
  TextInputProps, View, ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { c, radius } from "./theme";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function Button({
  title, onPress, variant = "primary", icon, loading, disabled, style,
}: {
  title: string; onPress: () => void; variant?: "primary" | "ghost" | "danger";
  icon?: IconName; loading?: boolean; disabled?: boolean; style?: ViewStyle;
}) {
  const bg = variant === "primary" ? c.accent : variant === "danger" ? "#2a1214" : c.card2;
  const fg = variant === "primary" ? c.accentText : variant === "danger" ? c.danger : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant !== "primary" && { borderWidth: 1, borderColor: c.border }, style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[s.btnText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color = c.text, size = 22, label }: {
  icon: IconName; onPress: () => void; color?: string; size?: number; label?: string;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityLabel={label}
      style={({ pressed }) => [s.iconBtn, pressed && { backgroundColor: c.card2 }]}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Field({ label, ...p }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor={c.faint}
        autoCapitalize="none"
        autoCorrect={false}
        {...p}
        style={[s.input, p.multiline && { minHeight: 90, textAlignVertical: "top" }, p.style]}
      />
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Chip({ label, active, onPress, color }: {
  label: string; active?: boolean; onPress: () => void; color?: string;
}) {
  return (
    <Pressable onPress={onPress}
      style={[s.chip, active && { backgroundColor: (color || c.accent) + "26", borderColor: color || c.accent }]}>
      <Text style={{ color: active ? color || c.accent : c.muted, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function SiteIcon({ domain, name, size = 44 }: { domain: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: c.card2,
      alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {!failed && domain && domain !== "other" ? (
        <Image
          source={{ uri: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` }}
          style={{ width: size * 0.6, height: size * 0.6 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={{ color: c.accent, fontWeight: "800", fontSize: size * 0.4 }}>{letter}</Text>
      )}
    </View>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View pointerEvents="none" style={s.toast}>
      <Text style={{ color: c.text, fontWeight: "600" }}>{message}</Text>
    </View>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 1800);
    return () => clearTimeout(t);
  }, [msg]);
  return { msg, show: setMsg };
}

/** Copy to clipboard and wipe it after 30s if it still holds the same value. */
export async function copySecret(value: string) {
  await Clipboard.setStringAsync(value);
  setTimeout(async () => {
    try {
      if ((await Clipboard.getStringAsync()) === value) await Clipboard.setStringAsync("");
    } catch { /* app backgrounded */ }
  }, 30_000);
}

export function Empty({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  return (
    <View style={{ alignItems: "center", padding: 40 }}>
      <Ionicons name={icon} size={44} color={c.faint} />
      <Text style={{ color: c.text, fontSize: 17, fontWeight: "700", marginTop: 12 }}>{title}</Text>
      {body ? <Text style={{ color: c.muted, textAlign: "center", marginTop: 6 }}>{body}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  btn: { height: 50, borderRadius: radius.md, flexDirection: "row", gap: 8,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  btnText: { fontSize: 16, fontWeight: "700" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  label: { color: c.muted, fontSize: 12, fontWeight: "600", marginBottom: 6, letterSpacing: 0.4 },
  input: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.md,
    color: c.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  card: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.lg, padding: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
    borderColor: c.border, backgroundColor: c.card, marginRight: 8 },
  toast: { position: "absolute", bottom: 90, alignSelf: "center", backgroundColor: c.card2,
    borderColor: c.border, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24 },
});
