import { requireRateLimit } from "@/lib/request-limits";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { likes, collections } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createNotification } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  const collectionId = request.nextUrl.searchParams.get("collectionId");

  if (!collectionId) {
    return NextResponse.json({ error: "collectionId required" }, { status: 400 });
  }

  const col = await db.query.collections.findFirst({
    where: (c, { eq }) => eq(c.id, collectionId),
    columns: { id: true, userId: true, visibility: true, isPublic: true },
  });

  if (!col) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  // Check privacy
  const isOwner = session?.user?.id === col.userId;
  const isPrivate = col.visibility === "private" || (!col.isPublic && col.visibility !== "unlisted");
  if (isPrivate && !isOwner) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const likeCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(likes)
    .where(eq(likes.collectionId, collectionId));
  const likeCount = Number(likeCountRes[0]?.count || 0);

  let isLiked = false;
  if (session) {
    const existing = await db.query.likes.findFirst({
      where: (l, { and, eq }) =>
        and(eq(l.userId, session.user.id), eq(l.collectionId, collectionId)),
    });
    isLiked = !!existing;
  }

  return NextResponse.json({ isLiked, likeCount });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try { requireRateLimit(`social-like:${session.user.id}`,60); } catch { return NextResponse.json({error:"Too many requests"},{status:429}); }
  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({error:"Invalid request"},{status:400});
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

  // Enforce authoritative blocking policy
  const { canInteract } = await import("@/lib/safety");
  if (!(await canInteract({ actorId: session.user.id, ownerId: col.userId }))) {
    return NextResponse.json({ error: "Cannot interact with this content" }, { status: 403 });
  }

  const existing = await db.query.likes.findFirst({
    where: (l, { and, eq }) =>
      and(eq(l.userId, session.user.id), eq(l.collectionId, collectionId)),
  });

  let isLiked = false;
  if (existing) {
    // If action is explicitly "like", keep it; otherwise toggle off
    if (body.action === "like") {
      isLiked = true;
    } else {
      await db
        .delete(likes)
        .where(
          and(eq(likes.userId, session.user.id), eq(likes.collectionId, collectionId))
        );
      isLiked = false;
    }
  } else {
    // If action is explicitly "unlike", don't insert; otherwise insert
    if (body.action !== "unlike") {
      await db.insert(likes).values({
        id: randomUUID(),
        userId: session.user.id,
        collectionId,
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
    .select({ count: sql<number>`count(*)` })
    .from(likes)
    .where(eq(likes.collectionId, collectionId));
  const likeCount = Number(likeCountRes[0]?.count || 0);

  return NextResponse.json({ isLiked, likeCount });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({error:"Invalid request"},{status:400});
  const collectionId = body.collectionId || request.nextUrl.searchParams.get("collectionId");

  if (!collectionId) {
    return NextResponse.json({ error: "collectionId required" }, { status: 400 });
  }

  await db
    .delete(likes)
    .where(
      and(eq(likes.userId, session.user.id), eq(likes.collectionId, collectionId))
    );

  const likeCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(likes)
    .where(eq(likes.collectionId, collectionId));
  const likeCount = Number(likeCountRes[0]?.count || 0);

  return NextResponse.json({ isLiked: false, likeCount });
}
