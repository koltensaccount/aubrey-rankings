"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession, authClient } from "@/lib/auth-client";
import {
  Camera,
  KeyRound,
  Loader2,
  Check,
  AlertTriangle,
} from "lucide-react";

export function AccountTab() {
  const { data: session } = useSession();

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

  useEffect(() => {
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
      } catch {
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

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile & Identity Form */}
      <form onSubmit={handleSaveProfile} className="p-6 rounded-card border border-border-card bg-card space-y-6 shadow-card">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h3 className="font-display text-xl uppercase font-bold text-foreground">
              Profile & Identity
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your public handle, display name, and community biography.
            </p>
          </div>
          {initialUsername && (
            <Link
              href={`/u/${initialUsername}`}
              className="text-xs text-primary hover:underline flex items-center gap-1 font-mono"
            >
              <span>/u/{initialUsername}</span>
            </Link>
          )}
        </div>

        {profileError && (
          <div className="p-3 rounded-card bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {profileError}
          </div>
        )}

        {profileSuccess && (
          <div className="p-3 rounded-card bg-primary/10 border border-primary/30 text-primary text-xs">
            Profile updated successfully.
          </div>
        )}

        {/* Profile Photo Upload */}
        <div className="space-y-2 pb-2">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Profile Photo
          </label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-surface-elevated border-2 border-border flex items-center justify-center text-primary font-display text-2xl font-bold shrink-0 overflow-hidden relative group">
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
                  <Loader2 size={18} className="animate-spin text-primary" />
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
                  className="px-3.5 py-1.5 rounded-button bg-surface-elevated hover:bg-muted text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Camera size={13} />
                  <span>{avatarUploading ? "Uploading..." : "Upload Photo"}</span>
                </button>
                {profileImage && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={avatarUploading}
                    className="px-3 py-1.5 rounded-button text-muted-foreground hover:text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/80">
                Square avatar recommended. JPEG, PNG, or WebP up to 5MB.
              </p>
            </div>
          </div>
        </div>

        {/* Username Field */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Unique Handle (@username)</span>
            <span className="text-[10px] text-muted-foreground/70">3–20 chars · a–z, 0–9, _</span>
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-muted-foreground font-mono text-xs select-none">
              @
            </span>
            <input
              type="text"
              value={profileUsername}
              onChange={(e) => setProfileUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
              placeholder="username"
              maxLength={20}
              className="w-full text-xs font-mono rounded-input pl-8 pr-10 py-2.5 bg-surface border border-border-input text-foreground focus:outline-none focus:border-primary"
            />
            <div className="absolute right-3">
              {usernameChecking ? (
                <span className="text-[10px] text-muted-foreground animate-pulse">verifying...</span>
              ) : usernameAvailable === true ? (
                <span className="text-[10px] text-primary font-semibold">Available</span>
              ) : usernameAvailable === false ? (
                <span className="text-[10px] text-red-400 font-semibold">{usernameReason || "Taken"}</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Display Name */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Display Name
          </label>
          <input
            type="text"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Aubrey"
            className="w-full text-xs rounded-input px-3.5 py-2.5 bg-surface border border-border-input text-foreground focus:outline-none focus:border-primary"
          />
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Biography</span>
            <span className="text-[10px] text-muted-foreground/70">{profileBio.length}/300</span>
          </label>
          <textarea
            value={profileBio}
            onChange={(e) => setProfileBio(e.target.value.slice(0, 300))}
            rows={3}
            placeholder="Write a brief note on your rating philosophy, favorite filmmakers, or sensory preferences..."
            className="w-full text-xs rounded-input p-3 bg-surface border border-border-input text-foreground focus:outline-none focus:border-primary resize-none"
          />
        </div>

        {/* Email (Read Only) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Account Email
          </label>
          <input
            defaultValue={session?.user.email || ""}
            disabled
            className="w-full text-xs rounded-input px-3.5 py-2.5 bg-surface border border-border-input text-muted-foreground cursor-not-allowed"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={profileSaving || usernameAvailable === false}
            className="px-5 py-2.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-display text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {profileSaving ? "Saving..." : "Save Profile Changes"}
          </button>
        </div>
      </form>

      {/* Change Password Form */}
      <div className="p-6 rounded-card border border-border-card bg-card space-y-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-button bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <KeyRound size={18} />
          </div>
          <div>
            <h3 className="font-display text-xl uppercase font-bold text-foreground">
              Change Password
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Update your Aubrey Rankings account password.
            </p>
          </div>
        </div>

        {passwordError && (
          <div className="p-3 rounded-card bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>{passwordError}</span>
          </div>
        )}

        {passwordSuccess && (
          <div className="p-3 rounded-card bg-primary/10 border border-primary/30 text-primary text-xs flex items-center gap-2">
            <Check size={15} className="shrink-0" />
            <span>Your password has been successfully updated.</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Current Password
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={passwordChanging}
              className="w-full text-xs rounded-input px-3.5 py-2.5 bg-surface border border-border-input text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                New Password
              </label>
              <input
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={passwordChanging}
                className="w-full text-xs rounded-input px-3.5 py-2.5 bg-surface border border-border-input text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Repeat new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                disabled={passwordChanging}
                className="w-full text-xs rounded-input px-3.5 py-2.5 bg-surface border border-border-input text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={passwordChanging || !currentPassword || !newPassword}
              className="px-5 py-2.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-display text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2 shadow-sm"
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
  );
}
