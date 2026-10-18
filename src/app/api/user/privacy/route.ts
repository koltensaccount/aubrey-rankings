import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const VALID_COMMENT_PERMISSIONS = ["everyone", "following", "nobody"] as const;
const VALID_REVIEW_VISIBILITIES = ["public", "unlisted", "private"] as const;

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const u = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, session.user.id),
    columns: {
      commentPermission: true,
      defaultReviewVisibility: true,
      defaultReviewSpoiler: true,
    },
  });

  return NextResponse.json({
    privacy: {
      commentPermission: u?.commentPermission || "everyone",
      defaultReviewVisibility: u?.defaultReviewVisibility || "private",
      defaultReviewSpoiler: u?.defaultReviewSpoiler || false,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updates: Record<string, any> = { updatedAt: new Date() };

  if (body.commentPermission !== undefined) {
    if (!VALID_COMMENT_PERMISSIONS.includes(body.commentPermission)) {
      return NextResponse.json(
        { error: "Invalid comment permission. Must be 'everyone', 'following', or 'nobody'" },
        { status: 400 }
      );
    }
    updates.commentPermission = body.commentPermission;
  }

  if (body.defaultReviewVisibility !== undefined) {
    if (!VALID_REVIEW_VISIBILITIES.includes(body.defaultReviewVisibility)) {
      return NextResponse.json(
        { error: "Invalid default review visibility. Must be 'public', 'unlisted', or 'private'" },
        { status: 400 }
      );
    }
    updates.defaultReviewVisibility = body.defaultReviewVisibility;
  }

  if (body.defaultReviewSpoiler !== undefined) {
    if (typeof body.defaultReviewSpoiler !== "boolean") {
      return NextResponse.json(
        { error: "defaultReviewSpoiler must be a boolean" },
        { status: 400 }
      );
    }
    updates.defaultReviewSpoiler = body.defaultReviewSpoiler;
  }

  await db.update(user).set(updates).where(eq(user.id, session.user.id));

  const updated = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, session.user.id),
    columns: {
      commentPermission: true,
      defaultReviewVisibility: true,
      defaultReviewSpoiler: true,
    },
  });

  return NextResponse.json({ success: true, privacy: updated });
}
