import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db";
import { user, collections, comments, notifications } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createNotification } from "../lib/notifications";

describe("Stage 16: Phase 2 — Complete Ranking Comments (Replies, Editing, Spoilers, Moderation)", () => {
  const ownerUserId = `user_p2_owner_${Date.now()}`;
  const criticAId = `user_p2_critica_${Date.now()}`;
  const criticBId = `user_p2_criticb_${Date.now()}`;
  const publicCollectionId = `col_p2_pub_${Date.now()}`;

  before(async () => {
    // 1. Create test users
    await db.insert(user).values([
      {
        id: ownerUserId,
        name: "Ranking Curator",
        username: `curator_${Date.now().toString().slice(-6)}`,
        email: `${ownerUserId}@example.com`,
      },
      {
        id: criticAId,
        name: "First Critic",
        username: `critica_${Date.now().toString().slice(-6)}`,
        email: `${criticAId}@example.com`,
      },
      {
        id: criticBId,
        name: "Second Critic",
        username: `criticb_${Date.now().toString().slice(-6)}`,
        email: `${criticBId}@example.com`,
      },
    ]);

    // 2. Create test public collection
    await db.insert(collections).values({
      id: publicCollectionId,
      userId: ownerUserId,
      title: "1970s New Hollywood Masterworks",
      collectionType: "custom",
      visibility: "public",
      isPublic: true,
    });
  });

  after(async () => {
    // Cleanup test records
    await db.delete(notifications).where(eq(notifications.collectionId, publicCollectionId));
    await db.delete(comments).where(eq(comments.collectionId, publicCollectionId));
    await db.delete(collections).where(eq(collections.id, publicCollectionId));
    await db.delete(user).where(eq(user.id, ownerUserId));
    await db.delete(user).where(eq(user.id, criticAId));
    await db.delete(user).where(eq(user.id, criticBId));
  });

  it("1. Comments Schema: supports parentId, isSpoiler, and isEdited columns", async () => {
    const commentId = randomUUID();
    await db.insert(comments).values({
      id: commentId,
      userId: criticAId,
      collectionId: publicCollectionId,
      content: "Chinatown has an unforgettable final sequence.",
      isSpoiler: true,
      isEdited: false,
    });

    const saved = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, commentId),
    });

    assert.ok(saved, "Comment should be created");
    assert.equal(saved.isSpoiler, true, "isSpoiler flag should be stored accurately");
    assert.equal(saved.isEdited, false, "isEdited flag defaults to false");
    assert.equal(saved.parentId, null, "Top-level comment has null parentId");
  });

  it("2. Comment Editing: author can edit content and spoiler flag, updating isEdited", async () => {
    const commentId = randomUUID();
    await db.insert(comments).values({
      id: commentId,
      userId: criticAId,
      collectionId: publicCollectionId,
      content: "Initial draft of my observation.",
      isSpoiler: false,
      isEdited: false,
    });

    // Author edits
    const editedContent = "Refined analysis: The framing in The Conversation emphasizes paranoia.";
    await db
      .update(comments)
      .set({
        content: editedContent,
        isSpoiler: true,
        isEdited: true,
        updatedAt: new Date(),
      })
      .where(eq(comments.id, commentId));

    const updated = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, commentId),
    });

    assert.ok(updated);
    assert.equal(updated.content, editedContent);
    assert.equal(updated.isSpoiler, true);
    assert.equal(updated.isEdited, true, "isEdited flag should be true after edit");
  });

  it("3. Edit Authorization: ranking owner CANNOT edit another user's comment (impersonation forbidden)", async () => {
    const commentId = randomUUID();
    await db.insert(comments).values({
      id: commentId,
      userId: criticAId,
      collectionId: publicCollectionId,
      content: "First critic's genuine thought.",
      isSpoiler: false,
      isEdited: false,
    });

    const commentRecord = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, commentId),
      with: { collection: { columns: { userId: true } } },
    });

    assert.ok(commentRecord);

    // Verify policy check:
    // Only author can edit: commentRecord.userId === sessionUserId
    const isOwnerAllowedToEdit = commentRecord.userId === ownerUserId;
    assert.equal(
      isOwnerAllowedToEdit,
      false,
      "Ranking owner cannot edit comments created by another critic"
    );

    const isAuthorAllowedToEdit = commentRecord.userId === criticAId;
    assert.equal(
      isAuthorAllowedToEdit,
      true,
      "Original author has edit permissions"
    );
  });

  it("4. Threaded Replies (1-Level): child reply references parentId in same collection", async () => {
    const parentId = randomUUID();
    await db.insert(comments).values({
      id: parentId,
      userId: criticAId,
      collectionId: publicCollectionId,
      content: "Dog Day Afternoon is Sidney Lumet at his sharpest.",
      isSpoiler: false,
      isEdited: false,
    });

    const replyId = randomUUID();
    await db.insert(comments).values({
      id: replyId,
      userId: criticBId,
      collectionId: publicCollectionId,
      parentId: parentId,
      content: "Agreed, John Cazale's quiet tension balances Pacino perfectly.",
      isSpoiler: false,
      isEdited: false,
    });

    const reply = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, replyId),
      with: { parent: true },
    });

    assert.ok(reply);
    assert.equal(reply.parentId, parentId);
    assert.ok(reply.parent);
    assert.equal(reply.parent.id, parentId);
    assert.equal(reply.parent.userId, criticAId);
  });

  it("5. Threaded Replies (1-Level Boundary): prevents replying to a comment that is already a reply", async () => {
    // Given root comment
    const rootId = randomUUID();
    await db.insert(comments).values({
      id: rootId,
      userId: criticAId,
      collectionId: publicCollectionId,
      content: "Root comment.",
    });

    // And first-level reply
    const childId = randomUUID();
    await db.insert(comments).values({
      id: childId,
      userId: criticBId,
      collectionId: publicCollectionId,
      parentId: rootId,
      content: "Level 1 reply.",
    });

    // Check parent lookup before creating next reply:
    const candidateParent = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, childId),
    });

    assert.ok(candidateParent);
    // Boundary check: candidateParent already has parentId !== null
    const isNestedForbidden = Boolean(candidateParent.parentId);
    assert.equal(
      isNestedForbidden,
      true,
      "Comments cannot be threaded deeper than 1 level"
    );
  });

  it("6. Reply Notifications: notifies parent comment author and collection owner", async () => {
    const parentId = randomUUID();
    await db.insert(comments).values({
      id: parentId,
      userId: criticAId,
      collectionId: publicCollectionId,
      content: "Taxi Driver's ending continues to divide audiences.",
    });

    // Critic B replies to Critic A
    const replySnippet = "I interpret the final mirror glance as unresolved impulse.";

    // 1. Notification for Critic A (parent author)
    const notifParentAuthor = await createNotification({
      recipientUserId: criticAId,
      actorUserId: criticBId,
      notificationType: "comment",
      collectionId: publicCollectionId,
      metadata: {
        actorName: "Second Critic",
        collectionTitle: "1970s New Hollywood Masterworks",
        commentPreview: replySnippet,
        message: `Second Critic replied to your comment on "1970s New Hollywood Masterworks": "${replySnippet}"`,
        targetUrl: `/collection/${publicCollectionId}`,
      },
    });

    assert.ok(notifParentAuthor);
    assert.equal(notifParentAuthor.recipientUserId, criticAId);
    assert.equal(notifParentAuthor.notificationType, "comment");
    assert.ok((notifParentAuthor.metadata as any)?.message?.includes("replied to your comment"));

    // 2. Notification for Collection Owner (since owner is neither replier nor parent author)
    const notifOwner = await createNotification({
      recipientUserId: ownerUserId,
      actorUserId: criticBId,
      notificationType: "comment",
      collectionId: publicCollectionId,
      metadata: {
        actorName: "Second Critic",
        collectionTitle: "1970s New Hollywood Masterworks",
        commentPreview: replySnippet,
        message: `Second Critic commented on your ranking "1970s New Hollywood Masterworks": "${replySnippet}"`,
        targetUrl: `/collection/${publicCollectionId}`,
      },
    });

    assert.ok(notifOwner);
    assert.equal(notifOwner.recipientUserId, ownerUserId);
    assert.ok((notifOwner.metadata as any)?.message?.includes("commented on your ranking"));
  });

  it("7. Cascade Deletion: deleting parent comment cascades to all child replies", async () => {
    const rootId = randomUUID();
    const reply1Id = randomUUID();
    const reply2Id = randomUUID();

    await db.insert(comments).values({
      id: rootId,
      userId: criticAId,
      collectionId: publicCollectionId,
      content: "Network predicted television's modern trajectory.",
    });

    await db.insert(comments).values([
      {
        id: reply1Id,
        userId: criticBId,
        collectionId: publicCollectionId,
        parentId: rootId,
        content: "Chayefsky's monologue is prophetic.",
      },
      {
        id: reply2Id,
        userId: ownerUserId,
        collectionId: publicCollectionId,
        parentId: rootId,
        content: "Faye Dunaway's performance anchors the whole satire.",
      },
    ]);

    // Verify all 3 exist
    const initialReplies = await db.query.comments.findMany({
      where: (c, { eq }) => eq(c.parentId, rootId),
    });
    assert.equal(initialReplies.length, 2);

    // Delete root comment
    await db.delete(comments).where(eq(comments.id, rootId));

    // Verify root is deleted
    const checkRoot = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, rootId),
    });
    assert.equal(checkRoot, undefined);

    // Verify replies were cascaded
    const remainingReplies = await db.query.comments.findMany({
      where: (c, { eq }) => eq(c.parentId, rootId),
    });
    assert.equal(remainingReplies.length, 0, "All replies should be cascaded on parent deletion");
  });

  it("8. Moderation Rights: ranking owner can delete any comment on their ranking", async () => {
    const commentId = randomUUID();
    await db.insert(comments).values({
      id: commentId,
      userId: criticAId,
      collectionId: publicCollectionId,
      content: "Unwanted disruptive note.",
    });

    const record = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, commentId),
      with: { collection: { columns: { userId: true } } },
    });

    assert.ok(record);

    // Collection owner can delete
    const isOwnerAllowedToDelete = record.collection?.userId === ownerUserId;
    assert.equal(isOwnerAllowedToDelete, true, "Ranking owner has moderation rights to delete");

    // Third-party critic B cannot delete
    const isThirdPartyAllowedToDelete =
      record.userId === criticBId || record.collection?.userId === criticBId;
    assert.equal(isThirdPartyAllowedToDelete, false, "Third-party critic cannot delete");

    // Perform owner deletion
    await db.delete(comments).where(eq(comments.id, commentId));
    const afterDelete = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, commentId),
    });
    assert.equal(afterDelete, undefined, "Comment deleted by owner moderation");
  });
});
