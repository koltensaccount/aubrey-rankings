import Link from "next/link";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { collections, ratings, savedRankings, reviews } from "@/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import { Plus, ArrowRight, Tv, Film, ListPlus, Bookmark, FileText, PenLine } from "lucide-react";
import { getTmdbImageUrl } from "@/lib/tmdb";
import { getTopRankedEntries, getRatingSummary } from "@/lib/scoring";
import { SpoilerConcealedText } from "@/components/reviews/spoiler-concealed-text";
import { CinematicMediaCard } from "@/components/cinematic-media-card";

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
                <span>Rank What You Watch</span>
              </div>

              {/* Aubrey Rankings Brand Mark */}
              <div className="py-1">
                <span className="font-display text-3xl sm:text-4xl uppercase tracking-widest text-primary font-bold drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                  AUBREY RANKINGS
                </span>
              </div>

              <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl tracking-tight text-foreground leading-[0.92] uppercase">
                Rank What
                <br />
                <span className="text-primary">You Watch.</span>
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                Rate TV anthologies, entire director filmographies, and custom collections by weighted rubrics:
                Writing, Acting, Cinematography, Sound Design, and Emotional Impact.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <Link
                  href="/signup"
                  className="px-6 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-sm transition-all shadow-md"
                >
                  Get started
                </Link>
                <Link
                  href="/login"
                  className="px-6 py-3.5 rounded-xl bg-secondary hover:bg-muted text-secondary-foreground border border-border font-semibold text-sm transition-all"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>

          {/* Three Ranking Types Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
            <div className="p-6 rounded-xl border border-border bg-card space-y-3 shadow-sm">
              <span className="text-xs text-primary font-semibold uppercase tracking-wider block">Anthology Television</span>
              <h3 className="font-display text-2xl uppercase text-foreground">Episode-by-Episode</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Import complete series like Black Mirror or Severance. Score each episode with 16:9 cinematic stills and weighted categories.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card space-y-3 shadow-sm">
              <span className="text-xs text-primary font-semibold uppercase tracking-wider block">Franchises & Sagas</span>
              <h3 className="font-display text-2xl uppercase text-foreground">Franchises & Auteurs</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Rank complete director sagas from David Fincher, Christopher Nolan, or Denis Villeneuve with official key art.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card space-y-3 shadow-sm">
              <span className="text-xs text-primary font-semibold uppercase tracking-wider block">Custom Collections</span>
              <h3 className="font-display text-2xl uppercase text-foreground">Personal Indexes</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Mix movies, single episodes, and miniseries in custom collections like &quot;Sci-Fi Anthology Essentials&quot;.
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
      rating: { columns: { calculatedOverallScore: true, sourceRating: true } },
    },
  });
  const linkedRatingIds = new Set(userReviews.map((review) => review.ratingId).filter(Boolean));
  const ratingOnlyJournalEntries = (await db.query.ratings.findMany({
    where: (r, { and, eq, isNull }) => and(eq(r.userId, session.user.id), isNull(r.collectionId)),
    orderBy: [desc(ratings.updatedAt)],
    with: { mediaItem: true },
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
          <Link href="/create" className="ar-neutralButton">
            <Plus size={15} />
            <span>New ranking</span>
          </Link>
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
          <Link href="/settings?tab=rating_systems" className="text-primary ml-auto font-medium hover:underline">
            Rating Systems
          </Link>
        </div>

        {/* =========================================================================
            EMPTY STATE (Honest & Clean)
            ========================================================================= */}
        {!hasLibraryContent ? (
          <div className="text-center py-20 px-4 rounded-xl border border-border bg-card space-y-5 shadow-sm">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Film className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="font-display text-3xl uppercase text-foreground">Your library is waiting</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
            Start with a TV show, franchise, or custom collection. Your private rankings, reviews, and drafts will live here.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link
                href="/create?type=tv_show"
                className="px-4 py-2.5 rounded-lg bg-secondary hover:bg-muted text-secondary-foreground border border-border text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <Tv className="h-4 w-4 text-primary" />
                <span>Rank a TV Series</span>
              </Link>
              <Link
                href="/create?type=movie_franchise"
                className="px-4 py-2.5 rounded-lg bg-secondary hover:bg-muted text-secondary-foreground border border-border text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <Film className="h-4 w-4 text-primary" />
                <span>Rank a Movie Franchise</span>
              </Link>
              <Link
                href="/create?type=custom"
                className="px-4 py-2.5 rounded-lg bg-secondary hover:bg-muted text-secondary-foreground border border-border text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <ListPlus className="h-4 w-4 text-primary" />
                <span>Custom Collection</span>
              </Link>
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
                <FileText size={16} className="text-primary" />
                <h2 className="font-display text-2xl uppercase text-foreground">Your Reviews</h2>
              </div>
              <span className="text-xs text-muted-foreground">{userReviews.length} recent</span>
            </div>
            <div className="space-y-3">
              {userReviews.map((review) => {
                const isDraft = review.status === "draft" || review.status === "unpublished";
                const statusLabel = isDraft ? (review.status === "draft" ? "Draft" : "Unpublished") : review.visibility;
                return (
                  <article key={review.id} className="rounded-card border border-border bg-card p-4 sm:p-5">
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
                          <span className={isDraft ? "text-amber-600 dark:text-amber-400" : "text-primary"}>{statusLabel}</span>
                          {review.isSpoiler && <span className="text-muted-foreground">Spoiler</span>}
                        </div>
                        <h3 className="font-display text-xl uppercase text-foreground mt-1">{review.title || review.mediaItem?.title || "Untitled review"}</h3>
                        {review.title && review.mediaItem?.title && <p className="text-xs text-muted-foreground">on {review.mediaItem.title}</p>}
                        <SpoilerConcealedText content={isDraft ? (review.draftContent || review.content) : review.content} format={(isDraft ? review.draftContentFormat || review.contentFormat : review.contentFormat) as "plain" | "markdown"} isSpoiler={review.isSpoiler} />
                      </div>
                      <Link href={isDraft && review.isJournal ? `/media/${review.mediaItemId}?journal=1` : isDraft ? `/review/${review.id}?edit=1` : `/review/${review.id}`} className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover">
                        {isDraft ? <PenLine size={14} /> : null}
                        {isDraft ? "Resume" : "Open"}
                      </Link>
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
                <FileText size={16} className="text-primary" />
                <h2 className="font-display text-2xl uppercase text-foreground">Rated in Your Journal</h2>
              </div>
              <span className="text-xs text-muted-foreground">{ratingOnlyJournalEntries.length} entries</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ratingOnlyJournalEntries.map((rating) => (
                <Link key={rating.id} href={`/media/${rating.mediaItemId}`} className="rounded-card border border-border bg-card p-4 flex items-center gap-3 hover:border-primary/40 transition-colors">
                  <CinematicMediaCard posterPath={rating.mediaItem?.posterPath} title={rating.mediaItem?.title || "Media"} aspect="poster" className="w-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm text-foreground truncate">{rating.mediaItem?.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">Rating only · {rating.calculatedOverallScore !== null ? `★ ${rating.calculatedOverallScore.toFixed(1)} / 10` : "Unrated"}</p>
                  </div>
                </Link>
              ))}
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
