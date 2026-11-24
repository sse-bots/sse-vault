export interface PrimaryColorOption {
  id: string;
  label: string;
  c400: string;
  c500: string;
  c600: string;
  lightText: string;
  darkTextOnSolid?: boolean;
}

export interface NeutralPaletteOption {
  id: string;
  label: string;
  dot: string;
  dark: {
    bg: string;
    elevated: string;
    inset: string;
    hover: string;
    border: string;
    borderStrong: string;
    header: string;
  };
  light: {
    bg: string;
    elevated: string;
    inset: string;
    hover: string;
    border: string;
    borderStrong: string;
    header: string;
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
  { id: "amber", label: "Amber", c400: "#fbbf24", c500: "#f59e0b", c600: "#d97706", lightText: "#b45309", darkTextOnSolid: true },
  { id: "orange", label: "Orange", c400: "#fb923c", c500: "#f97316", c600: "#ea580c", lightText: "#c2410c", darkTextOnSolid: false },
  { id: "yellow", label: "Yellow", c400: "#facc15", c500: "#eab308", c600: "#ca8a04", lightText: "#a16207", darkTextOnSolid: true },
  { id: "lime", label: "Lime", c400: "#a3e635", c500: "#84cc16", c600: "#65a30d", lightText: "#4d7c0f", darkTextOnSolid: true },
  { id: "green", label: "Green", c400: "#4ade80", c500: "#22c55e", c600: "#16a34a", lightText: "#15803d" },
  { id: "emerald", label: "Emerald", c400: "#34d399", c500: "#10b981", c600: "#059669", lightText: "#047857" },
  { id: "teal", label: "Teal", c400: "#2dd4bf", c500: "#14b8a6", c600: "#0d9488", lightText: "#0f766e" },
  { id: "cyan", label: "Cyan", c400: "#22d3ee", c500: "#06b6d4", c600: "#0891b2", lightText: "#0e7490", darkTextOnSolid: true },
  { id: "sky", label: "Sky", c400: "#38bdf8", c500: "#0ea5e9", c600: "#0284c7", lightText: "#0369a1" },
  { id: "blue", label: "Blue", c400: "#60a5fa", c500: "#3b82f6", c600: "#2563eb", lightText: "#1d4ed8" },
  { id: "indigo", label: "Indigo", c400: "#818cf8", c500: "#6366f1", c600: "#4f46e5", lightText: "#4338ca" },
  { id: "violet", label: "Violet", c400: "#a78bfa", c500: "#8b5cf6", c600: "#7c3aed", lightText: "#6d28d9" },
  { id: "purple", label: "Purple", c400: "#c084fc", c500: "#a855f7", c600: "#9333ea", lightText: "#7e22ce" },
  { id: "fuchsia", label: "Fuchsia", c400: "#e879f9", c500: "#d946ef", c600: "#c026d3", lightText: "#a21caf" },
  { id: "pink", label: "Pink", c400: "#f472b6", c500: "#ec4899", c600: "#db2777", lightText: "#be185d" },
  { id: "rose", label: "Rose", c400: "#fb7185", c500: "#f43f5e", c600: "#e11d48", lightText: "#be123c" },
  { id: "red", label: "Red", c400: "#f87171", c500: "#ef4444", c600: "#dc2626", lightText: "#b91c1c" },
  { id: "black", label: "Mono", c400: "#f4f4f5", c500: "#e4e4e7", c600: "#ffffff", lightText: "#18181b", darkTextOnSolid: true },
];

export const NEUTRAL_PALETTES: NeutralPaletteOption[] = [
  {
    id: "zinc",
    label: "Carbon",
    dot: "#71717a",
    dark: {
      bg: "#09090b",
      elevated: "#111115",
      inset: "#18181d",
      hover: "#222229",
      border: "rgba(255, 255, 255, 0.08)",
      borderStrong: "rgba(255, 255, 255, 0.16)",
      header: "rgba(9, 9, 11, 0.88)",
    },
    light: {
      bg: "#f6f5f1",
      elevated: "#ffffff",
      inset: "#f0eee8",
      hover: "#e7e4dc",
      border: "rgba(24, 24, 27, 0.09)",
      borderStrong: "rgba(24, 24, 27, 0.18)",
      header: "rgba(246, 245, 241, 0.90)",
    },
  },
  {
    id: "slate",
    label: "Slate",
    dot: "#64748b",
    dark: {
      bg: "#070b14",
      elevated: "#0f172a",
      inset: "#131c31",
      hover: "#1e293b",
      border: "rgba(148, 163, 184, 0.14)",
      borderStrong: "rgba(148, 163, 184, 0.24)",
      header: "rgba(7, 11, 20, 0.88)",
    },
    light: {
      bg: "#f1f5f9",
      elevated: "#ffffff",
      inset: "#e8eef5",
      hover: "#dbe4ef",
      border: "rgba(15, 23, 42, 0.10)",
      borderStrong: "rgba(15, 23, 42, 0.18)",
      header: "rgba(241, 245, 249, 0.90)",
    },
  },
  {
    id: "neutral",
    label: "Obsidian",
    dot: "#525252",
    dark: {
      bg: "#050505",
      elevated: "#101010",
      inset: "#171717",
      hover: "#242424",
      border: "rgba(255, 255, 255, 0.09)",
      borderStrong: "rgba(255, 255, 255, 0.18)",
      header: "rgba(5, 5, 5, 0.88)",
    },
    light: {
      bg: "#f5f5f5",
      elevated: "#ffffff",
      inset: "#ededed",
      hover: "#e2e2e2",
      border: "rgba(23, 23, 23, 0.09)",
      borderStrong: "rgba(23, 23, 23, 0.18)",
      header: "rgba(245, 245, 245, 0.90)",
    },
  },
  {
    id: "gray",
    label: "Graphite",
    dot: "#6b7280",
    dark: {
      bg: "#080a0f",
      elevated: "#111827",
      inset: "#182132",
      hover: "#243045",
      border: "rgba(156, 163, 175, 0.13)",
      borderStrong: "rgba(156, 163, 175, 0.22)",
      header: "rgba(8, 10, 15, 0.88)",
    },
    light: {
      bg: "#f3f4f6",
      elevated: "#ffffff",
      inset: "#ebedf0",
      hover: "#dfe2e7",
      border: "rgba(17, 24, 39, 0.09)",
      borderStrong: "rgba(17, 24, 39, 0.18)",
      header: "rgba(243, 244, 246, 0.90)",
    },
  },
  {
    id: "stone",
    label: "Stone",
    dot: "#78716c",
    dark: {
      bg: "#0c0a09",
      elevated: "#161311",
      inset: "#1f1b18",
      hover: "#2c2723",
      border: "rgba(231, 229, 228, 0.09)",
      borderStrong: "rgba(231, 229, 228, 0.18)",
      header: "rgba(12, 10, 9, 0.88)",
    },
    light: {
      bg: "#f5f5f4",
      elevated: "#ffffff",
      inset: "#ecebe8",
      hover: "#e2e0db",
      border: "rgba(28, 25, 23, 0.09)",
      borderStrong: "rgba(28, 25, 23, 0.18)",
      header: "rgba(245, 245, 244, 0.90)",
    },
  },
  {
    id: "taupe",
    label: "Taupe",
    dot: "#8b7e74",
    dark: {
      bg: "#0e0c0b",
      elevated: "#1a1614",
      inset: "#231e1b",
      hover: "#302925",
      border: "rgba(232, 226, 220, 0.09)",
      borderStrong: "rgba(232, 226, 220, 0.18)",
      header: "rgba(14, 12, 11, 0.88)",
    },
    light: {
      bg: "#f5f2ef",
      elevated: "#fffdfb",
      inset: "#ede7e1",
      hover: "#e1d8cf",
      border: "rgba(30, 26, 23, 0.10)",
      borderStrong: "rgba(30, 26, 23, 0.18)",
      header: "rgba(245, 242, 239, 0.90)",
    },
  },
  {
    id: "mauve",
    label: "Mauve",
    dot: "#8b7b8b",
    dark: {
      bg: "#0d0a10",
      elevated: "#17111d",
      inset: "#211829",
      hover: "#2d2138",
      border: "rgba(234, 226, 236, 0.10)",
      borderStrong: "rgba(234, 226, 236, 0.19)",
      header: "rgba(13, 10, 16, 0.88)",
    },
    light: {
      bg: "#f6f2f7",
      elevated: "#ffffff",
      inset: "#eee7f0",
      hover: "#e3d9e6",
      border: "rgba(28, 21, 34, 0.10)",
      borderStrong: "rgba(28, 21, 34, 0.18)",
      header: "rgba(246, 242, 247, 0.90)",
    },
  },
  {
    id: "mist",
    label: "Mist",
    dot: "#6d8594",
    dark: {
      bg: "#070c10",
      elevated: "#0f1921",
      inset: "#15232e",
      hover: "#1e303f",
      border: "rgba(205, 220, 230, 0.11)",
      borderStrong: "rgba(205, 220, 230, 0.21)",
      header: "rgba(7, 12, 16, 0.88)",
    },
    light: {
      bg: "#eff4f7",
      elevated: "#ffffff",
      inset: "#e5eef3",
      hover: "#d7e4ec",
      border: "rgba(18, 29, 38, 0.10)",
      borderStrong: "rgba(18, 29, 38, 0.18)",
      header: "rgba(239, 244, 247, 0.90)",
    },
  },
  {
    id: "olive",
    label: "Olive",
    dot: "#7a8468",
    dark: {
      bg: "#0a0c08",
      elevated: "#141810",
      inset: "#1c2117",
      hover: "#262d20",
      border: "rgba(228, 232, 220, 0.10)",
      borderStrong: "rgba(228, 232, 220, 0.19)",
      header: "rgba(10, 12, 8, 0.88)",
    },
    light: {
      bg: "#f3f5ef",
      elevated: "#ffffff",
      inset: "#e9ede2",
      hover: "#dde3d3",
      border: "rgba(24, 28, 20, 0.10)",
      borderStrong: "rgba(24, 28, 20, 0.18)",
      header: "rgba(243, 245, 239, 0.90)",
    },
  },
];

export const FONT_OPTIONS: FontOption[] = [
  { id: "inter", label: "Inter", family: "'Inter', ui-sans-serif, system-ui, sans-serif", googleQuery: "Inter:wght@400;500;600;700;800;900" },
  { id: "public-sans", label: "Public Sans", family: "'Public Sans', ui-sans-serif, system-ui, sans-serif", googleQuery: "Public+Sans:wght@400;500;600;700;800" },
  { id: "geist", label: "Geist", family: "'Geist', ui-sans-serif, system-ui, sans-serif", googleQuery: "Geist:wght@400;500;600;700;800" },
  { id: "dm-sans", label: "DM Sans", family: "'DM Sans', ui-sans-serif, system-ui, sans-serif", googleQuery: "DM+Sans:wght@400;500;600;700" },
  { id: "outfit", label: "Outfit", family: "'Outfit', ui-sans-serif, system-ui, sans-serif", googleQuery: "Outfit:wght@400;500;600;700;800" },
  { id: "poppins", label: "Poppins", family: "'Poppins', ui-sans-serif, system-ui, sans-serif", googleQuery: "Poppins:wght@400;500;600;700" },
  { id: "figtree", label: "Figtree", family: "'Figtree', ui-sans-serif, system-ui, sans-serif", googleQuery: "Figtree:wght@400;500;600;700;800" },
  { id: "manrope", label: "Manrope", family: "'Manrope', ui-sans-serif, system-ui, sans-serif", googleQuery: "Manrope:wght@400;500;600;700;800" },
  { id: "nunito", label: "Nunito", family: "'Nunito', ui-sans-serif, system-ui, sans-serif", googleQuery: "Nunito:wght@400;600;700;800" },
  { id: "raleway", label: "Raleway", family: "'Raleway', ui-sans-serif, system-ui, sans-serif", googleQuery: "Raleway:wght@400;500;600;700;800" },
  { id: "roboto", label: "Roboto", family: "'Roboto', ui-sans-serif, system-ui, sans-serif", googleQuery: "Roboto:wght@400;500;700" },
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
  { id: "vault-amber", label: "Vault Amber", dot: "#f59e0b", primary: "amber", neutral: "zinc", font: "inter", radius: "0.5rem" },
  { id: "nexus-green", label: "Nexus Green", dot: "#22c55e", primary: "green", neutral: "slate", font: "public-sans", radius: "0.5rem" },
  { id: "mono", label: "Mono", dot: "#e4e4e7", primary: "black", neutral: "neutral", font: "geist", radius: "0.25rem" },
  { id: "cobalt", label: "Cobalt", dot: "#3b82f6", primary: "blue", neutral: "slate", font: "inter", radius: "0.5rem" },
  { id: "cyber-cyan", label: "Cyber Cyan", dot: "#06b6d4", primary: "cyan", neutral: "mist", font: "dm-sans", radius: "0.5rem" },
  { id: "mint", label: "Mint", dot: "#10b981", primary: "emerald", neutral: "olive", font: "outfit", radius: "0.625rem" },
  { id: "iris", label: "Iris", dot: "#6366f1", primary: "indigo", neutral: "slate", font: "inter", radius: "0.5rem" },
  { id: "crimson", label: "Crimson", dot: "#ef4444", primary: "red", neutral: "neutral", font: "figtree", radius: "0.375rem" },
  { id: "coral", label: "Coral", dot: "#f43f5e", primary: "rose", neutral: "mauve", font: "poppins", radius: "0.625rem" },
  { id: "sunset", label: "Sunset", dot: "#f97316", primary: "orange", neutral: "stone", font: "manrope", radius: "0.5rem" },
  { id: "bubblegum", label: "Bubblegum", dot: "#ec4899", primary: "pink", neutral: "mauve", font: "nunito", radius: "0.75rem" },
  { id: "parchment", label: "Parchment", dot: "#84cc16", primary: "lime", neutral: "taupe", font: "raleway", radius: "0.375rem" },
];

export const DEFAULT_THEME_STATE: ThemeState = {
  preset: "vault-amber",
  primary: "amber",
  neutral: "zinc",
  font: "inter",
  radius: "0.5rem",
  mode: "dark",
};

const STORAGE_KEY = "sse-vault-theme-v2";

export function loadSavedTheme(): ThemeState {
  if (typeof window === "undefined") return DEFAULT_THEME_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Respect legacy light/dark toggle if user set it previously
      const legacyMode = window.localStorage.getItem("sse-vault-mode");
      if (legacyMode === "light" || legacyMode === "dark") {
        return { ...DEFAULT_THEME_STATE, mode: legacyMode };
      }
      return DEFAULT_THEME_STATE;
    }
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
        parsed.mode === "light" ||
        parsed.mode === "dark" ||
        parsed.mode === "system"
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
    PRIMARY_COLORS.find((c) => c.id === state.primary) || PRIMARY_COLORS[0];
  const neutralObj =
    NEUTRAL_PALETTES.find((n) => n.id === state.neutral) || NEUTRAL_PALETTES[0];
  const fontObj =
    FONT_OPTIONS.find((f) => f.id === state.font) || FONT_OPTIONS[0];
  const surface = resolvedMode === "light" ? neutralObj.light : neutralObj.dark;

  const isMono = primaryObj.id === "black";
  const accentText = isMono
    ? resolvedMode === "light"
      ? "#18181b"
      : "#fafafa"
    : resolvedMode === "light"
      ? primaryObj.lightText
      : primaryObj.c400;
  const accent500 = isMono
    ? resolvedMode === "light"
      ? "#18181b"
      : "#f4f4f5"
    : primaryObj.c500;
  const accent400 = isMono
    ? resolvedMode === "light"
      ? "#27272a"
      : "#ffffff"
    : primaryObj.c400;
  const accent600 = isMono
    ? resolvedMode === "light"
      ? "#09090b"
      : "#d4d4d8"
    : primaryObj.c600;
  const onSolid = isMono
    ? resolvedMode === "light"
      ? "#ffffff"
      : "#09090b"
    : primaryObj.darkTextOnSolid
      ? "#09090b"
      : "#ffffff";

  // Map directly into SSE Vault's design tokens
  root.style.setProperty("--v-bg", surface.bg);
  root.style.setProperty("--v-bg-elevated", surface.elevated);
  root.style.setProperty("--v-bg-inset", surface.inset);
  root.style.setProperty("--v-bg-hover", surface.hover);
  root.style.setProperty("--v-border", surface.border);
  root.style.setProperty("--v-border-strong", surface.borderStrong);
  root.style.setProperty("--v-header", surface.header);

  root.style.setProperty("--v-amber", accent500);
  root.style.setProperty("--v-amber-light", accent400);
  root.style.setProperty("--v-amber-strong", accent600);
  root.style.setProperty("--v-amber-text", accentText);
  root.style.setProperty("--v-accent-on-solid", onSolid);
  root.style.setProperty(
    "--v-amber-soft",
    hexToRgba(accent500, resolvedMode === "light" ? 0.12 : 0.15)
  );
  root.style.setProperty(
    "--v-amber-border",
    hexToRgba(accent500, resolvedMode === "light" ? 0.38 : 0.45)
  );
  root.style.setProperty(
    "--v-amber-glow",
    hexToRgba(accent500, resolvedMode === "light" ? 0.22 : 0.30)
  );

  root.style.setProperty("--app-font", fontObj.family);
  root.style.setProperty("--app-radius", state.radius);

  // Sync browser & Android Capacitor status bar theme-color meta tag
  let metaTheme = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  if (!metaTheme) {
    metaTheme = document.createElement("meta");
    metaTheme.name = "theme-color";
    document.head.appendChild(metaTheme);
  }
  metaTheme.content = surface.bg;

  // Dynamically load selected Google Font
  const linkId = `sse-vault-gfont-${fontObj.id}`;
  if (!document.getElementById(linkId)) {
    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${fontObj.googleQuery}&display=swap`;
    document.head.appendChild(link);
  }
}
