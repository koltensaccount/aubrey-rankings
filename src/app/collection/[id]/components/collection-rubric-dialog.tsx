"use client";

import React, { useState } from "react";
import { Check, Loader2, X, Plus, Trash2, ArrowUp, ArrowDown, Layers, Sliders } from "lucide-react";
import { RubricCategoryFields } from "@/components/rating/rubric-category-fields";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const COLOR_SWATCHES = [
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#64748B", // Slate
];

interface RubricCategory {
  id?: string;
  name: string;
  weight: number;
  [key: string]: any;
}

interface RubricTier {
  id?: string;
  name: string;
  description?: string;
  color: string;
  sortOrder?: number;
  [key: string]: any;
}

interface CollectionRubricDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isTier?: boolean;
  targetMethod?: "numerical" | "tier";
  categories: RubricCategory[];
  onCategoriesChange: React.Dispatch<React.SetStateAction<RubricCategory[]>>;
  tiers?: RubricTier[];
  onTiersChange?: React.Dispatch<React.SetStateAction<RubricTier[]>>;
  customizeForCollectionOnly: boolean;
  onCustomizeScopeChange: (scope: boolean) => void;
  onSave: (targetMethod?: "numerical" | "tier") => void;
  isSaving: boolean;
}

const DEFAULT_TIER_ROWS: RubricTier[] = [
  { id: "tier_temp_s", name: "S", description: "Masterpiece / Exceptional", color: "#EF4444", sortOrder: 1 },
  { id: "tier_temp_a", name: "A", description: "Great / High Quality", color: "#F97316", sortOrder: 2 },
  { id: "tier_temp_b", name: "B", description: "Good / Solid", color: "#F59E0B", sortOrder: 3 },
  { id: "tier_temp_c", name: "C", description: "Average / Mediocre", color: "#10B981", sortOrder: 4 },
  { id: "tier_temp_d", name: "D", description: "Subpar / Poor", color: "#3B82F6", sortOrder: 5 },
];

export function CollectionRubricDialog({
  isOpen,
  onClose,
  isTier = false,
  targetMethod,
  categories,
  onCategoriesChange,
  tiers = [],
  onTiersChange,
  customizeForCollectionOnly,
  onCustomizeScopeChange,
  onSave,
  isSaving,
}: CollectionRubricDialogProps) {
  const [activeColorPickerIdx, setActiveColorPickerIdx] = useState<number | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<"numerical" | "tier">(
    targetMethod || (isTier ? "tier" : "numerical")
  );

  React.useEffect(() => {
    if (isOpen) {
      setSelectedMethod(targetMethod || (isTier ? "tier" : "numerical"));
    }
  }, [isOpen, targetMethod, isTier]);

  if (!isOpen) return null;

  const isTierMode = selectedMethod === "tier";

  const handleSelectMethod = (m: "numerical" | "tier") => {
    setSelectedMethod(m);
    if (m === "tier" && (!tiers || tiers.length === 0) && onTiersChange) {
      onTiersChange(DEFAULT_TIER_ROWS);
    }
  };

  const handleAddTier = () => {
    if (!onTiersChange) return;
    const defaultColor = COLOR_SWATCHES[tiers.length % COLOR_SWATCHES.length];
    onTiersChange([
      ...tiers,
      {
        id: `tier_temp_${Date.now()}`,
        name: "New Tier",
        description: "",
        color: defaultColor,
        sortOrder: tiers.length + 1,
      },
    ]);
  };

  const handleRemoveTier = (idx: number) => {
    if (!onTiersChange || tiers.length <= 1) return;
    onTiersChange(tiers.filter((_, i) => i !== idx));
  };

  const handleMoveTier = (idx: number, direction: "up" | "down") => {
    if (!onTiersChange) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= tiers.length) return;
    const nextTiers = [...tiers];
    const [moved] = nextTiers.splice(idx, 1);
    nextTiers.splice(targetIdx, 0, moved);
    onTiersChange(nextTiers);
  };

  const handleUpdateTier = (idx: number, patch: Partial<RubricTier>) => {
    if (!onTiersChange) return;
    onTiersChange(tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl flex flex-col overflow-hidden p-4 sm:p-6 gap-5 [&_button]:min-h-11 [&_button]:min-w-11 sm:[&_button]:min-h-0 sm:[&_button]:min-w-0 bg-card border-border-dialog shadow-dialog rounded-dialog">
        <DialogHeader className="shrink-0 pr-10 pb-3 border-b border-border text-left sm:text-left flex flex-row items-center gap-2.5 space-y-0">
          <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
            {isTierMode ? <Layers size={18} /> : <Sliders size={18} />}
          </div>
          <div>
            <DialogTitle className="font-display text-xl uppercase font-bold text-foreground">
              Rating Setup
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {isTierMode
                ? "Configure tier lanes, colors, labels, and hierarchy, or switch rating method."
                : "Calibrate category multiplier weights, or switch to a tier-based system."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain space-y-4">
        {/* Evaluation Method Switcher */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Rating Method
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-surface rounded-lg border border-border">
            <button
              type="button"
              onClick={() => handleSelectMethod("numerical")}
              className={`py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                selectedMethod === "numerical"
                  ? "bg-card text-foreground shadow-xs border border-border font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sliders size={14} className={selectedMethod === "numerical" ? "text-primary-text" : ""} />
              <span>Numerical Rubric</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectMethod("tier")}
              className={`py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                selectedMethod === "tier"
                  ? "bg-card text-foreground shadow-xs border border-border font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers size={14} className={selectedMethod === "tier" ? "text-primary-text" : ""} />
              <span>Tier List (S/A/B/C/D)</span>
            </button>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between px-1">
            <span>Preserves all historical scores and tier assignments.</span>
            {selectedMethod !== (isTier ? "tier" : "numerical") && (
              <span className="text-primary-text font-semibold">Will switch collection format</span>
            )}
          </div>
        </div>

        {/* Content area: Tier Rows OR Numerical Sliders */}
        <div className="space-y-3">
          {isTierMode ? (
            <>
              {tiers.map((tier, idx) => (
                <div
                  key={tier.id || idx}
                  className="p-3 rounded-lg border border-border bg-surface flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3"
                >
                  {/* Color Swatch Picker */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveColorPickerIdx((prev) => (prev === idx ? null : idx))
                      }
                      title="Select tier color"
                      className="w-8 h-8 rounded-md border border-white/20 shadow-xs cursor-pointer hover:scale-105 transition-transform"
                      style={{ backgroundColor: tier.color }}
                    />
                    {activeColorPickerIdx === idx && (
                      <div className="absolute left-0 top-10 z-30 p-2 bg-card border border-border rounded-lg shadow-xl grid grid-cols-3 gap-1.5 w-44 sm:w-32 backdrop-blur-md">
                        {COLOR_SWATCHES.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => {
                              handleUpdateTier(idx, { color });
                              setActiveColorPickerIdx(null);
                            }}
                            className="w-7 h-7 rounded border border-white/20 hover:scale-110 transition-transform cursor-pointer"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tier Name Input */}
                  <div className="w-16 sm:w-20 shrink-0">
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) => handleUpdateTier(idx, { name: e.target.value })}
                      maxLength={10}
                      className="w-full bg-background border border-border rounded px-2 py-1 text-xs font-display font-bold uppercase text-foreground text-center focus:outline-none focus:border-primary"
                      placeholder="S"
                    />
                  </div>

                  {/* Tier Description Input */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={tier.description || ""}
                      onChange={(e) => handleUpdateTier(idx, { description: e.target.value })}
                      placeholder="Description (e.g. Masterpiece)"
                      className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary truncate"
                    />
                  </div>

                  {/* Reorder and Delete Controls */}
                  <div className="flex items-center justify-end w-full sm:w-auto gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveTier(idx, "up")}
                      className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                      title="Move tier up"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === tiers.length - 1}
                      onClick={() => handleMoveTier(idx, "down")}
                      className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                      title="Move tier down"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={tiers.length <= 1}
                      onClick={() => handleRemoveTier(idx)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive disabled:opacity-30 cursor-pointer ml-1"
                      title="Delete tier"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddTier}
                className="w-full py-2 border border-dashed border-border rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-border-dialog flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Tier Row</span>
              </button>
            </>
          ) : (
            categories.map((cat, idx) => (
              <div
                key={cat.id || idx}
                className="p-3.5 rounded-lg border border-border bg-surface flex items-center justify-between gap-4"
              >
                <RubricCategoryFields
                  name={cat.name}
                  weight={cat.weight}
                  onNameChange={(name) => onCategoriesChange((prev) =>
                    prev.map((c, i) => i === idx ? { ...c, name } : c)
                  )}
                  onWeightChange={(weight) => onCategoriesChange((prev) =>
                    prev.map((c, i) => i === idx ? { ...c, weight } : c)
                  )}
                />
              </div>
            ))
          )}
        </div>

        {/* Scope Option */}
        <div className="p-3 rounded-lg bg-surface border border-border space-y-1.5">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={customizeForCollectionOnly}
              onChange={(e) => onCustomizeScopeChange(e.target.checked)}
              className="rounded border-border text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 accent-primary"
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

        </div>

        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
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
            onClick={() => onSave(selectedMethod)}
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
                <span>{selectedMethod !== (isTier ? "tier" : "numerical") ? "Apply & Switch Format" : "Save Rubric"}</span>
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
