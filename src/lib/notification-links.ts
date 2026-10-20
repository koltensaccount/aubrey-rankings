type NotificationLinkInput = {
  notificationType: string;
  collectionId?: string | null;
  reviewId?: string | null;
  mediaItemId?: string | null;
  actor?: { username?: string | null } | null;
  metadata?: unknown;
};

function commentAnchor(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const id = (metadata as Record<string, unknown>).commentId;
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(id) ? `#comment-${id}` : "";
}

/** Build destinations exclusively from trusted persisted identifiers. */
export function notificationLinks(item: NotificationLinkInput) {
  const actorUrl = item.actor?.username ? `/u/${encodeURIComponent(item.actor.username)}` : null;
  let contentUrl: string | null = null;
  if (item.reviewId) contentUrl = `/review/${encodeURIComponent(item.reviewId)}${commentAnchor(item.metadata)}`;
  else if (item.collectionId) contentUrl = `/collection/${encodeURIComponent(item.collectionId)}${commentAnchor(item.metadata)}`;
  else if (item.mediaItemId) contentUrl = `/media/${encodeURIComponent(item.mediaItemId)}`;
  else if (item.notificationType === "follow") contentUrl = actorUrl;
  return { actorUrl, contentUrl: contentUrl ?? "/notifications" };
}
