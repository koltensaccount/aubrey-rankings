"use client";

import { RotateCcw } from "lucide-react";
import { CinematicSlider } from "@/components/cinematic-slider";

interface RatingCategorySliderProps {
  category: {
    id: string;
    name: string;
    weight: number;
    isRequired?: boolean;
  };
  score: number | null;
  scale: number;
  onScoreChange: (catId: string, val: number | null) => void;
  onNumericInputChange: (catId: string, text: string) => void;
}

export function RatingCategorySlider({
  category,
  score,
  scale,
  onScoreChange,
  onNumericInputChange,
}: RatingCategorySliderProps) {
  const isScored = typeof score === "number" && Number.isFinite(score);

  return (
    <div
      className={`p-3.5 rounded-card border transition-colors space-y-2.5 ${
        isScored
          ? "border-border-card bg-card shadow-card"
          : "border-border/60 bg-muted/30"
      }`}
    >
      {/* Category Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">
            {category.name}
          </span>
          {category.isRequired && (
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold bg-muted/80 px-1.5 py-0.5 rounded-badge border border-border shrink-0">
              Req
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded-badge border border-primary/20">
            {category.weight.toFixed(1)}× weight
          </span>

          {/* Quick Reset / Unrate button */}
          {isScored && (
            <button
              type="button"
              onClick={() => onScoreChange(category.id, null)}
              title="Clear category score"
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <RotateCcw size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Slider and Synchronized Numeric Input */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <CinematicSlider
            value={score ?? null}
            onChange={(val) => onScoreChange(category.id, val)}
            min={0}
            max={scale}
            step={0.5}
            name={category.name}
            ariaLabel={`${category.name} score`}
          />
        </div>

        {/* Numeric Input */}
        <div className="shrink-0 flex items-center gap-1">
          <input
            type="number"
            min="0"
            max={scale}
            step="0.1"
            placeholder="—"
            value={isScored ? score : ""}
            onChange={(e) => onNumericInputChange(category.id, e.target.value)}
            aria-label={`${category.name} numeric score`}
            className="w-14 h-8 text-center text-xs font-semibold rounded-input bg-surface border border-border-input text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
      </div>

      {/* Readout label */}
      <div className="flex items-center justify-between text-[11px] pt-0.5">
        <span className="text-muted-foreground">
          {isScored ? (
            <span className="text-primary font-semibold">
              {score.toFixed(1)}{" "}
              <span className="text-muted-foreground font-normal">/ {scale}</span>
            </span>
          ) : (
            <span className="italic">Not rated</span>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground/75">
          max {scale}
        </span>
      </div>
    </div>
  );
}
