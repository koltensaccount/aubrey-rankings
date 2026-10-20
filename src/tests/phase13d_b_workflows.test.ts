import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { auth } from "../lib/auth";
import { db } from "../db";
import { collections, likes, mediaItems, notifications, reviews, user } from "../db/schema";
import { GET as getLikes } from "../app/api/social/like/route";
import { GET as getNotifications, PATCH as updateNotifications } from "../app/api/notifications/route";
import { GET as getCompare } from "../app/api/compare/route";
import { GET as searchTmdb } from "../app/api/tmdb/search/route";
import { notificationLinks } from "../lib/notification-links";
import { safeInternalRedirect } from "../lib/safe-navigation";
import { tmdb } from "../lib/tmdb";
import { LikeButton } from "../components/social/like-button";

describe("Phase 13D-B workflow repairs", () => {
  const suffix = `${process.pid}_${Date.now()}`;
  const email = `workflow_${suffix}@example.com`;
  const likerId = `liker_${suffix}`;
  const hiddenId = `hidden_${suffix}`;
  const mediaId = `media_${suffix}`;
  const publicCollectionId = `public_${suffix}`;
  const privateCollectionId = `private_${suffix}`;
  const reviewId = `review_${suffix}`;
  let ownerId = "";
  let cookie = "";
  const originalSearchMulti = tmdb.searchMulti;

  before(async () => {
    const signup = await auth.api.signUpEmail({ body: { email, name: "Workflow Owner", password: "Password123!@#" }, asResponse: true });
    cookie = signup.headers.get("set-cookie") || "";
    const owner = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, email) }); assert.ok(owner); ownerId = owner.id;
    await db.update(user).set({ username: `workflow_${suffix.slice(-8)}` }).where(eq(user.id, ownerId));
    await db.insert(user).values([
      { id: likerId, email: `${likerId}@example.com`, name: "Visible Liker", username: `liker_${suffix.slice(-8)}` },
      { id: hiddenId, email: `${hiddenId}@example.com`, name: "No Handle", username: null },
    ]);
    await db.insert(mediaItems).values({ id: mediaId, mediaType: "movie", title: "Workflow Film" });
    await db.insert(collections).values([
      { id: publicCollectionId, userId: ownerId, title: "Public Ranking", collectionType: "custom", visibility: "public", isPublic: true },
      { id: privateCollectionId, userId: ownerId, title: "Private Ranking", collectionType: "custom", visibility: "private", isPublic: false },
    ]);
    await db.insert(reviews).values({ id: reviewId, userId: ownerId, mediaItemId: mediaId, content: "Review", status: "published", visibility: "public" });
    await db.insert(likes).values([
      { id: randomUUID(), userId: likerId, collectionId: publicCollectionId },
      { id: randomUUID(), userId: hiddenId, collectionId: publicCollectionId },
      { id: randomUUID(), userId: likerId, reviewId },
    ]);
  });

  after(async () => {
    tmdb.searchMulti = originalSearchMulti;
    await db.delete(notifications).where(eq(notifications.recipientUserId, ownerId));
    await db.delete(likes).where(inArray(likes.userId, [likerId, hiddenId]));
    await db.delete(reviews).where(eq(reviews.id, reviewId));
    await db.delete(collections).where(inArray(collections.id, [publicCollectionId, privateCollectionId]));
    await db.delete(mediaItems).where(eq(mediaItems.id, mediaId));
    await db.delete(user).where(inArray(user.id, [ownerId, likerId, hiddenId]));
  });

  it("lists bounded public likers separately from like toggling and hides unavailable accounts", async () => {
    const markup = renderToStaticMarkup(React.createElement(LikeButton, { collectionId: publicCollectionId, initialLikeCount: 2 }));
    assert.match(markup, /aria-label="Like ranking"/);
    assert.match(markup, /aria-label="View 2 people who liked this ranking"/);
    const response = await getLikes(new NextRequest(`http://localhost/api/social/like?collectionId=${publicCollectionId}&list=true&limit=1`));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.likeCount, 2);
    assert.equal(data.users.length, 1);
    assert.equal(data.users[0].id, likerId);
    const review = await getLikes(new NextRequest(`http://localhost/api/social/like?reviewId=${reviewId}&list=true`));
    assert.equal((await review.json()).users[0].id, likerId);
    const denied = await getLikes(new NextRequest(`http://localhost/api/social/like?collectionId=${privateCollectionId}&list=true`));
    assert.equal(denied.status, 404);
  });

  it("returns trusted notification links, comment anchors, and preserves read state updates", async () => {
    const notificationId = `notification_${suffix}`;
    await db.insert(notifications).values({ id: notificationId, recipientUserId: ownerId, actorUserId: likerId, notificationType: "comment", collectionId: publicCollectionId, metadata: { targetUrl: "https://evil.example", commentId: "comment_123" } });
    const response = await getNotifications(new NextRequest("http://localhost/api/notifications", { headers: { cookie } }));
    const item = (await response.json()).notifications.find((entry: { id: string }) => entry.id === notificationId);
    assert.equal(item.links.actorUrl, `/u/liker_${suffix.slice(-8)}`);
    assert.equal(item.links.contentUrl, `/collection/${publicCollectionId}#comment-comment_123`);
    const updated = await updateNotifications(new NextRequest("http://localhost/api/notifications", { method: "PATCH", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ id: notificationId }) }));
    assert.equal(updated.status, 200);
    assert.ok((await db.query.notifications.findFirst({ where: eq(notifications.id, notificationId) }))?.readAt);
  });

  it("constructs only safe notification and login destinations", () => {
    assert.equal(notificationLinks({ notificationType: "review", reviewId, metadata: { targetUrl: "https://evil.example", commentId: "bad/value" } }).contentUrl, `/review/${reviewId}`);
    assert.equal(safeInternalRedirect("/notifications?filter=unread#item"), "/notifications?filter=unread#item");
    assert.equal(safeInternalRedirect("//evil.example"), "/");
    assert.equal(safeInternalRedirect("https://evil.example"), "/");
  });

  it("uses actual accessible rankings for Compare", async () => {
    const response = await getCompare(new NextRequest("http://localhost/api/compare?available=true"));
    const ids = (await response.json()).rankings.map((ranking: { id: string }) => ranking.id);
    assert.ok(ids.includes(publicCollectionId));
    assert.ok(!ids.includes(privateCollectionId));
    const direct = await getCompare(new NextRequest(`http://localhost/api/compare?left=${publicCollectionId}&right=${publicCollectionId}`));
    assert.equal(direct.status, 200);
  });

  it("supports bounded guest TMDB search with explicit validation and service errors", async () => {
    tmdb.searchMulti = async () => ({ results: [{ id: 1, title: "Result" }] } as never);
    const success = await searchTmdb(new NextRequest("http://localhost/api/tmdb/search?q=result&type=all"));
    assert.equal(success.status, 200); assert.equal((await success.json()).results[0].title, "Result");
    assert.equal((await searchTmdb(new NextRequest("http://localhost/api/tmdb/search?q=x&type=all"))).status, 400);
    assert.equal((await searchTmdb(new NextRequest("http://localhost/api/tmdb/search?q=result&type=unknown"))).status, 400);
    tmdb.searchMulti = async () => { throw new Error("TMDB unavailable"); };
    const unavailable = await searchTmdb(new NextRequest("http://localhost/api/tmdb/search?q=different&type=all"));
    assert.equal(unavailable.status, 503);
    tmdb.searchMulti = async () => ({ results: [] } as never);
    for (let index = 0; index < 16; index++) await searchTmdb(new NextRequest(`http://localhost/api/tmdb/search?q=query${index}&type=all`));
    assert.equal((await searchTmdb(new NextRequest("http://localhost/api/tmdb/search?q=limited&type=all"))).status, 429);
  });
});
