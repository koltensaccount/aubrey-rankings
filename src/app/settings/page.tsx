"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession, signOut, authClient } from "@/lib/auth-client";
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
  UploadCloud,
  ExternalLink,
  Film,
  KeyRound,
  Copy,
  Star,
  Sparkles,
  Camera,
  Palette,
  Sun,
  Moon,
  Monitor,
  RotateCcw,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import {
  ACCENT_PRESETS,
  getContrastRatio,
  getRelativeLuminance,
  hexToRgb,
  isValidHexColor,
  normalizeHexColor,
  getAccessibleForeground,
  ThemeMode,
} from "@/lib/theme";

export default function SettingsPage() {
  const { data: session } = useSession();
  const {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    resetToDefaults,
    resolvedTheme,
    isSaving: isSavingTheme,
  } = useTheme();

  const [activeTab, setActiveTab] = useState<
    "appearance" | "rating_systems" | "account" | "data"
  >("appearance");

  // Custom accent state
  const [customHex, setCustomHex] = useState(accentColor);
  const [colorError, setColorError] = useState<string | null>(null);

  useEffect(() => {
    setCustomHex(accentColor);
  }, [accentColor]);

  // Rating systems state
  const [ratingSystems, setRatingSystems] = useState<any[]>([]);
  const [loadingSystems, setLoadingSystems] = useState(false);
  const [editingSystem, setEditingSystem] = useState<any | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryWeight, setNewCategoryWeight] = useState("5");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [systemToDelete, setSystemToDelete] = useState<any | null>(null);
  const [deletingSystemLoading, setDeletingSystemLoading] = useState(false);

  // Profile editing state
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [initialUsername, setInitialUsername] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameReason, setUsernameReason] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordChanging(true);
    setPasswordError(null);
    try {
      const res = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (res?.error) {
        throw new Error(res.error.message || "Failed to update password.");
      }

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: any) {
      setPasswordError(err?.message || "Incorrect current password or update failed.");
    } finally {
      setPasswordChanging(false);
    }
  };

  useEffect(() => {
    fetchRatingSystems();
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setProfileName(data.user.name || "");
          setProfileUsername(data.user.username || "");
          setInitialUsername(data.user.username || "");
          setProfileBio(data.user.bio || "");
          setProfileImage(data.user.image || "");
        }
      }
    } catch (err) {
      console.error("[Fetch Profile Error]", err);
    }
  };

  useEffect(() => {
    const trimmed = profileUsername.trim().toLowerCase();
    if (!trimmed || trimmed === initialUsername) {
      setUsernameAvailable(null);
      setUsernameReason(null);
      return;
    }

    if (trimmed.length < 3) {
      setUsernameAvailable(false);
      setUsernameReason("Must be at least 3 characters.");
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameChecking(true);
      try {
        const res = await fetch(`/api/user/check-username?username=${encodeURIComponent(trimmed)}`);
        const json = await res.json();
        setUsernameAvailable(json.available);
        setUsernameReason(json.reason || null);
      } catch (err) {
        setUsernameAvailable(false);
        setUsernameReason("Failed to verify handle.");
      } finally {
        setUsernameChecking(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [profileUsername, initialUsername]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameAvailable === false) return;

    setProfileSaving(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName.trim(),
          username: profileUsername.trim().toLowerCase() || undefined,
          bio: profileBio.trim(),
          image: profileImage.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update profile.");
      }

      setInitialUsername(json.user?.username || profileUsername);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err?.message || "Failed to save profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  // Letterboxd import state
  const [lbFile, setLbFile] = useState<File | null>(null);
  const [lbPreviewLoading, setLbPreviewLoading] = useState(false);
  const [lbPreviewData, setLbPreviewData] = useState<any | null>(null);
  const [lbImporting, setLbImporting] = useState(false);
  const [lbSuccessMsg, setLbSuccessMsg] = useState<string | null>(null);
  const [lbErrorMsg, setLbErrorMsg] = useState<string | null>(null);

  const handleLbFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLbFile(file);
    setLbErrorMsg(null);
    setLbSuccessMsg(null);
    setLbPreviewLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/letterboxd/preview", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to parse Letterboxd ZIP archive.");
      }

      setLbPreviewData(json);
    } catch (err: any) {
      setLbErrorMsg(err?.message || "Failed to preview Letterboxd archive.");
      setLbPreviewData(null);
    } finally {
      setLbPreviewLoading(false);
    }
  };

  const handleLbExecuteImport = async () => {
    if (!lbFile) return;

    setLbImporting(true);
    setLbErrorMsg(null);
    setLbSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", lbFile);

      const res = await fetch("/api/import/letterboxd/execute", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to execute import.");
      }

      setLbSuccessMsg(json.message || "Import completed successfully!");
      setLbPreviewData(null);
      setLbFile(null);
    } catch (err: any) {
      setLbErrorMsg(err?.message || "Import failed.");
    } finally {
      setLbImporting(false);
    }
  };

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    setProfileError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "avatar");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload avatar");
      }

      setProfileImage(data.url);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3500);
    } catch (err: any) {
      setProfileError(err?.message || "Failed to upload avatar image");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarUploading(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/upload?type=avatar", {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove avatar");
      }
      setProfileImage("");
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3500);
    } catch (err: any) {
      setProfileError(err?.message || "Failed to remove avatar");
    } finally {
      setAvatarUploading(false);
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div>
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">
          Platform Configuration
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight text-foreground mt-1">
          Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage personalized weighted rubrics, critique preferences, and account security.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab("appearance")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeTab === "appearance"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Palette size={14} className={activeTab === "appearance" ? "text-primary" : ""} />
          <span>Appearance</span>
        </button>

        <button
          onClick={() => setActiveTab("rating_systems")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeTab === "rating_systems"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sliders size={14} className={activeTab === "rating_systems" ? "text-primary" : ""} />
          <span>Weighted Rubrics</span>
        </button>

        <button
          onClick={() => setActiveTab("account")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeTab === "account"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <User size={14} className={activeTab === "account" ? "text-primary" : ""} />
          <span>Account & Security</span>
        </button>

        <button
          onClick={() => setActiveTab("data")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeTab === "data"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileSpreadsheet size={14} className={activeTab === "data" ? "text-primary" : ""} />
          <span>Data & Import</span>
        </button>
      </div>

      {/* TAB 0: APPEARANCE & THEME */}
      {activeTab === "appearance" && (
        <div className="space-y-8 max-w-4xl">
          {/* Section: Color Theme Mode */}
          <div className="p-6 rounded-2xl border border-border bg-card space-y-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl uppercase font-bold text-foreground">
                  Theme Mode
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose between cinematic dark, editorial light, or automatic system sync.
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground/80 px-2.5 py-1 rounded-full border border-border bg-muted/40">
                Active: <strong className="text-foreground capitalize">{resolvedTheme}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Dark Option */}
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-36 ${
                  theme === "dark"
                    ? "border-primary ring-2 ring-primary/20 bg-muted/60"
                    : "border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="h-9 w-9 rounded-lg bg-background border border-border flex items-center justify-center text-foreground shadow-sm">
                    <Moon size={18} />
                  </div>
                  {theme === "dark" && (
                    <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    Dark (Cinematic)
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-relaxed block mt-0.5">
                    Original cinema aesthetic with deep black and charcoal tones.
                  </span>
                </div>
              </button>

              {/* Light Option */}
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-36 ${
                  theme === "light"
                    ? "border-primary ring-2 ring-primary/20 bg-muted/60"
                    : "border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="h-9 w-9 rounded-lg bg-background border border-border flex items-center justify-center text-foreground shadow-sm">
                    <Sun size={18} />
                  </div>
                  {theme === "light" && (
                    <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    Light (Editorial)
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-relaxed block mt-0.5">
                    Warm off-white paper, soft white cards, and crisp dark typography.
                  </span>
                </div>
              </button>

              {/* System Option */}
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-36 ${
                  theme === "system"
                    ? "border-primary ring-2 ring-primary/20 bg-muted/60"
                    : "border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="h-9 w-9 rounded-lg bg-background border border-border flex items-center justify-center text-foreground shadow-sm">
                    <Monitor size={18} />
                  </div>
                  {theme === "system" && (
                    <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    System Preference
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-relaxed block mt-0.5">
                    Automatically syncs with your device operating system theme.
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Section: Accent Color */}
          <div className="p-6 rounded-2xl border border-border bg-card space-y-6 shadow-sm">
            <div>
              <h3 className="font-display text-xl uppercase font-bold text-foreground">
                Accent Color
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Customize the interactive highlight color used across buttons, sliders, badges, and your public profile.
              </p>
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Approved Presets
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ACCENT_PRESETS.map((preset) => {
                  const isSelected = accentColor.toUpperCase() === preset.hex.toUpperCase();
                  const [pr, pg, pb] = hexToRgb(preset.hex);
                  const pLum = getRelativeLuminance(pr, pg, pb);
                  const checkFg = pLum > 0.4 ? "#102523" : "#FFFFFF";

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setAccentColor(preset.hex);
                        setCustomHex(preset.hex);
                        setColorError(null);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                        isSelected
                          ? "border-primary bg-muted/60 ring-2 ring-primary/20"
                          : "border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40"
                      }`}
                    >
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-black/15 transition-transform"
                        style={{ backgroundColor: preset.hex }}
                      >
                        {isSelected && (
                          <Check size={14} strokeWidth={3} style={{ color: checkFg }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-foreground block truncate">
                          {preset.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono block">
                          {preset.hex}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Accent Picker */}
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Custom Hex Accent
                </span>
                {colorError && (
                  <span className="text-[11px] text-red-500 font-medium">
                    {colorError}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="relative h-10 w-10 rounded-xl overflow-hidden border border-border shadow-sm shrink-0">
                    <input
                      type="color"
                      value={isValidHexColor(customHex) ? normalizeHexColor(customHex) : "#89D5D5"}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setCustomHex(val);
                        setAccentColor(val);
                        setColorError(null);
                      }}
                      className="absolute -inset-2 h-14 w-14 cursor-pointer opacity-0"
                      title="Choose custom color"
                    />
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundColor: isValidHexColor(customHex)
                          ? normalizeHexColor(customHex)
                          : accentColor,
                      }}
                    />
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      maxLength={7}
                      value={customHex}
                      placeholder="#89D5D5"
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomHex(val);
                        if (isValidHexColor(val)) {
                          setAccentColor(val);
                          setColorError(null);
                        }
                      }}
                      onBlur={() => {
                        if (isValidHexColor(customHex)) {
                          const norm = normalizeHexColor(customHex);
                          setCustomHex(norm);
                          setAccentColor(norm);
                          setColorError(null);
                        } else {
                          setColorError("Invalid hex format. Use #RGB or #RRGGBB.");
                          setCustomHex(accentColor);
                        }
                      }}
                      className="w-28 h-10 px-3 text-xs font-mono font-semibold rounded-xl bg-input border border-input-border text-foreground uppercase focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* WCAG AA Contrast Evaluation Readout */}
                {(() => {
                  const [r, g, b] = hexToRgb(accentColor);
                  const lum = getRelativeLuminance(r, g, b);
                  const fg = getAccessibleForeground(accentColor);
                  const [fr, fgCol, fb] = hexToRgb(fg);
                  const fgLum = getRelativeLuminance(fr, fgCol, fb);
                  const contrast = getContrastRatio(lum, fgLum);
                  const passesAA = contrast >= 4.5;

                  return (
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                        style={{
                          backgroundColor: accentColor,
                          color: fg,
                        }}
                      >
                        Sample Badge
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        WCAG AA Contrast:{" "}
                        <strong className="text-foreground font-mono">
                          {contrast.toFixed(1)}:1
                        </strong>{" "}
                        {passesAA ? (
                          <span className="text-emerald-500 font-semibold">(Pass)</span>
                        ) : (
                          <span className="text-amber-500 font-semibold">(Large text only)</span>
                        )}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Live Interactive Preview Card */}
            <div className="p-5 rounded-xl border border-border bg-background space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles size={14} className="text-primary" />
                  <span>Live Appearance Preview</span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Updates everywhere immediately
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm transition-all"
                >
                  Primary Action Button
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted text-secondary-foreground border border-border transition-all"
                >
                  Secondary Action
                </button>
                <div className="px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-semibold flex items-center gap-1">
                  <span>★ 9.40</span>
                  <span className="opacity-70 font-normal">/ 10</span>
                </div>
              </div>
            </div>

            {/* Reset & Status Footer */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  resetToDefaults();
                  setCustomHex("#89D5D5");
                  setColorError(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Reset to Aubrey Default</span>
              </button>

              <div className="flex items-center gap-2 text-muted-foreground">
                {isSavingTheme ? (
                  <span className="flex items-center gap-1 text-[11px]">
                    <Loader2 size={12} className="animate-spin text-primary" />
                    <span>Saving to profile...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                    <Check size={12} />
                    <span>Appearance saved</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: RATING SYSTEMS */}
      {activeTab === "rating_systems" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: List of Systems */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#28342d]">
              <span className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider">
                Your Rubrics ({ratingSystems.length})
              </span>
              <button
                type="button"
                onClick={handleCreateNewSystem}
                className="text-[11px] font-semibold text-[#89d5d5] hover:text-[#b2e8e8] flex items-center gap-1 cursor-pointer"
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
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#18221c] border-[#89d5d5]/60 shadow-lg shadow-[#89d5d5]/5"
                        : "bg-[#141a17] border-[#2b3730] hover:border-[#3d4f43]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-display text-base font-bold uppercase tracking-tight text-[#f1f0e9] truncate">
                            {sys.name}
                          </h4>
                          {sys.isDefault && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#89d5d5]/15 text-[#89d5d5] border border-[#89d5d5]/30">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8fa095] mt-0.5">
                          {sys.categories?.length || 0} categories · Scale 1–{sys.scale || 10}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#232d26] text-[10px]">
                      {!sys.isDefault && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetDefaultSystem(sys.id);
                          }}
                          className="text-[#8fa095] hover:text-[#89d5d5] transition-colors flex items-center gap-1 cursor-pointer"
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
                        className="text-[#8fa095] hover:text-[#f1f0e9] transition-colors flex items-center gap-1 ml-auto cursor-pointer"
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
                          className="text-[#8fa095] hover:text-red-400 transition-colors p-0.5 cursor-pointer"
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
              <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#28342d] pb-4">
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                      Rubric Name
                    </label>
                    <input
                      type="text"
                      value={editingSystem.name || ""}
                      onChange={(e) =>
                        setEditingSystem({ ...editingSystem, name: e.target.value })
                      }
                      placeholder="e.g. Cinema Criterion, Director Filmography Rubric..."
                      className="w-full text-lg font-display uppercase font-bold px-3 py-1.5 rounded bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5]"
                    />
                  </div>

                  <div className="flex items-end gap-3 shrink-0">
                    <div>
                      <label className="text-[10px] font-semibold text-[#8fa095] uppercase tracking-wider block mb-1">
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
                        className="h-10 px-3 text-xs rounded bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5]"
                      >
                        <option value={10}>Scale 1–10 (Standard)</option>
                        <option value={5}>Scale 1–5</option>
                        <option value={100}>Scale 1–100</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveSystem}
                      className="h-10 px-5 rounded bg-[#89d5d5] hover:bg-[#a5e2e2] text-[#102523] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-[#89d5d5]/10 cursor-pointer"
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
                    <span className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                      Scoring Categories & Multiplier Weights
                    </span>
                    <span className="text-[10px] text-[#6c7d73]">
                      Weights calibrate relative influence on the overall score
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {editingSystem.categories?.map((cat: any) => (
                      <div
                        key={cat.id}
                        className="p-3.5 rounded-lg border border-[#2b3730] bg-[#111613] flex items-center justify-between gap-4"
                      >
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <input
                            type="text"
                            value={cat.name}
                            onChange={(e) =>
                              handleUpdateCategoryName(cat.id, e.target.value)
                            }
                            className="w-full text-xs font-semibold text-[#f1f0e9] bg-transparent border-b border-transparent hover:border-[#3b4c40] focus:border-[#89d5d5] focus:outline-none py-0.5"
                          />
                          <div className="flex items-center gap-3">
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
                          type="button"
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
                    placeholder="New category (e.g. Atmosphere, Pacing, Direction)..."
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
                    type="button"
                    onClick={handleAddCategory}
                    className="px-4 h-9 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Category</span>
                  </button>
                </div>

                {/* Danger Zone: Delete Rubric */}
                {ratingSystems.length > 1 && (
                  <div className="pt-4 border-t border-[#28342d] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-red-400 block">Delete Rating System</span>
                      <span className="text-[#8fa095] text-[11px]">
                        {editingSystem.isDefault
                          ? "This is currently your default rubric. Set another rubric as default before deleting."
                          : "Permanently delete this rubric. Collections using it will revert to your default rubric."}
                      </span>
                    </div>
                    {!editingSystem.isDefault && (
                      <button
                        type="button"
                        onClick={() => setSystemToDelete(editingSystem)}
                        className="px-4 py-2 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
                      >
                        <Trash2 size={13} />
                        <span>Delete Rubric</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center border border-dashed border-[#303b34] rounded-xl text-xs text-[#8fa095]">
                Select a rubric on the left or create a new one to begin editing.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ACCOUNT & SECURITY */}
      {activeTab === "account" && (
        <div className="max-w-2xl space-y-6">
          <form onSubmit={handleSaveProfile} className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-6">
            <div className="flex items-center justify-between border-b border-[#232d27] pb-4">
              <div>
                <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
                  Profile & Identity
                </h3>
                <p className="text-xs text-[#8fa095] mt-0.5">
                  Manage your public handle, display name, and community biography.
                </p>
              </div>
              {initialUsername && (
                <Link
                  href={`/u/${initialUsername}`}
                  className="text-xs text-[#89d5d5] hover:underline flex items-center gap-1 font-mono"
                >
                  <span>/u/{initialUsername}</span>
                </Link>
              )}
            </div>

            {profileError && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="p-3 rounded bg-[#89d5d5]/10 border border-[#89d5d5]/30 text-[#89d5d5] text-xs">
                Profile updated successfully.
              </div>
            )}

            {/* Profile Photo Upload */}
            <div className="space-y-2 pb-2">
              <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                Profile Photo
              </label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-[#1b2520] border-2 border-[#3b4c40] flex items-center justify-center text-[#89d5d5] font-display text-2xl font-bold shrink-0 overflow-hidden relative group">
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{(profileName || session?.user.name || "A").charAt(0).toUpperCase()}</span>
                  )}
                  {avatarUploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 size={18} className="animate-spin text-[#89d5d5]" />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarUploading}
                      className="px-3.5 py-1.5 rounded-md bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Camera size={13} />
                      <span>{avatarUploading ? "Uploading..." : "Upload Photo"}</span>
                    </button>
                    {profileImage && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={avatarUploading}
                        className="px-3 py-1.5 rounded-md text-[#8fa095] hover:text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-[#6c7d73]">
                    Square avatar recommended. JPEG, PNG, or WebP up to 5MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Username Field */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider flex items-center justify-between">
                <span>Unique Handle (@username)</span>
                <span className="text-[10px] text-[#6c7d73]">3–20 chars · a–z, 0–9, _</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-[#6c7d73] font-mono text-xs select-none">
                  @
                </span>
                <input
                  type="text"
                  value={profileUsername}
                  onChange={(e) => setProfileUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                  placeholder="username"
                  maxLength={20}
                  className="w-full text-xs font-mono rounded-lg pl-8 pr-10 py-2.5 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5]"
                />
                <div className="absolute right-3">
                  {usernameChecking ? (
                    <span className="text-[10px] text-[#8fa597] animate-pulse">verifying...</span>
                  ) : usernameAvailable === true ? (
                    <span className="text-[10px] text-[#89d5d5] font-semibold">Available</span>
                  ) : usernameAvailable === false ? (
                    <span className="text-[10px] text-red-400 font-semibold">{usernameReason || "Taken"}</span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                Display Name
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Aubrey"
                className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5]"
              />
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider flex items-center justify-between">
                <span>Biography</span>
                <span className="text-[10px] text-[#6c7d73]">{profileBio.length}/300</span>
              </label>
              <textarea
                value={profileBio}
                onChange={(e) => setProfileBio(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="Write a brief note on your rating philosophy, favorite filmmakers, or sensory preferences..."
                className="w-full text-xs rounded-lg p-3 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5] resize-none"
              />
            </div>

            {/* Email (Read Only) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                Account Email
              </label>
              <input
                defaultValue={session?.user.email || ""}
                disabled
                className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-[#18211d] border border-[#303b34] text-[#6c7d73] cursor-not-allowed"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={profileSaving || usernameAvailable === false}
                className="px-5 py-2.5 rounded-lg bg-[#89d5d5] hover:bg-[#a0dede] text-[#111514] font-display text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
              >
                {profileSaving ? "Saving..." : "Save Profile Changes"}
              </button>
            </div>
          </form>

          {/* Change Password Form */}
          <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#18251e] border border-[#3b4c40] flex items-center justify-center text-[#89d5d5]">
                <KeyRound size={18} />
              </div>
              <div>
                <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
                  Change Password
                </h3>
                <p className="text-xs text-[#8fa095] mt-0.5">
                  Update your Aubrey Rankings account password.
                </p>
              </div>
            </div>

            {passwordError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 rounded-lg bg-[#89d5d5]/10 border border-[#89d5d5]/30 text-[#89d5d5] text-xs flex items-center gap-2">
                <Check size={15} className="shrink-0" />
                <span>Your password has been successfully updated.</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                  Current Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={passwordChanging}
                  className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                    New Password
                  </label>
                  <input
                    type="password"
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={passwordChanging}
                    className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    disabled={passwordChanging}
                    className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5]"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={passwordChanging || !currentPassword || !newPassword}
                  className="px-5 py-2.5 rounded-lg bg-[#89d5d5] hover:bg-[#a0dede] text-[#111514] font-display text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {passwordChanging ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: DATA & IMPORTER */}
      {activeTab === "data" && (
        <div className="max-w-2xl space-y-6">
          {/* SECTION 1: LETTERBOXD ZIP IMPORTER */}
          <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#18251e] border border-[#3b4c40] flex items-center justify-center text-[#89d5d5]">
                  <Film size={20} />
                </div>
                <div>
                  <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
                    Import from Letterboxd
                  </h3>
                  <p className="text-xs text-[#8fa095] mt-0.5">
                    Repeatable, non-destructive import of your watched films, star ratings, diary dates, and reviews.
                  </p>
                </div>
              </div>
              <a
                href="https://letterboxd.com/settings/data/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-[#89d5d5] hover:underline"
              >
                <span>Export Page</span>
                <ExternalLink size={12} />
              </a>
            </div>

            {lbErrorMsg && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {lbErrorMsg}
              </div>
            )}

            {lbSuccessMsg && (
              <div className="p-3 rounded bg-[#89d5d5]/10 border border-[#89d5d5]/30 text-[#89d5d5] text-xs">
                {lbSuccessMsg}
              </div>
            )}

            {/* Upload Area */}
            {!lbPreviewData ? (
              <div className="p-6 rounded-lg border border-dashed border-[#303b34] bg-[#111613] text-center space-y-3">
                <UploadCloud size={28} className="mx-auto text-[#6c7d73]" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#f1f0e9]">
                    Upload your Letterboxd export ZIP
                  </p>
                  <p className="text-[11px] text-[#8fa095]">
                    Download your data ZIP from Letterboxd Settings → Export, then drop it here.
                  </p>
                </div>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleLbFileChange}
                  disabled={lbPreviewLoading}
                  className="block w-full text-xs text-[#8fa095] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-[#3b4c40] file:text-xs file:font-semibold file:bg-[#18211d] file:text-[#89d5d5] hover:file:bg-[#202c25] file:cursor-pointer cursor-pointer"
                />
                {lbPreviewLoading && (
                  <p className="text-xs text-[#89d5d5] animate-pulse">
                    Analyzing Letterboxd archive contents and matching records...
                  </p>
                )}
              </div>
            ) : (
              /* Preview Area */
              <div className="space-y-4 rounded-lg border border-[#232d27] bg-[#111613] p-5">
                <div className="flex items-center justify-between border-b border-[#232d27] pb-3">
                  <div>
                    <h4 className="font-display text-base uppercase font-bold text-[#f1f0e9]">
                      Archive Preview: {lbPreviewData.totalFilms} Films
                    </h4>
                    <p className="text-[11px] text-[#8fa095]">
                      Found {lbPreviewData.totalRatings} star ratings and {lbPreviewData.totalReviews} written reviews.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLbPreviewData(null);
                      setLbFile(null);
                    }}
                    className="text-xs text-[#8fa095] hover:text-[#f1f0e9]"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded bg-[#18211d] border border-[#303b34]">
                    <div className="font-display text-xl font-bold text-[#89d5d5]">
                      {lbPreviewData.newCount}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-[#8fa095]">
                      New to Library
                    </div>
                  </div>
                  <div className="p-3 rounded bg-[#18211d] border border-[#303b34]">
                    <div className="font-display text-xl font-bold text-[#f1f0e9]">
                      {lbPreviewData.existingCount}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-[#8fa095]">
                      Existing / Updated
                    </div>
                  </div>
                  <div className="p-3 rounded bg-[#18211d] border border-[#303b34] col-span-2 sm:col-span-1">
                    <div className="font-display text-xl font-bold text-[#f1f0e9]">
                      {lbPreviewData.totalReviews}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-[#8fa095]">
                      Reviews to Sync
                    </div>
                  </div>
                </div>

                {/* Sample items */}
                {lbPreviewData.sampleFilms?.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <div className="text-[10px] uppercase tracking-wider text-[#6c7d73]">
                      Sample Archive Items:
                    </div>
                    <div className="space-y-1">
                      {lbPreviewData.sampleFilms.slice(0, 5).map((f: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[#141b18]"
                        >
                          <span className="text-[#f1f0e9] font-medium">
                            {f.title} {f.year ? `(${f.year})` : ""}
                          </span>
                          <span className="text-[#89d5d5] font-mono text-[11px]">
                            {f.rating ? `★ ${f.rating.toFixed(1)}/5` : "Watched"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleLbExecuteImport}
                    disabled={lbImporting}
                    className="px-5 py-2.5 rounded-lg bg-[#89d5d5] hover:bg-[#a0dede] text-[#111514] font-display text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {lbImporting ? "Importing Archive..." : "Confirm & Sync into Library"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: AUBREY'S BLACK MIRROR SPREADSHEET IMPORTER */}
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
                rows={4}
                placeholder="Episode, Season, Music, Acting, Cinematography, Writing, Vibes, Notes..."
                className="w-full rounded-lg border border-[#303b34] bg-[#18211d] p-3 text-xs text-[#f1f0e9] placeholder:text-[#6d7e74] focus:outline-none focus:border-[#89d5d5] font-mono resize-none"
              />
              <div className="flex justify-end">
                <button className="px-4 py-2 rounded bg-[#d8e2d8] hover:bg-[#edf5ed] text-[#102523] text-xs font-semibold cursor-pointer">
                  Import Spreadsheet Ratings
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 3: EXPORT */}
          <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-3">
            <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
              Export Your Data
            </h3>
            <p className="text-xs text-[#8fa095]">
              Download your complete library, rating histories, and reviews in JSON format.
            </p>
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40] text-xs font-semibold transition-colors cursor-pointer">
              <Download size={14} />
              <span>Export JSON</span>
            </button>
          </div>
        </div>
      )}

      {/* Delete Rating System Confirmation Modal */}
      {systemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-[#141a17] border border-red-500/30 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
                Delete Rating System
              </h3>
            </div>
            <p className="text-xs text-[#9aa79e] leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-[#f1f0e9]">{systemToDelete.name}</strong>?
              Any collections or entries currently using this rubric will automatically be reassigned to your default rating system. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSystemToDelete(null)}
                disabled={deletingSystemLoading}
                className="px-4 py-2 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#f1f0e9] text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSystem(systemToDelete.id)}
                disabled={deletingSystemLoading}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
