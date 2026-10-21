import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { chromium, type Browser, type Page } from "playwright";

// =============================================================================
// 1. Establish Environment and Safety Checks BEFORE Database Modules Initialize
// =============================================================================
try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
} catch {}

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

const isOptedIn = process.env.AUBREY_TEST_MODE === "1" || process.env.ALLOW_TEST_DB_WRITES === "1";
if (!isOptedIn) {
  throw new Error(
    "Visual verification aborted: Refusing to run without explicit test execution opt-in. Set AUBREY_TEST_MODE=1 or ALLOW_TEST_DB_WRITES=1 to run against a dedicated disposable test database."
  );
}

if (!process.env.DATABASE_URL) {
  throw new Error("Visual verification aborted: DATABASE_URL (or TEST_DATABASE_URL) is required.");
}

let parsedUrl: URL;
try {
  parsedUrl = new URL(process.env.DATABASE_URL);
} catch {
  throw new Error("Visual verification aborted: DATABASE_URL is not a valid URL.");
}

if (!["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
  throw new Error(
    `Visual verification aborted: DATABASE_URL must be on loopback (localhost or 127.0.0.1), got: ${parsedUrl.hostname}`
  );
}

const dbName = parsedUrl.pathname.replace(/^\//, "").toLowerCase().trim();
if (!dbName) {
  throw new Error("Visual verification aborted: Database name is missing from DATABASE_URL.");
}

if (
  dbName === "aubrey_rankings" ||
  dbName === "aubrey" ||
  dbName === "postgres" ||
  dbName === "template1" ||
  dbName === "template0"
) {
  throw new Error(
    `Visual verification aborted: Refusing to run against primary database "${dbName}". A dedicated disposable test database (e.g. aubrey_rankings_test) is strictly required.`
  );
}

const isExplicitTestDb = dbName.endsWith("_test") || dbName.includes("test");
if (!isExplicitTestDb) {
  throw new Error(
    `Visual verification aborted: Database "${dbName}" is ambiguous. The dedicated test database name must explicitly contain "test" or end in "_test" (e.g. aubrey_rankings_test).`
  );
}

const PORT = 3014;
const BASE_URL = `http://localhost:${PORT}`;
const ARTIFACT_DIR =
  process.env.ARTIFACT_DIR ||
  "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";

try {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
} catch {}

const tag = randomUUID().slice(0, 8);
const testUser = {
  name: `Timeline Curator ${tag}`,
  email: `curator-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `curator_${tag}`,
};

const emptyUser = {
  name: `Fresh User ${tag}`,
  email: `fresh-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `fresh_${tag}`,
};

const testMovie1Id = `tmdb-movie-interstellar-${tag}`;
const testMovie2Id = `tmdb-movie-arrival-${tag}`;
const testTvId = `tv-black-mirror-${tag}`;
const testEpisodeId = `tv-black-mirror-s1e1-${tag}`;

const createdUserIds: string[] = [];
const createdMediaIds: string[] = [];
const createdDiaryIds: string[] = [];
const createdReviewIds: string[] = [];
const createdRatingIds: string[] = [];
const createdWatchlistIds: string[] = [];
const createdCollectionIds: string[] = [];

let serverProcess: ChildProcess | null = null;
let userCookie = "";
let emptyUserCookie = "";
let db: any;
let auth: any;

async function setup() {
  console.log(`Verified test database isolation: running against "${dbName}" on ${parsedUrl.hostname}`);

  // Dynamic import of modules
  const dbModule = await import("../src/db");
  db = dbModule.db;
  const authModule = await import("../src/lib/auth");
  auth = authModule.auth;
  const schema = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");

  console.log("Creating test users...");
  // 1. Create Curator User
  const res1 = await auth.api.signUpEmail({
    body: {
      email: testUser.email,
      password: testUser.password,
      name: testUser.name,
    },
    asResponse: true,
  });
  assert.equal(res1.status, 200);
  userCookie = res1.headers.get("set-cookie") || "";
  const u1 = await db.query.user.findFirst({ where: eq(schema.user.email, testUser.email) });
  assert.ok(u1);
  createdUserIds.push(u1.id);
  await db.update(schema.user).set({ username: testUser.username, emailVerified: true }).where(eq(schema.user.id, u1.id));

  // 2. Create Empty User
  const res2 = await auth.api.signUpEmail({
    body: {
      email: emptyUser.email,
      password: emptyUser.password,
      name: emptyUser.name,
    },
    asResponse: true,
  });
  assert.equal(res2.status, 200);
  emptyUserCookie = res2.headers.get("set-cookie") || "";
  const u2 = await db.query.user.findFirst({ where: eq(schema.user.email, emptyUser.email) });
  assert.ok(u2);
  createdUserIds.push(u2.id);
  await db.update(schema.user).set({ username: emptyUser.username, emailVerified: true }).where(eq(schema.user.id, u2.id));

  console.log("Seeding test media items...");
  await db.insert(schema.mediaItems).values([
    {
      id: testMovie1Id,
      tmdbId: 157336,
      mediaType: "movie",
      title: "Interstellar",
      overview: "The adventures of a group of explorers who make use of a newly discovered wormhole.",
      posterPath: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
      releaseDate: "2014-11-05",
    },
    {
      id: testMovie2Id,
      tmdbId: 329865,
      mediaType: "movie",
      title: "Arrival",
      overview: "Taking place after alien spacecrafts touch down across the world, an expert linguist is recruited by the military to determine whether they come in peace or are a threat.",
      posterPath: "/x2OAHwNH9snqxbKo707y7nhbtCk.jpg",
      releaseDate: "2016-11-10",
    },
    {
      id: testTvId,
      tmdbId: 42009,
      mediaType: "tv",
      title: "Black Mirror",
      overview: "A contemporary British re-working of The Twilight Zone with stories that tap into the collective unease about our modern world.",
      posterPath: "/7RumFHXq3nO6T4w2kM84QeB0u2T.jpg",
      releaseDate: "2011-12-04",
    },
    {
      id: testEpisodeId,
      tmdbId: 887208,
      mediaType: "tv_episode",
      title: "The National Anthem",
      overview: "Prime Minister Michael Callow faces a shocking dilemma when Princess Susannah is kidnapped.",
      stillPath: "/wrGWeW4WKxnaeA8sxJb2T9O6hm8.jpg",
      parentMediaId: testTvId,
      seasonNumber: 1,
      episodeNumber: 1,
      releaseDate: "2011-12-04",
    },
  ]);
  createdMediaIds.push(testMovie1Id, testMovie2Id, testTvId, testEpisodeId);

  console.log("Seeding diary entries, reviews, watchlist, and collections...");
  // Viewing 1: Interstellar in 2024
  const d1 = `diary_${tag}_1`;
  await db.insert(schema.diaryEntries).values({
    id: d1,
    userId: u1.id,
    mediaItemId: testMovie1Id,
    watchedDate: "2024-05-10",
    isRewatch: false,
    ratingValue: 9.0,
    notes: "First time experiencing the docking sequence in 70mm IMAX. Unmatched sound design.",
    tags: ["imax", "70mm", "nolan"],
  });
  createdDiaryIds.push(d1);

  // Viewing 2: Interstellar in 2025
  const d2 = `diary_${tag}_2`;
  await db.insert(schema.diaryEntries).values({
    id: d2,
    userId: u1.id,
    mediaItemId: testMovie1Id,
    watchedDate: "2025-01-15",
    isRewatch: true,
    ratingValue: 9.5,
    notes: "Second viewing at home on 4K OLED. The emotional core between Cooper and Murph hits even harder.",
    tags: ["rewatch", "4k"],
  });
  createdDiaryIds.push(d2);

  // Viewing 3: Interstellar in 2026
  const d3 = `diary_${tag}_3`;
  await db.insert(schema.diaryEntries).values({
    id: d3,
    userId: u1.id,
    mediaItemId: testMovie1Id,
    watchedDate: "2026-10-20",
    isRewatch: true,
    ratingValue: 10.0,
    notes: "Still hits just as hard. A true sci-fi masterpiece for the ages.",
    tags: ["all-time-favorite", "tearjerker"],
  });
  createdDiaryIds.push(d3);

  // Viewing 4: Black Mirror Episode (TV Still)
  const d4 = `diary_${tag}_4`;
  await db.insert(schema.diaryEntries).values({
    id: d4,
    userId: u1.id,
    mediaItemId: testEpisodeId,
    watchedDate: "2026-10-21",
    isRewatch: false,
    ratingValue: 9.0,
    notes: "Unsettling, visceral political satire that set the benchmark for modern anthology sci-fi.",
    tags: ["black-mirror", "dystopia"],
  });
  createdDiaryIds.push(d4);

  // Viewing 5: Arrival in 2023
  const d5 = `diary_${tag}_5`;
  await db.insert(schema.diaryEntries).values({
    id: d5,
    userId: u1.id,
    mediaItemId: testMovie2Id,
    watchedDate: "2023-11-15",
    isRewatch: false,
    ratingValue: 9.5,
    notes: "Denis Villeneuve's profound meditation on grief, language, and non-linear time.",
    tags: ["sci-fi", "villeneuve"],
  });
  createdDiaryIds.push(d5);

  // Mark all as watched in ratings
  const r1 = `rat_${tag}_1`;
  const r2 = `rat_${tag}_2`;
  const r3 = `rat_${tag}_3`;
  await db.insert(schema.ratings).values([
    {
      id: r1,
      userId: u1.id,
      mediaItemId: testMovie1Id,
      isWatched: true,
      calculatedOverallScore: 10.0,
      sourceRating: 10.0,
      sourceScale: 10,
    },
    {
      id: r2,
      userId: u1.id,
      mediaItemId: testMovie2Id,
      isWatched: true,
      calculatedOverallScore: 9.5,
      sourceRating: 9.5,
      sourceScale: 10,
    },
    {
      id: r3,
      userId: u1.id,
      mediaItemId: testEpisodeId,
      isWatched: true,
      calculatedOverallScore: 9.0,
      sourceRating: 9.0,
      sourceScale: 10,
    },
  ]);
  createdRatingIds.push(r1, r2, r3);

  // Watchlist entry
  const w1 = `wl_${tag}_1`;
  await db.insert(schema.watchlistItems).values({
    id: w1,
    userId: u1.id,
    mediaItemId: testMovie2Id,
    notes: "Plan to rewatch before Blade Runner 2049.",
  });
  createdWatchlistIds.push(w1);

  // Collections (Weighted Ranking + Custom List)
  const col1 = `col_${tag}_ranking`;
  const col2 = `col_${tag}_list`;
  await db.insert(schema.collections).values([
    {
      id: col1,
      userId: u1.id,
      title: "Essential Sci-Fi Masterpieces",
      description: "My weighted rankings of modern cinematic science fiction.",
      collectionType: "movie",
      isRanked: true,
      isPinned: true,
      visibility: "public",
    },
    {
      id: col2,
      userId: u1.id,
      title: "Letterboxd Favorites Archive",
      description: "Custom unranked imported list of cinema favorites.",
      collectionType: "custom",
      isRanked: false,
      isPinned: false,
      visibility: "private",
    },
  ]);
  createdCollectionIds.push(col1, col2);

  // Start Next.js server
  console.log(`Starting Next.js server on port ${PORT}...`);
  serverProcess = spawn("npx", ["next", "start", "-p", String(PORT)], {
    env: { ...process.env, PORT: String(PORT), DATABASE_URL: parsedUrl.toString() },
    stdio: "pipe",
  });

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const ping = await fetch(`${BASE_URL}/api/health`);
      if (ping.ok) {
        console.log("Server is ready on port " + PORT);
        return;
      }
    } catch {}
  }
  throw new Error("Server failed to respond within 20 seconds");
}

async function teardown() {
  console.log("Tearing down server and test fixtures...");
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }

  const schema = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");
  for (const id of createdUserIds) {
    await db.delete(schema.diaryEntries).where(eq(schema.diaryEntries.userId, id));
    await db.delete(schema.watchlistItems).where(eq(schema.watchlistItems.userId, id));
    await db.delete(schema.reviews).where(eq(schema.reviews.userId, id));
    await db.delete(schema.ratings).where(eq(schema.ratings.userId, id));
    await db.delete(schema.collections).where(eq(schema.collections.userId, id));
    await db.delete(schema.user).where(eq(schema.user.id, id));
  }
  for (const id of createdMediaIds) {
    await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, id));
  }
  console.log("Cleanup complete!");
}

async function captureScreenshots() {
  const browser: Browser = await chromium.launch({ headless: true });

  try {
    // 1. Desktop Timeline - Dark Mode
    console.log("Capturing Desktop Timeline (Dark Mode)...");
    const darkContext = await browser.newContext({
      viewport: { width: 1440, height: 1024 },
      colorScheme: "dark",
    });
    // Set authentication session cookie
    const tokenMatch = userCookie.match(/better-auth\.session_token=([^;]+)/);
    if (tokenMatch) {
      await darkContext.addCookies([
        {
          name: "better-auth.session_token",
          value: tokenMatch[1],
          domain: "localhost",
          path: "/",
        },
      ]);
    }

    const darkPage: Page = await darkContext.newPage();
    await darkPage.goto(`${BASE_URL}/?tab=journal`, { waitUntil: "networkidle" });
    await darkPage.waitForTimeout(1000);
    const shot1 = path.join(ARTIFACT_DIR, "phase14b-desktop-journal-timeline-dark.png");
    await darkPage.screenshot({ path: shot1, fullPage: true });
    console.log(`Saved: ${shot1}`);

    // 2. Expanded Rewatch History Modal
    console.log("Capturing Expanded Rewatch History Modal (Interstellar 3 viewings with rating evolution curve)...");
    const historyBtn = darkPage.locator("button:has-text('View history (3)')").first();
    if (await historyBtn.isVisible()) {
      await historyBtn.click();
      await darkPage.waitForTimeout(1000);
      const shot2 = path.join(ARTIFACT_DIR, "phase14b-expanded-rewatch-history.png");
      await darkPage.screenshot({ path: shot2, fullPage: false });
      console.log(`Saved: ${shot2}`);
      const closeBtn = darkPage.locator("button[aria-label='Close dialog']").first();
      if (await closeBtn.isVisible()) await closeBtn.click();
    }

    // 3. Desktop Timeline - Light Mode
    console.log("Capturing Desktop Timeline (Light Mode)...");
    const lightContext = await browser.newContext({
      viewport: { width: 1440, height: 1024 },
      colorScheme: "light",
    });
    if (tokenMatch) {
      await lightContext.addCookies([
        {
          name: "better-auth.session_token",
          value: tokenMatch[1],
          domain: "localhost",
          path: "/",
        },
      ]);
    }
    const lightPage: Page = await lightContext.newPage();
    await lightPage.goto(`${BASE_URL}/?tab=journal`, { waitUntil: "networkidle" });
    await lightPage.evaluate(() => {
      localStorage.setItem("ar_theme", "light");
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      document.documentElement.setAttribute("data-theme", "light");
    });
    await lightPage.waitForTimeout(600);
    const shot3 = path.join(ARTIFACT_DIR, "phase14b-desktop-journal-timeline-light.png");
    await lightPage.screenshot({ path: shot3, fullPage: true });
    console.log(`Saved: ${shot3}`);

    // 4. Mobile Timeline (Viewport 390x844)
    console.log("Capturing Mobile Timeline (390x844)...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
      isMobile: true,
      hasTouch: true,
    });
    if (tokenMatch) {
      await mobileContext.addCookies([
        {
          name: "better-auth.session_token",
          value: tokenMatch[1],
          domain: "localhost",
          path: "/",
        },
      ]);
    }
    const mobilePage: Page = await mobileContext.newPage();
    await mobilePage.goto(`${BASE_URL}/?tab=journal`, { waitUntil: "networkidle" });
    await mobilePage.waitForTimeout(1000);
    const shot4 = path.join(ARTIFACT_DIR, "phase14b-mobile-timeline.png");
    await mobilePage.screenshot({ path: shot4, fullPage: true });
    console.log(`Saved: ${shot4}`);

    // 5. Watched Grid
    console.log("Capturing Watched Grid...");
    await darkPage.goto(`${BASE_URL}/?tab=watched`, { waitUntil: "networkidle" });
    await darkPage.waitForTimeout(1000);
    const shot5 = path.join(ARTIFACT_DIR, "phase14b-watched-grid.png");
    await darkPage.screenshot({ path: shot5, fullPage: true });
    console.log(`Saved: ${shot5}`);

    // 6. Watchlist Grid
    console.log("Capturing Watchlist Grid...");
    await darkPage.goto(`${BASE_URL}/?tab=watchlist`, { waitUntil: "networkidle" });
    await darkPage.waitForTimeout(1000);
    const shot6 = path.join(ARTIFACT_DIR, "phase14b-watchlist-grid.png");
    await darkPage.screenshot({ path: shot6, fullPage: true });
    console.log(`Saved: ${shot6}`);

    // 7. Rankings Section
    console.log("Capturing Rankings Section...");
    await darkPage.goto(`${BASE_URL}/?tab=rankings`, { waitUntil: "networkidle" });
    await darkPage.waitForTimeout(1000);
    const shot7 = path.join(ARTIFACT_DIR, "phase14b-rankings-section.png");
    await darkPage.screenshot({ path: shot7, fullPage: true });
    console.log(`Saved: ${shot7}`);

    // 8. Empty Timeline (Fresh user)
    console.log("Capturing Empty Timeline for fresh user...");
    const emptyContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
    });
    const emptyTokenMatch = emptyUserCookie.match(/better-auth\.session_token=([^;]+)/);
    if (emptyTokenMatch) {
      await emptyContext.addCookies([
        {
          name: "better-auth.session_token",
          value: emptyTokenMatch[1],
          domain: "localhost",
          path: "/",
        },
      ]);
    }
    const emptyPage: Page = await emptyContext.newPage();
    await emptyPage.goto(`${BASE_URL}/?tab=journal`, { waitUntil: "networkidle" });
    await emptyPage.waitForTimeout(1000);
    const shot8 = path.join(ARTIFACT_DIR, "phase14b-empty-timeline.png");
    await emptyPage.screenshot({ path: shot8, fullPage: true });
    console.log(`Saved: ${shot8}`);

    console.log("All 8 visual screenshots captured successfully!");
  } finally {
    await browser.close();
  }
}

async function run() {
  try {
    await setup();
    await captureScreenshots();
  } finally {
    await teardown();
  }
}

run().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
