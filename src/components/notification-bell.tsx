"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  Heart,
  MessageSquare,
  UserPlus,
  Tv,
  Film,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
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
  links?: { actorUrl: string | null; contentUrl: string };
}

function formatRelativeTime(dateString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=8");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
      }
    } catch {
      // Ignore background poll errors
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
    }
  };

  const handleNotificationClick = async (item: NotificationItem, destination: string) => {
    // Optimistically mark read
    if (!item.readAt) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id }),
        });
      } catch {
        // Ignore
      }
    }

    setOpen(false);
    router.push(destination);
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case "follow":
        return <UserPlus className="w-3.5 h-3.5 text-primary" />;
      case "like":
        return <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/20" />;
      case "comment":
        return <MessageSquare className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />;
      case "tv_release":
        return <Tv className="w-3.5 h-3.5 text-purple-400" />;
      case "movie_release":
        return <Film className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-primary" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            unreadCount > 0
              ? `Notifications (${unreadCount} unread)`
              : "Notifications"
          }
          className="relative p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-full focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none pointer-events-none shadow-sm"
              title={`${unreadCount} unread`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 bg-card border-border shadow-2xl p-0 overflow-hidden rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                {unreadCount} unread
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer font-medium"
            >
              <Check className="w-3 h-3" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto divide-y divide-border/40">
          {notifications.length === 0 ? (
            <div className="py-12 px-4 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2 stroke-[1.5]" />
              <p className="text-xs font-medium text-foreground">
                No notifications yet
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Activity from followers, likes, comments, and releases will appear here.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const isUnread = !item.readAt;
              const meta = item.metadata || {};
              const actorImage = item.actor?.image || meta.actorImage;
              const stillPath = meta.stillPath || meta.posterPath;
              const artworkUrl = stillPath ? getTmdbImageUrl(stillPath, "w185") : null;

              return (
                <div
                  key={item.id}
                  className={`p-3 flex items-start gap-3 transition-colors group ${
                    isUnread
                      ? "bg-surface-raised/40 hover:bg-surface-raised"
                      : "hover:bg-surface/50"
                  }`}
                >
                  {/* Artwork / Avatar */}
                  <div className="relative flex-shrink-0 mt-0.5">
                    {artworkUrl ? (
                      <div className="w-9 h-12 rounded overflow-hidden bg-muted border border-border">
                        <img
                          src={artworkUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center font-display font-bold text-xs text-foreground">
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
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-card border border-border flex items-center justify-center shadow-sm">
                      {renderIcon(item.notificationType)}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0 text-left">
                    {item.links?.actorUrl && <Link href={item.links.actorUrl} onClick={(event) => { event.preventDefault(); void handleNotificationClick(item, item.links!.actorUrl!); }} className="text-xs font-semibold text-foreground hover:underline">{item.actor?.name || meta.actorName || `@${item.actor?.username}`}</Link>}
                    <button type="button" onClick={() => handleNotificationClick(item, item.links?.contentUrl || "/notifications")}
                      className={`text-xs line-clamp-2 leading-relaxed ${
                        isUnread ? "text-foreground font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {meta.message || "New activity on your account"}
                    </button>
                    <span className="block text-[10px] text-muted-foreground/70 mt-1">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>

                  {/* Unread Pip */}
                  {isUnread && (
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-border bg-surface text-center">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="text-xs text-primary hover:underline font-semibold block py-1"
          >
            View all notifications →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
