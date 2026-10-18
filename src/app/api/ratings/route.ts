import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { ratings, categoryScores, collections } from "@/db/schema";
import { calculateWeightedAverage } from "@/lib/scoring";
import { normalizeRatingScores } from "@/lib/rating-validation";
import { nanoid } from "@/lib/utils";
import { eq, and, isNull, sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json(
      { error: "A JSON object is required" },
      { status: 400 },
    );
  const {
    mediaItemId,
    collectionId,
    ratingSystemId,
    scores,
    categoryScores: inputCategoryScores,
    watchDate,
    reviewText,
    personalNotes,
    isWatched,
    isFavorite,
  } = body;
  if (
    typeof mediaItemId !== "string" ||
    !mediaItemId ||
    (collectionId != null && typeof collectionId !== "string") ||
    (ratingSystemId != null && typeof ratingSystemId !== "string") ||
    [isWatched, isFavorite].some(
      (value) => value !== undefined && typeof value !== "boolean",
    ) ||
    [reviewText, personalNotes].some(
      (value) => value != null && typeof value !== "string",
    )
  ) {
    return NextResponse.json(
      { error: "Invalid rating fields" },
      { status: 400 },
    );
  }
  let parsedWatchDate: Date | null | undefined;
  if (watchDate !== undefined) {
    parsedWatchDate =
      watchDate === null
        ? null
        : typeof watchDate === "string"
          ? new Date(watchDate)
          : new Date(NaN);
    if (
      parsedWatchDate &&
      (!Number.isFinite(parsedWatchDate.getTime()) ||
        (/^\d{4}-\d{2}-\d{2}$/.test(watchDate) &&
          parsedWatchDate.toISOString().slice(0, 10) !== watchDate))
    ) {
      return NextResponse.json(
        { error: "Invalid watch date" },
        { status: 400 },
      );
    }
  }
  try {
    return await db.transaction(async (tx) => {
      // Serialize collection edits with entry removal, and concurrent saves to this rating scope.
      const col = collectionId
        ? (
            await tx
              .select()
              .from(collections)
              .where(
                and(
                  eq(collections.id, collectionId),
                  eq(collections.userId, session.user.id),
                ),
              )
              .for("update")
          )[0]
        : null;
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([session.user.id, collectionId || null, mediaItemId])}, 0))`,
      );
      if (collectionId && !col)
        return NextResponse.json(
          { error: "Collection not found or access denied" },
          { status: 404 },
        );
      const media = await tx.query.mediaItems.findFirst({
        where: (m, { eq }) => eq(m.id, mediaItemId),
        columns: { id: true },
      });
      if (!media)
        return NextResponse.json(
          { error: "Media item not found" },
          { status: 404 },
        );
      if (col) {
        const entry = await tx.query.collectionEntries.findFirst({
          where: (e, { eq, and }) =>
            and(eq(e.collectionId, col.id), eq(e.mediaItemId, mediaItemId)),
        });
        if (!entry)
          return NextResponse.json(
            { error: "Media item is not in this collection" },
            { status: 400 },
          );
      }
      await tx
        .select({ id: ratings.id })
        .from(ratings)
        .where(
          and(
            eq(ratings.userId, session.user.id),
            eq(ratings.mediaItemId, mediaItemId),
            collectionId
              ? eq(ratings.collectionId, collectionId)
              : isNull(ratings.collectionId),
          ),
        )
        .for("update");
      const existing = await tx.query.ratings.findFirst({
        where: (r, { eq, and, isNull }) =>
          and(
            eq(r.userId, session.user.id),
            eq(r.mediaItemId, mediaItemId),
            collectionId
              ? eq(r.collectionId, collectionId)
              : isNull(r.collectionId),
          ),
        with: { categoryScores: true },
      });
      const activeRatingSystemId =
        ratingSystemId === undefined
          ? (existing?.ratingSystemId ?? col?.defaultRatingSystemId ?? null)
          : ratingSystemId;
      const system = activeRatingSystemId
        ? await tx.query.ratingSystems.findFirst({
            where: (r, { eq, and }) =>
              and(
                eq(r.id, activeRatingSystemId),
                eq(r.userId, session.user.id),
              ),
            with: { categories: true },
          })
        : null;
      if (activeRatingSystemId && !system)
        return NextResponse.json(
          { error: "Invalid rating system or access denied" },
          { status: 400 },
        );
      const isScoresUpdate = scores !== undefined || inputCategoryScores !== undefined;
      const categories = system?.categories ?? [];
      let finalScores: Record<string, number> = {};
      let calculatedOverallScore: number | null = existing?.calculatedOverallScore ?? null;

      if (isScoresUpdate) {
        try {
          finalScores = normalizeRatingScores(
            categories,
            Object.fromEntries(
              (existing?.categoryScores ?? []).map((score) => [
                score.categoryId,
                score.score,
              ]),
            ),
            scores,
            inputCategoryScores,
            system?.scale ?? 10,
          );
        } catch (error) {
          return NextResponse.json(
            { error: error instanceof Error ? error.message : "Invalid scores" },
            { status: 400 },
          );
        }
        calculatedOverallScore = calculateWeightedAverage(
          categories,
          finalScores,
        ).weightedScore;
      }

      const ratingId = existing?.id ?? `rate_${Date.now()}_${nanoid(6)}`;
      {
        const values = {
          calculatedOverallScore,
          ratingSystemId: isScoresUpdate ? activeRatingSystemId : (existing?.ratingSystemId ?? activeRatingSystemId),
          watchDate:
            parsedWatchDate === undefined
              ? (existing?.watchDate ?? null)
              : parsedWatchDate,
          reviewText:
            reviewText === undefined
              ? (existing?.reviewText ?? null)
              : reviewText,
          personalNotes:
            personalNotes === undefined
              ? (existing?.personalNotes ?? null)
              : personalNotes,
          isWatched: isWatched ?? existing?.isWatched ?? true,
          isFavorite: isFavorite ?? existing?.isFavorite ?? false,
          updatedAt: new Date(),
        };
        if (existing)
          await tx
            .update(ratings)
            .set(values)
            .where(
              and(
                eq(ratings.id, ratingId),
                eq(ratings.userId, session.user.id),
              ),
            );
        else
          await tx
            .insert(ratings)
            .values({
              id: ratingId,
              userId: session.user.id,
              mediaItemId,
              collectionId: collectionId || null,
              ...values,
            });

        if (isScoresUpdate) {
          // Replace atomically for both input formats; remove categories from any previous system.
          await tx
            .delete(categoryScores)
            .where(eq(categoryScores.ratingId, ratingId));
          const rows = categories
            .filter((category) => finalScores[category.id] !== undefined)
            .map((category) => ({
              id: `cs_${ratingId}_${category.id}`,
              ratingId,
              categoryId: category.id,
              score: finalScores[category.id],
              weightApplied: category.weight,
            }));
          if (rows.length) await tx.insert(categoryScores).values(rows);
        }
      }
      const rating = await tx.query.ratings.findFirst({
        where: (r, { eq }) => eq(r.id, ratingId),
        with: { categoryScores: true },
      });
      return NextResponse.json({
        success: true,
        ratingId,
        mediaItemId,
        calculatedOverallScore,
        rating,
      });
    });
  } catch (error) {
    console.error("[Save Rating Error]", error);
    const code =
      (error as { code?: string; cause?: { code?: string } })?.cause?.code ??
      (error as { code?: string })?.code;
    return NextResponse.json(
      {
        error:
          code === "23505"
            ? "This rating was updated concurrently. Please retry."
            : "Failed to save rating",
      },
      { status: code === "23505" ? 409 : 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const ratingId = url.searchParams.get("ratingId");
    const mediaItemId = url.searchParams.get("mediaItemId");
    const collectionId = url.searchParams.get("collectionId");

    let targetRating: typeof ratings.$inferSelect | undefined;

    if (ratingId) {
      targetRating = await db.query.ratings.findFirst({
        where: (r, { eq, and }) =>
          and(eq(r.id, ratingId), eq(r.userId, session.user.id)),
      });
    } else if (mediaItemId) {
      targetRating = await db.query.ratings.findFirst({
        where: (r, { eq, and, isNull }) =>
          and(
            eq(r.userId, session.user.id),
            eq(r.mediaItemId, mediaItemId),
            collectionId
              ? eq(r.collectionId, collectionId)
              : isNull(r.collectionId),
          ),
      });
    } else {
      return NextResponse.json(
        { error: "ratingId or mediaItemId is required to delete rating" },
        { status: 400 },
      );
    }

    if (!targetRating) {
      return NextResponse.json(
        { error: "Rating not found or access denied" },
        { status: 404 },
      );
    }

    const clearScoresOnly = url.searchParams.get("clearScoresOnly") === "true";

    if (clearScoresOnly) {
      await db.transaction(async (tx) => {
        await tx
          .delete(categoryScores)
          .where(eq(categoryScores.ratingId, targetRating!.id));
        await tx
          .update(ratings)
          .set({
            calculatedOverallScore: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(ratings.id, targetRating!.id),
              eq(ratings.userId, session.user.id),
            ),
          );
      });

      return NextResponse.json({
        success: true,
        clearedScoresOnly: true,
        deletedRatingId: targetRating.id,
        mediaItemId: targetRating.mediaItemId,
      });
    }

    // Delete rating record (foreign key cascade removes related categoryScores)
    await db
      .delete(ratings)
      .where(
        and(
          eq(ratings.id, targetRating.id),
          eq(ratings.userId, session.user.id),
        ),
      );

    return NextResponse.json({
      success: true,
      deletedRatingId: targetRating.id,
      mediaItemId: targetRating.mediaItemId,
    });
  } catch (error: any) {
    console.error("[Delete Rating Error]", error);
    return NextResponse.json(
      { error: "Failed to delete rating" },
      { status: 500 },
    );
  }
}
