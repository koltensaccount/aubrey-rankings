"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sliders,
  User,
  Shield,
  Palette,
  FileSpreadsheet,
  Download,
  Trash2,
  Plus,
  Check,
  AlertTriangle,
  Loader2,
  RefreshCw,
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
          description: editingSystem.description,
          scale: editingSystem.scale,
          isDefault: true,
          categories: editingSystem.categories,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        await fetchRatingSystems();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize weighted scoring formulas, account preferences, and data options.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/80 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("rating_systems")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "rating_systems"
              ? "border-amber-500 text-white"
              : "border-transparent text-muted-foreground hover:text-white"
          }`}
        >
          <Sliders className="h-4 w-4" />
          Rating Systems
        </button>
        <button
          onClick={() => setActiveTab("account")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "account"
              ? "border-amber-500 text-white"
              : "border-transparent text-muted-foreground hover:text-white"
          }`}
        >
          <User className="h-4 w-4" />
          Account & Security
        </button>
        <button
          onClick={() => setActiveTab("data")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "data"
              ? "border-amber-500 text-white"
              : "border-transparent text-muted-foreground hover:text-white"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Data & Importer
        </button>
      </div>

      {/* TAB 1: RATING SYSTEMS */}
      {activeTab === "rating_systems" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Systems List */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Your Systems
            </h3>
            <div className="space-y-2">
              {ratingSystems.map((rs) => (
                <div
                  key={rs.id}
                  onClick={() => setEditingSystem(rs)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    editingSystem?.id === rs.id
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-border/70 bg-card hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{rs.name}</span>
                    {rs.isDefault && (
                      <Badge variant="default" className="text-[10px]">
                        Default
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {rs.description || `${rs.categories?.length || 0} categories`}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* System Editor */}
          {editingSystem && (
            <Card className="lg:col-span-2 p-6 space-y-6 border-border/80 bg-card/80">
              <div className="flex items-center justify-between border-b border-border/80 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{editingSystem.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Adjust weights to automatically recalibrate weighted averages.
                  </p>
                </div>
                <Button
                  onClick={handleSaveSystem}
                  className="font-bold gap-2 shadow-md shadow-amber-500/20"
                >
                  {saveSuccess ? (
                    <>
                      <Check className="h-4 w-4 text-stone-950" />
                      Saved!
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>

              {/* Categories and Weights */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Scoring Categories & Weights
                </span>

                <div className="space-y-3">
                  {editingSystem.categories?.map((cat: any) => (
                    <div
                      key={cat.id}
                      className="p-3.5 rounded-xl border border-border/70 bg-secondary/30 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-white text-sm">
                          {cat.name}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="range"
                            min="0"
                            max="10"
                            step="0.5"
                            value={cat.weight}
                            onChange={(e) =>
                              handleUpdateWeight(cat.id, parseFloat(e.target.value))
                            }
                            className="w-32 accent-amber-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-amber-300">
                            {cat.weight}x
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCategory(cat.id)}
                        className="text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Category Form */}
              <div className="pt-2 border-t border-border/60 flex items-center gap-3">
                <Input
                  placeholder="New category (e.g. Concept, Pacing)..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="h-10 text-xs bg-secondary/50"
                />
                <Input
                  type="number"
                  min="1"
                  max="10"
                  placeholder="Weight"
                  value={newCategoryWeight}
                  onChange={(e) => setNewCategoryWeight(e.target.value)}
                  className="w-20 h-10 text-center text-xs bg-secondary/50"
                />
                <Button
                  onClick={handleAddCategory}
                  variant="secondary"
                  className="gap-1.5 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: ACCOUNT & SECURITY */}
      {activeTab === "account" && (
        <div className="max-w-2xl space-y-6">
          <Card className="p-6 space-y-4 border-border/80 bg-card/80">
            <h3 className="text-base font-bold text-white">Profile Information</h3>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Name
              </label>
              <Input
                defaultValue={session?.user.name || ""}
                disabled
                className="bg-secondary/40 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Email Address
              </label>
              <Input
                defaultValue={session?.user.email || ""}
                disabled
                className="bg-secondary/40 text-sm"
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4 border-red-500/20 bg-red-500/5">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-base font-bold">Danger Zone</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Deleting your account will permanently wipe your collections, custom rating systems,
              and private reviews. This action cannot be undone.
            </p>
            <Button variant="destructive" size="sm">
              Delete Account
            </Button>
          </Card>
        </div>
      )}

      {/* TAB 3: DATA & SPREADSHEET IMPORTER */}
      {activeTab === "data" && (
        <div className="max-w-2xl space-y-6">
          <Card className="p-6 space-y-4 border-border/80 bg-card/80">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Aubrey&apos;s Black Mirror Importer
                </h3>
                <p className="text-xs text-muted-foreground">
                  Import ratings and weights directly from Aubrey&apos;s Spreadsheet format.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-dashed border-border/80 bg-secondary/20 text-center space-y-3">
              <p className="text-xs text-muted-foreground">
                Paste CSV or JSON export from the original spreadsheet:
              </p>
              <textarea
                rows={5}
                placeholder="Episode, Season, Music, Acting, Cinematography, Writing, Vibes, Notes..."
                className="w-full rounded-lg border border-border bg-input/50 p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
              />
              <div className="flex justify-end">
                <Button size="sm" className="font-semibold">
                  Import Spreadsheet Ratings
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-3 border-border/80 bg-card/80">
            <h3 className="text-base font-bold text-white">Export Your Data</h3>
            <p className="text-xs text-muted-foreground">
              Download your complete library, rating histories, and reviews in JSON format.
            </p>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export JSON
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
