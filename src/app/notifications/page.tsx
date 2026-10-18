"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import {
  Bell,
  Check,
  CheckCheck,
  Heart,
  MessageSquare,
  UserPlus,
  Tv,
  Film,
  Sparkles,
  ArrowRight,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { getTmdbImageUrl } from "@/lib/tmdb";

interface NotificationItem {
  id: string;
  recipientUserId: string;
  actorUserId?: string | null;
  notificationType: "follow" | "like" | "comment" | "tv_release" | "movie_release" | string;
  collectionId?: string | null;
  mediaItemId?: string | null;
  metadata?: {
    actorName?: string;
    actorUsername?: string;
    actorImage?: string;
    collectionTitle?: string;
    commentPreview?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    episodeTitle?: string;
    movieTitle?: string;
    stillPath?: string;
    posterPath?: string;
    releaseDate?: string;
    message?: string;
    targetUrl?: string;
  } | null;
  readAt?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
  } | null;
}

function formatFullTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!sessionPending && !session) {
      router.push("/login?redirect=/notifications");
    }
  }, [session, sessionPending, router]);

  const loadNotifications = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=50");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
        );
      }
    } catch {
      // Ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkOneRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    );
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      // Ignore
    }
  };

  const displayedList =
    filter === "unread"
      ? notifications.filter((n) => !n.readAt)
      : notifications;

  const renderIcon = (type: string) => {
    switch (type) {
      case "follow":
        return <UserPlus className="w-4 h-4 text-primary" />;
      case "like":
        return <Heart className="w-4 h-4 text-rose-400 fill-rose-400/20" />;
      case "comment":
        return <MessageSquare className="w-4 h-4 text-amber-400 fill-amber-400/20" />;
      case "tv_release":
        return <Tv className="w-4 h-4 text-purple-400" />;
      case "movie_release":
        return <Film className="w-4 h-4 text-emerald-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-primary" />;
    }
  };

  if (sessionPending || (!session && loading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-foreground">
                Activity & Notifications
              </h1>
              {unreadCount > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Social interactions, community activity, and tracked release alerts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-surface-raised text-xs font-semibold text-foreground transition-colors cursor-pointer"
              >
                {markingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="w-3.5 h-3.5 text-primary" />
                )}
                <span>Mark all as read</span>
              </button>
            )}
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 hover:border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Preferences
            </Link>
          </div>
        </header>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-6 mb-4">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`font-display text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filter === "all"
                ? "bg-secondary text-foreground font-bold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Activity ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`font-display text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filter === "unread"
                ? "bg-secondary text-foreground font-bold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span>Loading notifications…</span>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-border/80 rounded-2xl p-8 bg-card/40 my-6">
            <Bell className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3 stroke-[1.5]" />
            <h3 className="font-display text-lg font-bold uppercase text-foreground">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {filter === "unread"
                ? "You're all caught up! Switch to 'All Activity' to review previous updates."
                : "When someone follows you, likes a ranking, comments, or when a tracked show airs a new episode, alerts will appear here."}
            </p>
            {filter === "all" && (
              <Link
                href="/explore"
                className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-primary hover:underline"
              >
                Explore community rankings →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3 my-6">
            {displayedList.map((item) => {
              const isUnread = !item.readAt;
              const meta = item.metadata || {};
              const actorImage = item.actor?.image || meta.actorImage;
              const stillPath = meta.stillPath || meta.posterPath;
              const artworkUrl = stillPath ? getTmdbImageUrl(stillPath, "w300") : null;
              const targetUrl = meta.targetUrl || "/profile";

              return (
                <div
                  key={item.id}
                  className={`group relative rounded-xl border p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isUnread
                      ? "bg-card border-border shadow-sm hover:border-primary/40"
                      : "bg-card/40 border-border/60 hover:border-border hover:bg-card/80"
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Media Artwork / User Avatar */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      {artworkUrl ? (
                        <div className="w-12 h-16 rounded-md overflow-hidden bg-muted border border-border shadow-sm">
                          <img
                            src={artworkUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center font-display font-bold text-sm text-foreground shadow-sm">
                          {actorImage ? (
                            <img
                              src={actorImage}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (meta.actorName || "U").charAt(0).toUpperCase()
                          )}
                        </div>
                      )}
                      <span className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface border border-border flex items-center justify-center shadow-sm">
                        {renderIcon(item.notificationType)}
                      </span>
                    </div>

                    {/* Content Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm leading-snug ${
                            isUnread ? "text-foreground font-semibold" : "text-foreground/90 font-medium"
                          }`}
                        >
                          {meta.message || "New notification"}
                        </p>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>

                      {meta.commentPreview && (
                        <blockquote className="mt-1 text-xs text-muted-foreground border-l-2 border-border pl-2 line-clamp-2 italic">
                          &ldquo;{meta.commentPreview}&rdquo;
                        </blockquote>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span>{formatFullTime(item.createdAt)}</span>
                        {meta.releaseDate && (
                          <>
                            <span>·</span>
                            <span>Aired: {meta.releaseDate}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 sm:self-center flex-shrink-0">
                    <Link
                      href={targetUrl}
                      onClick={() => handleMarkOneRead(item.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-surface-raised text-xs font-medium text-foreground transition-colors"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </Link>

                    {isUnread && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkOneRead(item.id, e)}
                        title="Mark as read"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
