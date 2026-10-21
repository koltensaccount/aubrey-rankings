import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import AdmZip from "adm-zip";
import { NextRequest } from "next/server";
import { auth } from "../lib/auth";
import { db } from "../db";
import {
  user,
  mediaItems,
  ratings,
  reviews,
  watchlistItems,
  diaryEntries,
  collections,
  collectionEntries,
  ratingSystems,
  ratingCategories,
  ratingTiers,
  unresolvedImportItems,
} from "../db/schema";
import { eq, and, or } from "drizzle-orm";
import { parseLetterboxdZip } from "../lib/letterboxd";
import {
  previewLetterboxdImport,
  executeLetterboxdImport,
} from "../lib/letterboxd-import";
import { GET as exportData } from "../app/api/data/export/route";
import {
  GET as getWatchlist,
  POST as postWatchlist,
  DELETE as deleteWatchlist,
} from "../app/api/watchlist/route";
import { GET as getDiary } from "../app/api/diary/route";

describe("Phase 14A: Personal Library Foundation & Letterboxd Importer", () => {
  const suffix = `${process.pid}_${Date.now()}`;
  const ownerEmail = `curator_p14a_${suffix}@example.com`;
  const visitorEmail = `visitor_p14a_${suffix}@example.com`;

  let ownerId = "";
  let visitorId = "";
  let ownerCookie = "";
  let visitorCookie = "";

  const trackedMediaIds: string[] = [];

  before(async () => {
    // 1. Create primary test user
    const ownerRes = await auth.api.signUpEmail({
      body: {
        name: "Library Curator",
        email: ownerEmail,
        password: "CuratorPassword123!",
      },
      asResponse: true,
    });
    assert.equal(ownerRes.status, 200);
    ownerCookie = ownerRes.headers.get("set-cookie") || "";
    const ownerAcc = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, ownerEmail),
    });
    assert.ok(ownerAcc);
    ownerId = ownerAcc.id;
    await db
      .update(user)
      .set({ username: `curator_${suffix}`, emailVerified: true })
      .where(eq(user.id, ownerId));

    // 2. Create visitor test user
    const visitorRes = await auth.api.signUpEmail({
      body: {
        name: "Library Visitor",
        email: visitorEmail,
        password: "VisitorPassword123!",
      },
      asResponse: true,
    });
    assert.equal(visitorRes.status, 200);
    visitorCookie = visitorRes.headers.get("set-cookie") || "";
    const visitorAcc = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, visitorEmail),
    });
    assert.ok(visitorAcc);
    visitorId = visitorAcc.id;
  });

  after(async () => {
    // Clean up created records
    if (ownerId) {
      await db.delete(unresolvedImportItems).where(eq(unresolvedImportItems.userId, ownerId));
      await db.delete(watchlistItems).where(eq(watchlistItems.userId, ownerId));
      await db.delete(diaryEntries).where(eq(diaryEntries.userId, ownerId));
      await db.delete(reviews).where(eq(reviews.userId, ownerId));
      await db.delete(ratings).where(eq(ratings.userId, ownerId));
      await db.delete(collections).where(eq(collections.userId, ownerId));
      await db.delete(ratingSystems).where(eq(ratingSystems.userId, ownerId));
      await db.delete(user).where(eq(user.id, ownerId));
    }
    if (visitorId) {
      await db.delete(user).where(eq(user.id, visitorId));
    }
    for (const mId of trackedMediaIds) {
      await db.delete(mediaItems).where(eq(mediaItems.id, mId));
    }
  });

  it("1. imports watched-only films without ratings or reviews into ratings table with isWatched=true", async () => {
    const zip = new AdmZip();
    const watchedContent = `Date,Name,Year,Letterboxd URI
2026-01-01,Watched Film One ${suffix},2021,https://boxd.it/test1
2026-01-02,Watched Film Two ${suffix},2022,https://boxd.it/test2
`;
    zip.addFile("watched.csv", Buffer.from(watchedContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    assert.equal(summary.totalWatched, 2);
    assert.equal(summary.totalRatings, 0);

    const result = await executeLetterboxdImport(ownerId, summary);
    assert.equal(result.newCount, 2);

    const importedRatings = await db.query.ratings.findMany({
      where: and(eq(ratings.userId, ownerId), eq(ratings.isWatched, true)),
      with: { mediaItem: true },
    });

    const f1 = importedRatings.find((r) => r.mediaItem.title.includes("Watched Film One"));
    assert.ok(f1);
    assert.equal(f1.sourceRating, null);
    assert.equal(f1.reviewText, null);
    assert.equal(f1.isWatched, true);
    trackedMediaIds.push(f1.mediaItemId);
  });

  it("2. imports reviews with and without ratings into first-class reviews with private visibility", async () => {
    const zip = new AdmZip();
    const reviewsContent = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date
2026-02-01,Reviewed Rated Film ${suffix},2020,https://boxd.it/rev1,4.5,No,"An astonishing emotional core.","cinematography",2026-02-01
2026-02-02,Reviewed Unrated Film ${suffix},2019,https://boxd.it/rev2,,No,"Quiet and contemplative without a star rating.","festival",2026-02-02
`;
    zip.addFile("reviews.csv", Buffer.from(reviewsContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    const result = await executeLetterboxdImport(ownerId, summary);
    assert.equal(result.newReviewsCount, 2);

    const userRevs = await db.query.reviews.findMany({
      where: eq(reviews.userId, ownerId),
      with: { mediaItem: true, rating: true },
    });

    const ratedRev = userRevs.find((r) => r.mediaItem.title.includes("Reviewed Rated Film"));
    assert.ok(ratedRev);
    assert.equal(ratedRev.content, "An astonishing emotional core.");
    assert.equal(ratedRev.status, "published");
    assert.equal(ratedRev.visibility, "private"); // must remain private
    assert.equal(ratedRev.isJournal, true);
    assert.ok(ratedRev.ratingId);
    assert.equal(ratedRev.rating?.sourceRating, 4.5);
    trackedMediaIds.push(ratedRev.mediaItemId);

    const unratedRev = userRevs.find((r) => r.mediaItem.title.includes("Reviewed Unrated Film"));
    assert.ok(unratedRev);
    assert.equal(unratedRev.content, "Quiet and contemplative without a star rating.");
    assert.equal(unratedRev.visibility, "private");
    trackedMediaIds.push(unratedRev.mediaItemId);
  });

  it("3. handles repeated viewings and rewatches of one film without collapsing diary events", async () => {
    const zip = new AdmZip();
    const diaryContent = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2026-01-10,Repeated Viewing ${suffix},2015,https://boxd.it/repeat1,4.0,No,"cinema",2026-01-10
2026-03-15,Repeated Viewing ${suffix},2015,https://boxd.it/repeat2,4.5,Yes,"rewatch, 35mm",2026-03-15
2026-05-20,Repeated Viewing ${suffix},2015,https://boxd.it/repeat3,5.0,Yes,"imax",2026-05-20
`;
    zip.addFile("diary.csv", Buffer.from(diaryContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    assert.equal(summary.totalDiaryEntries, 3);
    assert.equal(summary.totalUniqueFilms, 1);

    const result = await executeLetterboxdImport(ownerId, summary);
    assert.equal(result.newDiaryCount, 3);

    const userDiary = await db.query.diaryEntries.findMany({
      where: eq(diaryEntries.userId, ownerId),
      with: { mediaItem: true },
    });

    const repeatedEntries = userDiary.filter((d) => d.mediaItem.title.includes("Repeated Viewing"));
    assert.equal(repeatedEntries.length, 3);

    // Verify rewatch flags and exact dates are preserved
    const rewatchEntries = repeatedEntries.filter((d) => d.isRewatch);
    assert.equal(rewatchEntries.length, 2);
    assert.ok(repeatedEntries.some((d) => d.watchedDate === "2026-01-10" && !d.isRewatch));
    assert.ok(repeatedEntries.some((d) => d.watchedDate === "2026-03-15" && d.isRewatch));
    assert.ok(repeatedEntries.some((d) => d.watchedDate === "2026-05-20" && d.isRewatch));

    trackedMediaIds.push(repeatedEntries[0].mediaItemId);
  });

  it("4. imports watchlist items into watchlist_items with exact date added", async () => {
    const zip = new AdmZip();
    const watchlistContent = `Date,Name,Year,Letterboxd URI
2025-11-20,Watchlist Item One ${suffix},2023,https://boxd.it/wl1
2025-12-15,Watchlist Item Two ${suffix},2024,https://boxd.it/wl2
`;
    zip.addFile("watchlist.csv", Buffer.from(watchlistContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    assert.equal(summary.totalWatchlistItems, 2);

    const result = await executeLetterboxdImport(ownerId, summary);
    assert.equal(result.newWatchlistCount, 2);

    const userWl = await db.query.watchlistItems.findMany({
      where: eq(watchlistItems.userId, ownerId),
      with: { mediaItem: true },
    });

    const w1 = userWl.find((w) => w.mediaItem.title.includes("Watchlist Item One"));
    assert.ok(w1);
    assert.equal(w1.createdAt.toISOString().slice(0, 10), "2025-11-20");
    trackedMediaIds.push(w1.mediaItemId);
  });

  it("5. imports custom lists with entry ordering, notes, and private visibility", async () => {
    const zip = new AdmZip();
    const listContent = `Date,Name,Tags,URL,Description
2026-01-01,My Top Sci-Fi ${suffix},"sci-fi, classics",https://letterboxd.com/curator/list/top-scifi/,"The defining science fiction masterworks"

Position,Name,Year,URL,Description
1,List Movie Alpha ${suffix},1982,https://boxd.it/alpha,"A groundbreaking cyberpunk vision"
2,List Movie Beta ${suffix},1999,https://boxd.it/beta,"A reality-bending classic"
`;
    zip.addFile(`lists/my-top-scifi-${suffix}.csv`, Buffer.from(listContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    assert.equal(summary.totalCustomLists, 1);
    assert.equal(summary.totalCustomListEntries, 2);

    const result = await executeLetterboxdImport(ownerId, summary);
    assert.equal(result.newListsCount, 1);

    const userCol = await db.query.collections.findFirst({
      where: and(eq(collections.userId, ownerId), eq(collections.title, `My Top Sci-Fi ${suffix}`)),
      with: {
        entries: {
          with: { mediaItem: true },
          orderBy: (entry, { asc }) => [asc(entry.sortOrder)],
        },
      },
    });

    assert.ok(userCol);
    assert.equal(userCol.collectionType, "custom");
    assert.equal(userCol.isRanked, false); // distinct from weighted rankings
    assert.equal(userCol.visibility, "private"); // private by default
    assert.equal(userCol.description, "The defining science fiction masterworks");
    assert.equal(userCol.entries.length, 2);
    assert.equal(userCol.entries[0].sortOrder, 1);
    assert.equal(userCol.entries[0].notes, "A groundbreaking cyberpunk vision");
    assert.equal(userCol.entries[1].sortOrder, 2);
    assert.equal(userCol.entries[1].notes, "A reality-bending classic");

    for (const e of userCol.entries) {
      trackedMediaIds.push(e.mediaItemId);
    }
  });

  it("6. preserves likes/favorites and tags from Letterboxd", async () => {
    const zip = new AdmZip();
    const ratingsContent = `Date,Name,Year,Letterboxd URI,Rating
2026-01-01,Liked Film ${suffix},2022,https://boxd.it/liked1,5.0
`;
    const likesContent = `Date,Name,Year,Letterboxd URI
2026-01-01,Liked Film ${suffix},2022,https://boxd.it/liked1
`;
    zip.addFile("ratings.csv", Buffer.from(ratingsContent, "utf8"));
    zip.addFile("likes/films.csv", Buffer.from(likesContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    assert.equal(summary.likedFilms.length, 1);
    const film = summary.films.find((f) => f.title.includes("Liked Film"));
    assert.ok(film);
    assert.equal(film.isFavorite, true);

    await executeLetterboxdImport(ownerId, summary);

    const savedRating = await db.query.ratings.findFirst({
      where: and(eq(ratings.userId, ownerId), eq(ratings.isFavorite, true)),
      with: { mediaItem: true },
    });

    assert.ok(savedRating);
    assert.equal(savedRating.isFavorite, true);
    trackedMediaIds.push(savedRating.mediaItemId);
  });

  it("7. keeps remakes and identically-named films separate based on year", async () => {
    const zip = new AdmZip();
    const ratingsContent = `Date,Name,Year,Letterboxd URI,Rating
2026-01-01,Solaris Remake ${suffix},1972,https://boxd.it/solaris-1972,5.0
2026-01-01,Solaris Remake ${suffix},2002,https://boxd.it/solaris-2002,4.0
`;
    zip.addFile("ratings.csv", Buffer.from(ratingsContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    assert.equal(summary.totalUniqueFilms, 2);

    await executeLetterboxdImport(ownerId, summary);

    const remakes = await db.query.ratings.findMany({
      where: eq(ratings.userId, ownerId),
      with: { mediaItem: true },
    });

    const matchingRemakes = remakes.filter((r) => r.mediaItem.title.includes("Solaris Remake"));
    assert.equal(matchingRemakes.length, 2);
    assert.notEqual(matchingRemakes[0].mediaItemId, matchingRemakes[1].mediaItemId);

    const years = matchingRemakes.map((r) => r.mediaItem.releaseDate?.slice(0, 4)).sort();
    assert.deepEqual(years, ["1972", "2002"]);

    for (const r of matchingRemakes) {
      trackedMediaIds.push(r.mediaItemId);
    }
  });

  it("8. is idempotent on re-importing the same ZIP archive", async () => {
    const zip = new AdmZip();
    const ratingsContent = `Date,Name,Year,Letterboxd URI,Rating
2026-01-01,Idempotent Film ${suffix},2023,https://boxd.it/idem1,4.5
`;
    const diaryContent = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2026-01-01,Idempotent Film ${suffix},2023,https://boxd.it/idem1,4.5,No,"idempotent",2026-01-01
`;
    zip.addFile("ratings.csv", Buffer.from(ratingsContent, "utf8"));
    zip.addFile("diary.csv", Buffer.from(diaryContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    // First import
    const res1 = await executeLetterboxdImport(ownerId, summary);
    assert.equal(res1.newCount, 1);
    assert.equal(res1.newDiaryCount, 1);

    // Second import of same data
    const res2 = await executeLetterboxdImport(ownerId, summary);
    assert.equal(res2.newCount, 0); // No new films created
    assert.equal(res2.newDiaryCount, 0); // No duplicate diary entries created
    assert.equal(res2.updatedCount, 1); // Safely re-verified
  });

  it("9. protects existing Aubrey edits from being overwritten by Letterboxd data", async () => {
    // 1. Create a media item and an Aubrey rating with custom score and notes
    const [media] = await db
      .insert(mediaItems)
      .values({
        id: `media_aubrey_edit_${suffix}`,
        title: `Aubrey Protected Title ${suffix}`,
        releaseDate: "2018-01-01",
        mediaType: "movie",
      })
      .returning();
    trackedMediaIds.push(media.id);

    const [existingAubreyRating] = await db
      .insert(ratings)
      .values({
        id: `rate_aubrey_edit_${suffix}`,
        userId: ownerId,
        mediaItemId: media.id,
        calculatedOverallScore: 9.8,
        personalNotes: "Aubrey manual notes that must not be deleted",
        isWatched: true,
      })
      .returning();

    // 2. Import Letterboxd archive containing the same film with a different rating
    const zip = new AdmZip();
    const ratingsContent = `Date,Name,Year,Letterboxd URI,Rating
2026-01-01,Aubrey Protected Title ${suffix},2018,https://boxd.it/prot,3.5
`;
    zip.addFile("ratings.csv", Buffer.from(ratingsContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    const result = await executeLetterboxdImport(ownerId, summary);
    assert.equal(result.preservedCount, 1);

    const ratingAfterImport = await db.query.ratings.findFirst({
      where: eq(ratings.id, existingAubreyRating.id),
    });

    assert.ok(ratingAfterImport);
    // Aubrey custom overall score and personal notes were completely preserved!
    assert.equal(ratingAfterImport.calculatedOverallScore, 9.8);
    assert.equal(ratingAfterImport.personalNotes, "Aubrey manual notes that must not be deleted");
    assert.equal(ratingAfterImport.isWatched, true);
    assert.equal(ratingAfterImport.letterboxdUri, "https://boxd.it/prot");
  });

  it("10. migrates legacy Letterboxd reviews from ratings.reviewText into first-class reviews", async () => {
    const [media] = await db
      .insert(mediaItems)
      .values({
        id: `media_legacy_${suffix}`,
        title: `Legacy Imported Film ${suffix}`,
        releaseDate: "2017-01-01",
        mediaType: "movie",
      })
      .returning();
    trackedMediaIds.push(media.id);

    await db.insert(ratings).values({
      id: `rate_legacy_${suffix}`,
      userId: ownerId,
      mediaItemId: media.id,
      sourceService: "letterboxd",
      sourceRating: 4.0,
      sourceScale: 5,
      letterboxdUri: "https://boxd.it/legacy",
      reviewText: "Pre-existing review written in legacy format.",
      isWatched: true,
    });

    // Execute import with dummy summary to trigger migration
    const zip = new AdmZip();
    zip.addFile("ratings.csv", Buffer.from("Name,Year,Letterboxd URI,Rating\n", "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());
    await executeLetterboxdImport(ownerId, summary);

    // Verify first-class review was created with private visibility
    const migratedReview = await db.query.reviews.findFirst({
      where: and(eq(reviews.userId, ownerId), eq(reviews.mediaItemId, media.id)),
    });

    assert.ok(migratedReview);
    assert.equal(migratedReview.content, "Pre-existing review written in legacy format.");
    assert.equal(migratedReview.status, "published");
    assert.equal(migratedReview.visibility, "private");
    assert.equal(migratedReview.isJournal, true);

    // Verify original source columns were preserved
    const ratingRecord = await db.query.ratings.findFirst({
      where: eq(ratings.id, `rate_legacy_${suffix}`),
    });
    assert.equal(ratingRecord?.reviewText, "Pre-existing review written in legacy format.");
  });

  it("11. keeps imported reviews private from visitor discovery and queries", async () => {
    const ownerRevs = await db.query.reviews.findMany({
      where: and(eq(reviews.userId, ownerId), eq(reviews.sourceService, "letterboxd")),
    });

    assert.ok(ownerRevs.length > 0);
    // Every imported review is private
    for (const rev of ownerRevs) {
      assert.equal(rev.visibility, "private");
    }

    // A query for public reviews by owner returns 0 of these private reviews
    const publicRevs = await db.query.reviews.findMany({
      where: and(
        eq(reviews.userId, ownerId),
        eq(reviews.status, "published"),
        eq(reviews.visibility, "public"),
      ),
    });

    assert.equal(publicRevs.length, 0);
  });

  it("12. tests watchlist API endpoints (GET, POST, DELETE)", async () => {
    const [media] = await db
      .insert(mediaItems)
      .values({
        id: `media_wl_api_${suffix}`,
        title: `Watchlist API Movie ${suffix}`,
        mediaType: "movie",
      })
      .returning();
    trackedMediaIds.push(media.id);

    // 1. Add to watchlist
    const addReq = new NextRequest("http://localhost:3000/api/watchlist", {
      method: "POST",
      headers: { cookie: ownerCookie, "content-type": "application/json" },
      body: JSON.stringify({ mediaItemId: media.id, notes: "Excited for this" }),
    });
    const addRes = await postWatchlist(addReq);
    assert.equal(addRes.status, 200);

    // 2. Fetch watchlist
    const getReq = new NextRequest("http://localhost:3000/api/watchlist", {
      headers: { cookie: ownerCookie },
    });
    const getRes = await getWatchlist(getReq);
    assert.equal(getRes.status, 200);
    const getJson = await getRes.json();
    assert.ok(getJson.items.some((i: any) => i.mediaItemId === media.id));

    // 3. Delete from watchlist
    const delReq = new NextRequest(`http://localhost:3000/api/watchlist?mediaItemId=${media.id}`, {
      method: "DELETE",
      headers: { cookie: ownerCookie },
    });
    const delRes = await deleteWatchlist(delReq);
    assert.equal(delRes.status, 200);

    // 4. Verify removal
    const getReq2 = new NextRequest("http://localhost:3000/api/watchlist", {
      headers: { cookie: ownerCookie },
    });
    const getJson2 = await (await getWatchlist(getReq2)).json();
    assert.equal(getJson2.items.some((i: any) => i.mediaItemId === media.id), false);
  });

  it("13. exports complete authenticated JSON archive and isolates secrets", async () => {
    const exportReq = new NextRequest("http://localhost:3000/api/data/export", {
      headers: { cookie: ownerCookie },
    });
    const exportRes = await exportData(exportReq);
    assert.equal(exportRes.status, 200);

    const json = await exportRes.json();
    assert.equal(json.aubreyExportVersion, "1.0.0");
    assert.ok(json.exportedAt);
    assert.ok(json.user);
    assert.equal(json.user.id, ownerId);

    // Ensure password and internal secrets are omitted
    assert.equal(json.user.password, undefined);
    assert.equal(json.user.token, undefined);

    // Verify sections exist and contain data
    assert.ok(Array.isArray(json.watched));
    assert.ok(Array.isArray(json.watchlist));
    assert.ok(Array.isArray(json.diary));
    assert.ok(Array.isArray(json.reviews));
    assert.ok(Array.isArray(json.ratings));
    assert.ok(Array.isArray(json.collections));
    assert.ok(json.provenance);

    // Unauthenticated request is rejected
    const unauthReq = new NextRequest("http://localhost:3000/api/data/export");
    const unauthRes = await exportData(unauthReq);
    assert.equal(unauthRes.status, 401);
  });

  it("14. transparent preview reports full breakdown and unsupported reasons", async () => {
    const zip = new AdmZip();
    const ratingsContent = `Date,Name,Year,Letterboxd URI,Rating
2026-01-01,Preview Film ${suffix},2020,https://boxd.it/prev1,4.0
2026-01-02,,2020,https://boxd.it/missing,4.0
`;
    zip.addFile("ratings.csv", Buffer.from(ratingsContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    const preview = await previewLetterboxdImport(ownerId, summary);
    assert.equal(preview.totalFilms, 1);
    assert.ok(preview.breakdown);
    assert.equal(preview.breakdown.films.new, 1);
    assert.ok(preview.unsupportedReasons.length > 0);
  });

  it("15. never attaches ambiguous films to arbitrary database matches and quarantines dependent records", async () => {
    // 1. Insert two pre-existing media items with the identical title and different years
    const [media1] = await db
      .insert(mediaItems)
      .values({
        id: `media_ambig_1_${suffix}`,
        title: `Ambiguous Mirage ${suffix}`,
        releaseDate: "1994-01-01",
        mediaType: "movie",
      })
      .returning();
    const [media2] = await db
      .insert(mediaItems)
      .values({
        id: `media_ambig_2_${suffix}`,
        title: `Ambiguous Mirage ${suffix}`,
        releaseDate: "2014-01-01",
        mediaType: "movie",
      })
      .returning();
    trackedMediaIds.push(media1.id, media2.id);

    // 2. Import Letterboxd archive containing a review and diary entry for "Ambiguous Mirage" with NO year specified
    const zip = new AdmZip();
    const diaryContent = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2026-03-01,Ambiguous Mirage ${suffix},,https://boxd.it/ambig_unresolved,4.0,No,"quarantine-test",2026-03-01
`;
    const reviewsContent = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date
2026-03-01,Ambiguous Mirage ${suffix},,https://boxd.it/ambig_unresolved,4.0,No,"Dependent review that must not attach arbitrarily.","quarantine-test",2026-03-01
`;
    zip.addFile("diary.csv", Buffer.from(diaryContent, "utf8"));
    zip.addFile("reviews.csv", Buffer.from(reviewsContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    const result = await executeLetterboxdImport(ownerId, summary);

    // Assert that the ambiguous film was NOT assigned arbitrarily
    assert.ok("unresolvedCount" in result && (result.unresolvedCount ?? 0) > 0);

    // Assert that neither media item was written to in reviews or diary entries
    const attachedReviews = await db.query.reviews.findMany({
      where: and(
        eq(reviews.userId, ownerId),
        or(eq(reviews.mediaItemId, media1.id), eq(reviews.mediaItemId, media2.id))
      ),
    });
    assert.equal(attachedReviews.length, 0);

    const attachedDiary = await db.query.diaryEntries.findMany({
      where: and(
        eq(diaryEntries.userId, ownerId),
        or(eq(diaryEntries.mediaItemId, media1.id), eq(diaryEntries.mediaItemId, media2.id))
      ),
    });
    assert.equal(attachedDiary.length, 0);

    // Assert records are safely quarantined in unresolved_import_items
    const quarantined = await db.query.unresolvedImportItems.findMany({
      where: eq(unresolvedImportItems.userId, ownerId),
    });
    const ambigQuarantined = quarantined.filter(
      (q) => JSON.stringify(q.sourceData).includes(`Ambiguous Mirage ${suffix}`)
    );
    assert.ok(ambigQuarantined.length >= 1);
  });

  it("16. preserves multiple diary events sharing the exact same film URI and is idempotent on re-import", async () => {
    const zip = new AdmZip();
    // 3 viewings with the exact same canonical film URI (as Letterboxd does for diary.csv)
    const diaryContent = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2026-01-01,Canonical Boxd Film ${suffix},2021,https://boxd.it/canonical_film,4.0,No,"fest",2026-01-01
2026-02-15,Canonical Boxd Film ${suffix},2021,https://boxd.it/canonical_film,4.5,Yes,"rewatch 1",2026-02-15
2026-03-30,Canonical Boxd Film ${suffix},2021,https://boxd.it/canonical_film,5.0,Yes,"rewatch 2",2026-03-30
`;
    zip.addFile("diary.csv", Buffer.from(diaryContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    assert.equal(summary.totalDiaryEntries, 3);
    assert.equal(summary.totalUniqueFilms, 1);

    // 1. Initial import creates all 3 diary events
    const res1 = await executeLetterboxdImport(ownerId, summary);
    assert.equal(res1.newDiaryCount, 3);

    const userDiary = await db.query.diaryEntries.findMany({
      where: eq(diaryEntries.userId, ownerId),
      with: { mediaItem: true },
    });
    const canonicalEntries = userDiary.filter((d) => d.mediaItem.title.includes("Canonical Boxd Film"));
    assert.equal(canonicalEntries.length, 3);
    trackedMediaIds.push(canonicalEntries[0].mediaItemId);

    // 2. Re-import of the exact same archive produces 0 new diary events (complete idempotency)
    const res2 = await executeLetterboxdImport(ownerId, summary);
    assert.equal(res2.newDiaryCount, 0);

    const userDiaryAfter = await db.query.diaryEntries.findMany({
      where: eq(diaryEntries.userId, ownerId),
      with: { mediaItem: true },
    });
    const canonicalEntriesAfter = userDiaryAfter.filter((d) => d.mediaItem.title.includes("Canonical Boxd Film"));
    assert.equal(canonicalEntriesAfter.length, 3);
  });

  it("17. enforces watched-state semantics (likes do not mark watched; watched.csv does not fabricate watchDate)", async () => {
    const zip = new AdmZip();
    // Film in likes/films.csv only
    const likesContent = `Date,Name,Year,Letterboxd URI
2026-01-01,Favorited Only Film ${suffix},2022,https://boxd.it/favonly
`;
    // Film in watched.csv with an activity date
    const watchedContent = `Date,Name,Year,Letterboxd URI
2026-02-01,Watched Logged Film ${suffix},2020,https://boxd.it/watchedlog
`;
    zip.addFile("likes/films.csv", Buffer.from(likesContent, "utf8"));
    zip.addFile("watched.csv", Buffer.from(watchedContent, "utf8"));
    const summary = parseLetterboxdZip(zip.toBuffer());

    await executeLetterboxdImport(ownerId, summary);

    const userRatings = await db.query.ratings.findMany({
      where: eq(ratings.userId, ownerId),
      with: { mediaItem: true },
    });

    // 1. Favorited only film must have isFavorite: true, isWatched: false, watchDate: null
    const favOnly = userRatings.find((r) => r.mediaItem.title.includes("Favorited Only Film"));
    assert.ok(favOnly);
    assert.equal(favOnly.isFavorite, true);
    assert.equal(favOnly.isWatched, false);
    assert.equal(favOnly.watchDate, null);
    trackedMediaIds.push(favOnly.mediaItemId);

    // 2. Watched film from watched.csv must have isWatched: true, but watchDate: null (activity date is not viewing date)
    const watchedFilm = userRatings.find((r) => r.mediaItem.title.includes("Watched Logged Film"));
    assert.ok(watchedFilm);
    assert.equal(watchedFilm.isWatched, true);
    assert.equal(watchedFilm.watchDate, null);
    trackedMediaIds.push(watchedFilm.mediaItemId);
  });

  it("18. detects and transparently reports unsupported files and social activity without data loss", async () => {
    const zip = new AdmZip();
    zip.addFile("comments.csv", Buffer.from("Date,URL,Comment\n2026-01-01,https://boxd.it/c1,\"Great list!\"\n", "utf8"));
    zip.addFile("orphans.csv", Buffer.from("Date,Name,Year,Letterboxd URI\n2026-01-01,Lost Film,1910,https://boxd.it/lost\n", "utf8"));
    zip.addFile("profile.csv", Buffer.from("Username,Given Name,Family Name\ncurator,Library,Curator\n", "utf8"));
    zip.addFile("likes/reviews.csv", Buffer.from("Date,Letterboxd URI\n2026-01-01,https://boxd.it/rev_external\n", "utf8"));
    zip.addFile("likes/lists.csv", Buffer.from("Date,Letterboxd URI\n2026-01-01,https://boxd.it/list_external\n", "utf8"));
    zip.addFile("ratings.csv", Buffer.from(`Date,Name,Year,Letterboxd URI,Rating\n2026-01-01,Normal Film ${suffix},2022,https://boxd.it/norm,4.0\n`, "utf8"));

    const summary = parseLetterboxdZip(zip.toBuffer());
    assert.ok(summary.unsupportedItems.length >= 5);

    const preview = await previewLetterboxdImport(ownerId, summary);
    assert.ok("unsupportedReasons" in preview && preview.unsupportedReasons);
    const reasons = preview.unsupportedReasons;
    assert.ok(reasons.length >= 5);
    assert.ok(reasons.some((r) => r.includes("comments.csv")));
    assert.ok(reasons.some((r) => r.includes("orphans.csv")));
    assert.ok(reasons.some((r) => r.includes("profile.csv")));
    assert.ok(reasons.some((r) => r.includes("likes/reviews.csv")));
    assert.ok(reasons.some((r) => r.includes("likes/lists.csv")));
  });

  it("19. exports complete archive including drafts, personal notes, share commentary, list settings, and custom rating systems", async () => {
    // 1. Create a custom rating system with a category and tier
    const [sys] = await db
      .insert(ratingSystems)
      .values({
        id: `sys_test_${suffix}`,
        userId: ownerId,
        name: `Custom System ${suffix}`,
        description: "Specialized scoring system",
        scale: 10,
        type: "numerical",
        isDefault: false,
      })
      .returning();

    await db.insert(ratingCategories).values({
      id: `cat_test_${suffix}`,
      ratingSystemId: sys.id,
      name: "Direction & Craft",
      weight: 1.5,
      sortOrder: 0,
      isRequired: true,
    });

    await db.insert(ratingTiers).values({
      id: `tier_test_${suffix}`,
      ratingSystemId: sys.id,
      name: "Masterpiece",
      color: "#FF4757",
      sortOrder: 0,
    });

    // 2. Create media and rating with personal notes and share commentary
    const [media] = await db
      .insert(mediaItems)
      .values({
        id: `media_export_rich_${suffix}`,
        title: `Rich Export Film ${suffix}`,
        releaseDate: "2021-05-01",
        mediaType: "movie",
      })
      .returning();
    trackedMediaIds.push(media.id);

    await db.insert(ratings).values({
      id: `rate_rich_${suffix}`,
      userId: ownerId,
      mediaItemId: media.id,
      calculatedOverallScore: 9.5,
      personalNotes: "Sensitive personal notes strictly for export backup",
      shareCommentary: true,
      ratingSystemId: sys.id,
      isWatched: true,
    });

    // 3. Create review with draft content
    await db.insert(reviews).values({
      id: `rev_rich_${suffix}`,
      userId: ownerId,
      mediaItemId: media.id,
      content: "Published review content.",
      draftContent: "Unpublished draft work in progress.",
      draftContentFormat: "markdown",
      status: "draft",
      visibility: "private",
      isJournal: true,
      shareRating: true,
    });

    // 4. Create collection with specific settings
    await db.insert(collections).values({
      id: `col_rich_${suffix}`,
      userId: ownerId,
      title: `Curated Special Collection ${suffix}`,
      collectionType: "custom",
      isRanked: false,
      visibility: "unlisted",
      isPublic: true,
      isPinned: true,
      allowComments: false,
    });

    // 5. Invoke export
    const exportReq = new NextRequest("http://localhost:3000/api/data/export", {
      headers: { cookie: ownerCookie },
    });
    const res = await exportData(exportReq);
    assert.equal(res.status, 200);
    const json = await res.json();

    // Verify ratingSystems section
    assert.ok(Array.isArray(json.ratingSystems));
    const exportedSys = json.ratingSystems.find((s: any) => s.id === sys.id);
    assert.ok(exportedSys);
    assert.equal(exportedSys.name, `Custom System ${suffix}`);
    assert.equal(exportedSys.categories.length, 1);
    assert.equal(exportedSys.categories[0].name, "Direction & Craft");
    assert.equal(exportedSys.categories[0].weight, 1.5);
    assert.equal(exportedSys.tiers.length, 1);
    assert.equal(exportedSys.tiers[0].name, "Masterpiece");

    // Verify review draft fields
    const exportedRev = json.reviews.find((r: any) => r.id === `rev_rich_${suffix}`);
    assert.ok(exportedRev);
    assert.equal(exportedRev.draftContent, "Unpublished draft work in progress.");
    assert.equal(exportedRev.draftContentFormat, "markdown");
    assert.equal(exportedRev.shareRating, true);

    // Verify rating personal notes and commentary
    const exportedRating = json.ratings.find((r: any) => r.id === `rate_rich_${suffix}`);
    assert.ok(exportedRating);
    assert.equal(exportedRating.personalNotes, "Sensitive personal notes strictly for export backup");
    assert.equal(exportedRating.shareCommentary, true);
    assert.equal(exportedRating.ratingSystemId, sys.id);

    // Verify collection settings
    const exportedCol = json.collections.find((c: any) => c.id === `col_rich_${suffix}`);
    assert.ok(exportedCol);
    assert.equal(exportedCol.isRanked, false);
    assert.equal(exportedCol.visibility, "unlisted");
    assert.equal(exportedCol.isPinned, true);
    assert.equal(exportedCol.allowComments, false);
  });
});
