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
      user: {
        columns: { id: true, name: true, username: true, image: true },
      },
      entries: {
        orderBy: [asc(collectionEntries.sortOrder)],
        with: { mediaItem: true },
      },
      ratings: true,
    },
  });

  // Fetch Right Collection
  const rightCol = await db.query.collections.findFirst({
    where: (c, { eq }) => eq(c.id, rightId),
    with: {
      user: {
        columns: { id: true, name: true, username: true, image: true },
      },
      entries: {
        orderBy: [asc(collectionEntries.sortOrder)],
        with: { mediaItem: true },
      },
      ratings: true,
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
  const leftRatingsMap = new Map<string, number | null>();
  for (const r of leftCol.ratings) {
    leftRatingsMap.set(r.mediaItemId, r.calculatedOverallScore ?? null);
  }

  const rightRatingsMap = new Map<string, number | null>();
  for (const r of rightCol.ratings) {
    rightRatingsMap.set(r.mediaItemId, r.calculatedOverallScore ?? null);
  }

  // Build ordered comparison items
  // Sort by calculated score desc if scored, else sortOrder
  const formatEntries = (
    col: typeof leftCol,
    ratingsMap: Map<string, number | null>
  ): ComparisonItem[] => {
    const scoredList = col.entries.map((entry) => {
      const score = ratingsMap.get(entry.mediaItemId) ?? null;
      return {
        mediaItemId: entry.mediaItemId,
        title: entry.mediaItem?.title || "Untitled",
        score,
        sortOrder: entry.sortOrder,
        posterPath: entry.mediaItem?.posterPath,
        stillPath: entry.mediaItem?.stillPath,
      };
    });

    // Rank: score desc, then sortOrder asc
    scoredList.sort((a, b) => {
      if (a.score !== null && b.score !== null) return b.score - a.score;
      if (a.score !== null) return -1;
      if (b.score !== null) return 1;
      return a.sortOrder - b.sortOrder;
    });

    return scoredList.map((item, index) => ({
      mediaItemId: item.mediaItemId,
      title: item.title,
      rank: index + 1,
      score: item.score,
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
      user: leftCol.user,
      totalEntries: leftItems.length,
    },
    rightCollection: {
      id: rightCol.id,
      title: rightCol.title,
      collectionType: rightCol.collectionType,
      customCoverImage: rightCol.customCoverImage,
      backdropImage: rightCol.backdropImage,
      user: rightCol.user,
      totalEntries: rightItems.length,
    },
    metrics,
  });
}
