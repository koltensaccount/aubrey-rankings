import { requireRateLimit } from "@/lib/request-limits";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { comments, collections, user } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
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
    columns: { id: true, userId: true, visibility: true, isPublic: true, allowComments: true },
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

  const { getBlockedUserIds } = await import("@/lib/safety");
  const blockedIds = session ? await getBlockedUserIds(session.user.id) : new Set<string>();

  const rawList = await db.query.comments.findMany({
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

  // Filter out any comments from accounts blocked by or blocking the current viewer
  const list = rawList.filter((item) => !blockedIds.has(item.userId));

  const formatComment = (item: (typeof list)[0]) => ({
    id: item.id,
    content: item.content,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    parentId: item.parentId,
    isSpoiler: item.isSpoiler,
    isEdited: item.isEdited,
    isAuthor: session ? session.user.id === item.userId : false,
    isCollectionOwner: session ? session.user.id === col.userId : false,
    author: {
      id: item.user.id,
      name: item.user.name,
      username: item.user.username,
      image: item.user.image,
    },
  });

  // Organize into top-level comments and 1-level replies
  const repliesByParentId = new Map<string, ReturnType<typeof formatComment>[]>();
  const topLevelComments: (ReturnType<typeof formatComment> & { replies: ReturnType<typeof formatComment>[] })[] = [];

  for (const item of list) {
    if (item.parentId) {
      const existing = repliesByParentId.get(item.parentId) || [];
      existing.push(formatComment(item));
      repliesByParentId.set(item.parentId, existing);
    }
  }

  for (const item of list) {
    if (!item.parentId) {
      topLevelComments.push({
        ...formatComment(item),
        replies: repliesByParentId.get(item.id) || [],
      });
    }
  }

  return NextResponse.json({
    comments: topLevelComments,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRateLimit(`social-comments:${session.user.id}`, 20);
  } catch {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { collectionId, content, parentId, isSpoiler } = body;

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
    columns: { id: true, userId: true, visibility: true, isPublic: true, title: true, allowComments: true },
  });

  if (!col) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const isOwner = session.user.id === col.userId;
  const isPrivate = col.visibility === "private" || (!col.isPublic && col.visibility !== "unlisted");
  if (isPrivate && !isOwner) {
    return NextResponse.json({ error: "Cannot comment on a private collection" }, { status: 403 });
  }

  // Enforce authoritative comment eligibility (collection allowComments, block check, user permission)
  const { canComment, isBlocked } = await import("@/lib/safety");
  const commentCheck = await canComment({
    authorId: col.userId,
    commenterId: session.user.id,
    collectionAllowComments: col.allowComments ?? true,
  });

  if (!commentCheck.allowed) {
    return NextResponse.json({ error: commentCheck.reason || "Forbidden" }, { status: 403 });
  }

  let validParentId: string | null = null;
  let parentComment: any = null;

  if (parentId) {
    if (typeof parentId !== "string") {
      return NextResponse.json({ error: "Invalid parent comment ID" }, { status: 400 });
    }

    parentComment = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, parentId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    if (!parentComment || parentComment.collectionId !== collectionId) {
      return NextResponse.json({ error: "Parent comment not found in this collection" }, { status: 400 });
    }

    // Blocking check: Cannot reply to a user you have blocked or who blocked you
    if (await isBlocked(parentComment.userId, session.user.id)) {
      return NextResponse.json({ error: "Cannot reply to this comment" }, { status: 403 });
    }

    // Enforce 1-level threading: cannot reply to a reply
    if (parentComment.parentId) {
      return NextResponse.json(
        { error: "Nested replies are not supported; you can only reply directly to top-level comments" },
        { status: 400 }
      );
    }

    validParentId = parentComment.id;
  }

  const newId = randomUUID();
  const spoilerFlag = Boolean(isSpoiler);

  await db.insert(comments).values({
    id: newId,
    userId: session.user.id,
    collectionId,
    parentId: validParentId,
    content: trimmedContent,
    isSpoiler: spoilerFlag,
    isEdited: false,
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

  const actorName = created.user.name || session.user.name || "Someone";
  const commentSnippet = trimmedContent.slice(0, 80) + (trimmedContent.length > 80 ? "…" : "");

  // Notification logic
  if (validParentId && parentComment) {
    // Notify the parent comment's author if not replying to oneself
    if (parentComment.userId !== session.user.id) {
      await createNotification({
        recipientUserId: parentComment.userId,
        actorUserId: session.user.id,
        notificationType: "reply",
        collectionId: col.id,
        metadata: {
          actorName,
          actorUsername: created.user.username || null,
          actorImage: created.user.image || session.user.image || null,
          collectionTitle: col.title,
          commentPreview: trimmedContent.slice(0, 100),
          message: `${actorName} replied to your comment on "${col.title}": "${commentSnippet}"`,
          targetUrl: `/collection/${col.id}`,
        },
      });
    }

    // Also notify ranking owner if owner is neither the replier nor the parent comment author
    if (col.userId !== session.user.id && col.userId !== parentComment.userId) {
      await createNotification({
        recipientUserId: col.userId,
        actorUserId: session.user.id,
        notificationType: "comment",
        collectionId: col.id,
        metadata: {
          actorName,
          actorUsername: created.user.username || null,
          actorImage: created.user.image || session.user.image || null,
          collectionTitle: col.title,
          commentPreview: trimmedContent.slice(0, 100),
          message: `${actorName} commented on your ranking "${col.title}": "${commentSnippet}"`,
          targetUrl: `/collection/${col.id}`,
        },
      });
    }
  } else {
    // Top-level comment: notify ranking owner if commenter is not the ranking owner
    if (col.userId !== session.user.id) {
      await createNotification({
        recipientUserId: col.userId,
        actorUserId: session.user.id,
        notificationType: "comment",
        collectionId: col.id,
        metadata: {
          actorName,
          actorUsername: created.user.username || null,
          actorImage: created.user.image || session.user.image || null,
          collectionTitle: col.title,
          commentPreview: trimmedContent.slice(0, 100),
          message: `${actorName} commented on your ranking "${col.title}": "${commentSnippet}"`,
          targetUrl: `/collection/${col.id}`,
        },
      });
    }
  }

  return NextResponse.json({
    comment: {
      id: created.id,
      content: created.content,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      parentId: created.parentId,
      isSpoiler: created.isSpoiler,
      isEdited: created.isEdited,
      isAuthor: true,
      isCollectionOwner: isOwner,
      author: {
        id: created.user.id,
        name: created.user.name,
        username: created.user.username,
        image: created.user.image,
      },
      replies: [],
    },
  });
}
