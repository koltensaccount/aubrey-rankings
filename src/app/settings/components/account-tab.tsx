"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession, authClient } from "@/lib/auth-client";
import {
  Camera,
  KeyRound,
  Loader2,
  Check,
  AlertTriangle,
  Link2,
  ShieldCheck,
  Mail,
  AlertCircle,
} from "lucide-react";

export function AccountTab() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  // Profile editing state
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [initialUsername, setInitialUsername] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [profileEmailVerified, setProfileEmailVerified] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameReason, setUsernameReason] = useState<string | null>(null);

  // Email verification state
  const [verificationResending, setVerificationResending] = useState(false);
  const [verificationResendSuccess, setVerificationResendSuccess] = useState<string | null>(null);
  const [verificationResendError, setVerificationResendError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Connected accounts state
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectSuccess, setConnectSuccess] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [googleAvailable, setGoogleAvailable] = useState<boolean | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
    fetchAccounts();

    fetch("/api/auth/providers")
      .then((res) => res.json())
      .then((data) => setGoogleAvailable(Boolean(data?.google)))
      .catch(() => setGoogleAvailable(false));
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
          setProfileEmailVerified(Boolean(data.user.emailVerified));
          return data.user;
        }
      }
    } catch (err) {
      console.error("[Fetch Profile Error]", err);
    }
    return null;
  };

  const fetchAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const res = await authClient.listAccounts();
      if (res?.data && Array.isArray(res.data)) {
        setAccounts(res.data);
        return res.data;
      }
    } catch (err) {
      console.error("[List Accounts Error]", err);
    } finally {
      setLoadingAccounts(false);
    }
    return null;
  };

  // Cooldown countdown timer for resend verification
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Handle URL callback parameters for linking and verification
  useEffect(() => {
    const linked = searchParams.get("linked");
    const errorParam = searchParams.get("error");
    const verifiedParam = searchParams.get("verified");

    if (linked === "google") {
      fetchAccounts()
        .then((accountList) => {
          if (accountList && accountList.some((a: any) => a.providerId === "google")) {
            setConnectSuccess(
              "Google account successfully connected! You can now sign in using either Google or your email/password."
            );
            setConnectError(null);
          } else {
            setConnectError("Could not confirm Google account connection. The account may not have been linked.");
            setConnectSuccess(null);
          }
        })
        .catch(() => {
          setConnectError("Failed to verify connected accounts status. Please refresh the page.");
          setConnectSuccess(null);
        });
      cleanUrlParam("linked");
    } else if (errorParam) {
      if (errorParam === "account_already_linked" || errorParam === "account_already_linked_to_different_user") {
        setConnectError("This Google account is already linked to another Aubrey Rankings user.");
      } else if (errorParam === "email_does_not_match") {
        setConnectError(
          "The Google account email does not match your Aubrey account email. Third-party accounts must share the same email address."
        );
      } else if (errorParam === "access_denied") {
        setConnectError("Google account connection was canceled.");
      } else {
        setConnectError("Google account connection could not be completed. Please try again.");
      }
      setConnectSuccess(null);
      cleanUrlParam("error");
    }

    if (verifiedParam === "1") {
      fetchProfile()
        .then((userData) => {
          if (userData && Boolean(userData.emailVerified)) {
            setProfileEmailVerified(true);
            setVerificationResendSuccess("Your email address was successfully verified!");
            setVerificationResendError(null);
          } else {
            setVerificationResendError(
              "Email verification could not be confirmed. Please request a new verification email."
            );
            setVerificationResendSuccess(null);
          }
        })
        .catch(() => {
          setVerificationResendError("Failed to check email verification status.");
          setVerificationResendSuccess(null);
        });
      cleanUrlParam("verified");
    }
  }, [searchParams]);

  const cleanUrlParam = (paramName: string) => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has(paramName)) {
        url.searchParams.delete(paramName);
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") + url.hash);
      }
    } catch {}
  };

  const handleResendVerification = async () => {
    const emailToVerify = session?.user?.email;
    if (!emailToVerify || verificationResending || resendCooldown > 0) return;

    setVerificationResending(true);
    setVerificationResendError(null);
    setVerificationResendSuccess(null);

    try {
      const res = await authClient.sendVerificationEmail({
        email: emailToVerify,
        callbackURL: "/settings?tab=account&verified=1",
      });

      if (res?.error) {
        setVerificationResendError(res.error.message || "Failed to send verification email. Please try again later.");
      } else {
        setVerificationResendSuccess("Verification email sent! Please check your inbox and spam folder.");
        setResendCooldown(60);
      }
    } catch (err: any) {
      setVerificationResendError(err?.message || "Failed to send verification email.");
    } finally {
      setVerificationResending(false);
    }
  };

  const handleConnectGoogle = async () => {
    setConnectError(null);
    setConnectSuccess(null);

    if (googleAvailable === false) {
      setConnectError("Google authentication is not configured on this instance.");
      return;
    }

    setConnectLoading(true);
    try {
      const res = await authClient.linkSocial({
        provider: "google",
        callbackURL: window.location.origin + "/settings?tab=account&linked=google",
        errorCallbackURL: window.location.origin + "/settings?tab=account",
      });

      if (res?.error) {
        setConnectError(res.error.message || "Failed to initiate Google connection.");
        setConnectLoading(false);
      }
    } catch (err: any) {
      setConnectError(err?.message || "An unexpected error occurred while connecting Google.");
      setConnectLoading(false);
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
          <div className="p-3 rounded-card bg-destructive/10 border border-destructive/20 text-destructive text-xs">
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
                    className="px-3 py-1.5 rounded-button text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors cursor-pointer"
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
                <span className="text-[10px] text-destructive font-semibold">{usernameReason || "Taken"}</span>
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

        {/* Email Field with Verification Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Account Email
            </label>
            <div>
              {profileEmailVerified ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary-text border border-primary/25">
                  <ShieldCheck size={12} />
                  <span>Verified</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-elevated text-muted-foreground border border-border">
                  <AlertCircle size={12} />
                  <span>Unverified</span>
                </span>
              )}
            </div>
          </div>
          <input
            defaultValue={session?.user.email || ""}
            disabled
            className="w-full text-xs rounded-input px-3.5 py-2.5 bg-surface border border-border-input text-muted-foreground cursor-not-allowed"
          />

          {!profileEmailVerified && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-card bg-surface-elevated border border-border text-xs text-foreground">
              <div className="space-y-0.5">
                <span className="font-semibold block">Email verification required for automatic linking</span>
                <p className="text-[11px] text-muted-foreground">
                  Verify your email to protect your Aubrey account and enable one-click Google Sign-In.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={verificationResending || resendCooldown > 0}
                className="shrink-0 px-3 py-1.5 rounded-button bg-surface hover:bg-surface-elevated border border-border hover:border-primary/50 text-foreground hover:text-primary-text font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {verificationResending ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 size={13} className="animate-spin" />
                    Sending...
                  </span>
                ) : resendCooldown > 0 ? (
                  `Resend in ${resendCooldown}s`
                ) : (
                  "Resend Verification Email"
                )}
              </button>
            </div>
          )}

          {verificationResendSuccess && (
            <div className="p-3 rounded-card bg-primary/10 border border-primary/25 text-primary-text text-xs flex items-center gap-2">
              <Check size={14} className="shrink-0" />
              <span>{verificationResendSuccess}</span>
            </div>
          )}

          {verificationResendError && (
            <div className="p-3 rounded-card bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{verificationResendError}</span>
            </div>
          )}
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

      {/* Connected Accounts Section */}
      <div className="p-6 rounded-card border border-border-card bg-card space-y-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-button bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Link2 size={18} />
          </div>
          <div>
            <h3 className="font-display text-xl uppercase font-bold text-foreground">
              Connected Accounts
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage third-party authentication providers linked to your Aubrey Rankings account.
            </p>
          </div>
        </div>

        {connectSuccess && (
          <div className="p-3 rounded-card bg-primary/10 border border-primary/25 text-primary-text text-xs flex items-center gap-2">
            <Check size={14} className="shrink-0" />
            <span>{connectSuccess}</span>
          </div>
        )}

        {connectError && (
          <div className="p-3 rounded-card bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{connectError}</span>
          </div>
        )}

        <div className="divide-y divide-border border border-border rounded-card bg-surface/40 overflow-hidden">
          {/* Google Row */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-sm">Google</span>
                  {accounts.some((a) => a.providerId === "google") ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary-text border border-primary/25">
                      <Check size={11} />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-elevated text-muted-foreground border border-border">
                      Not Connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {accounts.some((a) => a.providerId === "google")
                    ? `Linked to your Google identity (${session?.user?.email || "Google account"}). You can sign in with either method.`
                    : `Connect your Google account (${session?.user?.email}) for secure, one-click sign in.`}
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center">
              {loadingAccounts ? (
                <div className="text-muted-foreground text-xs flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : accounts.some((a) => a.providerId === "google") ? (
                <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-button bg-surface border border-border">
                  <ShieldCheck size={14} className="text-primary" />
                  <span>Connected</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={connectLoading || googleAvailable === false}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {connectLoading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <span>Connect Google</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

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
          <div className="p-3 rounded-card bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
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
