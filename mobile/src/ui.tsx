import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { c, radius } from "./theme";
import { getAppNameForDomain, getFaviconUrls } from "./lib/domain";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

const MONOGRAM_COLORS = [
  "#f59e0b",
  "#06b6d4",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#3b82f6",
];

function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

const S = () =>
  StyleSheet.create({
    btn: {
      height: 48,
      borderRadius: radius.md,
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    btnText: { fontSize: 14, fontWeight: "800" },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      color: c.muted,
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 6,
    },
    input: {
      backgroundColor: c.card2,
      borderColor: c.borderStrong,
      borderWidth: 1,
      borderRadius: radius.md,
      color: c.text,
      paddingHorizontal: 13,
      paddingVertical: 11,
      fontSize: 14,
    },
    card: {
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius.xl,
      padding: 16,
    },
    inset: {
      backgroundColor: c.card2,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: 12,
    },
    chip: {
      paddingHorizontal: 13,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card2,
      marginRight: 7,
      marginBottom: 7,
    },
    toast: {
      position: "absolute",
      bottom: 84,
      alignSelf: "center",
      backgroundColor: c.card,
      borderColor: c.ok + "66",
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      elevation: 8,
    },
  });

export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const s = S();
  const bg =
    variant === "primary"
      ? c.accent
      : variant === "danger"
        ? c.danger + "1f"
        : c.card2;
  const fg =
    variant === "primary"
      ? c.accentText
      : variant === "danger"
        ? c.danger
        : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant !== "primary" && {
          borderWidth: 1,
          borderColor: variant === "danger" ? c.danger + "55" : c.border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={17} color={fg} />}
          <Text style={[s.btnText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color,
  size = 22,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  label?: string;
}) {
  const s = S();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityLabel={label}
      style={({ pressed }) => [s.iconBtn, pressed && { backgroundColor: c.card2 }]}
    >
      <Ionicons name={icon} size={size} color={color || c.text} />
    </Pressable>
  );
}

export function Field({
  label,
  icon,
  right,
  errorBorder,
  ...p
}: TextInputProps & {
  label?: string;
  icon?: IconName;
  right?: React.ReactNode;
  errorBorder?: boolean;
}) {
  const s = S();
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View
        style={[
          s.input,
          {
            flexDirection: "row",
            alignItems: p.multiline ? "flex-start" : "center",
            paddingVertical: 0,
            paddingHorizontal: icon ? 10 : 12,
            borderColor: errorBorder ? c.danger : c.borderStrong,
          },
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={16}
            color={c.faint}
            style={{ marginRight: 8, marginTop: p.multiline ? 12 : 0 }}
          />
        ) : null}
        <TextInput
          placeholderTextColor={c.faint}
          autoCapitalize="none"
          autoCorrect={false}
          {...p}
          style={[
            {
              flex: 1,
              color: c.text,
              paddingVertical: 11,
              fontSize: 14,
              minHeight: p.multiline ? 76 : undefined,
              textAlignVertical: p.multiline ? "top" : "center",
            },
            p.style,
          ]}
        />
        {right}
      </View>
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[S().card, style]}>{children}</View>;
}

export function Inset({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[S().inset, style]}>{children}</View>;
}

export function Chip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  color?: string;
}) {
  const s = S();
  const activeCol = color || c.accent;
  const activeTextCol = color || c.accentLabel;
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.chip,
        active && {
          backgroundColor: color ? color + "26" : c.accentSoft,
          borderColor: activeCol,
        },
      ]}
    >
      <Text
        style={{
          color: active ? activeTextCol : c.muted,
          fontWeight: "700",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Matches website's SiteIcon.tsx: crisp white squircle so dark logos (GitHub, Vercel, X)
 * pop cleanly in Dark mode, with Google 128px -> DuckDuckGo IP3 -> colored monogram fallback.
 */
export function SiteIcon({
  domain,
  name,
  size = 44,
}: {
  domain: string;
  name: string;
  size?: number;
}) {
  const { primary, fallback, domain: cleanDomain } = getFaviconUrls(domain);
  const [stage, setStage] = useState<"primary" | "fallback" | "monogram">(
    primary ? "primary" : "monogram"
  );

  useEffect(() => {
    setStage(primary ? "primary" : "monogram");
  }, [primary, cleanDomain]);

  const boxRadius = Math.max(radius.sm, Math.round(size * 0.28));

  if (!cleanDomain) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: boxRadius,
          backgroundColor: c.card2,
          borderWidth: 1,
          borderColor: c.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="globe-outline" size={size * 0.52} color={c.faint} />
      </View>
    );
  }

  if (stage === "monogram") {
    const title = name || getAppNameForDomain(cleanDomain) || "V";
    const initials =
      title
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || "V";
    const bg =
      MONOGRAM_COLORS[hashStr(cleanDomain || title) % MONOGRAM_COLORS.length];
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: boxRadius,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: size * 0.36 }}>
          {initials}
        </Text>
      </View>
    );
  }

  const uri = stage === "primary" ? primary! : fallback!;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: boxRadius,
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: c.isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.16)",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Image
        source={{ uri }}
        style={{ width: size * 0.62, height: size * 0.62 }}
        resizeMode="contain"
        onError={() => {
          if (stage === "primary" && fallback) setStage("fallback");
          else setStage("monogram");
        }}
      />
    </View>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View pointerEvents="none" style={S().toast}>
      <Ionicons name="checkmark-circle" size={16} color={c.ok} />
      <Text style={{ color: c.text, fontWeight: "700", fontSize: 13 }}>
        {message}
      </Text>
    </View>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  return { msg, show: setMsg };
}

/** Copy to clipboard and wipe it after 30s if it still holds the same value. */
export async function copySecret(value: string) {
  await Clipboard.setStringAsync(value);
  setTimeout(async () => {
    try {
      if ((await Clipboard.getStringAsync()) === value)
        await Clipboard.setStringAsync("");
    } catch {
      /* app backgrounded */
    }
  }, 30_000);
}

export function Empty({
  icon,
  title,
  body,
}: {
  icon: IconName;
  title: string;
  body?: string;
}) {
  return (
    <View style={{ alignItems: "center", padding: 36 }}>
      <Ionicons name={icon} size={44} color={c.faint} />
      <Text
        style={{
          color: c.text,
          fontSize: 17,
          fontWeight: "800",
          marginTop: 12,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            color: c.muted,
            textAlign: "center",
            marginTop: 6,
            fontSize: 13,
            lineHeight: 19,
          }}
        >
          {body}
        </Text>
      ) : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      style={{
        color: c.muted,
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 0.8,
        marginTop: 22,
        marginBottom: 8,
      }}
    >
      {children.toUpperCase()}
    </Text>
  );
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  danger,
  last,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const color = danger ? c.danger : c.text;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        gap: 12,
        backgroundColor: pressed ? c.card2 : "transparent",
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.md,
          backgroundColor: danger ? c.danger + "1f" : c.accentSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={icon}
          size={19}
          color={danger ? c.danger : c.accentLabel}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color, fontSize: 15, fontWeight: "700" }}>{title}</Text>
        {subtitle ? (
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ??
        (onPress ? (
          <Ionicons name="chevron-forward" size={18} color={c.faint} />
        ) : null)}
    </Pressable>
  );
}

export function Banner({
  icon,
  color,
  title,
  body,
  action,
  onAction,
  onClose,
}: {
  icon: IconName;
  color?: string;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  onClose?: () => void;
}) {
  const tint = color || c.accent;
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 14,
        borderRadius: radius.lg,
        marginBottom: 12,
        backgroundColor: tint + "1a",
        borderWidth: 1,
        borderColor: tint + "55",
      }}
    >
      <Ionicons name={icon} size={22} color={tint} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontWeight: "800", fontSize: 14 }}>
          {title}
        </Text>
        {body ? (
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
            {body}
          </Text>
        ) : null}
        {action ? (
          <Pressable
            onPress={onAction}
            style={{ marginTop: 8, alignSelf: "flex-start" }}
          >
            <Text style={{ color: tint, fontWeight: "800", fontSize: 13 }}>
              {action}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {onClose ? (
        <Ionicons name="close" size={20} color={c.faint} onPress={onClose} />
      ) : null}
    </View>
  );
}

export function StatBox({
  icon,
  label,
  value,
  color,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: number | string;
  color: string;
  onPress?: () => void;
}) {
  const inner = (
    <View
      style={{
        flex: 1,
        backgroundColor: c.card,
        borderColor: c.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: 13,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Ionicons name={icon} size={13} color={color} />
        <Text
          numberOfLines={1}
          style={{
            color,
            fontSize: 10,
            fontWeight: "800",
            letterSpacing: 0.5,
          }}
        >
          {label.toUpperCase()}
        </Text>
      </View>
      <Text
        style={{
          color: c.text,
          fontSize: 22,
          fontWeight: "900",
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      {inner}
    </Pressable>
  );
}

export function StrengthMeter({
  score,
  label,
  color,
}: {
  score: number;
  label: string;
  color: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: -6,
        marginBottom: 12,
      }}
    >
      <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= score ? color : c.borderStrong,
            }}
          />
        ))}
      </View>
      <Text
        style={{
          color,
          fontSize: 10,
          fontWeight: "800",
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}
