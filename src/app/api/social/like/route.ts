import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { likes, collections } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
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
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const collectionId = body.collectionId;

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

  const isOwner = session.user.id === col.userId;
  const isPrivate = col.visibility === "private" || (!col.isPublic && col.visibility !== "unlisted");
  if (isPrivate && !isOwner) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
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
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
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
