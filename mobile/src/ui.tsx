import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput,
  TextInputProps, View, ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { c, radius } from "./theme";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

// Styles are built per render so they always use the current theme colours.
const S = () =>
  StyleSheet.create({
    btn: { height: 50, borderRadius: radius.md, flexDirection: "row", gap: 8,
      alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
    btnText: { fontSize: 16, fontWeight: "700" },
    iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    label: { color: c.muted, fontSize: 12, fontWeight: "600", marginBottom: 6, letterSpacing: 0.4 },
    input: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.md,
      color: c.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
    card: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.lg, padding: 16 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
      borderColor: c.border, backgroundColor: c.card, marginRight: 8, marginBottom: 8 },
    toast: { position: "absolute", bottom: 90, alignSelf: "center", backgroundColor: c.card2,
      borderColor: c.border, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24 },
  });

export function Button({
  title, onPress, variant = "primary", icon, loading, disabled, style,
}: {
  title: string; onPress: () => void; variant?: "primary" | "ghost" | "danger";
  icon?: IconName; loading?: boolean; disabled?: boolean; style?: ViewStyle;
}) {
  const s = S();
  const bg = variant === "primary" ? c.accent : variant === "danger" ? c.danger + "1f" : c.card2;
  const fg = variant === "primary" ? c.accentText : variant === "danger" ? c.danger : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant !== "primary" && { borderWidth: 1, borderColor: variant === "danger" ? c.danger + "55" : c.border },
        style,
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

export function IconButton({ icon, onPress, color, size = 22, label }: {
  icon: IconName; onPress: () => void; color?: string; size?: number; label?: string;
}) {
  const s = S();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityLabel={label}
      style={({ pressed }) => [s.iconBtn, pressed && { backgroundColor: c.card2 }]}>
      <Ionicons name={icon} size={size} color={color || c.text} />
    </Pressable>
  );
}

export function Field({ label, ...p }: TextInputProps & { label: string }) {
  const s = S();
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
  return <View style={[S().card, style]}>{children}</View>;
}

export function Chip({ label, active, onPress, color }: {
  label: string; active?: boolean; onPress: () => void; color?: string;
}) {
  const s = S();
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
    <View pointerEvents="none" style={S().toast}>
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

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={{ color: c.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.6,
      marginTop: 24, marginBottom: 8 }}>{children.toUpperCase()}</Text>
  );
}

/** A tappable settings line with an icon, title, optional subtitle and right-hand element. */
export function SettingsRow({ icon, title, subtitle, right, onPress, danger, last }: {
  icon: IconName; title: string; subtitle?: string; right?: React.ReactNode;
  onPress?: () => void; danger?: boolean; last?: boolean;
}) {
  const color = danger ? c.danger : c.text;
  return (
    <Pressable disabled={!onPress} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", padding: 14, gap: 12,
        backgroundColor: pressed ? c.card2 : "transparent",
        borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border })}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: (danger ? c.danger : c.accent) + "1f",
        alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={19} color={danger ? c.danger : c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color, fontSize: 16, fontWeight: "600" }}>{title}</Text>
        {subtitle ? <Text style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={c.faint} /> : null)}
    </Pressable>
  );
}

export function Banner({ icon, color, title, body, action, onAction, onClose }: {
  icon: IconName; color?: string; title: string; body?: string;
  action?: string; onAction?: () => void; onClose?: () => void;
}) {
  const tint = color || c.accent;
  return (
    <View style={{ flexDirection: "row", gap: 12, padding: 14, borderRadius: radius.lg, marginBottom: 12,
      backgroundColor: tint + "1a", borderWidth: 1, borderColor: tint + "55" }}>
      <Ionicons name={icon} size={22} color={tint} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontWeight: "700", fontSize: 15 }}>{title}</Text>
        {body ? <Text style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>{body}</Text> : null}
        {action ? (
          <Pressable onPress={onAction} style={{ marginTop: 8, alignSelf: "flex-start" }}>
            <Text style={{ color: tint, fontWeight: "800", fontSize: 14 }}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {onClose ? <Ionicons name="close" size={20} color={c.faint} onPress={onClose} /> : null}
    </View>
  );
}

export function StatBox({ icon, label, value, color }: { icon: IconName; label: string; value: number | string; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.card, borderColor: c.border, borderWidth: 1,
      borderRadius: radius.md, padding: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Ionicons name={icon} size={13} color={color} />
        <Text style={{ color, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
      </View>
      <Text style={{ color: c.text, fontSize: 22, fontWeight: "900", marginTop: 4 }}>{value}</Text>
    </View>
  );
}

export function StrengthMeter({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <View style={{ marginTop: -6, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= score ? color : c.border }} />
        ))}
      </View>
      <Text style={{ color, fontSize: 12, fontWeight: "700", marginTop: 4 }}>{label}</Text>
    </View>
  );
}
