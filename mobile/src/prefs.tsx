import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { applyTheme, DEFAULT_THEME, type ThemePrefs } from "./theme";

const KEY = "sse_prefs";

interface PrefsCtx {
  theme: ThemePrefs;
  /** Bumps whenever the theme changes so screens can re-mount. */
  themeVersion: number;
  setTheme: (patch: Partial<ThemePrefs>) => void;
}
const Ctx = createContext<PrefsCtx>(null as unknown as PrefsCtx);
export const usePrefs = () => useContext(Ctx);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePrefs>(DEFAULT_THEME);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(KEY);
        if (raw) {
          const t = { ...DEFAULT_THEME, ...JSON.parse(raw) } as ThemePrefs;
          applyTheme(t);
          setThemeState(t);
        }
      } catch { /* use defaults */ }
      setReady(true);
    })();
  }, []);

  const setTheme = (patch: Partial<ThemePrefs>) => {
    const next = { ...theme, ...patch };
    applyTheme(next);
    setThemeState(next);
    setVersion((v) => v + 1);
    SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {});
  };

  if (!ready) return null;
  return <Ctx.Provider value={{ theme, themeVersion: version, setTheme }}>{children}</Ctx.Provider>;
}
