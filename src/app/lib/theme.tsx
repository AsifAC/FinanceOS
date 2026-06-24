import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type FinanceOSTheme = "dark" | "light";

const THEME_STORAGE_KEY = "financeos:theme";

type ThemeContextValue = {
  theme: FinanceOSTheme;
  setTheme(theme: FinanceOSTheme): void;
  toggleTheme(): void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getStoredTheme(): FinanceOSTheme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
}

function applyTheme(theme: FinanceOSTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("financeos-theme-light", theme === "light");
  document.documentElement.classList.toggle("financeos-theme-dark", theme === "dark");
}

export function FinanceOSThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<FinanceOSTheme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme: setThemeState,
    toggleTheme: () => setThemeState((current) => current === "dark" ? "light" : "dark"),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useFinanceOSTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useFinanceOSTheme must be used inside FinanceOSThemeProvider");
  }
  return context;
}

