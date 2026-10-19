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

  return (
    <div
      className={`${targetAspect === "poster" ? "aspect-[2/3]" : "aspect-video"} w-full rounded overflow-hidden bg-surface relative border border-border ${className}`}
    >
      {src && failedSrc !== src ? (
        <>
          {/* Only this decorative layer crops; the primary artwork stays intact. */}
          <img
            src={src}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-25 pointer-events-none"
          />
          <img
            src={src}
            alt={title}
            draggable={false}
            onError={() => setFailedSrc(src)}
            className="absolute inset-0 w-full h-full object-contain"
          />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center text-muted-foreground" role="img" aria-label={`${title}: artwork unavailable`}>
          <Film size={20} className="text-muted-foreground/60 mb-1.5 shrink-0" />
          <span className="text-[10px] uppercase tracking-wider font-semibold line-clamp-2 text-foreground/80">
            {title}
          </span>
        </div>
      )}
    </div>
  );
}
