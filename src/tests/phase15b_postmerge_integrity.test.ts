import assert from "node:assert/strict";
import { before, after, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import AdmZip from "adm-zip";
import { viewingSaveTarget } from "../lib/viewing-request";

// Guard before importing any database/auth modules.
const url = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "postgresql://localhost/invalid");
if (process.env.AUBREY_TEST_MODE !== "1" || !["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.includes("test")) throw new Error("Requires explicit disposable loopback test database");
process.env.DATABASE_URL = url.toString();
describe("Phase 15B corrective persistence and endpoint regressions", async () => {
const { db, pool } = await import("../db");
const { auth } = await import("../lib/auth");
const schema = await import("../db/schema");
const { eq, and } = await import("drizzle-orm");
const { POST: createViewing } = await import("../app/api/diary/route");
const { PATCH: editViewing, DELETE: deleteViewing } = await import("../app/api/diary/[id]/route");
const { PUT: saveNotes, GET: readNotes } = await import("../app/api/notes/route");
const { GET: readCollection } = await import("../app/api/collections/[id]/route");
const { PATCH: editEntry } = await import("../app/api/collections/[id]/entries/[entryId]/route");
const { POST: saveRating } = await import("../app/api/ratings/route");
const { POST: createReview } = await import("../app/api/reviews/route");
const { GET: readReview, PATCH: editReview } = await import("../app/api/reviews/[id]/route");
const { POST: saveJournal } = await import("../app/api/journal/route");
const { parseLetterboxdZip } = await import("../lib/letterboxd");
const { executeLetterboxdImport } = await import("../lib/letterboxd-import");
const { getUserUnifiedTimeline, backfillUserActivityEvents } = await import("../lib/timeline-activity");
const { latestDatedRatedReview, personalReviewScore } = await import("../lib/review-rating");


  const suffix = randomUUID();
  const mediaId = `postmerge_${suffix}`;
  const colId = `col_${suffix}`;
  const entryId = `entry_${suffix}`;
  let ownerId = "";
  let cookie = "";
  let otherCookie = "";
  let otherId = "";
  const req = (path: string, method = "GET", body?: unknown, identity = cookie) => new NextRequest(`http://localhost:3000${path}`, { method, headers: { "content-type": "application/json", ...(identity ? { cookie: identity } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  before(async () => {
    for (const other of [false, true]) {
      const email = `corrective_${other}_${suffix}@example.com`;
      const response = await auth.api.signUpEmail({ body: { email, password: "Password123!@#", name: "Corrective Test" }, asResponse: true });
      assert.equal(response.status, 200);
      const account = await db.query.user.findFirst({ where: eq(schema.user.email, email) });
      assert.ok(account);
      if (other) { otherCookie = response.headers.get("set-cookie")!; otherId = account.id; }
      else { cookie = response.headers.get("set-cookie")!; ownerId = account.id; }
    }
    await db.insert(schema.mediaItems).values({ id: mediaId, title: `Corrective ${suffix}`, mediaType: "movie", releaseDate: "2001-01-01" });
    await db.insert(schema.collections).values({ id: colId, title: "Corrective ranking", userId: ownerId, visibility: "public", isPublic: true, collectionType: "ranked" });
    await db.insert(schema.collectionEntries).values({ id: entryId, collectionId: colId, mediaItemId: mediaId, sortOrder: 1, notes: "Historical ranking passage", shareNotes: true });
  });
  after(async () => {
    await db.delete(schema.user).where(eq(schema.user.id, ownerId));
    await db.delete(schema.user).where(eq(schema.user.id, otherId));
    await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, mediaId));
    await pool.end();
  });

  it("edits a UUID viewing twice without changing identity, and deletion preserves linked review", async () => {
    const response = await createViewing(req("/api/diary", "POST", { mediaItemId: mediaId, watchedDate: "2020-02-29", ratingValue: 7 }));
    assert.equal(response.status, 201);
    const { entry } = await response.json();
    assert.match(entry.id, /^[0-9a-f-]{36}$/);
    const reviewResponse = await createReview(req("/api/reviews", "POST", { mediaItemId: mediaId, content: "Viewing-linked review", status: "published", visibility: "private", viewingId: entry.id, ratingValue: 9 }));
    assert.equal(reviewResponse.status, 201);
    const { review } = await reviewResponse.json();
    for (const ratingValue of [8, 6]) {
      const target = viewingSaveTarget(entry);
      assert.equal(target.method, "PATCH");
      assert.equal((await editViewing(req(target.url, target.method, { watchedDate: "2020-03-01", ratingValue, isRewatch: true }), ctx(entry.id))).status, 200);
    }
    const viewings = await db.query.diaryEntries.findMany({ where: eq(schema.diaryEntries.userId, ownerId) });
    assert.equal(viewings.length, 1);
    assert.equal(viewings[0].id, entry.id);
    assert.equal(viewings[0].ratingValue, 6);
    const events = await db.query.activityEvents.findMany({ where: and(eq(schema.activityEvents.diaryEntryId, entry.id), eq(schema.activityEvents.eventType, "viewing")) });
    assert.equal(events.length, 1);
    assert.equal(events[0].eventDate, "2020-03-01");
    assert.equal(events[0].isRewatch, true);
    assert.equal((await editViewing(req("/api/diary/missing", "PATCH", { watchedDate: "2020-01-01" }), ctx(randomUUID()))).status, 404);
    assert.equal((await editViewing(req(`/api/diary/${entry.id}`, "PATCH", { watchedDate: "2020-02-30" }), ctx(entry.id))).status, 400);
    assert.equal((await editViewing(req(`/api/diary/${entry.id}`, "PATCH", { ratingValue: 1 }, otherCookie), ctx(entry.id))).status, 404);
    assert.equal((await deleteViewing(req(`/api/diary/${entry.id}`, "DELETE"), ctx(entry.id))).status, 200);
    assert.ok(await db.query.reviews.findFirst({ where: eq(schema.reviews.id, review.id) }));
    const timeline = await getUserUnifiedTimeline(ownerId);
    assert.ok(timeline.entries.some((r) => r.reviewId === review.id));
    assert.ok(!timeline.entries.some((r) => r.diaryEntryId === entry.id));
  });

  it("Notes edit/read/clear respects canonical tombstones, legacy text and visitor privacy", async () => {
    const entryCtx = { params: Promise.resolve({ id: colId, entryId }) };
    const legacyOnly = await (await readCollection(req(`/api/collections/${colId}`), ctx(colId))).json();
    assert.equal(legacyOnly.collection.entries[0].notes, null);
    assert.equal(legacyOnly.collection.entries[0].legacyNote, "Historical ranking passage");
    assert.equal((await saveNotes(req("/api/notes", "PUT", { mediaItemId: mediaId, content: "Current private thought" }))).status, 200);
    let owner = await (await readCollection(req(`/api/collections/${colId}`), ctx(colId))).json();
    assert.equal(owner.collection.entries[0].universalNote, "Current private thought");
    assert.equal(owner.collection.entries[0].legacyNote, "Historical ranking passage");
    await editEntry(req("/api/collections/entry", "PATCH", { shareNotes: false }), entryCtx);
    for (const identity of ["", otherCookie]) {
      const visitor = await (await readCollection(req(`/api/collections/${colId}`, "GET", undefined, identity), ctx(colId))).json();
      assert.equal(visitor.collection.entries[0].notes, null);
      assert.equal(visitor.collection.entries[0].universalNote, null);
      assert.equal(visitor.collection.entries[0].legacyNote, null);
      assert.ok(!JSON.stringify(visitor).includes("Current private thought"));
    }
    await editEntry(req("/api/collections/entry", "PATCH", { notes: "Edited from ranking", shareNotes: true }), entryCtx);
    assert.equal((await (await readNotes(req(`/api/notes?mediaItemId=${mediaId}`))).json()).notes, "Edited from ranking");
    await saveNotes(req("/api/notes", "PUT", { mediaItemId: mediaId, content: "" }));
    assert.equal((await (await readNotes(req(`/api/notes?mediaItemId=${mediaId}`))).json()).notes, "");
    for (const identity of ["", otherCookie, cookie]) {
      const visitor = await (await readCollection(req(`/api/collections/${colId}`, "GET", undefined, identity), ctx(colId))).json();
      assert.ok(!visitor.collection.entries[0].notes);
    }
    assert.equal((await db.query.collectionEntries.findFirst({ where: eq(schema.collectionEntries.id, entryId) }))?.notes, "Historical ranking passage");
    await editEntry(req("/api/collections/entry", "PATCH", { notes: "Again" }), entryCtx);
    await editEntry(req("/api/collections/entry", "PATCH", { notes: "" }), entryCtx);
    assert.equal((await (await readNotes(req(`/api/notes?mediaItemId=${mediaId}`))).json()).notes, "");
    await db.update(schema.ratings).set({ personalNotes: "Distinct legacy rating note", reviewText: "Distinct legacy commentary" }).where(and(eq(schema.ratings.userId, ownerId), eq(schema.ratings.mediaItemId, mediaId)));
    for (const personalNotes of ["From rating editor", ""]) {
      assert.equal((await saveRating(req("/api/ratings", "POST", { mediaItemId: mediaId, personalNotes }))).status, 200);
      assert.equal((await (await readNotes(req(`/api/notes?mediaItemId=${mediaId}`))).json()).notes, personalNotes);
    }
    const legacy = await db.query.ratings.findFirst({ where: eq(schema.ratings.userId, ownerId) });
    assert.equal(legacy?.personalNotes, "Distinct legacy rating note");
    assert.equal(legacy?.reviewText, "Distinct legacy commentary");
  });

  it("new reviews have new IDs; editing an old review and adding an unrated review preserve latest genuinely dated score", async () => {
    const created: Array<{ id: string }> = [];
    for (const ratingValue of [5, 8, null]) {
      const response = await createReview(req("/api/reviews", "POST", { mediaItemId: mediaId, content: `Review ${ratingValue}`, status: "published", visibility: "private", ratingValue }));
      assert.equal(response.status, 201);
      created.push((await response.json()).review);
    }
    for (let i = 0; i < created.length; i++) await db.update(schema.reviews).set({ publishedAt: new Date(`202${i}-01-01`) }).where(eq(schema.reviews.id, created[i].id));
    await editReview(req(`/api/reviews/${created[0].id}`, "PATCH", { content: "Edited much later", ratingValue: 7 }), ctx(created[0].id));
    const persisted = await db.query.reviews.findMany({ where: eq(schema.reviews.userId, ownerId) });
    const subset = persisted.filter((r) => created.some((c) => c.id === r.id));
    assert.equal(latestDatedRatedReview(subset)?.id, created[1].id);
    assert.equal(personalReviewScore({ sourceRating: 3, sourceScale: 4 }), 7.5);
    const legacyIds = [];
    for (const content of ["First legacy authoring", "Second legacy authoring"]) {
      const result = await saveJournal(req("/api/journal", "POST", { mediaItemId: mediaId, review: { content, status: "published", visibility: "private" } }));
      assert.equal(result.status, 200);
      legacyIds.push((await result.json()).review.id);
    }
    assert.notEqual(legacyIds[0], legacyIds[1]);
    const draftResponse = await createReview(req("/api/reviews", "POST", { mediaItemId: mediaId, content: "Private draft", status: "draft", visibility: "private", sourceRating: 3.5, sourceScale: 5 }));
    assert.equal(draftResponse.status, 201);
    const draft = (await draftResponse.json()).review;
    assert.equal(draft.ratingValue, 7);
    assert.ok(!(await getUserUnifiedTimeline(ownerId)).entries.some((e) => e.reviewId === draft.id));
    assert.equal((await editReview(req(`/api/reviews/${draft.id}`, "PATCH", { status: "published" }), ctx(draft.id))).status, 200);
    assert.ok((await getUserUnifiedTimeline(ownerId)).entries.some((e) => e.reviewId === draft.id));
    assert.equal((await editReview(req(`/api/reviews/${draft.id}`, "PATCH", { ratingValue: 99 }), ctx(draft.id))).status, 400);
    assert.equal((await editReview(req(`/api/reviews/${draft.id}`, "PATCH", { ratingValue: null }), ctx(draft.id))).status, 200);
    const cleared = await db.query.reviews.findFirst({ where: eq(schema.reviews.id, draft.id) });
    assert.equal(personalReviewScore(cleared!), null);

  });

  it("imports several same-film reviews and same-day duplicates from a real ZIP; reruns preserve IDs, native edits, privacy and source dates", async () => {
    const uri = `https://letterboxd.com/film/corrective-${suffix}/`;
    await db.insert(schema.importSourceMappings).values({ id: `map_${suffix}`, sourceService: "letterboxd", sourceUri: uri, sourceTitle: `Corrective ${suffix}`, sourceYear: 2001, mediaItemId: mediaId, confidence: "manual" });
    const zip = new AdmZip();
    const header = "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Watched Date,Tags\n";
    const row = (date: string, rating: string, content: string, watched: string) => `${date},Corrective ${suffix},2001,${uri},${rating},Yes,${content},${watched},\n`;
    zip.addFile("reviews.csv", Buffer.from(header + row("2019-01-02", "3.5", "Original", "2019-01-01") + row("2021-01-01", "4.5", "Rewatch", "2021-01-01") + row("2021-01-01", "2.5", "Same day other", "2021-01-01") + row("2021-01-01", "2.5", "Same day other", "2021-01-01") + row("", "", "Undated", "")));
    zip.addFile("diary.csv", Buffer.from("Date,Name,Year,Letterboxd URI,Rating,Rewatch,Watched Date\n" + `2019-01-02,Corrective ${suffix},2001,${uri},3.5,No,2019-01-01\n`));
    zip.addFile("ratings.csv", Buffer.from(`Date,Name,Year,Letterboxd URI,Rating\n2018-01-01,Corrective ${suffix},2001,${uri},4\n`));
    zip.addFile("watched.csv", Buffer.from(`Date,Name,Year,Letterboxd URI\n2017-01-01,Corrective ${suffix},2001,${uri}\n`));
    zip.addFile("watchlist.csv", Buffer.from(`Date,Name,Year,Letterboxd URI\n,Corrective ${suffix},2001,${uri}\n`));
    const parsed = parseLetterboxdZip(zip.toBuffer());
    assert.equal(parsed.reviews.length, 5);
    assert.equal(new Set(parsed.reviews.map((r) => r.sourceEventKey)).size, 5);
    assert.ok(parsed.reviews.every((r) => (r.sourceEventKey?.length ?? 0) < 100));
    await executeLetterboxdImport(ownerId, parsed);
    const imported = await db.query.reviews.findMany({ where: and(eq(schema.reviews.userId, ownerId), eq(schema.reviews.sourceService, "letterboxd")) });
    assert.equal(imported.length, 5);
    const ids = imported.map((r) => r.id).sort();
    const importedViewing = await db.query.diaryEntries.findFirst({ where: and(eq(schema.diaryEntries.userId, ownerId), eq(schema.diaryEntries.sourceService, "letterboxd")) });
    assert.ok(importedViewing);
    await editViewing(req(`/api/diary/${importedViewing.id}`, "PATCH", { ratingValue: 4 }), ctx(importedViewing.id));
    const first = imported.find((r) => r.content === "Original")!;
    await db.update(schema.reviews).set({ content: "Native edited writing", ratingValue: 6, visibility: "unlisted" }).where(eq(schema.reviews.id, first.id));
    await executeLetterboxdImport(ownerId, parseLetterboxdZip(zip.toBuffer()));
    await executeLetterboxdImport(ownerId, parseLetterboxdZip(zip.toBuffer()));
    const again = await db.query.reviews.findMany({ where: and(eq(schema.reviews.userId, ownerId), eq(schema.reviews.sourceService, "letterboxd")) });
    assert.deepEqual(again.map((r) => r.id).sort(), ids);
    assert.equal((await db.query.diaryEntries.findFirst({ where: eq(schema.diaryEntries.id, importedViewing.id) }))?.ratingValue, 4);
    const edited = again.find((r) => r.id === first.id)!;
    assert.equal(edited.content, "Native edited writing");
    assert.equal(edited.ratingValue, 6);
    assert.equal(edited.visibility, "unlisted");
    assert.equal(edited.sourceReviewDate, "2019-01-02");
    assert.equal((await (await readReview(req(`/api/reviews/${edited.id}`), ctx(edited.id))).json()).review.publishedAt, "2019-01-02");
    assert.equal(again.find((r) => r.content === "Undated")?.sourceReviewDate, null);
    const timeline = await getUserUnifiedTimeline(ownerId);
    assert.ok(timeline.entries.some((r) => r.eventType === "rating" && r.eventDate === "2018-01-01"));
    assert.ok(timeline.entries.some((r) => r.eventType === "watched_mark" && r.eventDate === "2017-01-01"));
    assert.ok(timeline.undatedEntries.some((r) => r.eventType === "watchlist"));
    assert.ok(timeline.entries.some((r) => r.eventType === "viewing" && r.eventDate === "2019-01-01"));
    assert.ok(timeline.entries.some((r) => r.reviewId === first.id && r.eventDate === "2019-01-02"));
    const before = await db.query.activityEvents.findMany({ where: eq(schema.activityEvents.userId, ownerId) });
    await getUserUnifiedTimeline(ownerId);
    const after = await db.query.activityEvents.findMany({ where: eq(schema.activityEvents.userId, ownerId) });
    assert.deepEqual(after, before, "Timeline reads must not mutate persistence");
    await backfillUserActivityEvents(ownerId);
    await backfillUserActivityEvents(ownerId);
    assert.equal((await db.query.activityEvents.findMany({ where: eq(schema.activityEvents.userId, ownerId) })).length, after.length);
  });

  it("quarantines ambiguous legacy review matches idempotently and recovers dates only from an exact source match", async () => {
    const uid = `legacy_${suffix}`;
    const rid = `legacy_review_${suffix}`;
    const uri = `https://letterboxd.com/film/corrective-${suffix}/`;
    await db.insert(schema.user).values({ id: uid, name: "Legacy history", email: `${uid}@example.com` });
    try {
      await db.insert(schema.reviews).values({ id: rid, userId: uid, mediaItemId: mediaId, sourceService: "letterboxd", sourceUri: uri, watchedDate: "2000-01-01", publishedAt: new Date("2000-01-01"), status: "published", visibility: "private", content: "Native edited legacy passage", ratingValue: 9 });
      const archive = (content: string) => {
        const zip = new AdmZip();
        zip.addFile("reviews.csv", Buffer.from(`Date,Name,Year,Letterboxd URI,Review,Watched Date\n2020-02-02,Corrective ${suffix},2001,${uri},${content},2000-01-01\n`));
        return parseLetterboxdZip(zip.toBuffer());
      };
      for (let i = 0; i < 2; i++) await executeLetterboxdImport(uid, archive("Original different source passage"));
      assert.equal((await db.query.reviews.findMany({ where: eq(schema.reviews.userId, uid) })).length, 1);
      assert.equal((await db.query.unresolvedImportItems.findMany({ where: eq(schema.unresolvedImportItems.userId, uid) })).length, 1);
      const unknown = await getUserUnifiedTimeline(uid);
      assert.equal(unknown.entries.length, 0);
      assert.equal(unknown.undatedEntries[0].reviewId, rid);
      assert.equal(latestDatedRatedReview(await db.query.reviews.findMany({ where: eq(schema.reviews.userId, uid) })), undefined);
      await executeLetterboxdImport(uid, archive("Native edited legacy passage"));
      const recovered = await db.query.reviews.findFirst({ where: eq(schema.reviews.id, rid) });
      assert.equal(recovered?.sourceReviewDate, "2020-02-02");
      assert.equal(recovered?.ratingValue, 9);
      assert.equal(recovered?.visibility, "private");
      assert.equal((await getUserUnifiedTimeline(uid)).entries[0].eventDate, "2020-02-02");
    } finally { await db.delete(schema.user).where(eq(schema.user.id, uid)); }
  });

  it("paginates 150 persisted mixed cards with combined reviews, same-day rewatches, filters and undated history", async () => {
    const uid = `mixed_${suffix}`;
    const extraMedia: string[] = [];
    await db.insert(schema.user).values({ id: uid, name: "Mixed history", email: `${uid}@example.com` });
    try {
      for (let i = 0; i < 80; i++) {
        const id = `mixed_d_${suffix}_${i}`;
        await db.insert(schema.diaryEntries).values({ id, userId: uid, mediaItemId: mediaId, watchedDate: "2024-01-01", isRewatch: i > 0, createdAt: new Date("2024-01-01") });
        if (i < 20) await db.insert(schema.reviews).values({ id: `mixed_r_${suffix}_${i}`, userId: uid, mediaItemId: mediaId, content: "Explicit same-day review", status: "published", publishedAt: new Date("2024-01-01"), viewingId: id, ratingValue: 7.5, createdAt: new Date("2024-01-01") });
      }
      for (let i = 0; i < 20; i++) {
        await db.insert(schema.reviews).values({ id: `mixed_separate_${suffix}_${i}`, userId: uid, mediaItemId: mediaId, content: "Independent review", status: "published", publishedAt: new Date("2024-02-01") });
        for (const eventType of ["rating", "watched_mark"]) await db.insert(schema.activityEvents).values({ id: `${eventType}_${suffix}_${i}`, userId: uid, mediaItemId: mediaId, eventType, eventDate: "2024-03-01", ratingValue: eventType === "rating" ? 8 : null });
      }
      for (let i = 0; i < 11; i++) {
        const id = `mixed_media_${suffix}_${i}`;
        extraMedia.push(id);
        await db.insert(schema.mediaItems).values({ id, title: "Watchlist history", mediaType: "movie" });
        await db.insert(schema.watchlistItems).values({ id: `mixed_w_${suffix}_${i}`, userId: uid, mediaItemId: id, sourceService: "letterboxd", sourceAddedDate: i === 10 ? null : "2024-04-01" });
      }
      await db.insert(schema.diaryEntries).values({ id: `mixed_undated_${suffix}`, userId: uid, mediaItemId: mediaId });
      await db.insert(schema.reviews).values({ id: `mixed_undated_r_${suffix}`, userId: uid, mediaItemId: mediaId, content: "Unknown review date", status: "published" });
      await backfillUserActivityEvents(uid);
      const cards: Awaited<ReturnType<typeof getUserUnifiedTimeline>>["entries"] = [];
      for (const offset of [0, 50, 100]) {
        const page = await getUserUnifiedTimeline(uid, { limit: 50, offset });
        assert.equal(page.totalCount, 150);
        assert.equal(page.entries.length, 50);
        assert.equal(page.undatedEntries.length, 3);
        assert.equal(page.hasMore, offset < 100);
        cards.push(...page.entries);
      }
      assert.equal(new Set(cards.map((c) => c.id)).size, 150);
      assert.equal(cards.filter((c) => c.eventType === "viewing_and_review").length, 20);
      assert.equal(cards.filter((c) => c.eventType === "viewing").length, 60);
      const reviews = await getUserUnifiedTimeline(uid, { filter: "reviews", limit: 100 });
      assert.equal(reviews.entries.length, 40);
      assert.equal(reviews.undatedEntries.length, 1);
      const watchlist = await getUserUnifiedTimeline(uid, { filter: "watchlist", limit: 100 });
      assert.equal(watchlist.entries.length, 10);
      assert.equal(watchlist.undatedEntries.length, 1);
      const empty = await getUserUnifiedTimeline(uid, { offset: 150 });
      assert.equal(empty.entries.length, 0);
      assert.equal(empty.hasMore, false);
    } finally {
      await db.delete(schema.user).where(eq(schema.user.id, uid));
      for (const id of extraMedia) await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, id));
    }
  });

});
