import React, { createContext, useContext, useEffect, useState } from "react";
import { Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";
import { applyTheme, DEFAULT_THEME, type ThemePrefs } from "./theme";

const KEY = "sse_prefs_v2";
const BLUR_KEY = "sse_privacy_blur";

interface PrefsCtx {
  theme: ThemePrefs;
  /** Bumps whenever the theme changes so screens re-mount with fresh colours & radii. */
  themeVersion: number;
  setTheme: (patch: Partial<ThemePrefs>) => void;
  resetTheme: () => void;
  privacyBlur: boolean;
  setPrivacyBlur: (val: boolean) => void;
}

const Ctx = createContext<PrefsCtx>(null as unknown as PrefsCtx);
export const usePrefs = () => useContext(Ctx);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePrefs>(DEFAULT_THEME);
  const [privacyBlur, setPrivacyBlurState] = useState(false);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw =
          (await SecureStore.getItemAsync(KEY)) ||
          (await SecureStore.getItemAsync("sse_prefs"));
        if (raw) {
          const t = { ...DEFAULT_THEME, ...JSON.parse(raw) } as ThemePrefs;
          applyTheme(t);
          setThemeState(t);
        } else {
          applyTheme(DEFAULT_THEME);
        }
        const blurRaw = await SecureStore.getItemAsync(BLUR_KEY);
        if (blurRaw === "1") setPrivacyBlurState(true);
      } catch {
        applyTheme(DEFAULT_THEME);
      }
      setReady(true);
    })();
  }, []);

  // Re-apply when Android system Dark/Light mode changes while in "Auto" mode
  useEffect(() => {
    const sub = Appearance.addChangeListener(() => {
      if (theme.mode === "system") {
        applyTheme(theme);
        setVersion((v) => v + 1);
      }
    });
    return () => sub.remove();
  }, [theme]);

  const setTheme = (patch: Partial<ThemePrefs>) => {
    const next = { ...theme, ...patch };
    applyTheme(next);
    setThemeState(next);
    setVersion((v) => v + 1);
    SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {});
  };

  const resetTheme = () => {
    applyTheme(DEFAULT_THEME);
    setThemeState(DEFAULT_THEME);
    setVersion((v) => v + 1);
    SecureStore.setItemAsync(KEY, JSON.stringify(DEFAULT_THEME)).catch(() => {});
  };

  const setPrivacyBlur = (val: boolean) => {
    setPrivacyBlurState(val);
    SecureStore.setItemAsync(BLUR_KEY, val ? "1" : "0").catch(() => {});
  };

  if (!ready) return null;
  return (
    <Ctx.Provider
      value={{
        theme,
        themeVersion: version,
        setTheme,
        resetTheme,
        privacyBlur,
        setPrivacyBlur,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
