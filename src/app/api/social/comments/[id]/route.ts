import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { requireRateLimit } from "@/lib/request-limits";
import { db } from "@/db";
import { comments } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRateLimit(`social-comment-edit:${session.user.id}`, 30);
  } catch {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id: commentId } = await params;

  const commentRecord = await db.query.comments.findFirst({
    where: (c, { eq }) => eq(c.id, commentId),
    with: {
      collection: {
        columns: { userId: true },
      },
    },
  });

  if (!commentRecord) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Strict author-only editing: Ranking owners can moderate/delete, but NEVER edit another author's comment
  if (commentRecord.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Forbidden: Only the author can edit this comment" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { content, isSpoiler } = body;

  const updateValues: Record<string, any> = {
    isEdited: true,
    updatedAt: new Date(),
  };

  if (content !== undefined) {
    if (typeof content !== "string") {
      return NextResponse.json({ error: "Content must be a string" }, { status: 400 });
    }
    const trimmed = content.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Comment content cannot be empty" }, { status: 400 });
    }
    if (trimmed.length > 2000) {
      return NextResponse.json(
        { error: "Comment exceeds maximum limit of 2,000 characters" },
        { status: 400 }
      );
    }
    updateValues.content = trimmed;
  }

  if (isSpoiler !== undefined) {
    updateValues.isSpoiler = Boolean(isSpoiler);
  }

  await db
    .update(comments)
    .set(updateValues)
    .where(eq(comments.id, commentId));

  const updated = await db.query.comments.findFirst({
    where: (c, { eq }) => eq(c.id, commentId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
      },
      collection: {
        columns: { userId: true },
      },
      review: {
        columns: { userId: true },
      },
    },
  });

  if (!updated) {
    return NextResponse.json({ error: "Failed to retrieve updated comment" }, { status: 500 });
  }

  return NextResponse.json({
    comment: {
      id: updated.id,
      content: updated.content,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      parentId: updated.parentId,
      isSpoiler: updated.isSpoiler,
      isEdited: updated.isEdited,
      isAuthor: true,
      isCollectionOwner: session.user.id === (updated.collection?.userId || updated.review?.userId),
      author: {
        id: updated.user.id,
        name: updated.user.name,
        username: updated.user.username,
        image: updated.user.image,
      },
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: commentId } = await params;

  const commentRecord = await db.query.comments.findFirst({
    where: (c, { eq }) => eq(c.id, commentId),
    with: {
      collection: {
        columns: { userId: true },
      },
      review: {
        columns: { userId: true },
      },
    },
  });

  if (!commentRecord) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Authorization check: User must be comment author OR the owner of the collection/review
  const isAuthor = commentRecord.userId === session.user.id;
  const isContentOwner =
    commentRecord.collection?.userId === session.user.id ||
    commentRecord.review?.userId === session.user.id;

  if (!isAuthor && !isContentOwner) {
    return NextResponse.json(
      { error: "Forbidden: You cannot delete this comment" },
      { status: 403 }
    );
  }

  await db.delete(comments).where(eq(comments.id, commentId));

  return NextResponse.json({ success: true, deletedId: commentId });
}
