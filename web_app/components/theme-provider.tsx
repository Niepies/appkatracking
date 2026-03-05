"use client";

/**
 * ThemeProvider – zarządza trybem ciemnym/jasnym.
 * Zapisuje preferencję w localStorage i aplikuje klasę `dark` na <html>.
 */
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle_theme: () => void;
  set_theme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggle_theme: () => {},
  set_theme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, set_theme_state] = useState<Theme>("light");

  // Wczytaj preferencję przy starcie
  useEffect(() => {
    const stored = localStorage.getItem("subscontrol-theme") as Theme | null;
    if (stored === "dark" || stored === "light") {
      set_theme_state(stored);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      set_theme_state("dark");
    }
  }, []);

  // Aplikuj klasę na <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("subscontrol-theme", theme);
  }, [theme]);

  const set_theme = (t: Theme) => set_theme_state(t);
  const toggle_theme = () => set_theme_state((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle_theme, set_theme }}>
      {children}
    </ThemeContext.Provider>
  );
}
