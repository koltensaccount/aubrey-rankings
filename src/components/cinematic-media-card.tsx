"use client";

import React, { useState } from "react";
import { resolvePosterUrl, resolveStillUrl } from "@/lib/artwork";
import { Film } from "lucide-react";

interface CinematicMediaCardProps {
  stillPath?: string | null;
  posterPath?: string | null;
  title: string;
  className?: string;
  aspect?: "video" | "poster" | "auto";
}

export function CinematicMediaCard({
  stillPath,
  posterPath,
  title,
  className = "",
  aspect = "video",
}: CinematicMediaCardProps) {
  const [imgError, setImgError] = useState(false);

  const hasStill = Boolean(stillPath && stillPath.trim() !== "");
  const hasPoster = Boolean(posterPath && posterPath.trim() !== "");

  // If aspect is auto:
  // If still exists, video aspect. If only poster exists, poster aspect.
  const targetAspect =
    aspect === "auto" ? (hasStill ? "video" : "poster") : aspect;

  // Case 1: Neither still nor poster exists, or image errored
  if ((!hasStill && !hasPoster) || imgError) {
    return (
      <div
        className={`${
          targetAspect === "poster" ? "aspect-[2/3]" : "aspect-video"
        } w-full rounded overflow-hidden bg-[#141a17] border border-[#28342d] flex flex-col items-center justify-center p-3 text-center text-[#6c7d73] ${className}`}
      >
        <Film size={20} className="text-[#3b4c40] mb-1.5 shrink-0" />
        <span className="text-[10px] uppercase tracking-wider font-semibold line-clamp-2 text-[#8fa095]">
          {title}
        </span>
      </div>
    );
  }

  // Case 2: We have a true 16:9 still and targetAspect is "video"
  if (hasStill && targetAspect === "video") {
    const src = resolveStillUrl(stillPath, "w500");
    return (
      <div
        className={`aspect-video w-full rounded overflow-hidden bg-black relative ${className}`}
      >
        <img
          src={src}
          alt={title}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Case 3: We have a poster and targetAspect is "poster" (2:3)
  if (hasPoster && targetAspect === "poster") {
    const src = resolvePosterUrl(posterPath, "w500");
    return (
      <div
        className={`aspect-[2/3] w-full rounded overflow-hidden bg-black relative border border-[#28342d] ${className}`}
      >
        <img
          src={src}
          alt={title}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Case 4: We only have a portrait poster (e.g. Movie in an episode-style 16:9 container).
  // DO NOT stretch or clumsily crop! Render Kodi/Plex style blurred backdrop + centered 2:3 poster.
  if (hasPoster && targetAspect === "video") {
    const posterSrc = resolvePosterUrl(posterPath, "w500");
    return (
      <div
        className={`aspect-video w-full rounded overflow-hidden bg-[#0d1210] relative border border-[#28342d] ${className}`}
      >
        {/* Ambient blurred backdrop fill */}
        <img
          src={posterSrc}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover scale-150 filter blur-xl opacity-35"
        />
        <div className="absolute inset-0 bg-black/40" />

        {/* Centered crisp native 2:3 poster */}
        <div className="absolute inset-0 flex items-center justify-center p-1.5">
          <img
            src={posterSrc}
            alt={title}
            onError={() => setImgError(true)}
            className="h-full w-auto max-w-full aspect-[2/3] object-cover rounded shadow-lg border border-[#303b34]/80"
          />
        </div>
      </div>
    );
  }

  // Fallback if stillPath is used in poster mode
  const fallbackSrc = resolveStillUrl(stillPath || posterPath, "w500");
  return (
    <div
      className={`${
        targetAspect === "poster" ? "aspect-[2/3]" : "aspect-video"
      } w-full rounded overflow-hidden bg-black relative ${className}`}
    >
      <img
        src={fallbackSrc}
        alt={title}
        onError={() => setImgError(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
