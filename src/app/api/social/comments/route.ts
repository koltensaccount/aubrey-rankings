import { requireRateLimit } from "@/lib/request-limits";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { comments, collections, reviews, user } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createNotification } from "@/lib/notifications";
import { canComment, isBlocked, getBlockedUserIds } from "@/lib/safety";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  const collectionId = request.nextUrl.searchParams.get("collectionId");
  const reviewId = request.nextUrl.searchParams.get("reviewId");

  if (!collectionId && !reviewId) {
    return NextResponse.json({ error: "collectionId or reviewId required" }, { status: 400 });
  }

  const blockedIds = session ? await getBlockedUserIds(session.user.id) : new Set<string>();

  if (reviewId) {
    const rev = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
      columns: { id: true, userId: true, status: true, visibility: true },
    });

    if (!rev) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const isReviewAuthor = session?.user?.id === rev.userId;
    if (!isReviewAuthor) {
      if (session && (await isBlocked(rev.userId, session.user.id))) {
        return NextResponse.json({ error: "Review not found" }, { status: 404 });
      }
      if (rev.status !== "published" || rev.visibility === "private") {
        return NextResponse.json({ error: "Review not found" }, { status: 404 });
      }
    }

    const rawList = await db.query.comments.findMany({
      where: eq(comments.reviewId, reviewId),
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
      isCollectionOwner: isReviewAuthor,
      author: {
        id: item.user.id,
        name: item.user.name,
        username: item.user.username,
        image: item.user.image,
      },
    });

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

    return NextResponse.json({ comments: topLevelComments });
  }

  // Collection comments path
  const col = await db.query.collections.findFirst({
    where: (c, { eq }) => eq(c.id, collectionId!),
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

  const rawList = await db.query.comments.findMany({
    where: (c, { eq }) => eq(c.collectionId, collectionId!),
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

  const { collectionId, reviewId, content, parentId, isSpoiler } = body;

  if (!collectionId && !reviewId) {
    return NextResponse.json({ error: "collectionId or reviewId required" }, { status: 400 });
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
        return NextResponse.json({ error: "Cannot comment on this review" }, { status: 403 });
      }
    }

    const commentCheck = await canComment({
      authorId: rev.userId,
      commenterId: session.user.id,
      collectionAllowComments: true,
    });

    if (!commentCheck.allowed) {
      return NextResponse.json({ error: commentCheck.reason || "Forbidden" }, { status: 403 });
    }

    let validParentId: string | null = null;
    let parentComment: any = null;
    if (parentId && typeof parentId === "string") {
      parentComment = await db.query.comments.findFirst({
        where: and(eq(comments.id, parentId), eq(comments.reviewId, reviewId)),
      });

      if (!parentComment) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }

      if (parentComment.parentId) {
        return NextResponse.json(
          { error: "Nested replies beyond 1 level are not permitted" },
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
      collectionId: null,
      reviewId,
      parentId: validParentId,
      content: trimmedContent,
      isSpoiler: spoilerFlag,
      isEdited: false,
    });

    const created = await db.query.comments.findFirst({
      where: eq(comments.id, newId),
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
    const title = rev.title || rev.mediaItem.title;

    if (validParentId && parentComment) {
      if (parentComment.userId !== session.user.id) {
        await createNotification({
          recipientUserId: parentComment.userId,
          actorUserId: session.user.id,
          notificationType: "reply",
          reviewId: rev.id,
          mediaItemId: rev.mediaItemId,
          metadata: {
            actorName,
            actorUsername: created.user.username || null,
            actorImage: created.user.image || session.user.image || null,
            commentPreview: trimmedContent.slice(0, 100),
            commentId: newId,
            message: `${actorName} replied to your comment on review of "${title}": "${commentSnippet}"`,
            targetUrl: `/review/${rev.id}`,
          },
        });
      }
      if (rev.userId !== session.user.id && rev.userId !== parentComment.userId) {
        await createNotification({
          recipientUserId: rev.userId,
          actorUserId: session.user.id,
          notificationType: "comment",
          reviewId: rev.id,
          mediaItemId: rev.mediaItemId,
          metadata: {
            actorName,
            actorUsername: created.user.username || null,
            actorImage: created.user.image || session.user.image || null,
            commentPreview: trimmedContent.slice(0, 100),
            commentId: newId,
            message: `${actorName} commented on your review of "${title}": "${commentSnippet}"`,
            targetUrl: `/review/${rev.id}`,
          },
        });
      }
    } else {
      if (rev.userId !== session.user.id) {
        await createNotification({
          recipientUserId: rev.userId,
          actorUserId: session.user.id,
          notificationType: "comment",
          reviewId: rev.id,
          mediaItemId: rev.mediaItemId,
          metadata: {
            actorName,
            actorUsername: created.user.username || null,
            actorImage: created.user.image || session.user.image || null,
            commentPreview: trimmedContent.slice(0, 100),
            commentId: newId,
            message: `${actorName} commented on your review of "${title}": "${commentSnippet}"`,
            targetUrl: `/review/${rev.id}`,
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
        isCollectionOwner: isAuthor,
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

  // Collection comments path
  const col = await db.query.collections.findFirst({
    where: (c, { eq }) => eq(c.id, collectionId!),
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
  const commentCheck = await canComment({
    authorId: col.userId,
    commenterId: session.user.id,
    collectionAllowComments: col.allowComments ?? true,
  });

  if (!commentCheck.allowed) {
    return NextResponse.json({ error: commentCheck.reason || "Forbidden" }, { status: 403 });
  }

  // Check parentId if this is a reply
  let validParentId: string | null = null;
  let parentComment: any = null;
  if (parentId && typeof parentId === "string") {
    parentComment = await db.query.comments.findFirst({
      where: (c, { and, eq }) =>
        and(eq(c.id, parentId), eq(c.collectionId, collectionId!)),
    });

    if (!parentComment) {
      return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
    }

    // Limit reply nesting to 1 level (replies cannot be replied to)
    if (parentComment.parentId) {
      return NextResponse.json(
        { error: "Nested replies beyond 1 level are not permitted" },
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
    collectionId: collectionId!,
    reviewId: null,
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
          commentId: newId,
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
          commentId: newId,
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
          commentId: newId,
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
