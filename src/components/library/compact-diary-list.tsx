"use client";

import Link from "next/link";
import { Star, History, Edit2, Calendar } from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import type { DiaryViewingEvent } from "./rewatch-history-modal";

interface CompactDiaryListProps {
  entries: Array<
    DiaryViewingEvent & {
      mediaItem: {
        id: string;
        title: string;
        year?: number | null;
        mediaType?: string | null;
        posterPath?: string | null;
        stillPath?: string | null;
      };
    }
  >;
  undatedEntries?: Array<{
    id: string;
    mediaItem: {
      id: string;
      title: string;
      year?: number | null;
      mediaType?: string | null;
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

export function CompactDiaryList({
  entries,
  undatedEntries = [],
  onOpenHistory,
  onEditEntry,
}: CompactDiaryListProps) {
  // Compute total viewings per media item
  const mediaCountMap = new Map<string, number>();
  entries.forEach((e) => {
    const id = e.mediaItemId;
    mediaCountMap.set(id, (mediaCountMap.get(id) || 0) + 1);
  });

  return (
    <div className="space-y-6">
      {/* Table Container */}
      <div className="rounded-card border border-border bg-card overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-surface text-muted-foreground uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-4 w-28">Date</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-3 w-24">Type</th>
                <th className="py-3 px-3 w-28">Rating</th>
                <th className="py-3 px-4 w-36">Status</th>
                <th className="py-3 px-4 text-right w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => {
                const totalLogs = mediaCountMap.get(entry.mediaItemId) || 1;
                const formattedDate = entry.watchedDate || (entry.loggedDate ? new Date(entry.loggedDate).toISOString().slice(0, 10) : "Undated");

                const ratingScore =
                  typeof entry.ratingValue === "number"
                    ? entry.ratingValue
                    : typeof entry.rating?.calculatedOverallScore === "number"
                    ? entry.rating.calculatedOverallScore
                    : null;

                return (
                  <tr key={entry.id} className="hover:bg-surface/50 transition-colors">
                    {/* Date */}
                    <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                      {formattedDate}
                    </td>

                    {/* Media Item & Poster */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 aspect-[2/3] shrink-0 rounded overflow-hidden border border-border bg-surface">
                          <CinematicMediaCard
                            title={entry.mediaItem.title}
                            posterPath={entry.mediaItem.posterPath}
                            stillPath={entry.mediaItem.stillPath}
                            aspect={entry.mediaItem.mediaType === "tv_episode" ? "video" : "poster"}
                          />
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/media/${encodeURIComponent(entry.mediaItem.id)}`}
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
                    <td className="py-3 px-3 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                      {entry.mediaItem.mediaType === "tv_episode" ? "Episode" : "Film"}
                    </td>

                    {/* Rating */}
                    <td className="py-3 px-3">
                      {ratingScore !== null ? (
                        <div className="inline-flex items-center gap-1 font-bold text-primary">
                          <Star size={11} className="fill-primary" />
                          <span>{ratingScore.toFixed(1)}</span>
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
                          className="p-1 text-primary hover:underline cursor-pointer text-[11px] font-semibold"
                          title="View history"
                        >
                          History {totalLogs > 1 ? `(${totalLogs})` : ""}
                        </button>
                        {onEditEntry && (
                          <button
                            type="button"
                            onClick={() => onEditEntry(entry)}
                            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
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
              Undated Reviews & Drafts ({undatedEntries.length})
            </h4>
            <span className="text-[11px] text-muted-foreground">
              These items do not have a recorded viewing date.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {undatedEntries.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-card bg-card border border-border flex items-center gap-3"
              >
                <div className="w-10 aspect-[2/3] shrink-0 rounded overflow-hidden border border-border">
                  <CinematicMediaCard
                    title={item.mediaItem.title}
                    posterPath={item.mediaItem.posterPath}
                    stillPath={item.mediaItem.stillPath}
                    aspect={item.mediaItem.mediaType === "tv_episode" ? "video" : "poster"}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/media/${encodeURIComponent(item.mediaItem.id)}`}
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
                      <span className="flex items-center gap-0.5 text-primary font-bold">
                        <Star size={10} className="fill-primary" />
                        <span>{item.ratingValue.toFixed(1)}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
