"use client";

import { type CSSProperties } from "react";
import { TYPOGRAPHY_PRESETS } from "./typography-presets";
import "./typography-fonts.css";
import "./typography-lab.css";

/**
 * Locked-in prototype typography: "Screen title" preset (AR Barlow Condensed + AR Inter).
 * The drawer and floating dock have been removed from the user-facing UI as required.
 */
export function TypographyLab({ children }: { children: React.ReactNode }) {
  const active =
    TYPOGRAPHY_PRESETS.find((p) => p.id === "screen-title") ??
    TYPOGRAPHY_PRESETS[0];

  return (
    <div
      className="ar-typeScope"
      data-type-preset="screen-title"
      style={active.tokens as CSSProperties}
    >
      {children}
    </div>
  );
}
