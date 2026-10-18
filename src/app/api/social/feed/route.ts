import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { collections, follows, likes, user } from "@/db/schema";
import { desc, eq, inArray, and, or, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  const mode = request.nextUrl.searchParams.get("mode") || "discover";
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") || 20), 1), 50);

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

    // Fetch public and unlisted collections from followed creators
    const followedCollections = await db.query.collections.findMany({
      where: (c, { and, inArray, or, eq }) =>
        and(
          inArray(c.userId, followingIds),
          or(eq(c.visibility, "public"), eq(c.visibility, "unlisted"), eq(c.isPublic, true))
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
      or(eq(c.visibility, "public"), eq(c.isPublic, true)),
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
