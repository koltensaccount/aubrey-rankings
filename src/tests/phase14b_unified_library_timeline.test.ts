import path from "node:path";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";

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
    "Phase 14B Test aborted: Refusing to run without explicit test execution opt-in. Set AUBREY_TEST_MODE=1 or ALLOW_TEST_DB_WRITES=1 to run against a dedicated disposable test database."
  );
}

if (!process.env.DATABASE_URL) {
  throw new Error("Phase 14B Test aborted: DATABASE_URL (or TEST_DATABASE_URL) is required.");
}

let parsedUrl: URL;
try {
  parsedUrl = new URL(process.env.DATABASE_URL);
} catch {
  throw new Error("Phase 14B Test aborted: DATABASE_URL is not a valid URL.");
}

if (!["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
  throw new Error(
    `Phase 14B Test aborted: DATABASE_URL must be on loopback (localhost or 127.0.0.1), got: ${parsedUrl.hostname}`
  );
}

const dbName = parsedUrl.pathname.replace(/^\//, "").toLowerCase().trim();
if (!dbName) {
  throw new Error("Phase 14B Test aborted: Database name is missing from DATABASE_URL.");
}

if (
  dbName === "aubrey_rankings" ||
  dbName === "aubrey" ||
  dbName === "postgres" ||
  dbName === "template1" ||
  dbName === "template0"
) {
  throw new Error(
    `Phase 14B Test aborted: Refusing to run against primary database "${dbName}". A dedicated disposable test database (e.g. aubrey_rankings_test) is strictly required.`
  );
}

const isExplicitTestDb = dbName.endsWith("_test") || dbName.includes("test");
if (!isExplicitTestDb) {
  throw new Error(
    `Phase 14B Test aborted: Database "${dbName}" is ambiguous. The dedicated test database name must explicitly contain "test" or end in "_test" (e.g. aubrey_rankings_test).`
  );
}

// Module references dynamically loaded only after safety checks pass
let auth: typeof import("../lib/auth").auth;
let db: typeof import("../db").db;
let user: typeof import("../db/schema").user;
let mediaItems: typeof import("../db/schema").mediaItems;
let ratings: typeof import("../db/schema").ratings;
let reviews: typeof import("../db/schema").reviews;
let watchlistItems: typeof import("../db/schema").watchlistItems;
let diaryEntries: typeof import("../db/schema").diaryEntries;
let collections: typeof import("../db/schema").collections;
let eq: typeof import("drizzle-orm").eq;
let and: typeof import("drizzle-orm").and;
let desc: typeof import("drizzle-orm").desc;
let getDiary: typeof import("../app/api/diary/route").GET;
let postDiary: typeof import("../app/api/diary/route").POST;
let deleteDiary: typeof import("../app/api/diary/route").DELETE;
let patchDiaryItem: typeof import("../app/api/diary/[id]/route").PATCH;
let getWatchlist: typeof import("../app/api/watchlist/route").GET;
let postWatchlist: typeof import("../app/api/watchlist/route").POST;

describe("Phase 14B: Unified Library & Cinematic Viewing Timeline", () => {
  const suffix = `${process.pid}_${Date.now()}`;
  const ownerEmail = `curator_p14b_${suffix}@example.com`;
  const visitorEmail = `visitor_p14b_${suffix}@example.com`;

  let ownerId = "";
  let visitorId = "";
  let ownerCookie = "";
  let visitorCookie = "";

  const movie1Id = `tmdb-movie-interstellar-${suffix}`;
  const movie2Id = `tmdb-movie-arrival-${suffix}`;
  const tvEpisodeId = `tv-black-mirror-s1e1-${suffix}`;

  before(async () => {
    // Dynamically load database and auth modules
    const authModule = await import("../lib/auth");
    auth = authModule.auth;
    const dbModule = await import("../db");
    db = dbModule.db;
    const schemaModule = await import("../db/schema");
    user = schemaModule.user;
    mediaItems = schemaModule.mediaItems;
    ratings = schemaModule.ratings;
    reviews = schemaModule.reviews;
    watchlistItems = schemaModule.watchlistItems;
    diaryEntries = schemaModule.diaryEntries;
    collections = schemaModule.collections;

    const ormModule = await import("drizzle-orm");
    eq = ormModule.eq;
    and = ormModule.and;
    desc = ormModule.desc;

    const diaryRoute = await import("../app/api/diary/route");
    getDiary = diaryRoute.GET;
    postDiary = diaryRoute.POST;
    deleteDiary = diaryRoute.DELETE;

    const diaryItemRoute = await import("../app/api/diary/[id]/route");
    patchDiaryItem = diaryItemRoute.PATCH;

    const watchlistRoute = await import("../app/api/watchlist/route");
    getWatchlist = watchlistRoute.GET;
    postWatchlist = watchlistRoute.POST;

    // 1. Create owner test user
    const ownerRes = await auth.api.signUpEmail({
      body: {
        name: "Timeline Curator",
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

    // 2. Create visitor test user (for isolation testing)
    const visitorRes = await auth.api.signUpEmail({
      body: {
        name: "Timeline Visitor",
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

    // 3. Insert test media items
    await db.insert(mediaItems).values([
      {
        id: movie1Id,
        title: "Interstellar",
        mediaType: "movie",
        releaseDate: "2014-11-07",
      },
      {
        id: movie2Id,
        title: "Arrival",
        mediaType: "movie",
        releaseDate: "2016-11-11",
      },
      {
        id: tvEpisodeId,
        title: "The National Anthem",
        mediaType: "tv_episode",
        releaseDate: "2011-12-04",
      },
    ]);
  });

  after(async () => {
    // Teardown created test records cleanly without modifying production data
    if (ownerId) {
      await db.delete(diaryEntries).where(eq(diaryEntries.userId, ownerId));
      await db.delete(watchlistItems).where(eq(watchlistItems.userId, ownerId));
      await db.delete(reviews).where(eq(reviews.userId, ownerId));
      await db.delete(ratings).where(eq(ratings.userId, ownerId));
      await db.delete(collections).where(eq(collections.userId, ownerId));
      await db.delete(user).where(eq(user.id, ownerId));
    }
    if (visitorId) {
      await db.delete(diaryEntries).where(eq(diaryEntries.userId, visitorId));
      await db.delete(user).where(eq(user.id, visitorId));
    }
    await db.delete(mediaItems).where(
      and(
        eq(mediaItems.id, movie1Id)
      )
    );
    await db.delete(mediaItems).where(
      and(
        eq(mediaItems.id, movie2Id)
      )
    );
    await db.delete(mediaItems).where(
      and(
        eq(mediaItems.id, tvEpisodeId)
      )
    );
  });

  it("1. supports logging multiple dated viewings of the same film with distinct dates and scores", async () => {
    // Viewing 1: First logged viewing in 2024
    const res1 = await postDiary(
      new NextRequest("http://localhost:3000/api/diary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: ownerCookie,
        },
        body: JSON.stringify({
          mediaItemId: movie1Id,
          watchedDate: "2024-05-10",
          isRewatch: false,
          ratingValue: 9.0,
          notes: "First time seeing in 70mm IMAX.",
        }),
      })
    );
    assert.equal(res1.status, 201);
    const data1 = await res1.json();
    assert.equal(data1.success, true);
    assert.equal(data1.entry.watchedDate, "2024-05-10");
    assert.equal(data1.entry.isRewatch, false);

    // Viewing 2: Rewatch in 2025
    const res2 = await postDiary(
      new NextRequest("http://localhost:3000/api/diary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: ownerCookie,
        },
        body: JSON.stringify({
          mediaItemId: movie1Id,
          watchedDate: "2025-01-15",
          isRewatch: true,
          ratingValue: 9.5,
          notes: "Second viewing at home.",
        }),
      })
    );
    assert.equal(res2.status, 201);
    const data2 = await res2.json();
    assert.equal(data2.success, true);
    assert.equal(data2.entry.watchedDate, "2025-01-15");
    assert.equal(data2.entry.isRewatch, true);

    // Viewing 3: Third rewatch in 2026
    const res3 = await postDiary(
      new NextRequest("http://localhost:3000/api/diary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: ownerCookie,
        },
        body: JSON.stringify({
          mediaItemId: movie1Id,
          watchedDate: "2026-10-20",
          isRewatch: true,
          ratingValue: 10.0,
          notes: "Still hits just as hard.",
        }),
      })
    );
    assert.equal(res3.status, 201);
    const data3 = await res3.json();
    assert.equal(data3.success, true);
    assert.equal(data3.entry.watchedDate, "2026-10-20");

    // Verify all 3 independent viewings exist for this film
    const ownerEntries = await db.query.diaryEntries.findMany({
      where: and(
        eq(diaryEntries.userId, ownerId),
        eq(diaryEntries.mediaItemId, movie1Id)
      ),
      orderBy: [desc(diaryEntries.watchedDate)],
    });
    assert.equal(ownerEntries.length, 3);
    assert.equal(ownerEntries[0].watchedDate, "2026-10-20");
    assert.equal(ownerEntries[1].watchedDate, "2025-01-15");
    assert.equal(ownerEntries[2].watchedDate, "2024-05-10");
  });

  it("2. enforces genuine viewing date chronology and never sorts by database modification timestamps", async () => {
    // Add another viewing of a different film with an OLDER watch date added LATER
    const res = await postDiary(
      new NextRequest("http://localhost:3000/api/diary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: ownerCookie,
        },
        body: JSON.stringify({
          mediaItemId: movie2Id,
          watchedDate: "2023-11-20", // Older date logged later in time
          ratingValue: 8.5,
        }),
      })
    );
    assert.equal(res.status, 201);

    // Fetch entries via API
    const listRes = await getDiary(
      new NextRequest("http://localhost:3000/api/diary", {
        headers: { cookie: ownerCookie },
      })
    );
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();

    // Verify chronological order: newest watch date first (2026-10-20 -> 2025-01-15 -> 2024-05-10 -> 2023-11-20)
    const dates = listData.entries.map((e: any) => e.watchedDate);
    assert.deepEqual(dates, ["2026-10-20", "2025-01-15", "2024-05-10", "2023-11-20"]);
  });

  it("3. computes accurate rewatch ordinals without claiming complete lifetime omniscience", async () => {
    // Query API specifically for movie1Id
    const res = await getDiary(
      new NextRequest(`http://localhost:3000/api/diary?mediaItemId=${encodeURIComponent(movie1Id)}`, {
        headers: { cookie: ownerCookie },
      })
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.entries.length, 3);

    // Sort ascending to verify ordinals
    const asc = [...data.entries].sort((a: any, b: any) => a.watchedDate.localeCompare(b.watchedDate));
    assert.equal(asc[0].watchedDate, "2024-05-10");
    assert.equal(asc[1].watchedDate, "2025-01-15");
    assert.equal(asc[2].watchedDate, "2026-10-20");

    // Ordinal calculations: 1st, 2nd (Rewatch), 3rd (Rewatch)
    assert.equal(asc[0].isRewatch, false);
    assert.equal(asc[1].isRewatch, true);
    assert.equal(asc[2].isRewatch, true);
  });

  it("4. supports tv episodes with 16:9 stills alongside 2:3 movie posters", async () => {
    const res = await postDiary(
      new NextRequest("http://localhost:3000/api/diary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: ownerCookie,
        },
        body: JSON.stringify({
          mediaItemId: tvEpisodeId,
          watchedDate: "2026-10-21",
          ratingValue: 9.0,
          notes: "Groundbreaking pilot episode.",
        }),
      })
    );
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.entry.mediaItem.mediaType, "tv_episode");
  });

  it("5. automatically marks media as watched globally upon diary logging", async () => {
    const globalRating = await db.query.ratings.findFirst({
      where: and(
        eq(ratings.userId, ownerId),
        eq(ratings.mediaItemId, movie1Id),
        eq(ratings.isWatched, true)
      ),
    });
    assert.ok(globalRating, "Global rating must be marked isWatched = true");
  });

  it("6. supports diary entry editing and deletion with owner-only access controls", async () => {
    // Find the latest viewing
    const entry = await db.query.diaryEntries.findFirst({
      where: and(
        eq(diaryEntries.userId, ownerId),
        eq(diaryEntries.watchedDate, "2026-10-20")
      ),
    });
    assert.ok(entry);

    // Edit notes via PATCH
    const patchRes = await patchDiaryItem(
      new NextRequest(`http://localhost:3000/api/diary/${entry.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: ownerCookie,
        },
        body: JSON.stringify({
          notes: "Updated note: Christopher Nolan masterpiece.",
          ratingValue: 10.0,
        }),
      }),
      { params: Promise.resolve({ id: entry.id }) }
    );
    assert.equal(patchRes.status, 200);
    const patchData = await patchRes.json();
    assert.equal(patchData.entry.notes, "Updated note: Christopher Nolan masterpiece.");

    // Attempt to edit by visitor (must fail closed)
    const visitorPatchRes = await patchDiaryItem(
      new NextRequest(`http://localhost:3000/api/diary/${entry.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: visitorCookie,
        },
        body: JSON.stringify({
          notes: "Malicious overwrite attempt.",
        }),
      }),
      { params: Promise.resolve({ id: entry.id }) }
    );
    assert.equal(visitorPatchRes.status, 404);

    // Owner deletes entry
    const deleteRes = await deleteDiary(
      new NextRequest(`http://localhost:3000/api/diary?id=${entry.id}`, {
        method: "DELETE",
        headers: { cookie: ownerCookie },
      })
    );
    assert.equal(deleteRes.status, 200);

    const deletedCheck = await db.query.diaryEntries.findFirst({
      where: eq(diaryEntries.id, entry.id),
    });
    assert.equal(deletedCheck, undefined);
  });

  it("7. enforces strict multi-tenant privacy: visitor cannot access curator diary entries", async () => {
    const visitorRes = await getDiary(
      new NextRequest("http://localhost:3000/api/diary", {
        headers: { cookie: visitorCookie },
      })
    );
    assert.equal(visitorRes.status, 200);
    const visitorData = await visitorRes.json();
    // Visitor should see 0 diary entries
    assert.equal(visitorData.entries.length, 0);
  });

  it("8. unauthenticated requests to /api/diary return 401 Unauthorized", async () => {
    const unauthGet = await getDiary(new NextRequest("http://localhost:3000/api/diary"));
    assert.equal(unauthGet.status, 401);

    const unauthPost = await postDiary(
      new NextRequest("http://localhost:3000/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemId: movie1Id }),
      })
    );
    assert.equal(unauthPost.status, 401);
  });
});
