import { requireRateLimit } from "@/lib/request-limits";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { contentReports, comments, collections, ratings, user } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { checkIsAdmin } from "@/lib/admin";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const VALID_TARGET_TYPES = ["comment", "review", "ranking", "user"] as const;
const VALID_REASONS = [
  "harassment",
  "spam",
  "spoiler",
  "hate_speech",
  "inappropriate",
  "other",
] as const;

/**
 * POST /api/reports - Submit a report for inappropriate content or profile
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRateLimit(`reports:${session.user.id}`, 10);
  } catch {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const { targetType, targetId, reason, details } = body;

  if (!targetType || !VALID_TARGET_TYPES.includes(targetType)) {
    return NextResponse.json(
      { error: "Invalid target type. Must be 'comment', 'review', 'ranking', or 'user'" },
      { status: 400 }
    );
  }

  if (!targetId || typeof targetId !== "string" || !targetId.trim()) {
    return NextResponse.json({ error: "Target ID is required" }, { status: 400 });
  }

  if (!reason || !VALID_REASONS.includes(reason)) {
    return NextResponse.json(
      { error: "Invalid report reason" },
      { status: 400 }
    );
  }

  const trimmedDetails = typeof details === "string" ? details.trim() : null;
  if (trimmedDetails && trimmedDetails.length > 1000) {
    return NextResponse.json(
      { error: "Report details cannot exceed 1,000 characters" },
      { status: 400 }
    );
  }

  // Verify target existence and legitimate accessibility under shared visibility policy
  let targetExists = false;
  if (targetType === "comment") {
    const c = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, targetId),
      with: {
        collection: {
          columns: { id: true, userId: true, visibility: true, isPublic: true },
        },
        review: {
          columns: { id: true, userId: true, status: true, visibility: true },
        },
      },
    });
    if (c) {
      const isCommentAuthor = c.userId === session.user.id;
      let isContentAccessible = false;
      if (c.collection) {
        const isColOwner = c.collection.userId === session.user.id;
        const isPublicOrUnlisted =
          c.collection.visibility === "public" ||
          c.collection.visibility === "unlisted" ||
          c.collection.isPublic;
        isContentAccessible = isColOwner || isPublicOrUnlisted;
      } else if (c.review) {
        const isRevOwner = c.review.userId === session.user.id;
        const isPublicOrUnlisted =
          c.review.status === "published" &&
          (c.review.visibility === "public" || c.review.visibility === "unlisted");
        isContentAccessible = isRevOwner || isPublicOrUnlisted;
      }
      targetExists = isCommentAuthor || isContentAccessible;
    }
  } else if (targetType === "ranking") {
    const col = await db.query.collections.findFirst({
      where: (c, { eq }) => eq(c.id, targetId),
      columns: { id: true, userId: true, visibility: true, isPublic: true },
    });
    if (col) {
      const isOwner = col.userId === session.user.id;
      const isPublicOrUnlisted =
        col.visibility === "public" ||
        col.visibility === "unlisted" ||
        col.isPublic;
      targetExists = isOwner || isPublicOrUnlisted;
    }
  } else if (targetType === "review") {
    // Check first-class reviews table first
    const rev = await db.query.reviews.findFirst({
      where: (rv, { eq }) => eq(rv.id, targetId),
      columns: { id: true, userId: true, status: true, visibility: true },
    });
    if (rev) {
      const isAuthor = rev.userId === session.user.id;
      const isPublicOrUnlisted =
        rev.status === "published" &&
        (rev.visibility === "public" || rev.visibility === "unlisted");
      targetExists = isAuthor || isPublicOrUnlisted;
    } else {
      // Legacy ratings review fallback
      const r = await db.query.ratings.findFirst({
        where: (r, { eq }) => eq(r.id, targetId),
        with: {
          collection: {
            columns: { id: true, userId: true, visibility: true, isPublic: true },
          },
        },
      });
      // A review must actually have review text (not merely an unreviewed numeric rating)
      const hasReviewText = Boolean(r && r.reviewText && r.reviewText.trim().length > 0);
      if (r && hasReviewText) {
        const isAuthor = r.userId === session.user.id;
        const isPublicOrUnlisted = Boolean(
          r.collection &&
            (r.collection.visibility === "public" ||
              r.collection.visibility === "unlisted" ||
              r.collection.isPublic)
        );
        targetExists = isAuthor || isPublicOrUnlisted;
      }
    }
  } else if (targetType === "user") {
    const u = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, targetId),
      columns: { id: true },
    });
    targetExists = Boolean(u);
  }

  if (!targetExists) {
    return NextResponse.json({ error: "Reported content or user does not exist" }, { status: 404 });
  }

  // Deduplication check: check if user already has an open report for this target
  const existingOpenReport = await db.query.contentReports.findFirst({
    where: (r, { and, eq }) =>
      and(
        eq(r.reporterId, session.user.id),
        eq(r.targetType, targetType),
        eq(r.targetId, targetId),
        eq(r.status, "open")
      ),
  });

  if (existingOpenReport) {
    return NextResponse.json(
      {
        error: "You have already submitted an open report for this content. Our moderation team is reviewing it.",
        reportId: existingOpenReport.id,
      },
      { status: 409 }
    );
  }

  const reportId = `rep_${Date.now()}_${randomUUID().slice(0, 8)}`;

  await db.insert(contentReports).values({
    id: reportId,
    reporterId: session.user.id,
    targetType,
    targetId,
    reason,
    details: trimmedDetails,
    status: "open",
  });

  return NextResponse.json({
    success: true,
    message: "Thank you for helping keep the community safe. Your report has been submitted for review.",
    reportId,
  });
}

/**
 * GET /api/reports - Admin endpoint to list content reports
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session || !checkIsAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const statusFilter = searchParams.get("status");

  try {
    const reports = await db.query.contentReports.findMany({
      where: statusFilter
        ? (r, { eq }) => eq(r.status, statusFilter)
        : undefined,
      orderBy: [desc(contentReports.createdAt)],
      with: {
        reporter: {
          columns: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
      limit: 100,
    });

    return NextResponse.json({ reports });
  } catch (error: any) {
    console.error("[Get Reports Error]", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}
