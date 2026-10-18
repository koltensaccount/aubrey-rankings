"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSession } from "@/lib/auth-client";
import { Users, UserPlus, UserCheck, Loader2 } from "lucide-react";
import type { SocialUserItem } from "@/lib/social-queries";

interface FollowListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username?: string | null;
  targetName?: string | null;
  initialType?: "followers" | "following";
  onFollowChange?: () => void;
}

export function FollowListDialog({
  open,
  onOpenChange,
  userId,
  username,
  targetName,
  initialType = "followers",
  onFollowChange,
}: FollowListDialogProps) {
  const { data: session } = useSession();
  const [activeType, setActiveType] = useState<"followers" | "following">(initialType);
  const [users, setUsers] = useState<SocialUserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setActiveType(initialType);
    }
  }, [open, initialType]);

  useEffect(() => {
    if (!open) return;

    let isCancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const param = userId ? `userId=${encodeURIComponent(userId)}` : username ? `username=${encodeURIComponent(username)}` : "";
        const endpoint = activeType === "followers" ? "/api/social/followers" : "/api/social/following";
        const res = await fetch(`${endpoint}?${param}`);
        if (!res.ok) throw new Error("Failed to load list");
        const data = await res.json();
        if (!isCancelled) {
          setUsers(data.users || []);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.message || "Failed to load user connections");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [open, activeType, userId, username]);

  const handleToggleFollow = async (item: SocialUserItem) => {
    if (!session?.user?.id || togglingIds[item.id]) return;

    setTogglingIds((prev) => ({ ...prev, [item.id]: true }));
    const currentlyFollowing = item.isFollowing;
    const newFollowingState = !currentlyFollowing;

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === item.id ? { ...u, isFollowing: newFollowingState } : u))
    );

    try {
      const res = await fetch("/api/social/follow", {
        method: currentlyFollowing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: item.id }),
      });

      if (!res.ok) {
        // Rollback
        setUsers((prev) =>
          prev.map((u) => (u.id === item.id ? { ...u, isFollowing: currentlyFollowing } : u))
        );
      } else {
        onFollowChange?.();
      }
    } catch {
      // Rollback
      setUsers((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, isFollowing: currentlyFollowing } : u))
      );
    } finally {
      setTogglingIds((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full bg-card border-border p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveType("followers")}
                className={`font-display text-sm uppercase tracking-wider px-3 py-1.5 rounded transition-colors ${
                  activeType === "followers"
                    ? "bg-secondary text-foreground font-bold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Followers
              </button>
              <button
                type="button"
                onClick={() => setActiveType("following")}
                className={`font-display text-sm uppercase tracking-wider px-3 py-1.5 rounded transition-colors ${
                  activeType === "following"
                    ? "bg-secondary text-foreground font-bold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Following
              </button>
            </div>
          </div>
          <DialogTitle className="sr-only">
            {activeType === "followers" ? "Followers" : "Following"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            List of users {activeType === "followers" ? "following this account" : "this account follows"}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 min-h-[220px] max-h-[380px] overflow-y-auto pr-1">
          {loading ? (
            <div className="h-44 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span>Loading connections…</span>
            </div>
          ) : error ? (
            <div className="h-44 flex flex-col items-center justify-center gap-2 text-destructive text-xs text-center px-4">
              <span>{error}</span>
            </div>
          ) : users.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
              <Users className="w-8 h-8 stroke-[1.5] text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">
                {activeType === "followers" ? "No followers yet" : "Not following anyone yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {activeType === "followers"
                  ? "When other members follow this account, they will appear here."
                  : "Discover curators and rankings across the Aubrey community."}
              </p>
              <Link
                href="/explore"
                onClick={() => onOpenChange(false)}
                className="mt-3 text-xs text-primary hover:underline font-semibold"
              >
                Explore community rankings →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {users.map((item) => {
                const initial = (item.name || item.username || "U").charAt(0).toUpperCase();
                const hasValidUsername = !!(item.username && item.username.trim().length > 0);
                const profileHref = hasValidUsername ? `/u/${encodeURIComponent(item.username!)}` : null;

                return (
                  <li
                    key={item.id}
                    className="py-3 flex items-center justify-between gap-3 group transition-colors hover:bg-surface-raised/40 px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {profileHref ? (
                        <Link
                          href={profileHref}
                          onClick={() => onOpenChange(false)}
                          className="w-10 h-10 rounded-full overflow-hidden border border-border bg-muted flex-shrink-0 flex items-center justify-center text-foreground font-display font-bold text-sm hover:ring-2 hover:ring-primary/40 transition-all"
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            initial
                          )}
                        </Link>
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full overflow-hidden border border-border/80 bg-muted/60 flex-shrink-0 flex items-center justify-center text-muted-foreground font-display font-bold text-sm"
                          title="This curator has not completed public profile onboarding yet"
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover opacity-80"
                            />
                          ) : (
                            initial
                          )}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        {profileHref ? (
                          <Link
                            href={profileHref}
                            onClick={() => onOpenChange(false)}
                            className="block font-medium text-foreground text-sm hover:text-primary transition-colors truncate"
                          >
                            {item.name || (item.username ? `@${item.username}` : "Member")}
                          </Link>
                        ) : (
                          <span
                            className="block font-medium text-foreground text-sm truncate"
                            title="This curator has not completed public profile onboarding yet"
                          >
                            {item.name || "Member"}
                          </span>
                        )}

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {hasValidUsername ? (
                            <span className="truncate">@{item.username}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/60">
                              Awaiting Onboarding
                            </span>
                          )}
                        </div>

                        {item.bio && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {item.bio}
                          </p>
                        )}
                      </div>
                    </div>

                    {session?.user && !item.isSelf && (
                      <button
                        type="button"
                        onClick={() => handleToggleFollow(item)}
                        disabled={togglingIds[item.id]}
                        className={`text-xs px-3 py-1.5 rounded font-semibold transition-all flex items-center gap-1.5 flex-shrink-0 ${
                          item.isFollowing
                            ? "bg-secondary text-secondary-foreground hover:bg-destructive/15 hover:text-destructive border border-border"
                            : "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm"
                        }`}
                      >
                        {togglingIds[item.id] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : item.isFollowing ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Following</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Follow</span>
                          </>
                        )}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
