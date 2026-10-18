import { db } from "@/db";
import {
  ratingSystems,
  ratingCategories,
  ratings,
  categoryScores,
  collections,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
export class RubricError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function validateRubric(body: any, create = false) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new RubricError("A JSON object is required");
  if (
    (create || body.name !== undefined) &&
    (typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.length > 200)
  )
    throw new RubricError("A rubric name of 1–200 characters is required");
  if (
    body.description != null &&
    (typeof body.description !== "string" || body.description.length > 2000)
  )
    throw new RubricError("Invalid description");
  if (
    body.scale !== undefined &&
    (!Number.isInteger(body.scale) || body.scale < 1 || body.scale > 100)
  )
    throw new RubricError("Scale must be an integer between 1 and 100");
  if (body.isDefault !== undefined && typeof body.isDefault !== "boolean")
    throw new RubricError("isDefault must be boolean");
  if (create || body.categories !== undefined) {
    if (
      !Array.isArray(body.categories) ||
      body.categories.length < 1 ||
      body.categories.length > 50
    )
      throw new RubricError("Provide 1–50 categories");
    const ids = new Set<string>();
    for (const c of body.categories) {
      if (
        !c ||
        typeof c.name !== "string" ||
        !c.name.trim() ||
        c.name.length > 200 ||
        (c.weight !== undefined &&
          (typeof c.weight !== "number" ||
            !Number.isFinite(c.weight) ||
            c.weight < 0 ||
            c.weight > 100)) ||
        (c.isRequired !== undefined && typeof c.isRequired !== "boolean") ||
        (c.description != null &&
          (typeof c.description !== "string" || c.description.length > 2000))
      )
        throw new RubricError("Invalid category");
      if (c.id != null && (typeof c.id !== "string" || ids.has(c.id)))
        throw new RubricError("Invalid or duplicate category ID");
      if (c.id) ids.add(c.id);
    }
    if (!body.categories.some((c: any) => (c.weight ?? 1) > 0))
      throw new RubricError("At least one category must have positive weight");
  }
}
export async function mutateRubric(
  userId: string,
  id: string,
  body: any,
  remove = false,
) {
  if (!remove) validateRubric(body);
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`rubrics:${userId}`},0))`,
    );
    const [system] = await tx
      .select()
      .from(ratingSystems)
      .where(and(eq(ratingSystems.id, id), eq(ratingSystems.userId, userId)))
      .for("update");
    if (!system) throw new RubricError("Rating system not found", 404);
    const cats = await tx
      .select()
      .from(ratingCategories)
      .where(eq(ratingCategories.ratingSystemId, id));
    const used = await tx
      .select({ id: ratings.id })
      .from(ratings)
      .where(eq(ratings.ratingSystemId, id))
      .limit(1);
    const scores = cats.length
      ? await tx
          .select({ id: categoryScores.id })
          .from(categoryScores)
          .where(
            inArray(
              categoryScores.categoryId,
              cats.map((c) => c.id),
            ),
          )
          .limit(1)
      : [];
    const inUse = used.length > 0 || scores.length > 0;
    if (remove) {
      const assigned = await tx
        .select({ id: collections.id })
        .from(collections)
        .where(eq(collections.defaultRatingSystemId, id))
        .limit(1);
      if (inUse || assigned.length)
        throw new RubricError(
          "This rubric is in use. Saved ratings and collection assignments must be preserved.",
          409,
        );
      const systems = await tx
        .select()
        .from(ratingSystems)
        .where(eq(ratingSystems.userId, userId));
      if (systems.length <= 1)
        throw new RubricError("You cannot delete your only rating system");
      if (system.isDefault)
        await tx
          .update(ratingSystems)
          .set({ isDefault: true })
          .where(eq(ratingSystems.id, systems.find((s) => s.id !== id)!.id));
      await tx.delete(ratingSystems).where(eq(ratingSystems.id, id));
      return;
    }
    if (body.categories) {
      for (const cat of body.categories)
        if (cat.id && !cats.some((c) => c.id === cat.id))
          throw new RubricError("Category does not belong to this rubric");
    }
    const categoryChange =
      body.categories &&
      (body.categories.length !== cats.length ||
        body.categories.some((c: any) => {
          const old = cats.find((o) => o.id === c.id);
          return (
            !old ||
            c.name.trim() !== old.name ||
            (c.weight ?? 1) !== old.weight ||
            (c.isRequired !== false) !== old.isRequired
          );
        }));
    if (
      inUse &&
      ((body.scale !== undefined && body.scale !== system.scale) ||
        categoryChange)
    )
      throw new RubricError(
        "Saved ratings use this rubric. Duplicate it to change categories, weights, or scale; historical scores are preserved.",
        409,
      );
    if (body.isDefault)
      await tx
        .update(ratingSystems)
        .set({ isDefault: false })
        .where(eq(ratingSystems.userId, userId));
    await tx
      .update(ratingSystems)
      .set({
        name: body.name?.trim() ?? system.name,
        description:
          body.description === undefined
            ? system.description
            : body.description,
        scale: body.scale ?? system.scale,
        isDefault: body.isDefault ?? system.isDefault,
        updatedAt: new Date(),
      })
      .where(eq(ratingSystems.id, id));
    if (body.categories) {
      const removed = cats.filter(
        (c) => !body.categories.some((n: any) => n.id === c.id),
      );
      if (removed.length)
        await tx.delete(ratingCategories).where(
          inArray(
            ratingCategories.id,
            removed.map((c) => c.id),
          ),
        );
      for (const [index, c] of body.categories.entries()) {
        const values = {
          name: c.name.trim(),
          description: c.description ?? null,
          weight: c.weight ?? 1,
          isRequired: c.isRequired !== false,
          sortOrder: index + 1,
        };
        if (c.id)
          await tx
            .update(ratingCategories)
            .set(values)
            .where(eq(ratingCategories.id, c.id));
        else
          await tx
            .insert(ratingCategories)
            .values({ id: randomUUID(), ratingSystemId: id, ...values });
      }
    }
    return tx.query.ratingSystems.findFirst({
      where: (r, { eq }) => eq(r.id, id),
      with: { categories: { orderBy: (c, { asc }) => [asc(c.sortOrder)] } },
    });
  });
}
