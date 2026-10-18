import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { comments, collections } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
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
    },
  });

  if (!commentRecord) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Authorization check: User must be comment author OR the owner of the collection
  const isAuthor = commentRecord.userId === session.user.id;
  const isCollectionOwner = commentRecord.collection?.userId === session.user.id;

  if (!isAuthor && !isCollectionOwner) {
    return NextResponse.json(
      { error: "Forbidden: You cannot delete this comment" },
      { status: 403 }
    );
  }

  await db.delete(comments).where(eq(comments.id, commentId));

  return NextResponse.json({ success: true, deletedId: commentId });
}
