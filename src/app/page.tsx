import Link from "next/link";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { collections, ratings, follows } from "@/db/schema";
import { desc, eq, sql, and, ne, or } from "drizzle-orm";
import { Plus, ArrowRight, Tv, Film, ListPlus, ArrowUpRight, Globe, Users } from "lucide-react";
import { getTmdbImageUrl } from "@/lib/tmdb";
import { getTopRankedEntries } from "@/lib/scoring";

export default async function HomePage() {
  const session = await getServerSession();

  // =========================================================================
  // LOGGED OUT LANDING VIEW (Cinematic Editorial Presentation)
  // =========================================================================
  if (!session) {
    return (
      <div className="ar-homeContent">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <div className="relative rounded-2xl overflow-hidden bg-[#141a17] border border-[#303b34] p-8 sm:p-12 lg:p-16">
            {/* Background 4K Still */}
            <div className="absolute inset-0 z-0">
              <img
                src="/placeholders/backdrop-placeholder.svg"
                alt="Cinema backdrop"
                className="w-full h-full object-cover object-center opacity-40 filter saturate-75"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#111514] via-[#111514]/85 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#111514] via-transparent to-transparent" />
            </div>

            <div className="relative z-10 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1b2520] border border-[#3b4c40] text-xs font-semibold text-[#89d5d5] uppercase tracking-wider">
                <span>Rank What You Watch</span>
              </div>

              {/* Aubrey Rankings Brand Mark */}
              <div className="py-1">
                <span className="font-display text-3xl sm:text-4xl uppercase tracking-widest text-[#89d5d5] font-bold drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                  AUBREY RANKINGS
                </span>
              </div>

              <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl tracking-tight text-[#f1f0e9] leading-[0.92] uppercase">
                Rank What
                <br />
                <span className="text-[#89d5d5]">You Watch.</span>
              </h1>

              <p className="text-base sm:text-lg text-[#b1bfb7] leading-relaxed max-w-xl">
                Rate TV anthologies, entire director filmographies, and custom collections by weighted rubrics:
                Writing, Acting, Cinematography, Sound Design, and Emotional Impact.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <Link
                  href="/signup"
                  className="px-6 py-3.5 rounded bg-[#89d5d5] hover:bg-[#a5dfdf] text-[#102523] font-semibold text-sm transition-all shadow-lg shadow-[#89d5d5]/15"
                >
                  Get started
                </Link>
                <Link
                  href="/login"
                  className="px-6 py-3.5 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#f1f0e9] border border-[#3b4c40] font-semibold text-sm transition-all"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>

          {/* Three Ranking Types Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
            <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-3">
              <span className="text-xs text-[#89d5d5] font-semibold uppercase tracking-wider block">Anthology Television</span>
              <h3 className="font-display text-2xl uppercase text-[#f1f0e9]">Episode-by-Episode</h3>
              <p className="text-xs text-[#9aa79e] leading-relaxed">
                Import complete series like Black Mirror or Severance. Score each episode with 16:9 cinematic stills and weighted categories.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-3">
              <span className="text-xs text-[#89d5d5] font-semibold uppercase tracking-wider block">Franchises & Sagas</span>
              <h3 className="font-display text-2xl uppercase text-[#f1f0e9]">Franchises & Auteurs</h3>
              <p className="text-xs text-[#9aa79e] leading-relaxed">
                Rank complete director sagas from David Fincher, Christopher Nolan, or Denis Villeneuve with official key art.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-3">
              <span className="text-xs text-[#89d5d5] font-semibold uppercase tracking-wider block">Custom Collections</span>
              <h3 className="font-display text-2xl uppercase text-[#f1f0e9]">Personal Indexes</h3>
              <p className="text-xs text-[#9aa79e] leading-relaxed">
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
      ratings: true,
    },
  });

  const totalRated = await db
    .select({ count: sql<number>`count(*)` })
    .from(ratings)
    .where(eq(ratings.userId, session.user.id));

  const totalRatedCount = Number(totalRated[0]?.count || 0);

  // Compute average score across user's ratings
  const allRatings = await db.query.ratings.findMany({
    where: (r, { eq }) => eq(r.userId, session.user.id),
    columns: { calculatedOverallScore: true },
  });
  const meanScore = allRatings.length
    ? (
        allRatings.reduce((acc, r) => acc + (r.calculatedOverallScore || 0), 0) /
        allRatings.length
      ).toFixed(1)
    : "—";

  const pinnedCollection = userCollections.find((c) => c.isPinned) || userCollections[0];
  const otherCollections = userCollections.filter((c) => c.id !== pinnedCollection?.id);

  // Community discovery canons
  const communityCanons = await db.query.collections.findMany({
    where: (c, { and, ne, or, eq }) =>
      and(
        ne(c.userId, session.user.id),
        eq(c.visibility, "public")
      ),
    orderBy: [desc(collections.updatedAt)],
    limit: 6,
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
      ratings: true,
    },
  });

  return (
    <div className="ar-homeContent ar-communityHome">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 space-y-10" id="library">
        {/* Community / Feed Header */}
        <header className="ar-communityHeading">
          <div>
            <span className="text-[11px] text-[#8fa095] uppercase tracking-wider block">Community Activity</span>
            <h1 className="font-display text-4xl sm:text-5xl uppercase text-[#f1f0e9] tracking-tight mt-1">
              Your Feed
            </h1>
          </div>
          <Link href="/create" className="ar-neutralButton">
            <Plus size={15} />
            <span>New ranking</span>
          </Link>
        </header>

        {/* Subtle Horizontal Metadata Bar */}
        <div className="flex flex-wrap items-center gap-4 py-3 border-y border-[#303b34] text-xs text-[#8fa095]">
          <span>
            <strong className="text-[#e5ece5] font-semibold">{totalRatedCount}</strong> rated items
          </span>
          <span className="text-[#435248]">·</span>
          <span>
            <strong className="text-[#e5ece5] font-semibold">{userCollections.length}</strong> rankings
          </span>
          <span className="text-[#435248]">·</span>
          <span>
            <strong className="text-[#89d5d5] font-semibold">{meanScore}</strong> mean score
          </span>
          <span className="text-[#435248]">·</span>
          <span className="text-[#89d5d5] ml-auto font-medium">Weighted Rubric</span>
        </div>

        {/* =========================================================================
            EMPTY STATE (Honest & Clean)
            ========================================================================= */}
        {userCollections.length === 0 ? (
          <div className="text-center py-20 px-4 rounded-xl border border-[#303b34] bg-[#141a17] space-y-5">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#1b2520] border border-[#3b4c40] flex items-center justify-center text-[#89d5d5]">
              <Film className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="font-display text-3xl uppercase text-[#f1f0e9]">Your library is waiting</h3>
              <p className="text-xs text-[#9aa79e] leading-relaxed">
                Create your first TV show, franchise, or custom collection to start rating with weighted rubrics.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link
                href="/create?type=tv_show&suggest=Black+Mirror"
                className="px-4 py-2.5 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#f1f0e9] border border-[#3b4c40] text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <Tv className="h-4 w-4 text-[#89d5d5]" />
                <span>Rank a TV Series</span>
              </Link>
              <Link
                href="/create?type=movie_franchise"
                className="px-4 py-2.5 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#f1f0e9] border border-[#3b4c40] text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <Film className="h-4 w-4 text-[#89d5d5]" />
                <span>Rank a Movie Franchise</span>
              </Link>
              <Link
                href="/create?type=custom"
                className="px-4 py-2.5 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#f1f0e9] border border-[#3b4c40] text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <ListPlus className="h-4 w-4 text-[#89d5d5]" />
                <span>Custom Collection</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {/* FEATURED / PINNED RANKING (Rendered with approved ar-feedCover presentation) */}
            {pinnedCollection && (
              <section className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#28342d]">
                  <h2 className="font-display text-2xl uppercase text-[#f1f0e9]">
                    {pinnedCollection.isPinned ? "Pinned Ranking" : "Featured Ranking"}
                  </h2>
                  <span className="text-xs text-[#8fa095]">
                    {pinnedCollection.entries.length} items · {pinnedCollection.ratings.length} rated
                  </span>
                </div>

                <article className="border border-[#303b34] rounded overflow-hidden bg-[#141a17]">
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
                      style={{ padding: "16px 22px 10px", borderTop: "1px solid #232d27" }}
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

                  <div className="px-5 py-3 border-t border-[#232d27] flex items-center justify-between">
                    <p className="text-xs text-[#9aa79e] line-clamp-1 max-w-xl">
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
                <div className="flex items-center justify-between pb-2 border-b border-[#28342d]">
                  <h2 className="font-display text-2xl uppercase text-[#f1f0e9]">
                    All Rankings
                  </h2>
                  <span className="text-xs text-[#8fa095]">{otherCollections.length} collections</span>
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
                            <p className="text-xs text-[#9aa79e] line-clamp-2 my-1">
                              {col.description || "Weighted scores for narrative, direction, and sound."}
                            </p>
                            <ol>
                              {col.entries.slice(0, 3).map((e) => (
                                <li key={e.id}>{e.mediaItem?.title || "Item"}</li>
                              ))}
                            </ol>
                          </div>
                          <ArrowRight size={18} className="text-[#8fa597] shrink-0" />
                        </Link>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {/* COMMUNITY RANKINGS & DISCOVERY */}
            {communityCanons.length > 0 && (
              <section className="space-y-4 pt-6">
                <div className="flex items-center justify-between pb-2 border-b border-[#28342d]">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-[#89d5d5]" />
                    <h2 className="font-display text-2xl uppercase text-[#f1f0e9]">
                      Community Rankings & Reviews
                    </h2>
                  </div>
                  <span className="text-xs text-[#8fa095]">
                    {communityCanons.length} public rankings
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {communityCanons.map((col) => {
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
                        className="rounded-xl border border-[#303b34] bg-[#141a17] p-5 space-y-4 hover:border-[#89d5d5]/40 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <Link
                            href={
                              col.user.username ? `/u/${col.user.username}` : "#"
                            }
                            className="flex items-center gap-2.5 text-xs group"
                          >
                            <div className="h-6 w-6 rounded-full bg-[#1b2520] border border-[#3b4c40] flex items-center justify-center font-bold text-[#89d5d5] overflow-hidden">
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
                              <span className="font-medium text-[#f1f0e9] group-hover:text-[#89d5d5] transition-colors block leading-tight">
                                {col.user.name || `@${col.user.username}`}
                              </span>
                              {col.user.username && (
                                <span className="text-[10px] text-[#5a6a61] font-mono">
                                  @{col.user.username}
                                </span>
                              )}
                            </div>
                          </Link>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#89d5d5] px-2 py-0.5 rounded bg-[#1b2520] border border-[#3b4c40]">
                            {col.collectionType === "tv_show"
                              ? "TV Series"
                              : "Canon"}
                          </span>
                        </div>

                        <Link
                          href={`/collection/${col.id}`}
                          className="block space-y-1.5 group"
                        >
                          <h3 className="font-display text-xl uppercase text-[#f1f0e9] group-hover:text-[#89d5d5] transition-colors">
                            {col.title}
                          </h3>
                          {col.description && (
                            <p className="text-xs text-[#9aa79e] line-clamp-2 leading-relaxed">
                              {col.description}
                            </p>
                          )}
                        </Link>

                        <div className="flex items-center justify-between pt-2 border-t border-[#232d27] text-xs text-[#6e7f74]">
                          <span>{col.entries.length} items</span>
                          <Link
                            href={`/collection/${col.id}`}
                            className="inline-flex items-center gap-1 text-[#89d5d5] hover:text-[#cef6f0] text-xs font-semibold"
                          >
                            <span>Explore canon</span>
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
        )}
      </div>
    </div>
  );
}
