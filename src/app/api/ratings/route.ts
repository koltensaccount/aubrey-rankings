import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { ratings, categoryScores, ratingCategories, ratingSystems, collections } from "@/db/schema";
import { calculateWeightedAverage, CategoryDef } from "@/lib/scoring";
import { nanoid } from "@/lib/utils";
import { eq, and, isNull } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      mediaItemId,
      collectionId,
      ratingSystemId,
      scores, // { [categoryId: string]: number | null }
      watchDate,
      reviewText,
      personalNotes,
      isWatched,
      isFavorite,
    } = body;

    if (!mediaItemId || typeof mediaItemId !== "string") {
      return NextResponse.json(
        { error: "Valid mediaItemId is required" },
        { status: 400 }
      );
    }

    // 1. Verify collection ownership if collectionId is provided
    if (collectionId) {
      const col = await db.query.collections.findFirst({
        where: (c, { eq, and }) =>
          and(eq(c.id, collectionId), eq(c.userId, session.user.id)),
      });
      if (!col) {
        return NextResponse.json(
          { error: "Collection not found or access denied" },
          { status: 404 }
        );
      }
    }

    // 2. Verify rating system ownership
    if (ratingSystemId) {
      const rs = await db.query.ratingSystems.findFirst({
        where: (r, { eq, and }) =>
          and(eq(r.id, ratingSystemId), eq(r.userId, session.user.id)),
      });
      if (!rs) {
        return NextResponse.json(
          { error: "Invalid rating system or access denied" },
          { status: 400 }
        );
      }
    }

    // 3. Find existing rating (with strict collection scope vs isNull for global)
    const existing = await db.query.ratings.findFirst({
      where: (r, { eq, and, isNull }) =>
        and(
          eq(r.userId, session.user.id),
          eq(r.mediaItemId, mediaItemId),
          collectionId ? eq(r.collectionId, collectionId) : isNull(r.collectionId)
        ),
      with: {
        categoryScores: true,
      },
    });

    const activeRatingSystemId =
      ratingSystemId || existing?.ratingSystemId || null;

    let categoriesList: CategoryDef[] = [];
    if (activeRatingSystemId) {
      const categoriesFromDb = await db.query.ratingCategories.findMany({
        where: (rc, { eq }) => eq(rc.ratingSystemId, activeRatingSystemId),
      });

      categoriesList = categoriesFromDb.map((c) => ({
        id: c.id,
        name: c.name,
        weight: c.weight,
        isRequired: c.isRequired,
      }));
    }

    // Determine final score map
    let finalScores: Record<string, number | null> = {};
    if (existing?.categoryScores) {
      for (const cs of existing.categoryScores) {
        finalScores[cs.categoryId] = cs.score;
      }
    }

    if (scores && typeof scores === "object") {
      for (const [catId, val] of Object.entries(scores)) {
        if (val === null || val === undefined || isNaN(Number(val))) {
          delete finalScores[catId];
        } else {
          finalScores[catId] = Number(val);
        }
      }
    }

    let calculatedOverallScore = existing?.calculatedOverallScore ?? null;
    if (categoriesList.length > 0 && (scores !== undefined || existing?.categoryScores)) {
      const calcResult = calculateWeightedAverage(categoriesList, finalScores);
      calculatedOverallScore = calcResult.weightedScore;
    }

    const ratingId = existing ? existing.id : `rate_${Date.now()}_${nanoid(6)}`;

    // 4. Perform atomic transactional update
    await db.transaction(async (tx) => {
      if (existing) {
        await tx
          .update(ratings)
          .set({
            calculatedOverallScore,
            ratingSystemId: activeRatingSystemId,
            watchDate: watchDate ? new Date(watchDate) : existing.watchDate,
            reviewText: reviewText !== undefined ? reviewText : existing.reviewText,
            personalNotes:
              personalNotes !== undefined ? personalNotes : existing.personalNotes,
            isWatched:
              isWatched !== undefined ? Boolean(isWatched) : existing.isWatched,
            isFavorite:
              isFavorite !== undefined ? Boolean(isFavorite) : existing.isFavorite,
            updatedAt: new Date(),
          })
          .where(eq(ratings.id, existing.id));
      } else {
        await tx.insert(ratings).values({
          id: ratingId,
          userId: session.user.id,
          mediaItemId,
          collectionId: collectionId || null,
          ratingSystemId: activeRatingSystemId,
          calculatedOverallScore,
          watchDate: watchDate ? new Date(watchDate) : null,
          reviewText: reviewText || null,
          personalNotes: personalNotes || null,
          isWatched: isWatched !== undefined ? Boolean(isWatched) : true,
          isFavorite: Boolean(isFavorite),
        });
      }

      // Synchronize category scores if provided
      if (scores && typeof scores === "object" && categoriesList.length > 0) {
        // Delete any category scores no longer in finalScores
        for (const cat of categoriesList) {
          const scoreVal = finalScores[cat.id];
          if (scoreVal !== undefined && scoreVal !== null) {
            const scoreId = `cs_${ratingId}_${cat.id}`;
            await tx
              .insert(categoryScores)
              .values({
                id: scoreId,
                ratingId,
                categoryId: cat.id,
                score: Number(scoreVal),
                weightApplied: cat.weight,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [categoryScores.ratingId, categoryScores.categoryId],
                set: {
                  score: Number(scoreVal),
                  weightApplied: cat.weight,
                  updatedAt: new Date(),
                },
              });
          } else {
            // Remove cleared score row
            await tx
              .delete(categoryScores)
              .where(
                and(
                  eq(categoryScores.ratingId, ratingId),
                  eq(categoryScores.categoryId, cat.id)
                )
              );
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      ratingId,
      calculatedOverallScore,
    });
  } catch (error: any) {
    console.error("[Save Rating Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save rating" },
      { status: 500 }
    );
  }
}
