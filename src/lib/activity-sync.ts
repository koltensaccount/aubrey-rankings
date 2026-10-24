import { db } from "@/db";
import { activityEvents, diaryEntries, reviews, ratings } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export type ActivityDatabase = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Update only a viewing event: review events can reference the same viewing. */
export async function syncViewingActivity(entry: typeof diaryEntries.$inferSelect, tx: ActivityDatabase = db) {
  const existing = await tx.query.activityEvents.findFirst({ where: and(eq(activityEvents.userId, entry.userId), eq(activityEvents.diaryEntryId, entry.id), eq(activityEvents.eventType, "viewing")) });
  const values = { eventDate: entry.watchedDate, ratingValue: entry.ratingValue, sourceRating: entry.sourceRating, sourceScale: entry.sourceScale, isRewatch: entry.isRewatch, reviewId: entry.reviewId, notes: entry.notes, updatedAt: entry.updatedAt };
  if (existing) await tx.update(activityEvents).set(values).where(eq(activityEvents.id, existing.id));
  else await tx.insert(activityEvents).values({ ...values, id: `act_${randomUUID()}`, userId: entry.userId, mediaItemId: entry.mediaItemId, eventType: "viewing", diaryEntryId: entry.id, sourceEventKey: entry.sourceEventKey || `diary:${entry.id}`, createdAt: entry.createdAt }).onConflictDoNothing();
}

export async function syncReviewActivity(review: typeof reviews.$inferSelect, tx: ActivityDatabase = db) {
  const where = and(eq(activityEvents.userId, review.userId), eq(activityEvents.reviewId, review.id), eq(activityEvents.eventType, "review"));
  if (review.status !== "published") { await tx.delete(activityEvents).where(where); return; }
  const eventDate = review.sourceService === "letterboxd" ? review.sourceReviewDate : review.publishedAt?.toISOString().slice(0, 10) ?? null;
  const values = { eventDate, diaryEntryId: review.viewingId, ratingValue: review.ratingValue, sourceRating: review.sourceRating, sourceScale: review.sourceScale, updatedAt: review.updatedAt };
  const existing = await tx.query.activityEvents.findFirst({ where });
  if (existing) await tx.update(activityEvents).set(values).where(eq(activityEvents.id, existing.id));
  else await tx.insert(activityEvents).values({ ...values, id: `act_${randomUUID()}`, userId: review.userId, mediaItemId: review.mediaItemId, eventType: "review", reviewId: review.id, sourceEventKey: `rev:${review.id}`, createdAt: review.createdAt }).onConflictDoNothing();
}

export async function syncStandaloneRatingActivity(rating: typeof ratings.$inferSelect, tx: ActivityDatabase = db) {
  if (rating.collectionId || rating.sourceService) return;
  const hasScore = rating.calculatedOverallScore !== null || rating.tierId !== null;
  const key = `rating:${rating.id}`;
  const values = { eventType: hasScore ? "rating" : "watched_mark", eventDate: hasScore ? rating.updatedAt.toISOString().slice(0, 10) : null, ratingValue: rating.calculatedOverallScore, updatedAt: rating.updatedAt };
  if (!hasScore && !rating.isWatched) { await tx.delete(activityEvents).where(eq(activityEvents.sourceEventKey, key)); return; }
  await tx.insert(activityEvents).values({ ...values, id: `act_${randomUUID()}`, userId: rating.userId, mediaItemId: rating.mediaItemId, ratingId: rating.id, sourceEventKey: key }).onConflictDoUpdate({ target: [activityEvents.userId, activityEvents.sourceEventKey], targetWhere: eq(activityEvents.sourceEventKey, key), set: values });
}
