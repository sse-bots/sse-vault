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
  X,
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

  const currentPrimary =
    PRIMARY_COLORS.find((c) => c.id === theme.primary) || PRIMARY_COLORS[0];
  const currentNeutral =
    NEUTRAL_PALETTES.find((n) => n.id === theme.neutral) || NEUTRAL_PALETTES[0];
  const currentFont =
    FONT_OPTIONS.find((f) => f.id === theme.font) || FONT_OPTIONS[0];
  const currentPreset = THEME_PRESETS.find((p) => p.id === theme.preset);

  function setMode(mode: ColorMode) {
    onChange({ ...theme, mode });
  }

  function applyPreset(presetId: string) {
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
    setSubmenu(null);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setSubmenu(null);
        }}
        title="Customize Vault Theme"
        aria-label="Customize Vault Theme"
        className={`vault-inset relative flex items-center justify-center rounded-xl p-2 transition hover:border-amber-500/50 active:scale-95 ${
          open ? "border-amber-500 text-amber-500" : "vault-text-secondary"
        }`}
      >
        <Palette className="h-4 w-4 text-amber-500" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/35 sm:hidden"
            onClick={() => {
              setOpen(false);
              setSubmenu(null);
            }}
          />

          <div className="animate-vault-modal vault-card fixed right-3 top-[calc(var(--vault-header-height)+0.5rem)] z-50 w-[min(19.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-2 shadow-2xl sm:absolute sm:right-0 sm:top-11">
            {/* Header */}
            <div className="vault-divider flex items-center justify-between border-b px-2.5 pb-2 pt-1">
              <div className="flex items-center gap-1.5">
                <Paintbrush className="h-3.5 w-3.5 text-amber-500" />
                <span className="vault-text-primary text-xs font-extrabold">
                  Vault Theme
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onChange(DEFAULT_THEME_STATE);
                    setSubmenu(null);
                  }}
                  title="Reset to Vault Amber default"
                  className="vault-text-muted inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold hover:text-amber-500"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setSubmenu(null);
                  }}
                  className="vault-text-muted rounded-lg p-1 hover:text-amber-500 sm:hidden"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Submenu View */}
            {submenu ? (
              <div className="mt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => setSubmenu(null)}
                  className="vault-text-muted flex w-full items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold hover:text-amber-500"
                >
                  ← Back to Theme Options
                </button>

                {submenu === "preset" && (
                  <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto px-1 pb-1">
                    {THEME_PRESETS.map((p) => {
                      const active = theme.preset === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyPreset(p.id)}
                          className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-bold transition ${
                            active
                              ? "border-amber-500 bg-amber-500/15 text-amber-500"
                              : "vault-inset vault-text-secondary hover:border-amber-500/50"
                          }`}
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-full border border-white/20"
                            style={{ backgroundColor: p.dot }}
                          />
                          <span className="truncate">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {submenu === "primary" && (
                  <div className="grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto px-1 pb-1">
                    {PRIMARY_COLORS.map((c) => {
                      const active = theme.primary === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            onChange({ ...theme, preset: "custom", primary: c.id })
                          }
                          className={`flex items-center gap-1.5 rounded-xl border px-2 py-1.5 text-[11px] font-bold transition ${
                            active
                              ? "border-amber-500 bg-amber-500/15 text-amber-500"
                              : "vault-inset vault-text-secondary hover:border-amber-500/50"
                          }`}
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-full border border-white/20"
                            style={{ backgroundColor: c.c500 }}
                          />
                          <span className="truncate">{c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {submenu === "neutral" && (
                  <div className="grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto px-1 pb-1">
                    {NEUTRAL_PALETTES.map((n) => {
                      const active = theme.neutral === n.id;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() =>
                            onChange({ ...theme, preset: "custom", neutral: n.id })
                          }
                          className={`flex items-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-bold transition ${
                            active
                              ? "border-amber-500 bg-amber-500/15 text-amber-500"
                              : "vault-inset vault-text-secondary hover:border-amber-500/50"
                          }`}
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-full border border-white/20"
                            style={{ backgroundColor: n.dot }}
                          />
                          <span className="truncate">{n.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {submenu === "font" && (
                  <div className="max-h-64 space-y-1 overflow-y-auto px-1 pb-1">
                    {FONT_OPTIONS.map((f) => {
                      const active = theme.font === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() =>
                            onChange({ ...theme, preset: "custom", font: f.id })
                          }
                          className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                            active
                              ? "border-amber-500 bg-amber-500/15 text-amber-500"
                              : "vault-inset vault-text-secondary hover:border-amber-500/50"
                          }`}
                        >
                          <span>{f.label}</span>
                          {active && <Check className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {submenu === "radius" && (
                  <div className="grid grid-cols-4 gap-1.5 px-1 pb-1">
                    {RADIUS_OPTIONS.map((r) => {
                      const active = theme.radius === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() =>
                            onChange({ ...theme, preset: "custom", radius: r.id })
                          }
                          className={`rounded-xl border px-2 py-2 font-mono text-[11px] font-bold transition ${
                            active
                              ? "border-amber-500 bg-amber-500/15 text-amber-500"
                              : "vault-inset vault-text-secondary hover:border-amber-500/50"
                          }`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Main Customizer Menu */
              <div className="mt-2 space-y-2">
                {/* Light / Dark / System Segmented Control */}
                <div className="vault-inset grid grid-cols-3 gap-1 rounded-xl p-1">
                  {(
                    [
                      { id: "light", label: "Light", icon: Sun },
                      { id: "dark", label: "Dark", icon: Moon },
                      { id: "system", label: "Auto", icon: Monitor },
                    ] as const
                  ).map((m) => {
                    const Icon = m.icon;
                    const active = theme.mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMode(m.id)}
                        className={`inline-flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition ${
                          active
                            ? "bg-amber-500 text-zinc-950 shadow-sm"
                            : "vault-text-muted hover:text-amber-500"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                {/* 5 Selector Rows */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setSubmenu("preset")}
                    className="vault-inset flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition hover:border-amber-500/50"
                  >
                    <span className="vault-text-secondary flex items-center gap-2 font-semibold">
                      <Paintbrush className="h-3.5 w-3.5 text-amber-500" />
                      Preset
                    </span>
                    <span className="vault-text-primary flex items-center gap-1.5 font-bold">
                      <span>{currentPreset?.label || "Custom"}</span>
                      <ChevronRight className="vault-text-muted h-3.5 w-3.5" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubmenu("primary")}
                    className="vault-inset flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition hover:border-amber-500/50"
                  >
                    <span className="vault-text-secondary flex items-center gap-2 font-semibold">
                      <Circle
                        className="h-3.5 w-3.5"
                        style={{
                          color: currentPrimary.c500,
                          fill: currentPrimary.c500,
                        }}
                      />
                      Accent Color
                    </span>
                    <span className="vault-text-primary flex items-center gap-1.5 font-bold">
                      <span>{currentPrimary.label}</span>
                      <ChevronRight className="vault-text-muted h-3.5 w-3.5" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubmenu("neutral")}
                    className="vault-inset flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition hover:border-amber-500/50"
                  >
                    <span className="vault-text-secondary flex items-center gap-2 font-semibold">
                      <Circle
                        className="h-3.5 w-3.5"
                        style={{
                          color: currentNeutral.dot,
                          fill: currentNeutral.dot,
                        }}
                      />
                      Surface
                    </span>
                    <span className="vault-text-primary flex items-center gap-1.5 font-bold">
                      <span>{currentNeutral.label}</span>
                      <ChevronRight className="vault-text-muted h-3.5 w-3.5" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubmenu("font")}
                    className="vault-inset flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition hover:border-amber-500/50"
                  >
                    <span className="vault-text-secondary flex items-center gap-2 font-semibold">
                      <Type className="h-3.5 w-3.5 text-amber-500" />
                      Font
                    </span>
                    <span className="vault-text-primary flex items-center gap-1.5 font-bold">
                      <span>{currentFont.label}</span>
                      <ChevronRight className="vault-text-muted h-3.5 w-3.5" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubmenu("radius")}
                    className="vault-inset flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition hover:border-amber-500/50"
                  >
                    <span className="vault-text-secondary flex items-center gap-2 font-semibold">
                      <Square className="h-3.5 w-3.5 text-amber-500" />
                      Radius
                    </span>
                    <span className="vault-text-primary flex items-center gap-1.5 font-mono font-bold">
                      <span>{theme.radius}</span>
                      <ChevronRight className="vault-text-muted h-3.5 w-3.5" />
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
