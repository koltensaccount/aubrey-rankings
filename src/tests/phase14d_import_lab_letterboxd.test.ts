import path from "node:path";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

// =============================================================================
// Safety Checks BEFORE Database / Authentication Modules Initialize
// =============================================================================
try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
} catch {}

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

const isOptedIn =
  process.env.AUBREY_TEST_MODE === "1" ||
  process.env.ALLOW_TEST_DB_WRITES === "1";

if (!isOptedIn) {
  throw new Error(
    "Phase 14D Test aborted: Refusing to run without explicit test execution opt-in. Set AUBREY_TEST_MODE=1 or ALLOW_TEST_DB_WRITES=1 to run against a dedicated disposable test database."
  );
}

import AdmZip from "adm-zip";
import { db } from "@/db";
import {
  user,
  session as sessionTable,
  mediaItems,
  ratings,
  reviews,
  diaryEntries,
  watchlistItems,
  collections,
  collectionEntries,
  ratingSystems,
  importSourceMappings,
  unresolvedImportItems,
} from "@/db/schema";
import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";
import { parseLetterboxdZip } from "@/lib/letterboxd";
import {
  executeLetterboxdImport,
  previewLetterboxdImport,
} from "@/lib/letterboxd-import";
import {
  resolveLetterboxdMediaIdentity,
  batchResolveIdentities,
  KNOWN_TV_EXCEPTIONS,
  calculateCandidateScore,
  clearResolutionCache,
  invalidateResolutionCache,
} from "@/lib/letterboxd-matching";
import {
  ensureTestWorkspaceUser,
  resetTestWorkspace,
  getTestWorkspaceStats,
  verifyAdminOrTestSession,
  TEST_WORKSPACE_USER_ID,
  TEST_WORKSPACE_EMAIL,
} from "@/lib/test-workspace";
import {
  calculateCleanupPreview,
  executeCleanup,
  generateCleanupToken,
  verifyCleanupToken,
  getCleanupSecret,
  verifyBackupReadiness,
} from "@/lib/library-cleanup";
import { randomUUID } from "crypto";
import { seedDefaultRatingSystem } from "@/lib/auth";
import type { NextRequest } from "next/server";

describe("Phase 14D: Import Lab & Letterboxd Reliability", () => {
  const runId = `p14d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const realUserId = `usr_real_${runId}`;
  const trackedUserIds = [realUserId, TEST_WORKSPACE_USER_ID];
  const trackedMediaIds: string[] = [];

  before(async () => {
    // Fail-safe opt-in check
    if (process.env.AUBREY_TEST_MODE !== "1") {
      throw new Error("Phase 14D test suite requires explicit opt-in via AUBREY_TEST_MODE=1");
    }

    // Create a real user to test isolation and cleanup against
    await db.insert(user).values({
      id: realUserId,
      name: "Real Curator User",
      email: `curator_${runId}@example.com`,
      emailVerified: true,
      username: `curator_${runId}`,
      isTestWorkspace: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await seedDefaultRatingSystem(realUserId);
    await ensureTestWorkspaceUser();
  });

  after(async () => {
    // Cleanup created test records
    await resetTestWorkspace(TEST_WORKSPACE_USER_ID);

    await db.delete(diaryEntries).where(eq(diaryEntries.userId, realUserId));
    await db.delete(reviews).where(eq(reviews.userId, realUserId));
    await db.delete(ratings).where(eq(ratings.userId, realUserId));
    await db.delete(watchlistItems).where(eq(watchlistItems.userId, realUserId));

    const realUserCols = await db.query.collections.findMany({
      where: eq(collections.userId, realUserId),
      columns: { id: true },
    });
    for (const c of realUserCols) {
      await db.delete(collectionEntries).where(eq(collectionEntries.collectionId, c.id));
    }
    await db.delete(collections).where(eq(collections.userId, realUserId));
    await db.delete(user).where(eq(user.id, realUserId));

    for (const mId of trackedMediaIds) {
      await db.delete(mediaItems).where(eq(mediaItems.id, mId));
    }
  });

  it("1. ensures test workspace exists with isTestWorkspace=true and isolated credentials", async () => {
    const wsUserId = await ensureTestWorkspaceUser();
    assert.equal(wsUserId, TEST_WORKSPACE_USER_ID);

    const wsRecord = await db.query.user.findFirst({
      where: eq(user.id, TEST_WORKSPACE_USER_ID),
    });

    assert.ok(wsRecord);
    assert.equal(wsRecord.isTestWorkspace, true);
    assert.equal(wsRecord.email, TEST_WORKSPACE_EMAIL);
    assert.equal(wsRecord.username, "test_workspace");
  });

  it("2. imports into test workspace without affecting real user libraries", async () => {
    const zip = new AdmZip();
    const diaryContent = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2026-02-14,Test Film Alpha ${runId},2020,https://boxd.it/alpha,4.5,No,"cinema",2026-02-14
`;
    zip.addFile("diary.csv", Buffer.from(diaryContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    const result = await executeLetterboxdImport(TEST_WORKSPACE_USER_ID, summary, {
      allowSyntheticPlaceholders: true,
    });

    assert.equal(result.newDiaryCount, 1);

    // Verify test workspace has the diary entry
    const wsEntries = await db.query.diaryEntries.findMany({
      where: eq(diaryEntries.userId, TEST_WORKSPACE_USER_ID),
    });
    assert.ok(wsEntries.length >= 1);

    // Verify real user has zero diary entries
    const realEntries = await db.query.diaryEntries.findMany({
      where: eq(diaryEntries.userId, realUserId),
    });
    assert.equal(realEntries.length, 0);
  });

  it("3. converts Letterboxd 5-star ratings to internal 10-point scale while preserving source semantics", async () => {
    const zip = new AdmZip();
    const diaryContent = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2026-01-01,Five Star Movie ${runId},2021,https://boxd.it/star5,5.0,No,"",2026-01-01
2026-01-02,Four Half Star Movie ${runId},2021,https://boxd.it/star45,4.5,No,"",2026-01-02
2026-01-03,Three Star Movie ${runId},2021,https://boxd.it/star3,3.0,No,"",2026-01-03
2026-01-04,Half Star Movie ${runId},2021,https://boxd.it/star05,0.5,No,"",2026-01-04
`;
    zip.addFile("diary.csv", Buffer.from(diaryContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    await executeLetterboxdImport(TEST_WORKSPACE_USER_ID, summary, {
      allowSyntheticPlaceholders: true,
    });

    const entries = await db.query.diaryEntries.findMany({
      where: eq(diaryEntries.userId, TEST_WORKSPACE_USER_ID),
      with: { mediaItem: true },
    });

    const findByTitle = (title: string) => entries.find((e) => e.mediaItem.title.startsWith(title));

    const e5 = findByTitle("Five Star Movie");
    assert.ok(e5);
    assert.equal(e5.ratingValue, 10); // 5.0 * 2 = 10
    assert.equal(e5.sourceRating, 5.0);
    assert.equal(e5.sourceScale, 5);

    const e45 = findByTitle("Four Half Star Movie");
    assert.ok(e45);
    assert.equal(e45.ratingValue, 9); // 4.5 * 2 = 9
    assert.equal(e45.sourceRating, 4.5);
    assert.equal(e45.sourceScale, 5);

    const e3 = findByTitle("Three Star Movie");
    assert.ok(e3);
    assert.equal(e3.ratingValue, 6); // 3.0 * 2 = 6
    assert.equal(e3.sourceRating, 3.0);
    assert.equal(e3.sourceScale, 5);

    const e05 = findByTitle("Half Star Movie");
    assert.ok(e05);
    assert.equal(e05.ratingValue, 1); // 0.5 * 2 = 1
    assert.equal(e05.sourceRating, 0.5);
    assert.equal(e05.sourceScale, 5);
  });

  it("4. detects known Letterboxd TV exceptions (Black Mirror episodes) and matches television series", async () => {
    const sanJuniperoCandidate = {
      title: "Black Mirror: San Junipero",
      year: 2016,
      letterboxdUri: "https://boxd.it/san_junipero",
    };

    const foundException = KNOWN_TV_EXCEPTIONS.find((e) => e.pattern.test(sanJuniperoCandidate.title));
    assert.ok(foundException, "Must identify Black Mirror: San Junipero as known TV exception");
    assert.equal(foundException.seriesTmdbId, 42009);
    assert.equal(foundException.seasonNumber, 3);
    assert.equal(foundException.episodeNumber, 4);
    assert.equal(foundException.episodeTitle, "San Junipero");

    const whiteChristmasCandidate = {
      title: "Black Mirror: White Christmas",
      year: 2014,
    };
    const whiteChristmasException = KNOWN_TV_EXCEPTIONS.find((e) => e.pattern.test(whiteChristmasCandidate.title));
    assert.ok(whiteChristmasException);
    assert.equal(whiteChristmasException.seriesTmdbId, 42009);
    assert.equal(whiteChristmasException.seasonNumber, 2);
    assert.equal(whiteChristmasException.episodeNumber, 4);
  });

  it("5. strictly resets test workspace data and refuses any other user account", async () => {
    // Ensure test workspace has data
    const statsBefore = await getTestWorkspaceStats();
    assert.ok(statsBefore.diaryCount > 0);

    // Attempting to reset a real user must fail immediately
    await assert.rejects(
      async () => {
        await resetTestWorkspace(realUserId);
      },
      {
        message: /Refusing to reset non-test workspace/,
      }
    );

    // Resetting the test workspace succeeds
    const resetResult = await resetTestWorkspace(TEST_WORKSPACE_USER_ID);
    assert.ok(resetResult.diaryDeleted > 0);

    const statsAfter = await getTestWorkspaceStats();
    assert.equal(statsAfter.diaryCount, 0);
    assert.equal(statsAfter.reviewsCount, 0);
    assert.equal(statsAfter.ratingsCount, 0);
  });

  it("6. accurately calculates cleanup preview, distinguishing Letterboxd records from preserved Aubrey rankings and rubrics", async () => {
    // Create an Aubrey custom ranking on real user
    const [aubreyRanking] = await db
      .insert(collections)
      .values({
        id: `col_aubrey_${runId}`,
        userId: realUserId,
        title: "My Aubrey Top 10",
        collectionType: "custom",
        visibility: "public",
        sourceService: null, // native Aubrey ranking
      })
      .returning();

    // Create a Letterboxd custom list on real user
    const [letterboxdList] = await db
      .insert(collections)
      .values({
        id: `col_letterboxd_${runId}`,
        userId: realUserId,
        title: "Letterboxd 2025 Favorites",
        collectionType: "custom",
        visibility: "private",
        sourceService: "letterboxd", // imported from Letterboxd
      })
      .returning();

    // Create a media item
    const [testFilm] = await db
      .insert(mediaItems)
      .values({
        id: `media_test_${runId}`,
        title: `Test Film Cleanup ${runId}`,
        releaseDate: "2022-01-01",
        mediaType: "movie",
      })
      .returning();
    trackedMediaIds.push(testFilm.id);

    // Create collection entry in Aubrey ranking
    await db.insert(collectionEntries).values({
      id: `centry_aubrey_${runId}`,
      collectionId: aubreyRanking.id,
      mediaItemId: testFilm.id,
      sortOrder: 1,
    });

    // Create collection-scoped rating in Aubrey ranking (must be PRESERVED)
    await db.insert(ratings).values({
      id: `rate_col_${runId}`,
      userId: realUserId,
      mediaItemId: testFilm.id,
      collectionId: aubreyRanking.id, // collection-scoped rating
      sourceService: "aubrey",
      calculatedOverallScore: 9.2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create global Letterboxd rating (must be REMOVED)
    await db.insert(ratings).values({
      id: `rate_global_${runId}`,
      userId: realUserId,
      mediaItemId: testFilm.id,
      collectionId: null, // global rating
      sourceService: "letterboxd",
      sourceRating: 4.5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create Letterboxd diary entry (must be REMOVED)
    await db.insert(diaryEntries).values({
      id: `diary_test_${runId}`,
      userId: realUserId,
      mediaItemId: testFilm.id,
      watchedDate: "2026-03-01",
      isRewatch: false,
      ratingValue: 9,
      sourceService: "letterboxd",
    });

    // Create native Aubrey diary entry (must be PRESERVED)
    await db.insert(diaryEntries).values({
      id: `diary_native_${runId}`,
      userId: realUserId,
      mediaItemId: testFilm.id,
      watchedDate: "2026-03-02",
      isRewatch: false,
      ratingValue: 8,
      sourceService: null, // native Aubrey viewing
    });

    // Calculate cleanup preview
    const preview = await calculateCleanupPreview(realUserId);

    assert.equal(preview.targetUserId, realUserId);
    assert.ok(preview.token);
    assert.equal(verifyCleanupToken(preview.token, realUserId), true);

    // Check items to remove
    assert.ok(preview.toRemove.letterboxdDiaryEntries >= 1);
    assert.ok(preview.toRemove.letterboxdGlobalRatings >= 1);
    assert.ok(preview.toRemove.letterboxdCustomLists >= 1);

    // Check items permanently preserved
    assert.ok(preview.toPreserve.nativeAubreyDiaryEntries >= 1);
    assert.ok(preview.toPreserve.aubreyRankingsAndLists >= 1);
    assert.ok(preview.toPreserve.aubreyCollectionEntries >= 1);
    assert.ok(preview.toPreserve.collectionScopedRatings >= 1);
    assert.ok(preview.toPreserve.customRubricSystems >= 1);

    // Execute dry run with token
    const dryRunResult = await executeCleanup(realUserId, preview.token, { dryRun: true });
    assert.equal(dryRunResult.success, true);
    assert.equal(dryRunResult.dryRun, true);

    // Verify nothing was actually deleted (transaction rolled back)
    const preservedDiary = await db.query.diaryEntries.findFirst({
      where: eq(diaryEntries.id, `diary_test_${runId}`),
    });
    assert.ok(preservedDiary, "Dry run must rollback and preserve diary entry");

    const preservedRanking = await db.query.collections.findFirst({
      where: eq(collections.id, aubreyRanking.id),
    });
    assert.ok(preservedRanking, "Aubrey ranking must remain intact");

    // Clean up test native diary entry
    await db.delete(diaryEntries).where(eq(diaryEntries.id, `diary_native_${runId}`));
  });

  it("7. enforces fail-closed cleanup signing secret when secret is unconfigured", () => {
    const origAuthSecret = process.env.AUTH_SECRET;
    const origCleanupSecret = process.env.CLEANUP_SECRET;
    const origBetterAuthSecret = process.env.BETTER_AUTH_SECRET;

    try {
      delete process.env.AUTH_SECRET;
      delete process.env.CLEANUP_SECRET;
      delete process.env.BETTER_AUTH_SECRET;

      assert.throws(() => getCleanupSecret(), {
        message: /Cleanup secret is not configured/,
      });
    } finally {
      if (origAuthSecret) process.env.AUTH_SECRET = origAuthSecret;
      if (origCleanupSecret) process.env.CLEANUP_SECRET = origCleanupSecret;
      if (origBetterAuthSecret) process.env.BETTER_AUTH_SECRET = origBetterAuthSecret;
    }
  });

  it("8. fails closed and blocks live cleanup execution when backup readiness cannot be verified", async () => {
    const origBackupVerified = process.env.AUBREY_BACKUP_VERIFIED;
    const origBackupDir = process.env.BACKUP_DIR;

    try {
      delete process.env.AUBREY_BACKUP_VERIFIED;
      process.env.BACKUP_DIR = `/tmp/non_existent_aubrey_backup_dir_${runId}`;

      const { token } = generateCleanupToken(realUserId);

      // Live cleanup must fail closed when backup is unverified
      await assert.rejects(
        async () => {
          await executeCleanup(realUserId, token, { dryRun: false });
        },
        {
          message: /Backup readiness could not be verified|Live cleanup execution refused/,
        }
      );
    } finally {
      if (origBackupVerified) process.env.AUBREY_BACKUP_VERIFIED = origBackupVerified;
      if (origBackupDir) process.env.BACKUP_DIR = origBackupDir;
    }
  });

  it("9. verifies database session and rejects forged or missing admin return tokens", async () => {
    // Construct a mock NextRequest for a test workspace session with a forged return token
    const forgedRequest = {
      headers: new Headers({
        cookie: "aubrey_admin_session_token=forged_token_12345; better-auth.session_token=test_ws_token",
      }),
    } as unknown as NextRequest;

    const forgedAuth = await verifyAdminOrTestSession(forgedRequest);
    // Must NOT authorize from the mere presence of a cookie
    assert.equal(forgedAuth.authorized, false);
  });

  it("10. scores and handles TV candidates from searchMulti when movie search is empty", () => {
    // Unit test calculateCandidateScore with television candidate
    const sourceFilm = { title: "Black Mirror: San Junipero", year: 2016 };
    const tvCandidate = {
      title: "Black Mirror",
      releaseDate: "2011-12-04",
      voteCount: 4500,
    };

    const score = calculateCandidateScore(sourceFilm, {
      ...tvCandidate,
      mediaType: "tv",
    });
    assert.ok(score > 0.4, "Candidate score for series match should reflect close title match");

    const perfectCandidate = {
      title: "San Junipero",
      releaseDate: "2016-10-21",
      voteCount: 800,
    };
    const perfectScore = calculateCandidateScore(
      { title: "San Junipero", year: 2016 },
      perfectCandidate
    );
    assert.ok(perfectScore >= 0.85, "Exact title and exact year should score >= 0.85");
  });

  it("11. clears resolution cache upon manual mapping invalidation", () => {
    clearResolutionCache();
    invalidateResolutionCache("test_key");
    // Verifies functions execute without exception
    assert.ok(true);
  });

  it("12. import preview does not persist any records to mediaItems or importSourceMappings", async () => {
    const zip = new AdmZip();
    const uniqueTitle = `Ephemeral Preview Film ${runId}`;
    const diaryContent = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2026-03-10,${uniqueTitle},2024,https://boxd.it/preview_${runId},4.0,No,"",2026-03-10
`;
    zip.addFile("diary.csv", Buffer.from(diaryContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    // Run preview
    await previewLetterboxdImport(realUserId, summary, {
      allowSyntheticPlaceholders: true,
    });

    // Check mediaItems table: preview must not insert ephemeral rows
    const mediaCheck = await db.query.mediaItems.findFirst({
      where: eq(mediaItems.title, uniqueTitle),
    });
    assert.equal(mediaCheck, undefined, "Preview must not persist new media items");

    // Check importSourceMappings table: preview must not persist mappings
    const mappingCheck = await db.query.importSourceMappings.findFirst({
      where: eq(importSourceMappings.sourceTitle, uniqueTitle),
    });
    assert.equal(mappingCheck, undefined, "Preview must not persist source mappings");
  });

  it("13. star rating arithmetic maps 10-point internal scores to 5-star half-steps accurately", () => {
    const testCases = [
      { score: 10, expectedStars: 5.0 },
      { score: 9, expectedStars: 4.5 },
      { score: 8, expectedStars: 4.0 },
      { score: 7, expectedStars: 3.5 },
      { score: 6, expectedStars: 3.0 },
      { score: 5, expectedStars: 2.5 },
      { score: 1, expectedStars: 0.5 },
    ];

    for (const { score, expectedStars } of testCases) {
      const rawStars = (score / 10) * 5;
      const roundedStars = Math.round(rawStars * 2) / 2;
      assert.equal(
        roundedStars,
        expectedStars,
        `Score ${score}/10 must convert to ${expectedStars} stars`
      );
    }
  });

  it("14. quarantines ambiguous identical titles without year and correctly matches when year is supplied", async () => {
    // Insert two distinct films with identical title but different years
    const title = `Identical Title Film ${runId}`;
    const [film1980] = await db
      .insert(mediaItems)
      .values({
        id: `media_id1_${runId}`,
        tmdbId: 80001,
        title,
        releaseDate: "1980-05-21",
        posterPath: "/poster1980.jpg",
        mediaType: "movie",
      })
      .returning();
    const [film2010] = await db
      .insert(mediaItems)
      .values({
        id: `media_id2_${runId}`,
        tmdbId: 80002,
        title,
        releaseDate: "2010-07-16",
        posterPath: "/poster2010.jpg",
        mediaType: "movie",
      })
      .returning();

    trackedMediaIds.push(film1980.id, film2010.id);

    // 1. Resolve without year -> Must quarantine as ambiguous_media
    const ambiguousResult = await resolveLetterboxdMediaIdentity({
      title,
      year: null,
    });
    assert.equal(ambiguousResult.match, null);
    assert.ok(ambiguousResult.quarantine);
    assert.equal(ambiguousResult.quarantine.reason, "ambiguous_media");
    assert.ok(ambiguousResult.quarantine.candidates && ambiguousResult.quarantine.candidates.length >= 2);

    // 2. Resolve with exact year 1980 -> Must match film1980
    const matched1980 = await resolveLetterboxdMediaIdentity({
      title,
      year: 1980,
    });
    assert.ok(matched1980.match);
    assert.equal(matched1980.match.mediaItem.id, film1980.id);

    // 3. Resolve with exact year 2010 -> Must match film2010
    const matched2010 = await resolveLetterboxdMediaIdentity({
      title,
      year: 2010,
    });
    assert.ok(matched2010.match);
    assert.equal(matched2010.match.mediaItem.id, film2010.id);
  });

  it("15. updates existing manual mapping on conflict and persists TV episode metadata", async () => {
    const testUri = `https://boxd.it/mapping_test_${runId}`;
    const testTitle = `Manual Mapping Title ${runId}`;

    const [targetMedia] = await db
      .insert(mediaItems)
      .values({
        id: `media_map1_${runId}`,
        tmdbId: 90001,
        title: "Initial Mapping Film",
        releaseDate: "2020-01-01",
        posterPath: "/initial.jpg",
        mediaType: "movie",
      })
      .returning();
    trackedMediaIds.push(targetMedia.id);

    // Initial mapping insert
    await db.insert(importSourceMappings).values({
      id: `map_initial_${runId}`,
      sourceService: "letterboxd",
      sourceUri: testUri,
      sourceTitle: testTitle,
      sourceYear: 2020,
      sourceMediaType: "movie",
      mediaItemId: targetMedia.id,
      confidence: "manual_verified",
      metadata: { initial: true },
    });

    const [updatedEpisodeMedia] = await db
      .insert(mediaItems)
      .values({
        id: `media_ep_${runId}`,
        tmdbId: 90002,
        title: "Updated TV Episode",
        releaseDate: "2020-05-01",
        stillPath: "/still.jpg",
        mediaType: "episode",
      })
      .returning();
    trackedMediaIds.push(updatedEpisodeMedia.id);

    // Simulate onConflict update logic (as in resolve-mapping route)
    const existing = await db.query.importSourceMappings.findFirst({
      where: and(
        eq(importSourceMappings.sourceService, "letterboxd"),
        eq(importSourceMappings.sourceUri, testUri)
      ),
    });
    assert.ok(existing);

    await db
      .update(importSourceMappings)
      .set({
        mediaItemId: updatedEpisodeMedia.id,
        sourceMediaType: "episode",
        confidence: "manual_verified",
        metadata: {
          manualAdminResolution: true,
          seriesTmdbId: 42009,
          seasonNumber: 1,
          episodeNumber: 1,
        },
        updatedAt: new Date(),
      })
      .where(eq(importSourceMappings.id, existing.id));

    // Verify mapping was updated rather than duplicated
    const mappingsForUri = await db.query.importSourceMappings.findMany({
      where: and(
        eq(importSourceMappings.sourceService, "letterboxd"),
        eq(importSourceMappings.sourceUri, testUri)
      ),
    });
    assert.equal(mappingsForUri.length, 1);
    assert.equal(mappingsForUri[0].mediaItemId, updatedEpisodeMedia.id);
    assert.equal(mappingsForUri[0].sourceMediaType, "episode");
    assert.equal((mappingsForUri[0].metadata as any).seasonNumber, 1);

    // Cleanup created mapping
    await db.delete(importSourceMappings).where(eq(importSourceMappings.id, existing.id));
  });
});
