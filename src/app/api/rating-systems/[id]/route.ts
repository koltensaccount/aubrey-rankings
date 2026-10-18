import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { ratingSystems, ratingCategories, collections, categoryScores, ratings } from "@/db/schema";
import { nanoid } from "@/lib/utils";
import { eq, and, asc, not, inArray, sql } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const system = await db.query.ratingSystems.findFirst({
      where: (rs, { eq, and }) =>
        and(eq(rs.id, id), eq(rs.userId, session.user.id)),
      with: {
        categories: {
          orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
        },
      },
    });

    if (!system) {
      return NextResponse.json({ error: "Rating system not found" }, { status: 404 });
    }

    return NextResponse.json(system);
  } catch (error: any) {
    console.error("[Get Rating System Error]", error);
    return NextResponse.json(
      { error: "Failed to fetch rating system" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, scale, isDefault, categories } = body;

    // Check ownership
    const existing = await db.query.ratingSystems.findFirst({
      where: (rs, { eq, and }) =>
        and(eq(rs.id, id), eq(rs.userId, session.user.id)),
      with: {
        categories: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Rating system not found" }, { status: 404 });
    }

    // Atomic transaction
    await db.transaction(async (tx) => {
      // If setting default, unset others
      if (isDefault) {
        await tx
          .update(ratingSystems)
          .set({ isDefault: false })
          .where(eq(ratingSystems.userId, session.user.id));
      }

      // Update system record
      const updatePayload: Record<string, any> = {};
      if (typeof name === "string" && name.trim()) updatePayload.name = name.trim();
      if (description !== undefined) updatePayload.description = description || null;
      if (typeof scale === "number") updatePayload.scale = scale;
      if (isDefault !== undefined) updatePayload.isDefault = Boolean(isDefault);

      if (Object.keys(updatePayload).length > 0) {
        await tx
          .update(ratingSystems)
          .set(updatePayload)
          .where(eq(ratingSystems.id, id));
      }

      // Sync categories if provided
      if (Array.isArray(categories)) {
        const incomingIds = categories
          .map((c) => c.id)
          .filter((cid) => typeof cid === "string" && cid.trim() !== "");

        // Delete removed categories
        const existingCatIds = existing.categories.map((c) => c.id);
        const toDelete = existingCatIds.filter((cid) => !incomingIds.includes(cid));

        if (toDelete.length > 0) {
          // Clean up category scores first
          await tx
            .delete(categoryScores)
            .where(inArray(categoryScores.categoryId, toDelete));
          // Delete categories
          await tx
            .delete(ratingCategories)
            .where(inArray(ratingCategories.id, toDelete));
        }

        // Upsert categories
        for (let idx = 0; idx < categories.length; idx++) {
          const cat = categories[idx];
          if (!cat.name || typeof cat.name !== "string" || !cat.name.trim()) continue;

          const weight = typeof cat.weight === "number" ? cat.weight : 1.0;
          const sortOrder = idx + 1;
          const isRequired = cat.isRequired !== false;

          if (cat.id && existingCatIds.includes(cat.id)) {
            // Update
            await tx
              .update(ratingCategories)
              .set({
                name: cat.name.trim(),
                description: cat.description || null,
                weight,
                sortOrder,
                isRequired,
              })
              .where(eq(ratingCategories.id, cat.id));
          } else {
            // Insert
            await tx.insert(ratingCategories).values({
              id: `rc_${Date.now()}_${nanoid(6)}`,
              ratingSystemId: id,
              name: cat.name.trim(),
              description: cat.description || null,
              weight,
              sortOrder,
              isRequired,
            });
          }
        }
      }
    });

    // Return updated system
    const updated = await db.query.ratingSystems.findFirst({
      where: (rs, { eq }) => eq(rs.id, id),
      with: {
        categories: {
          orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
        },
      },
    });

    return NextResponse.json({ success: true, ratingSystem: updated });
  } catch (error: any) {
    console.error("[Update Rating System Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update rating system" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check ownership
    const target = await db.query.ratingSystems.findFirst({
      where: (rs, { eq, and }) =>
        and(eq(rs.id, id), eq(rs.userId, session.user.id)),
      with: {
        categories: true,
      },
    });

    if (!target) {
      return NextResponse.json({ error: "Rating system not found" }, { status: 404 });
    }

    // Check count of user systems
    const allUserSystems = await db.query.ratingSystems.findMany({
      where: (rs, { eq }) => eq(rs.userId, session.user.id),
    });

    if (allUserSystems.length <= 1) {
      return NextResponse.json(
        { error: "You cannot delete your only rating system." },
        { status: 400 }
      );
    }

    // Protect historical ratings: block deletion if in use by existing ratings or category scores
    const catIds = target.categories.map((c) => c.id);
    const inUseRatingsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(ratings)
      .where(and(eq(ratings.userId, session.user.id), eq(ratings.ratingSystemId, id)))
      .then((res) => Number(res[0]?.count ?? 0));

    let inUseScoresCount = 0;
    if (catIds.length > 0) {
      inUseScoresCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(categoryScores)
        .where(inArray(categoryScores.categoryId, catIds))
        .then((res) => Number(res[0]?.count ?? 0));
    }

    if (inUseRatingsCount > 0 || inUseScoresCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete "${target.name}" because it is currently in use by ${inUseRatingsCount} saved rating(s) with ${inUseScoresCount} category score(s). To protect historical data, rubrics cannot be deleted while assigned.`,
        },
        { status: 409 }
      );
    }

    await db.transaction(async (tx) => {
      // Find fallback default system
      const fallbackSystem = allUserSystems.find((s) => s.id !== id);

      if (target.isDefault && fallbackSystem) {
        await tx
          .update(ratingSystems)
          .set({ isDefault: true })
          .where(eq(ratingSystems.id, fallbackSystem.id));
      }

      // Reassign collections using this system to fallback
      if (fallbackSystem) {
        await tx
          .update(collections)
          .set({ defaultRatingSystemId: fallbackSystem.id })
          .where(eq(collections.defaultRatingSystemId, id));
      }

      // Delete category scores and categories
      const catIds = target.categories.map((c) => c.id);
      if (catIds.length > 0) {
        await tx
          .delete(categoryScores)
          .where(inArray(categoryScores.categoryId, catIds));
        await tx
          .delete(ratingCategories)
          .where(eq(ratingCategories.ratingSystemId, id));
      }

      // Delete rating system
      await tx.delete(ratingSystems).where(eq(ratingSystems.id, id));
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error("[Delete Rating System Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete rating system" },
      { status: 500 }
    );
  }
}
