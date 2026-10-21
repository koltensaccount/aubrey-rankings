"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pin, Lock, Globe, Link2, Bookmark, ArrowRight, ListPlus } from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";

interface RankingsSectionProps {
  collections: any[];
  savedCollections?: any[];
}

export function RankingsSection({ collections, savedCollections = [] }: RankingsSectionProps) {
  const [subTab, setSubTab] = useState<"created" | "saved">("created");

  const displayedCollections = subTab === "created" ? collections : savedCollections;

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-border">
        <div>
          <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
            Rankings &amp; Custom Lists
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Weighted rubrics, franchise sagas, and curated lists.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Subtab toggle */}
          <div className="inline-flex rounded-button p-0.5 bg-surface border border-border select-none text-xs">
            <button
              type="button"
              onClick={() => setSubTab("created")}
              className={`px-3 py-1.5 rounded-button font-semibold transition-colors cursor-pointer ${
                subTab === "created"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              My Collections ({collections.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab("saved")}
              className={`px-3 py-1.5 rounded-button font-semibold transition-colors cursor-pointer ${
                subTab === "saved"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Saved ({savedCollections.length})
            </button>
          </div>

          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-colors shadow-sm"
          >
            <Plus size={14} />
            <span>New ranking</span>
          </Link>
        </div>
      </div>

      {/* Grid */}
      {displayedCollections.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-border bg-card/50 p-8 space-y-3 max-w-md mx-auto">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto">
            <ListPlus size={20} />
          </div>
          <h3 className="font-display text-2xl uppercase tracking-tight text-foreground">
            {subTab === "created" ? "No Rankings or Lists Yet" : "No Saved Rankings"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {subTab === "created"
              ? "Create your first weighted ranking collection to score episodes, director sagas, or movie franchises."
              : "Explore the Community Feed and bookmark rankings created by other cinephiles."}
          </p>
          <div className="pt-2">
            {subTab === "created" ? (
              <Link
                href="/create"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-sm transition-colors"
              >
                <Plus size={14} />
                <span>Create a ranking</span>
              </Link>
            ) : (
              <Link
                href="/feed"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-sm transition-colors"
              >
                <span>Browse Community Feed</span>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedCollections.map((col) => {
            const isRanked = col.isRanked !== false;
            const entriesCount = col.entries?.length || 0;
            const visibility = col.visibility || (col.isPublic ? "public" : "private");

            // Preview posters (up to 4)
            const previewEntries = col.entries?.slice(0, 4) || [];

            return (
              <Link
                key={col.id}
                href={`/collection/${encodeURIComponent(col.id)}`}
                className="group rounded-card border border-border bg-card p-4 shadow-card hover:border-primary/40 transition-all flex flex-col justify-between space-y-4"
              >
                {/* Header: Title, Badges */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    {/* Collection Type Badge */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isRanked
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-surface text-muted-foreground border border-border"
                      }`}
                    >
                      {isRanked ? "Weighted Ranking" : "Custom List"}
                    </span>

                    {/* Pin or Visibility */}
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      {col.isPinned && (
                        <span title="Pinned ranking" className="text-primary inline-flex">
                          <Pin size={12} className="fill-primary" />
                        </span>
                      )}
                      {visibility === "public" ? (
                        <span title="Public" className="inline-flex"><Globe size={12} className="text-primary" /></span>
                      ) : visibility === "unlisted" ? (
                        <span title="Unlisted" className="inline-flex"><Link2 size={12} /></span>
                      ) : (
                        <span title="Private" className="inline-flex"><Lock size={12} /></span>
                      )}
                    </div>
                  </div>

                  <h3 className="font-display text-2xl uppercase tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {col.title}
                  </h3>

                  {col.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {col.description}
                    </p>
                  )}
                </div>

                {/* Poster Previews Collage */}
                {previewEntries.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {previewEntries.map((entry: any, pIdx: number) => (
                      <div
                        key={entry.id || pIdx}
                        className="aspect-[2/3] rounded overflow-hidden border border-border bg-surface"
                      >
                        {entry.mediaItem && (
                          <CinematicMediaCard
                            title={entry.mediaItem.title}
                            posterPath={entry.mediaItem.posterPath}
                            stillPath={entry.mediaItem.stillPath}
                            aspect="poster"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer Metadata */}
                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    <strong className="text-foreground font-semibold">{entriesCount}</strong>{" "}
                    {entriesCount === 1 ? "item" : "items"}
                  </span>

                  <span className="inline-flex items-center gap-1 font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                    <span>View</span>
                    <ArrowRight size={13} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
