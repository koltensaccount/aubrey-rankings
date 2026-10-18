"use client";

import React from "react";
import { resolveArtworkUrl, resolvePosterUrl } from "@/lib/artwork";

export type CinematicArtworkVariant = "hero" | "compact" | "dialog" | "card";

interface CinematicArtworkBannerProps {
  backdropPath?: string | null;
  posterPath?: string | null;
  clearLogoUrl?: string | null;
  title: string;
  variant?: CinematicArtworkVariant;
  className?: string;
  children?: React.ReactNode;
}

export function CinematicArtworkBanner({
  backdropPath,
  posterPath,
  clearLogoUrl,
  title,
  variant = "hero",
  className = "",
  children,
}: CinematicArtworkBannerProps) {
  const hasBackdrop = Boolean(backdropPath && backdropPath.trim() !== "");
  const hasPoster = Boolean(posterPath && posterPath.trim() !== "");

  const resolvedBackdrop = hasBackdrop
    ? resolveArtworkUrl(backdropPath, "original")
    : null;
  const resolvedPoster = hasPoster
    ? resolvePosterUrl(posterPath, "w780")
    : null;

  return (
    <div className={`relative overflow-hidden bg-background text-foreground ${className}`}>
      {/* =========================================================================
          BACKGROUND ARTWORK LAYER (Preserves vivid artwork without excessive darkening)
          ========================================================================= */}
      {resolvedBackdrop ? (
        /* Tier 1: True landscape backdrop with localized editorial vignette */
        <div className="absolute inset-0 z-0">
          <img
            src={resolvedBackdrop}
            alt={title}
            className="w-full h-full object-cover object-top opacity-85 dark:opacity-80 filter saturate-[0.95] transition-opacity duration-500"
          />
          {/* Localized text-contrast scrim on the left (leaves right 40-50% clear) */}
          <div className="absolute inset-y-0 left-0 w-full md:w-3/5 bg-gradient-to-r from-background via-background/70 to-transparent pointer-events-none" />

          {/* Smooth bottom blend into page background */}
          <div className="absolute inset-x-0 bottom-0 h-28 sm:h-36 bg-gradient-to-t from-background via-background/60 to-transparent pointer-events-none" />

          {/* Subtle top shade for navigation bar legibility */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background/50 to-transparent pointer-events-none" />
        </div>
      ) : resolvedPoster ? (
        /* Tier 2: Only portrait poster exists.
           Soft ambient wash + crisp uncropped native 2:3 poster silhouette on the right */
        <div className="absolute inset-0 z-0 overflow-hidden">
          {/* Ambient blurred backdrop wash */}
          <img
            src={resolvedPoster}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover scale-125 filter blur-3xl opacity-35 dark:opacity-30"
          />
          {/* Gradient blend */}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-background/30 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent pointer-events-none" />

          {/* Crisp aspect-preserved foreground poster on the right */}
          <div className="absolute right-6 sm:right-16 top-1/2 -translate-y-1/2 hidden md:block pointer-events-none">
            <div className="w-44 sm:w-56 aspect-[2/3] rounded-xl overflow-hidden border border-border shadow-2xl">
              <img
                src={resolvedPoster}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Tier 3: Editorial ambient gradient when no artwork is provided */
        <div className="absolute inset-0 z-0">
          <div className="w-full h-full bg-gradient-to-br from-surface via-card to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </div>
      )}

      {/* CONTENT LAYER */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
