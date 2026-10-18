import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db";
import {
  user,
  session as sessionTable,
  collections,
  collectionEntries,
  mediaItems,
  ratings,
  comments,
  follows,
  contentReports,
  userBlocks,
  notifications,
} from "../db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { auth } from "../lib/auth";

// API Handlers under test
import { GET as getCollectionDetail } from "../app/api/collections/[id]/route";
import { GET as getMediaReviews } from "../app/api/media/[id]/reviews/route";
import { POST as postReport } from "../app/api/reports/route";
import { GET as getNotifications } from "../app/api/notifications/route";
import { GET as searchUsers } from "../app/api/user/search/route";
import { getPublicReviews } from "../lib/public-reviews";

describe("Phase 7: Post-Phase-6 Stabilization and Acceptance Repair", () => {
  const timestamp = Date.now();
  const curatorEmail = `p7_curator_${timestamp}@example.com`;
  const visitorEmail = `p7_visitor_${timestamp}@example.com`;

  let curator: { id: string; cookie: string; username: string };
  let visitor: { id: string; cookie: string; username: string };

  let publicColId = `col_p7_pub_${timestamp}`;
  let privateColId = `col_p7_priv_${timestamp}`;

  let movieCollisionId = `media_p7_mov_${timestamp}`;
  let tvCollisionId = `media_p7_tv_${timestamp}`;
  let bareMediaId = `media_p7_bare_${timestamp}`;
  let collectionlessMediaId = `media_p7_colless_${timestamp}`;
  const COLLISION_TMDB_ID = 888123;

  let publicCommentId = `cmt_p7_pub_${timestamp}`;
  let privateCommentId = `cmt_p7_priv_${timestamp}`;

  let publicRatingId = `rat_p7_pub_${timestamp}`;
  let privateRatingId = `rat_p7_priv_${timestamp}`;
  let bareRatingId = `rat_p7_bare_${timestamp}`;
  let collectionlessRatingId = `rat_p7_colless_${timestamp}`;

  async function createAuthUser(email: string, name: string, username: string) {
    const res = await auth.api.signUpEmail({
      body: {
        email,
        password: "Password123!@#",
        name,
      },
      asResponse: true,
    });
    assert.equal(res.status, 200, `Sign up for ${email} must succeed`);
    const cookie = res.headers.get("set-cookie") || "";

    const userRecord = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });
    assert(userRecord, `User record for ${email} must exist in DB`);

    await db
      .update(user)
      .set({ username, emailVerified: true })
      .where(eq(user.id, userRecord.id));

    return { id: userRecord.id, cookie, username };
  }

  function makeRequest(
    url: string,
    method: string,
    cookie?: string,
    body?: any
  ): NextRequest {
    const headers = new Headers();
    if (cookie) {
      headers.set("cookie", cookie);
    }
    if (body) {
      headers.set("content-type", "application/json");
    }

    const init: RequestInit = {
      method,
      headers,
    };
    if (body) {
      init.body = JSON.stringify(body);
    }

    return new NextRequest(new URL(url, "http://localhost:3000"), init as any);
  }

  before(async () => {
    // 1. Create Curator and Visitor test accounts
    curator = await createAuthUser(curatorEmail, "Curator Carol", `carol_${timestamp.toString().slice(-6)}`);
    visitor = await createAuthUser(visitorEmail, "Visitor Dave", `dave_${timestamp.toString().slice(-6)}`);

    // 2. Insert Media Items
    await db.insert(mediaItems).values([
      {
        id: movieCollisionId,
        tmdbId: COLLISION_TMDB_ID,
        mediaType: "movie",
        title: "Collision The Movie",
        overview: "A movie about numeric ID collisions.",
        releaseDate: "2024-01-01",
      },
      {
        id: tvCollisionId,
        tmdbId: COLLISION_TMDB_ID,
        mediaType: "tv",
        title: "Collision The TV Series",
        overview: "A series about numeric ID collisions.",
        releaseDate: "2024-02-01",
      },
      {
        id: bareMediaId,
        tmdbId: 888124,
        mediaType: "movie",
        title: "Bare Rating Movie",
        overview: "A movie with no review text.",
        releaseDate: "2024-03-01",
      },
      {
        id: collectionlessMediaId,
        tmdbId: 888125,
        mediaType: "movie",
        title: "Collectionless Movie",
        overview: "A personal rated movie.",
        releaseDate: "2024-04-01",
      },
    ]);

    // 3. Create Public Collection owned by Curator
    await db.insert(collections).values({
      id: publicColId,
      userId: curator.id,
      title: "Carol's Public Masterpieces",
      collectionType: "custom",
      visibility: "public",
      isPublic: true,
      allowComments: true,
    });

    // 4. Create Private Collection owned by Curator
    await db.insert(collections).values({
      id: privateColId,
      userId: curator.id,
      title: "Carol's Secret Drafts",
      collectionType: "custom",
      visibility: "private",
      isPublic: false,
      allowComments: true,
    });

    // 5. Add entries to collections
    await db.insert(collectionEntries).values([
      {
        id: `entry_pub_${timestamp}`,
        collectionId: publicColId,
        mediaItemId: movieCollisionId,
        sortOrder: 1,
      },
      {
        id: `entry_priv_${timestamp}`,
        collectionId: privateColId,
        mediaItemId: tvCollisionId,
        sortOrder: 1,
      },
    ]);

    // 6. Create comments on both collections
    await db.insert(comments).values([
      {
        id: publicCommentId,
        userId: curator.id,
        collectionId: publicColId,
        content: "This is a public comment.",
      },
      {
        id: privateCommentId,
        userId: curator.id,
        collectionId: privateColId,
        content: "This is a private comment.",
      },
    ]);

    // 7. Create ratings:
    // a. Public review with reviewText and personalNotes
    await db.insert(ratings).values({
      id: publicRatingId,
      userId: curator.id,
      mediaItemId: movieCollisionId,
      collectionId: publicColId,
      reviewText: "Phenomenal cinematic storytelling.",
      personalNotes: "Top secret curator notes: watched with pop-corn.",
      sourceRating: 9.5,
    });

    // b. Private review in private collection
    await db.insert(ratings).values({
      id: privateRatingId,
      userId: curator.id,
      mediaItemId: tvCollisionId,
      collectionId: privateColId,
      reviewText: "Confidential review of private pilot episode.",
      personalNotes: "Personal draft notes.",
      sourceRating: 7.0,
    });

    // c. Bare rating without reviewText
    await db.insert(ratings).values({
      id: bareRatingId,
      userId: curator.id,
      mediaItemId: bareMediaId,
      collectionId: publicColId,
      reviewText: null,
      personalNotes: null,
      sourceRating: 8.0,
    });

    // d. Collectionless rating (personal rating outside of any collection)
    await db.insert(ratings).values({
      id: collectionlessRatingId,
      userId: curator.id,
      mediaItemId: collectionlessMediaId,
      collectionId: null,
      reviewText: "Personal unassigned rating review text.",
      personalNotes: "Personal unassigned notes.",
      sourceRating: 8.5,
    });
  });

  after(async () => {
    // Cleanup created test records
    await db.delete(contentReports).where(eq(contentReports.reporterId, visitor.id));
    await db.delete(userBlocks).where(or(eq(userBlocks.blockerId, curator.id), eq(userBlocks.blockerId, visitor.id)));
    await db.delete(follows).where(or(eq(follows.followerId, curator.id), eq(follows.followerId, visitor.id)));
    await db.delete(notifications).where(or(eq(notifications.recipientUserId, curator.id), eq(notifications.recipientUserId, visitor.id)));
    await db.delete(comments).where(or(eq(comments.id, publicCommentId), eq(comments.id, privateCommentId)));
    await db.delete(ratings).where(inArray(ratings.id, [publicRatingId, privateRatingId, bareRatingId, collectionlessRatingId]));
    await db.delete(collectionEntries).where(inArray(collectionEntries.collectionId, [publicColId, privateColId]));
    await db.delete(collections).where(inArray(collections.id, [publicColId, privateColId]));
    await db.delete(mediaItems).where(inArray(mediaItems.id, [movieCollisionId, tvCollisionId, bareMediaId, collectionlessMediaId]));
    await db.delete(sessionTable).where(or(eq(sessionTable.userId, curator.id), eq(sessionTable.userId, visitor.id)));
    await db.delete(user).where(or(eq(user.id, curator.id), eq(user.id, visitor.id)));
  });

  // ==========================================
  // REFINEMENT 1: TMDB MEDIA RESOLUTION & ID COLLISION
  // ==========================================
  it("1. TMDB Media Resolution: disambiguates overlapping movie and tv numeric TMDB IDs", async () => {
    // Disambiguate with ?type=movie
    const movieReq = makeRequest(
      `http://localhost:3000/api/media/${COLLISION_TMDB_ID}/reviews?type=movie`,
      "GET"
    );
    const movieRes = await getMediaReviews(movieReq, { params: Promise.resolve({ id: String(COLLISION_TMDB_ID) }) });
    assert.equal(movieRes.status, 200);
    const movieData = await movieRes.json();
    assert.equal(movieData.mediaItem.mediaType, "movie");
    assert.equal(movieData.mediaItem.title, "Collision The Movie");

    // Disambiguate with ?type=tv
    const tvReq = makeRequest(
      `http://localhost:3000/api/media/${COLLISION_TMDB_ID}/reviews?type=tv`,
      "GET"
    );
    const tvRes = await getMediaReviews(tvReq, { params: Promise.resolve({ id: String(COLLISION_TMDB_ID) }) });
    assert.equal(tvRes.status, 200);
    const tvData = await tvRes.json();
    assert.equal(tvData.mediaItem.mediaType, "tv");
    assert.equal(tvData.mediaItem.title, "Collision The TV Series");
  });

  it("1b. TMDB Media Resolution: unpersisted TMDB lookup does not create database records", async () => {
    const unpersistedTmdbId = 99999999;
    const initialCountRes = await db
      .select({ count: db.$count(mediaItems) })
      .from(mediaItems);
    const initialCount = Number(initialCountRes[0]?.count || 0);

    // Request non-existent / external TMDB id
    const req = makeRequest(
      `http://localhost:3000/api/media/${unpersistedTmdbId}/reviews?type=movie`,
      "GET"
    );
    const res = await getMediaReviews(req, { params: Promise.resolve({ id: String(unpersistedTmdbId) }) });
    // Handled gracefully (either 404 or in-memory view, but NEVER inserting into DB)
    const afterCountRes = await db
      .select({ count: db.$count(mediaItems) })
      .from(mediaItems);
    const afterCount = Number(afterCountRes[0]?.count || 0);

    assert.equal(afterCount, initialCount, "Visiting a media page must not insert new records into media_items");
  });

  // ==========================================
  // REFINEMENT 2: REPORTING AUTHORIZATION & SHARED VISIBILITY
  // ==========================================
  it("2a. Reporting: allows reporting accessible public rankings and comments", async () => {
    // Report public ranking
    const reqRanking = makeRequest("http://localhost:3000/api/reports", "POST", visitor.cookie, {
      targetType: "ranking",
      targetId: publicColId,
      reason: "inappropriate",
      details: "Report on public ranking.",
    });
    const resRanking = await postReport(reqRanking);
    assert.equal(resRanking.status, 200);
    const dataRanking = await resRanking.json();
    assert.equal(dataRanking.success, true);

    // Report public comment
    const reqComment = makeRequest("http://localhost:3000/api/reports", "POST", visitor.cookie, {
      targetType: "comment",
      targetId: publicCommentId,
      reason: "spam",
      details: "Report on public comment.",
    });
    const resComment = await postReport(reqComment);
    assert.equal(resComment.status, 200);
    const dataComment = await resComment.json();
    assert.equal(dataComment.success, true);
  });

  it("2b. Reporting: returns indistinguishable 404 for inaccessible private rankings, comments, and reviews", async () => {
    // Attempt to report private ranking as non-owner
    const reqPrivateRanking = makeRequest("http://localhost:3000/api/reports", "POST", visitor.cookie, {
      targetType: "ranking",
      targetId: privateColId,
      reason: "harassment",
    });
    const resPrivateRanking = await postReport(reqPrivateRanking);
    assert.equal(resPrivateRanking.status, 404);
    const dataPrivateRanking = await resPrivateRanking.json();
    assert.equal(dataPrivateRanking.error, "Reported content or user does not exist");

    // Attempt to report private comment as non-owner
    const reqPrivateComment = makeRequest("http://localhost:3000/api/reports", "POST", visitor.cookie, {
      targetType: "comment",
      targetId: privateCommentId,
      reason: "harassment",
    });
    const resPrivateComment = await postReport(reqPrivateComment);
    assert.equal(resPrivateComment.status, 404);
    const dataPrivateComment = await resPrivateComment.json();
    assert.equal(dataPrivateComment.error, "Reported content or user does not exist");

    // Attempt to report private review as non-owner
    const reqPrivateReview = makeRequest("http://localhost:3000/api/reports", "POST", visitor.cookie, {
      targetType: "review",
      targetId: privateRatingId,
      reason: "harassment",
    });
    const resPrivateReview = await postReport(reqPrivateReview);
    assert.equal(resPrivateReview.status, 404);
    const dataPrivateReview = await resPrivateReview.json();
    assert.equal(dataPrivateReview.error, "Reported content or user does not exist");

    // Attempt to report rating with NO reviewText (bare rating)
    const reqBareRating = makeRequest("http://localhost:3000/api/reports", "POST", visitor.cookie, {
      targetType: "review",
      targetId: bareRatingId,
      reason: "harassment",
    });
    const resBareRating = await postReport(reqBareRating);
    assert.equal(resBareRating.status, 404);
    const dataBareRating = await resBareRating.json();
    assert.equal(dataBareRating.error, "Reported content or user does not exist");

    // Attempt to report completely non-existent id
    const reqNonExistent = makeRequest("http://localhost:3000/api/reports", "POST", visitor.cookie, {
      targetType: "review",
      targetId: "fake_nonexistent_rating_id",
      reason: "harassment",
    });
    const resNonExistent = await postReport(reqNonExistent);
    assert.equal(resNonExistent.status, 404);
    const dataNonExistent = await resNonExistent.json();
    assert.equal(dataNonExistent.error, "Reported content or user does not exist");
  });

  it("2c. Reporting: allows reporting accessible public content from blocked users", async () => {
    // Curator blocks Visitor
    await db.insert(userBlocks).values({
      id: `block_${timestamp}_1`,
      blockerId: curator.id,
      blockedId: visitor.id,
    });

    // Visitor reports Curator's public review
    const reqPublicReview = makeRequest("http://localhost:3000/api/reports", "POST", visitor.cookie, {
      targetType: "review",
      targetId: publicRatingId,
      reason: "inappropriate",
      details: "Reported public review from blocked user.",
    });
    const resPublicReview = await postReport(reqPublicReview);
    assert.equal(resPublicReview.status, 200, "Should be allowed to report accessible public review even if blocked");
    const data = await resPublicReview.json();
    assert.equal(data.success, true);

    // Clean up block for subsequent tests
    await db.delete(userBlocks).where(eq(userBlocks.id, `block_${timestamp}_1`));
  });

  // ==========================================
  // REFINEMENT 3: BLOCKING CONSISTENCY
  // ==========================================
  it("3a. Blocking Consistency: filters blocked authors from public media reviews", async () => {
    // Verify review is initially visible to visitor
    const req1 = makeRequest(
      `http://localhost:3000/api/media/${COLLISION_TMDB_ID}/reviews?type=movie`,
      "GET",
      visitor.cookie
    );
    const res1 = await getMediaReviews(req1, { params: Promise.resolve({ id: String(COLLISION_TMDB_ID) }) });
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    const reviewFound1 = data1.reviews.some((r: any) => r.id === publicRatingId);
    assert.equal(reviewFound1, true, "Review should be visible prior to block");

    // Establish block: Visitor blocks Curator
    await db.insert(userBlocks).values({
      id: `block_${timestamp}_2`,
      blockerId: visitor.id,
      blockedId: curator.id,
    });

    try {
      // Verify review is now filtered out for visitor
      const req2 = makeRequest(
        `http://localhost:3000/api/media/${COLLISION_TMDB_ID}/reviews?type=movie`,
        "GET",
        visitor.cookie
      );
      const res2 = await getMediaReviews(req2, { params: Promise.resolve({ id: String(COLLISION_TMDB_ID) }) });
      assert.equal(res2.status, 200);
      const data2 = await res2.json();
      const reviewFound2 = data2.reviews.some((r: any) => r.id === publicRatingId);
      assert.equal(reviewFound2, false, "Review from blocked curator must be excluded");
    } finally {
      // Clean up block
      await db.delete(userBlocks).where(eq(userBlocks.id, `block_${timestamp}_2`));
    }
  });

  it("3b. Blocking Consistency: filters blocked users from notifications and unread count", async () => {
    // Create an unread notification from Curator to Visitor
    const notifId = `notif_p7_${timestamp}`;
    await db.insert(notifications).values({
      id: notifId,
      recipientUserId: visitor.id,
      actorUserId: curator.id,
      notificationType: "comment",
      collectionId: publicColId,
      readAt: null,
    });

    try {
      // Check notifications list and unread count before block
      const reqBefore = makeRequest("http://localhost:3000/api/notifications", "GET", visitor.cookie);
      const resBefore = await getNotifications(reqBefore);
      assert.equal(resBefore.status, 200);
      const dataBefore = await resBefore.json();
      const foundBefore = dataBefore.notifications.some((n: any) => n.id === notifId);
      assert.equal(foundBefore, true);
      assert(dataBefore.unreadCount >= 1);

      // Curator blocks Visitor
      await db.insert(userBlocks).values({
        id: `block_${timestamp}_3`,
        blockerId: curator.id,
        blockedId: visitor.id,
      });

      try {
        // Check notifications list and unread count after block
        const reqAfter = makeRequest("http://localhost:3000/api/notifications", "GET", visitor.cookie);
        const resAfter = await getNotifications(reqAfter);
        assert.equal(resAfter.status, 200);
        const dataAfter = await resAfter.json();
        const foundAfter = dataAfter.notifications.some((n: any) => n.id === notifId);
        assert.equal(foundAfter, false, "Notification from blocked user must be excluded from list");
        // Verify count did not include the blocked notification
        assert.equal(dataAfter.unreadCount, dataBefore.unreadCount - 1);
      } finally {
        await db.delete(userBlocks).where(eq(userBlocks.id, `block_${timestamp}_3`));
      }
    } finally {
      await db.delete(notifications).where(eq(notifications.id, notifId));
    }
  });

  it("3c. Blocking Consistency: filters blocked users from user search", async () => {
    // Search before block
    const reqBefore = makeRequest(`http://localhost:3000/api/user/search?q=${curator.username}`, "GET", visitor.cookie);
    const resBefore = await searchUsers(reqBefore);
    assert.equal(resBefore.status, 200);
    const dataBefore = await resBefore.json();
    const foundBefore = dataBefore.users.some((u: any) => u.id === curator.id);
    assert.equal(foundBefore, true, "Curator should be found in search before block");

    // Establish block
    await db.insert(userBlocks).values({
      id: `block_${timestamp}_4`,
      blockerId: visitor.id,
      blockedId: curator.id,
    });

    try {
      // Search after block
      const reqAfter = makeRequest(`http://localhost:3000/api/user/search?q=${curator.username}`, "GET", visitor.cookie);
      const resAfter = await searchUsers(reqAfter);
      assert.equal(resAfter.status, 200);
      const dataAfter = await resAfter.json();
      const foundAfter = dataAfter.users.some((u: any) => u.id === curator.id);
      assert.equal(foundAfter, false, "Blocked curator must be filtered from search results");
    } finally {
      // Clean up block
      await db.delete(userBlocks).where(eq(userBlocks.id, `block_${timestamp}_4`));
    }
  });

  // ==========================================
  // REFINEMENT 4: VISITOR EXPERIENCE & PRIVACY
  // ==========================================
  it("4a. Visitor Experience: collection view exposes author identity, scores, strips personal notes, and reports follow status", async () => {
    // 1. Logged-out visitor request
    const loggedOutReq = makeRequest(`http://localhost:3000/api/collections/${publicColId}`, "GET");
    const loggedOutRes = await getCollectionDetail(loggedOutReq, { params: Promise.resolve({ id: publicColId }) });
    assert.equal(loggedOutRes.status, 200);
    const loggedOutData = await loggedOutRes.json();

    assert.equal(loggedOutData.isOwner, false);
    assert.equal(loggedOutData.collection.isFollowing, false);
    assert(loggedOutData.collection.user, "Author identity must be present for visitor");
    assert.equal(loggedOutData.collection.user.username, curator.username);
    // Strict privacy: personalNotes must be stripped for non-owner
    const loggedOutRating = loggedOutData.ratings.find((r: any) => r.id === publicRatingId);
    assert(loggedOutRating, "Rating must be returned");
    assert.equal(loggedOutRating.personalNotes, null, "personalNotes must be null for visitor");

    // 2. Authenticated visitor request (before follow)
    const visitorReq1 = makeRequest(`http://localhost:3000/api/collections/${publicColId}`, "GET", visitor.cookie);
    const visitorRes1 = await getCollectionDetail(visitorReq1, { params: Promise.resolve({ id: publicColId }) });
    assert.equal(visitorRes1.status, 200);
    const visitorData1 = await visitorRes1.json();
    assert.equal(visitorData1.isOwner, false);
    assert.equal(visitorData1.collection.isFollowing, false, "Should not be following initially");

    // 3. Visitor follows Curator
    await db.insert(follows).values({
      id: `fol_${timestamp}`,
      followerId: visitor.id,
      followingId: curator.id,
    });

    try {
      // 4. Authenticated visitor request (after follow)
      const visitorReq2 = makeRequest(`http://localhost:3000/api/collections/${publicColId}`, "GET", visitor.cookie);
      const visitorRes2 = await getCollectionDetail(visitorReq2, { params: Promise.resolve({ id: publicColId }) });
      assert.equal(visitorRes2.status, 200);
      const visitorData2 = await visitorRes2.json();
      assert.equal(visitorData2.collection.isFollowing, true, "isFollowing must reflect true after following curator");

      // 5. Owner request preserves personalNotes
      const ownerReq = makeRequest(`http://localhost:3000/api/collections/${publicColId}`, "GET", curator.cookie);
      const ownerRes = await getCollectionDetail(ownerReq, { params: Promise.resolve({ id: publicColId }) });
      assert.equal(ownerRes.status, 200);
      const ownerData = await ownerRes.json();
      assert.equal(ownerData.isOwner, true);
      const ownerRating = ownerData.ratings.find((r: any) => r.id === publicRatingId);
      assert.equal(ownerRating.personalNotes, "Top secret curator notes: watched with pop-corn.", "Owner notes must be preserved");
    } finally {
      // Clean up follow
      await db.delete(follows).where(eq(follows.id, `fol_${timestamp}`));
    }
  });

  // ==========================================
  // REVIEW PRIVACY INVARIANT
  // ==========================================
  it("5. Review Privacy: private reviews and personal notes are strictly excluded from public reviews", async () => {
    const publicReviews = await getPublicReviews(curator.id);
    const ids = publicReviews.map((r) => r.id);

    assert(ids.includes(publicRatingId), "Public collection review must be included");
    assert(!ids.includes(privateRatingId), "Private collection review must not be included");
    assert(publicReviews.every((r) => !("personalNotes" in r) || r.personalNotes === null || r.personalNotes === undefined), "personalNotes must never leak in public reviews");
  });
});
