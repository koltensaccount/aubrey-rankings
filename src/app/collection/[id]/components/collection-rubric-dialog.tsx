"use client";

import React from "react";
import { Check, Loader2, X } from "lucide-react";
import { CinematicSlider } from "@/components/cinematic-slider";

interface RubricCategory {
  id?: string;
  name: string;
  weight: number;
  [key: string]: any;
}

interface CollectionRubricDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categories: RubricCategory[];
  onCategoriesChange: React.Dispatch<React.SetStateAction<RubricCategory[]>>;
  customizeForCollectionOnly: boolean;
  onCustomizeScopeChange: (scope: boolean) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function CollectionRubricDialog({
  isOpen,
  onClose,
  categories,
  onCategoriesChange,
  customizeForCollectionOnly,
  onCustomizeScopeChange,
  onSave,
  isSaving,
}: CollectionRubricDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-dialog bg-card border border-border-dialog p-6 shadow-dialog space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="font-display text-xl uppercase font-bold text-foreground">
              Adjust Rubric Weights
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Calibrate the multiplier weights for each evaluation category.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {categories.map((cat, idx) => (
            <div
              key={cat.id || idx}
              className="p-3.5 rounded-lg border border-border bg-surface flex items-center justify-between gap-4"
            >
              <span className="font-semibold text-xs text-foreground flex-1">
                {cat.name}
              </span>
              <div className="w-44">
                <CinematicSlider
                  min={0}
                  max={10}
                  step={0.5}
                  value={cat.weight}
                  onChange={(val) => {
                    onCategoriesChange((prev) =>
                      prev.map((c, i) => (i === idx ? { ...c, weight: val ?? 1 } : c))
                    );
                  }}
                  allowUnset={false}
                  showValue={true}
                  valueSuffix="x"
                  size="sm"
                  ariaLabel={`Weight for ${cat.name}`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Scope Option */}
        <div className="p-3 rounded-lg bg-surface border border-border space-y-1.5">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={customizeForCollectionOnly}
              onChange={(e) => onCustomizeScopeChange(e.target.checked)}
              className="rounded border-border text-primary focus:ring-0 accent-primary"
            />
            <span className="text-xs font-semibold text-foreground">
              Customize for this ranking only
            </span>
          </label>
          <p className="text-[11px] text-muted-foreground pl-6 leading-relaxed">
            {customizeForCollectionOnly
              ? "Creates a dedicated rubric for this ranking so your other collections remain untouched."
              : "Updates this rating system globally across all rankings that share it."}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Save Weights</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
