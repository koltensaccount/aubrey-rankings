import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { collections, follows, likes, savedRankings, comments, ratings, user, reviews } from "@/db/schema";
import { desc, eq, inArray, and, or, sql, isNotNull, ne, asc } from "drizzle-orm";
import { canShowReviewRating, reviewScoreOnTen, resolveReviewScoreOnTen } from "@/lib/review-rating";

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  const mode = request.nextUrl.searchParams.get("mode") || "discover";
  const filter = request.nextUrl.searchParams.get("filter") || "all"; // 'all' | 'rankings' | 'reviews'
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 25);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50)
    : 25;

  let followingIds: string[] | null = null;
  const { getBlockedUserIds } = await import("@/lib/safety");
  const blockedUserIds = session ? await getBlockedUserIds(session.user.id) : new Set<string>();

  if (mode === "following") {
    if (!session) {
      return NextResponse.json({
        items: [],
        mode: "following",
        emptyReason: "unauthenticated",
      });
    }

    const followingRows = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, session.user.id));

    followingIds = followingRows
      .map((r) => r.followingId)
      .filter((id) => !blockedUserIds.has(id));

    if (followingIds.length === 0) {
      return NextResponse.json({
        items: [],
        mode: "following",
        emptyReason: "no_following",
      });
    }
  }

  // 1. Fetch Public Rankings (if filter allows)
  let rankingItems: any[] = [];
  if (filter === "all" || filter === "rankings") {
    const rawCollectionsData = await db.query.collections.findMany({
      where: (c, { and, inArray, eq }) =>
        and(
          followingIds ? inArray(c.userId, followingIds) : undefined,
          eq(c.visibility, "public") // Unlisted and private are strictly excluded
        ),
      orderBy: [desc(collections.updatedAt)],
      limit: limit * 2,
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            username: true,
            image: true,
            isTestWorkspace: true,
          },
        },
        defaultRatingSystem: {
          with: {
            tiers: {
              orderBy: (tier, { asc }) => [asc(tier.sortOrder)],
            },
          },
        },
        entries: {
          orderBy: [asc(collections.updatedAt)],
          with: {
            mediaItem: true,
          },
        },
        ratings: {
          columns: {
            id: true,
            userId: true,
            mediaItemId: true,
            tierId: true,
            calculatedOverallScore: true,
            sourceRating: true,
            sourceScale: true,
          },
          with: {
            tier: {
              columns: {
                id: true,
                name: true,
                color: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    });

    const rawCollections = rawCollectionsData
      .filter(
        (col) =>
          !blockedUserIds.has(col.userId) &&
          col.userId !== "usr_test_import_workspace" &&
          !col.user?.isTestWorkspace
      )
      .slice(0, limit);

    const colIds = rawCollections.map((c) => c.id);

    // Fetch engagement aggregates for collections
    const likeCountMap = new Map<string, number>();
    const saveCountMap = new Map<string, number>();
    const commentCountMap = new Map<string, number>();
    const viewerLikedSet = new Set<string>();
    const viewerSavedSet = new Set<string>();

    if (colIds.length > 0) {
      const likeRows = await db
        .select({
          collectionId: likes.collectionId,
          count: sql<number>`count(*)::int`,
        })
        .from(likes)
        .where(inArray(likes.collectionId, colIds))
        .groupBy(likes.collectionId);
      for (const row of likeRows) {
        if (row.collectionId) likeCountMap.set(row.collectionId, row.count);
      }

      const saveRows = await db
        .select({
          collectionId: savedRankings.collectionId,
          count: sql<number>`count(*)::int`,
        })
        .from(savedRankings)
        .where(inArray(savedRankings.collectionId, colIds))
        .groupBy(savedRankings.collectionId);
      for (const row of saveRows) {
        if (row.collectionId) saveCountMap.set(row.collectionId, row.count);
      }

      const commentRows = await db
        .select({
          collectionId: comments.collectionId,
          count: sql<number>`count(*)::int`,
        })
        .from(comments)
        .where(inArray(comments.collectionId, colIds))
        .groupBy(comments.collectionId);
      for (const row of commentRows) {
        if (row.collectionId) commentCountMap.set(row.collectionId, row.count);
      }

      if (session?.user?.id) {
        const viewerLikes = await db
          .select({ collectionId: likes.collectionId })
          .from(likes)
          .where(
            and(
              eq(likes.userId, session.user.id),
              inArray(likes.collectionId, colIds)
            )
          );
        for (const r of viewerLikes) {
          if (r.collectionId) viewerLikedSet.add(r.collectionId);
        }

        const viewerSaves = await db
          .select({ collectionId: savedRankings.collectionId })
          .from(savedRankings)
          .where(
            and(
              eq(savedRankings.userId, session.user.id),
              inArray(savedRankings.collectionId, colIds)
            )
          );
        for (const r of viewerSaves) {
          if (r.collectionId) viewerSavedSet.add(r.collectionId);
        }
      }
    }

    rankingItems = rawCollections.map((col) => {
      const avgScore = col.ratings?.length
        ? (
            col.ratings.reduce(
              (acc, r) => acc + (r.calculatedOverallScore || 0),
              0
            ) / col.ratings.length
          ).toFixed(1)
        : null;

      const ownerRatings = (col.ratings || []).filter((r: any) => r.userId === col.userId);
      const ratingMapByMediaId = new Map(ownerRatings.map((r: any) => [r.mediaItemId, r]));

      const sysTiers = (col.defaultRatingSystem?.tiers || []).sort(
        (a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      );
      const hasTiers = sysTiers.length > 0;

      // Group entries by tier if hasTiers is true
      let tiersData: any[] = [];
      let unassignedEntries: any[] = [];

      const orderedEntries = (col.entries || []).map((e: any, idx: number) => {
        const m = e.mediaItem;
        const userRating = m ? ratingMapByMediaId.get(m.id) : null;
        return {
          id: m?.id,
          title: m?.title || `Item ${idx + 1}`,
          mediaType: m?.mediaType,
          posterPath: m?.posterPath,
          stillPath: m?.stillPath,
          seasonNumber: m?.seasonNumber,
          episodeNumber: m?.episodeNumber,
          rank: idx + 1,
          sortOrder: e.sortOrder ?? idx,
          tierId: userRating?.tierId || null,
        };
      });

      if (hasTiers) {
        const tierEntriesMap = new Map<string, any[]>();
        for (const t of sysTiers) {
          tierEntriesMap.set(t.id, []);
        }

        for (const item of orderedEntries) {
          if (item.tierId && tierEntriesMap.has(item.tierId)) {
            tierEntriesMap.get(item.tierId)!.push(item);
          } else {
            unassignedEntries.push(item);
          }
        }

        tiersData = sysTiers.map((t: any) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          sortOrder: t.sortOrder,
          entries: tierEntriesMap.get(t.id) || [],
        }));
      }

      const topEntries = orderedEntries.slice(0, 4);

      return {
        type: "ranking",
        id: col.id,
        contentId: col.id,
        timestamp: col.updatedAt || col.createdAt,
        author: {
          id: col.user.id,
          name: col.user.name,
          username: col.user.username,
          image: col.user.image,
        },
        ranking: {
          id: col.id,
          title: col.title,
          description: col.description,
          collectionType: col.collectionType,
          customCoverImage: col.customCoverImage,
          backdropImage: col.backdropImage,
          entriesCount: col.entries?.length || 0,
          hasTiers,
          tiers: tiersData,
          unassignedEntries,
          entries: orderedEntries,
          topEntries,
          averageScore: avgScore,
        },
        stats: {
          likeCount: likeCountMap.get(col.id) || 0,
          saveCount: saveCountMap.get(col.id) || 0,
          commentCount: commentCountMap.get(col.id) || 0,
          isLiked: viewerLikedSet.has(col.id),
          isSaved: viewerSavedSet.has(col.id),
        },
      };
    });
  }

  // 2. Fetch Published Reviews (if filter allows)
  let reviewItems: any[] = [];
  if (filter === "all" || filter === "reviews") {
    // 2a. First-class published reviews
    const rawFirstClassReviews = await db.query.reviews.findMany({
      where: (rv, { and, inArray, eq }) =>
        and(
          followingIds ? inArray(rv.userId, followingIds) : undefined,
          eq(rv.status, "published"),
          eq(rv.visibility, "public")
        ),
      orderBy: [desc(reviews.publishedAt), desc(reviews.createdAt)],
      limit: limit * 2,
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            username: true,
            image: true,
            isTestWorkspace: true,
          },
        },
        mediaItem: true,
        rating: {
          columns: {
            id: true,
            userId: true,
            mediaItemId: true,
            collectionId: true,
            calculatedOverallScore: true,
            sourceRating: true,
            sourceScale: true,
            sourceService: true,
            ratingSystemId: true,
            tierId: true,
          },
          with: {
            ratingSystem: { columns: { scale: true, type: true } },
            categoryScores: { columns: { id: true } },
            tier: {
              columns: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    const filteredFirstClass = rawFirstClassReviews
      .filter(
        (r) =>
          !blockedUserIds.has(r.userId) &&
          r.userId !== "usr_test_import_workspace" &&
          !r.user?.isTestWorkspace
      )
      .slice(0, limit);

    const firstClassIds = filteredFirstClass.map((r) => r.id);
    const reviewLikeCountMap = new Map<string, number>();
    const reviewCommentCountMap = new Map<string, number>();
    const viewerReviewLikedSet = new Set<string>();

    if (firstClassIds.length > 0) {
      const reviewLikeRows = await db
        .select({
          reviewId: likes.reviewId,
          count: sql<number>`count(*)::int`,
        })
        .from(likes)
        .where(inArray(likes.reviewId, firstClassIds))
        .groupBy(likes.reviewId);
      for (const row of reviewLikeRows) {
        if (row.reviewId) reviewLikeCountMap.set(row.reviewId, row.count);
      }

      const reviewCommentRows = await db
        .select({
          reviewId: comments.reviewId,
          count: sql<number>`count(*)::int`,
        })
        .from(comments)
        .where(inArray(comments.reviewId, firstClassIds))
        .groupBy(comments.reviewId);
      for (const row of reviewCommentRows) {
        if (row.reviewId) reviewCommentCountMap.set(row.reviewId, row.count);
      }

      if (session?.user?.id) {
        const viewerReviewLikes = await db
          .select({ reviewId: likes.reviewId })
          .from(likes)
          .where(
            and(
              eq(likes.userId, session.user.id),
              inArray(likes.reviewId, firstClassIds)
            )
          );
        for (const r of viewerReviewLikes) {
          if (r.reviewId) viewerReviewLikedSet.add(r.reviewId);
        }
      }
    }

    const publicFirstClassReviews = filteredFirstClass.map((r) => ({
      type: "review",
      id: `review_${r.id}`,
      contentId: r.id,
      reviewType: "independent" as const,
      reviewUrl: `/review/${r.id}`,
      timestamp: r.publishedAt || r.updatedAt || r.createdAt,
      author: {
        id: r.user.id,
        name: r.user.name,
        username: r.user.username,
        image: r.user.image,
      },
      stats: {
        likeCount: reviewLikeCountMap.get(r.id) || 0,
        saveCount: 0,
        commentCount: reviewCommentCountMap.get(r.id) || 0,
        isLiked: viewerReviewLikedSet.has(r.id),
        isSaved: false,
      },
      review: {
        id: r.id,
        title: r.title,
        reviewText: r.content,
        contentFormat: r.contentFormat,
        isSpoiler: r.isSpoiler,
        score: canShowReviewRating(r) ? resolveReviewScoreOnTen(r) : null,
        scale: 10,
        tier: canShowReviewRating(r) && r.rating?.tier && r.rating.collectionId === null
          ? {
              id: r.rating.tier.id,
              name: r.rating.tier.name,
              color: r.rating.tier.color,
            }
          : null,
        watchDate: null,
      },
      mediaItem: {
        id: r.mediaItem.id,
        title: r.mediaItem.title,
        mediaType: r.mediaItem.mediaType,
        posterPath: r.mediaItem.posterPath,
        stillPath: r.mediaItem.stillPath,
        seasonNumber: r.mediaItem.seasonNumber,
        episodeNumber: r.mediaItem.episodeNumber,
      },
      collection: null,
    }));

    reviewItems = publicFirstClassReviews;
  }

  // 3. Merge, sort by timestamp descending, and enforce limit
  const merged = [...rankingItems, ...reviewItems];
  merged.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });

  // Deduplicate entries by unique ID
  const seenIds = new Set<string>();
  const deduplicatedItems: any[] = [];
  for (const item of merged) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      deduplicatedItems.push(item);
    }
  }

  const finalItems = deduplicatedItems.slice(0, limit);

  return NextResponse.json({
    items: finalItems,
    mode,
    filter,
    totalCount: finalItems.length,
    emptyReason: finalItems.length === 0 ? (mode === "following" ? "no_activity" : "no_content") : null,
  });
}
