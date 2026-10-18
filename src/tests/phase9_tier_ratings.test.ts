import assert from "node:assert";
import { describe, it, before, after } from "node:test";
import { db } from "../db";
import {
  user,
  collections,
  mediaItems,
  collectionEntries,
  ratingSystems,
  ratingTiers,
  ratings,
  categoryScores,
} from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { SYSTEM_TIER_TEMPLATE_ID, STANDARD_TIERS_PRESET } from "../lib/tier-system";
import { mutateRubric, RubricError } from "../lib/rubric-management";
import { compareRankings } from "../lib/comparison";

describe("Phase 9: First-Class Tier Rating Systems", () => {
  const testUserId = "test_user_phase9_" + Date.now();
  const testUserEmail = `${testUserId}@example.com`;

  before(async () => {
    await db.insert(user).values({
      id: testUserId,
      name: "Phase 9 Tester",
      email: testUserEmail,
    });
  });

  after(async () => {
    // Cleanup cascade
    await db.delete(user).where(eq(user.id, testUserId));
  });

  it("1. Built-in tier templates have valid persisted identities without artificial user accounts", async () => {
    const template = await db.query.ratingSystems.findFirst({
      where: (rs, { eq }) => eq(rs.id, SYSTEM_TIER_TEMPLATE_ID),
      with: {
        tiers: {
          orderBy: (t, { asc }) => [asc(t.sortOrder)],
        },
      },
    });

    assert.ok(template, "Standard tier template must exist in database");
    assert.strictEqual(template.userId, null, "Template must have user_id = NULL (no artificial user)");
    assert.strictEqual(template.isSystemTemplate, true, "Template must have is_system_template = true");
    assert.strictEqual(template.type, "tier", "Template must have type = tier");
    assert.strictEqual(template.tiers.length, 5, "Template must have exactly 5 tiers (S, A, B, C, D)");

    const names = template.tiers.map((t) => t.name);
    assert.deepStrictEqual(names, ["S", "A", "B", "C", "D"]);
  });

  it("2. Enforces database-level ON DELETE RESTRICT on tier assignments", async () => {
    // Create a custom tier system for the test user
    const customSystemId = "rs_custom_" + Date.now();
    await db.insert(ratingSystems).values({
      id: customSystemId,
      userId: testUserId,
      name: "Custom Anime Tiers",
      type: "tier",
      scale: 10,
    });

    const tierSId = "tier_s_" + Date.now();
    const tierAId = "tier_a_" + Date.now();
    await db.insert(ratingTiers).values([
      { id: tierSId, ratingSystemId: customSystemId, name: "God Tier", color: "#EF4444", sortOrder: 1 },
      { id: tierAId, ratingSystemId: customSystemId, name: "Great Tier", color: "#F97316", sortOrder: 2 },
    ]);

    // Create a media item and assign it to tier S
    const mediaId = "media_tier_test_" + Date.now();
    await db.insert(mediaItems).values({
      id: mediaId,
      title: "Neon Genesis Evangelion",
      mediaType: "tv",
    });

    const ratingId = "rating_tier_test_" + Date.now();
    await db.insert(ratings).values({
      id: ratingId,
      userId: testUserId,
      mediaItemId: mediaId,
      ratingSystemId: customSystemId,
      tierId: tierSId,
    });

    // Attempt direct SQL deletion of referenced tier -> must fail with ON DELETE RESTRICT foreign key violation
    let directDeleteError: any = null;
    try {
      await db.delete(ratingTiers).where(eq(ratingTiers.id, tierSId));
    } catch (err) {
      directDeleteError = err;
    }
    assert.ok(directDeleteError, "Direct deletion of referenced tier must be blocked by ON DELETE RESTRICT");

    // Attempt mutateRubric removal of tier without migration -> must throw 409 RubricError
    let mutateError: any = null;
    try {
      await mutateRubric(testUserId, customSystemId, {
        name: "Custom Anime Tiers",
        type: "tier",
        tiers: [
          // Omitting tier S, keeping only tier A
          { id: tierAId, name: "Great Tier", color: "#F97316" },
          { name: "New B Tier", color: "#F59E0B" },
        ],
      });
    } catch (err) {
      mutateError = err;
    }
    assert.ok(mutateError instanceof RubricError, "mutateRubric must throw RubricError");
    assert.strictEqual(mutateError.status, 409, "Must return 409 conflict when tier has active ratings");

    // Attempt mutateRubric with targetTierId reassignment -> must succeed and migrate rating to tier A
    await mutateRubric(testUserId, customSystemId, {
      name: "Custom Anime Tiers",
      type: "tier",
      tiers: [
        { id: tierAId, name: "Great Tier", color: "#F97316" },
        { name: "New B Tier", color: "#F59E0B" },
      ],
      targetTierId: tierAId,
    });

    const updatedRating = await db.query.ratings.findFirst({
      where: (r, { eq }) => eq(r.id, ratingId),
    });
    assert.strictEqual(updatedRating?.tierId, tierAId, "Rating must be safely migrated to target tier");
  });

  it("3. Non-destructive switching between numerical and tier rubrics preserves both evaluation representations", async () => {
    // Create numerical rubric
    const numRubricId = "rs_num_" + Date.now();
    await db.insert(ratingSystems).values({
      id: numRubricId,
      userId: testUserId,
      name: "Standard 5-Part",
      type: "numerical",
      scale: 10,
    });

    // Create tier system
    const tierSysId = "rs_tier_coexist_" + Date.now();
    await db.insert(ratingSystems).values({
      id: tierSysId,
      userId: testUserId,
      name: "Tier Coexist",
      type: "tier",
      scale: 10,
    });
    const tierId = "tier_coexist_s_" + Date.now();
    await db.insert(ratingTiers).values([
      { id: tierId, ratingSystemId: tierSysId, name: "S", color: "#EF4444", sortOrder: 1 },
      { id: "tier_coexist_a_" + Date.now(), ratingSystemId: tierSysId, name: "A", color: "#F97316", sortOrder: 2 },
    ]);

    const mediaId = "media_coexist_" + Date.now();
    await db.insert(mediaItems).values({
      id: mediaId,
      title: "Coexistence Film",
      mediaType: "movie",
    });

    const ratingId = "rating_coexist_" + Date.now();
    await db.insert(ratings).values({
      id: ratingId,
      userId: testUserId,
      mediaItemId: mediaId,
      ratingSystemId: numRubricId,
      calculatedOverallScore: 9.2,
      tierId: null,
      reviewText: "Masterful cinema.",
    });

    // User switches to Tier system and assigns Tier S
    await db.update(ratings)
      .set({
        ratingSystemId: tierSysId,
        tierId: tierId,
        // numerical score remains intact!
      })
      .where(eq(ratings.id, ratingId));

    let record = await db.query.ratings.findFirst({
      where: (r, { eq }) => eq(r.id, ratingId),
    });
    assert.strictEqual(record?.tierId, tierId, "Tier assignment must be saved");
    assert.strictEqual(record?.calculatedOverallScore, 9.2, "Historical numerical score must remain preserved");

    // User switches back to numerical rubric
    await db.update(ratings)
      .set({
        ratingSystemId: numRubricId,
      })
      .where(eq(ratings.id, ratingId));

    record = await db.query.ratings.findFirst({
      where: (r, { eq }) => eq(r.id, ratingId),
    });
    assert.strictEqual(record?.tierId, tierId, "Historical tier assignment must remain safely preserved");
    assert.strictEqual(record?.calculatedOverallScore, 9.2, "Numerical score remains preserved");
  });

  it("4. Comparison engine evaluates rank correlation accurately on tier rankings", () => {
    // Critic A: S (Blade Runner, 2001), A (Solaris), B (Interstellar)
    const leftItems = [
      { mediaItemId: "m1", title: "Blade Runner", rank: 1, score: null, tierName: "S", tierColor: "#EF4444" },
      { mediaItemId: "m2", title: "2001: A Space Odyssey", rank: 2, score: null, tierName: "S", tierColor: "#EF4444" },
      { mediaItemId: "m3", title: "Solaris", rank: 3, score: null, tierName: "A", tierColor: "#F97316" },
      { mediaItemId: "m4", title: "Interstellar", rank: 4, score: null, tierName: "B", tierColor: "#F59E0B" },
    ];

    // Critic B (numerical): 2001 (9.8), Blade Runner (9.5), Solaris (8.8), Interstellar (7.5)
    const rightItems = [
      { mediaItemId: "m2", title: "2001: A Space Odyssey", rank: 1, score: 9.8 },
      { mediaItemId: "m1", title: "Blade Runner", rank: 2, score: 9.5 },
      { mediaItemId: "m3", title: "Solaris", rank: 3, score: 8.8 },
      { mediaItemId: "m4", title: "Interstellar", rank: 4, score: 7.5 },
    ];

    const result = compareRankings(leftItems, rightItems);
    assert.strictEqual(result.overlappingCount, 4);
    assert.ok(result.spearmanCorrelation !== null && result.spearmanCorrelation >= 0.8, "Should indicate high correlation");
    assert.strictEqual(result.alignmentRating, "Strong Alignment");
    assert.strictEqual(result.meanScoreDifference, null, "Mean numerical score diff must be null for tier vs numerical without dual scores");
  });

  it("5. Ordinary tier-system saves cannot silently unassign ratings without explicit confirmation or reassignment", async () => {
    const safetySystemId = "rs_safety_" + Date.now();
    await db.insert(ratingSystems).values({
      id: safetySystemId,
      userId: testUserId,
      name: "Safety Check Rubric",
      type: "tier",
      scale: 10,
    });

    const tierS = "tier_safe_s_" + Date.now();
    const tierA = "tier_safe_a_" + Date.now();
    const tierB = "tier_safe_b_" + Date.now();
    await db.insert(ratingTiers).values([
      { id: tierS, ratingSystemId: safetySystemId, name: "S Tier", color: "#EF4444", sortOrder: 1 },
      { id: tierA, ratingSystemId: safetySystemId, name: "A Tier", color: "#F97316", sortOrder: 2 },
      { id: tierB, ratingSystemId: safetySystemId, name: "B Tier", color: "#F59E0B", sortOrder: 3 },
    ]);

    const mediaId = "media_safe_" + Date.now();
    await db.insert(mediaItems).values({
      id: mediaId,
      title: "Safety Test Film",
      mediaType: "movie",
    });

    const ratingId = "rating_safe_" + Date.now();
    await db.insert(ratings).values({
      id: ratingId,
      userId: testUserId,
      mediaItemId: mediaId,
      ratingSystemId: safetySystemId,
      tierId: tierB,
      reviewText: "A memorable gem that belongs in B tier.",
      personalNotes: "Private note that must be preserved.",
      calculatedOverallScore: 7.5,
    });

    // 1. Ordinary save removing tier B without unassignRemovedTiers or tierMigrations must FAIL with 409
    let rejectedError: any = null;
    try {
      await mutateRubric(testUserId, safetySystemId, {
        name: "Safety Check Rubric",
        type: "tier",
        tiers: [
          { id: tierS, name: "S Tier", color: "#EF4444" },
          { id: tierA, name: "A Tier", color: "#F97316" },
        ],
      });
    } catch (err) {
      rejectedError = err;
    }

    assert.ok(rejectedError instanceof RubricError, "Must reject with RubricError");
    assert.strictEqual(rejectedError.status, 409, "Must return status 409 Conflict");
    assert.deepStrictEqual(rejectedError.conflict, {
      tierId: tierB,
      tierName: "B Tier",
      activeCount: 1,
    }, "Must return structured conflict details for frontend UI");

    // Verify rating was NOT modified
    let checkRating = await db.query.ratings.findFirst({
      where: (r, { eq }) => eq(r.id, ratingId),
    });
    assert.strictEqual(checkRating?.tierId, tierB, "Rating tier assignment must remain completely unchanged");
    assert.strictEqual(checkRating?.reviewText, "A memorable gem that belongs in B tier.", "Review must remain intact");
    assert.strictEqual(checkRating?.personalNotes, "Private note that must be preserved.", "Personal notes must remain intact");

    // 2. Reassignment via tierMigrations must safely move the item to Tier A
    await mutateRubric(testUserId, safetySystemId, {
      name: "Safety Check Rubric",
      type: "tier",
      tiers: [
        { id: tierS, name: "S Tier", color: "#EF4444" },
        { id: tierA, name: "A Tier", color: "#F97316" },
      ],
      tierMigrations: {
        [tierB]: tierA,
      },
    });

    checkRating = await db.query.ratings.findFirst({
      where: (r, { eq }) => eq(r.id, ratingId),
    });
    assert.strictEqual(checkRating?.tierId, tierA, "Rating must be safely migrated to Tier A");
    assert.strictEqual(checkRating?.reviewText, "A memorable gem that belongs in B tier.", "Review preserved");
    assert.strictEqual(checkRating?.personalNotes, "Private note that must be preserved.", "Personal notes preserved");

    // 3. Explicit unassignment via unassignRemovedTiers: true must only succeed when intentionally requested
    await mutateRubric(testUserId, safetySystemId, {
      name: "Safety Check Rubric",
      type: "tier",
      tiers: [
        { id: tierS, name: "S Tier", color: "#EF4444" },
      ],
      unassignRemovedTiers: true,
    });

    checkRating = await db.query.ratings.findFirst({
      where: (r, { eq }) => eq(r.id, ratingId),
    });
    assert.strictEqual(checkRating?.tierId, null, "Rating tierId is set to null (unranked) only upon explicit request");
    assert.strictEqual(checkRating?.reviewText, "A memorable gem that belongs in B tier.", "Review preserved even when unassigned");
    assert.strictEqual(checkRating?.personalNotes, "Private note that must be preserved.", "Personal notes preserved even when unassigned");
  });
});
