"use client";

import Link from "next/link";
import { Star, History, Edit2, Calendar } from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { StarRating } from "@/components/rating/star-rating";
import { getPersonalMediaUrl } from "@/lib/media-url";
import type { TimelineEntry } from "./cinematic-timeline";

interface CompactDiaryListProps {
  entries: TimelineEntry[];
  undatedEntries?: Array<{
    id: string;
    mediaItem: {
      id: string;
      title: string;
      year?: number | null;
      mediaType?: string | null;
      seasonNumber?: number | null;
      episodeNumber?: number | null;
      posterPath?: string | null;
      stillPath?: string | null;
    };
    ratingValue?: number | null;
    status?: string;
    content?: string;
  }>;
  onOpenHistory: (mediaItem: any) => void;
  onEditEntry?: (entry: any) => void;
}

function getScoreOnTen(entry: TimelineEntry): number | null {
  if (typeof entry.ratingValue === "number" && Number.isFinite(entry.ratingValue)) {
    return entry.ratingValue;
  }
  if (entry.rating) {
    const r = entry.rating as any;
    if (typeof r.calculatedOverallScore === "number" && Number.isFinite(r.calculatedOverallScore)) {
      const scale = r.ratingSystem?.scale || 10;
      return (r.calculatedOverallScore / scale) * 10;
    }
    if (typeof r.sourceRating === "number" && Number.isFinite(r.sourceRating)) {
      const scale = typeof r.sourceScale === "number" && r.sourceScale > 0 ? r.sourceScale : 10;
      return (r.sourceRating / scale) * 10;
    }
  }
  return null;
}

export function CompactDiaryList({
  entries,
  undatedEntries = [],
  onOpenHistory,
  onEditEntry,
}: CompactDiaryListProps) {
  // Count viewings per media item
  const mediaCountMap = new Map<string, number>();
  entries.forEach((e) => {
    mediaCountMap.set(e.mediaItemId, (mediaCountMap.get(e.mediaItemId) || 0) + 1);
  });

  return (
    <div className="space-y-6">
      {/* Table Container */}
      <div className="rounded-card border border-border bg-card overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-surface/80 border-b border-border text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              <tr>
                <th className="py-3 px-4 w-28">Date</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-3 w-28">Type</th>
                <th className="py-3 px-3 w-28">Rating</th>
                <th className="py-3 px-4 w-36">Status</th>
                <th className="py-3 px-4 text-right w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => {
                const totalLogs = mediaCountMap.get(entry.mediaItemId) || 1;
                const formattedDate = entry.watchedDate || "Undated";
                const ratingScore = getScoreOnTen(entry);
                const isEpisode =
                  entry.mediaItem.mediaType === "episode" ||
                  Boolean(entry.mediaItem.seasonNumber && entry.mediaItem.episodeNumber);

                return (
                  <tr key={entry.id} className="hover:bg-surface/50 transition-colors">
                    {/* Date */}
                    <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                      {formattedDate}
                    </td>

                    {/* Media Item & Poster */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Link href={getPersonalMediaUrl(entry.mediaItem.id)} className={`shrink-0 rounded overflow-hidden border border-border bg-surface ${isEpisode ? "w-14 aspect-video" : "w-8 aspect-[2/3]"}`}>
                          <CinematicMediaCard
                            title={entry.mediaItem.title}
                            posterPath={isEpisode ? entry.mediaItem.stillPath || entry.mediaItem.posterPath : entry.mediaItem.posterPath}
                            stillPath={entry.mediaItem.stillPath}
                            aspect={isEpisode ? "video" : "poster"}
                          />
                        </Link>
                        <div className="min-w-0">
                          <Link
                            href={getPersonalMediaUrl(entry.mediaItem.id)}
                            className="font-semibold text-foreground hover:text-primary transition-colors truncate block"
                          >
                            {entry.mediaItem.title}
                          </Link>
                          {entry.mediaItem.year && (
                            <span className="text-[11px] text-muted-foreground">
                              {entry.mediaItem.year}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Media Type */}
                    <td className="py-3 px-3 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold text-primary">
                      {isEpisode
                        ? entry.mediaItem.seasonNumber && entry.mediaItem.episodeNumber
                          ? `S${entry.mediaItem.seasonNumber} · E${entry.mediaItem.episodeNumber}`
                          : "Episode"
                        : entry.mediaItem.mediaType === "tv"
                        ? "TV Series"
                        : "Film"}
                    </td>

                    {/* Rating */}
                    <td className="py-3 px-3">
                      {ratingScore !== null ? (
                        <div className="inline-flex items-center gap-1 font-bold text-primary">
                          <Star size={11} className="fill-primary" />
                          <span>{ratingScore.toFixed(1)} / 10</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          entry.isRewatch
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-surface-raised text-muted-foreground border border-border"
                        }`}
                      >
                        {entry.isRewatch ? "Rewatch" : "1st viewing"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenHistory(entry.mediaItem)}
                          className="p-1 rounded text-primary hover:bg-surface transition-colors cursor-pointer"
                          title="View viewing history"
                        >
                          <History size={13} />
                        </button>
                        {onEditEntry && (
                          <button
                            type="button"
                            onClick={() => onEditEntry(entry)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
                            title="Edit entry"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Undated Ratings & Drafts Section (If any exist) */}
      {undatedEntries.length > 0 && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Undated Reviews &amp; Drafts ({undatedEntries.length})
            </h4>
            <span className="text-[11px] text-muted-foreground">
              These items do not have a recorded viewing date.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {undatedEntries.map((item) => {
              const isEpisode =
                item.mediaItem.mediaType === "episode" ||
                Boolean(item.mediaItem.seasonNumber && item.mediaItem.episodeNumber);

              return (
                <div
                  key={item.id}
                  className="p-3 rounded-card bg-card border border-border flex items-center gap-3"
                >
                  <Link href={getPersonalMediaUrl(item.mediaItem.id)} className={`shrink-0 rounded overflow-hidden border border-border ${isEpisode ? "w-16 aspect-video" : "w-10 aspect-[2/3]"}`}>
                    <CinematicMediaCard
                      title={item.mediaItem.title}
                      posterPath={isEpisode ? item.mediaItem.stillPath || item.mediaItem.posterPath : item.mediaItem.posterPath}
                      stillPath={item.mediaItem.stillPath}
                      aspect={isEpisode ? "video" : "poster"}
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={getPersonalMediaUrl(item.mediaItem.id)}
                      className="text-xs font-semibold text-foreground hover:text-primary truncate block"
                    >
                      {item.mediaItem.title}
                    </Link>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      {item.status && (
                        <span className="uppercase font-bold tracking-wider text-primary">
                          {item.status}
                        </span>
                      )}
                      {typeof item.ratingValue === "number" && (
                        <StarRating score={item.ratingValue} scale={10} size="xs" numericFormat="fraction" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
