"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  GitCompare,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Share2,
} from "lucide-react";
import { getTmdbImageUrl } from "@/lib/tmdb";
import { ComparisonMetrics } from "@/lib/comparison";

interface CollectionSummary {
  id: string;
  title: string;
  collectionType: string;
  customCoverImage?: string | null;
  backdropImage?: string | null;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
  totalEntries: number;
}

function ComparePageContent() {
  const searchParams = useSearchParams();
  const leftId = searchParams.get("left");
  const rightId = searchParams.get("right");

  const [leftCollection, setLeftCollection] = useState<CollectionSummary | null>(null);
  const [rightCollection, setRightCollection] = useState<CollectionSummary | null>(null);
  const [metrics, setMetrics] = useState<ComparisonMetrics | null>(null);
  const [loading, setLoading] = useState(Boolean(leftId && rightId));
  const [error, setError] = useState<string | null>(null);

  const [availableRankings, setAvailableRankings] = useState<CollectionSummary[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string>(leftId || "");
  const [selectedRight, setSelectedRight] = useState<string>(rightId || "");

  useEffect(() => {
    async function loadAvailable() {
      try {
        const res = await fetch("/api/compare?available=true");
        if (res.ok) {
          const data = await res.json();
          setAvailableRankings(data.rankings || []);
        }
      } catch (e) {
        // Silently ignore
      }
    }
    loadAvailable();
  }, []);

  useEffect(() => {
    if (!leftId || !rightId) {
      setLoading(false);
      return;
    }

    async function fetchComparison() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/compare?left=${leftId}&right=${rightId}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to compare collections");
        }
        const data = await res.json();
        setLeftCollection(data.leftCollection);
        setRightCollection(data.rightCollection);
        setMetrics(data.metrics);
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchComparison();
  }, [leftId, rightId]);

  // If no params or incomplete params, show selector
  if (!leftId || !rightId) {
    return (
      <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Back to Feed</span>
          </Link>

          <header className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary uppercase tracking-wider">
              <GitCompare size={12} />
              <span>Ranking Comparison</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-foreground">
              Compare Two Rankings
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Select any two movie or television rankings to compute Spearman rank correlation,
              uncover sharp critical disputes, and see where two viewpoints diverge.
            </p>
          </header>

          <div className="p-6 rounded-2xl border border-border bg-card space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Primary Ranking
                </label>
                <select
                  value={selectedLeft}
                  onChange={(e) => setSelectedLeft(e.target.value)}
                  className="w-full rounded-lg bg-surface border border-input-border p-3 text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">Select a ranking...</option>
                  {availableRankings.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.user?.name || "Critic"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Comparing Against (Right)
                </label>
                <select
                  value={selectedRight}
                  onChange={(e) => setSelectedRight(e.target.value)}
                  className="w-full rounded-lg bg-surface border border-input-border p-3 text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">Select a ranking...</option>
                  {availableRankings.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.user?.name || "Critic"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href={
                  selectedLeft && selectedRight
                    ? `/compare?left=${selectedLeft}&right=${selectedRight}`
                    : "#"
                }
                className={`w-full py-3.5 rounded-lg flex items-center justify-center gap-2 font-display text-sm uppercase tracking-wider font-bold transition-all ${
                  selectedLeft && selectedRight && selectedLeft !== selectedRight
                    ? "bg-primary hover:bg-primary-hover text-primary-foreground shadow-md cursor-pointer"
                    : "bg-surface text-muted-foreground cursor-not-allowed pointer-events-none border border-border"
                }`}
              >
                <span>Run Disagreement Analysis</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-primary">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="text-xs font-mono tracking-widest uppercase text-muted-foreground">
          Calculating Spearman alignment...
        </span>
      </div>
    );
  }

  if (error || !metrics || !leftCollection || !rightCollection) {
    return (
      <div className="min-h-screen bg-background text-foreground py-16 px-4">
        <div className="max-w-md mx-auto text-center space-y-4">
          <p className="text-sm text-red-400">{error || "Could not load comparison"}</p>
          <Link
            href="/compare"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-surface border border-border text-xs font-semibold text-foreground transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Select different rankings</span>
          </Link>
        </div>
      </div>
    );
  }

  // Alignment rating styling
  const ratingColors = {
    Identical: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    "Strong Alignment": "text-primary border-primary/30 bg-primary/10",
    "Moderate Divergence": "text-amber-400 border-amber-500/30 bg-amber-500/10",
    "Sharp Dispute": "text-red-400 border-red-500/30 bg-red-500/10",
    "Polar Opposites": "text-rose-400 border-rose-500/30 bg-rose-500/10",
    "Insufficient Data": "text-muted-foreground border-border bg-surface",
  };

  const badgeStyle = ratingColors[metrics.alignmentRating] || ratingColors["Moderate Divergence"];

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Editorial Compare Header */}
      <header className="border-b border-border bg-card pt-8 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Back to Feed</span>
            </Link>
            <Link
              href="/compare"
              className="hover:text-primary transition-colors font-medium"
            >
              Change Rankings
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Left Canon */}
            <div className="space-y-2 p-5 rounded-xl border border-border bg-surface">
              <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-semibold">
                Primary Ranking
              </span>
              <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
                {leftCollection.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>By {leftCollection.user.name || `@${leftCollection.user.username}`}</span>
                <span>·</span>
                <span>{leftCollection.totalEntries} items</span>
              </div>
            </div>

            {/* Right Canon */}
            <div className="space-y-2 p-5 rounded-xl border border-border bg-surface">
              <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-semibold">
                Comparison Ranking
              </span>
              <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
                {rightCollection.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>By {rightCollection.user.name || `@${rightCollection.user.username}`}</span>
                <span>·</span>
                <span>{rightCollection.totalEntries} items</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-12">
        {/* Metric Cards Row */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-6 rounded-xl border border-border bg-card space-y-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground block">
              Alignment Status
            </span>
            <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${badgeStyle}`}>
              {metrics.alignmentRating}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Spearman Rank Correlation (ρ):{" "}
              <strong className="text-foreground">
                {metrics.spearmanCorrelation !== null
                  ? `${metrics.spearmanCorrelation > 0 ? "+" : ""}${metrics.spearmanCorrelation.toFixed(2)}`
                  : "N/A"}
              </strong>
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card space-y-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground block">
              Pairwise Order Concordance
            </span>
            <div className="font-display text-4xl text-foreground">
              {metrics.concordancePercentage !== null ? `${metrics.concordancePercentage}%` : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Of comparable pairs agree in relative preference ranking.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card space-y-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground block">
              Mean Score Gap
            </span>
            <div className="font-display text-4xl text-primary">
              {metrics.meanScoreDifference !== null ? `${metrics.meanScoreDifference} pts` : "Ordinal"}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {metrics.meanScoreDifference !== null
                ? `Average sensory score disparity across ${metrics.overlappingCount} shared titles.`
                : `Correlating ordinal rank positions across ${metrics.overlappingCount} shared titles.`}
            </p>
          </div>
        </section>

        {/* Sharpest Disagreements Spotlight */}
        {metrics.divergentItems.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="font-display text-2xl uppercase tracking-tight text-foreground">
                Sharpest Critical Disputes
              </h3>
              <span className="text-xs text-muted-foreground">
                Ranked by maximum positional displacement
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics.divergentItems.slice(0, 3).map((item) => {
                const isLeftHigher = item.rankDelta > 0;
                const isTied = item.rankDelta === 0;

                return (
                  <div
                    key={item.mediaItemId}
                    className="p-5 rounded-xl border border-border bg-card space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-display text-lg uppercase text-foreground leading-tight">
                        {item.title}
                      </h4>
                      <div
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                          isTied
                            ? "bg-surface text-muted-foreground border border-border"
                            : Math.abs(item.rankDelta) >= 3
                              ? "bg-red-500/10 text-red-400 border border-red-500/30"
                              : "bg-primary/10 text-primary border border-primary/30"
                        }`}
                      >
                        {isLeftHigher ? (
                          <>
                            <TrendingUp size={12} />
                            <span>+{item.rankDelta} Left</span>
                          </>
                        ) : isTied ? (
                          <>
                            <Minus size={12} />
                            <span>Tied</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown size={12} />
                            <span>+{Math.abs(item.rankDelta)} Right</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-muted-foreground block">
                          {leftCollection.user.name || "Left"}&apos;s Rank
                        </span>
                        <div className="font-display text-lg text-foreground flex items-center gap-1.5 flex-wrap">
                          <span>#{item.leftRank}</span>
                          {item.leftTierName ? (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-black uppercase"
                              style={{ backgroundColor: item.leftTierColor || "#EF4444" }}
                            >
                              {item.leftTierName}
                            </span>
                          ) : (
                            <span className="text-xs font-sans text-primary">
                              ({item.leftScore !== null ? item.leftScore.toFixed(1) : "—"})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-muted-foreground block">
                          {rightCollection.user.name || "Right"}&apos;s Rank
                        </span>
                        <div className="font-display text-lg text-foreground flex items-center gap-1.5 flex-wrap">
                          <span>#{item.rightRank}</span>
                          {item.rightTierName ? (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-black uppercase"
                              style={{ backgroundColor: item.rightTierColor || "#EF4444" }}
                            >
                              {item.rightTierName}
                            </span>
                          ) : (
                            <span className="text-xs font-sans text-primary">
                              ({item.rightScore !== null ? item.rightScore.toFixed(1) : "—"})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Full Comparative Breakdown */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="font-display text-2xl uppercase tracking-tight text-foreground">
              Side-by-Side Ranking Comparison
            </h3>
            <span className="text-xs text-muted-foreground">
              {metrics.overlappingCount} Shared Titles
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4 text-center">
                    {leftCollection.user.name || "Left"} Rank
                  </th>
                  <th className="py-3 px-4 text-center">
                    {rightCollection.user.name || "Right"} Rank
                  </th>
                  <th className="py-3 px-4 text-center">Shift</th>
                  <th className="py-3 px-4 text-right">Left Evaluation</th>
                  <th className="py-3 px-4 text-right">Right Evaluation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {metrics.concordantItems.map((item) => (
                  <tr key={item.mediaItemId} className="hover:bg-surface transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">
                      {item.title}
                    </td>
                    <td className="py-3 px-4 text-center font-display text-base text-primary">
                      #{item.leftRank}
                    </td>
                    <td className="py-3 px-4 text-center font-display text-base text-primary">
                      #{item.rightRank}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {item.leftRank === item.rightRank ? (
                        <span className="text-muted-foreground">0</span>
                      ) : item.leftRank < item.rightRank ? (
                        <span className="text-emerald-400">+{item.rightRank - item.leftRank}</span>
                      ) : (
                        <span className="text-red-400">-{item.leftRank - item.rightRank}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-foreground">
                      {item.leftTierName ? (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold text-black uppercase"
                          style={{ backgroundColor: item.leftTierColor || "#EF4444" }}
                        >
                          {item.leftTierName}
                        </span>
                      ) : item.leftScore !== null ? (
                        item.leftScore.toFixed(1)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-foreground">
                      {item.rightTierName ? (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold text-black uppercase"
                          style={{ backgroundColor: item.rightTierColor || "#EF4444" }}
                        >
                          {item.rightTierName}
                        </span>
                      ) : item.rightScore !== null ? (
                        item.rightScore.toFixed(1)
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-primary">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ComparePageContent />
    </Suspense>
  );
}
