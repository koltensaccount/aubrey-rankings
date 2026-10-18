import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { collections, follows, likes, user } from "@/db/schema";
import { desc, eq, inArray, and, or, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  const mode = request.nextUrl.searchParams.get("mode") || "discover";
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 20);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50) : 20;

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

    const followingIds = followingRows.map((r) => r.followingId);

    if (followingIds.length === 0) {
      return NextResponse.json({
        items: [],
        mode: "following",
        emptyReason: "no_following",
      });
    }

    // Unlisted collections are accessible by link, never discoverable in a feed.
    const followedCollections = await db.query.collections.findMany({
      where: (c, { and, inArray, or, eq }) =>
        and(
          inArray(c.userId, followingIds),
          eq(c.visibility, "public")
        ),
      orderBy: [desc(collections.updatedAt)],
      limit,
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
          limit: 6,
          with: {
            mediaItem: true,
          },
        },
        ratings: {
          columns: {
            id: true,
            calculatedOverallScore: true,
          },
        },
      },
    });

    return NextResponse.json({
      items: followedCollections,
      mode: "following",
    });
  }

  // Discover mode: all public collections across the platform
  const discoverCollections = await db.query.collections.findMany({
    where: (c, { or, eq }) =>
      eq(c.visibility, "public"),
    orderBy: [desc(collections.updatedAt)],
    limit,
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
        limit: 6,
        with: {
          mediaItem: true,
        },
      },
      ratings: {
        columns: {
          id: true,
          calculatedOverallScore: true,
        },
      },
    },
  });

  return NextResponse.json({
    items: discoverCollections,
    mode: "discover",
  });
}
