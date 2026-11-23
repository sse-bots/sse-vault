"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Circle,
  Monitor,
  Moon,
  Paintbrush,
  Palette,
  RotateCcw,
  Square,
  Sun,
  Type,
} from "lucide-react";
import {
  ColorMode,
  DEFAULT_THEME_STATE,
  FONT_OPTIONS,
  NEUTRAL_PALETTES,
  PRIMARY_COLORS,
  RADIUS_OPTIONS,
  THEME_PRESETS,
  ThemeState,
} from "@/lib/theme-config";

type SubmenuKey = "preset" | "primary" | "neutral" | "font" | "radius" | null;

export function ThemeCustomizer({
  theme,
  onChange,
  align = "right",
}: {
  theme: ThemeState;
  onChange: (next: ThemeState) => void;
  align?: "right" | "left";
}) {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<SubmenuKey>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSubmenu(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setSubmenu(null);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const currentPreset =
    THEME_PRESETS.find((p) => p.id === theme.preset) || THEME_PRESETS[0];
  const currentPrimary =
    PRIMARY_COLORS.find((c) => c.id === theme.primary) || PRIMARY_COLORS[6];
  const currentNeutral =
    NEUTRAL_PALETTES.find((n) => n.id === theme.neutral) || NEUTRAL_PALETTES[0];
  const currentFont =
    FONT_OPTIONS.find((f) => f.id === theme.font) || FONT_OPTIONS[0];

  function toggleSubmenu(key: SubmenuKey) {
    setSubmenu((prev) => (prev === key ? null : key));
  }

  function selectPreset(presetId: string) {
    const p = THEME_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    onChange({
      ...theme,
      preset: p.id,
      primary: p.primary,
      neutral: p.neutral,
      font: p.font,
      radius: p.radius,
    });
  }

  function setMode(mode: ColorMode) {
    onChange({ ...theme, mode });
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Nuxt UI Palette Icon Trigger */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setSubmenu(null);
        }}
        aria-label="Open Theme Customizer"
        title="Customize Theme (Nuxt UI Style)"
        className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition active:scale-95 ${
          open
            ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
            : "border-slate-800 bg-slate-900/90 text-indigo-400 hover:border-indigo-500/60"
        }`}
      >
        <Palette className="h-4 w-4" />
      </button>

      {open && (
        <div
          className={`animate-sheet-up absolute top-11 z-50 w-72 overflow-hidden rounded-2xl border border-slate-700/90 bg-[#0b1120] shadow-2xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* 1. Theme Preset Row (Default / Mono / Cobalt / Sky / Mint / Iris / Crimson / Coral / Sunset / Carbon / Bubblegum / Parchment) */}
          <div className="border-b border-slate-800/90 p-1.5">
            <button
              type="button"
              onClick={() => toggleSubmenu("preset")}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                submenu === "preset"
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-indigo-300 hover:bg-slate-800/70"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${currentPreset.dot}26` }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: currentPreset.dot }}
                  />
                </span>
                <span>{currentPreset.label}</span>
              </span>
              <ChevronRight
                className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                  submenu === "preset" ? "rotate-90" : ""
                }`}
              />
            </button>

            {submenu === "preset" && (
              <div className="animate-menu-item mt-1 max-h-56 space-y-0.5 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/80 p-1.5">
                {THEME_PRESETS.map((p) => {
                  const active = theme.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPreset(p.id)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                        active
                          ? "bg-slate-800 font-semibold text-white"
                          : "text-slate-300 hover:bg-slate-800/60"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: p.dot }}
                        />
                        {p.label}
                      </span>
                      {active && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Primary, Neutral, Font, Radius rows (exact Nuxt UI structure) */}
          <div className="space-y-0.5 border-b border-slate-800/90 p-1.5">
            {/* Primary Color Row */}
            <div>
              <button
                type="button"
                onClick={() => toggleSubmenu("primary")}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition ${
                  submenu === "primary"
                    ? "bg-slate-800/90 text-white"
                    : "text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Paintbrush className="h-3.5 w-3.5 text-slate-400" />
                  <span>Primary</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium text-indigo-400">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: currentPrimary.c500 }}
                  />
                  <span>{currentPrimary.label}</span>
                  <ChevronRight
                    className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
                      submenu === "primary" ? "rotate-90" : ""
                    }`}
                  />
                </span>
              </button>

              {submenu === "primary" && (
                <div className="animate-menu-item mt-1 grid max-h-56 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/80 p-1.5">
                  {PRIMARY_COLORS.map((c) => {
                    const active = theme.primary === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          onChange({ ...theme, preset: "custom", primary: c.id })
                        }
                        className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                          active
                            ? "bg-slate-800 font-semibold text-white"
                            : "text-slate-300 hover:bg-slate-800/60"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-white/20"
                            style={{ backgroundColor: c.c500 }}
                          />
                          <span>{c.label}</span>
                        </span>
                        {active && <Check className="h-3 w-3 text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Neutral Surface Row */}
            <div>
              <button
                type="button"
                onClick={() => toggleSubmenu("neutral")}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition ${
                  submenu === "neutral"
                    ? "bg-slate-800/90 text-white"
                    : "text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Circle className="h-3.5 w-3.5 text-slate-400" />
                  <span>Neutral</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: currentNeutral.dot }}
                  />
                  <span>{currentNeutral.label}</span>
                  <ChevronRight
                    className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
                      submenu === "neutral" ? "rotate-90" : ""
                    }`}
                  />
                </span>
              </button>

              {submenu === "neutral" && (
                <div className="animate-menu-item mt-1 space-y-0.5 rounded-xl border border-slate-800/80 bg-slate-950/80 p-1.5">
                  {NEUTRAL_PALETTES.map((n) => {
                    const active = theme.neutral === n.id;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() =>
                          onChange({ ...theme, preset: "custom", neutral: n.id })
                        }
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                          active
                            ? "bg-slate-800 font-semibold text-white"
                            : "text-slate-300 hover:bg-slate-800/60"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: n.dot }}
                          />
                          <span>{n.label}</span>
                        </span>
                        {active && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Font Family Row */}
            <div>
              <button
                type="button"
                onClick={() => toggleSubmenu("font")}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition ${
                  submenu === "font"
                    ? "bg-slate-800/90 text-white"
                    : "text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Type className="h-3.5 w-3.5 text-slate-400" />
                  <span>Font</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span>{currentFont.label}</span>
                  <ChevronRight
                    className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
                      submenu === "font" ? "rotate-90" : ""
                    }`}
                  />
                </span>
              </button>

              {submenu === "font" && (
                <div className="animate-menu-item mt-1 max-h-52 space-y-0.5 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/80 p-1.5">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Sans Fonts
                  </div>
                  {FONT_OPTIONS.map((f) => {
                    const active = theme.font === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          onChange({ ...theme, preset: "custom", font: f.id })
                        }
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                          active
                            ? "bg-slate-800 font-semibold text-white"
                            : "text-slate-300 hover:bg-slate-800/60"
                        }`}
                      >
                        <span>{f.label}</span>
                        {active && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Radius Row */}
            <div>
              <button
                type="button"
                onClick={() => toggleSubmenu("radius")}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition ${
                  submenu === "radius"
                    ? "bg-slate-800/90 text-white"
                    : "text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Square className="h-3.5 w-3.5 text-slate-400" />
                  <span>Radius</span>
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                  <span>{theme.radius}</span>
                  <ChevronRight
                    className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
                      submenu === "radius" ? "rotate-90" : ""
                    }`}
                  />
                </span>
              </button>

              {submenu === "radius" && (
                <div className="animate-menu-item mt-1 space-y-0.5 rounded-xl border border-slate-800/80 bg-slate-950/80 p-1.5">
                  {RADIUS_OPTIONS.map((r) => {
                    const active = theme.radius === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() =>
                          onChange({ ...theme, preset: "custom", radius: r.id })
                        }
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 font-mono text-xs transition ${
                          active
                            ? "bg-slate-800 font-semibold text-white"
                            : "text-slate-300 hover:bg-slate-800/60"
                        }`}
                      >
                        <span>{r.label}</span>
                        {active && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 3. Light / Dark / System 3-Way Toggle (Exact Nuxt UI Row) */}
          <div className="flex items-center justify-between border-b border-slate-800/90 px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs font-medium text-slate-200">
              {theme.mode === "light" ? (
                <Sun className="h-3.5 w-3.5 text-amber-400" />
              ) : theme.mode === "dark" ? (
                <Moon className="h-3.5 w-3.5 text-indigo-400" />
              ) : (
                <Monitor className="h-3.5 w-3.5 text-slate-400" />
              )}
              <span className="capitalize">{theme.mode}</span>
            </span>

            <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950 p-0.5">
              <button
                type="button"
                onClick={() => setMode("light")}
                title="Light Mode"
                className={`rounded-lg p-1.5 transition ${
                  theme.mode === "light"
                    ? "bg-slate-800 text-amber-400"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setMode("dark")}
                title="Dark Mode"
                className={`rounded-lg p-1.5 transition ${
                  theme.mode === "dark"
                    ? "bg-slate-800 text-indigo-400"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setMode("system")}
                title="System Mode"
                className={`rounded-lg p-1.5 transition ${
                  theme.mode === "system"
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* 4. Reset to Default */}
          <div className="p-1.5">
            <button
              type="button"
              onClick={() => {
                onChange(DEFAULT_THEME_STATE);
                setSubmenu(null);
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800/70 hover:text-white"
            >
              <span>Reset to Default</span>
              <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
