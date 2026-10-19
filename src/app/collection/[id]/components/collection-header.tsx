"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  GitCompare,
  Globe,
  Image as ImageIcon,
  Layers,
  Lock,
  Share2,
  Sliders,
  Trash2,
} from "lucide-react";
import { CinematicArtworkBanner } from "@/components/cinematic-artwork-banner";
import { LikeButton } from "@/components/social/like-button";
import { SaveRankingButton } from "@/components/social/save-ranking-button";
import { FollowButton } from "@/components/social/follow-button";
import { ReleaseTrackingToggle } from "@/components/collections/release-tracking-toggle";

interface CollectionHeaderProps {
  collection: any;
  collectionTitle: string;
  totalEntries: number;
  isOwner: boolean;
  visibility: "private" | "unlisted" | "public";
  visibilityUpdating: boolean;
  handleVisibilityChange: (vis: "private" | "unlisted" | "public") => void;
  completedCount: number;
  inProgressCount: number;
  unratedCount: number;
  completionPercentage: number;
  rubricCategories: any[];
  onOpenRubricModal: (targetMethod?: "numerical" | "tier") => void;
  onOpenBannerModal: () => void;
  onOpenDeleteModal: () => void;
}

export function CollectionHeader({
  collection,
  collectionTitle,
  totalEntries,
  isOwner,
  visibility,
  visibilityUpdating,
  handleVisibilityChange,
  completedCount,
  inProgressCount,
  unratedCount,
  completionPercentage,
  rubricCategories,
  onOpenRubricModal,
  onOpenBannerModal,
  onOpenDeleteModal,
}: CollectionHeaderProps) {
  const isTier = collection.defaultRatingSystem?.type === "tier";
  return (
    <CinematicArtworkBanner
      backdropPath={collection.backdropImage || collection.backdropPath}
      posterPath={collection.customCoverImage || collection.posterPath}
      clearLogoUrl={collection.clearLogoUrl}
      title={collectionTitle}
      className="border-b border-border"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 space-y-6">
        {/* Breadcrumb & Visibility row */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Back to Library</span>
          </Link>

          <div className="flex items-center gap-3">
            {isOwner && (
              <div className="flex items-center gap-1 p-1 rounded-md bg-card/90 border border-border">
                <button
                  type="button"
                  onClick={() => handleVisibilityChange("private")}
                  disabled={visibilityUpdating}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                    visibility === "private"
                      ? "bg-surface text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Lock size={10} />
                  Private
                </button>
                <button
                  type="button"
                  onClick={() => handleVisibilityChange("unlisted")}
                  disabled={visibilityUpdating}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                    visibility === "unlisted"
                      ? "bg-surface text-primary-text"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Share2 size={10} />
                  Unlisted
                </button>
                <button
                  type="button"
                  onClick={() => handleVisibilityChange("public")}
                  disabled={visibilityUpdating}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                    visibility === "public"
                      ? "bg-primary text-primary-foreground font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Globe size={10} />
                  Public
                </button>
              </div>
            )}
            <LikeButton collectionId={collection.id} />
            <SaveRankingButton collectionId={collection.id} />
            <ReleaseTrackingToggle
              collectionId={collection.id}
              collectionType={collection.collectionType}
              tmdbId={collection.tmdbId}
              isOwner={isOwner}
            />
            <Link
              href={`/compare?left=${collection.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-card/80 hover:bg-card text-muted-foreground hover:text-primary-text border border-border transition-colors"
              title="Compare with another ranking"
            >
              <GitCompare size={12} className="text-primary-text" />
              <span>Compare</span>
            </Link>
            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={onOpenBannerModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-card/80 hover:bg-card text-muted-foreground hover:text-primary-text border border-border transition-colors cursor-pointer"
                  title="Customize ranking banner artwork"
                >
                  <ImageIcon size={12} className="text-primary-text" />
                  <span>Banner</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenDeleteModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 transition-colors cursor-pointer"
                  title="Delete this entire ranking collection"
                >
                  <Trash2 size={12} />
                  <span>Delete</span>
                </button>
              </>
            )}
            <span className="text-[11px] font-mono text-primary-text font-semibold">
              {collection.collectionType === "tv_show"
                ? "TV Series"
                : collection.collectionType === "movie_franchise"
                  ? "Film Franchise"
                  : "Curated Collection"}{" "}
              · {totalEntries} Entries
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8 space-y-4">
            {/* Curator Identity Badge for Visitors */}
            {!isOwner && collection.user && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-card bg-card/80 backdrop-blur-md border border-border/70 max-w-xl">
                <div className="flex items-center gap-3 min-w-0">
                  {collection.user.username ? (
                    <Link
                      href={`/u/${collection.user.username}`}
                      className="h-10 w-10 rounded-full bg-surface border border-border flex items-center justify-center text-sm font-semibold text-primary-text hover:border-primary transition-colors shrink-0 overflow-hidden"
                    >
                      {collection.user.image ? (
                        <img
                          src={collection.user.image}
                          alt={collection.user.name || "Curator"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (collection.user.name || collection.user.username || "U").charAt(0).toUpperCase()
                      )}
                    </Link>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-surface border border-border flex items-center justify-center text-sm font-semibold text-primary-text shrink-0 overflow-hidden">
                      {collection.user.image ? (
                        <img
                          src={collection.user.image}
                          alt={collection.user.name || "Curator"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (collection.user.name || "U").charAt(0).toUpperCase()
                      )}
                    </div>
                  )}
                  <div className="text-xs min-w-0">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">
                      Curated By
                    </span>
                    <div className="flex items-center gap-1.5 truncate">
                      {collection.user.username ? (
                        <Link
                          href={`/u/${collection.user.username}`}
                          className="font-semibold text-sm text-foreground hover:text-primary-text transition-colors truncate"
                        >
                          {collection.user.name || `@${collection.user.username}`}
                        </Link>
                      ) : (
                        <span className="font-semibold text-sm text-foreground truncate">
                          {collection.user.name || "Curator"}
                        </span>
                      )}
                      {collection.user.username && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          @{collection.user.username}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <FollowButton
                  targetUserId={collection.userId}
                  targetUsername={collection.user.username || ""}
                  initialIsFollowing={collection.isFollowing ?? collection.user.isFollowing ?? false}
                  initialFollowersCount={collection.user.followersCount || 0}
                  initialFollowingCount={collection.user.followingCount || 0}
                  isOwnProfile={false}
                  showStats={false}
                />
              </div>
            )}

            {/* Editorial Eyebrow */}
            <span className="text-[10px] text-primary-text font-semibold tracking-widest uppercase block mb-1">
              {collection.collectionType === "tv_show"
                ? "The Episode Ranking"
                : collection.collectionType === "movie_franchise"
                  ? "The Film Franchise"
                  : "Curated Canon"}
            </span>

            {/* Transparent ClearLOGO or Primary Typographic Heading */}
            {collection.clearLogoUrl ? (
              <div className="py-1">
                <img
                  src={collection.clearLogoUrl}
                  alt={collectionTitle}
                  className="h-16 sm:h-20 w-auto object-contain filter drop-shadow-[0_10px_24px_rgba(0,0,0,0.95)]"
                />
                <h1 className="sr-only">{collectionTitle}</h1>
              </div>
            ) : (
              <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl tracking-tight text-foreground leading-[0.95] uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                {collectionTitle}
              </h1>
            )}

            {collection.description && (
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
                {collection.description}
              </p>
            )}

            {/* Ranking Progress */}
            <div className="p-3.5 sm:p-4 rounded-card bg-card/75 backdrop-blur-md border border-border/70 space-y-2.5 max-w-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                <span className="font-display text-base sm:text-lg font-bold text-foreground uppercase tracking-tight">
                  {completedCount} of {totalEntries} {isTier ? "Ranked" : "Rated"}{" "}
                  <span className="text-primary-text font-mono text-xs font-semibold ml-1">
                    ({completionPercentage}%)
                  </span>
                </span>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>
                    <strong className="text-foreground font-semibold">{completedCount}</strong>{" "}
                    {isTier ? "ranked" : "rated"}
                  </span>
                  {!isTier && (
                    <>
                      <span>·</span>
                      <span>
                        <strong className="text-foreground font-semibold">{inProgressCount}</strong> partial
                      </span>
                    </>
                  )}
                  <span>·</span>
                  <span>
                    <strong className="text-foreground font-semibold">{unratedCount}</strong>{" "}
                    {isTier ? "unranked" : "unrated"}
                  </span>
                </div>
              </div>

              {/* Progress Track */}
              <div className="h-1.5 w-full rounded-full bg-surface/80 overflow-hidden flex border border-border/50">
                <div
                  style={{ width: `${(completedCount / Math.max(1, totalEntries)) * 100}%` }}
                  className="h-full bg-primary transition-all duration-300"
                  title={`${completedCount} ${isTier ? "ranked" : "rated"}`}
                />
                {!isTier && (
                  <div
                    style={{ width: `${(inProgressCount / Math.max(1, totalEntries)) * 100}%` }}
                    className="h-full bg-primary/50 transition-all duration-300"
                    title={`${inProgressCount} in progress`}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Frosted Glass Rubric Breakdown Panel */}
          <div className="lg:col-span-4 p-4 sm:p-5 rounded-card bg-card/75 backdrop-blur-md border border-border/70 space-y-2.5 text-xs shadow-card">
            {collection.defaultRatingSystem?.type === "tier" ? (
              <>
                <div className="flex justify-between items-center pb-2 border-b border-border font-semibold">
                  <span className="font-display uppercase tracking-wider text-sm text-foreground flex items-center gap-1.5">
                    <Layers size={14} className="text-primary-text" />
                    <span>{collection.defaultRatingSystem?.name || "Tier System"}</span>
                  </span>
                  <span className="text-primary-text font-mono text-[11px]">
                    {collection.defaultRatingSystem?.tiers?.length || 0} Tiers
                  </span>
                </div>

                <div className="space-y-1.5 py-1">
                  {(collection.defaultRatingSystem?.tiers || []).map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between text-muted-foreground">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-5 h-5 rounded flex items-center justify-center font-display font-black text-[10px] text-black shrink-0 shadow-xs"
                          style={{ backgroundColor: t.color }}
                        >
                          {t.name}
                        </span>
                        {t.description && (
                          <span className="truncate text-[11px] text-foreground/80">{t.description}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isOwner && (
                  <div className="pt-2 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onOpenRubricModal("tier")}
                      className="text-[11px] text-primary-text hover:underline flex items-center gap-1.5 font-semibold cursor-pointer"
                      title="Configure rubric, customize tiers, or switch evaluation method"
                    >
                      <Sliders size={12} />
                      <span>Rating Setup</span>
                    </button>
                    <Link
                      href={`/settings?tab=rating_systems${collection.defaultRatingSystem?.id ? `&systemId=${collection.defaultRatingSystem.id}` : ""}`}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Settings
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between items-center pb-2 border-b border-border font-semibold">
                  <span className="font-display uppercase tracking-wider text-sm text-foreground">
                    {collection.defaultRatingSystem?.name || "Weighted Rubric"}
                  </span>
                  <span className="text-primary-text font-mono">
                    Scale 0–{collection.defaultRatingSystem?.scale || 10}
                  </span>
                </div>

                {rubricCategories.length > 0 ? (
                  rubricCategories.map((cat: any) => (
                    <div key={cat.id} className="flex justify-between text-muted-foreground">
                      <span>{cat.name}</span>
                      <span className="text-foreground font-bold">{cat.weight}x</span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex justify-between text-muted-foreground"><span>Writing & Story</span><span className="text-foreground font-bold">8x</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Acting & Performance</span><span className="text-foreground font-bold">8x</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Cinematography</span><span className="text-foreground font-bold">7x</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Music & Sound Design</span><span className="text-foreground font-bold">3x</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Overall Impact</span><span className="text-primary-text font-bold">8x</span></div>
                  </>
                )}

                {isOwner && collection.defaultRatingSystem && (
                  <div className="pt-2 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onOpenRubricModal("numerical")}
                      className="text-[11px] text-primary-text hover:underline flex items-center gap-1.5 font-semibold cursor-pointer"
                      title="Configure rubric, customize tiers, or switch evaluation method"
                    >
                      <Sliders size={12} />
                      <span>Rating Setup</span>
                    </button>
                    <Link
                      href={`/settings?tab=rating_systems&systemId=${collection.defaultRatingSystem.id}`}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Settings
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </CinematicArtworkBanner>
  );
}
