import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { getPublicReviews } from "@/lib/public-reviews";
import { user, collections, ratings, follows, userBlocks } from "@/db/schema";
import { eq, and, desc, sql, isNotNull } from "drizzle-orm";
import { getServerSession } from "@/lib/server-session";
import { normalizeUsername } from "@/lib/username";
import { getTmdbImageUrl } from "@/lib/tmdb";
import { getTopRankedEntries, getRatingSummary } from "@/lib/scoring";
import { FollowButton } from "@/components/social/follow-button";
import { ProfileSocialStats } from "@/components/social/profile-social-stats";
import { ProfileActions } from "@/components/social/profile-actions";
import { getAccentTokens } from "@/lib/theme";
import { SpoilerConcealedText } from "@/components/reviews/spoiler-concealed-text";
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
  UserX,
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
          with:{ratingSystem:{columns:{scale:true}}},
          where: (r, { eq, and, inArray }) =>
            and(eq(r.userId, targetUser.id), inArray(r.collectionId, collectionIds)),
        })
      : [];

  // 4. Fetch recent public reviews (stripping private personal notes)
  const publicReviews = await getPublicReviews(targetUser.id);

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

  let isBlockedByMe = false;
  let isBlockedByTarget = false;
  if (session && !isOwnProfile) {
    const blocks = await db.query.userBlocks.findMany({
      where: (b, { or, and, eq }) =>
        or(
          and(eq(b.blockerId, session.user.id), eq(b.blockedId, targetUser.id)),
          and(eq(b.blockerId, targetUser.id), eq(b.blockedId, session.user.id))
        ),
    });
    for (const b of blocks) {
      if (b.blockerId === session.user.id) isBlockedByMe = true;
      if (b.blockerId === targetUser.id) isBlockedByTarget = true;
    }
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

  const {meanScore,ratedCount} = getRatingSummary(userRatings);

  const profileAccentTokens = getAccentTokens(targetUser.accentColor || "#89D5D5");

  return (
    <div
      className="ar-homeContent ar-profilePage min-h-screen bg-background text-foreground pb-24 transition-colors"
      style={{
        "--profile-accent": profileAccentTokens.primary,
        "--profile-accent-fg": profileAccentTokens.primaryForeground,
        "--profile-accent-hover": profileAccentTokens.primaryHover,
        "--profile-accent-light-text": getAccentTokens(targetUser.accentColor || "#89D5D5", "light").primaryText,
        "--profile-accent-dark-text": getAccentTokens(targetUser.accentColor || "#89D5D5", "dark").primaryText,
      } as React.CSSProperties}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Compact Profile Identity Header (Prototype Screen C Alignment) */}
        <header className="ar-profileHeader">
          <div className="ar-profileBioRow">
            <div className="ar-profileAvatar overflow-hidden">
              {targetUser.image ? (
                <img
                  src={targetUser.image}
                  alt={targetUser.name || "Avatar"}
                  className="w-full h-full object-cover"
                />
              ) : (
                initialLetter
              )}
            </div>
            <div className="ar-profileIdentity">
              <div className="ar-profileNameLine">
                <h1>{targetUser.name || targetUser.username}</h1>
                <span className="ar-profileHandle">
                  @{targetUser.username}
                </span>
                <span className="ar-profileBadge">Curator</span>
              </div>
              {targetUser.bio?.trim() ? (
                <p className="ar-profileBio">{targetUser.bio}</p>
              ) : null}
              <ProfileSocialStats
                userId={targetUser.id}
                username={targetUser.username}
                targetName={targetUser.name}
                initialFollowersCount={followersCount}
                initialFollowingCount={followingCount}
                initialIsFollowing={isFollowing}
                isOwnProfile={isOwnProfile}
              />
            </div>

            <div className="ar-profileActions flex items-center gap-2">
              {!isBlockedByMe && !isBlockedByTarget && (
                <FollowButton
                  targetUserId={targetUser.id}
                  targetUsername={targetUser.username || ""}
                  initialIsFollowing={isFollowing}
                  initialFollowersCount={followersCount}
                  initialFollowingCount={followingCount}
                  isOwnProfile={isOwnProfile}
                  accentColor={profileAccentTokens.primary}
                  accentFg={profileAccentTokens.primaryForeground}
                  showStats={false}
                />
              )}
              {!isOwnProfile && session && (
                <ProfileActions
                  targetUserId={targetUser.id}
                  targetUsername={targetUser.username || ""}
                  initialIsBlocked={isBlockedByMe}
                />
              )}
            </div>
          </div>

          {/* Subtle Horizontal Metadata Bar */}
          <div className="ar-profileMetaBar">
            <span>
              <strong>{ratedCount}</strong> scored
            </span>
            <span className="ar-dot">·</span>
            <span>
              <strong>{publicCollections.length}</strong> rankings
            </span>
            <span className="ar-dot">·</span>
            <span>
              <strong>{meanScore}</strong> mean /10
            </span>
            <span className="ar-dot">·</span>
            <span className="ar-profileRubricSummary">Weighted Rubric</span>
          </div>
        </header>

      {isBlockedByMe ? (
        <div className="pt-12">
          <div className="p-8 rounded-xl border border-border bg-card text-center space-y-3 shadow-sm max-w-lg mx-auto">
            <div className="mx-auto w-10 h-10 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
              <UserX size={18} />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-xl uppercase font-bold text-foreground">
                You have blocked @{targetUser.username}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You will not see their activity in your feeds or receive notifications from them. Unblock this account using the actions menu to restore public ranking access.
              </p>
            </div>
          </div>
        </div>
      ) : isBlockedByTarget ? (
        <div className="pt-12">
          <div className="p-8 rounded-xl border border-border bg-card text-center space-y-3 shadow-sm max-w-lg mx-auto">
            <div className="mx-auto w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
              <Lock size={18} />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-xl uppercase font-bold text-foreground">
                Restricted Profile
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                @{targetUser.username} has restricted access to their public profile and rankings.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <main className="pt-8 space-y-12">
        {/* Pinned Ranking Feature Card */}
        {pinnedCollection && (
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="font-display text-xs uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Sparkles size={13} style={{ color: "var(--profile-accent-text)" }} />
                Pinned Canon
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {pinnedCollection.entries.length} Entries
              </span>
            </div>

            <article className="ar-profilePinnedCard">
              <Link href={`/collection/${pinnedCollection.id}`} className="ar-feedCover">
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

              {pinnedCollection.entries.length > 0 && (
                <Link
                  className="ar-rankingPeek"
                  href={`/collection/${pinnedCollection.id}`}
                  aria-label={`Preview ${pinnedCollection.title}`}
                >
                  {getTopRankedEntries(pinnedCollection.entries, userRatings).map(({ entry, rank, score }) => {
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
                          <strong>{entry.mediaItem?.title || "Item"}</strong>
                          <small style={{ color: "var(--profile-accent-text)" }}>
                            {score !== null ? `★ ${score.toFixed(1)}` : "—"}
                          </small>
                        </div>
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
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="font-display text-sm uppercase font-bold tracking-widest text-foreground">
              Published Rankings ({publicCollections.length})
            </h2>
          </div>

          {publicCollections.length === 0 ? (
            <div className="p-8 rounded-xl border border-border bg-card text-center space-y-2">
              <p className="text-xs text-muted-foreground">
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
                        <p style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.5, margin: "4px 0 8px" }}>
                          {col.description || "Weighted rankings scored across narrative rigor, cinematography, and sound."}
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
          )}
        </section>

        {/* Recent Public Reviews */}
        {publicReviews.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="font-display text-sm uppercase font-bold tracking-widest text-foreground">
                Recent Public Reviews & Dispatches
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {publicReviews.map((rev) => (
                <article
                  key={rev.id}
                  className="p-5 rounded-xl border border-border bg-card space-y-2.5 shadow-sm hover:border-border transition-colors block group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={rev.reviewUrl}
                          className="font-display text-base uppercase font-bold text-foreground group-hover:text-primary-text transition-colors truncate"
                        >
                          {rev.mediaItem?.title || "Movie"}
                        </Link>
                        {rev.tier && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono text-white"
                            style={{ backgroundColor: rev.tier.color }}
                          >
                            {rev.tier.name}
                          </span>
                        )}
                      </div>
                      {rev.title && (
                        <p className="text-xs font-semibold text-foreground/90 mt-0.5 truncate">
                          {rev.title}
                        </p>
                      )}
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        {rev.score != null && (
                          <span className="font-semibold" style={{ color: "var(--profile-accent-text)" }}>
                            ★ {rev.score.toFixed(1)} / 10
                          </span>
                        )}
                        {(rev.watchDate || rev.publishedAt) && (
                          <span>
                            · {new Date(rev.watchDate || rev.publishedAt!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <SpoilerConcealedText
                    content={rev.reviewText}
                        format={rev.contentFormat}
                    isSpoiler={rev.isSpoiler}
                    quoteStyle={true}
                    className="text-xs text-foreground/80 leading-relaxed line-clamp-4 italic border-l-2 border-primary/30 pl-2.5"
                  />
                  <div className="pt-1 border-t border-border/60 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Published Review
                    </span>
                    <Link
                      href={rev.reviewUrl}
                      className="text-xs font-semibold text-primary-text hover:underline inline-flex items-center gap-1"
                    >
                      <span>Read Review</span>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
      )}
      </div>
    </div>
  );
}
