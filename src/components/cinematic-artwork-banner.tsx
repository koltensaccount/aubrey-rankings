"use client";

import React from "react";
import { resolveArtworkUrl, resolvePosterUrl } from "@/lib/artwork";

interface CinematicArtworkBannerProps {
  backdropPath?: string | null;
  posterPath?: string | null;
  clearLogoUrl?: string | null;
  title: string;
  className?: string;
  children?: React.ReactNode;
}

export function CinematicArtworkBanner({
  backdropPath,
  posterPath,
  clearLogoUrl,
  title,
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
    <div className={`relative overflow-hidden bg-[#101513] ${className}`}>
      {/* BACKGROUND LAYER HIERARCHY */}
      {resolvedBackdrop ? (
        /* Tier 1: True landscape backdrop with cinematic vignette */
        <div className="absolute inset-0 z-0">
          <img
            src={resolvedBackdrop}
            alt={title}
            className="w-full h-full object-cover object-top opacity-35 filter contrast-125 saturate-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111514] via-[#111514]/75 to-[#111514]/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#111514] via-[#111514]/60 to-transparent" />
        </div>
      ) : resolvedPoster ? (
        /* Tier 2: Only portrait poster exists (e.g. Leprechaun movie franchise).
           Blurred ambient lighting wash + crisp uncropped native 2:3 poster */
        <div className="absolute inset-0 z-0 overflow-hidden">
          {/* Ambient blurred backdrop wash */}
          <img
            src={resolvedPoster}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover scale-125 filter blur-3xl opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111514] via-[#111514]/85 to-[#111514]/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#111514] via-[#111514]/70 to-[#111514]/40" />

          {/* Crisp aspect-preserved foreground poster silhouette on the right */}
          <div className="absolute right-6 sm:right-16 top-1/2 -translate-y-1/2 hidden md:block opacity-30 pointer-events-none">
            <div className="w-48 sm:w-60 aspect-[2/3] rounded-lg overflow-hidden border border-[#303b34] shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
              <img
                src={resolvedPoster}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Tier 3: Neutral dark cinematic editorial background with subtle film icon */
        <div className="absolute inset-0 z-0">
          <div className="w-full h-full bg-gradient-to-br from-[#131b17] via-[#101513] to-[#0c100e]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#89d5d5]/5 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111514] via-transparent to-transparent" />
        </div>
      )}

      {/* CONTENT LAYER */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
