"use client";

import React, { useState, useEffect } from "react";
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
  aspect = "auto",
}: CinematicMediaCardProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasStill = Boolean(stillPath?.trim());
  const hasPoster = Boolean(posterPath?.trim());
  const targetAspect = aspect === "auto" ? (hasStill ? "video" : "poster") : aspect;
  const useStill = hasStill && (targetAspect === "video" || !hasPoster);
  const src = useStill
    ? resolveStillUrl(stillPath, "w500")
    : hasPoster ? resolvePosterUrl(posterPath, "w500") : null;

  const placeholderUrl =
    targetAspect === "poster"
      ? "/placeholders/poster-placeholder.svg"
      : "/placeholders/backdrop-placeholder.svg";

  useEffect(() => {
    setFailedSrc(null);
  }, [src]);

  const handleImageError = () => {
    if (src) setFailedSrc(src);
  };

  const handleImgRef = (el: HTMLImageElement | null) => {
    // Detect images that completed with naturalWidth 0 (e.g. 404 before hydration)
    if (el && el.complete && el.naturalWidth === 0 && src) {
      setFailedSrc(src);
    }
  };

  return (
    <div
      className={`${targetAspect === "poster" ? "aspect-[2/3]" : "aspect-video"} w-full rounded overflow-hidden bg-surface relative border border-border ${className}`}
    >
      {src && failedSrc !== src ? (
        <>
          {/* Decorative blur backdrop */}
          <img
            src={src}
            alt=""
            aria-hidden="true"
            draggable={false}
            onError={handleImageError}
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-25 pointer-events-none"
          />
          {/* Primary artwork */}
          <img
            ref={handleImgRef}
            src={src}
            alt={title}
            draggable={false}
            onError={handleImageError}
            className="absolute inset-0 w-full h-full object-contain"
          />
        </>
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center text-muted-foreground select-none overflow-hidden"
          role="img"
          aria-label={`${title}: artwork unavailable`}
        >
          <img
            src={placeholderUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-40"
          />
          <div className="relative z-10 flex flex-col items-center justify-center p-2 text-center">
            <Film size={20} className="text-primary/70 mb-1.5 shrink-0" />
            <span className="text-[10px] uppercase tracking-wider font-semibold line-clamp-2 text-foreground/90">
              {title}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
