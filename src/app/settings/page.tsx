"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import {
  Sliders,
  User,
  Shield,
  FileSpreadsheet,
  Download,
  Trash2,
  Plus,
  Check,
  AlertTriangle,
  Loader2,
  Save,
} from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"rating_systems" | "account" | "data">("rating_systems");

  // Rating systems state
  const [ratingSystems, setRatingSystems] = useState<any[]>([]);
  const [loadingSystems, setLoadingSystems] = useState(false);
  const [editingSystem, setEditingSystem] = useState<any | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryWeight, setNewCategoryWeight] = useState("5");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchRatingSystems();
  }, []);

  const fetchRatingSystems = async () => {
    setLoadingSystems(true);
    try {
      const res = await fetch("/api/rating-systems");
      if (res.ok) {
        const data = await res.json();
        setRatingSystems(data);
        if (data.length > 0 && !editingSystem) {
          setEditingSystem(data[0]);
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
      const res = await fetch("/api/rating-systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingSystem.name,
          scale: editingSystem.scale,
          categories: editingSystem.categories.map((c: any, idx: number) => ({
            name: c.name,
            weight: c.weight,
            isRequired: c.isRequired,
            sortOrder: idx + 1,
          })),
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        fetchRatingSystems();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div>
        <span className="text-[11px] text-[#8fa095] uppercase tracking-wider block">
          Platform Configuration
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight text-[#f1f0e9] mt-1">
          Settings
        </h1>
        <p className="text-xs text-[#9aa79e] mt-1">
          Manage personalized weighted rubrics, critique preferences, and account security.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#303b34] pb-px">
        <button
          onClick={() => setActiveTab("rating_systems")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "rating_systems"
              ? "border-[#89d5d5] text-[#f1f0e9]"
              : "border-transparent text-[#8fa095] hover:text-[#f1f0e9]"
          }`}
        >
          <Sliders size={14} />
          <span>Weighted Rubrics</span>
        </button>

        <button
          onClick={() => setActiveTab("account")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "account"
              ? "border-[#89d5d5] text-[#f1f0e9]"
              : "border-transparent text-[#8fa095] hover:text-[#f1f0e9]"
          }`}
        >
          <User size={14} />
          <span>Account & Security</span>
        </button>

        <button
          onClick={() => setActiveTab("data")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "data"
              ? "border-[#89d5d5] text-[#f1f0e9]"
              : "border-transparent text-[#8fa095] hover:text-[#f1f0e9]"
          }`}
        >
          <FileSpreadsheet size={14} />
          <span>Data & Import</span>
        </button>
      </div>

      {/* TAB 1: RATING SYSTEMS */}
      {activeTab === "rating_systems" && (
        <div className="space-y-6">
          {editingSystem && (
            <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-6">
              <div className="flex items-center justify-between border-b border-[#28342d] pb-4">
                <div>
                  <h3 className="font-display text-2xl uppercase font-bold text-[#f1f0e9]">
                    {editingSystem.name}
                  </h3>
                  <p className="text-xs text-[#8fa095] mt-0.5">
                    Adjust weights to automatically recalibrate weighted averages across your library.
                  </p>
                </div>
                <button
                  onClick={handleSaveSystem}
                  className="px-4 py-2 rounded bg-[#d8e2d8] hover:bg-[#edf5ed] text-[#102523] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
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

              {/* Categories and Weights */}
              <div className="space-y-3">
                <span className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                  Scoring Categories & Weights
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {editingSystem.categories?.map((cat: any) => (
                    <div
                      key={cat.id}
                      className="p-3.5 rounded-lg border border-[#2b3730] bg-[#111613] flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-[#f1f0e9] text-xs">
                          {cat.name}
                        </span>
                        <div className="flex items-center gap-3 mt-1.5">
                          <input
                            type="range"
                            min="0"
                            max="10"
                            step="0.5"
                            value={cat.weight}
                            onChange={(e) =>
                              handleUpdateWeight(cat.id, parseFloat(e.target.value))
                            }
                            className="w-28 accent-[#89d5d5] cursor-pointer"
                          />
                          <span className="text-xs font-bold text-[#89d5d5] font-display">
                            {cat.weight}x
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveCategory(cat.id)}
                        className="text-[#8fa095] hover:text-red-400 p-1 transition-colors bg-transparent border-0 cursor-pointer"
                        title="Remove Category"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Category Form */}
              <div className="pt-3 border-t border-[#28342d] flex items-center gap-3">
                <input
                  placeholder="New category (e.g. Atmosphere, Pacing)..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 h-9 px-3 text-xs rounded bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5]"
                />
                <input
                  type="number"
                  min="1"
                  max="10"
                  placeholder="Weight"
                  value={newCategoryWeight}
                  onChange={(e) => setNewCategoryWeight(e.target.value)}
                  className="w-20 h-9 text-center text-xs rounded bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5]"
                />
                <button
                  onClick={handleAddCategory}
                  className="px-4 h-9 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACCOUNT & SECURITY */}
      {activeTab === "account" && (
        <div className="max-w-2xl space-y-6">
          <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-4">
            <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
              Profile Information
            </h3>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                Display Name
              </label>
              <input
                defaultValue={session?.user.name || ""}
                disabled
                className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-[#18211d] border border-[#303b34] text-[#8fa095] cursor-not-allowed"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                Email Address
              </label>
              <input
                defaultValue={session?.user.email || ""}
                disabled
                className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-[#18211d] border border-[#303b34] text-[#8fa095] cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DATA & IMPORTER */}
      {activeTab === "data" && (
        <div className="max-w-2xl space-y-6">
          <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#1b2520] border border-[#3b4c40] flex items-center justify-center text-[#89d5d5]">
                <FileSpreadsheet size={18} />
              </div>
              <div>
                <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
                  Aubrey&apos;s Black Mirror Importer
                </h3>
                <p className="text-xs text-[#8fa095]">
                  Import ratings and weights directly from Aubrey&apos;s Spreadsheet format.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-dashed border-[#303b34] bg-[#111613] text-center space-y-3">
              <p className="text-xs text-[#8fa095]">
                Paste CSV or JSON export from the original spreadsheet:
              </p>
              <textarea
                rows={5}
                placeholder="Episode, Season, Music, Acting, Cinematography, Writing, Vibes, Notes..."
                className="w-full rounded-lg border border-[#303b34] bg-[#18211d] p-3 text-xs text-[#f1f0e9] placeholder:text-[#6d7e74] focus:outline-none focus:border-[#89d5d5] font-mono resize-none"
              />
              <div className="flex justify-end">
                <button className="px-4 py-2 rounded bg-[#d8e2d8] hover:bg-[#edf5ed] text-[#102523] text-xs font-semibold">
                  Import Spreadsheet Ratings
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-3">
            <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
              Export Your Data
            </h3>
            <p className="text-xs text-[#8fa095]">
              Download your complete library, rating histories, and reviews in JSON format.
            </p>
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40] text-xs font-semibold transition-colors">
              <Download size={14} />
              <span>Export JSON</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
