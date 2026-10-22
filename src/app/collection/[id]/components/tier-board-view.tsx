"use client";

import React, { useState } from "react";
import Link from "next/link";
import { getMediaArtworkAspect } from "@/lib/artwork";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { getRankingMediaUrl, getPersonalMediaUrl } from "@/lib/media-url";
import { Sliders, MoveRight, Check, Loader2, Layers, BookOpen } from "lucide-react";

interface TierBoardViewProps {
  collection: any;
  processedEntries: any[];
  isOwner: boolean;
  onSelectItemForRating: (media: any) => void;
  onQuickAssignTier?: (mediaItem: any, tierId: string | null) => Promise<void>;
  onOpenTierEditor?: () => void;
}

export function TierBoardView({
  collection,
  processedEntries,
  isOwner,
  onSelectItemForRating,
  onQuickAssignTier,
  onOpenTierEditor,
}: TierBoardViewProps) {
  const tiers: any[] = collection?.defaultRatingSystem?.tiers || [];
  const [movingEntryId, setMovingEntryId] = useState<string | null>(null);
  const rankingReturnUrl = `/collection/${collection?.id}`;

  // Group entries by tier
  const entriesByTier: Record<string, any[]> = {};
  for (const t of tiers) {
    entriesByTier[t.id] = [];
  }
  const unassignedEntries: any[] = [];

  for (const entry of processedEntries) {
    const tierId = entry.ratingStatus?.tier?.id || entry.userRating?.tierId;
    if (tierId && entriesByTier[tierId]) {
      entriesByTier[tierId].push(entry);
    } else {
      unassignedEntries.push(entry);
    }
  }

  const handleQuickMove = async (entry: any, targetTierId: string | null) => {
    if (!onQuickAssignTier || movingEntryId) return;
    setMovingEntryId(entry.id);
    try {
      await onQuickAssignTier(entry.mediaItem, targetTierId);
    } finally {
      setMovingEntryId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tier Rows */}
      {tiers.map((tier) => {
        const entriesInTier = entriesByTier[tier.id] || [];
        return (
          <div
            key={tier.id}
            className="flex flex-col md:flex-row border border-border-card rounded-card overflow-hidden bg-card/60 shadow-sm transition-colors hover:border-border"
          >
            {/* Left Header / Tier Label */}
            <div
              className="w-full md:w-36 lg:w-44 p-4 shrink-0 flex md:flex-col items-center justify-between md:justify-center text-center gap-2"
              style={{ backgroundColor: `${tier.color}15`, borderLeft: `6px solid ${tier.color}` }}
            >
              <div
                className="w-12 h-12 rounded-card flex items-center justify-center font-display font-black text-2xl text-black shadow-md shrink-0"
                style={{ backgroundColor: tier.color }}
              >
                {tier.name}
              </div>
              <div className="text-left md:text-center min-w-0">
                {tier.description && (
                  <div className="text-[11px] font-medium text-foreground/80 line-clamp-2">
                    {tier.description}
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  {entriesInTier.length} {entriesInTier.length === 1 ? "title" : "titles"}
                </div>
              </div>
            </div>

            {/* Right Lane / Media Cards */}
            <div className="flex-1 p-3 flex flex-wrap items-center gap-3 min-h-[110px] bg-surface/30">
              {entriesInTier.length === 0 ? (
                <div className="w-full py-6 text-center text-xs text-muted-foreground/60 italic">
                  No titles in {tier.name} tier yet.
                </div>
              ) : (
                entriesInTier.map((entry) => {
                  const media = entry.mediaItem;
                  const isStill = getMediaArtworkAspect(media) === "video";
                  const isEpisode =
                    (media.mediaType === "episode" || media.seasonNumber != null || media.episodeNumber != null) &&
                    media.seasonNumber != null &&
                    media.episodeNumber != null &&
                    media.mediaType !== "movie";
                  const episodeBadgeText = isEpisode
                    ? `S${String(media.seasonNumber).padStart(2, "0")} · E${String(media.episodeNumber).padStart(2, "0")}`
                    : null;
                  const isMoving = movingEntryId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className={`group relative rounded-card overflow-hidden border border-border bg-card shadow-xs hover:border-primary/60 transition-all hover:scale-102 ${
                        isStill ? "w-36 sm:w-40" : "w-24 sm:w-28"
                      }`}
                    >
                      <div className={`relative w-full overflow-hidden bg-surface ${isStill ? "aspect-[16/9]" : "aspect-[2/3]"}`}>
                        <CinematicMediaCard
                          stillPath={media.stillPath}
                          posterPath={media.posterPath}
                          title={media.title}
                          aspect={isStill ? "video" : "poster"}
                        />
                        {/* Compact TV Episode Badge visible without hover */}
                        {episodeBadgeText && (
                          <div
                            data-testid="episode-badge"
                            className="absolute top-1 left-1 z-10 pointer-events-none px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-foreground border border-border/60 text-[9px] font-mono font-bold tracking-wider shadow-sm select-none"
                          >
                            {episodeBadgeText}
                          </div>
                        )}
                        {isMoving && (
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
                            <Loader2 size={16} className="text-primary animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="p-1.5 bg-card">
                        <Link
                          href={getRankingMediaUrl(media.id, isOwner, { from: rankingReturnUrl })}
                          title={episodeBadgeText ? `${episodeBadgeText} — ${media.title}` : media.title}
                          className="text-[11px] font-semibold text-foreground truncate uppercase font-display leading-tight block hover:text-primary transition-colors"
                        >
                          {media.title}
                        </Link>
                      </div>

                      {/* Hover Overlay Action Controls */}
                      <div className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between z-10 text-xs">
                        <Link
                          href={getRankingMediaUrl(media.id, isOwner, { from: rankingReturnUrl })}
                          className="text-[10px] text-white/90 font-medium line-clamp-2 hover:text-primary transition-colors block"
                        >
                          {episodeBadgeText ? `${episodeBadgeText} — ${media.title}` : media.title}
                        </Link>

                        <div className="space-y-1">
                          {isOwner && (
                            <>
                              <div className="flex items-center gap-1">
                                <Link
                                  href={getPersonalMediaUrl(media.id, { journal: true, from: rankingReturnUrl })}
                                  className="py-1 px-1.5 rounded bg-surface text-foreground font-semibold text-[10px] flex items-center justify-center gap-0.5 border border-border hover:bg-surface-elevated transition-colors"
                                  title="Open personal journal entry"
                                >
                                  <BookOpen size={10} />
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => onSelectItemForRating(media)}
                                  className="flex-1 py-1 rounded bg-primary text-primary-foreground font-semibold text-[10px] flex items-center justify-center gap-1 cursor-pointer hover:bg-primary-hover transition-colors"
                                >
                                  <Sliders size={10} />
                                  <span>Edit</span>
                                </button>
                              </div>

                              {/* Quick move dropdown */}
                              <select
                                value={tier.id}
                                onChange={(e) => handleQuickMove(entry, e.target.value === "unassign" ? null : e.target.value)}
                                className="w-full bg-surface text-[10px] text-foreground border border-border rounded px-1 py-0.5 focus:outline-none"
                              >
                                <option value={tier.id}>Stay in {tier.name}</option>
                                {tiers
                                  .filter((t) => t.id !== tier.id)
                                  .map((t) => (
                                    <option key={t.id} value={t.id}>
                                      Move to {t.name}
                                    </option>
                                  ))}
                                <option value="unassign">Unassign</option>
                              </select>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}

      {/* Unassigned Lane */}
      {unassignedEntries.length > 0 && (
        <div className="flex flex-col md:flex-row border border-dashed border-border rounded-card overflow-hidden bg-card/30">
          <div className="w-full md:w-36 lg:w-44 p-4 shrink-0 flex md:flex-col items-center justify-between md:justify-center text-center gap-2 bg-muted/20 border-l-4 border-muted-foreground/40">
            <div className="w-12 h-12 rounded-card flex items-center justify-center font-display font-bold text-lg text-muted-foreground bg-surface border border-border">
              ?
            </div>
            <div className="text-left md:text-center min-w-0">
              <div className="text-[11px] font-medium text-muted-foreground">Unassigned</div>
              <div className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                {unassignedEntries.length} waiting
              </div>
            </div>
          </div>

          <div className="flex-1 p-3 flex flex-wrap items-center gap-3 min-h-[110px] bg-surface/20">
            {unassignedEntries.map((entry) => {
              const media = entry.mediaItem;
              const isStill = getMediaArtworkAspect(media) === "video";
              const isEpisode =
                (media.mediaType === "episode" || media.seasonNumber != null || media.episodeNumber != null) &&
                media.seasonNumber != null &&
                media.episodeNumber != null &&
                media.mediaType !== "movie";
              const episodeBadgeText = isEpisode
                ? `S${String(media.seasonNumber).padStart(2, "0")} · E${String(media.episodeNumber).padStart(2, "0")}`
                : null;
              const isMoving = movingEntryId === entry.id;
              return (
                <div
                  key={entry.id}
                  className={`group relative rounded-card overflow-hidden border border-border bg-card shadow-xs hover:border-primary/60 transition-all hover:scale-102 ${
                    isStill ? "w-36 sm:w-40" : "w-24 sm:w-28"
                  }`}
                >
                  <div className={`relative w-full overflow-hidden bg-surface ${isStill ? "aspect-[16/9]" : "aspect-[2/3]"}`}>
                    <CinematicMediaCard
                      stillPath={media.stillPath}
                      posterPath={media.posterPath}
                      title={media.title}
                      aspect={isStill ? "video" : "poster"}
                    />
                    {/* Compact TV Episode Badge visible without hover */}
                    {episodeBadgeText && (
                      <div
                        data-testid="episode-badge"
                        className="absolute top-1 left-1 z-10 pointer-events-none px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-foreground border border-border/60 text-[9px] font-mono font-bold tracking-wider shadow-sm select-none"
                      >
                        {episodeBadgeText}
                      </div>
                    )}
                    {isMoving && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
                        <Loader2 size={16} className="text-primary animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="p-1.5 bg-card">
                    <Link
                      href={getRankingMediaUrl(media.id, isOwner, { from: rankingReturnUrl })}
                      title={episodeBadgeText ? `${episodeBadgeText} — ${media.title}` : media.title}
                      className="text-[11px] font-semibold text-foreground truncate uppercase font-display leading-tight block hover:text-primary transition-colors"
                    >
                      {media.title}
                    </Link>
                  </div>

                  {isOwner && (
                    <div className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between z-10 text-xs">
                      <Link
                        href={getRankingMediaUrl(media.id, isOwner, { from: rankingReturnUrl })}
                        className="text-[10px] text-white/90 font-medium line-clamp-2 hover:text-primary transition-colors block"
                      >
                        {episodeBadgeText ? `${episodeBadgeText} — ${media.title}` : media.title}
                      </Link>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Link
                            href={getPersonalMediaUrl(media.id, { journal: true, from: rankingReturnUrl })}
                            className="py-1 px-1.5 rounded bg-surface text-foreground font-semibold text-[10px] flex items-center justify-center gap-0.5 border border-border hover:bg-surface-elevated transition-colors"
                            title="Open personal journal entry"
                          >
                            <BookOpen size={10} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => onSelectItemForRating(media)}
                            className="flex-1 py-1 rounded bg-primary text-primary-foreground font-semibold text-[10px] flex items-center justify-center gap-1 cursor-pointer hover:bg-primary-hover transition-colors"
                          >
                            <Sliders size={10} />
                            <span>Assign</span>
                          </button>
                        </div>

                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) handleQuickMove(entry, e.target.value);
                          }}
                          className="w-full bg-surface text-[10px] text-foreground border border-border rounded px-1 py-0.5 focus:outline-none"
                        >
                          <option value="" disabled>
                            Select Tier...
                          </option>
                          {tiers.map((t) => (
                            <option key={t.id} value={t.id}>
                              Assign {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
