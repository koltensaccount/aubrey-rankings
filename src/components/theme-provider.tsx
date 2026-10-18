"use client";

import { useSession } from "@/lib/auth-client";
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

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  accentColor: string;
  setTheme: (theme: ThemeMode) => void;
  setAccentColor: (hex: string) => void;
  resetToDefaults: () => void;
  isSaving: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
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
  const tokens = getAccentTokens(accent, resolvedTheme);
  root.style.setProperty("--primary", tokens.primary);
  root.style.setProperty("--primary-foreground", tokens.primaryForeground);
  root.style.setProperty("--primary-hover", tokens.primaryHover);
  root.style.setProperty("--primary-text", tokens.primaryText);
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
  const {data: session} = useSession();
  const accountKey = session?.user.id ?? "guest";
  const themeKey = `${STORAGE_KEY_THEME}:${accountKey}`;
  const accentKey = `${STORAGE_KEY_ACCENT}:${accountKey}`;
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`${STORAGE_KEY_THEME}:guest`);
      if (isValidThemeMode(stored)) return stored;
    }
    return initialUserTheme || DEFAULT_THEME;
  });

  const [accentColor, setAccentColorState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`${STORAGE_KEY_ACCENT}:guest`);
      if (stored && isValidHexColor(stored)) return normalizeHexColor(stored);
    }
    return initialUserAccent || DEFAULT_ACCENT;
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

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
        setSaveStatus("saving");
        setSaveError(null);
        const body: Record<string, string> = {};
        if (newTheme) body.preferredTheme = newTheme;
        if (newAccent) body.accentColor = newAccent;

        const res = await fetch("/api/user/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          if (res.status === 401) {
            // Unauthenticated: localStorage is the source of truth, treat as saved
            setSaveStatus("saved");
            return;
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with ${res.status}`);
        }

        setSaveStatus("saved");
      } catch (err: any) {
        console.warn("[Theme] Could not sync appearance with server:", err);
        setSaveStatus("error");
        setSaveError(err?.message || "Failed to save appearance settings");
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
        localStorage.setItem(themeKey, newTheme);
      }
      persistToServer(newTheme, undefined);
    },
    [persistToServer, themeKey, accentKey]
  );

  const setAccentColor = useCallback(
    (newAccent: string) => {
      if (!isValidHexColor(newAccent)) return;
      const normalized = normalizeHexColor(newAccent);
      setAccentColorState(normalized);
      if (typeof window !== "undefined") {
        localStorage.setItem(accentKey, normalized);
      }
      persistToServer(undefined, normalized);
    },
    [persistToServer, themeKey, accentKey]
  );

  const resetToDefaults = useCallback(() => {
    setThemeState(DEFAULT_THEME);
    setAccentColorState(DEFAULT_ACCENT);
    if (typeof window !== "undefined") {
      localStorage.setItem(themeKey, DEFAULT_THEME);
      localStorage.setItem(accentKey, DEFAULT_ACCENT);
    }
    persistToServer(DEFAULT_THEME, DEFAULT_ACCENT);
  }, [persistToServer, themeKey, accentKey]);

  // Initial load: sync from user profile if signed in
  useEffect(() => {
    let mounted = true;
    const storedTheme = localStorage.getItem(themeKey);
    const storedAccent = localStorage.getItem(accentKey);
    setThemeState(isValidThemeMode(storedTheme) ? storedTheme : DEFAULT_THEME);
    setAccentColorState(storedAccent && isValidHexColor(storedAccent) ? normalizeHexColor(storedAccent) : DEFAULT_ACCENT);
    async function loadUserProfile() {
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && data?.user) {
          if (data.user.preferredTheme && isValidThemeMode(data.user.preferredTheme)) {
            setThemeState(data.user.preferredTheme);
            localStorage.setItem(themeKey, data.user.preferredTheme);
          }
          if (data.user.accentColor && isValidHexColor(data.user.accentColor)) {
            const norm = normalizeHexColor(data.user.accentColor);
            setAccentColorState(norm);
            localStorage.setItem(accentKey, norm);
          }
        }
      } catch {
        // Logged-out or offline; localStorage values are already used
      }
    }
    if (session?.user.id) loadUserProfile();
    return () => {
      mounted = false;
    };
  }, [session?.user.id, themeKey, accentKey]);

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
        saveStatus,
        saveError,
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
