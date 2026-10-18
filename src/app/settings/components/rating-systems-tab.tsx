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
} from "lucide-react";
import { CinematicSlider } from "@/components/cinematic-slider";

export function RatingSystemsTab() {
  const [ratingSystems, setRatingSystems] = useState<any[]>([]);
  const [loadingSystems, setLoadingSystems] = useState(false);
  const [editingSystem, setEditingSystem] = useState<any | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryWeight, setNewCategoryWeight] = useState("5");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [systemToDelete, setSystemToDelete] = useState<any | null>(null);
  const [deletingSystemLoading, setDeletingSystemLoading] = useState(false);

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

  const handleSaveSystem = async () => {
    if (!editingSystem) return;
    try {
      const isExisting = Boolean(editingSystem.id && !editingSystem.id.startsWith("temp_"));
      const url = isExisting
        ? `/api/rating-systems/${editingSystem.id}`
        : "/api/rating-systems";
      const method = isExisting ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingSystem.name,
          scale: editingSystem.scale || 10,
          isDefault: Boolean(editingSystem.isDefault),
          categories: (editingSystem.categories || []).map((c: any, idx: number) => ({
            id: c.id && !c.id.startsWith("temp_") ? c.id : undefined,
            name: c.name,
            weight: c.weight,
            isRequired: c.isRequired !== false,
            sortOrder: idx + 1,
          })),
        }),
      });

      if (res.ok) {
        const saved = await res.json();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        const savedId = saved.ratingSystem?.id || saved.id || editingSystem.id;
        fetchRatingSystems(savedId);
      }
    } catch (err) {
      console.error(err);
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

  const handleCreateNewSystem = () => {
    setEditingSystem({
      id: `temp_${Date.now()}`,
      name: "Custom Weighted Rubric",
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: List of Systems */}
      <div className="lg:col-span-4 space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Your Rubrics ({ratingSystems.length})
          </span>
          <button
            type="button"
            onClick={handleCreateNewSystem}
            className="text-[11px] font-semibold text-primary hover:text-primary-hover flex items-center gap-1 cursor-pointer"
          >
            <Plus size={13} />
            <span>New Rubric</span>
          </button>
        </div>

        <div className="space-y-2">
          {ratingSystems.map((sys: any) => {
            const isSelected = editingSystem?.id === sys.id;
            return (
              <div
                key={sys.id}
                onClick={() => setEditingSystem(sys)}
                className={`p-3.5 rounded-card border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary/10 border-primary ring-1 ring-primary/30 shadow-sm"
                    : "bg-card border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-display text-base font-bold uppercase tracking-tight text-foreground truncate">
                        {sys.name}
                      </h4>
                      {sys.isDefault && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {sys.categories?.length || 0} categories · Scale 0–{sys.scale || 10}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border text-[10px]">
                  {!sys.isDefault && (
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
                    title="Duplicate Rubric"
                  >
                    <Copy size={11} />
                    <span>Duplicate</span>
                  </button>
                  {ratingSystems.length > 1 && !sys.isDefault && (
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Rubric Name
                </label>
                <input
                  type="text"
                  value={editingSystem.name || ""}
                  onChange={(e) =>
                    setEditingSystem({ ...editingSystem, name: e.target.value })
                  }
                  placeholder="e.g. Cinema Criterion, Director Filmography Rubric..."
                  className="w-full text-lg font-display uppercase font-bold px-3 py-1.5 rounded-input bg-surface border border-border-input text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-end gap-3 shrink-0">
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

                <button
                  type="button"
                  onClick={handleSaveSystem}
                  className="h-10 px-5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  {saveSuccess ? (
                    <>
                      <Check size={14} />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Save Rubric</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Categories and Weights */}
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

            {/* Danger Zone: Delete Rubric */}
            {ratingSystems.length > 1 && (
              <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-semibold text-red-400 block">Delete Rating System</span>
                  <span className="text-muted-foreground text-[11px]">
                    {editingSystem.isDefault
                      ? "This is currently your default rubric. Set another rubric as default before deleting."
                      : "Permanently delete this rubric. Collections using it will revert to your default rubric."}
                  </span>
                </div>
                {!editingSystem.isDefault && (
                  <button
                    type="button"
                    onClick={() => setSystemToDelete(editingSystem)}
                    className="px-4 py-2 rounded-button bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
                  >
                    <Trash2 size={13} />
                    <span>Delete Rubric</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center border border-dashed border-border rounded-card text-xs text-muted-foreground">
            Select a rubric on the left or create a new one to begin editing.
          </div>
        )}
      </div>

      {/* Delete Rating System Confirmation Modal */}
      {systemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-dialog bg-card border border-red-500/30 p-6 shadow-dialog space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="h-10 w-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="font-display text-base font-bold uppercase tracking-tight text-foreground">
                  Delete Rating System?
                </h4>
                <p className="text-xs text-muted-foreground">
                  Are you sure you want to delete &ldquo;{systemToDelete.name}&rdquo;?
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              This action cannot be undone. Collections configured to use this rubric will automatically fall back to your default rating system.
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
