import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  ACCENTS,
  RADIUS_OPTIONS,
  SURFACES,
  THEME_PRESETS,
  c,
  radius,
  type ColorMode,
  type ThemePrefs,
} from "./theme";

type Submenu = "preset" | "accent" | "surface" | "radius" | null;

export function ThemeCustomizerCard({
  theme,
  onChange,
  onReset,
}: {
  theme: ThemePrefs;
  onChange: (patch: Partial<ThemePrefs>) => void;
  onReset: () => void;
}) {
  const [submenu, setSubmenu] = useState<Submenu>(null);

  const currentPreset = THEME_PRESETS.find((p) => p.id === theme.preset);
  const currentAccent =
    ACCENTS.find((a) => a.id === theme.accent) || ACCENTS[0];
  const currentSurface =
    SURFACES.find((s) => s.id === theme.surface) || SURFACES[0];

  const applyPreset = (presetId: string) => {
    const p = THEME_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    onChange({
      preset: p.id,
      accent: p.accent,
      surface: p.surface,
      radius: p.radius,
    });
    setSubmenu(null);
  };

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderColor: c.border,
        borderWidth: 1,
        borderRadius: radius.xl,
        padding: 14,
      }}
    >
      {/* Header Row matching Website ThemeCustomizer */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="color-palette" size={16} color={c.accentLabel} />
          <Text style={{ color: c.text, fontSize: 14, fontWeight: "800" }}>
            Vault Theme
          </Text>
        </View>
        <Pressable
          onPress={() => {
            onReset();
            setSubmenu(null);
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: radius.sm,
          }}
        >
          <Ionicons name="refresh" size={13} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 12, fontWeight: "700" }}>
            Reset
          </Text>
        </Pressable>
      </View>

      {submenu ? (
        <View style={{ marginTop: 12 }}>
          <Pressable
            onPress={() => setSubmenu(null)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 12,
            }}
          >
            <Ionicons name="arrow-back" size={15} color={c.muted} />
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: "700" }}>
              Back to Theme Options
            </Text>
          </Pressable>

          {/* 12 Theme Presets Grid (2 columns) */}
          {submenu === "preset" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {THEME_PRESETS.map((p) => {
                const active = theme.preset === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => applyPreset(p.id)}
                    style={{
                      width: "48%",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      borderRadius: radius.md,
                      backgroundColor: active ? c.accentSoft : c.card2,
                      borderWidth: 1,
                      borderColor: active ? c.accent : c.border,
                    }}
                  >
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: p.dot,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.25)",
                      }}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        color: active ? c.accentLabel : c.text,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* 18 Accent Colors Grid (3 columns) */}
          {submenu === "accent" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ACCENTS.map((a) => {
                const active = theme.accent === a.id;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => onChange({ preset: "custom", accent: a.id })}
                    style={{
                      width: "31%",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 9,
                      borderRadius: radius.md,
                      backgroundColor: active ? c.accentSoft : c.card2,
                      borderWidth: 1,
                      borderColor: active ? c.accent : c.border,
                    }}
                  >
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: a.c,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.25)",
                      }}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        color: active ? c.accentLabel : c.text,
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      {a.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* 9 Surfaces Grid (3 columns) */}
          {submenu === "surface" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {SURFACES.map((s) => {
                const active = theme.surface === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() =>
                      onChange({ preset: "custom", surface: s.id })
                    }
                    style={{
                      width: "31%",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 10,
                      borderRadius: radius.md,
                      backgroundColor: active ? c.accentSoft : c.card2,
                      borderWidth: 1,
                      borderColor: active ? c.accent : c.border,
                    }}
                  >
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: s.dot,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.25)",
                      }}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        color: active ? c.accentLabel : c.text,
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* 7 Border Radius Options (4 columns) */}
          {submenu === "radius" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {RADIUS_OPTIONS.map((r) => {
                const active = theme.radius === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => onChange({ preset: "custom", radius: r.id })}
                    style={{
                      width: "23%",
                      alignItems: "center",
                      paddingVertical: 10,
                      borderRadius: radius.md,
                      backgroundColor: active ? c.accentSoft : c.card2,
                      borderWidth: 1,
                      borderColor: active ? c.accent : c.border,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? c.accentLabel : c.text,
                        fontSize: 11,
                        fontWeight: "800",
                        fontFamily: "monospace",
                      }}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : (
        <View style={{ marginTop: 12, gap: 8 }}>
          {/* Light / Dark / Auto Segmented Control */}
          <View
            style={{
              flexDirection: "row",
              gap: 4,
              backgroundColor: c.card2,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: radius.md,
              padding: 4,
            }}
          >
            {(
              [
                { id: "light", label: "Light", icon: "sunny" },
                { id: "dark", label: "Dark", icon: "moon" },
                { id: "system", label: "Auto", icon: "phone-portrait-outline" },
              ] as const
            ).map((m) => {
              const active = theme.mode === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => onChange({ mode: m.id as ColorMode })}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    paddingVertical: 8,
                    borderRadius: radius.sm,
                    backgroundColor: active ? c.accent : "transparent",
                  }}
                >
                  <Ionicons
                    name={m.icon}
                    size={14}
                    color={active ? c.accentText : c.muted}
                  />
                  <Text
                    style={{
                      color: active ? c.accentText : c.muted,
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 4 Drill-Down Rows matching Website ThemeCustomizer */}
          <ThemeRow
            icon={
              <Ionicons name="brush" size={15} color={c.accentLabel} />
            }
            label="Preset"
            value={currentPreset?.label || "Custom"}
            onPress={() => setSubmenu("preset")}
          />
          <ThemeRow
            icon={
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: currentAccent.c,
                }}
              />
            }
            label="Accent Color"
            value={currentAccent.label}
            onPress={() => setSubmenu("accent")}
          />
          <ThemeRow
            icon={
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: currentSurface.dot,
                }}
              />
            }
            label="Surface"
            value={currentSurface.label}
            onPress={() => setSubmenu("surface")}
          />
          <ThemeRow
            icon={
              <Ionicons name="square-outline" size={15} color={c.accentLabel} />
            }
            label="Radius"
            value={theme.radius}
            mono
            onPress={() => setSubmenu("radius")}
          />
        </View>
      )}
    </View>
  );
}

function ThemeRow({
  icon,
  label,
  value,
  mono,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: pressed ? c.card : c.card2,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radius.md,
        paddingHorizontal: 12,
        paddingVertical: 11,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {icon}
        <Text style={{ color: c.muted, fontSize: 13, fontWeight: "700" }}>
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text
          style={{
            color: c.text,
            fontSize: 13,
            fontWeight: "800",
            fontFamily: mono ? "monospace" : undefined,
          }}
        >
          {value}
        </Text>
        <Ionicons name="chevron-forward" size={15} color={c.faint} />
      </View>
    </Pressable>
  );
}
