import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { categoryScores, ratings, reviews } from "@/db/schema";
import { calculateWeightedAverage } from "@/lib/scoring";
import { normalizeRatingScores } from "@/lib/rating-validation";
import { nanoid } from "@/lib/utils";
import { randomUUID } from "crypto";
import { resolveMediaItem } from "@/app/api/reviews/route";

const visibilityValues = ["private", "unlisted", "public"] as const;

export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.mediaItemId !== "string") {
    return NextResponse.json({ error: "mediaItemId is required" }, { status: 400 });
  }

  const { mediaItemId, quickScore, detailedRating, clearRating, review: reviewInput } = body as {
    mediaItemId: string;
    quickScore?: number | null;
    detailedRating?: { ratingSystemId: string; scores: Record<string, number | null>; replaceRatingSystem?: boolean };
    clearRating?: boolean;
    review?: Record<string, unknown>;
  };
  if (detailedRating !== undefined && (!detailedRating || typeof detailedRating.ratingSystemId !== "string" || !detailedRating.ratingSystemId || !detailedRating.scores || typeof detailedRating.scores !== "object")) {
    return NextResponse.json({ error: "Invalid detailed rating" }, { status: 400 });
  }
  if (quickScore !== undefined && detailedRating !== undefined) return NextResponse.json({ error: "Choose either quick or detailed scoring" }, { status: 400 });
  if (quickScore !== undefined && quickScore !== null && (!Number.isFinite(quickScore) || quickScore < 0 || quickScore > 10)) {
    return NextResponse.json({ error: "Quick rating must be between 0 and 10" }, { status: 400 });
  }
  if (clearRating !== undefined && typeof clearRating !== "boolean") {
    return NextResponse.json({ error: "Invalid clearRating value" }, { status: 400 });
  }
  if (reviewInput !== undefined && (!reviewInput || typeof reviewInput !== "object" || Array.isArray(reviewInput))) {
    return NextResponse.json({ error: "Invalid review" }, { status: 400 });
  }

  const resolvedMediaId = await resolveMediaItem(mediaItemId);
  if (!resolvedMediaId) return NextResponse.json({ error: "Media item not found" }, { status: 404 });

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([session.user.id, resolvedMediaId])}, 0))`);
    const existingRating = await tx.query.ratings.findFirst({
      where: (r, { and, eq, isNull }) => and(eq(r.userId, session.user.id), eq(r.mediaItemId, resolvedMediaId), isNull(r.collectionId)),
      with: { categoryScores: true },
    });

    let journalRatingId: string | null = existingRating?.id ?? null;
    if (clearRating) {
      if (existingRating && (existingRating.sourceRating !== null || existingRating.sourceService)) {
        return NextResponse.json({ error: "Imported ratings are preserved and cannot be cleared here" }, { status: 409 });
      }
      if (existingRating) await tx.delete(ratings).where(eq(ratings.id, existingRating.id));
      journalRatingId = null;
    } else if (detailedRating) {
      if (existingRating && (existingRating.sourceRating !== null || existingRating.sourceService)) return NextResponse.json({ error: "Imported ratings are preserved and cannot be replaced here" }, { status: 409 });
      const system = await tx.query.ratingSystems.findFirst({
        where: (rs, { and, eq, or, isNull }) => and(eq(rs.id, detailedRating.ratingSystemId), eq(rs.type, "numerical"), or(eq(rs.userId, session.user.id), and(isNull(rs.userId), eq(rs.isSystemTemplate, true)))),
        with: { categories: true },
      });
      if (!system) return NextResponse.json({ error: "Numerical rating system not found" }, { status: 400 });
      if (existingRating?.categoryScores.length && existingRating.ratingSystemId !== system.id && !detailedRating.replaceRatingSystem) return NextResponse.json({ error: "Changing a saved rating's rubric requires explicit confirmation", code: "RUBRIC_CHANGE_REQUIRES_CONFIRMATION" }, { status: 409 });
      let scores: Record<string, number>;
      try { scores = normalizeRatingScores(system.categories, {}, detailedRating.scores, undefined, system.scale); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid category scores" }, { status: 400 }); }
      const score = calculateWeightedAverage(system.categories, scores).weightedScore;
      const id = existingRating?.id ?? `rate_${Date.now()}_${nanoid(6)}`;
      if (existingRating) await tx.update(ratings).set({ ratingSystemId: system.id, tierId: null, calculatedOverallScore: score, isWatched: true, updatedAt: new Date() }).where(eq(ratings.id, id));
      else await tx.insert(ratings).values({ id, userId: session.user.id, mediaItemId: resolvedMediaId, collectionId: null, ratingSystemId: system.id, calculatedOverallScore: score, isWatched: true });
      await tx.delete(categoryScores).where(eq(categoryScores.ratingId, id));
      const rows = system.categories.filter((category) => scores[category.id] !== undefined).map((category) => ({ id: `cs_${id}_${category.id}`, ratingId: id, categoryId: category.id, score: scores[category.id], weightApplied: category.weight }));
      if (rows.length) await tx.insert(categoryScores).values(rows);
      journalRatingId = id;
    } else if (quickScore !== undefined) {
      if (existingRating && (existingRating.sourceRating !== null || existingRating.sourceService)) {
        return NextResponse.json({ error: "Imported ratings are preserved; create or edit writing without replacing the imported score" }, { status: 409 });
      }
      if (existingRating?.ratingSystemId || existingRating?.categoryScores.length) {
        return NextResponse.json({ error: "Replace a detailed rubric from its rating editor with explicit confirmation", code: "RUBRIC_CHANGE_REQUIRES_CONFIRMATION" }, { status: 409 });
      }
      const score = quickScore === null ? null : Number(quickScore.toFixed(1));
      if (existingRating) {
        await tx.update(ratings).set({ calculatedOverallScore: score, updatedAt: new Date(), isWatched: true }).where(eq(ratings.id, existingRating.id));
        journalRatingId = existingRating.id;
      } else if (score !== null) {
        const id = `rate_${Date.now()}_${nanoid(6)}`;
        await tx.insert(ratings).values({ id, userId: session.user.id, mediaItemId: resolvedMediaId, collectionId: null, calculatedOverallScore: score, isWatched: true });
        journalRatingId = id;
      }
    }

    let review = null;
    if (reviewInput) {
      const id = typeof reviewInput.id === "string" ? reviewInput.id : null;
      const existingReview = await tx.query.reviews.findFirst({
        where: (r, { and, eq }) => id
          ? and(eq(r.id, id), eq(r.userId, session.user.id), eq(r.mediaItemId, resolvedMediaId), eq(r.isJournal, true))
          : and(eq(r.userId, session.user.id), eq(r.mediaItemId, resolvedMediaId), eq(r.isJournal, true)),
      });
      if (id && !existingReview) return NextResponse.json({ error: "Review not found or access denied" }, { status: 404 });
      const content = typeof reviewInput.content === "string" ? reviewInput.content : "";
      const status = reviewInput.status === "published" ? "published" : "draft";
      const visibility = visibilityValues.includes(reviewInput.visibility as typeof visibilityValues[number]) ? reviewInput.visibility as typeof visibilityValues[number] : (existingReview?.visibility ?? "private");
      if (status === "published" && !content.trim()) return NextResponse.json({ error: "Writing is required to publish a review" }, { status: 400 });
      const now = new Date();
      const reviewId = existingReview?.id ?? `rev_${randomUUID()}`;
      const reviewRatingId = journalRatingId;
      if (existingReview?.status === "published" && status === "draft") {
        await tx.update(reviews).set({ draftContent: content, draftContentFormat: "markdown", ratingId: reviewRatingId, updatedAt: now }).where(eq(reviews.id, reviewId));
      } else if (existingReview) {
        await tx.update(reviews).set({
          title: typeof reviewInput.title === "string" && reviewInput.title.trim() ? reviewInput.title.trim() : null,
          content,
          draftContent: status === "draft" ? content : null,
          contentFormat: "markdown",
          draftContentFormat: status === "draft" ? "markdown" : null,
          status,
          visibility,
          isSpoiler: Boolean(reviewInput.isSpoiler),
          ratingId: reviewRatingId,
          publishedAt: status === "published" ? (existingReview.publishedAt ?? now) : null,
          updatedAt: now,
        }).where(eq(reviews.id, reviewId));
      } else {
        await tx.insert(reviews).values({
          id: reviewId, userId: session.user.id, mediaItemId: resolvedMediaId, ratingId: reviewRatingId,
          title: typeof reviewInput.title === "string" && reviewInput.title.trim() ? reviewInput.title.trim() : null,
          content, draftContent: status === "draft" ? content : null, contentFormat: "markdown", draftContentFormat: status === "draft" ? "markdown" : null,
          status, visibility, isSpoiler: Boolean(reviewInput.isSpoiler), publishedAt: status === "published" ? now : null, createdAt: now, updatedAt: now,
          isJournal: true,
        });
      }
      review = await tx.query.reviews.findFirst({ where: (r, { eq }) => eq(r.id, reviewId) });
    }
    return NextResponse.json({ ratingId: journalRatingId, review, mediaItemId: resolvedMediaId });
  });
}
