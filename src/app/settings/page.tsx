"use client";

import { useState, useEffect } from "react";
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

  // Profile editing state
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [initialUsername, setInitialUsername] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileImage, setProfileImage] = useState("");
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
    </div>
  );
}
