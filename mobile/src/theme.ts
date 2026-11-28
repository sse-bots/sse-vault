import { Appearance } from "react-native";
import { ACCENTS, RADIUS_OPTIONS, SURFACES, THEME_PRESETS } from "./surfaces";

export { ACCENTS, RADIUS_OPTIONS, SURFACES, THEME_PRESETS };

export type ColorMode = "light" | "dark" | "system";

export interface ThemePrefs {
  preset: string;
  accent: string;
  surface: string;
  radius: string;
  mode: ColorMode;
}

export const DEFAULT_THEME: ThemePrefs = {
  preset: "vault-amber",
  accent: "amber",
  surface: "zinc",
  radius: "0.5rem",
  mode: "dark",
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return `rgba(245, 158, 11, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Live mutable palette & border-radius scale mirroring the website's CSS variables.
 * Changing the theme mutates `c` and `radius` and bumps `themeVersion` in PrefsProvider.
 */
export const c = {
  bg: "#09090b",
  card: "#111115",
  card2: "#18181d",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.16)",
  text: "#fafafa",
  muted: "#a1a1aa",
  faint: "#71717a",
  accent: "#f59e0b",
  accentLabel: "#fbbf24",
  accentText: "#09090b",
  accentSoft: "rgba(245,158,11,0.15)",
  accentBorder: "rgba(245,158,11,0.45)",
  danger: "#ef4444",
  ok: "#10b981",
  warn: "#f59e0b",
  info: "#06b6d4",
  isLight: false,
};

export const radius = {
  sm: 8,
  md: 11,
  lg: 15,
  xl: 20,
};

export function applyTheme(t: ThemePrefs) {
  const accent = ACCENTS.find((a) => a.id === t.accent) || ACCENTS[0];
  const surface = SURFACES.find((x) => x.id === t.surface) || SURFACES[0];
  const radOpt =
    RADIUS_OPTIONS.find((r) => r.id === t.radius) || RADIUS_OPTIONS[4];

  const sysScheme = Appearance.getColorScheme();
  const light =
    t.mode === "system" ? sysScheme === "light" : t.mode === "light";
  const pal = light ? surface.light : surface.dark;

  const isMono = accent.id === "black";
  const solidAccent = isMono ? (light ? "#18181b" : "#f4f4f5") : accent.c;
  const labelAccent = isMono
    ? light
      ? "#18181b"
      : "#fafafa"
    : light
      ? accent.light
      : accent.c;
  const onSolid = isMono
    ? light
      ? "#ffffff"
      : "#09090b"
    : accent.darkText
      ? "#09090b"
      : "#ffffff";

  Object.assign(c, {
    bg: pal.bg,
    card: pal.card,
    card2: pal.card2,
    border: pal.border,
    borderStrong: pal.borderStrong,
    text: light ? "#18181b" : "#fafafa",
    muted: light ? "#52525b" : "#a1a1aa",
    faint: light ? "#71717a" : "#8a8a97",
    accent: solidAccent,
    accentLabel: labelAccent,
    accentText: onSolid,
    accentSoft: hexToRgba(solidAccent, light ? 0.12 : 0.15),
    accentBorder: hexToRgba(solidAccent, light ? 0.38 : 0.45),
    danger: light ? "#dc2626" : "#ef4444",
    ok: light ? "#059669" : "#10b981",
    warn: accent.id === "amber" ? solidAccent : "#f59e0b",
    info: light ? "#0891b2" : "#06b6d4",
    isLight: light,
  });

  // Match website's dynamic radius scaling (0rem -> sharp, 0.5rem -> default, 0.75rem -> pill-soft)
  const base = radOpt.px;
  radius.sm = Math.round(base * 0.9);
  radius.md = Math.round(base * 1.35);
  radius.lg = Math.round(base * 1.85);
  radius.xl = Math.round(base * 2.45);
}
