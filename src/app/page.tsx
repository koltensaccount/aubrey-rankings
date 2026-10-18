import Link from "next/link";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { collections, ratings, follows } from "@/db/schema";
import { desc, eq, sql, and, ne, or } from "drizzle-orm";
import { Plus, ArrowRight, Tv, Film, ListPlus, ArrowUpRight, Globe, Users } from "lucide-react";
import { getTmdbImageUrl } from "@/lib/tmdb";

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
                src="/prototype-art/black-mirror-wall.jpg"
                alt="Cinema backdrop"
                className="w-full h-full object-cover object-center opacity-30 filter saturate-75"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#111514] via-[#111514]/85 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#111514] via-transparent to-transparent" />
            </div>

            <div className="relative z-10 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1b2520] border border-[#3b4c40] text-xs font-semibold text-[#89d5d5] uppercase tracking-wider">
                <span>Modern Cinema Editorial</span>
              </div>

              {/* Transparent ClearLOGO */}
              <div className="py-1">
                <img
                  src="/prototype-art/black-mirror-logo.png"
                  alt="Black Mirror"
                  className="h-14 sm:h-16 w-auto object-contain filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)]"
                />
              </div>

              <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl tracking-tight text-[#f1f0e9] leading-[0.92] uppercase">
                EVERY EPISODE,
                <br />
                <span className="text-[#89d5d5]">RANKED AND CALIBRATED.</span>
              </h1>

              <p className="text-base sm:text-lg text-[#b1bfb7] leading-relaxed max-w-xl">
                Rate TV anthologies, entire director filmographies, and custom sci-fi indexes by weighted sensory rubrics:
                Writing, Acting, Cinematography, Sound Design, and resonant dread.
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
                <Link
                  href="/prototype"
                  className="px-5 py-3.5 rounded text-[#89d5d5] hover:text-[#cef6f0] text-sm font-semibold transition-colors flex items-center gap-1.5"
                >
                  <span>Explore prototype</span>
                  <ArrowRight size={15} />
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
              <span className="text-xs text-[#89d5d5] font-semibold uppercase tracking-wider block">Director Canons</span>
              <h3 className="font-display text-2xl uppercase text-[#f1f0e9]">Franchises & Auteurs</h3>
              <p className="text-xs text-[#9aa79e] leading-relaxed">
                Rank complete director sagas from David Fincher, Christopher Nolan, or Denis Villeneuve with official key art.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-3">
              <span className="text-xs text-[#89d5d5] font-semibold uppercase tracking-wider block">Custom Collections</span>
              <h3 className="font-display text-2xl uppercase text-[#f1f0e9]">Personal Indexes</h3>
              <p className="text-xs text-[#9aa79e] leading-relaxed">
                Mix movies, single episodes, and miniseries in custom collections like &quot;Modern Dystopian Sci-Fi: The Master Index&quot;.
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
        or(eq(c.visibility, "public"), eq(c.isPublic, true))
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
            <span className="text-[11px] text-[#8fa095] uppercase tracking-wider block">Library & Dispatch</span>
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
          <span className="text-[#89d5d5] ml-auto font-medium">5-part weighted rubric</span>
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
                <span>Rank Black Mirror</span>
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
                        pinnedCollection.title.toLowerCase().includes("black mirror")
                          ? "/prototype-art/black-mirror-wall.jpg"
                          : pinnedCollection.backdropImage
                            ? pinnedCollection.backdropImage
                            : "/prototype-art/black-mirror-wall.jpg"
                      }
                      alt={pinnedCollection.title}
                    />
                    <div className="ar-feedCoverShade" />
                    <div>
                      <span>
                        {pinnedCollection.collectionType === "tv_show"
                          ? "TV Anthology"
                          : pinnedCollection.collectionType === "movie_franchise"
                            ? "Movie Canon"
                            : "Custom Collection"}{" "}
                        · {pinnedCollection.entries.length} entries
                      </span>
                      <h2>{pinnedCollection.title}</h2>
                    </div>

                    {pinnedCollection.title.toLowerCase().includes("black mirror") && (
                      <img
                        className="ar-feedCoverLogo"
                        src="/prototype-art/black-mirror-logo.png"
                        alt="Black Mirror"
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
                      {pinnedCollection.entries.slice(0, 3).map((entry, idx) => {
                        const r = pinnedCollection.ratings.find(
                          (rate) => rate.mediaItemId === entry.mediaItemId
                        );
                        return (
                          <div key={entry.id}>
                            <span>0{idx + 1}</span>
                            <img
                              src={
                                entry.mediaItem?.stillPath
                                  ? getTmdbImageUrl(entry.mediaItem.stillPath, "w300")
                                  : entry.mediaItem?.posterPath
                                    ? getTmdbImageUrl(entry.mediaItem.posterPath, "w300")
                                    : "/prototype-art/san-junipero.jpg"
                              }
                              alt={entry.mediaItem?.title || "Item"}
                            />
                            <strong>{entry.mediaItem?.title || `Item ${idx + 1}`}</strong>
                            <small>{r?.calculatedOverallScore ? r.calculatedOverallScore.toFixed(1) : "—"}</small>
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
                              col.customCoverImage ||
                              (col.entries[0]?.mediaItem?.posterPath
                                ? getTmdbImageUrl(col.entries[0].mediaItem.posterPath, "w300")
                                : col.backdropImage || "/prototype-art/san-junipero.jpg")
                            }
                            alt={col.title}
                          />
                          <div>
                            <span>
                              {col.collectionType === "tv_show" ? "TV Series" : "Franchise"} · {col.entries.length} items · ★ {avgScore}
                            </span>
                            <h2>{col.title}</h2>
                            <p className="text-xs text-[#9aa79e] line-clamp-2 my-1">
                              {col.description || "Weighted sensory scores for narrative, direction, and sound."}
                            </p>
                            <ol>
                              {col.entries.slice(0, 3).map((e) => (
                                <li key={e.id}>{e.mediaItem?.title || "Episode"}</li>
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

            {/* COMMUNITY DISPATCH & DISCOVERY */}
            {communityCanons.length > 0 && (
              <section className="space-y-4 pt-6">
                <div className="flex items-center justify-between pb-2 border-b border-[#28342d]">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-[#89d5d5]" />
                    <h2 className="font-display text-2xl uppercase text-[#f1f0e9]">
                      Community Dispatches & Canons
                    </h2>
                  </div>
                  <span className="text-xs text-[#8fa095]">
                    {communityCanons.length} public canons
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
