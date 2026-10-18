"use client";

import React, { useRef, useState, useCallback } from "react";

export interface CinematicSliderProps {
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
  allowUnset?: boolean;
  size?: "sm" | "default" | "lg";
  showValue?: boolean;
  valueSuffix?: string;
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
  allowUnset = true,
  size = "default",
  showValue = false,
  valueSuffix = "",
}: CinematicSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{x:number,value:number|null} | null>(null);
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
      const stepped = min + Math.round((rawVal - min) / step) * step;
      // Clamp to min and max and round to 2 decimals
      const clamped = Math.max(min, Math.min(max, Number(stepped.toFixed(2))));
      return clamped;
    },
    [min, max, step, range]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    trackRef.current?.focus();
    trackRef.current?.setPointerCapture(e.pointerId);
    pointerStart.current = {x:e.clientX,value};
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
    const start = pointerStart.current;
    pointerStart.current = null;
    if (allowUnset && start?.value != null && Math.abs(start.x-e.clientX)<3 && getValueFromPointer(e.clientX)===start.value) onChange(null);
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
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (allowUnset) {
        onChange(null); // Genuine unset
      } else {
        onChange(min);
      }
    }
  };

  const trackHeight =
    size === "sm" ? "h-2" : size === "lg" ? "h-3.5" : "h-2.5 sm:h-3";
  const thumbSize =
    size === "sm"
      ? "w-3.5 h-3.5"
      : size === "lg"
      ? "w-5 h-5"
      : "w-4 h-4 sm:w-4.5 sm:h-4.5";

  return (
    <div className={`relative flex items-center min-h-11 select-none py-1.5 ${className}`}>
      {/* Interactive slider track container */}
      <div
        ref={trackRef}
        id={id}
        tabIndex={disabled ? -1 : 0}
        role="slider"
        aria-label={ariaLabel || name || "Slider control"}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-disabled={disabled}
        aria-valuenow={isRated ? value : undefined}
        aria-valuetext={isRated ? `${value} out of ${max}` : "Not set"}
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
        className={`group/track relative w-full before:absolute before:inset-x-0 before:-inset-y-4 before:content-[''] ${trackHeight} rounded-full cursor-pointer touch-none transition-all ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-muted border border-border"
            : "bg-muted/70 border border-border hover:border-primary/50"
        } ${isFocused ? "ring-2 ring-primary/50 border-primary" : ""}`}
      >
        {/* Fill bar (visible only when rated or numerical) */}
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

        {/* Selected Slider Thumb */}
        {isRated && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 ${thumbSize} rounded-full bg-primary border-2 border-background shadow-md transition-transform ${
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

      {showValue && (
        <span className="font-display font-bold text-xs sm:text-sm text-primary tabular-nums shrink-0 ml-3">
          {isRated ? `${value}${valueSuffix}` : "—"}
        </span>
      )}
    </div>
  );
}
