import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db";
import {
  user,
  collections,
  follows,
  likes,
  comments,
  notifications,
  notificationPreferences,
  releaseTrackingSubscriptions,
  processedReleaseEvents,
} from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getFollowersList, getFollowingList } from "../lib/social-queries";
import {
  createNotification,
  getUserNotificationPreferences,
} from "../lib/notifications";
import {
  getCollectionTrackingStatus,
  setCollectionTracking,
  checkNewReleases,
} from "../lib/release-tracker";
import { tmdb } from "../lib/tmdb";

describe("Stage 8: Social Notifications, Connections & Release Tracking", () => {
  const userA = `user_notif_a_${Date.now()}`;
  const userB = `user_notif_b_${Date.now()}`;
  const userC = `user_notif_c_${Date.now()}`;
  const tvCollectionId = `col_notif_tv_${Date.now()}`;
  const movieCollectionId = `col_notif_mov_${Date.now()}`;

  before(async () => {
    // 1. Create test users
    await db.insert(user).values([
      {
        id: userA,
        name: "Alex Curator",
        username: `alex_${Date.now().toString().slice(-6)}`,
        email: `${userA}@example.com`,
      },
      {
        id: userB,
        name: "Bailey Director",
        username: `bailey_${Date.now().toString().slice(-6)}`,
        email: `${userB}@example.com`,
      },
      {
        id: userC,
        name: "Anonymous User",
        username: null, // Test user without username chosen yet
        email: `${userC}@example.com`,
      },
    ]);

    // 2. Create test collections
    await db.insert(collections).values([
      {
        id: tvCollectionId,
        userId: userB,
        title: "Severance Ranking",
        collectionType: "tv_show",
        tmdbId: 95557, // Severance TMDB ID
        visibility: "public",
        isPublic: true,
      },
      {
        id: movieCollectionId,
        userId: userB,
        title: "Dune Franchise",
        collectionType: "movie_franchise",
        tmdbId: 726871, // Dune Collection TMDB ID
        visibility: "public",
        isPublic: true,
      },
    ]);
  });

  after(async () => {
    // Cleanup in order
    await db.delete(notifications).where(
      sql`${notifications.recipientUserId} IN (${userA}, ${userB}, ${userC})`
    );
    await db.delete(notificationPreferences).where(
      sql`${notificationPreferences.userId} IN (${userA}, ${userB}, ${userC})`
    );
    await db.delete(releaseTrackingSubscriptions).where(
      sql`${releaseTrackingSubscriptions.userId} IN (${userA}, ${userB}, ${userC})`
    );
    await db.delete(comments).where(eq(comments.collectionId, tvCollectionId));
    await db.delete(likes).where(eq(likes.collectionId, tvCollectionId));
    await db.delete(follows).where(
      sql`${follows.followerId} IN (${userA}, ${userB}, ${userC})`
    );
    await db.delete(collections).where(eq(collections.id, tvCollectionId));
    await db.delete(collections).where(eq(collections.id, movieCollectionId));
    await db.delete(user).where(
      sql`${user.id} IN (${userA}, ${userB}, ${userC})`
    );
  });

  it("1. Follower & Following Lists: returns correct accounts, follow states, and handles null handles safely", async () => {
    // User A follows User B
    await db.insert(follows).values({
      id: randomUUID(),
      followerId: userA,
      followingId: userB,
    });

    // User C follows User B
    await db.insert(follows).values({
      id: randomUUID(),
      followerId: userC,
      followingId: userB,
    });

    // B's followers viewed by A
    const bFollowers = await getFollowersList(userB, userA);
    assert.equal(bFollowers.total, 2);

    const aInBFollowers = bFollowers.users.find((u) => u.id === userA);
    assert.ok(aInBFollowers);
    assert.equal(aInBFollowers.isSelf, true);
    assert.ok(aInBFollowers.username);

    const cInBFollowers = bFollowers.users.find((u) => u.id === userC);
    assert.ok(cInBFollowers);
    assert.equal(cInBFollowers.isSelf, false);
    assert.equal(cInBFollowers.username, null, "User without username must have null username");

    // A's following viewed by A
    const aFollowing = await getFollowingList(userA, userA);
    assert.equal(aFollowing.total, 1);
    assert.equal(aFollowing.users[0].id, userB);
    assert.equal(aFollowing.users[0].isFollowing, true);
  });

  it("2. Notifications Engine: creates follow, like, comment notifications with deduplication", async () => {
    // A follows B -> Notification for B
    const notif1 = await createNotification({
      recipientUserId: userB,
      actorUserId: userA,
      notificationType: "follow",
      deduplicationKey: `follow:${userA}:${userB}`,
      metadata: { actorName: "Alex Curator", message: "Alex started following you." },
    });

    assert.ok(notif1, "Notification 1 should be created");
    assert.equal(notif1.recipientUserId, userB);
    assert.equal(notif1.notificationType, "follow");

    // Duplicate follow attempt returns existing notification without creating another row
    const dupNotif = await createNotification({
      recipientUserId: userB,
      actorUserId: userA,
      notificationType: "follow",
      deduplicationKey: `follow:${userA}:${userB}`,
      metadata: { actorName: "Alex Curator", message: "Alex started following you." },
    });
    assert.equal(dupNotif?.id, notif1.id, "Deduplication must return existing record");

    // A likes B's ranking -> Notification for B
    const likeNotif = await createNotification({
      recipientUserId: userB,
      actorUserId: userA,
      notificationType: "like",
      collectionId: tvCollectionId,
      deduplicationKey: `like:${tvCollectionId}:${userA}`,
      metadata: { message: "Alex liked your ranking." },
    });
    assert.ok(likeNotif);
    assert.equal(likeNotif.recipientUserId, userB);

    // Self-notification is automatically rejected
    const selfNotif = await createNotification({
      recipientUserId: userA,
      actorUserId: userA,
      notificationType: "like",
      collectionId: tvCollectionId,
    });
    assert.equal(selfNotif, null, "Self-notification must be rejected");
  });

  it("3. User Notification Preferences: respects opted-out categories", async () => {
    // User A disables ranking likes notifications
    await db.insert(notificationPreferences).values({
      userId: userA,
      notifyFollows: true,
      notifyLikes: false,
      notifyComments: true,
      notifyTvReleases: true,
      notifyMovieReleases: true,
    });

    // B tries to like A's ranking -> Notification should be skipped
    const likeNotif = await createNotification({
      recipientUserId: userA,
      actorUserId: userB,
      notificationType: "like",
      collectionId: tvCollectionId,
      metadata: { message: "Bailey liked your ranking." },
    });
    assert.equal(likeNotif, null, "Disabled category must not create notification");

    // B follows A -> Allowed because notifyFollows is true
    const followNotif = await createNotification({
      recipientUserId: userA,
      actorUserId: userB,
      notificationType: "follow",
      deduplicationKey: `follow:${userB}:${userA}`,
      metadata: { message: "Bailey started following you." },
    });
    assert.ok(followNotif, "Allowed category creates notification");
  });

  it("4. Read State & Unread Counts: marks single and all notifications read", async () => {
    // B currently has follow and like notifications
    const bNotifs = await db.query.notifications.findMany({
      where: (n, { and, eq, isNull }) =>
        and(eq(n.recipientUserId, userB), isNull(n.readAt)),
    });
    assert.ok(bNotifs.length >= 2, "B should have unread notifications");

    // Mark single notification read
    const singleId = bNotifs[0].id;
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, singleId), eq(notifications.recipientUserId, userB)));

    const afterSingle = await db.query.notifications.findFirst({
      where: (n, { eq }) => eq(n.id, singleId),
    });
    assert.ok(afterSingle?.readAt, "Single notification readAt must be set");

    // Mark all read for B
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.recipientUserId, userB), sql`${notifications.readAt} IS NULL`)
      );

    const remainingUnread = await db.query.notifications.findMany({
      where: (n, { and, eq, isNull }) =>
        and(eq(n.recipientUserId, userB), isNull(n.readAt)),
    });
    assert.equal(remainingUnread.length, 0, "No unread notifications should remain for B");
  });

  it("5. Release Tracking Subscriptions & Baseline: detects trackability and establishes safe baseline", async () => {
    // TV show ranking
    const tvStatus = await getCollectionTrackingStatus(tvCollectionId, userB);
    assert.equal(tvStatus.supported, true);
    assert.equal(tvStatus.tmdbType, "tv");
    assert.equal(tvStatus.tmdbId, 95557);

    // Movie franchise ranking
    const movieStatus = await getCollectionTrackingStatus(movieCollectionId, userB);
    assert.equal(movieStatus.supported, true);
    assert.equal(movieStatus.tmdbType, "movie_collection");
    assert.equal(movieStatus.tmdbId, 726871);

    // Enable tracking for TV show
    const enrolled = await setCollectionTracking(tvCollectionId, userB, true);
    assert.equal(enrolled.enabled, true);

    const sub = await db.query.releaseTrackingSubscriptions.findFirst({
      where: (s, { and, eq }) =>
        and(eq(s.userId, userB), eq(s.collectionId, tvCollectionId)),
    });
    assert.ok(sub);
    assert.ok(sub.baselineDate);
    assert.equal(sub.enabled, true);

    // Disable tracking
    const disabled = await setCollectionTracking(tvCollectionId, userB, false);
    assert.equal(disabled.enabled, false);

    const updatedSub = await db.query.releaseTrackingSubscriptions.findFirst({
      where: (s, { and, eq }) =>
        and(eq(s.userId, userB), eq(s.collectionId, tvCollectionId)),
    });
    assert.equal(updatedSub?.enabled, false);
  });

  it("6. Scheduled Release Checking: idempotent execution without duplicate alerts", async () => {
    // Re-enable tracking for TV show
    await setCollectionTracking(tvCollectionId, userB, true);

    // Run check
    const run1 = await checkNewReleases();
    assert.equal(run1.success, true);

    // Run check again immediately -> 0 duplicate notifications created
    const run2 = await checkNewReleases();
    assert.equal(run2.success, true);
    assert.equal(run2.notificationsCreated, 0, "Second run must be idempotent with 0 new notifications");
  });

  it("7. TMDB Release Detection Flow: processes new episodes and franchise movies correctly without duplicates", async () => {
    const originalGetTvDetails = tmdb.getTvDetails;
    const originalGetTvSeason = tmdb.getTvSeason;

    const mockTvId = 80000 + (Date.now() % 10000);
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    const subId = randomUUID();
    await db.insert(releaseTrackingSubscriptions).values({
      id: subId,
      userId: userA,
      collectionId: tvCollectionId,
      tmdbType: "tv",
      tmdbId: mockTvId,
      enabled: true,
      baselineDate: yesterday,
    });

    (tmdb as any).getTvDetails = async (id: number) => {
      if (id === mockTvId) {
        return {
          id: mockTvId,
          name: "Mock Sci-Fi Show",
          number_of_seasons: 2,
          seasons: [{ season_number: 2, air_date: today }],
        };
      }
      return originalGetTvDetails(id);
    };

    (tmdb as any).getTvSeason = async (id: number, sNum: number) => {
      if (id === mockTvId) {
        return {
          id: 12345,
          name: "Season 2",
          season_number: 2,
          episodes: [
            {
              id: 555,
              season_number: 2,
              episode_number: 1,
              name: "The Awakening",
              air_date: today,
              still_path: "/still.jpg",
            },
          ],
        };
      }
      return originalGetTvSeason(id, sNum);
    };

    try {
      const result = await checkNewReleases();
      assert.ok(result.notificationsCreated >= 1, "Should create notification for newly aired episode");

      const notif = await db.query.notifications.findFirst({
        where: (n, { and, eq }) =>
          and(eq(n.recipientUserId, userA), eq(n.notificationType, "tv_release")),
      });
      assert.ok(notif, "Notification record should exist");
      assert.equal(notif.notificationType, "tv_release");
      assert.match((notif.metadata as any).message, /The Awakening/);

      // Second check must be completely idempotent
      const secondRun = await checkNewReleases();
      assert.equal(secondRun.notificationsCreated, 0, "Idempotent run must produce 0 duplicate alerts");
    } finally {
      tmdb.getTvDetails = originalGetTvDetails;
      tmdb.getTvSeason = originalGetTvSeason;
      await db.delete(processedReleaseEvents).where(eq(processedReleaseEvents.tmdbId, mockTvId));
      await db.delete(releaseTrackingSubscriptions).where(eq(releaseTrackingSubscriptions.id, subId));
    }
  });
});
