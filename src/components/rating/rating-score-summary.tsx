"use client";

interface RatingScoreSummaryProps {
  scoredCount: number;
  totalCategoriesCount: number;
  isComplete: boolean;
  weightedScore: number | null;
  scale: number;
}

export function RatingScoreSummary({
  scoredCount,
  totalCategoriesCount,
  isComplete,
  weightedScore,
  scale,
}: RatingScoreSummaryProps) {
  return (
    <div
      className={`p-4 rounded-card border transition-all ${
        scoredCount === 0
          ? "bg-muted/30 border-border text-muted-foreground"
          : isComplete
            ? "bg-primary/10 border-primary/40 text-foreground"
            : "bg-card border-border-card text-foreground shadow-card"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">
            {scoredCount === 0
              ? "Your Overall Score · Unrated"
              : isComplete
                ? "Your Overall Score · Complete"
                : `Your Overall Score · In Progress (${scoredCount}/${totalCategoriesCount})`}
          </span>

          <div className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">
            {scoredCount === 0 ? (
              <span className="text-muted-foreground text-lg font-sans">No score yet</span>
            ) : (
              <span className="flex items-baseline gap-1">
                <span className="text-primary font-bold">
                  ★ {weightedScore !== null ? weightedScore.toFixed(2) : "—"}
                </span>
                <span className="text-xs font-sans text-muted-foreground">/ {scale}</span>
              </span>
            )}
          </div>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-xs font-semibold block">
            {scoredCount === 0 ? (
              <span className="text-muted-foreground">Unrated</span>
            ) : isComplete ? (
              <span className="text-primary">All {totalCategoriesCount} Categories Rated</span>
            ) : (
              <span>
                {scoredCount} of {totalCategoriesCount} Categories Rated
              </span>
            )}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">
            {scoredCount === 0
              ? "Interact with sliders above to begin scoring"
              : isComplete
                ? "All required categories completed · Ready to save"
                : "Complete all required categories to finalize"}
          </span>
        </div>
      </div>
    </div>
  );
}
