import { requireRateLimit } from "@/lib/request-limits";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { comments, collections, user } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createNotification } from "@/lib/notifications";

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

  // Privacy check
  const isOwner = session?.user?.id === col.userId;
  const isPrivate = col.visibility === "private" || (!col.isPublic && col.visibility !== "unlisted");
  if (isPrivate && !isOwner) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const list = await db.query.comments.findMany({
    where: (c, { eq }) => eq(c.collectionId, collectionId),
    orderBy: [asc(comments.createdAt)],
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
      },
    },
  });

  return NextResponse.json({
    comments: list.map((item) => ({
      id: item.id,
      content: item.content,
      createdAt: item.createdAt,
      isAuthor: session ? session.user.id === item.userId : false,
      isCollectionOwner: session ? session.user.id === col.userId : false,
      author: {
        id: item.user.id,
        name: item.user.name,
        username: item.user.username,
        image: item.user.image,
      },
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try { requireRateLimit(`social-comments:${session.user.id}`,20); } catch { return NextResponse.json({error:"Too many requests"},{status:429}); }
  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({error:"Invalid request"},{status:400});
  const { collectionId, content } = body;

  if (!collectionId) {
    return NextResponse.json({ error: "collectionId required" }, { status: 400 });
  }

  const trimmedContent = typeof content === "string" ? content.trim() : "";
  if (!trimmedContent) {
    return NextResponse.json({ error: "Comment content cannot be empty" }, { status: 400 });
  }

  if (trimmedContent.length > 2000) {
    return NextResponse.json(
      { error: "Comment exceeds maximum limit of 2,000 characters" },
      { status: 400 }
    );
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
    return NextResponse.json({ error: "Cannot comment on a private collection" }, { status: 403 });
  }

  const newId = randomUUID();
  await db.insert(comments).values({
    id: newId,
    userId: session.user.id,
    collectionId,
    content: trimmedContent,
  });

  const created = await db.query.comments.findFirst({
    where: (c, { eq }) => eq(c.id, newId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
      },
    },
  });

  if (!created) {
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }

  // Trigger notification if commenter is not the ranking owner
  if (col.userId !== session.user.id) {
    await createNotification({
      recipientUserId: col.userId,
      actorUserId: session.user.id,
      notificationType: "comment",
      collectionId: col.id,
      metadata: {
        actorName: created.user.name || session.user.name || "Someone",
        actorUsername: created.user.username || null,
        actorImage: created.user.image || session.user.image || null,
        collectionTitle: col.title,
        commentPreview: trimmedContent.slice(0, 100),
        message: `${created.user.name || session.user.name || "Someone"} commented on your ranking "${col.title}": "${trimmedContent.slice(0, 80)}${trimmedContent.length > 80 ? "…" : ""}"`,
        targetUrl: `/collection/${col.id}`,
      },
    });
  }

  return NextResponse.json({
    comment: {
      id: created.id,
      content: created.content,
      createdAt: created.createdAt,
      isAuthor: true,
      isCollectionOwner: isOwner,
      author: {
        id: created.user.id,
        name: created.user.name,
        username: created.user.username,
        image: created.user.image,
      },
    },
  });
}
