import { ACCENTS, SURFACES } from "./surfaces";

export { ACCENTS, SURFACES };

/**
 * `c` is a live, mutable palette. Changing the theme mutates it and the main
 * screen is re-mounted (see prefs.tsx), so every `c.xxx` read picks up the new colours.
 */
export const c = {
  bg: "#09090b",
  card: "#111115",
  card2: "#18181d",
  border: "rgba(255,255,255,0.08)",
  text: "#fafafa",
  muted: "#a1a1aa",
  faint: "#71717a",
  accent: "#f59e0b",
  accentText: "#1a1204",
  danger: "#ef4444",
  ok: "#10b981",
  warn: "#f59e0b",
  info: "#06b6d4",
  isLight: false,
};
export const radius = { sm: 10, md: 14, lg: 20 };

export interface ThemePrefs {
  accent: string;
  surface: string;
  mode: "dark" | "light";
}
export const DEFAULT_THEME: ThemePrefs = { accent: "amber", surface: "zinc", mode: "dark" };

export function applyTheme(t: ThemePrefs) {
  const accent = ACCENTS.find((a) => a.id === t.accent) || ACCENTS[0];
  const surface = SURFACES.find((x) => x.id === t.surface) || SURFACES[0];
  const light = t.mode === "light";
  const pal = light ? surface.light : surface.dark;
  Object.assign(c, {
    bg: pal.bg,
    card: pal.card,
    card2: pal.card2,
    border: pal.border,
    text: light ? "#18181b" : "#fafafa",
    muted: light ? "#52525b" : "#a1a1aa",
    faint: light ? "#8a8a93" : "#71717a",
    accent: accent.c,
    accentText: accent.darkText ? "#1a1204" : "#ffffff",
    danger: light ? "#dc2626" : "#ef4444",
    ok: light ? "#059669" : "#10b981",
    warn: accent.id === "amber" ? accent.c : "#f59e0b",
    isLight: light,
  });
}
