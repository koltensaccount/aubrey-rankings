"use client";

import React from "react";
import { Star, StarHalf } from "lucide-react";

export interface StarRatingProps {
  /**
   * Score value.
   * If scale is 10 (Aubrey default internal scale), 10 = 5 stars, 9 = 4.5 stars, 6 = 3 stars, etc.
   * If scale is 5, 5 = 5 stars, 4.5 = 4.5 stars.
   */
  score: number | null | undefined;
  scale?: number; // 10 or 5
  size?: "xs" | "sm" | "default" | "lg";
  showNumeric?: boolean;
  numericFormat?: "stars" | "fraction"; // "stars" -> "4.5 ★", "fraction" -> "4.5 / 5"
  className?: string;
}

const iconSizes = {
  xs: 11,
  sm: 13,
  default: 15,
  lg: 18,
};

const textSizes = {
  xs: "text-[10px]",
  sm: "text-xs",
  default: "text-xs sm:text-sm",
  lg: "text-sm sm:text-base",
};

/**
 * Renders an accessible, 5-star rating with half-star support according to Aubrey's Phase 14D specifications:
 * 5/5 = 10/10 internally
 * 4.5/5 = 9/10 internally
 * 3/5 = 6/10 internally
 */
export function StarRating({
  score,
  scale = 10,
  size = "sm",
  showNumeric = true,
  numericFormat = "fraction",
  className = "",
}: StarRatingProps) {
  if (score === null || score === undefined || !Number.isFinite(score) || score <= 0) {
    return null;
  }

  // Normalize to 5-star scale (0.5 to 5.0 in steps of 0.5)
  const effectiveScale = scale > 0 ? scale : 10;
  const rawStars = (score / effectiveScale) * 5;
  const starsClamped = Math.max(0, Math.min(5, rawStars));
  // Round to nearest half-star
  const stars = Math.round(starsClamped * 2) / 2;

  const iconSize = iconSizes[size] || 13;
  const textClass = textSizes[size] || "text-xs";

  const fullStars = Math.floor(stars);
  const hasHalfStar = stars % 1 !== 0;

  return (
    <div
      className={`inline-flex items-center gap-1.5 select-none ${className}`}
      aria-label={`Rating: ${stars.toFixed(1)} out of 5 stars`}
    >
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((index) => {
          if (index <= fullStars) {
            return (
              <Star
                key={index}
                size={iconSize}
                className="fill-primary text-primary shrink-0"
              />
            );
          }
          if (index === fullStars + 1 && hasHalfStar) {
            return (
              <StarHalf
                key={index}
                size={iconSize}
                className="fill-primary text-primary shrink-0"
              />
            );
          }
          return (
            <Star
              key={index}
              size={iconSize}
              className="text-muted-foreground/30 shrink-0"
            />
          );
        })}
      </div>

      {showNumeric && (
        <span className={`font-bold font-mono text-primary ${textClass}`}>
          {numericFormat === "stars" ? `${stars.toFixed(1)} ★` : `${stars.toFixed(1)} / 5`}
        </span>
      )}
    </div>
  );
}
