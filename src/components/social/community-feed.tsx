"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Globe,
  Users,
  Film,
  Tv,
  Star,
  MessageSquare,
  ArrowRight,
  Loader2,
  Compass,
  Bookmark,
  Heart,
} from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { getMediaArtworkAspect } from "@/lib/artwork";
import { LikeButton } from "@/components/social/like-button";
import { SaveRankingButton } from "@/components/social/save-ranking-button";
import { SpoilerConcealedText } from "@/components/reviews/spoiler-concealed-text";

export interface FeedAuthor {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
}

export interface FeedRanking {
  id: string;
  title: string;
  description: string | null;
  collectionType: string;
  customCoverImage: string | null;
  backdropImage: string | null;
  entriesCount: number;
  topEntries: Array<{
    id?: string;
    title?: string;
    posterPath?: string | null;
    stillPath?: string | null;
  }>;
  averageScore: string | null;
}

export interface FeedReview {
  id: string;
  title?: string | null;
  reviewText: string;
  isSpoiler?: boolean;
  score: number | null;
  scale: number;
  watchDate: string | null;
}

export interface FeedMediaItem {
  id: string;
  title: string;
  mediaType: string;
  posterPath?: string | null;
  stillPath?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}

export interface FeedItem {
  type: "ranking" | "review";
  id: string;
  contentId: string;
  timestamp: string;
  author: FeedAuthor;
  ranking?: FeedRanking;
  stats?: {
    likeCount: number;
    saveCount: number;
    commentCount: number;
    isLiked: boolean;
    isSaved: boolean;
  };
  review?: FeedReview;
  mediaItem?: FeedMediaItem;
  collection?: {
    id: string;
    title: string;
  };
}

interface CommunityFeedProps {
  initialMode?: "following" | "discover";
  isAuthenticated?: boolean;
}

export function CommunityFeed({
  initialMode = "discover",
  isAuthenticated = false,
}: CommunityFeedProps) {
  const [mode, setMode] = useState<"following" | "discover">(
    isAuthenticated ? "following" : "discover"
  );
  const [filter, setFilter] = useState<"all" | "rankings" | "reviews">("all");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/social/feed?mode=${mode}&filter=${filter}&limit=30`
      );
      if (!res.ok) {
        throw new Error("Failed to load community feed");
      }
      const data = await res.json();
      setItems(data.items || []);
      setEmptyReason(data.emptyReason || null);
    } catch (err: any) {
      setError(err?.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [mode, filter]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const formatFeedTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <section className="space-y-6">
      {/* Feed Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        {/* Mode Switcher: Following vs Discover */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-border">
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setMode("following")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                mode === "following"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users size={13} />
              <span>Following</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMode("discover")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              mode === "discover"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Compass size={13} />
            <span>Discover</span>
          </button>
        </div>

        {/* Filter Pills: All | Rankings | Reviews */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              filter === "all"
                ? "bg-surface-raised border border-border text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Activity
          </button>
          <button
            type="button"
            onClick={() => setFilter("rankings")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              filter === "rankings"
                ? "bg-surface-raised border border-border text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Rankings
          </button>
          <button
            type="button"
            onClick={() => setFilter("reviews")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              filter === "reviews"
                ? "bg-surface-raised border border-border text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Reviews
          </button>
        </div>
      </div>

      {/* Feed Stream */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs">Loading community activity...</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-xl border border-border bg-card text-xs text-destructive space-y-3">
          <p>{error}</p>
          <button
            type="button"
            onClick={loadFeed}
            className="px-4 py-2 rounded-button bg-surface border border-border text-xs text-foreground font-semibold hover:bg-surface-raised transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        /* Honest Understandable Empty States */
        <div className="p-10 text-center rounded-xl border border-border bg-card space-y-4">
          {mode === "following" && emptyReason === "no_following" ? (
            <div className="max-w-md mx-auto space-y-3">
              <Users className="w-8 h-8 text-muted-foreground mx-auto" />
              <h3 className="font-display text-xl uppercase font-bold text-foreground">
                You aren&apos;t following anyone yet
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Follow fellow curators, critics, and cinephiles to see their new public rankings and published reviews in your personal stream.
              </p>
              <div className="pt-2">
                <Link
                  href="/explore?tab=people"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs transition-colors"
                >
                  <span>Find Curators in Explore</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          ) : mode === "following" ? (
            <div className="max-w-md mx-auto space-y-2">
              <Compass className="w-8 h-8 text-muted-foreground mx-auto" />
              <h3 className="font-display text-xl uppercase font-bold text-foreground">
                No recent activity from your network
              </h3>
              <p className="text-xs text-muted-foreground">
                The people you follow haven&apos;t published new rankings or reviews recently. Switch to Discover to view platform-wide activity.
              </p>
              <button
                type="button"
                onClick={() => setMode("discover")}
                className="mt-2 text-xs text-primary font-semibold hover:underline cursor-pointer"
              >
                Switch to Discover
              </button>
            </div>
          ) : (
            <div className="max-w-md mx-auto space-y-2">
              <Globe className="w-8 h-8 text-muted-foreground mx-auto" />
              <h3 className="font-display text-xl uppercase font-bold text-foreground">
                No public community content found
              </h3>
              <p className="text-xs text-muted-foreground">
                Be the first to publish a ranking canon or critical review.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item) => {
            const authorInitial = (
              item.author.name ||
              item.author.username ||
              "U"
            )
              .charAt(0)
              .toUpperCase();

            const profileHref = item.author.username
              ? `/u/${item.author.username}`
              : null;

            if (item.type === "ranking" && item.ranking) {
              const rk = item.ranking;
              return (
                <article
                  key={item.id}
                  className="rounded-card border border-border-card bg-card p-5 sm:p-6 space-y-4 hover:border-border transition-colors shadow-sm"
                >
                  {/* Author Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {profileHref ? (
                        <Link
                          href={profileHref}
                          className="h-8 w-8 rounded-full bg-surface border border-border flex items-center justify-center text-xs font-semibold text-primary-text hover:border-primary transition-colors shrink-0 overflow-hidden"
                        >
                          {item.author.image ? (
                            <img
                              src={item.author.image}
                              alt={item.author.name || "Critic"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            authorInitial
                          )}
                        </Link>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-surface border border-border flex items-center justify-center text-xs font-semibold text-primary-text shrink-0">
                          {authorInitial}
                        </div>
                      )}

                      <div className="text-xs">
                        <div className="flex items-center gap-1.5">
                          {profileHref ? (
                            <Link
                              href={profileHref}
                              className="font-semibold text-foreground hover:text-primary-text transition-colors"
                            >
                              {item.author.name || `@${item.author.username}`}
                            </Link>
                          ) : (
                            <span className="font-semibold text-foreground">
                              {item.author.name || "Critic"}
                            </span>
                          )}
                          {item.author.username && (
                            <span className="text-muted-foreground">@{item.author.username}</span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          published a ranking · {formatFeedTime(item.timestamp)}
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface border border-border text-muted-foreground">
                      {rk.collectionType === "tv_show" ? "TV Series" : "Franchise"}
                    </span>
                  </div>

                  {/* Ranking Body Link */}
                  <Link
                    href={`/collection/${rk.id}`}
                    className="block space-y-3 group"
                  >
                    <div>
                      <h3 className="font-display text-2xl uppercase font-bold text-foreground group-hover:text-primary-text transition-colors">
                        {rk.title}
                      </h3>
                      {rk.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {rk.description}
                        </p>
                      )}
                    </div>

                    {/* Top Entries Peek */}
                    {rk.topEntries.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                        {rk.topEntries.map((entry, idx) => {
                          return (
                            <div
                              key={entry.id || idx}
                              className="rounded-lg overflow-hidden border border-border bg-surface flex flex-col justify-between"
                            >
                              <div className="w-full bg-surface relative overflow-hidden">
                                <CinematicMediaCard posterPath={entry.posterPath} stillPath={entry.stillPath} title={entry.title || "Entry"} aspect={rk.collectionType === "tv_show" ? "video" : entry.posterPath ? "poster" : "auto"} />
                                <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/80 border border-white/20 text-[10px] font-bold text-white flex items-center justify-center">
                                  {idx + 1}
                                </span>
                              </div>
                              <div className="p-2">
                                <span className="text-[11px] font-semibold text-foreground line-clamp-1 block">
                                  {entry.title || `Item ${idx + 1}`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Link>

                  {/* Actions & Real Engagement Counts */}
                  <div className="pt-2 border-t border-border/70 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      {/* Live Persistent Like Button */}
                      <LikeButton
                        collectionId={rk.id}
                        initialLikeCount={item.stats?.likeCount || 0}
                        initialIsLiked={item.stats?.isLiked || false}
                      />

                      {/* Live Persistent Bookmark Button */}
                      <SaveRankingButton
                        collectionId={rk.id}
                        initialSavedCount={item.stats?.saveCount || 0}
                        initialIsSaved={item.stats?.isSaved || false}
                        showCount={true}
                      />

                      {/* Comment Count Link */}
                      <Link
                        href={`/collection/${rk.id}#comments`}
                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                      >
                        <MessageSquare size={13} />
                        <span>{item.stats?.commentCount || 0}</span>
                      </Link>
                    </div>

                    <Link
                      href={`/collection/${rk.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-text hover:underline"
                    >
                      <span>Explore Canon</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </article>
              );
            }

            if (item.type === "review" && item.review && item.mediaItem) {
              const rv = item.review;
              const md = item.mediaItem;
              const col = item.collection;
              const isIndependent = !col;
              const reviewHref = isIndependent ? `/review/${item.contentId}` : `/collection/${col.id}`;

              const isTvEp = md.mediaType === "episode" || Boolean(md.seasonNumber);

              return (
                <article
                  key={item.id}
                  className="rounded-card border border-border-card bg-card p-5 sm:p-6 space-y-3.5 hover:border-border transition-colors shadow-sm"
                >
                  {/* Author Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {profileHref ? (
                        <Link
                          href={profileHref}
                          className="h-8 w-8 rounded-full bg-surface border border-border flex items-center justify-center text-xs font-semibold text-primary-text hover:border-primary transition-colors shrink-0 overflow-hidden"
                        >
                          {item.author.image ? (
                            <img
                              src={item.author.image}
                              alt={item.author.name || "Critic"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            authorInitial
                          )}
                        </Link>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-surface border border-border flex items-center justify-center text-xs font-semibold text-primary-text shrink-0">
                          {authorInitial}
                        </div>
                      )}

                      <div className="text-xs">
                        <div className="flex items-center gap-1.5">
                          {profileHref ? (
                            <Link
                              href={profileHref}
                              className="font-semibold text-foreground hover:text-primary-text transition-colors"
                            >
                              {item.author.name || `@${item.author.username}`}
                            </Link>
                          ) : (
                            <span className="font-semibold text-foreground">
                              {item.author.name || "Critic"}
                            </span>
                          )}
                          {item.author.username && (
                            <span className="text-muted-foreground">@{item.author.username}</span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {isIndependent
                            ? "published a review"
                            : isTvEp
                              ? "reviewed an episode"
                              : "reviewed a film"}{" "}
                          · {formatFeedTime(item.timestamp)}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/media/${md.id}`}
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface border border-border text-primary-text hover:border-primary/50 transition-colors"
                    >
                      {isTvEp ? "Episode" : "Film"}
                    </Link>
                  </div>

                  {/* Media Item & Review Presentation */}
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <Link
                        href={reviewHref}
                        className={`${getMediaArtworkAspect(md) === "video" ? "w-full sm:w-36" : "w-20 sm:w-24"} rounded-lg overflow-hidden border border-border bg-surface shrink-0 relative group`}
                      >
                        <CinematicMediaCard posterPath={md.posterPath} stillPath={md.stillPath} title={md.title} aspect={getMediaArtworkAspect(md)} />
                    </Link>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/media/${md.id}`}
                          className="font-display text-lg uppercase font-bold text-foreground hover:text-primary-text transition-colors line-clamp-1"
                        >
                          {md.title}
                        </Link>

                        {rv.score !== null && (
                          <span className="px-2.5 py-0.5 rounded-md bg-surface border border-border text-xs font-bold text-primary-text shrink-0">
                            ★ {rv.score.toFixed(1)}
                          </span>
                        )}
                      </div>

                      {rv.title && (
                        <h4 className="font-display text-sm uppercase font-bold text-foreground">
                          <Link href={reviewHref} className="hover:text-primary-text transition-colors">
                            {rv.title}
                          </Link>
                        </h4>
                      )}

                      <SpoilerConcealedText
                        content={rv.reviewText}
                        isSpoiler={rv.isSpoiler}
                        quoteStyle={true}
                        className="text-xs sm:text-sm text-foreground/90 leading-relaxed italic border-l-2 border-primary/40 pl-3 line-clamp-4"
                      />
                    </div>
                  </div>

                  {/* Footer Attribution & Social Actions */}
                  <div className="pt-2 border-t border-border/70 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                    {isIndependent ? (
                      <div className="flex items-center gap-4">
                        <LikeButton
                          reviewId={item.contentId}
                          initialLikeCount={item.stats?.likeCount || 0}
                          initialIsLiked={item.stats?.isLiked || false}
                        />
                        <Link
                          href={`/review/${item.contentId}#comments`}
                          className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                        >
                          <MessageSquare size={13} />
                          <span>{item.stats?.commentCount || 0}</span>
                        </Link>
                      </div>
                    ) : (
                      <span>
                        from canon:{" "}
                        <Link
                          href={`/collection/${col.id}`}
                          className="text-foreground hover:text-primary-text font-medium transition-colors"
                        >
                          {col.title}
                        </Link>
                      </span>
                    )}

                    <Link
                      href={reviewHref}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-text hover:underline"
                    >
                      <span>{isIndependent ? "Read Review" : "View Ranking"}</span>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </article>
              );
            }

            return null;
          })}
        </div>
      )}
    </section>
  );
}
