"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Star,
  Copy,
  Trash2,
  Check,
  Save,
  Loader2,
  AlertTriangle,
  Layers,
  Sliders,
  ArrowUp,
  ArrowDown,
  Info,
} from "lucide-react";
import { CinematicSlider } from "@/components/cinematic-slider";
import { STANDARD_TIERS_PRESET } from "@/lib/tier-system";

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

export function RatingSystemsTab() {
  const [ratingSystems, setRatingSystems] = useState<any[]>([]);
  const [loadingSystems, setLoadingSystems] = useState(false);
  const [editingSystem, setEditingSystem] = useState<any | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryWeight, setNewCategoryWeight] = useState("5");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [systemToDelete, setSystemToDelete] = useState<any | null>(null);
  const [deletingSystemLoading, setDeletingSystemLoading] = useState(false);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);

  useEffect(() => {
    fetchRatingSystems();
  }, []);

  const fetchRatingSystems = async (selectedId?: string) => {
    setLoadingSystems(true);
    try {
      const res = await fetch("/api/rating-systems");
      if (res.ok) {
        const data = await res.json();
        setRatingSystems(data);
        if (data.length > 0) {
          if (selectedId) {
            const found = data.find((s: any) => s.id === selectedId);
            setEditingSystem(found || data[0]);
          } else if (!editingSystem || !data.some((s: any) => s.id === editingSystem.id)) {
            setEditingSystem(data[0]);
          } else {
            const current = data.find((s: any) => s.id === editingSystem.id);
            setEditingSystem(current || data[0]);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSystems(false);
    }
  };

  // Numerical Rubric Handlers
  const handleUpdateWeight = (catId: string, newWeight: number) => {
    if (!editingSystem) return;
    setEditingSystem({
      ...editingSystem,
      categories: editingSystem.categories.map((c: any) =>
        c.id === catId ? { ...c, weight: newWeight } : c
      ),
    });
  };

  const handleUpdateCategoryName = (catId: string, newName: string) => {
    if (!editingSystem) return;
    setEditingSystem({
      ...editingSystem,
      categories: editingSystem.categories.map((c: any) =>
        c.id === catId ? { ...c, name: newName } : c
      ),
    });
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim() || !editingSystem) return;
    const newCat = {
      id: `temp_${Date.now()}`,
      name: newCategoryName.trim(),
      weight: parseFloat(newCategoryWeight) || 1.0,
      isRequired: true,
      sortOrder: (editingSystem.categories?.length || 0) + 1,
    };
    setEditingSystem({
      ...editingSystem,
      categories: [...(editingSystem.categories || []), newCat],
    });
    setNewCategoryName("");
    setNewCategoryWeight("5");
  };

  const handleRemoveCategory = (catId: string) => {
    if (!editingSystem) return;
    setEditingSystem({
      ...editingSystem,
      categories: editingSystem.categories.filter((c: any) => c.id !== catId),
    });
  };

  // Tier Rubric Handlers
  const handleUpdateTier = (tierId: string, fields: Partial<{ name: string; description: string; color: string }>) => {
    if (!editingSystem) return;
    setEditingSystem({
      ...editingSystem,
      tiers: (editingSystem.tiers || []).map((t: any) =>
        t.id === tierId ? { ...t, ...fields } : t
      ),
    });
  };

  const handleAddTier = () => {
    if (!editingSystem) return;
    const currentTiers = editingSystem.tiers || [];
    const newTier = {
      id: `temp_tier_${Date.now()}`,
      name: `Tier ${currentTiers.length + 1}`,
      description: "",
      color: COLOR_SWATCHES[currentTiers.length % COLOR_SWATCHES.length],
      sortOrder: currentTiers.length + 1,
    };
    setEditingSystem({
      ...editingSystem,
      tiers: [...currentTiers, newTier],
    });
  };

  const handleRemoveTier = (tierId: string) => {
    if (!editingSystem) return;
    const currentTiers = editingSystem.tiers || [];
    if (currentTiers.length <= 2) {
      alert("A tier system must contain at least 2 tiers.");
      return;
    }
    setEditingSystem({
      ...editingSystem,
      tiers: currentTiers.filter((t: any) => t.id !== tierId),
    });
  };

  const handleMoveTier = (index: number, direction: "up" | "down") => {
    if (!editingSystem) return;
    const currentTiers = [...(editingSystem.tiers || [])];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentTiers.length) return;

    const temp = currentTiers[index];
    currentTiers[index] = currentTiers[targetIndex];
    currentTiers[targetIndex] = temp;

    setEditingSystem({
      ...editingSystem,
      tiers: currentTiers.map((t, idx) => ({ ...t, sortOrder: idx + 1 })),
    });
  };

  const handleSaveSystem = async () => {
    if (!editingSystem) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const isExisting = Boolean(editingSystem.id && !editingSystem.id.startsWith("temp_"));
      const isTier = editingSystem.type === "tier";
      const url = isExisting
        ? `/api/rating-systems/${editingSystem.id}`
        : "/api/rating-systems";
      const method = isExisting ? "PATCH" : "POST";

      const payload: any = {
        name: editingSystem.name,
        type: isTier ? "tier" : "numerical",
        isDefault: Boolean(editingSystem.isDefault),
      };

      if (isTier) {
        payload.tiers = (editingSystem.tiers || []).map((t: any, idx: number) => ({
          id: t.id && !t.id.startsWith("temp_") ? t.id : undefined,
          name: t.name,
          description: t.description || null,
          color: t.color || "#EF4444",
          sortOrder: idx + 1,
        }));
        payload.unassignRemovedTiers = true;
      } else {
        payload.scale = editingSystem.scale || 10;
        payload.categories = (editingSystem.categories || []).map((c: any, idx: number) => ({
          id: c.id && !c.id.startsWith("temp_") ? c.id : undefined,
          name: c.name,
          weight: c.weight,
          isRequired: c.isRequired !== false,
          sortOrder: idx + 1,
        }));
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        const savedId = saved.ratingSystem?.id || saved.id || editingSystem.id;
        fetchRatingSystems(savedId);
      } else {
        const err = await res.json();
        setSaveError(err.error || "Failed to save rating system");
      }
    } catch (err: any) {
      console.error(err);
      setSaveError(err?.message || "Failed to save rating system");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicateSystem = async (id: string) => {
    try {
      const res = await fetch(`/api/rating-systems/${id}/duplicate`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        fetchRatingSystems(data.ratingSystem?.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSystem = async (id: string) => {
    setDeletingSystemLoading(true);
    try {
      const res = await fetch(`/api/rating-systems/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSystemToDelete(null);
        await fetchRatingSystems();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete rating system");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete rating system");
    } finally {
      setDeletingSystemLoading(false);
    }
  };

  const handleSetDefaultSystem = async (id: string) => {
    try {
      const res = await fetch(`/api/rating-systems/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (res.ok) {
        fetchRatingSystems(id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateNumericalSystem = () => {
    setShowCreateDropdown(false);
    setSaveError(null);
    setEditingSystem({
      id: `temp_${Date.now()}`,
      name: "Custom Weighted Rubric",
      type: "numerical",
      scale: 10,
      isDefault: false,
      categories: [
        { id: `temp_c1`, name: "Writing & Story", weight: 8, isRequired: true, sortOrder: 1 },
        { id: `temp_c2`, name: "Acting & Cast", weight: 7, isRequired: true, sortOrder: 2 },
        { id: `temp_c3`, name: "Cinematography", weight: 7, isRequired: true, sortOrder: 3 },
        { id: `temp_c4`, name: "Direction & Flow", weight: 8, isRequired: true, sortOrder: 4 },
      ],
    });
  };

  const handleCreateTierSystem = () => {
    setShowCreateDropdown(false);
    setSaveError(null);
    setEditingSystem({
      id: `temp_${Date.now()}`,
      name: "Custom Tier System",
      type: "tier",
      isDefault: false,
      tiers: STANDARD_TIERS_PRESET.map((t, idx) => ({
        id: `temp_tier_${idx}_${Date.now()}`,
        name: t.name,
        description: t.description || "",
        color: t.color,
        sortOrder: idx + 1,
      })),
    });
  };

  const isEditingTier = editingSystem?.type === "tier";
  const isSystemTemplate = Boolean(editingSystem?.isSystemTemplate);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: List of Systems */}
      <div className="lg:col-span-4 space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border relative">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Evaluation Systems ({ratingSystems.length})
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCreateDropdown(!showCreateDropdown)}
              className="text-[11px] font-semibold text-primary hover:text-primary-hover flex items-center gap-1 cursor-pointer py-1"
            >
              <Plus size={13} />
              <span>New Rubric</span>
            </button>

            {showCreateDropdown && (
              <div className="absolute right-0 top-full mt-1 w-52 rounded-card bg-card border border-border shadow-dialog z-30 py-1 text-xs">
                <button
                  type="button"
                  onClick={handleCreateNumericalSystem}
                  className="w-full text-left px-3 py-2 hover:bg-surface flex items-center gap-2 text-foreground transition-colors cursor-pointer"
                >
                  <Sliders size={13} className="text-primary shrink-0" />
                  <div>
                    <div className="font-semibold">Weighted Rubric</div>
                    <div className="text-[10px] text-muted-foreground">Category sliders & weights</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleCreateTierSystem}
                  className="w-full text-left px-3 py-2 hover:bg-surface flex items-center gap-2 text-foreground transition-colors cursor-pointer border-t border-border"
                >
                  <Layers size={13} className="text-amber-400 shrink-0" />
                  <div>
                    <div className="font-semibold">Tier Rating System</div>
                    <div className="text-[10px] text-muted-foreground">Ordered S, A, B, C, D tiers</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {ratingSystems.map((sys: any) => {
            const isSelected = editingSystem?.id === sys.id;
            const isTierSys = sys.type === "tier";
            return (
              <div
                key={sys.id}
                onClick={() => {
                  setEditingSystem(sys);
                  setSaveError(null);
                }}
                className={`p-3.5 rounded-card border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary/10 border-primary ring-1 ring-primary/30 shadow-sm"
                    : "bg-card border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-display text-base font-bold uppercase tracking-tight text-foreground truncate">
                        {sys.name}
                      </h4>
                      {sys.isDefault && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30">
                          Default
                        </span>
                      )}
                      {sys.isSystemTemplate && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Template
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                      {isTierSys ? (
                        <>
                          <Layers size={11} className="text-amber-400 shrink-0" />
                          <span>{sys.tiers?.length || 0} tiers</span>
                          <span className="text-border">·</span>
                          <div className="flex items-center gap-1">
                            {sys.tiers?.slice(0, 5).map((t: any) => (
                              <span
                                key={t.id}
                                className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[8px] font-bold text-black"
                                style={{ backgroundColor: t.color }}
                              >
                                {t.name.slice(0, 1)}
                              </span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <Sliders size={11} className="text-primary shrink-0" />
                          <span>{sys.categories?.length || 0} categories</span>
                          <span className="text-border">·</span>
                          <span>Scale 0–{sys.scale || 10}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border text-[10px]">
                  {!sys.isDefault && !sys.isSystemTemplate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefaultSystem(sys.id);
                      }}
                      className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                      title="Set as Default Rubric"
                    >
                      <Star size={11} />
                      <span>Make Default</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateSystem(sys.id);
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 ml-auto cursor-pointer"
                    title={sys.isSystemTemplate ? "Duplicate Template to Personalize" : "Duplicate Rubric"}
                  >
                    <Copy size={11} />
                    <span>{sys.isSystemTemplate ? "Clone Template" : "Duplicate"}</span>
                  </button>
                  {ratingSystems.length > 1 && !sys.isDefault && !sys.isSystemTemplate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSystemToDelete(sys);
                      }}
                      className="text-muted-foreground hover:text-red-400 transition-colors p-0.5 cursor-pointer"
                      title="Delete Rubric"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Active System Editor */}
      <div className="lg:col-span-8">
        {editingSystem ? (
          <div className="p-6 rounded-card border border-border-card bg-card space-y-6 shadow-card">
            {/* System Template Read-Only Notice */}
            {isSystemTemplate && (
              <div className="p-3.5 rounded-card bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-amber-300">
                  <Info size={16} className="shrink-0" />
                  <span>
                    This is a built-in system template. To customize or reorder its tiers, make your own copy.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDuplicateSystem(editingSystem.id)}
                  className="px-3 py-1.5 rounded-button bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy size={13} />
                  <span>Clone Template</span>
                </button>
              </div>
            )}

            {saveError && (
              <div className="p-3 rounded-card bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            {/* Rubric Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    System Name
                  </label>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-surface border border-border text-muted-foreground">
                    {isEditingTier ? "Tier Rating System" : "Numerical Weighted Rubric"}
                  </span>
                </div>
                <input
                  type="text"
                  disabled={isSystemTemplate}
                  value={editingSystem.name || ""}
                  onChange={(e) =>
                    setEditingSystem({ ...editingSystem, name: e.target.value })
                  }
                  placeholder="e.g. Cinema Criterion, Director Filmography Rubric..."
                  className="w-full text-lg font-display uppercase font-bold px-3 py-1.5 rounded-input bg-surface border border-border-input text-foreground focus:outline-none focus:border-primary disabled:opacity-60"
                />
              </div>

              {!isSystemTemplate && (
                <div className="flex items-end gap-3 shrink-0">
                  {!isEditingTier && (
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                        Scale
                      </label>
                      <select
                        value={editingSystem.scale || 10}
                        onChange={(e) =>
                          setEditingSystem({
                            ...editingSystem,
                            scale: parseInt(e.target.value, 10),
                          })
                        }
                        className="h-10 px-3 text-xs rounded-input bg-surface border border-border-input text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value={10}>Scale 0–10 (Standard)</option>
                        <option value={5}>Scale 0–5</option>
                        <option value={100}>Scale 0–100</option>
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveSystem}
                    disabled={isSaving}
                    className="h-10 px-5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : saveSuccess ? (
                      <>
                        <Check size={14} />
                        <span>Saved!</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        <span>{isEditingTier ? "Save Tier System" : "Save Rubric"}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* TIER SYSTEM EDITOR */}
            {isEditingTier ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Ordered Evaluation Tiers
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      Tiers are sorted from highest to lowest. Items in collections will be classified into these tiers.
                    </span>
                  </div>
                  {!isSystemTemplate && (
                    <button
                      type="button"
                      onClick={handleAddTier}
                      className="px-3 py-1.5 rounded-button bg-surface-elevated hover:bg-muted text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Add Tier</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {(editingSystem.tiers || []).map((tier: any, idx: number) => {
                    const isFirst = idx === 0;
                    const isLast = idx === (editingSystem.tiers || []).length - 1;
                    return (
                      <div
                        key={tier.id}
                        className="p-3.5 rounded-card border border-border bg-surface flex flex-col sm:flex-row sm:items-center gap-3 transition-colors"
                      >
                        {/* Drag / Reorder Controls */}
                        {!isSystemTemplate && (
                          <div className="flex items-center sm:flex-col gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={isFirst}
                              onClick={() => handleMoveTier(idx, "up")}
                              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={isLast}
                              onClick={() => handleMoveTier(idx, "down")}
                              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown size={13} />
                            </button>
                          </div>
                        )}

                        {/* Tier Color Badge & Swatch Picker */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div
                            className="w-10 h-10 rounded-button flex items-center justify-center font-display font-black text-sm text-black shadow-sm"
                            style={{ backgroundColor: tier.color }}
                          >
                            {tier.name || "?"}
                          </div>
                          {!isSystemTemplate && (
                            <div className="flex items-center gap-1">
                              {COLOR_SWATCHES.map((swatch) => (
                                <button
                                  key={swatch}
                                  type="button"
                                  onClick={() => handleUpdateTier(tier.id, { color: swatch })}
                                  className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                                    tier.color === swatch ? "ring-2 ring-primary scale-110" : "hover:scale-105"
                                  }`}
                                  style={{ backgroundColor: swatch }}
                                  title={swatch}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Tier Name & Description */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold block sm:hidden">
                              Tier Name
                            </label>
                            <input
                              type="text"
                              disabled={isSystemTemplate}
                              value={tier.name}
                              onChange={(e) => handleUpdateTier(tier.id, { name: e.target.value })}
                              placeholder="e.g. S, Masterpiece..."
                              className="w-full text-xs font-bold uppercase text-foreground bg-transparent border-b border-border-input hover:border-border focus:border-primary focus:outline-none py-1 disabled:opacity-60"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold block sm:hidden">
                              Description / Meaning
                            </label>
                            <input
                              type="text"
                              disabled={isSystemTemplate}
                              value={tier.description || ""}
                              onChange={(e) => handleUpdateTier(tier.id, { description: e.target.value })}
                              placeholder="e.g. Essential cinema, flawless execution..."
                              className="w-full text-xs text-muted-foreground bg-transparent border-b border-border-input hover:border-border focus:border-primary focus:outline-none py-1 disabled:opacity-60"
                            />
                          </div>
                        </div>

                        {/* Remove Tier Button */}
                        {!isSystemTemplate && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTier(tier.id)}
                            className="text-muted-foreground hover:text-red-400 p-1.5 transition-colors cursor-pointer shrink-0 self-end sm:self-center"
                            title="Remove Tier"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* NUMERICAL RUBRIC EDITOR */
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Scoring Categories & Multiplier Weights
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      Weights calibrate relative influence on the overall score
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {editingSystem.categories?.map((cat: any) => (
                      <div
                        key={cat.id}
                        className="p-3.5 rounded-card border border-border bg-surface flex items-center justify-between gap-4"
                      >
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <input
                            type="text"
                            value={cat.name}
                            onChange={(e) =>
                              handleUpdateCategoryName(cat.id, e.target.value)
                            }
                            className="w-full text-xs font-semibold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-0.5"
                          />
                          <div className="w-full">
                            <CinematicSlider
                              min={0}
                              max={10}
                              step={0.5}
                              value={cat.weight}
                              onChange={(val) =>
                                handleUpdateWeight(cat.id, val ?? 1)
                              }
                              allowUnset={false}
                              showValue={true}
                              valueSuffix="x"
                              size="sm"
                              ariaLabel={`Weight for ${cat.name}`}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveCategory(cat.id)}
                          className="text-muted-foreground hover:text-red-400 p-1 transition-colors bg-transparent border-0 cursor-pointer shrink-0"
                          title="Remove Category"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add New Category Form */}
                <div className="pt-3 border-t border-border flex items-center gap-3">
                  <input
                    placeholder="New category (e.g. Atmosphere, Pacing, Direction)..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="flex-1 h-9 px-3 text-xs rounded-input bg-surface border border-border-input text-foreground focus:outline-none focus:border-primary"
                  />
                  <input
                    type="number"
                    min="1"
                    max="10"
                    placeholder="Weight"
                    value={newCategoryWeight}
                    onChange={(e) => setNewCategoryWeight(e.target.value)}
                    className="w-20 h-9 text-center text-xs rounded-input bg-surface border border-border-input text-foreground focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-4 h-9 rounded-button bg-surface-elevated hover:bg-muted text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Category</span>
                  </button>
                </div>
              </>
            )}

            {/* Danger Zone: Delete System */}
            {ratingSystems.length > 1 && !editingSystem.isDefault && !isSystemTemplate && (
              <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-semibold text-red-400 block">
                    Delete {isEditingTier ? "Tier System" : "Rubric"}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    Permanently delete this evaluation system. Collections using it will revert to your default rubric.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSystemToDelete(editingSystem)}
                  className="px-4 py-2 rounded-button bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
                >
                  <Trash2 size={13} />
                  <span>Delete System</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center border border-dashed border-border rounded-card text-xs text-muted-foreground">
            Select an evaluation system on the left or create a new one to begin editing.
          </div>
        )}
      </div>

      {/* Delete System Confirmation Modal */}
      {systemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-dialog bg-card border border-red-500/30 p-6 shadow-dialog space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="h-10 w-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="font-display text-base font-bold uppercase tracking-tight text-foreground">
                  Delete {systemToDelete.type === "tier" ? "Tier System" : "Rating System"}?
                </h4>
                <p className="text-xs text-muted-foreground">
                  Are you sure you want to delete &ldquo;{systemToDelete.name}&rdquo;?
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              This action cannot be undone. Collections configured to use this system will automatically fall back to your default rating system.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSystemToDelete(null)}
                disabled={deletingSystemLoading}
                className="px-4 py-2 rounded-button bg-surface-elevated hover:bg-muted text-foreground border border-border text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSystem(systemToDelete.id)}
                disabled={deletingSystemLoading}
                className="px-4 py-2 rounded-button bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deletingSystemLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Delete System</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
