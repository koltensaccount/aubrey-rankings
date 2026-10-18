import { requireRateLimit } from "@/lib/request-limits";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { savedRankings, collections } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  const collectionId = request.nextUrl.searchParams.get("collectionId");

  // Single collection saved state check
  if (collectionId) {
    const col = await db.query.collections.findFirst({
      where: (c, { eq }) => eq(c.id, collectionId),
      columns: { id: true, userId: true, visibility: true, isPublic: true },
    });

    if (!col) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const isOwner = session?.user?.id === col.userId;
    const isPrivate = col.visibility === "private" || (!col.isPublic && col.visibility !== "unlisted");
    if (isPrivate && !isOwner) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const savedCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(savedRankings)
      .where(eq(savedRankings.collectionId, collectionId));
    const savedCount = Number(savedCountRes[0]?.count || 0);

    let isSaved = false;
    if (session) {
      const existing = await db.query.savedRankings.findFirst({
        where: (s, { and, eq }) =>
          and(eq(s.userId, session.user.id), eq(s.collectionId, collectionId)),
      });
      isSaved = !!existing;
    }

    return NextResponse.json({ isSaved, savedCount });
  }

  // List all saved rankings for the authenticated user
  if (!session) {
    return NextResponse.json({ savedRankings: [] });
  }

  const savedList = await db.query.savedRankings.findMany({
    where: (s, { eq }) => eq(s.userId, session.user.id),
    orderBy: [desc(savedRankings.createdAt)],
    with: {
      collection: {
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
            with: { mediaItem: true },
          },
          ratings: {
            columns: {
              id: true,
              calculatedOverallScore: true,
            },
          },
        },
      },
    },
  });

  // Filter out any collections that were deleted or switched to private (unless user is owner)
  const accessibleSaved = savedList
    .filter((item) => {
      if (!item.collection) return false;
      const isOwner = item.collection.userId === session.user.id;
      const isPublicOrUnlisted =
        item.collection.visibility !== "private" &&
        (item.collection.visibility === "public" ||
          item.collection.visibility === "unlisted" ||
          item.collection.isPublic);
      return isOwner || isPublicOrUnlisted;
    })
    .map((item) => ({
      savedAt: item.createdAt,
      collection: item.collection,
    }));

  return NextResponse.json({ savedRankings: accessibleSaved });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRateLimit(`social-saved:${session.user.id}`, 60);
  } catch {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const collectionId = body.collectionId;

  if (!collectionId) {
    return NextResponse.json({ error: "collectionId required" }, { status: 400 });
  }

  const col = await db.query.collections.findFirst({
    where: (c, { eq }) => eq(c.id, collectionId),
    columns: { id: true, userId: true, visibility: true, isPublic: true, title: true },
  });

  if (!col) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const isOwner = session.user.id === col.userId;
  const isPrivate = col.visibility === "private" || (!col.isPublic && col.visibility !== "unlisted");
  if (isPrivate && !isOwner) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const existing = await db.query.savedRankings.findFirst({
    where: (s, { and, eq }) =>
      and(eq(s.userId, session.user.id), eq(s.collectionId, collectionId)),
  });

  let isSaved = false;
  if (existing) {
    if (body.action === "save") {
      isSaved = true;
    } else {
      await db
        .delete(savedRankings)
        .where(
          and(
            eq(savedRankings.userId, session.user.id),
            eq(savedRankings.collectionId, collectionId)
          )
        );
      isSaved = false;
    }
  } else {
    if (body.action === "unsave") {
      isSaved = false;
    } else {
      await db.insert(savedRankings).values({
        id: randomUUID(),
        userId: session.user.id,
        collectionId,
      });
      isSaved = true;
    }
  }

  const savedCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(savedRankings)
    .where(eq(savedRankings.collectionId, collectionId));
  const savedCount = Number(savedCountRes[0]?.count || 0);

  return NextResponse.json({ isSaved, savedCount });
}
