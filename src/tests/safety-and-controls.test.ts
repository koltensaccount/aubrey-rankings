import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db";
import {
  user,
  session as sessionTable,
  collections,
  comments,
  follows,
  likes,
  contentReports,
  userBlocks,
  notifications,
  notificationPreferences,
} from "../db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { auth } from "../lib/auth";

// API Handlers
import { GET as getBlock, POST as postBlock, DELETE as deleteBlock } from "../app/api/social/block/route";
import { POST as postFollow, DELETE as deleteFollow } from "../app/api/social/follow/route";
import { POST as postLike } from "../app/api/social/like/route";
import { GET as getComments, POST as postComments } from "../app/api/social/comments/route";
import { POST as postReport, GET as getReports } from "../app/api/reports/route";
import { PATCH as patchReport } from "../app/api/reports/[id]/route";
import { GET as getPrivacy, PATCH as patchPrivacy } from "../app/api/user/privacy/route";
import { GET as getPrefs, PATCH as patchPrefs } from "../app/api/notifications/preferences/route";
import { createNotification } from "../lib/notifications";

describe("Stage 20: Phase 6 — Essential Community Safety, Blocking, Reporting & Comment Controls", () => {
  const timestamp = Date.now();
  const userAEmail = `safety_user_a_${timestamp}@example.com`;
  const userBEmail = `safety_user_b_${timestamp}@example.com`;
  const adminEmail = `safety_admin_${timestamp}@example.com`;

  let userA: { id: string; cookie: string };
  let userB: { id: string; cookie: string };
  let adminUser: { id: string; cookie: string };

  let testCollectionId = `col_safety_${timestamp}`;
  let testCommentId: string;
  let testReportId: string;

  // Helper to create an authenticated user with Better Auth session and cookie
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

    // Assign unique username and verify email
    await db
      .update(user)
      .set({ username, emailVerified: true })
      .where(eq(user.id, userRecord.id));

    return { id: userRecord.id, cookie };
  }

  // Helper to construct authenticated NextRequest
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
    // Set admin email environment variable for testing admin authorization
    process.env.ADMIN_EMAILS = `${adminEmail}, admin@example.com`;

    // 1. Create two regular authenticated users and an administrator
    userA = await createAuthUser(userAEmail, "Curator Alice", `alice_${timestamp.toString().slice(-6)}`);
    userB = await createAuthUser(userBEmail, "Critic Bob", `bob_${timestamp.toString().slice(-6)}`);
    adminUser = await createAuthUser(adminEmail, "Moderator Admin", `admin_${timestamp.toString().slice(-6)}`);

    // 2. Create test collection owned by User A
    await db.insert(collections).values({
      id: testCollectionId,
      userId: userA.id,
      title: "Alice's Curated Masterworks",
      collectionType: "custom",
      visibility: "public",
      isPublic: true,
      allowComments: true,
    });
  });

  after(async () => {
    // Clean up all test records
    await db.delete(contentReports).where(eq(contentReports.reporterId, userB.id));
    await db.delete(userBlocks).where(
      or(eq(userBlocks.blockerId, userA.id), eq(userBlocks.blockerId, userB.id))
    );
    await db.delete(comments).where(eq(comments.collectionId, testCollectionId));
    await db.delete(likes).where(eq(likes.collectionId, testCollectionId));
    await db.delete(follows).where(
      or(
        inArray(follows.followerId, [userA.id, userB.id, adminUser.id]),
        inArray(follows.followingId, [userA.id, userB.id, adminUser.id])
      )
    );
    await db.delete(notifications).where(
      or(
        inArray(notifications.recipientUserId, [userA.id, userB.id, adminUser.id]),
        inArray(notifications.actorUserId, [userA.id, userB.id, adminUser.id])
      )
    );
    await db.delete(notificationPreferences).where(
      inArray(notificationPreferences.userId, [userA.id, userB.id, adminUser.id])
    );
    await db.delete(collections).where(eq(collections.id, testCollectionId));
    await db.delete(sessionTable).where(
      inArray(sessionTable.userId, [userA.id, userB.id, adminUser.id])
    );
    await db.delete(user).where(
      inArray(user.id, [userA.id, userB.id, adminUser.id])
    );
  });

  it("1. Privacy & Account Settings: updates and retrieves comment permissions and review defaults", async () => {
    // Unauthenticated GET returns 401
    const unauthReq = makeRequest("/api/user/privacy", "GET");
    const unauthRes = await getPrivacy(unauthReq);
    assert.equal(unauthRes.status, 401, "Unauthenticated access must be rejected");

    // Alice updates privacy settings: commentPermission = 'following', defaultReviewVisibility = 'private'
    const patchReq = makeRequest("/api/user/privacy", "PATCH", userA.cookie, {
      commentPermission: "following",
      defaultReviewVisibility: "private",
      defaultReviewSpoiler: true,
    });
    const patchRes = await patchPrivacy(patchReq);
    assert.equal(patchRes.status, 200, "PATCH privacy must return 200");
    const patchBody = await patchRes.json();
    assert.equal(patchBody.privacy.commentPermission, "following");
    assert.equal(patchBody.privacy.defaultReviewVisibility, "private");
    assert.equal(patchBody.privacy.defaultReviewSpoiler, true);

    // Verify DB persistence
    const userInDb = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, userA.id),
    });
    assert.equal(userInDb?.commentPermission, "following");
    assert.equal(userInDb?.defaultReviewVisibility, "private");
    assert.equal(userInDb?.defaultReviewSpoiler, true);

    // Re-verify GET /api/user/privacy returns updated settings
    const getReq = makeRequest("/api/user/privacy", "GET", userA.cookie);
    const getRes = await getPrivacy(getReq);
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.privacy.commentPermission, "following");
  });

  it("2. Notification Preferences: supports reply notification toggling", async () => {
    // Fetch initial preferences
    const getReq = makeRequest("/api/notifications/preferences", "GET", userA.cookie);
    const getRes = await getPrefs(getReq);
    assert.equal(getRes.status, 200);
    const initialPrefs = (await getRes.json()).preferences;
    assert.equal(initialPrefs.notifyReplies, true, "Replies should default to enabled");

    // Toggle notifyReplies to false
    const patchReq = makeRequest("/api/notifications/preferences", "PATCH", userA.cookie, {
      notifyReplies: false,
    });
    const patchRes = await patchPrefs(patchReq);
    assert.equal(patchRes.status, 200);
    const updated = (await patchRes.json()).preferences;
    assert.equal(updated.notifyReplies, false, "Replies should be disabled");

    // Restore to true
    await patchPrefs(makeRequest("/api/notifications/preferences", "PATCH", userA.cookie, {
      notifyReplies: true,
    }));
  });

  it("3. Mutual Follows Setup & Authoritative Block Enforcement", async () => {
    // Setup initial follows: Bob follows Alice, Alice follows Bob
    const bobFollowReq = makeRequest("/api/social/follow", "POST", userB.cookie, {
      targetUserId: userA.id,
    });
    const bobFollowRes = await postFollow(bobFollowReq);
    assert.equal(bobFollowRes.status, 200, "Bob can follow Alice");

    const aliceFollowReq = makeRequest("/api/social/follow", "POST", userA.cookie, {
      targetUserId: userB.id,
    });
    const aliceFollowRes = await postFollow(aliceFollowReq);
    assert.equal(aliceFollowRes.status, 200, "Alice can follow Bob");

    // Verify follows exist in DB
    const followsBefore = await db.query.follows.findMany({
      where: (f, { or, and, eq }) =>
        or(
          and(eq(f.followerId, userB.id), eq(f.followingId, userA.id)),
          and(eq(f.followerId, userA.id), eq(f.followingId, userB.id))
        ),
    });
    assert.equal(followsBefore.length, 2, "Both follow relations must be established");

    // Alice blocks Bob
    const blockReq = makeRequest("/api/social/block", "POST", userA.cookie, {
      targetUserId: userB.id,
    });
    const blockRes = await postBlock(blockReq);
    assert.equal(blockRes.status, 200, "Alice blocks Bob");
    const blockBody = await blockRes.json();
    assert.equal(blockBody.isBlocked, true);

    // Verify user_blocks table contains block record
    const blockRecord = await db.query.userBlocks.findFirst({
      where: (b, { and, eq }) =>
        and(eq(b.blockerId, userA.id), eq(b.blockedId, userB.id)),
    });
    assert(blockRecord, "Block record must exist in user_blocks table");

    // VERIFY RECIPROCAL FOLLOW DELETION: Both follows MUST have been deleted immediately!
    const followsAfter = await db.query.follows.findMany({
      where: (f, { or, and, eq }) =>
        or(
          and(eq(f.followerId, userB.id), eq(f.followingId, userA.id)),
          and(eq(f.followerId, userA.id), eq(f.followingId, userB.id))
        ),
    });
    assert.equal(followsAfter.length, 0, "All reciprocal follow relationships must be deleted on block");

    // Verify Alice listing blocked users includes Bob
    const listBlockReq = makeRequest("/api/social/block", "GET", userA.cookie);
    const listBlockRes = await getBlock(listBlockReq);
    assert.equal(listBlockRes.status, 200);
    const listBody = await listBlockRes.json();
    assert(listBody.blockedUsers.some((u: any) => u.userId === userB.id), "Bob must be in Alice's blocked list");
  });

  it("4. Interactivity Gate: Blocked users cannot follow, like, or comment", async () => {
    // Bob attempts to follow Alice while blocked -> 403 Forbidden
    const followBlockedReq = makeRequest("/api/social/follow", "POST", userB.cookie, {
      targetUserId: userA.id,
    });
    const followBlockedRes = await postFollow(followBlockedReq);
    assert.equal(followBlockedRes.status, 403, "Blocked user cannot follow");

    // Alice attempts to follow Bob while blocked -> 403 Forbidden
    const aliceFollowBlockedReq = makeRequest("/api/social/follow", "POST", userA.cookie, {
      targetUserId: userB.id,
    });
    const aliceFollowBlockedRes = await postFollow(aliceFollowBlockedReq);
    assert.equal(aliceFollowBlockedRes.status, 403, "Cannot follow blocked user");

    // Bob attempts to like Alice's collection -> 403 Forbidden
    const likeBlockedReq = makeRequest("/api/social/like", "POST", userB.cookie, {
      collectionId: testCollectionId,
    });
    const likeBlockedRes = await postLike(likeBlockedReq);
    assert.equal(likeBlockedRes.status, 403, "Blocked user cannot like collection");

    // Bob attempts to comment on Alice's collection -> 403 Forbidden
    const commentBlockedReq = makeRequest("/api/social/comments", "POST", userB.cookie, {
      collectionId: testCollectionId,
      content: "Sneaky comment attempt",
    });
    const commentBlockedRes = await postComments(commentBlockedReq);
    assert.equal(commentBlockedRes.status, 403, "Blocked user cannot comment");

    // Notifications between blocked users are suppressed
    const notif = await createNotification({
      recipientUserId: userA.id,
      actorUserId: userB.id,
      notificationType: "reply",
      metadata: { message: "Test blocked notification" },
    });
    assert.equal(notif, null, "Notifications from blocked user must be suppressed");
  });

  it("5. Unblocking & Granular Comment Eligibility (Everyone / Following / Nobody / allowComments)", async () => {
    // Alice unblocks Bob
    const unblockReq = makeRequest("/api/social/block", "DELETE", userA.cookie, {
      targetUserId: userB.id,
    });
    const unblockRes = await deleteBlock(unblockReq);
    assert.equal(unblockRes.status, 200, "Unblock must succeed");
    const unblockBody = await unblockRes.json();
    assert.equal(unblockBody.isBlocked, false);

    // Verify user_blocks record removed
    const blockAfter = await db.query.userBlocks.findFirst({
      where: (b, { and, eq }) =>
        and(eq(b.blockerId, userA.id), eq(b.blockedId, userB.id)),
    });
    assert.equal(blockAfter, undefined, "Block row must be deleted");

    // Now Alice's commentPermission is 'following', but Alice does NOT follow Bob yet!
    // Bob attempts to comment on Alice's collection -> 403 (following only)
    const commentDeniedReq = makeRequest("/api/social/comments", "POST", userB.cookie, {
      collectionId: testCollectionId,
      content: "Hey Alice, checking in!",
    });
    const commentDeniedRes = await postComments(commentDeniedReq);
    assert.equal(commentDeniedRes.status, 403, "Must reject comment when author does not follow commenter");
    const deniedBody = await commentDeniedRes.json();
    assert.match(deniedBody.error, /followed by the author/i);

    // Now Alice follows Bob!
    const aliceFollowReq = makeRequest("/api/social/follow", "POST", userA.cookie, {
      targetUserId: userB.id,
    });
    const aliceFollowRes = await postFollow(aliceFollowReq);
    assert.equal(aliceFollowRes.status, 200, "Alice successfully follows Bob");

    // Bob comments again -> 200 OK!
    const commentAllowedReq = makeRequest("/api/social/comments", "POST", userB.cookie, {
      collectionId: testCollectionId,
      content: "Outstanding ranking Alice, loved the cinematography scores!",
    });
    const commentAllowedRes = await postComments(commentAllowedReq);
    assert.equal(commentAllowedRes.status, 200, "Bob can comment now that Alice follows him");
    const commentAllowedBody = await commentAllowedRes.json();
    testCommentId = commentAllowedBody.comment.id;
    assert(testCommentId, "Created comment must have ID");

    // Now test ranking-level disable: Alice turns allowComments = false on this ranking
    await db
      .update(collections)
      .set({ allowComments: false })
      .where(eq(collections.id, testCollectionId));

    // Bob tries to reply to the comment -> 403 Comments Disabled
    const commentDisabledReq = makeRequest("/api/social/comments", "POST", userB.cookie, {
      collectionId: testCollectionId,
      parentId: testCommentId,
      content: "Reply when comments are disabled",
    });
    const commentDisabledRes = await postComments(commentDisabledReq);
    assert.equal(commentDisabledRes.status, 403, "Must reject comment when collection has allowComments = false");
    const disabledBody = await commentDisabledRes.json();
    assert.match(disabledBody.error, /disabled for this ranking/i);

    // Restore allowComments
    await db
      .update(collections)
      .set({ allowComments: true })
      .where(eq(collections.id, testCollectionId));
  });

  it("6. Content Reporting & Admin Moderation: validation, deduplication, RBAC and resolution", async () => {
    // Unauthenticated report returns 401
    const unauthRep = makeRequest("/api/reports", "POST", undefined, {
      targetType: "comment",
      targetId: testCommentId,
      reason: "harassment",
    });
    assert.equal((await postReport(unauthRep)).status, 401);

    // Bob reports Alice's testCommentId for 'harassment'
    const reportReq = makeRequest("/api/reports", "POST", userB.cookie, {
      targetType: "comment",
      targetId: testCommentId,
      reason: "harassment",
      details: "This comment violates community standards and contains inappropriate language.",
    });
    const reportRes = await postReport(reportReq);
    assert.equal(reportRes.status, 200, "Report submission must succeed");
    const reportBody = await reportRes.json();
    assert.equal(reportBody.success, true);
    testReportId = reportBody.reportId;
    assert(testReportId, "Report ID must be returned");

    // Deduplication test: Bob submits an identical report for the same target while report is open -> 409 Conflict
    const dupReportReq = makeRequest("/api/reports", "POST", userB.cookie, {
      targetType: "comment",
      targetId: testCommentId,
      reason: "spam",
    });
    const dupReportRes = await postReport(dupReportReq);
    assert.equal(dupReportRes.status, 409, "Duplicate open report must return 409 Conflict");
    const dupBody = await dupReportRes.json();
    assert.match(dupBody.error, /already submitted an open report/i);

    // RBAC: Non-admin (Bob) attempts to view reports queue -> 403 Forbidden
    const bobQueueReq = makeRequest("/api/reports", "GET", userB.cookie);
    const bobQueueRes = await getReports(bobQueueReq);
    assert.equal(bobQueueRes.status, 403, "Non-admin user cannot access moderation reports queue");

    // RBAC: Administrator views reports queue -> 200 OK
    const adminQueueReq = makeRequest("/api/reports", "GET", adminUser.cookie);
    const adminQueueRes = await getReports(adminQueueReq);
    assert.equal(adminQueueRes.status, 200, "Administrator must be granted access to moderation reports queue");
    const adminQueueBody = await adminQueueRes.json();
    assert(Array.isArray(adminQueueBody.reports), "Reports array returned");
    const foundReport = adminQueueBody.reports.find((r: any) => r.id === testReportId);
    assert(foundReport, "Submitted report must be in administrator reports queue");
    assert.equal(foundReport.status, "open");
    assert.equal(foundReport.reason, "harassment");

    // Administrator resolves the report
    const patchReportReq = makeRequest(`/api/reports/${testReportId}`, "PATCH", adminUser.cookie, {
      status: "resolved",
      adminNotes: "Investigated by moderator. Content reviewed and marked clean.",
    });
    const patchReportRes = await patchReport(patchReportReq, {
      params: Promise.resolve({ id: testReportId }),
    });
    assert.equal(patchReportRes.status, 200, "Admin can update report status");
    const updatedReport = (await patchReportRes.json()).report;
    assert.equal(updatedReport.status, "resolved");
    assert.equal(updatedReport.resolvedById, adminUser.id);
    assert.equal(updatedReport.adminNotes, "Investigated by moderator. Content reviewed and marked clean.");

    // Verify DB persistence of resolved report
    const dbReport = await db.query.contentReports.findFirst({
      where: (r, { eq }) => eq(r.id, testReportId),
    });
    assert.equal(dbReport?.status, "resolved");
    assert.equal(dbReport?.resolvedById, adminUser.id);
  });
});
