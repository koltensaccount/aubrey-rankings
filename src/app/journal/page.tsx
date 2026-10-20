import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { ratings, reviews } from "@/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import { BookOpen, PenLine, Plus, Star, Search, Filter } from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { SpoilerConcealedText } from "@/components/reviews/spoiler-concealed-text";
import { reviewScoreOnTen } from "@/lib/review-rating";
import { AddToRankingButton } from "@/components/collections/add-to-ranking-dialog";

export default async function JournalPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>;
}) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login?redirect=/journal");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeFilter = resolvedSearchParams.filter || "all";

  // Fetch all reviews/journal entries for user
  const userReviews = await db.query.reviews.findMany({
    where: (r, { eq }) => eq(r.userId, session.user.id),
    orderBy: [desc(reviews.updatedAt)],
    with: {
      mediaItem: true,
      rating: {
        with: {
          ratingSystem: { columns: { scale: true, type: true } },
          categoryScores: true,
        },
      },
    },
  });

  // Fetch rating-only journal entries (standalone ratings with no collectionId and not linked to a review)
  const linkedRatingIds = new Set(userReviews.map((r) => r.ratingId).filter(Boolean));
  const standaloneRatings = (
    await db.query.ratings.findMany({
      where: (r, { and, eq, isNull }) =>
        and(eq(r.userId, session.user.id), isNull(r.collectionId)),
      orderBy: [desc(ratings.updatedAt)],
      with: {
        mediaItem: true,
        ratingSystem: { columns: { scale: true, type: true } },
        categoryScores: true,
      },
    })
  ).filter((rating) => !linkedRatingIds.has(rating.id));

  // Counts for summary metrics
  const totalEntries = userReviews.length + standaloneRatings.length;
  const draftReviews = userReviews.filter((r) => r.status === "draft" || r.status === "unpublished");
  const publishedReviews = userReviews.filter((r) => r.status === "published");

  // Calculate average score across user's journal entries
  const allScores: number[] = [];
  userReviews.forEach((r) => {
    if (r.rating) {
      const score = reviewScoreOnTen(r.rating);
      if (score !== null) allScores.push(score);
    }
  });
  standaloneRatings.forEach((r) => {
    const score = reviewScoreOnTen(r);
    if (score !== null) allScores.push(score);
  });
  const meanJournalScore = allScores.length
    ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
    : "—";

  // Filter items based on active tab
  const showReviews = activeFilter !== "ratings";
  const showRatings = activeFilter === "all" || activeFilter === "ratings";

  const filteredReviews = userReviews.filter((r) => {
    if (activeFilter === "drafts") return r.status === "draft" || r.status === "unpublished";
    if (activeFilter === "published") return r.status === "published";
    return true;
  });

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">
              <BookOpen size={12} />
              <span>Personal Watch History</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl uppercase tracking-tight text-foreground font-bold">
              My Journal
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Your personal log of cinema and television. Private scores, drafts, critical analyses, and published reviews.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Link
              href="/discover"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs transition-colors shadow-sm"
            >
              <Plus size={14} />
              <span>Add to Journal</span>
            </Link>
          </div>
        </header>

        {/* Journal Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              Total Logged
            </span>
            <span className="font-display text-2xl font-bold text-foreground mt-0.5 block">
              {totalEntries}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              Drafts & Private
            </span>
            <span className="font-display text-2xl font-bold text-foreground mt-0.5 block">
              {draftReviews.length + standaloneRatings.length}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              Published
            </span>
            <span className="font-display text-2xl font-bold text-foreground mt-0.5 block">
              {publishedReviews.length}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              Mean Score
            </span>
            <span className="font-display text-2xl font-bold text-primary mt-0.5 block">
              {meanJournalScore} <span className="text-xs font-normal text-muted-foreground">/ 10</span>
            </span>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex items-center gap-1.5 border-b border-border pb-px text-xs overflow-x-auto scrollbar-none">
          <Link
            href="/journal"
            className={`px-3 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
              activeFilter === "all"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            All Entries ({totalEntries})
          </Link>
          <Link
            href="/journal?filter=drafts"
            className={`px-3 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
              activeFilter === "drafts"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Drafts ({draftReviews.length})
          </Link>
          <Link
            href="/journal?filter=published"
            className={`px-3 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
              activeFilter === "published"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Published Reviews ({publishedReviews.length})
          </Link>
          <Link
            href="/journal?filter=ratings"
            className={`px-3 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
              activeFilter === "ratings"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Rating Only ({standaloneRatings.length})
          </Link>
        </div>

        {/* Empty State */}
        {totalEntries === 0 ? (
          <div className="text-center py-20 px-4 rounded-xl border border-border bg-card space-y-5 shadow-sm">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="font-display text-2xl uppercase text-foreground font-bold">
                Your Journal is Empty
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Log any film or TV episode you watch. Score it with quick or weighted rubrics, write private notes or drafts, and choose if you want to publish.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/discover"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs transition-colors shadow-sm"
              >
                <Search size={14} />
                <span>Search a Title to Journal</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Reviews & Journal Writings */}
            {showReviews &&
              filteredReviews.map((review) => {
                const isDraft = review.status === "draft" || review.status === "unpublished";
                const isEpisode =
                  review.mediaItem?.mediaType === "episode" ||
                  Boolean(review.mediaItem?.seasonNumber && review.mediaItem?.episodeNumber);
                const epLabel =
                  isEpisode && review.mediaItem?.seasonNumber && review.mediaItem?.episodeNumber
                    ? `S${String(review.mediaItem.seasonNumber).padStart(2, "0")}E${String(review.mediaItem.episodeNumber).padStart(2, "0")}`
                    : null;
                const normalizedScore = review.rating ? reviewScoreOnTen(review.rating) : null;
                const targetLink = `/media/${review.mediaItemId}?journal=1`;

                return (
                  <article
                    key={review.id}
                    className="rounded-xl border border-border bg-card p-4 sm:p-5 hover:border-primary/40 transition-colors shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <Link href={targetLink} className="shrink-0">
                        <CinematicMediaCard
                          posterPath={review.mediaItem?.posterPath || review.mediaItem?.stillPath}
                          title={review.mediaItem?.title || "Media"}
                          aspect={isEpisode ? "video" : "poster"}
                          className={isEpisode ? "w-24 sm:w-28" : "w-14 sm:w-16"}
                        />
                      </Link>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
                          <span
                            className={
                              isDraft
                                ? "text-primary font-bold"
                                : review.visibility === "public"
                                  ? "text-primary"
                                  : "text-muted-foreground"
                            }
                          >
                            {isDraft
                              ? "Draft"
                              : review.visibility === "public"
                                ? "Published Public"
                                : review.visibility === "unlisted"
                                  ? "Unlisted"
                                  : "Private Entry"}
                          </span>
                          <span className="text-muted-foreground/60">·</span>
                          <span className="text-muted-foreground">
                            {review.mediaItem?.mediaType === "episode" ? "TV Episode" : "Film"}
                          </span>
                          {epLabel && (
                            <>
                              <span className="text-muted-foreground/60">·</span>
                              <span className="px-1.5 py-0.2 rounded bg-surface border border-border font-mono text-[9px] text-foreground font-bold">
                                {epLabel}
                              </span>
                            </>
                          )}
                          {review.isSpoiler && (
                            <>
                              <span className="text-muted-foreground/60">·</span>
                              <span className="text-primary">Spoiler Warning</span>
                            </>
                          )}
                          {normalizedScore !== null && (
                            <span className="ml-auto px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-bold text-xs">
                              ★ {normalizedScore.toFixed(1)} / 10
                            </span>
                          )}
                        </div>

                        <h3 className="font-display text-xl uppercase text-foreground mt-1 font-bold">
                          <Link href={targetLink} className="hover:text-primary transition-colors">
                            {review.title || review.mediaItem?.title || "Untitled journal entry"}
                          </Link>
                        </h3>

                        {review.title && review.mediaItem?.title && (
                          <p className="text-xs text-muted-foreground">
                            on {review.mediaItem.title}
                          </p>
                        )}

                        <div className="mt-2 text-xs text-muted-foreground">
                          <SpoilerConcealedText
                            content={isDraft ? (review.draftContent || review.content) : review.content}
                            format={
                              (isDraft
                                ? review.draftContentFormat || review.contentFormat
                                : review.contentFormat) as "plain" | "markdown"
                            }
                            isSpoiler={review.isSpoiler}
                          />
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2 self-center">
                        <AddToRankingButton
                          mediaItemId={review.mediaItemId}
                          mediaTitle={review.mediaItem?.title || "Media"}
                          mediaType={review.mediaItem?.mediaType as any}
                          seasonNumber={review.mediaItem?.seasonNumber}
                          episodeNumber={review.mediaItem?.episodeNumber}
                          posterPath={review.mediaItem?.posterPath}
                          stillPath={review.mediaItem?.stillPath}
                          variant="icon"
                        />
                        <Link
                          href={targetLink}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover px-3 py-1.5 rounded-button bg-surface border border-border hover:bg-surface-elevated transition-colors"
                        >
                          {isDraft ? <PenLine size={13} /> : null}
                          <span>{isDraft ? "Resume Draft" : "Open & Edit"}</span>
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}

            {/* Standalone Rating-Only Entries */}
            {showRatings &&
              standaloneRatings.map((rating) => {
                const isEpisode =
                  rating.mediaItem?.mediaType === "episode" ||
                  Boolean(rating.mediaItem?.seasonNumber && rating.mediaItem?.episodeNumber);
                const epLabel =
                  isEpisode && rating.mediaItem?.seasonNumber && rating.mediaItem?.episodeNumber
                    ? `S${String(rating.mediaItem.seasonNumber).padStart(2, "0")}E${String(rating.mediaItem.episodeNumber).padStart(2, "0")}`
                    : null;
                const normalizedScore = reviewScoreOnTen(rating);
                const targetLink = `/media/${rating.mediaItemId}?journal=1`;

                return (
                  <article
                    key={rating.id}
                    className="rounded-xl border border-border bg-card p-4 sm:p-5 hover:border-primary/40 transition-colors shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <Link href={targetLink} className="shrink-0">
                        <CinematicMediaCard
                          posterPath={rating.mediaItem?.posterPath || rating.mediaItem?.stillPath}
                          title={rating.mediaItem?.title || "Media"}
                          aspect={isEpisode ? "video" : "poster"}
                          className={isEpisode ? "w-24 sm:w-28" : "w-14 sm:w-16"}
                        />
                      </Link>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
                          <span className="text-muted-foreground">Private Rating</span>
                          <span className="text-muted-foreground/60">·</span>
                          <span className="text-muted-foreground">
                            {rating.mediaItem?.mediaType === "episode" ? "TV Episode" : "Film"}
                          </span>
                          {epLabel && (
                            <>
                              <span className="text-muted-foreground/60">·</span>
                              <span className="px-1.5 py-0.2 rounded bg-surface border border-border font-mono text-[9px] text-foreground font-bold">
                                {epLabel}
                              </span>
                            </>
                          )}
                          {normalizedScore !== null && (
                            <span className="ml-auto px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-bold text-xs">
                              ★ {normalizedScore.toFixed(1)} / 10
                            </span>
                          )}
                        </div>

                        <h3 className="font-display text-xl uppercase text-foreground mt-1 font-bold">
                          <Link href={targetLink} className="hover:text-primary transition-colors">
                            {rating.mediaItem?.title || "Untitled Title"}
                          </Link>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Rated in your Journal. Click to add writing or adjust your score.
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-2 self-center">
                        <AddToRankingButton
                          mediaItemId={rating.mediaItemId}
                          mediaTitle={rating.mediaItem?.title || "Media"}
                          mediaType={rating.mediaItem?.mediaType as any}
                          seasonNumber={rating.mediaItem?.seasonNumber}
                          episodeNumber={rating.mediaItem?.episodeNumber}
                          posterPath={rating.mediaItem?.posterPath}
                          stillPath={rating.mediaItem?.stillPath}
                          variant="icon"
                        />
                        <Link
                          href={targetLink}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover px-3 py-1.5 rounded-button bg-surface border border-border hover:bg-surface-elevated transition-colors"
                        >
                          <PenLine size={13} />
                          <span>Add Writing</span>
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
