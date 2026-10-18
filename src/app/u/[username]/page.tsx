import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { user, collections, ratings, follows } from "@/db/schema";
import { eq, and, desc, sql, isNotNull } from "drizzle-orm";
import { getServerSession } from "@/lib/server-session";
import { normalizeUsername } from "@/lib/username";
import { getTmdbImageUrl } from "@/lib/tmdb";
import { FollowButton } from "@/components/social/follow-button";
import {
  ArrowRight,
  Calendar,
  Layers,
  MessageSquare,
  Sparkles,
  Share2,
  Lock,
  Globe,
  Star,
} from "lucide-react";

interface PublicProfileProps {
  params: Promise<{ username: string }>;
}

export default async function PublicProfilePage({ params }: PublicProfileProps) {
  const { username: rawUsername } = await params;
  const username = normalizeUsername(rawUsername);

  // 1. Fetch user by case-insensitive username
  const targetUser = await db.query.user.findFirst({
    where: (u, { sql }) => sql`LOWER(${u.username}) = LOWER(${username})`,
  });

  if (!targetUser) {
    notFound();
  }

  const session = await getServerSession();
  const isOwnProfile = session?.user?.id === targetUser.id;

  // 2. Fetch public collections only (Strict privacy enforcement)
  const publicCollections = await db.query.collections.findMany({
    where: (c, { eq, and }) =>
      and(eq(c.userId, targetUser.id), eq(c.visibility, "public")),
    orderBy: [desc(collections.isPinned), desc(collections.updatedAt)],
    with: {
      entries: {
        with: {
          mediaItem: true,
        },
      },
      defaultRatingSystem: true,
    },
  });

  // 3. Fetch user's ratings for public collections
  const collectionIds = publicCollections.map((c) => c.id);
  const userRatings =
    collectionIds.length > 0
      ? await db.query.ratings.findMany({
          where: (r, { eq, and, inArray }) =>
            and(eq(r.userId, targetUser.id), inArray(r.collectionId, collectionIds)),
        })
      : [];

  // 4. Fetch recent public reviews (stripping private personal notes)
  const publicReviews = await db.query.ratings.findMany({
    where: (r, { eq, and, isNotNull }) =>
      and(eq(r.userId, targetUser.id), isNotNull(r.reviewText)),
    orderBy: [desc(ratings.updatedAt)],
    limit: 8,
    with: {
      mediaItem: true,
    },
  });

  // 5. Fetch follow stats
  const followersCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followingId, targetUser.id));
  const followersCount = Number(followersCountRes[0]?.count || 0);

  const followingCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followerId, targetUser.id));
  const followingCount = Number(followingCountRes[0]?.count || 0);

  let isFollowing = false;
  if (session && !isOwnProfile) {
    const followRecord = await db.query.follows.findFirst({
      where: (f, { and, eq }) =>
        and(eq(f.followerId, session.user.id), eq(f.followingId, targetUser.id)),
    });
    isFollowing = !!followRecord;
  }

  // Identify pinned collection
  const pinnedCollection =
    publicCollections.find((c) => c.isPinned) || publicCollections[0];

  const initialLetter = (targetUser.name || targetUser.username || "U")
    .charAt(0)
    .toUpperCase();

  const formattedJoinDate = targetUser.createdAt
    ? new Date(targetUser.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Recent";

  return (
    <div className="min-h-screen bg-[#111514] text-[#f1f0e9] pb-24">
      {/* Editorial Profile Header */}
      <header className="border-b border-[#232d27] bg-[#141a17] pt-10 pb-8 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-[#1b2420] border-2 border-[#89d5d5]/40 flex items-center justify-center text-[#89d5d5] font-display text-2xl font-bold shrink-0">
                {targetUser.image ? (
                  <img
                    src={targetUser.image}
                    alt={targetUser.name || "Avatar"}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  initialLetter
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight text-[#f1f0e9]">
                    {targetUser.name || targetUser.username}
                  </h1>
                  <span className="text-xs font-mono text-[#89d5d5]">
                    @{targetUser.username}
                  </span>
                </div>
                {targetUser.bio && (
                  <p className="text-xs text-[#9aa79e] max-w-xl leading-relaxed">
                    {targetUser.bio}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#6c7d73] pt-1">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} />
                    Citizen since {formattedJoinDate}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Layers size={13} />
                    {publicCollections.length} Public Canons
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare size={13} />
                    {publicReviews.length} Reviews
                  </span>
                </div>
              </div>
            </div>

            {/* Actions: Interactive Follow Button & Stats */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
              <FollowButton
                targetUserId={targetUser.id}
                targetUsername={targetUser.username || ""}
                initialIsFollowing={isFollowing}
                initialFollowersCount={followersCount}
                initialFollowingCount={followingCount}
                isOwnProfile={isOwnProfile}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 pt-8 space-y-12">
        {/* Pinned Ranking Feature Card */}
        {pinnedCollection && (
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#232d27] pb-2">
              <h2 className="font-display text-xs uppercase font-bold tracking-widest text-[#8fa597] flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#89d5d5]" />
                Pinned Canon
              </h2>
              <span className="text-[11px] text-[#6c7d73]">
                {pinnedCollection.entries.length} Entries
              </span>
            </div>

            <article className="ar-profilePinnedCard">
              <Link href={`/collection/${pinnedCollection.id}`} className="ar-feedCover">
                <img
                  src={
                    pinnedCollection.title.toLowerCase().includes("black mirror")
                      ? "/prototype-art/black-mirror-wall.jpg"
                      : pinnedCollection.backdropImage || "/prototype-art/black-mirror-wall.jpg"
                  }
                  alt={pinnedCollection.title}
                />
                <div className="ar-feedCoverShade" />
                <div>
                  <span>
                    {pinnedCollection.collectionType === "tv_show"
                      ? "TV Anthology"
                      : "Curated Canon"}{" "}
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

              {pinnedCollection.entries.length > 0 && (
                <Link
                  className="ar-rankingPeek"
                  href={`/collection/${pinnedCollection.id}`}
                  aria-label={`Preview ${pinnedCollection.title}`}
                >
                  {pinnedCollection.entries.slice(0, 3).map((ep, idx) => {
                    const r = userRatings.find(
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
                                : "/prototype-art/san-junipero.jpg"
                          }
                          alt={ep.mediaItem?.title || "Item"}
                        />
                        <strong>{ep.mediaItem?.title || "Item"}</strong>
                        <small>
                          {r?.calculatedOverallScore
                            ? r.calculatedOverallScore.toFixed(1)
                            : r?.sourceRating
                              ? `★ ${r.sourceRating.toFixed(1)}`
                              : "—"}
                        </small>
                      </div>
                    );
                  })}
                </Link>
              )}
            </article>
          </section>
        )}

        {/* Public Rankings Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#232d27] pb-2">
            <h2 className="font-display text-sm uppercase font-bold tracking-widest text-[#f1f0e9]">
              Published Rankings & Canons ({publicCollections.length})
            </h2>
          </div>

          {publicCollections.length === 0 ? (
            <div className="p-8 rounded-xl border border-[#232d27] bg-[#141a17] text-center space-y-2">
              <p className="text-xs text-[#8fa095]">
                {targetUser.name || targetUser.username} hasn&apos;t published any public rankings yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {publicCollections.map((col) => {
                const colRatings = userRatings.filter(
                  (r) => r.collectionId === col.id && r.calculatedOverallScore !== null
                );
                const avgScore =
                  colRatings.length > 0
                    ? (
                        colRatings.reduce(
                          (acc, cur) => acc + (cur.calculatedOverallScore || 0),
                          0
                        ) / colRatings.length
                      ).toFixed(1)
                    : "—";

                return (
                  <article key={col.id} className="ar-ordinaryPost" style={{ paddingTop: 16 }}>
                    <Link href={`/collection/${col.id}`} className="ar-smallRanking">
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
                          {col.collectionType === "tv_show" ? "TV Series" : "Canon"} · {col.entries.length} items · ★ {avgScore}
                        </span>
                        <h2>{col.title}</h2>
                        <p style={{ fontSize: 12, color: "#9caea2", lineHeight: 1.5, margin: "4px 0 8px" }}>
                          {col.description || "Weighted rankings scored across narrative rigor, cinematography, and sound."}
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
          )}
        </section>

        {/* Recent Public Reviews */}
        {publicReviews.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#232d27] pb-2">
              <h2 className="font-display text-sm uppercase font-bold tracking-widest text-[#f1f0e9]">
                Recent Public Reviews & Dispatches
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {publicReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-5 rounded-xl border border-[#232d27] bg-[#141a17] space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-display text-base uppercase font-bold text-[#f1f0e9]">
                        {rev.mediaItem?.title || "Movie"}
                      </h3>
                      <div className="text-[11px] text-[#8fa095] flex items-center gap-1.5 mt-0.5">
                        {rev.sourceRating && (
                          <span className="text-[#89d5d5] font-semibold">
                            ★ {rev.sourceRating.toFixed(1)}/5
                          </span>
                        )}
                        {rev.calculatedOverallScore && (
                          <span className="text-[#89d5d5] font-semibold">
                            Weighted: {rev.calculatedOverallScore.toFixed(1)}
                          </span>
                        )}
                        {rev.watchDate && (
                          <span>
                            · {new Date(rev.watchDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[#d0ded5] leading-relaxed line-clamp-4">
                    &ldquo;{rev.reviewText}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
