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

  // Available canons for picker when parameters are missing
  const [availableCanons, setAvailableCanons] = useState<CollectionSummary[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string>(leftId || "");
  const [selectedRight, setSelectedRight] = useState<string>(rightId || "");

  useEffect(() => {
    async function loadAvailable() {
      try {
        const res = await fetch("/api/social/feed?mode=discover&limit=30");
        if (res.ok) {
          const data = await res.json();
          setAvailableCanons(data.items || []);
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
      <div className="min-h-screen bg-[#111514] text-[#f1f0e9] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[#8fa095] hover:text-[#f1f0e9] transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Back to Feed</span>
          </Link>

          <header className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1b2520] border border-[#3b4c40] text-xs font-semibold text-[#89d5d5] uppercase tracking-wider">
              <GitCompare size={12} />
              <span>Canon Disagreement Engine</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-[#f1f0e9]">
              Compare Two Critical Canons
            </h1>
            <p className="text-sm text-[#9aa79e] leading-relaxed">
              Select any two movie or television rankings to compute Spearman rank correlation,
              uncover sharp critical disputes, and see where two viewpoints diverge.
            </p>
          </header>

          <div className="p-6 rounded-2xl border border-[#303b34] bg-[#141a17] space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#8fa095] block">
                  Primary Canon (Left)
                </label>
                <select
                  value={selectedLeft}
                  onChange={(e) => setSelectedLeft(e.target.value)}
                  className="w-full rounded-lg bg-[#18211d] border border-[#303b34] p-3 text-sm text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5]"
                >
                  <option value="">Select a canon...</option>
                  {availableCanons.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.user?.name || "Critic"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#8fa095] block">
                  Comparing Against (Right)
                </label>
                <select
                  value={selectedRight}
                  onChange={(e) => setSelectedRight(e.target.value)}
                  className="w-full rounded-lg bg-[#18211d] border border-[#303b34] p-3 text-sm text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5]"
                >
                  <option value="">Select a canon...</option>
                  {availableCanons.map((c) => (
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
                    ? "bg-[#89d5d5] hover:bg-[#a2e5e5] text-[#102523] shadow-md shadow-[#89d5d5]/20 cursor-pointer"
                    : "bg-[#232d27] text-[#5a6a61] cursor-not-allowed pointer-events-none"
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
      <div className="min-h-screen bg-[#111514] flex flex-col items-center justify-center gap-3 text-[#89d5d5]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="text-xs font-mono tracking-widest uppercase text-[#8fa095]">
          Calculating Spearman alignment...
        </span>
      </div>
    );
  }

  if (error || !metrics || !leftCollection || !rightCollection) {
    return (
      <div className="min-h-screen bg-[#111514] text-[#f1f0e9] py-16 px-4">
        <div className="max-w-md mx-auto text-center space-y-4">
          <p className="text-sm text-[#f87171]">{error || "Could not load comparison"}</p>
          <Link
            href="/compare"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#18211d] border border-[#303b34] text-xs font-semibold text-[#89d5d5]"
          >
            <ArrowLeft size={13} />
            <span>Select different canons</span>
          </Link>
        </div>
      </div>
    );
  }

  // Alignment rating styling
  const ratingColors = {
    Identical: "text-[#4ade80] border-[#166534] bg-[#052e16]",
    "Strong Alignment": "text-[#89d5d5] border-[#115e59] bg-[#042f2e]",
    "Moderate Divergence": "text-[#fcd34d] border-[#78350f] bg-[#451a03]",
    "Sharp Dispute": "text-[#f87171] border-[#7f1d1d] bg-[#450a0a]",
    "Polar Opposites": "text-[#f43f5e] border-[#881337] bg-[#4c0519]",
    "Insufficient Data": "text-[#94a3b8] border-[#334155] bg-[#0f172a]",
  };

  const badgeStyle = ratingColors[metrics.alignmentRating] || ratingColors["Moderate Divergence"];

  return (
    <div className="min-h-screen bg-[#111514] text-[#f1f0e9] pb-24">
      {/* Editorial Compare Header */}
      <header className="border-b border-[#232d27] bg-[#141a17] pt-8 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between text-xs text-[#8fa095]">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 hover:text-[#f1f0e9] transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Back to Feed</span>
            </Link>
            <Link
              href="/compare"
              className="hover:text-[#89d5d5] transition-colors font-medium"
            >
              Change Canons
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Left Canon */}
            <div className="space-y-2 p-5 rounded-xl border border-[#2b3830] bg-[#17201c]/90">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#89d5d5]">
                Primary Canon
              </span>
              <h2 className="font-display text-2xl uppercase tracking-tight text-[#f1f0e9]">
                {leftCollection.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-[#8fa095]">
                <span>By {leftCollection.user.name || `@${leftCollection.user.username}`}</span>
                <span>·</span>
                <span>{leftCollection.totalEntries} items</span>
              </div>
            </div>

            {/* Right Canon */}
            <div className="space-y-2 p-5 rounded-xl border border-[#2b3830] bg-[#17201c]/90">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#89d5d5]">
                Comparative Canon
              </span>
              <h2 className="font-display text-2xl uppercase tracking-tight text-[#f1f0e9]">
                {rightCollection.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-[#8fa095]">
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
          <div className="p-6 rounded-xl border border-[#2b3830] bg-[#141a17] space-y-2">
            <span className="text-xs uppercase tracking-wider text-[#8fa095] block">
              Alignment Status
            </span>
            <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${badgeStyle}`}>
              {metrics.alignmentRating}
            </div>
            <p className="text-[11px] text-[#6c7d73] pt-1">
              Spearman Rank Correlation (ρ):{" "}
              <strong className="text-[#f1f0e9]">
                {metrics.spearmanCorrelation !== null
                  ? `${metrics.spearmanCorrelation > 0 ? "+" : ""}${metrics.spearmanCorrelation.toFixed(2)}`
                  : "N/A"}
              </strong>
            </p>
          </div>

          <div className="p-6 rounded-xl border border-[#2b3830] bg-[#141a17] space-y-2">
            <span className="text-xs uppercase tracking-wider text-[#8fa095] block">
              Pairwise Order Concordance
            </span>
            <div className="font-display text-4xl text-[#f1f0e9]">
              {metrics.concordancePercentage !== null ? `${metrics.concordancePercentage}%` : "—"}
            </div>
            <p className="text-[11px] text-[#6c7d73]">
              Of comparable pairs agree in relative preference ranking.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-[#2b3830] bg-[#141a17] space-y-2">
            <span className="text-xs uppercase tracking-wider text-[#8fa095] block">
              Mean Score Gap
            </span>
            <div className="font-display text-4xl text-[#89d5d5]">
              {metrics.meanScoreDifference !== null ? `${metrics.meanScoreDifference} pts` : "—"}
            </div>
            <p className="text-[11px] text-[#6c7d73]">
              Average sensory score disparity across {metrics.overlappingCount} shared titles.
            </p>
          </div>
        </section>

        {/* Sharpest Disagreements Spotlight */}
        {metrics.divergentItems.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#232d27] pb-2">
              <h3 className="font-display text-2xl uppercase tracking-tight text-[#f1f0e9]">
                Sharpest Critical Disputes
              </h3>
              <span className="text-xs text-[#8fa095]">
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
                    className="p-5 rounded-xl border border-[#2b3830] bg-[#141a17] space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-display text-lg uppercase text-[#f1f0e9] leading-tight">
                        {item.title}
                      </h4>
                      <div
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                          isTied
                            ? "bg-[#232d27] text-[#8fa095]"
                            : Math.abs(item.rankDelta) >= 3
                              ? "bg-[#450a0a] text-[#f87171] border border-[#7f1d1d]"
                              : "bg-[#1b2520] text-[#89d5d5] border border-[#3b4c40]"
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

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#232d27] text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#6c7d73] block">
                          {leftCollection.user.name || "Left"}&apos;s Rank
                        </span>
                        <div className="font-display text-lg text-[#f1f0e9]">
                          #{item.leftRank}{" "}
                          <span className="text-xs font-sans text-[#89d5d5]">
                            ({item.leftScore !== null ? item.leftScore.toFixed(1) : "—"})
                          </span>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#6c7d73] block">
                          {rightCollection.user.name || "Right"}&apos;s Rank
                        </span>
                        <div className="font-display text-lg text-[#f1f0e9]">
                          #{item.rightRank}{" "}
                          <span className="text-xs font-sans text-[#89d5d5]">
                            ({item.rightScore !== null ? item.rightScore.toFixed(1) : "—"})
                          </span>
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
          <div className="flex items-center justify-between border-b border-[#232d27] pb-2">
            <h3 className="font-display text-2xl uppercase tracking-tight text-[#f1f0e9]">
              Side-by-Side Canon Calibration
            </h3>
            <span className="text-xs text-[#8fa095]">
              {metrics.overlappingCount} Shared Titles
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#2b3830] bg-[#141a17]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#18211d] text-[#8fa095] uppercase font-semibold text-[10px] tracking-wider border-b border-[#2b3830]">
                <tr>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4 text-center">
                    {leftCollection.user.name || "Left"} Rank
                  </th>
                  <th className="py-3 px-4 text-center">
                    {rightCollection.user.name || "Right"} Rank
                  </th>
                  <th className="py-3 px-4 text-center">Shift</th>
                  <th className="py-3 px-4 text-right">Left Score</th>
                  <th className="py-3 px-4 text-right">Right Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232d27]">
                {metrics.concordantItems.map((item) => (
                  <tr key={item.mediaItemId} className="hover:bg-[#1a241f] transition-colors">
                    <td className="py-3 px-4 font-medium text-[#f1f0e9]">
                      {item.title}
                    </td>
                    <td className="py-3 px-4 text-center font-display text-base text-[#89d5d5]">
                      #{item.leftRank}
                    </td>
                    <td className="py-3 px-4 text-center font-display text-base text-[#89d5d5]">
                      #{item.rightRank}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {item.leftRank === item.rightRank ? (
                        <span className="text-[#6c7d73]">0</span>
                      ) : item.leftRank < item.rightRank ? (
                        <span className="text-[#4ade80]">+{item.rightRank - item.leftRank}</span>
                      ) : (
                        <span className="text-[#f87171]">-{item.leftRank - item.rightRank}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-[#e5ece5]">
                      {item.leftScore !== null ? item.leftScore.toFixed(1) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-[#e5ece5]">
                      {item.rightScore !== null ? item.rightScore.toFixed(1) : "—"}
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
        <div className="min-h-screen bg-[#111514] flex flex-col items-center justify-center gap-3 text-[#89d5d5]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ComparePageContent />
    </Suspense>
  );
}
