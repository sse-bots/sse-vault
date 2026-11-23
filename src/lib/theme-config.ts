export interface PrimaryColorOption {
  id: string;
  label: string;
  c400: string;
  c500: string;
  c600: string;
  /** High-contrast accent text color for Light Mode surfaces */
  lightText: string;
  darkTextOnSolid?: boolean;
}

export interface NeutralPaletteOption {
  id: string;
  label: string;
  dot: string;
  dark: {
    bg: string;
    sidebar: string;
    card: string;
    input: string;
    muted: string;
    hover: string;
    border: string;
  };
  light: {
    bg: string;
    sidebar: string;
    card: string;
    input: string;
    muted: string;
    hover: string;
    border: string;
  };
}

export interface FontOption {
  id: string;
  label: string;
  family: string;
  googleQuery: string;
}

export interface RadiusOption {
  id: string;
  label: string;
  value: string;
}

export interface ThemePresetOption {
  id: string;
  label: string;
  dot: string;
  primary: string;
  neutral: string;
  font: string;
  radius: string;
}

export type ColorMode = "light" | "dark" | "system";

export interface ThemeState {
  preset: string;
  primary: string;
  neutral: string;
  font: string;
  radius: string;
  mode: ColorMode;
}

export const PRIMARY_COLORS: PrimaryColorOption[] = [
  { id: "black", label: "Black", c400: "#f8fafc", c500: "#e2e8f0", c600: "#ffffff", lightText: "#0f172a", darkTextOnSolid: true },
  { id: "red", label: "Red", c400: "#f87171", c500: "#ef4444", c600: "#dc2626", lightText: "#b91c1c" },
  { id: "orange", label: "Orange", c400: "#fb923c", c500: "#f97316", c600: "#ea580c", lightText: "#c2410c" },
  { id: "amber", label: "Amber", c400: "#fbbf24", c500: "#f59e0b", c600: "#d97706", lightText: "#b45309", darkTextOnSolid: true },
  { id: "yellow", label: "Yellow", c400: "#facc15", c500: "#eab308", c600: "#ca8a04", lightText: "#a16207", darkTextOnSolid: true },
  { id: "lime", label: "Lime", c400: "#a3e635", c500: "#84cc16", c600: "#65a30d", lightText: "#4d7c0f", darkTextOnSolid: true },
  { id: "green", label: "Green", c400: "#4ade80", c500: "#22c55e", c600: "#16a34a", lightText: "#15803d" },
  { id: "emerald", label: "Emerald", c400: "#34d399", c500: "#10b981", c600: "#059669", lightText: "#047857" },
  { id: "teal", label: "Teal", c400: "#2dd4bf", c500: "#14b8a6", c600: "#0d9488", lightText: "#0f766e" },
  { id: "cyan", label: "Cyan", c400: "#22d3ee", c500: "#06b6d4", c600: "#0891b2", lightText: "#0e7490" },
  { id: "sky", label: "Sky", c400: "#38bdf8", c500: "#0ea5e9", c600: "#0284c7", lightText: "#0369a1" },
  { id: "blue", label: "Blue", c400: "#60a5fa", c500: "#3b82f6", c600: "#2563eb", lightText: "#1d4ed8" },
  { id: "indigo", label: "Indigo", c400: "#818cf8", c500: "#6366f1", c600: "#4f46e5", lightText: "#4338ca" },
  { id: "violet", label: "Violet", c400: "#a78bfa", c500: "#8b5cf6", c600: "#7c3aed", lightText: "#6d28d9" },
  { id: "purple", label: "Purple", c400: "#c084fc", c500: "#a855f7", c600: "#9333ea", lightText: "#7e22ce" },
  { id: "fuchsia", label: "Fuchsia", c400: "#e879f9", c500: "#d946ef", c600: "#c026d3", lightText: "#a21caf" },
  { id: "pink", label: "Pink", c400: "#f472b6", c500: "#ec4899", c600: "#db2777", lightText: "#be185d" },
  { id: "rose", label: "Rose", c400: "#fb7185", c500: "#f43f5e", c600: "#e11d48", lightText: "#be123c" },
];

export const NEUTRAL_PALETTES: NeutralPaletteOption[] = [
  {
    id: "slate",
    label: "Slate",
    dot: "#64748b",
    dark: { bg: "#070b14", sidebar: "#0b1120", card: "#0f172a", input: "#090f1d", muted: "#1e293b", hover: "#263449", border: "#1e293b" },
    light: { bg: "#f1f5f9", sidebar: "#ffffff", card: "#ffffff", input: "#f8fafc", muted: "#e2e8f0", hover: "#cbd5e1", border: "#cbd5e1" },
  },
  {
    id: "gray",
    label: "Gray",
    dot: "#6b7280",
    dark: { bg: "#080a0f", sidebar: "#0d1017", card: "#111827", input: "#0a0e16", muted: "#1f2937", hover: "#2c3849", border: "#1f2937" },
    light: { bg: "#f3f4f6", sidebar: "#ffffff", card: "#ffffff", input: "#f9fafb", muted: "#e5e7eb", hover: "#d1d5db", border: "#d1d5db" },
  },
  {
    id: "zinc",
    label: "Zinc",
    dot: "#71717a",
    dark: { bg: "#09090b", sidebar: "#0e0e11", card: "#18181b", input: "#101013", muted: "#27272a", hover: "#323236", border: "#27272a" },
    light: { bg: "#f4f4f5", sidebar: "#ffffff", card: "#ffffff", input: "#fafafa", muted: "#e4e4e7", hover: "#d4d4d8", border: "#d4d4d8" },
  },
  {
    id: "neutral",
    label: "Neutral",
    dot: "#737373",
    dark: { bg: "#0a0a0a", sidebar: "#101010", card: "#171717", input: "#0f0f0f", muted: "#262626", hover: "#323232", border: "#262626" },
    light: { bg: "#f5f5f5", sidebar: "#ffffff", card: "#ffffff", input: "#fafafa", muted: "#e5e5e5", hover: "#d4d4d4", border: "#d4d4d4" },
  },
  {
    id: "stone",
    label: "Stone",
    dot: "#78716c",
    dark: { bg: "#0c0a09", sidebar: "#12100e", card: "#1c1917", input: "#110f0d", muted: "#292524", hover: "#363130", border: "#292524" },
    light: { bg: "#f5f5f4", sidebar: "#ffffff", card: "#ffffff", input: "#fafaf9", muted: "#e7e5e4", hover: "#d6d3d1", border: "#d6d3d1" },
  },
  {
    id: "taupe",
    label: "Taupe",
    dot: "#8b7e74",
    dark: { bg: "#0e0c0b", sidebar: "#151210", card: "#1e1a17", input: "#13100e", muted: "#2e2824", hover: "#3b332e", border: "#322b26" },
    light: { bg: "#f5f2ef", sidebar: "#fffdfb", card: "#ffffff", input: "#faf7f5", muted: "#e8e2dc", hover: "#d9cfc6", border: "#d6cdc5" },
  },
  {
    id: "mauve",
    label: "Mauve",
    dot: "#8b7b8b",
    dark: { bg: "#0d0a10", sidebar: "#140f18", card: "#1c1522", input: "#120d16", muted: "#2b2133", hover: "#382b42", border: "#302439" },
    light: { bg: "#f6f2f7", sidebar: "#ffffff", card: "#ffffff", input: "#fbf8fc", muted: "#eae2ec", hover: "#dcd0e0", border: "#d8cadb" },
  },
  {
    id: "mist",
    label: "Mist",
    dot: "#6d8594",
    dark: { bg: "#070c10", sidebar: "#0c1319", card: "#121d26", input: "#0a1117", muted: "#1e2e3b", hover: "#293d4d", border: "#223442" },
    light: { bg: "#eff4f7", sidebar: "#ffffff", card: "#ffffff", input: "#f6fafc", muted: "#dfe9ef", hover: "#cddce6", border: "#c7d7e0" },
  },
  {
    id: "olive",
    label: "Olive",
    dot: "#7a8468",
    dark: { bg: "#0a0c08", sidebar: "#10130d", card: "#181c14", input: "#0e110b", muted: "#262c20", hover: "#323a2b", border: "#2a3123" },
    light: { bg: "#f3f5ef", sidebar: "#ffffff", card: "#ffffff", input: "#f9faf6", muted: "#e4e8dc", hover: "#d4dbc8", border: "#cfd6c4" },
  },
];

export const FONT_OPTIONS: FontOption[] = [
  { id: "public-sans", label: "Public Sans", family: "'Public Sans', ui-sans-serif, system-ui, sans-serif", googleQuery: "Public+Sans:wght@400;500;600;700;800" },
  { id: "inter", label: "Inter", family: "'Inter', ui-sans-serif, system-ui, sans-serif", googleQuery: "Inter:wght@400;500;600;700;800" },
  { id: "dm-sans", label: "DM Sans", family: "'DM Sans', ui-sans-serif, system-ui, sans-serif", googleQuery: "DM+Sans:wght@400;500;600;700" },
  { id: "geist", label: "Geist", family: "'Geist', ui-sans-serif, system-ui, sans-serif", googleQuery: "Geist:wght@400;500;600;700" },
  { id: "outfit", label: "Outfit", family: "'Outfit', ui-sans-serif, system-ui, sans-serif", googleQuery: "Outfit:wght@400;500;600;700;800" },
  { id: "poppins", label: "Poppins", family: "'Poppins', ui-sans-serif, system-ui, sans-serif", googleQuery: "Poppins:wght@400;500;600;700" },
  { id: "raleway", label: "Raleway", family: "'Raleway', ui-sans-serif, system-ui, sans-serif", googleQuery: "Raleway:wght@400;500;600;700;800" },
  { id: "roboto", label: "Roboto", family: "'Roboto', ui-sans-serif, system-ui, sans-serif", googleQuery: "Roboto:wght@400;500;700" },
  { id: "figtree", label: "Figtree", family: "'Figtree', ui-sans-serif, system-ui, sans-serif", googleQuery: "Figtree:wght@400;500;600;700;800" },
  { id: "nunito", label: "Nunito", family: "'Nunito', ui-sans-serif, system-ui, sans-serif", googleQuery: "Nunito:wght@400;600;700;800" },
  { id: "manrope", label: "Manrope", family: "'Manrope', ui-sans-serif, system-ui, sans-serif", googleQuery: "Manrope:wght@400;500;600;700;800" },
];

export const RADIUS_OPTIONS: RadiusOption[] = [
  { id: "0rem", label: "0rem", value: "0rem" },
  { id: "0.125rem", label: "0.125rem", value: "0.125rem" },
  { id: "0.25rem", label: "0.25rem", value: "0.25rem" },
  { id: "0.375rem", label: "0.375rem", value: "0.375rem" },
  { id: "0.5rem", label: "0.5rem", value: "0.5rem" },
  { id: "0.625rem", label: "0.625rem", value: "0.625rem" },
  { id: "0.75rem", label: "0.75rem", value: "0.75rem" },
];

export const THEME_PRESETS: ThemePresetOption[] = [
  { id: "default", label: "Default", dot: "#22c55e", primary: "green", neutral: "slate", font: "public-sans", radius: "0.5rem" },
  { id: "mono", label: "Mono", dot: "#e2e8f0", primary: "black", neutral: "zinc", font: "geist", radius: "0.25rem" },
  { id: "cobalt", label: "Cobalt", dot: "#3b82f6", primary: "blue", neutral: "slate", font: "inter", radius: "0.5rem" },
  { id: "sky", label: "Sky", dot: "#0ea5e9", primary: "sky", neutral: "mist", font: "dm-sans", radius: "0.5rem" },
  { id: "mint", label: "Mint", dot: "#10b981", primary: "emerald", neutral: "olive", font: "outfit", radius: "0.625rem" },
  { id: "iris", label: "Iris", dot: "#6366f1", primary: "indigo", neutral: "slate", font: "inter", radius: "0.5rem" },
  { id: "crimson", label: "Crimson", dot: "#ef4444", primary: "red", neutral: "neutral", font: "figtree", radius: "0.375rem" },
  { id: "coral", label: "Coral", dot: "#f43f5e", primary: "rose", neutral: "mauve", font: "poppins", radius: "0.625rem" },
  { id: "sunset", label: "Sunset", dot: "#f97316", primary: "orange", neutral: "stone", font: "manrope", radius: "0.5rem" },
  { id: "carbon", label: "Carbon", dot: "#eab308", primary: "amber", neutral: "zinc", font: "geist", radius: "0.25rem" },
  { id: "bubblegum", label: "Bubblegum", dot: "#ec4899", primary: "pink", neutral: "mauve", font: "nunito", radius: "0.75rem" },
  { id: "parchment", label: "Parchment", dot: "#84cc16", primary: "lime", neutral: "taupe", font: "raleway", radius: "0.375rem" },
];

export const DEFAULT_THEME_STATE: ThemeState = {
  preset: "default",
  primary: "green",
  neutral: "slate",
  font: "public-sans",
  radius: "0.5rem",
  mode: "dark",
};

const STORAGE_KEY = "sse-accounts-nuxtui-theme-v1";

export function loadSavedTheme(): ThemeState {
  if (typeof window === "undefined") return DEFAULT_THEME_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME_STATE;
    const parsed = JSON.parse(raw) as Partial<ThemeState>;
    return {
      preset: parsed.preset || DEFAULT_THEME_STATE.preset,
      primary: PRIMARY_COLORS.some((c) => c.id === parsed.primary)
        ? (parsed.primary as string)
        : DEFAULT_THEME_STATE.primary,
      neutral: NEUTRAL_PALETTES.some((n) => n.id === parsed.neutral)
        ? (parsed.neutral as string)
        : DEFAULT_THEME_STATE.neutral,
      font: FONT_OPTIONS.some((f) => f.id === parsed.font)
        ? (parsed.font as string)
        : DEFAULT_THEME_STATE.font,
      radius: RADIUS_OPTIONS.some((r) => r.id === parsed.radius)
        ? (parsed.radius as string)
        : DEFAULT_THEME_STATE.radius,
      mode:
        parsed.mode === "light" || parsed.mode === "dark" || parsed.mode === "system"
          ? parsed.mode
          : DEFAULT_THEME_STATE.mode,
    };
  } catch {
    return DEFAULT_THEME_STATE;
  }
}

export function saveThemeState(state: ThemeState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyThemeToDocument(state: ThemeState): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const resolvedMode: "dark" | "light" =
    state.mode === "system" ? (prefersDark ? "dark" : "light") : state.mode;

  root.classList.remove("dark", "light");
  root.classList.add(resolvedMode);
  root.setAttribute("data-primary", state.primary);
  root.setAttribute("data-neutral", state.neutral);
  root.setAttribute("data-radius", state.radius);

  const primaryObj =
    PRIMARY_COLORS.find((c) => c.id === state.primary) || PRIMARY_COLORS[6];
  const neutralObj =
    NEUTRAL_PALETTES.find((n) => n.id === state.neutral) || NEUTRAL_PALETTES[0];
  const fontObj =
    FONT_OPTIONS.find((f) => f.id === state.font) || FONT_OPTIONS[0];
  const surface = resolvedMode === "light" ? neutralObj.light : neutralObj.dark;

  const isMono = primaryObj.id === "black";
  const c400 = isMono
    ? resolvedMode === "light"
      ? "#0f172a"
      : "#f8fafc"
    : resolvedMode === "light"
      ? primaryObj.lightText
      : primaryObj.c400;
  const c500 = isMono
    ? resolvedMode === "light"
      ? "#1e293b"
      : "#e2e8f0"
    : primaryObj.c500;
  const c600 = isMono
    ? resolvedMode === "light"
      ? "#0f172a"
      : "#ffffff"
    : primaryObj.c600;
  const onPrimary = isMono
    ? resolvedMode === "light"
      ? "#ffffff"
      : "#090b10"
    : primaryObj.darkTextOnSolid
      ? "#090b10"
      : "#ffffff";

  root.style.setProperty("--accent-400", c400);
  root.style.setProperty("--accent-500", c500);
  root.style.setProperty("--accent-600", c600);
  root.style.setProperty("--accent-on-solid", onPrimary);
  root.style.setProperty("--accent-glow", hexToRgba(c500, resolvedMode === "light" ? 0.22 : 0.30));
  root.style.setProperty("--accent-soft", hexToRgba(c500, resolvedMode === "light" ? 0.11 : 0.15));
  root.style.setProperty("--accent-hero-tint", hexToRgba(c500, resolvedMode === "light" ? 0.14 : 0.20));
  root.style.setProperty("--accent-border", hexToRgba(c500, resolvedMode === "light" ? 0.38 : 0.45));

  root.style.setProperty("--surface-bg", surface.bg);
  root.style.setProperty("--surface-sidebar", surface.sidebar);
  root.style.setProperty("--surface-card", surface.card);
  root.style.setProperty("--surface-input", surface.input);
  root.style.setProperty("--surface-muted", surface.muted);
  root.style.setProperty("--surface-hover", surface.hover);
  root.style.setProperty("--surface-border", surface.border);

  root.style.setProperty("--app-font", fontObj.family);
  root.style.setProperty("--app-radius", state.radius);

  const linkId = `sse-gfont-${fontObj.id}`;
  if (!document.getElementById(linkId)) {
    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${fontObj.googleQuery}&display=swap`;
    document.head.appendChild(link);
  }
}
