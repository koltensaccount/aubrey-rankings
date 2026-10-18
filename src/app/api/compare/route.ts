import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { collections, collectionEntries, ratings } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { compareRankings, ComparisonItem } from "@/lib/comparison";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  const leftId = request.nextUrl.searchParams.get("left");
  const rightId = request.nextUrl.searchParams.get("right");

  if (!leftId || !rightId) {
    return NextResponse.json(
      { error: "Both 'left' and 'right' collection IDs are required" },
      { status: 400 }
    );
  }

  // Fetch Left Collection
  const leftCol = await db.query.collections.findFirst({
    where: (c, { eq }) => eq(c.id, leftId),
    with: {
      defaultRatingSystem: {
        with: {
          tiers: { orderBy: (t, { asc }) => [asc(t.sortOrder)] },
        },
      },
      user: {
        columns: { id: true, name: true, username: true, image: true },
      },
      entries: {
        orderBy: [asc(collectionEntries.sortOrder)],
        with: { mediaItem: true },
      },
      ratings: {
        with: { tier: true },
      },
    },
  });

  // Fetch Right Collection
  const rightCol = await db.query.collections.findFirst({
    where: (c, { eq }) => eq(c.id, rightId),
    with: {
      defaultRatingSystem: {
        with: {
          tiers: { orderBy: (t, { asc }) => [asc(t.sortOrder)] },
        },
      },
      user: {
        columns: { id: true, name: true, username: true, image: true },
      },
      entries: {
        orderBy: [asc(collectionEntries.sortOrder)],
        with: { mediaItem: true },
      },
      ratings: {
        with: { tier: true },
      },
    },
  });

  if (!leftCol || !rightCol) {
    return NextResponse.json({ error: "One or both collections not found" }, { status: 404 });
  }

  // Privacy checks: neither collection can be private unless owned by caller
  const leftIsOwner = session ? session.user.id === leftCol.userId : false;
  const leftIsPrivate =
    leftCol.visibility === "private" || (!leftCol.isPublic && leftCol.visibility !== "unlisted");
  if (leftIsPrivate && !leftIsOwner) {
    return NextResponse.json({ error: "Left collection not found or private" }, { status: 404 });
  }

  const rightIsOwner = session ? session.user.id === rightCol.userId : false;
  const rightIsPrivate =
    rightCol.visibility === "private" || (!rightCol.isPublic && rightCol.visibility !== "unlisted");
  if (rightIsPrivate && !rightIsOwner) {
    return NextResponse.json({ error: "Right collection not found or private" }, { status: 404 });
  }

  // Build maps of ratings for fast lookup
  const leftRatingsMap = new Map<string, any>();
  for (const r of leftCol.ratings) {
    leftRatingsMap.set(r.mediaItemId, r);
  }

  const rightRatingsMap = new Map<string, any>();
  for (const r of rightCol.ratings) {
    rightRatingsMap.set(r.mediaItemId, r);
  }

  // Build ordered comparison items
  const formatEntries = (
    col: typeof leftCol,
    ratingsMap: Map<string, any>
  ): ComparisonItem[] => {
    const isTier = col.defaultRatingSystem?.type === "tier";
    const scoredList = col.entries.map((entry) => {
      const rating = ratingsMap.get(entry.mediaItemId);
      const score = rating?.calculatedOverallScore ?? null;
      const tier = rating?.tier ?? null;
      return {
        mediaItemId: entry.mediaItemId,
        title: entry.mediaItem?.title || "Untitled",
        score,
        tier,
        sortOrder: entry.sortOrder,
        posterPath: entry.mediaItem?.posterPath,
        stillPath: entry.mediaItem?.stillPath,
      };
    });

    // Rank items
    if (isTier) {
      scoredList.sort((a, b) => {
        const aOrder = a.tier?.sortOrder ?? 9999;
        const bOrder = b.tier?.sortOrder ?? 9999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.sortOrder - b.sortOrder;
      });
    } else {
      scoredList.sort((a, b) => {
        if (a.score !== null && b.score !== null) return b.score - a.score;
        if (a.score !== null) return -1;
        if (b.score !== null) return 1;
        return a.sortOrder - b.sortOrder;
      });
    }

    return scoredList.map((item, index) => ({
      mediaItemId: item.mediaItemId,
      title: item.title,
      rank: index + 1,
      score: item.score,
      tierName: item.tier?.name ?? null,
      tierColor: item.tier?.color ?? null,
      posterPath: item.posterPath,
      stillPath: item.stillPath,
    }));
  };

  const leftItems = formatEntries(leftCol, leftRatingsMap);
  const rightItems = formatEntries(rightCol, rightRatingsMap);

  const metrics = compareRankings(leftItems, rightItems);

  return NextResponse.json({
    leftCollection: {
      id: leftCol.id,
      title: leftCol.title,
      collectionType: leftCol.collectionType,
      customCoverImage: leftCol.customCoverImage,
      backdropImage: leftCol.backdropImage,
      defaultRatingSystem: leftCol.defaultRatingSystem,
      user: leftCol.user,
      totalEntries: leftItems.length,
    },
    rightCollection: {
      id: rightCol.id,
      title: rightCol.title,
      collectionType: rightCol.collectionType,
      customCoverImage: rightCol.customCoverImage,
      backdropImage: rightCol.backdropImage,
      defaultRatingSystem: rightCol.defaultRatingSystem,
      user: rightCol.user,
      totalEntries: rightItems.length,
    },
    metrics,
  });
}
