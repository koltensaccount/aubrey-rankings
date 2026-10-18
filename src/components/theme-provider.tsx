"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  ThemeMode,
  DEFAULT_THEME,
  DEFAULT_ACCENT,
  getAccentTokens,
  isValidHexColor,
  normalizeHexColor,
  isValidThemeMode,
} from "@/lib/theme";

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  accentColor: string;
  setTheme: (theme: ThemeMode) => void;
  setAccentColor: (hex: string) => void;
  resetToDefaults: () => void;
  isSaving: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY_THEME = "ar_theme";
const STORAGE_KEY_ACCENT = "ar_accent";

function applyThemeToDOM(resolvedTheme: "light" | "dark", accent: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Toggle class
  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
  root.setAttribute("data-theme", resolvedTheme);

  // Apply accent tokens
  const tokens = getAccentTokens(accent);
  root.style.setProperty("--primary", tokens.primary);
  root.style.setProperty("--primary-foreground", tokens.primaryForeground);
  root.style.setProperty("--primary-hover", tokens.primaryHover);
  root.style.setProperty("--ring", tokens.ring);
  root.style.setProperty("--feature-accent", tokens.primary);
}

export function ThemeProvider({
  children,
  initialUserTheme,
  initialUserAccent,
}: {
  children: React.ReactNode;
  initialUserTheme?: ThemeMode;
  initialUserAccent?: string;
}) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY_THEME);
      if (isValidThemeMode(stored)) return stored;
    }
    return initialUserTheme || DEFAULT_THEME;
  });

  const [accentColor, setAccentColorState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY_ACCENT);
      if (stored && isValidHexColor(stored)) return normalizeHexColor(stored);
    }
    return initialUserAccent || DEFAULT_ACCENT;
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");
  const [isSaving, setIsSaving] = useState(false);

  // Calculate resolved theme (light or dark)
  const computeResolved = useCallback((mode: ThemeMode): "light" | "dark" => {
    if (mode === "system") {
      if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      return "dark";
    }
    return mode;
  }, []);

  // Update DOM and state when theme or accent changes
  useEffect(() => {
    const nextResolved = computeResolved(theme);
    setResolvedTheme(nextResolved);
    applyThemeToDOM(nextResolved, accentColor);
  }, [theme, accentColor, computeResolved]);

  // System theme media query listener
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const nextResolved = e.matches ? "dark" : "light";
      setResolvedTheme(nextResolved);
      applyThemeToDOM(nextResolved, accentColor);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme, accentColor]);

  // Persist preference to server if authenticated
  const persistToServer = useCallback(
    async (newTheme?: ThemeMode, newAccent?: string) => {
      try {
        setIsSaving(true);
        const body: Record<string, string> = {};
        if (newTheme) body.preferredTheme = newTheme;
        if (newAccent) body.accentColor = newAccent;

        await fetch("/api/user/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (err) {
        // Silently fail network error; local state & localStorage remain preserved
        console.warn("[Theme] Could not sync appearance with server:", err);
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const setTheme = useCallback(
    (newTheme: ThemeMode) => {
      if (!isValidThemeMode(newTheme)) return;
      setThemeState(newTheme);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_THEME, newTheme);
      }
      persistToServer(newTheme, undefined);
    },
    [persistToServer]
  );

  const setAccentColor = useCallback(
    (newAccent: string) => {
      if (!isValidHexColor(newAccent)) return;
      const normalized = normalizeHexColor(newAccent);
      setAccentColorState(normalized);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_ACCENT, normalized);
      }
      persistToServer(undefined, normalized);
    },
    [persistToServer]
  );

  const resetToDefaults = useCallback(() => {
    setThemeState(DEFAULT_THEME);
    setAccentColorState(DEFAULT_ACCENT);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_THEME, DEFAULT_THEME);
      localStorage.setItem(STORAGE_KEY_ACCENT, DEFAULT_ACCENT);
    }
    persistToServer(DEFAULT_THEME, DEFAULT_ACCENT);
  }, [persistToServer]);

  // Initial load: sync from user profile if signed in
  useEffect(() => {
    let mounted = true;
    async function loadUserProfile() {
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && data?.user) {
          if (data.user.preferredTheme && isValidThemeMode(data.user.preferredTheme)) {
            setThemeState(data.user.preferredTheme);
            localStorage.setItem(STORAGE_KEY_THEME, data.user.preferredTheme);
          }
          if (data.user.accentColor && isValidHexColor(data.user.accentColor)) {
            const norm = normalizeHexColor(data.user.accentColor);
            setAccentColorState(norm);
            localStorage.setItem(STORAGE_KEY_ACCENT, norm);
          }
        }
      } catch {
        // Logged-out or offline; localStorage values are already used
      }
    }
    loadUserProfile();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        accentColor,
        setTheme,
        setAccentColor,
        resetToDefaults,
        isSaving,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
