"use client";

import React, { useRef, useState, useCallback } from "react";

interface CinematicSliderProps {
  id?: string;
  name?: string;
  value: number | null; // null = genuine unrated state
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function CinematicSlider({
  id,
  name,
  value,
  onChange,
  min = 1,
  max = 10,
  step = 0.5,
  disabled = false,
  className = "",
  ariaLabel,
}: CinematicSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const isRated = typeof value === "number" && Number.isFinite(value);
  const range = Math.max(0.001, max - min);

  // Compute percentage (0 to 100)
  const percent = isRated
    ? Math.max(0, Math.min(100, ((value - min) / range) * 100))
    : 0;

  const hoverPercent =
    hoverValue !== null
      ? Math.max(0, Math.min(100, ((hoverValue - min) / range) * 100))
      : null;

  // Calculate stepped value from clientX
  const getValueFromPointer = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return min;
      const rect = trackRef.current.getBoundingClientRect();
      const rawRatio = (clientX - rect.left) / rect.width;
      const clampedRatio = Math.max(0, Math.min(1, rawRatio));
      const rawVal = min + clampedRatio * range;
      const stepped = Math.round(rawVal / step) * step;
      // Clamp to min and max and round to 2 decimals
      const clamped = Math.max(min, Math.min(max, Number(stepped.toFixed(2))));
      return clamped;
    },
    [min, max, step, range]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    trackRef.current?.setPointerCapture(e.pointerId);
    setIsDragging(true);
    const newVal = getValueFromPointer(e.clientX);
    onChange(newVal);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (isDragging) {
      const newVal = getValueFromPointer(e.clientX);
      onChange(newVal);
    } else {
      const val = getValueFromPointer(e.clientX);
      setHoverValue(val);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        trackRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
      setIsDragging(false);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        trackRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
      setIsDragging(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!isRated) {
        onChange(min);
      } else {
        onChange(Math.min(max, Number((value + step).toFixed(2))));
      }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      if (!isRated) {
        onChange(min);
      } else {
        onChange(Math.max(min, Number((value - step).toFixed(2))));
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(min);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(max);
    } else if (e.key === "Delete" || e.key === "Backspace" || e.key === "Escape") {
      e.preventDefault();
      onChange(null); // Genuine unset
    }
  };

  return (
    <div className={`relative flex items-center select-none py-2 ${className}`}>
      {/* Interactive slider track container */}
      <div
        ref={trackRef}
        id={id}
        tabIndex={disabled ? -1 : 0}
        role="slider"
        aria-label={ariaLabel || name || "Rating score slider"}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={isRated ? value : undefined}
        aria-valuetext={isRated ? `${value} out of ${max}` : "Not rated"}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={() => setHoverValue(null)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          setHoverValue(null);
        }}
        className={`group/track relative w-full h-2.5 sm:h-3 rounded-full cursor-pointer touch-none transition-all ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-muted border border-border"
            : "bg-muted/70 border border-border hover:border-primary/50"
        } ${isFocused ? "ring-2 ring-primary/50 border-primary" : ""}`}
      >
        {/* Fill bar (visible only when rated) */}
        {isRated && (
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full bg-gradient-to-r from-primary/50 to-primary transition-[width] duration-75 ease-out"
            style={{ width: `${percent}%` }}
          />
        )}

        {/* Hover preview ghost bar (when unrated and hovering) */}
        {!isRated && hoverPercent !== null && (
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full bg-primary/15 pointer-events-none transition-[width] duration-75"
            style={{ width: `${hoverPercent}%` }}
          />
        )}

        {/* Selected Slider Thumb (visible ONLY when scored/rated) */}
        {isRated && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full bg-primary border-2 border-background shadow-md transition-transform ${
              isDragging ? "scale-125 shadow-lg" : "group-hover/track:scale-110"
            }`}
            style={{ left: `${percent}%` }}
          />
        )}

        {/* Hover Ghost Thumb (when unrated, shows where clicking will set) */}
        {!isRated && hoverPercent !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border border-dashed border-primary/60 bg-primary/25 pointer-events-none"
            style={{ left: `${hoverPercent}%` }}
          />
        )}
      </div>
    </div>
  );
}
