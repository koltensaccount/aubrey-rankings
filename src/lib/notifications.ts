import { db } from "@/db";
import { notifications, notificationPreferences, user } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export type NotificationType =
  | "follow"
  | "like"
  | "comment"
  | "tv_release"
  | "movie_release";

export interface CreateNotificationParams {
  recipientUserId: string;
  actorUserId?: string | null;
  notificationType: NotificationType;
  collectionId?: string | null;
  mediaItemId?: string | null;
  deduplicationKey?: string | null;
  metadata?: Record<string, any> | null;
}

export async function getUserNotificationPreferences(userId: string) {
  const prefs = await db.query.notificationPreferences.findFirst({
    where: (p, { eq }) => eq(p.userId, userId),
  });

  return {
    notifyFollows: prefs ? prefs.notifyFollows : true,
    notifyLikes: prefs ? prefs.notifyLikes : true,
    notifyComments: prefs ? prefs.notifyComments : true,
    notifyTvReleases: prefs ? prefs.notifyTvReleases : true,
    notifyMovieReleases: prefs ? prefs.notifyMovieReleases : true,
  };
}

export async function createNotification({
  recipientUserId,
  actorUserId,
  notificationType,
  collectionId,
  mediaItemId,
  deduplicationKey,
  metadata,
}: CreateNotificationParams) {
  // 1. Never notify a user about their own actions
  if (actorUserId && recipientUserId === actorUserId) {
    return null;
  }

  // 2. Check recipient preferences
  const prefs = await getUserNotificationPreferences(recipientUserId);
  if (notificationType === "follow" && !prefs.notifyFollows) return null;
  if (notificationType === "like" && !prefs.notifyLikes) return null;
  if (notificationType === "comment" && !prefs.notifyComments) return null;
  if (notificationType === "tv_release" && !prefs.notifyTvReleases) return null;
  if (notificationType === "movie_release" && !prefs.notifyMovieReleases) return null;

  // 3. Deduplication check
  if (deduplicationKey) {
    const existing = await db.query.notifications.findFirst({
      where: (n, { eq }) => eq(n.deduplicationKey, deduplicationKey),
    });
    if (existing) {
      return existing;
    }
  }

  // 4. Create notification
  const id = randomUUID();
  try {
    await db.insert(notifications).values({
      id,
      recipientUserId,
      actorUserId: actorUserId || null,
      notificationType,
      collectionId: collectionId || null,
      mediaItemId: mediaItemId || null,
      deduplicationKey: deduplicationKey || null,
      metadata: metadata || null,
      readAt: null,
    });

    const created = await db.query.notifications.findFirst({
      where: (n, { eq }) => eq(n.id, id),
    });
    return created;
  } catch (err: any) {
    // If concurrent insert hit unique constraint on deduplication_key, handle safely
    if (deduplicationKey && err?.code === "23505") {
      return await db.query.notifications.findFirst({
        where: (n, { eq }) => eq(n.deduplicationKey, deduplicationKey),
      });
    }
    console.error("Error creating notification:", err);
    return null;
  }
}
