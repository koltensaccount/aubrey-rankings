"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  MessageSquare,
  Lock,
  Eye,
  EyeOff,
  UserX,
  Loader2,
  Check,
  AlertCircle,
  FileText,
  Trash2,
} from "lucide-react";

interface BlockedUser {
  id: string;
  userId: string;
  name: string;
  username: string | null;
  image: string | null;
  blockedAt: string;
}

export function PrivacyTab() {
  const [commentPermission, setCommentPermission] = useState<"everyone" | "following" | "nobody">("everyone");
  const [defaultReviewVisibility, setDefaultReviewVisibility] = useState<"private" | "unlisted" | "public">("private");
  const [defaultReviewSpoiler, setDefaultReviewSpoiler] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacySuccess, setPrivacySuccess] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPrivacyData();
  }, []);

  const fetchPrivacyData = async () => {
    setLoading(true);
    try {
      const [privacyRes, blockedRes] = await Promise.all([
        fetch("/api/user/privacy"),
        fetch("/api/social/block"),
      ]);

      if (privacyRes.ok) {
        const pData = await privacyRes.json();
        if (pData.privacy) {
          setCommentPermission(pData.privacy.commentPermission || "everyone");
          setDefaultReviewVisibility(pData.privacy.defaultReviewVisibility || "private");
          setDefaultReviewSpoiler(Boolean(pData.privacy.defaultReviewSpoiler));
        }
      }

      if (blockedRes.ok) {
        const bData = await blockedRes.json();
        setBlockedUsers(bData.blockedUsers || []);
      }
    } catch (err: any) {
      setError("Failed to load privacy settings");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrivacy = async (updates: Partial<{
    commentPermission: "everyone" | "following" | "nobody";
    defaultReviewVisibility: "private" | "unlisted" | "public";
    defaultReviewSpoiler: boolean;
  }>) => {
    setSavingPrivacy(true);
    setError(null);
    try {
      const res = await fetch("/api/user/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        throw new Error("Failed to save changes");
      }

      if (updates.commentPermission) setCommentPermission(updates.commentPermission);
      if (updates.defaultReviewVisibility) setDefaultReviewVisibility(updates.defaultReviewVisibility);
      if (updates.defaultReviewSpoiler !== undefined) setDefaultReviewSpoiler(updates.defaultReviewSpoiler);

      setPrivacySuccess(true);
      setTimeout(() => setPrivacySuccess(false), 2500);
    } catch (err: any) {
      setError(err?.message || "Failed to update settings");
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleUnblock = async (targetUserId: string) => {
    setUnblockingId(targetUserId);
    try {
      const res = await fetch("/api/social/block", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });

      if (res.ok) {
        setBlockedUsers((prev) => prev.filter((b) => b.userId !== targetUserId));
      }
    } catch {
      // Ignore
    } finally {
      setUnblockingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-xs">Loading safety settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Toast Banner */}
      {privacySuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <Check size={14} />
          <span>Safety and privacy preferences updated successfully.</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* 1. COMMENT PERMISSIONS */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-foreground pb-2 border-b border-border">
          <MessageSquare size={16} className="text-primary" />
          <h2 className="font-display text-lg uppercase font-bold tracking-tight">
            Comment Eligibility
          </h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Control who is allowed to comment on your published rankings and reviews. Content authors always retain moderation rights over their own discussions.
        </p>

        <div className="space-y-2 pt-1">
          {[
            {
              id: "everyone",
              title: "Everyone on Aubrey",
              description: "Any authenticated community member can comment on your public content.",
            },
            {
              id: "following",
              title: "Curators You Follow",
              description: "Only curators you follow can comment on your rankings and reviews. Unfollowed curators cannot comment.",
            },
            {
              id: "nobody",
              title: "Nobody (Disabled)",
              description: "Completely disable comments across all your rankings and reviews.",
            },
          ].map((opt) => (
            <label
              key={opt.id}
              className={`flex items-start gap-3 p-3.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                commentPermission === opt.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card/60 text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <input
                type="radio"
                name="commentPermission"
                value={opt.id}
                checked={commentPermission === opt.id}
                onChange={() => handleUpdatePrivacy({ commentPermission: opt.id as any })}
                className="sr-only"
              />
              <div
                className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  commentPermission === opt.id
                    ? "border-primary bg-primary text-background"
                    : "border-muted-foreground"
                }`}
              >
                {commentPermission === opt.id && (
                  <div className="w-1.5 h-1.5 rounded-full bg-background" />
                )}
              </div>
              <div className="space-y-0.5">
                <span className="font-semibold text-foreground block">{opt.title}</span>
                <span className="text-[11px] text-muted-foreground block leading-relaxed">
                  {opt.description}
                </span>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* 2. REVIEW & SPOILER DEFAULTS */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-foreground pb-2 border-b border-border">
          <EyeOff size={16} className="text-primary" />
          <h2 className="font-display text-lg uppercase font-bold tracking-tight">
            Review & Spoiler Defaults
          </h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Configure default privacy safeguards for newly created reviews. New reviews default to Private to ensure drafts remain unlisted until you explicitly choose to publish them.
        </p>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
              Default Review State
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: "private",
                  label: "Private / Draft",
                  desc: "Visible only to you.",
                  icon: Lock,
                },
                {
                  id: "unlisted",
                  label: "Unlisted",
                  desc: "Accessible only via direct link.",
                  icon: EyeOff,
                },
                {
                  id: "public",
                  label: "Public",
                  desc: "Appears in community feeds.",
                  icon: Eye,
                },
              ].map((vis) => {
                const Icon = vis.icon;
                const isSelected = defaultReviewVisibility === vis.id;
                return (
                  <button
                    key={vis.id}
                    type="button"
                    onClick={() => handleUpdatePrivacy({ defaultReviewVisibility: vis.id as any })}
                    className={`p-3 rounded-lg border text-left transition-colors flex flex-col justify-between gap-2 ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card/60 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon size={14} className={isSelected ? "text-primary" : "text-muted-foreground"} />
                      {isSelected && <Check size={12} className="text-primary" />}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-foreground block">{vis.label}</span>
                      <span className="text-[10px] text-muted-foreground">{vis.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground block">
                Default Spoiler Flag
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Automatically mark new review text as a spoiler requiring reader confirmation to reveal.
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleUpdatePrivacy({ defaultReviewSpoiler: !defaultReviewSpoiler })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                defaultReviewSpoiler ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  defaultReviewSpoiler ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 3. BLOCKED ACCOUNTS */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-foreground pb-2 border-b border-border">
          <UserX size={16} className="text-destructive" />
          <h2 className="font-display text-lg uppercase font-bold tracking-tight">
            Blocked Accounts
          </h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Blocked accounts cannot follow you, comment on your content, like your rankings, or see your activity in their feeds. Unblocking restores normal community permissions immediately.
        </p>

        {blockedUsers.length === 0 ? (
          <div className="p-8 text-center rounded-lg border border-dashed border-border text-muted-foreground text-xs">
            You haven't blocked any accounts.
          </div>
        ) : (
          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {blockedUsers.map((b) => (
              <div key={b.id} className="p-3.5 flex items-center justify-between gap-3 bg-card/60">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs overflow-hidden">
                    {b.image ? (
                      <img src={b.image} alt={b.name} className="h-full w-full object-cover" />
                    ) : (
                      (b.name || "U").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-xs text-foreground block">{b.name}</span>
                    {b.username && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        @{b.username}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleUnblock(b.userId)}
                  disabled={unblockingId === b.userId}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
                >
                  {unblockingId === b.userId ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    "Unblock"
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. ACCOUNT CONTROLS & DATA PORTABILITY DOCUMENTATION */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-foreground pb-2 border-b border-border">
          <Shield size={16} className="text-primary" />
          <h2 className="font-display text-lg uppercase font-bold tracking-tight">
            Account Controls & Data Portability
          </h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Aubrey Rankings maintains strict user data sovereignty. The following controls are documented for future release stages:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 rounded-lg border border-border bg-surface/50 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Lock size={13} className="text-primary" />
              <span>Session Management</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              View active sessions and IP locations across your devices, with one-click revocation of foreign sessions.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-border bg-surface/50 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <FileText size={13} className="text-primary" />
              <span>Data Export Archive</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Request a comprehensive JSON/CSV export of all your rankings, ratings, rubric scores, reviews, and comments.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-border bg-surface/50 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
              <Trash2 size={13} className="text-destructive" />
              <span>Account Deletion</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Permanent, irrevocable deletion of your account profile, personal collections, ratings, and social relationships.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
