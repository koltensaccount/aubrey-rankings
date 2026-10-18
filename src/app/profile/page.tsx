import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { collections, ratings, user } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { ArrowRight, Settings } from "lucide-react";
import { getTmdbImageUrl } from "@/lib/tmdb";

export default async function ProfilePage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  // Load real user profile record
  const dbUser = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, session.user.id),
  });

  // Load real user data
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

  const allRatings = await db.query.ratings.findMany({
    where: (r, { eq }) => eq(r.userId, session.user.id),
    orderBy: [desc(ratings.updatedAt)],
    limit: 10,
    with: {
      mediaItem: true,
    },
  });

  const meanScore = allRatings.length
    ? (
        allRatings.reduce((acc, r) => acc + (r.calculatedOverallScore || 0), 0) /
        allRatings.length
      ).toFixed(1)
    : "—";

  const initial = (dbUser?.name || session.user.name || session.user.email || "a")
    .charAt(0)
    .toLowerCase();

  const publishedCollections = userCollections.filter((c) => c.visibility === "public");
  const pinned = userCollections.find((c) => c.isPinned) || userCollections[0];
  const reviews = allRatings.filter((r) => r.reviewText);

  const displayName = dbUser?.name || session.user.name || "Critic";
  const displayUsername = dbUser?.username || session.user.email?.split("@")[0] || "critic";
  const displayBio = dbUser?.bio || "Evaluating media by narrative rigor, visual texture, and weighted rubrics.";

  const avatarUrl = dbUser?.image || session.user.image;

  return (
    <div className="ar-homeContent ar-profilePage">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20">
        {/* =========================================================================
            1. COMPACT PROFILE IDENTITY HEADER (Letterboxd + Apple Simplicity)
            ========================================================================= */}
        <header className="ar-profileHeader">
          <div className="ar-profileBioRow">
            <div className="ar-profileAvatar overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="ar-profileIdentity">
              <div className="ar-profileNameLine">
                <h1>{displayName}</h1>
                <span className="ar-profileHandle">
                  @{displayUsername}
                </span>
                <span className="ar-profileBadge">Curator</span>
              </div>
              <p className="ar-profileBio">
                {displayBio}
              </p>
              <div className="ar-profileFollowStats">
                <span>
                  <strong>{totalRatedCount}</strong> items rated
                </span>
                <span>·</span>
                <span>
                  <strong>{publishedCollections.length}</strong> published rankings
                </span>
                {userCollections.length > publishedCollections.length && (
                  <>
                    <span>·</span>
                    <span className="text-[#8fa095]">
                      ({userCollections.length} total)
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="ar-profileActions">
              <Link
                href="/settings"
                className="ar-profileFollowBtn flex items-center gap-1.5"
                style={{ textDecoration: "none" }}
              >
                <Settings size={14} />
                <span>Edit Profile</span>
              </Link>
            </div>
          </div>

          {/* =========================================================================
              2. SUBTLE HORIZONTAL METADATA BAR (Approved Screen C)
              ========================================================================= */}
          <div className="ar-profileMetaBar">
            <span>
              <strong>{totalRatedCount}</strong> rated
            </span>
            <span className="ar-dot">·</span>
            <span>
              <strong>{userCollections.length}</strong> rankings
            </span>
            <span className="ar-dot">·</span>
            <span>
              <strong>{meanScore}</strong> mean score
            </span>
            <span className="ar-dot">·</span>
            <span className="ar-profileRubricSummary">Weighted Rubric</span>
          </div>
        </header>

        {/* =========================================================================
            PINNED RANKING FEATURE (When user has collections)
            ========================================================================= */}
        {pinned && (
          <section className="ar-profileSection">
            <div className="ar-profileSectionHeading">
              <h2>{pinned.isPinned ? "Pinned ranking" : "Featured ranking"}</h2>
              <span>{pinned.entries.length} items</span>
            </div>

            <article className="ar-profilePinnedCard">
              <Link href={`/collection/${pinned.id}`} className="ar-feedCover">
                <img
                  src={
                    pinned.backdropImage
                      ? getTmdbImageUrl(pinned.backdropImage, "original")
                      : pinned.customCoverImage
                        ? getTmdbImageUrl(pinned.customCoverImage, "w780")
                        : "/placeholders/backdrop-placeholder.svg"
                  }
                  alt={pinned.title}
                />
                <div className="ar-feedCoverShade" />
                <div>
                  <span>
                    {pinned.collectionType === "tv_show"
                      ? "TV Series"
                      : pinned.collectionType === "movie_franchise"
                        ? "Film Franchise"
                        : "Curated Collection"}{" "}
                    · {pinned.entries.length} entries
                  </span>
                  <h2>{pinned.title}</h2>
                </div>
                {(pinned as any).clearLogoUrl && (
                  <img
                    className="ar-feedCoverLogo"
                    src={(pinned as any).clearLogoUrl}
                    alt={pinned.title}
                  />
                )}
              </Link>

              {pinned.entries.length > 0 && (
                <Link
                  className="ar-rankingPeek"
                  href={`/collection/${pinned.id}`}
                  aria-label={`Preview ${pinned.title}`}
                >
                  {pinned.entries.slice(0, 3).map((ep, idx) => {
                    const r = pinned.ratings.find(
                      (rate) => rate.mediaItemId === ep.mediaItemId
                    );
                    return (
                      <div key={ep.id}>
                        <span>0{idx + 1}</span>
                        <img
                          src={
                            ep.mediaItem?.stillPath
                              ? getTmdbImageUrl(ep.mediaItem.stillPath, "w300")
                              : ep.mediaItem?.posterPath
                                ? getTmdbImageUrl(ep.mediaItem.posterPath, "w300")
                                : "/placeholders/backdrop-placeholder.svg"
                          }
                          alt={ep.mediaItem?.title || "Item"}
                        />
                        <strong>{ep.mediaItem?.title || `Item ${idx + 1}`}</strong>
                        <small>{r?.calculatedOverallScore ? r.calculatedOverallScore.toFixed(1) : "—"}</small>
                      </div>
                    );
                  })}
                </Link>
              )}

              <p className="ar-pinnedDesc">
                {pinned.description || "Weighted mathematical evaluation of writing, acting, cinematography, sound, and direction."}
              </p>
              <div className="ar-socialActions">
                <Link
                  href={`/collection/${pinned.id}`}
                  className="ar-textButton text-xs font-semibold"
                  style={{ textDecoration: "none" }}
                >
                  View complete ranking <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          </section>
        )}

        {/* =========================================================================
            USER COLLECTIONS STREAM
            ========================================================================= */}
        {userCollections.length > 1 && (
          <section className="ar-profileSection">
            <div className="ar-profileSectionHeading">
              <h2>All rankings</h2>
              <span>{publishedCollections.length} published ({userCollections.length} total)</span>
            </div>

            <div className="ar-feedStream">
              {userCollections
                .filter((c) => c.id !== pinned?.id)
                .map((col) => {
                  const avgScore = col.ratings.length
                    ? (
                        col.ratings.reduce(
                          (acc, r) => acc + (r.calculatedOverallScore || 0),
                          0
                        ) / col.ratings.length
                      ).toFixed(1)
                    : "—";

                  return (
                    <article key={col.id} className="ar-ordinaryPost" style={{ paddingTop: 20 }}>
                      <Link href={`/collection/${col.id}`} className="ar-smallRanking">
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
                            {col.collectionType === "tv_show" ? "TV Series" : "Canon"} · {col.entries.length} items · ★ {avgScore}
                          </span>
                          <h2>{col.title}</h2>
                          <p style={{ fontSize: 13, color: "#9caea2", lineHeight: 1.6, margin: "6px 0 10px" }}>
                            {col.description || "Ranked by narrative rigor and weighted categories."}
                          </p>
                          <ol>
                            {col.entries.slice(0, 3).map((e) => (
                              <li key={e.id}>{e.mediaItem?.title || "Item"}</li>
                            ))}
                          </ol>
                        </div>
                        <ArrowRight size={18} style={{ color: "#8fa597", flexShrink: 0 }} />
                      </Link>
                    </article>
                  );
                })}
            </div>
          </section>
        )}

        {/* =========================================================================
            RECENT REVIEWS (When available)
            ========================================================================= */}
        {reviews.length > 0 && (
          <section className="ar-profileSection">
            <div className="ar-profileSectionHeading">
              <h2>Recent reviews</h2>
              <span>From your critique journal</span>
            </div>

            <div className="ar-feedStream">
              {reviews.map((rev) => (
                <article key={rev.id} className="ar-ordinaryPost">
                  <header className="ar-postAuthor">
                    <span className="ar-personAvatar">{initial}</span>
                    <div>
                      <strong>{session.user.name || "Critic"}</strong>
                      <span>reviewed {rev.mediaItem?.title}</span>
                    </div>
                  </header>
                  <div className="ar-reviewBody">
                    <div>
                      <h3>{rev.mediaItem?.title}</h3>
                      <p>{rev.reviewText}</p>
                      <div className="ar-postScore">
                        <span>★ {rev.calculatedOverallScore ? rev.calculatedOverallScore.toFixed(1) : "—"}</span>
                        <i />
                        <small>Weighted score</small>
                      </div>
                    </div>
                    {rev.mediaItem?.stillPath && (
                      <img
                        src={getTmdbImageUrl(rev.mediaItem.stillPath, "w300")}
                        alt={rev.mediaItem?.title || "Still"}
                      />
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
