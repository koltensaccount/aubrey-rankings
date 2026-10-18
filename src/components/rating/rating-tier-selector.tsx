"use client";

import React, { useEffect, useRef } from "react";
import { TierItem } from "@/lib/tier-system";
import { X, Check } from "lucide-react";

interface RatingTierSelectorProps {
  tiers: TierItem[];
  selectedTierId: string | null;
  onSelectTier: (tierId: string | null) => void;
}

export function RatingTierSelector({
  tiers,
  selectedTierId,
  onSelectTier,
}: RatingTierSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation for tier selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      // Number keys 1-9
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= tiers.length) {
        e.preventDefault();
        onSelectTier(tiers[num - 1].id);
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        if (selectedTierId) {
          e.preventDefault();
          onSelectTier(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tiers, selectedTierId, onSelectTier]);

  const selectedTier = tiers.find((t) => t.id === selectedTierId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tier Assignment
        </label>
        {selectedTierId && (
          <button
            type="button"
            onClick={() => onSelectTier(null)}
            className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors cursor-pointer"
            title="Clear tier assignment"
          >
            <X size={12} />
            <span>Unassign Tier</span>
          </button>
        )}
      </div>

      {/* Tier Radio Buttons */}
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label="Tier selection"
        className="grid grid-cols-2 sm:grid-cols-5 gap-2.5"
      >
        {tiers.map((tier, index) => {
          const isSelected = tier.id === selectedTierId;
          const shortcutKey = index < 9 ? index + 1 : undefined;

          return (
            <button
              key={tier.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectTier(tier.id)}
              style={
                isSelected
                  ? {
                      borderColor: tier.color,
                      backgroundColor: `${tier.color}20`,
                      boxShadow: `0 0 12px ${tier.color}30`,
                    }
                  : undefined
              }
              className={`relative flex flex-col items-center justify-center p-3 rounded-card border transition-all cursor-pointer group ${
                isSelected
                  ? "border-2"
                  : "border-border bg-card/60 hover:bg-surface hover:border-border-hover"
              }`}
            >
              {shortcutKey && (
                <span className="absolute top-1 right-1.5 text-[9px] font-mono text-muted-foreground/60 group-hover:text-muted-foreground">
                  {shortcutKey}
                </span>
              )}

              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-display text-xl font-bold mb-1 transition-transform group-hover:scale-105"
                style={{
                  backgroundColor: `${tier.color}25`,
                  color: tier.color,
                  border: `1.5px solid ${tier.color}`,
                }}
              >
                {tier.name}
              </div>

              <span className="text-xs font-semibold text-foreground truncate max-w-full">
                Tier {tier.name}
              </span>

              {isSelected && (
                <div
                  className="absolute bottom-1 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: tier.color }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Tier Description Banner */}
      {selectedTier && (
        <div
          className="p-3 rounded-lg border flex items-start gap-2.5 text-xs animate-in fade-in"
          style={{
            borderColor: `${selectedTier.color}40`,
            backgroundColor: `${selectedTier.color}10`,
          }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
            style={{ backgroundColor: selectedTier.color }}
          />
          <div>
            <span className="font-bold text-foreground mr-1.5">
              Tier {selectedTier.name}:
            </span>
            <span className="text-muted-foreground">
              {selectedTier.description || "Assigned tier level."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
