import { requireRateLimit } from "@/lib/request-limits";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { likes, collections, reviews } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createNotification } from "@/lib/notifications";
import { isBlocked, canInteract, getBlockedUserIds } from "@/lib/safety";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  const collectionId = request.nextUrl.searchParams.get("collectionId");
  const reviewId = request.nextUrl.searchParams.get("reviewId");
  const list = request.nextUrl.searchParams.get("list") === "true";
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 30, 1), 40);
  const offset = Math.min(Math.max(Number(request.nextUrl.searchParams.get("offset")) || 0, 0), 400);

  if (!collectionId && !reviewId) {
    return NextResponse.json({ error: "collectionId or reviewId required" }, { status: 400 });
  }

  if (reviewId) {
    const rev = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
      columns: { id: true, userId: true, status: true, visibility: true },
    });

    if (!rev) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const isAuthor = session?.user?.id === rev.userId;
    if (!isAuthor) {
      if (session && (await isBlocked(rev.userId, session.user.id))) {
        return NextResponse.json({ error: "Review not found" }, { status: 404 });
      }
      if (rev.status !== "published" || rev.visibility === "private") {
        return NextResponse.json({ error: "Review not found" }, { status: 404 });
      }
    }

    const likeCountRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(likes)
      .where(eq(likes.reviewId, reviewId));
    const likeCount = Number(likeCountRes[0]?.count || 0);

    if (list) {
      try { requireRateLimit(`like-list:${session?.user.id || "anonymous"}`, session ? 60 : 20); } catch { return NextResponse.json({ error: "Too many requests" }, { status: 429 }); }
      const blocked = session ? [...await getBlockedUserIds(session.user.id)] : [];
      const rows = await db.query.likes.findMany({
        where: (l, { and, eq, notInArray }) => and(eq(l.reviewId, reviewId), ...(blocked.length ? [notInArray(l.userId, blocked)] : [])),
        orderBy: [desc(likes.createdAt)], offset, limit: limit + 1,
        with: { user: { columns: { id: true, name: true, username: true, image: true } } },
      });
      return NextResponse.json({ users: rows.slice(0, limit).filter((row) => row.user.username).map((row) => ({ ...row.user, username: row.user.username! })), likeCount, hasMore: rows.length > limit });
    }

    let isLiked = false;
    if (session) {
      const existing = await db.query.likes.findFirst({
        where: (l, { and, eq }) =>
          and(eq(l.userId, session.user.id), eq(l.reviewId, reviewId)),
      });
      isLiked = Boolean(existing);
    }

    return NextResponse.json({ isLiked, likeCount });
  }

  // Collection like check
  const col = await db.query.collections.findFirst({
    where: (c, { eq }) => eq(c.id, collectionId!),
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

  const likeCountRes = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(likes)
    .where(eq(likes.collectionId, collectionId!));
  const likeCount = Number(likeCountRes[0]?.count || 0);

  if (list) {
    try { requireRateLimit(`like-list:${session?.user.id || "anonymous"}`, session ? 60 : 20); } catch { return NextResponse.json({ error: "Too many requests" }, { status: 429 }); }
    const blocked = session ? [...await getBlockedUserIds(session.user.id)] : [];
    const rows = await db.query.likes.findMany({
      where: (l, { and, eq, notInArray }) => and(eq(l.collectionId, collectionId!), ...(blocked.length ? [notInArray(l.userId, blocked)] : [])),
      orderBy: [desc(likes.createdAt)], offset, limit: limit + 1,
      with: { user: { columns: { id: true, name: true, username: true, image: true } } },
    });
    return NextResponse.json({ users: rows.slice(0, limit).filter((row) => row.user.username).map((row) => ({ ...row.user, username: row.user.username! })), likeCount, hasMore: rows.length > limit });
  }

  let isLiked = false;
  if (session) {
    const existing = await db.query.likes.findFirst({
      where: (l, { and, eq }) =>
        and(eq(l.userId, session.user.id), eq(l.collectionId, collectionId!)),
    });
    isLiked = Boolean(existing);
  }

  return NextResponse.json({ isLiked, likeCount });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRateLimit(`social-like:${session.user.id}`, 60);
  } catch {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { collectionId, reviewId, action } = body;

  if (!collectionId && !reviewId) {
    return NextResponse.json({ error: "collectionId or reviewId required" }, { status: 400 });
  }

  if (reviewId) {
    const rev = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
      with: { mediaItem: true },
    });

    if (!rev) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const isAuthor = session.user.id === rev.userId;
    if (!isAuthor) {
      if (await isBlocked(rev.userId, session.user.id)) {
        return NextResponse.json({ error: "Review not found" }, { status: 404 });
      }
      if (rev.status !== "published" || rev.visibility === "private") {
        return NextResponse.json({ error: "Review not found" }, { status: 404 });
      }
    }

    if (!(await canInteract({ actorId: session.user.id, ownerId: rev.userId }))) {
      return NextResponse.json({ error: "Cannot interact with this content" }, { status: 403 });
    }

    const existing = await db.query.likes.findFirst({
      where: (l, { and, eq }) =>
        and(eq(l.userId, session.user.id), eq(l.reviewId, reviewId)),
    });

    let isLiked = false;
    if (existing) {
      if (action === "like") {
        isLiked = true;
      } else {
        await db
          .delete(likes)
          .where(and(eq(likes.userId, session.user.id), eq(likes.reviewId, reviewId)));
        isLiked = false;
      }
    } else {
      if (action !== "unlike") {
        await db.insert(likes).values({
          id: randomUUID(),
          userId: session.user.id,
          collectionId: null,
          reviewId,
        });
        isLiked = true;

        if (rev.userId !== session.user.id) {
          const actor = await db.query.user.findFirst({
            where: (u, { eq }) => eq(u.id, session.user.id),
            columns: { name: true, username: true, image: true },
          });

          const title = rev.title || rev.mediaItem.title;
          await createNotification({
            recipientUserId: rev.userId,
            actorUserId: session.user.id,
            notificationType: "like",
            reviewId: rev.id,
            mediaItemId: rev.mediaItemId,
            deduplicationKey: `like:review:${rev.id}:${session.user.id}`,
            metadata: {
              actorName: actor?.name || session.user.name || "Someone",
              actorUsername: actor?.username || null,
              actorImage: actor?.image || session.user.image || null,
              message: `${actor?.name || session.user.name || "Someone"} liked your review of "${title}".`,
              targetUrl: `/review/${rev.id}`,
            },
          });
        }
      }
    }

    const likeCountRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(likes)
      .where(eq(likes.reviewId, reviewId));
    const likeCount = Number(likeCountRes[0]?.count || 0);

    return NextResponse.json({ isLiked, likeCount });
  }

  // Collection like path
  const col = await db.query.collections.findFirst({
    where: (c, { eq }) => eq(c.id, collectionId!),
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

  if (!(await canInteract({ actorId: session.user.id, ownerId: col.userId }))) {
    return NextResponse.json({ error: "Cannot interact with this content" }, { status: 403 });
  }

  const existing = await db.query.likes.findFirst({
    where: (l, { and, eq }) =>
      and(eq(l.userId, session.user.id), eq(l.collectionId, collectionId!)),
  });

  let isLiked = false;
  if (existing) {
    if (action === "like") {
      isLiked = true;
    } else {
      await db
        .delete(likes)
        .where(
          and(eq(likes.userId, session.user.id), eq(likes.collectionId, collectionId!))
        );
      isLiked = false;
    }
  } else {
    if (action !== "unlike") {
      await db.insert(likes).values({
        id: randomUUID(),
        userId: session.user.id,
        collectionId: collectionId!,
      });
      isLiked = true;

      if (col.userId !== session.user.id) {
        const actor = await db.query.user.findFirst({
          where: (u, { eq }) => eq(u.id, session.user.id),
          columns: { name: true, username: true, image: true },
        });

        await createNotification({
          recipientUserId: col.userId,
          actorUserId: session.user.id,
          notificationType: "like",
          collectionId: col.id,
          deduplicationKey: `like:${col.id}:${session.user.id}`,
          metadata: {
            actorName: actor?.name || session.user.name || "Someone",
            actorUsername: actor?.username || null,
            actorImage: actor?.image || session.user.image || null,
            collectionTitle: col.title,
            message: `${actor?.name || session.user.name || "Someone"} liked your ranking "${col.title}".`,
            targetUrl: `/collection/${col.id}`,
          },
        });
      }
    }
  }

  const likeCountRes = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(likes)
    .where(eq(likes.collectionId, collectionId!));
  const likeCount = Number(likeCountRes[0]?.count || 0);

  return NextResponse.json({ isLiked, likeCount });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const collectionId = body?.collectionId || request.nextUrl.searchParams.get("collectionId");
  const reviewId = body?.reviewId || request.nextUrl.searchParams.get("reviewId");

  if (!collectionId && !reviewId) {
    return NextResponse.json({ error: "collectionId or reviewId required" }, { status: 400 });
  }

  if (reviewId) {
    await db
      .delete(likes)
      .where(and(eq(likes.userId, session.user.id), eq(likes.reviewId, reviewId)));

    const likeCountRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(likes)
      .where(eq(likes.reviewId, reviewId));
    return NextResponse.json({ isLiked: false, likeCount: Number(likeCountRes[0]?.count || 0) });
  }

  await db
    .delete(likes)
    .where(and(eq(likes.userId, session.user.id), eq(likes.collectionId, collectionId!)));

  const likeCountRes = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(likes)
    .where(eq(likes.collectionId, collectionId!));

  return NextResponse.json({ isLiked: false, likeCount: Number(likeCountRes[0]?.count || 0) });
}
