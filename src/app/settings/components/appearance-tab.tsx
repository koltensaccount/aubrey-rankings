"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  RotateCcw,
  Loader2,
  Check,
  AlertTriangle,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import {
  ACCENT_PRESETS,
  getContrastRatio,
  getRelativeLuminance,
  hexToRgb,
  isValidHexColor,
  normalizeHexColor,
  getAccessibleForeground,
} from "@/lib/theme";

export function AppearanceTab() {
  const {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    resetToDefaults,
    resolvedTheme,
    isSaving: isSavingTheme,
    saveStatus: themeSaveStatus,
    saveError: themeSaveError,
  } = useTheme();

  const [customHex, setCustomHex] = useState(accentColor);
  const [colorError, setColorError] = useState<string | null>(null);

  useEffect(() => {
    setCustomHex(accentColor);
  }, [accentColor]);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Section: Color Theme Mode */}
      <div className="p-6 rounded-card border border-border-card bg-card space-y-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl uppercase font-bold text-foreground">
              Theme Mode
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose between cinematic dark, editorial light, or automatic system sync.
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground/80 px-2.5 py-1 rounded-full border border-border bg-muted/40">
            Active: <strong className="text-foreground capitalize">{resolvedTheme}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Dark Option */}
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`p-4 rounded-button border text-left transition-all cursor-pointer flex flex-col justify-between h-36 ${
              theme === "dark"
                ? "border-primary ring-2 ring-primary/20 bg-muted/60"
                : "border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="h-9 w-9 rounded-lg bg-background border border-border flex items-center justify-center text-foreground shadow-sm">
                <Moon size={18} />
              </div>
              {theme === "dark" && (
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </div>
            <div>
              <span className="text-xs font-bold text-foreground block">
                Dark (Cinematic)
              </span>
              <span className="text-[11px] text-muted-foreground leading-relaxed block mt-0.5">
                Original cinema aesthetic with deep black and charcoal tones.
              </span>
            </div>
          </button>

          {/* Light Option */}
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`p-4 rounded-button border text-left transition-all cursor-pointer flex flex-col justify-between h-36 ${
              theme === "light"
                ? "border-primary ring-2 ring-primary/20 bg-muted/60"
                : "border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="h-9 w-9 rounded-lg bg-background border border-border flex items-center justify-center text-foreground shadow-sm">
                <Sun size={18} />
              </div>
              {theme === "light" && (
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </div>
            <div>
              <span className="text-xs font-bold text-foreground block">
                Light (Editorial)
              </span>
              <span className="text-[11px] text-muted-foreground leading-relaxed block mt-0.5">
                Warm off-white paper, soft white cards, and crisp dark typography.
              </span>
            </div>
          </button>

          {/* System Option */}
          <button
            type="button"
            onClick={() => setTheme("system")}
            className={`p-4 rounded-button border text-left transition-all cursor-pointer flex flex-col justify-between h-36 ${
              theme === "system"
                ? "border-primary ring-2 ring-primary/20 bg-muted/60"
                : "border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="h-9 w-9 rounded-lg bg-background border border-border flex items-center justify-center text-foreground shadow-sm">
                <Monitor size={18} />
              </div>
              {theme === "system" && (
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </div>
            <div>
              <span className="text-xs font-bold text-foreground block">
                System Preference
              </span>
              <span className="text-[11px] text-muted-foreground leading-relaxed block mt-0.5">
                Automatically syncs with your device operating system theme.
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Section: Accent Color */}
      <div className="p-6 rounded-card border border-border-card bg-card space-y-6 shadow-card">
        <div>
          <h3 className="font-display text-xl uppercase font-bold text-foreground">
            Accent Color
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Customize the interactive highlight color used across buttons, sliders, badges, and your public profile.
          </p>
        </div>

        {/* Presets Grid */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Approved Presets
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ACCENT_PRESETS.map((preset) => {
              const isSelected = accentColor.toUpperCase() === preset.hex.toUpperCase();
              const checkFg = getAccessibleForeground(preset.hex);

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setAccentColor(preset.hex);
                    setCustomHex(preset.hex);
                    setColorError(null);
                  }}
                  className={`p-3 rounded-button border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? "border-primary bg-muted/60 ring-2 ring-primary/20"
                      : "border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40"
                  }`}
                >
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-black/15 transition-transform"
                    style={{ backgroundColor: preset.hex }}
                  >
                    {isSelected && (
                      <Check size={14} strokeWidth={3} style={{ color: checkFg }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-foreground block truncate">
                      {preset.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono block">
                      {preset.hex}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Accent Picker */}
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Custom Hex Accent
            </span>
            {colorError && (
              <span className="text-[11px] text-red-500 font-medium">
                {colorError}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="relative h-10 w-10 rounded-input overflow-hidden border border-border-input shadow-sm shrink-0">
                <input
                  type="color"
                  value={isValidHexColor(customHex) ? normalizeHexColor(customHex) : "#89D5D5"}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setCustomHex(val);
                    setAccentColor(val);
                    setColorError(null);
                  }}
                  className="absolute -inset-2 h-14 w-14 cursor-pointer opacity-0"
                  title="Choose custom color"
                />
                <div
                  className="w-full h-full"
                  style={{
                    backgroundColor: isValidHexColor(customHex)
                      ? normalizeHexColor(customHex)
                      : accentColor,
                  }}
                />
              </div>

              <div className="relative">
                <input
                  type="text"
                  maxLength={7}
                  value={customHex}
                  placeholder="#89D5D5"
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomHex(val);
                    if (isValidHexColor(val)) {
                      setAccentColor(val);
                      setColorError(null);
                    }
                  }}
                  onBlur={() => {
                    if (isValidHexColor(customHex)) {
                      const norm = normalizeHexColor(customHex);
                      setCustomHex(norm);
                      setAccentColor(norm);
                      setColorError(null);
                    } else {
                      setColorError("Invalid hex format. Use #RGB or #RRGGBB.");
                      setCustomHex(accentColor);
                    }
                  }}
                  className="w-28 h-10 px-3 text-xs font-mono font-semibold rounded-input bg-surface border border-border-input text-foreground uppercase focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* WCAG AA Contrast Evaluation Readout */}
            {(() => {
              const [r, g, b] = hexToRgb(accentColor);
              const lum = getRelativeLuminance(r, g, b);
              const fg = getAccessibleForeground(accentColor);
              const [fr, fgCol, fb] = hexToRgb(fg);
              const fgLum = getRelativeLuminance(fr, fgCol, fb);
              const contrast = getContrastRatio(lum, fgLum);
              const passesAA = contrast >= 4.5;

              return (
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className="px-2.5 py-1 rounded-badge text-xs font-semibold shadow-sm"
                    style={{
                      backgroundColor: accentColor,
                      color: fg,
                    }}
                  >
                    Sample Badge
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    WCAG AA Contrast:{" "}
                    <strong className="text-foreground font-mono">
                      {contrast.toFixed(1)}:1
                    </strong>{" "}
                    {passesAA ? (
                      <span className="text-emerald-500 font-semibold">(Pass)</span>
                    ) : (
                      <span className="text-amber-500 font-semibold">(Large text only)</span>
                    )}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Live Interactive Preview Card */}
        <div className="p-5 rounded-card border border-border-card bg-surface space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles size={14} className="text-primary" />
              <span>Live Appearance Preview</span>
            </span>
            <span className="text-[11px] text-muted-foreground">
              Updates everywhere immediately
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded-button text-xs font-bold bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm transition-all cursor-pointer"
            >
              Primary Action Button
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-button text-xs font-semibold bg-surface-elevated hover:bg-muted text-foreground border border-border transition-all cursor-pointer"
            >
              Secondary Action
            </button>
            <div className="px-3 py-1.5 rounded-badge border border-primary/30 bg-primary/10 text-primary text-xs font-semibold flex items-center gap-1">
              <span>★ 9.40</span>
              <span className="opacity-70 font-normal">/ 10</span>
            </div>
          </div>
        </div>

        {/* Reset & Status Footer */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={() => {
              resetToDefaults();
              setCustomHex("#89D5D5");
              setColorError(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Reset to Aubrey Default</span>
          </button>

          <div className="flex items-center gap-2 text-muted-foreground">
            {themeSaveStatus === "saving" ? (
              <span className="flex items-center gap-1 text-[11px]">
                <Loader2 size={12} className="animate-spin text-primary" />
                <span>Saving to profile...</span>
              </span>
            ) : themeSaveStatus === "error" ? (
              <span className="flex items-center gap-1 text-[11px] text-destructive font-medium" title={themeSaveError || ""}>
                <AlertTriangle size={12} />
                <span>Failed to sync with server</span>
              </span>
            ) : themeSaveStatus === "saved" ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                <Check size={12} />
                <span>Appearance saved</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
