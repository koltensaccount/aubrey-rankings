"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Tv, Star, UserCheck, Eye, Bookmark, Sparkles, BookOpen } from "lucide-react";
import { resolvePosterUrl } from "@/lib/artwork";
import { getTmdbImageUrl } from "@/lib/tmdb";
import {
  getPersonalMediaUrl,
  getPublicMediaUrl,
  getContextualBackInfo,
  sanitizeInternalReturnUrl,
} from "@/lib/media-url";

interface MediaHeroBannerProps {
  media: {
    id: string;
    title: string;
    mediaType?: string | null;
    releaseDate?: string | null;
    stillPath?: string | null;
    backdropPath?: string | null;
    posterPath?: string | null;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    parentMediaId?: string | null;
  };
  activeView: "overview" | "personal";
  isAuthenticated: boolean;
  from?: string | null;
  hasPersonalActivity?: boolean;
  averageScore?: { average: number; count: number; starsAverage?: number; distribution?: any } | null;
  tmdbRating?: { score: number; votes: number | null } | null;
  seriesDetailsHref?: string | null;
  personalSummary?: {
    isWatched?: boolean;
    viewingsCount?: number;
    hasReview?: boolean;
    hasRating?: boolean;
    isWatchlist?: boolean;
    rankedCollectionsCount?: number;
  } | null;
}

export function MediaHeroBanner({
  media,
  activeView,
  isAuthenticated,
  from,
  hasPersonalActivity,
  averageScore,
  tmdbRating,
  seriesDetailsHref,
  personalSummary,
}: MediaHeroBannerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlFrom = searchParams?.get("from") || from || null;
  const [returnPath, setReturnPath] = useState<string | null>(() => sanitizeInternalReturnUrl(urlFrom));

  useEffect(() => {
    // 1. If explicit 'from' is present, persist to state and session
    if (urlFrom) {
      const sanitized = sanitizeInternalReturnUrl(urlFrom);
      if (sanitized) {
        setReturnPath(sanitized);
        try {
          sessionStorage.setItem("aubrey_last_origin", sanitized);
        } catch {}
        return;
      }
    }

    // 2. Otherwise check session storage
    try {
      const stored = sessionStorage.getItem("aubrey_last_origin");
      const sanitizedStored = sanitizeInternalReturnUrl(stored);
      if (sanitizedStored) {
        setReturnPath(sanitizedStored);
        return;
      }
    } catch {}

    // 3. Otherwise inspect same-origin document.referrer
    if (typeof document !== "undefined" && document.referrer) {
      try {
        const refUrl = new URL(document.referrer);
        if (refUrl.origin === window.location.origin) {
          const sanitizedRef = sanitizeInternalReturnUrl(`${refUrl.pathname}${refUrl.search}`);
          if (sanitizedRef) {
            setReturnPath(sanitizedRef);
          }
        }
      } catch {}
    }
  }, [urlFrom]);

  const backInfo = getContextualBackInfo(returnPath, activeView);

  const handleBack = (e: React.MouseEvent) => {
    // Ordinary client navigation prefers browser history to preserve scroll position and filters
    if (typeof window !== "undefined" && window.history.length > 1) {
      // Check if previous document referrer was an internal media page to prevent view-toggle loops
      const prevWasSameMedia =
        typeof document !== "undefined" &&
        document.referrer &&
        document.referrer.includes(`/media/${encodeURIComponent(media.id)}`);

      if (!prevWasSameMedia) {
        e.preventDefault();
        router.back();
        return;
      }
    }
    // Fallback: regular link href navigation takes user directly to backInfo.href
  };

  const stillUrl = media.stillPath ? getTmdbImageUrl(media.stillPath, "original") : null;
  const backdropUrl = media.backdropPath ? getTmdbImageUrl(media.backdropPath, "original") : null;
  const posterUrl = media.posterPath ? resolvePosterUrl(media.posterPath, "w500") : null;
  const heroImage = stillUrl || backdropUrl || posterUrl;

  const year = (media.releaseDate || "").split("-")[0];
  const isEpisode = media.mediaType === "episode" || (media.seasonNumber !== null && media.episodeNumber !== null);
  const isTv = media.mediaType === "tv" || isEpisode;

  const episodeBadge =
    media.seasonNumber && media.episodeNumber
      ? `Season ${media.seasonNumber}, Episode ${media.episodeNumber}`
      : media.seasonNumber
        ? `Season ${media.seasonNumber}`
        : null;

  const publicOverviewUrl = getPublicMediaUrl(media.id, { from: returnPath || undefined });
  const personalViewUrl = getPersonalMediaUrl(media.id, { from: returnPath || undefined });

  return (
    <div className="relative w-full overflow-hidden bg-card border-b border-border">
      {/* Background Hero Image */}
      <div className="relative w-full h-72 sm:h-96 overflow-hidden">
        {heroImage ? (
          <>
            <img
              src={heroImage}
              alt={media.title}
              className="w-full h-full object-cover opacity-35 filter saturate-75"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full bg-surface" />
        )}

        {/* Top Floating Navigation */}
        <div className="absolute top-6 left-4 sm:left-8 z-20 flex items-center gap-2">
          <Link
            href={backInfo.href}
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/85 backdrop-blur-sm text-xs font-semibold text-foreground hover:bg-surface transition-colors cursor-pointer shadow-xs"
          >
            <ArrowLeft size={13} />
            <span>{backInfo.label}</span>
          </Link>

          {seriesDetailsHref && (
            <Link
              href={seriesDetailsHref}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/85 backdrop-blur-sm text-xs font-semibold text-foreground hover:bg-surface transition-colors"
            >
              <Tv size={13} />
              <span>Series Details</span>
            </Link>
          )}
        </div>

        {/* Title, Badges & Hero Details */}
        <div className="absolute bottom-6 left-4 sm:left-8 right-4 sm:right-8 z-20 max-w-4xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
              {isEpisode ? "Television Episode" : isTv ? "Television" : "Film"}
            </span>
            {episodeBadge && (
              <span className="text-xs font-semibold text-muted-foreground">
                · {episodeBadge}
              </span>
            )}
            {year && (
              <span className="text-xs text-muted-foreground">
                · {year}
              </span>
            )}

            {activeView === "personal" && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground border border-primary/40 shadow-xs">
                Your View
              </span>
            )}
          </div>

          {/* Title Header: When on Personal view, clicking the title opens Public Overview */}
          {activeView === "personal" ? (
            <h1 className="font-display text-3xl sm:text-5xl uppercase font-bold text-foreground tracking-tight">
              <Link
                href={publicOverviewUrl}
                title="Switch to public Title Overview"
                className="hover:text-primary transition-colors inline-flex items-center gap-2"
              >
                <span>{media.title}</span>
              </Link>
            </h1>
          ) : (
            <h1 className="font-display text-3xl sm:text-5xl uppercase font-bold text-foreground tracking-tight">
              {media.title}
            </h1>
          )}

          {/* Public Overview Metrics */}
          {activeView === "overview" && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {averageScore && averageScore.count > 0 ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface/90 border border-border text-xs font-semibold backdrop-blur-xs">
                  <Star size={13} className="text-primary fill-primary" />
                  <span>★ {averageScore.average.toFixed(1)} / 10 Aubrey community</span>
                  <span className="text-muted-foreground">({averageScore.count} {averageScore.count === 1 ? "rating" : "ratings"})</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  No community ratings yet
                </span>
              )}
              {tmdbRating && (
                <p className="text-xs text-muted-foreground">
                  TMDB audience: <strong className="text-foreground">{tmdbRating.score.toFixed(1)} / 10</strong>
                  {tmdbRating.votes !== null ? ` · ${tmdbRating.votes.toLocaleString()} votes` : ""}
                </p>
              )}
            </div>
          )}

          {/* Personal View Quick Stats Badge */}
          {activeView === "personal" && personalSummary && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              {personalSummary.viewingsCount && personalSummary.viewingsCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 font-semibold">
                  <Eye size={12} />
                  <span>Logged {personalSummary.viewingsCount} {personalSummary.viewingsCount === 1 ? "viewing" : "viewings"}</span>
                </span>
              ) : personalSummary.isWatched ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface text-foreground border border-border font-medium">
                  <Eye size={12} />
                  <span>Watched</span>
                </span>
              ) : null}

              {personalSummary.isWatchlist && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 font-semibold">
                  <Bookmark size={12} />
                  <span>On Watchlist</span>
                </span>
              )}

              {personalSummary.hasReview && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface text-foreground border border-border font-medium">
                  <BookOpen size={12} />
                  <span>Review Written</span>
                </span>
              )}

              {personalSummary.rankedCollectionsCount !== undefined && personalSummary.rankedCollectionsCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface text-foreground border border-border font-medium">
                  <Sparkles size={12} />
                  <span>Ranked in {personalSummary.rankedCollectionsCount} {personalSummary.rankedCollectionsCount === 1 ? "list" : "lists"}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mode Switcher Tabs: Title Overview vs. Your Activity */}
      <div className="bg-surface border-t border-border px-4 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center gap-1 sm:gap-2">
          {/* Tab 1: Title Overview (Public) */}
          <Link
            href={publicOverviewUrl}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeView === "overview"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Tv size={14} className={activeView === "overview" ? "text-primary" : "text-muted-foreground"} />
            <span>Title Overview</span>
            <span className="text-[10px] font-normal text-muted-foreground hidden sm:inline">(Public)</span>
          </Link>

          {/* Tab 2: Your View (Personal) */}
          {isAuthenticated ? (
            <Link
              href={personalViewUrl}
              className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                activeView === "personal"
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <UserCheck size={14} className={activeView === "personal" ? "text-primary" : "text-muted-foreground"} />
              <span>Your View</span>
              {hasPersonalActivity && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" title="You have logged activity for this title" />
              )}
            </Link>
          ) : (
            <Link
              href={`/login?redirect=${encodeURIComponent(personalViewUrl)}`}
              className="py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
              title="Sign in to view your personal activity, ratings, and diary history"
            >
              <UserCheck size={14} className="text-muted-foreground" />
              <span>Your View</span>
              <span className="text-[10px] text-muted-foreground/75 font-normal hidden sm:inline">(Sign in)</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
