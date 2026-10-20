import Link from "next/link";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { collections, ratings, savedRankings, reviews } from "@/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import { Plus, ArrowRight, Tv, Film, ListPlus, Bookmark, FileText, PenLine, BookOpen } from "lucide-react";
import { getTmdbImageUrl } from "@/lib/tmdb";
import { getTopRankedEntries, getRatingSummary } from "@/lib/scoring";
import { SpoilerConcealedText } from "@/components/reviews/spoiler-concealed-text";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { reviewScoreOnTen } from "@/lib/review-rating";
import { AddToRankingButton } from "@/components/collections/add-to-ranking-dialog";

export default async function HomePage() {
  const session = await getServerSession();

  // =========================================================================
  // LOGGED OUT LANDING VIEW (Cinematic Editorial Presentation)
  // =========================================================================
  if (!session) {
    return (
      <div className="ar-homeContent">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <div className="relative rounded-2xl overflow-hidden bg-card border border-border p-8 sm:p-12 lg:p-16 shadow-lg">
            {/* Background 4K Still */}
            <div className="absolute inset-0 z-0">
              <img
                src="/placeholders/backdrop-placeholder.svg"
                alt="Cinema backdrop"
                className="w-full h-full object-cover object-center opacity-40 filter saturate-75"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
            </div>

            <div className="relative z-10 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary uppercase tracking-wider">
                <span>Cinema & TV Journal · Critique · Weighted Rankings</span>
              </div>

              {/* Aubrey Rankings Brand Mark */}
              <div className="py-1">
                <span className="font-display text-3xl sm:text-4xl uppercase tracking-widest text-primary font-bold drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                  AUBREY RANKINGS
                </span>
              </div>

              <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl tracking-tight text-foreground leading-[0.92] uppercase">
                Log. Critique.
                <br />
                <span className="text-primary">Rank What You Watch.</span>
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                Track and rate everything you watch in a personal cinema journal. Write critical reviews and selectively publish them to the community. Build weighted ranking rubrics for anthology television, director sagas, and custom collections.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <Link
                  href="/signup"
                  className="px-6 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-sm transition-all shadow-md"
                >
                  Get started
                </Link>
                <Link
                  href="/discover"
                  className="px-6 py-3.5 rounded-xl bg-secondary hover:bg-muted text-secondary-foreground border border-border font-semibold text-sm transition-all"
                >
                  Explore & Journal
                </Link>
                <Link
                  href="/login"
                  className="px-6 py-3.5 rounded-xl text-muted-foreground hover:text-foreground font-semibold text-sm transition-all"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>

          {/* Balanced Feature Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-12">
            <div className="p-6 rounded-xl border border-border bg-card space-y-3 shadow-sm">
              <span className="text-xs text-primary font-semibold uppercase tracking-wider block">Private Watch History</span>
              <h3 className="font-display text-2xl uppercase text-foreground">Personal Journal</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Log films and episodes as you watch. Score with quick or weighted rubrics, and keep personal notes and drafts visible only to you.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card space-y-3 shadow-sm">
              <span className="text-xs text-primary font-semibold uppercase tracking-wider block">Critical Writing</span>
              <h3 className="font-display text-2xl uppercase text-foreground">Reviews & Feed</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Publish longform critiques to the Community Feed, share unlisted direct links with friends, or keep entries strictly private.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card space-y-3 shadow-sm">
              <span className="text-xs text-primary font-semibold uppercase tracking-wider block">Anthology Television</span>
              <h3 className="font-display text-2xl uppercase text-foreground">Episode-by-Episode</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Import complete series like Black Mirror or Severance. Score each episode with 16:9 cinematic stills and weighted categories.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card space-y-3 shadow-sm">
              <span className="text-xs text-primary font-semibold uppercase tracking-wider block">Franchises & Sagas</span>
              <h3 className="font-display text-2xl uppercase text-foreground">Canons & Auteurs</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Rank complete director sagas from David Fincher, Christopher Nolan, or Denis Villeneuve with official key art and averages.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // =========================================================================
  // LOGGED IN USER COMMUNITY / LIBRARY FEED
  // =========================================================================
  const userCollections = await db.query.collections.findMany({
    where: (c, { eq }) => eq(c.userId, session.user.id),
    orderBy: [desc(collections.isPinned), desc(collections.updatedAt)],
    with: {
      entries: {
        with: {
          mediaItem: true,
        },
      },
      ratings: {with:{ratingSystem:{columns:{scale:true}}}},
    },
  });

  // Compute average score across user's ratings
  const allRatings = await db.query.ratings.findMany({
    where: (r, { eq }) => eq(r.userId, session.user.id),
    columns: { calculatedOverallScore: true,sourceRating:true,sourceScale:true },
    with:{ratingSystem:{columns:{scale:true}}},
  });
  const {meanScore,ratedCount:totalRatedCount} = getRatingSummary(allRatings);

  const pinnedCollection = userCollections.find((c) => c.isPinned) || userCollections[0];
  const otherCollections = userCollections.filter((c) => c.id !== pinnedCollection?.id);

  // User's saved rankings (bookmarks)
  const userSavedRankings = await db.query.savedRankings.findMany({
    where: (s, { eq }) => eq(s.userId, session.user.id),
    orderBy: [desc(savedRankings.createdAt)],
    with: {
      collection: {
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              username: true,
              image: true,
            },
          },
          entries: {
            limit: 4,
            with: { mediaItem: true },
          },
          ratings: { with: { ratingSystem: { columns: { scale: true } } } },
        },
      },
    },
  });

  const accessibleSavedCollections = userSavedRankings
    .filter((sr) => {
      if (!sr.collection) return false;
      const isOwner = sr.collection.userId === session.user.id;
      const isPublic =
        sr.collection.visibility !== "private" &&
        (sr.collection.visibility === "public" || sr.collection.visibility === "unlisted" || sr.collection.isPublic);
      return isOwner || isPublic;
    })
    .map((sr) => sr.collection);

  const userReviews = await db.query.reviews.findMany({
    where: (r, { eq }) => eq(r.userId, session.user.id),
    orderBy: [desc(reviews.updatedAt)],
    limit: 12,
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
  const linkedRatingIds = new Set(userReviews.map((review) => review.ratingId).filter(Boolean));
  const ratingOnlyJournalEntries = (await db.query.ratings.findMany({
    where: (r, { and, eq, isNull }) => and(eq(r.userId, session.user.id), isNull(r.collectionId)),
    orderBy: [desc(ratings.updatedAt)],
    with: {
      mediaItem: true,
      ratingSystem: { columns: { scale: true, type: true } },
      categoryScores: true,
    },
  })).filter((rating) => !linkedRatingIds.has(rating.id));
  const hasLibraryContent = userCollections.length > 0 || userReviews.length > 0 || ratingOnlyJournalEntries.length > 0 || accessibleSavedCollections.length > 0;

  return (
    <div className="ar-homeContent ar-communityHome">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 space-y-10" id="library">
        {/* Community / Feed Header */}
        <header className="ar-communityHeading">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Personal workspace</span>
            <h1 className="font-display text-4xl sm:text-5xl uppercase text-foreground tracking-tight mt-1">
              My Library
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/discover"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-colors shadow-sm"
            >
              <PenLine size={14} />
              <span>Add to Journal</span>
            </Link>
            <Link href="/create" className="ar-neutralButton">
              <Plus size={15} />
              <span>New ranking</span>
            </Link>
          </div>
        </header>

        {/* Subtle Horizontal Metadata Bar */}
        <div className="flex flex-wrap items-center gap-4 py-3 border-y border-border text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground font-semibold">{totalRatedCount}</strong> rated items
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span>
            <strong className="text-foreground font-semibold">{userCollections.length}</strong> rankings
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span>
            <strong className="text-primary font-semibold">{meanScore}</strong> mean /10
          </span>
          <span className="text-muted-foreground/60">·</span>
          <Link href="/journal" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
            <BookOpen size={13} />
            <span>My Journal ({userReviews.length + ratingOnlyJournalEntries.length})</span>
          </Link>
          <span className="text-muted-foreground/60">·</span>
          <Link href="/settings?tab=rating_systems" className="text-muted-foreground hover:text-foreground ml-auto font-medium hover:underline">
            Rating Systems
          </Link>
        </div>

        {/* =========================================================================
            EMPTY STATE (Both Journal and Ranking Pathways Clearly Presented)
            ========================================================================= */}
        {!hasLibraryContent ? (
          <div className="rounded-xl border border-border bg-card p-6 sm:p-10 space-y-6 shadow-sm">
            <div className="text-center max-w-lg mx-auto space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="font-display text-3xl uppercase text-foreground font-bold">
                Your Library is Waiting
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Start by logging a movie or episode in your personal Journal, or create an organized ranking collection.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto pt-2">
              {/* Journal Pathway */}
              <div className="p-5 rounded-xl border border-primary/30 bg-primary/5 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                    <PenLine size={14} />
                    <span>Option 1 · Quick & Personal</span>
                  </div>
                  <h4 className="font-display text-xl uppercase font-bold text-foreground">
                    Start Your Journal
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Log any movie or TV episode you just watched. Score it with a quick or detailed rating, save private notes, or draft a review.
                  </p>
                </div>
                <Link
                  href="/discover"
                  className="w-full py-2.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <PenLine size={13} />
                  <span>Search a Title to Journal</span>
                </Link>
              </div>

              {/* Ranking Pathway */}
              <div className="p-5 rounded-xl border border-border bg-card space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-muted-foreground font-bold text-xs uppercase tracking-wider">
                    <ListPlus size={14} />
                    <span>Option 2 · Structured Canons</span>
                  </div>
                  <h4 className="font-display text-xl uppercase font-bold text-foreground">
                    Create a Ranking
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Build a weighted ranking for an anthology TV series, a director filmography, or a custom movie collection.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <Link
                    href="/create?type=tv_show"
                    className="py-2 rounded-button bg-secondary hover:bg-muted text-secondary-foreground border border-border text-[10px] font-semibold flex items-center justify-center text-center transition-colors"
                  >
                    TV Series
                  </Link>
                  <Link
                    href="/create?type=movie_franchise"
                    className="py-2 rounded-button bg-secondary hover:bg-muted text-secondary-foreground border border-border text-[10px] font-semibold flex items-center justify-center text-center transition-colors"
                  >
                    Franchise
                  </Link>
                  <Link
                    href="/create?type=custom"
                    className="py-2 rounded-button bg-secondary hover:bg-muted text-secondary-foreground border border-border text-[10px] font-semibold flex items-center justify-center text-center transition-colors"
                  >
                    Custom
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {/* FEATURED / PINNED RANKING (Rendered with approved ar-feedCover presentation) */}
            {pinnedCollection && (
              <section className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <h2 className="font-display text-2xl uppercase text-foreground">
                    {pinnedCollection.isPinned ? "Pinned Ranking" : "Featured Ranking"}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {pinnedCollection.entries.length} items · {pinnedCollection.ratings.length} rated
                  </span>
                </div>

                <article className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
                  <Link
                    href={`/collection/${pinnedCollection.id}`}
                    className="ar-feedCover"
                  >
                    <img
                      src={
                        pinnedCollection.backdropImage
                          ? getTmdbImageUrl(pinnedCollection.backdropImage, "original")
                          : pinnedCollection.customCoverImage
                            ? getTmdbImageUrl(pinnedCollection.customCoverImage, "w780")
                            : "/placeholders/backdrop-placeholder.svg"
                      }
                      alt={pinnedCollection.title}
                    />
                    <div className="ar-feedCoverShade" />
                    <div>
                      <span>
                        {pinnedCollection.collectionType === "tv_show"
                          ? "TV Series"
                          : pinnedCollection.collectionType === "movie_franchise"
                            ? "Film Franchise"
                            : "Curated Collection"}{" "}
                        · {pinnedCollection.entries.length} entries
                      </span>
                      <h2>{pinnedCollection.title}</h2>
                    </div>

                    {(pinnedCollection as any).clearLogoUrl && (
                      <img
                        className="ar-feedCoverLogo"
                        src={(pinnedCollection as any).clearLogoUrl}
                        alt={pinnedCollection.title}
                      />
                    )}
                  </Link>

                  {/* Top 3 Items Preview */}
                  {pinnedCollection.entries.length > 0 && (
                    <Link
                      href={`/collection/${pinnedCollection.id}`}
                      className="ar-rankingPeek"
                      style={{ padding: "16px 22px 10px", borderTop: "1px solid var(--border)" }}
                    >
                      {getTopRankedEntries(pinnedCollection.entries, pinnedCollection.ratings).map(({ entry, rank, score }) => {
                        const isMovie =
                          pinnedCollection.collectionType === "movie_franchise" ||
                          entry.mediaItem?.mediaType === "movie" ||
                          (!entry.mediaItem?.seasonNumber && Boolean(entry.mediaItem?.posterPath));
                        const imgUrl = isMovie
                          ? entry.mediaItem?.posterPath
                            ? getTmdbImageUrl(entry.mediaItem.posterPath, "w300")
                            : "/placeholders/poster-placeholder.svg"
                          : entry.mediaItem?.stillPath
                            ? getTmdbImageUrl(entry.mediaItem.stillPath, "w300")
                            : entry.mediaItem?.posterPath
                              ? getTmdbImageUrl(entry.mediaItem.posterPath, "w300")
                              : "/placeholders/backdrop-placeholder.svg";

                        return (
                          <div key={entry.id}>
                            <span className="ar-peekRank">0{rank}</span>
                            <img
                              src={imgUrl}
                              alt={entry.mediaItem?.title || "Item"}
                              className={isMovie ? "ar-peekPoster" : "ar-peekStill"}
                            />
                            <div className="ar-peekMeta">
                              <strong>{entry.mediaItem?.title || `Item ${rank}`}</strong>
                              <small>{score !== null ? `★ ${score.toFixed(1)}` : "—"}</small>
                            </div>
                          </div>
                        );
                      })}
                    </Link>
                  )}

                  <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                    <p className="text-xs text-muted-foreground line-clamp-1 max-w-xl">
                      {pinnedCollection.description || "Personal media ranking with weighted category ratings."}
                    </p>
                    <Link
                      href={`/collection/${pinnedCollection.id}`}
                      className="ar-textButton text-xs font-semibold"
                    >
                      <span>Explore ranking</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </article>
              </section>
            )}

            {/* OTHER USER COLLECTIONS */}
            {otherCollections.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <h2 className="font-display text-2xl uppercase text-foreground">
                    All Rankings
                  </h2>
                  <span className="text-xs text-muted-foreground">{otherCollections.length} collections</span>
                </div>

                <div className="space-y-4">
                  {otherCollections.map((col) => {
                    const avgScore = col.ratings.length
                      ? (
                          col.ratings.reduce(
                            (acc, r) => acc + (r.calculatedOverallScore || 0),
                            0
                          ) / col.ratings.length
                        ).toFixed(1)
                      : "—";

                    return (
                      <article
                        key={col.id}
                        className="ar-ordinaryPost"
                        style={{ paddingTop: 18 }}
                      >
                        <Link
                          href={`/collection/${col.id}`}
                          className="ar-smallRanking"
                        >
                          <img
                            src={
                              col.customCoverImage
                                ? getTmdbImageUrl(col.customCoverImage, "w300")
                                : col.entries[0]?.mediaItem?.posterPath
                                  ? getTmdbImageUrl(col.entries[0].mediaItem.posterPath, "w300")
                                  : col.backdropImage
                                    ? getTmdbImageUrl(col.backdropImage, "w300")
                                    : "/placeholders/backdrop-placeholder.svg"
                            }
                            alt={col.title}
                          />
                          <div>
                            <span>
                              {col.collectionType === "tv_show" ? "TV Series" : "Franchise"} · {col.entries.length} items · ★ {avgScore}
                            </span>
                            <h2>{col.title}</h2>
                            <p className="text-xs text-muted-foreground line-clamp-2 my-1">
                              {col.description || "Weighted scores for narrative, direction, and sound."}
                            </p>
                            <ol>
                              {col.entries.slice(0, 3).map((e) => (
                                <li key={e.id}>{e.mediaItem?.title || "Item"}</li>
                              ))}
                            </ol>
                          </div>
                          <ArrowRight size={18} className="text-muted-foreground shrink-0" />
                        </Link>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {userReviews.length > 0 && (
          <section className="space-y-4 pt-6">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-primary" />
                <h2 className="font-display text-2xl uppercase text-foreground">Your Journal & Reviews</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{userReviews.length} recent</span>
                <Link href="/journal" className="text-xs font-semibold text-primary hover:underline">
                  View Full Journal →
                </Link>
              </div>
            </div>
            <div className="space-y-3">
              {userReviews.map((review) => {
                const isDraft = review.status === "draft" || review.status === "unpublished";
                const statusLabel = isDraft ? (review.status === "draft" ? "Draft" : "Unpublished") : (review.visibility === "private" ? "Private" : review.visibility === "unlisted" ? "Unlisted" : "Public");
                const normalizedScore = review.rating ? reviewScoreOnTen(review.rating) : null;
                const hasScore = normalizedScore !== null;
                const isEpisode = review.mediaItem?.mediaType === "episode" || Boolean(review.mediaItem?.seasonNumber && review.mediaItem?.episodeNumber);
                const epLabel = isEpisode && review.mediaItem?.seasonNumber && review.mediaItem?.episodeNumber
                  ? `S${String(review.mediaItem.seasonNumber).padStart(2, "0")}E${String(review.mediaItem.episodeNumber).padStart(2, "0")}`
                  : null;
                const entryType = hasScore ? (isDraft ? "Rating & Draft" : "Rating & Writing") : (isDraft ? "Draft" : "Writing Only");
                const targetLink = isDraft && review.isJournal
                  ? `/media/${review.mediaItemId}?journal=1`
                  : isDraft
                    ? `/review/${review.id}?edit=1`
                    : review.isJournal
                      ? `/media/${review.mediaItemId}?journal=1`
                      : `/review/${review.id}`;

                return (
                  <article key={review.id} className="rounded-card border border-border bg-card p-4 sm:p-5 hover:border-primary/40 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Artwork Thumbnail */}
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
                          <span className={isDraft ? "text-amber-600 dark:text-amber-400 font-bold" : "text-primary"}>
                            {statusLabel}
                          </span>
                          <span className="text-muted-foreground/60">·</span>
                          <span className="text-muted-foreground">{entryType}</span>
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
                              <span className="text-amber-600 dark:text-amber-400">Spoiler</span>
                            </>
                          )}
                          {normalizedScore !== null && (
                            <span className="ml-auto px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-bold text-xs">
                              ★ {normalizedScore.toFixed(1)} / 10
                            </span>
                          )}
                        </div>

                        <h3 className="font-display text-xl uppercase text-foreground mt-1">
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
                            format={(isDraft ? review.draftContentFormat || review.contentFormat : review.contentFormat) as "plain" | "markdown"}
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
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover px-2.5 py-1.5 rounded-button bg-surface border border-border"
                        >
                          {isDraft ? <PenLine size={13} /> : null}
                          <span>{isDraft ? "Resume" : "Open"}</span>
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {ratingOnlyJournalEntries.length > 0 && (
          <section className="space-y-4 pt-6">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-primary" />
                <h2 className="font-display text-2xl uppercase text-foreground">Rated in Your Journal</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{ratingOnlyJournalEntries.length} entries</span>
                <Link href="/journal" className="text-xs font-semibold text-primary hover:underline">
                  View Full Journal →
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ratingOnlyJournalEntries.map((rating) => {
                const isEpisode = rating.mediaItem?.mediaType === "episode" || Boolean(rating.mediaItem?.seasonNumber && rating.mediaItem?.episodeNumber);
                const epLabel = isEpisode && rating.mediaItem?.seasonNumber && rating.mediaItem?.episodeNumber
                  ? `S${String(rating.mediaItem.seasonNumber).padStart(2, "0")}E${String(rating.mediaItem.episodeNumber).padStart(2, "0")}`
                  : null;
                const normalizedScore = reviewScoreOnTen(rating);

                return (
                  <div
                    key={rating.id}
                    className="rounded-card border border-border bg-card p-4 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                  >
                    <Link
                      href={`/media/${rating.mediaItemId}?journal=1`}
                      className="min-w-0 flex-1 flex items-center gap-3"
                    >
                      <CinematicMediaCard
                        posterPath={rating.mediaItem?.posterPath || rating.mediaItem?.stillPath}
                        title={rating.mediaItem?.title || "Media"}
                        aspect={isEpisode ? "video" : "poster"}
                        className={isEpisode ? "w-20 shrink-0" : "w-12 shrink-0"}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase font-semibold text-muted-foreground">
                          <span>Private</span>
                          <span>·</span>
                          <span>Rating only</span>
                          {epLabel && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-[9px] font-bold text-foreground">{epLabel}</span>
                            </>
                          )}
                        </div>
                        <h3 className="font-semibold text-sm text-foreground truncate mt-0.5">{rating.mediaItem?.title}</h3>
                        <p className="text-xs text-primary font-bold mt-1">
                          {normalizedScore !== null ? `★ ${normalizedScore.toFixed(1)} / 10` : "Unrated"}
                        </p>
                      </div>
                    </Link>
                    <div className="shrink-0 flex items-center gap-2">
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
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SAVED RANKINGS (BOOKMARKS) */}
            {accessibleSavedCollections.length > 0 && (
              <section className="space-y-4 pt-6">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Bookmark size={16} className="text-primary fill-primary/20" />
                    <h2 className="font-display text-2xl uppercase text-foreground">
                      Saved Rankings
                    </h2>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {accessibleSavedCollections.length} saved
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {accessibleSavedCollections.map((col) => {
                    const creatorInitial = (
                      col.user.name ||
                      col.user.username ||
                      "U"
                    )
                      .charAt(0)
                      .toUpperCase();

                    return (
                      <article
                        key={col.id}
                        className="rounded-xl border border-border bg-card p-5 space-y-4 hover:border-primary/40 transition-colors shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <Link
                            href={
                              col.user.username ? `/u/${col.user.username}` : "#"
                            }
                            className="flex items-center gap-2.5 text-xs group"
                          >
                            <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary overflow-hidden">
                              {col.user.image ? (
                                <img
                                  src={col.user.image}
                                  alt={col.user.name || "User"}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                creatorInitial
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-foreground group-hover:text-primary transition-colors block leading-tight">
                                {col.user.name || `@${col.user.username}`}
                              </span>
                              {col.user.username && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  @{col.user.username}
                                </span>
                              )}
                            </div>
                          </Link>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                            {col.collectionType === "tv_show"
                              ? "TV Series"
                              : "Canon"}
                          </span>
                        </div>

                        <Link
                          href={`/collection/${col.id}`}
                          className="block space-y-1.5 group"
                        >
                          <h3 className="font-display text-xl uppercase text-foreground group-hover:text-primary transition-colors">
                            {col.title}
                          </h3>
                          {col.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                              {col.description}
                            </p>
                          )}
                        </Link>

                        <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
                          <span>{col.entries.length} items</span>
                          <Link
                            href={`/collection/${col.id}`}
                            className="inline-flex items-center gap-1 text-primary hover:text-primary-hover text-xs font-semibold"
                          >
                            <span>Explore saved ranking</span>
                            <ArrowRight size={13} />
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
      </div>
    </div>
  );
}
