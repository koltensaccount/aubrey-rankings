import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, ChildProcess, execSync } from "node:child_process";
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

// Require explicit opt-in for destructive/fixture database testing
const isOptedIn = process.env.AUBREY_TEST_MODE === "1" || process.env.ALLOW_TEST_DB_WRITES === "1";
if (!isOptedIn) {
  throw new Error(
    "Verification aborted: Refusing to run without explicit test execution opt-in. Set AUBREY_TEST_MODE=1 or ALLOW_TEST_DB_WRITES=1 to run against a dedicated disposable test database."
  );
}

// Require DATABASE_URL
if (!process.env.DATABASE_URL) {
  throw new Error("Verification aborted: DATABASE_URL (or TEST_DATABASE_URL) is required.");
}

let parsedUrl: URL;
try {
  parsedUrl = new URL(process.env.DATABASE_URL);
} catch {
  throw new Error("Verification aborted: DATABASE_URL is not a valid URL.");
}

// Require loopback connection
if (!["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
  throw new Error(
    `Verification aborted: DATABASE_URL must be on loopback (localhost or 127.0.0.1), got: ${parsedUrl.hostname}`
  );
}

// Require explicitly verified test database name; reject normal aubrey_rankings database
const dbName = parsedUrl.pathname.replace(/^\//, "").toLowerCase().trim();
if (!dbName) {
  throw new Error("Verification aborted: Database name is missing from DATABASE_URL.");
}

if (
  dbName === "aubrey_rankings" ||
  dbName === "aubrey" ||
  dbName === "postgres" ||
  dbName === "template1" ||
  dbName === "template0"
) {
  throw new Error(
    `Verification aborted: Refusing to run against primary database "${dbName}". A dedicated disposable test database (e.g. aubrey_rankings_test) is strictly required.`
  );
}

const isExplicitTestDb = dbName.endsWith("_test") || dbName.includes("test");
if (!isExplicitTestDb) {
  throw new Error(
    `Verification aborted: Database "${dbName}" is ambiguous. The dedicated test database name must explicitly contain "test" or end in "_test" (e.g. aubrey_rankings_test).`
  );
}

// =============================================================================
// 2. Dynamic Initialization of Database Modules (Only After Safety Checks Pass)
// =============================================================================
let db: any;
let pool: any;
let user: any;
let mediaItems: any;
let ratings: any;
let reviews: any;
let eq: any;
let inArray: any;
let auth: any;

const PORT = 3012;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR =
  process.env.SCREENSHOT_DIR ||
  path.resolve(process.cwd(), ".gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9");

try {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
} catch {}

// Unique fixture identities
const tag = randomUUID().slice(0, 8);
const testMovieTmdbId = 550;
const testTvTmdbId = 1399;

const testMovieId = `tmdb-movie-${testMovieTmdbId}`;
const parentTvId = `tv_${testTvTmdbId}`;
const testEpisodeId = `tv_${testTvTmdbId}_s1_e1`;

const testUser = {
  name: `Phase 13 Critic ${tag}`,
  email: `critic-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `critic_${tag}`,
};

let serverProcess: ChildProcess | null = null;
let userId: string = "";
let sessionCookie: string = "";

// Track all created IDs for exact teardown
const createdUserIds: string[] = [];
const createdMediaIds: string[] = [];
const createdReviewIds: string[] = [];
const createdRatingIds: string[] = [];

async function setup() {
  console.log(`Verified test database isolation: running against "${dbName}" on ${parsedUrl.hostname}`);

  // Initialize DB and Auth modules now that safety checks have passed
  const dbModule = await import("../src/db");
  db = dbModule.db;
  pool = dbModule.pool;

  const schemaModule = await import("../src/db/schema");
  user = schemaModule.user;
  mediaItems = schemaModule.mediaItems;
  ratings = schemaModule.ratings;
  reviews = schemaModule.reviews;

  const ormModule = await import("drizzle-orm");
  eq = ormModule.eq;
  inArray = ormModule.inArray;

  const authModule = await import("../src/lib/auth");
  auth = authModule.auth;

  console.log("Preparing standalone static assets...");
  try {
    execSync("cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/", {
      stdio: "ignore",
    });
  } catch {}

  console.log("Creating test user account...");
  const res = await auth.api.signUpEmail({
    body: {
      email: testUser.email,
      password: testUser.password,
      name: testUser.name,
    },
    asResponse: true,
  });
  assert.equal(res.status, 200);
  const rawCookie = res.headers.get("set-cookie") || "";
  const match = rawCookie.match(/better-auth\.session_token=([^;]+)/);
  sessionCookie = match ? match[1] : "";

  const u = await db.query.user.findFirst({ where: eq(user.email, testUser.email) });
  assert.ok(u);
  userId = u.id;
  createdUserIds.push(userId);
  await db.update(user).set({ username: testUser.username, emailVerified: true }).where(eq(user.id, userId));

  // Seed sample TV parent show, episode, and movie (tracking newly inserted media records)
  console.log("Seeding isolated test media records...");
  const existingTv = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, parentTvId) });
  if (!existingTv) {
    await db.insert(mediaItems).values({
      id: parentTvId,
      tmdbId: testTvTmdbId,
      mediaType: "tv",
      title: "Game of Thrones",
      overview: "Seven noble families fight for control of the mythical land of Westeros.",
      posterPath: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
    });
    createdMediaIds.push(parentTvId);
  }

  const existingMovie = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, testMovieId) });
  if (!existingMovie) {
    await db.insert(mediaItems).values({
      id: testMovieId,
      tmdbId: testMovieTmdbId,
      mediaType: "movie",
      title: "Fight Club",
      overview: "An insomniac office worker and a devil-may-care soap maker form an underground fight club.",
      posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    });
    createdMediaIds.push(testMovieId);
  }

  const existingEp = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, testEpisodeId) });
  if (!existingEp) {
    await db.insert(mediaItems).values({
      id: testEpisodeId,
      tmdbId: 63056,
      mediaType: "episode",
      title: "Game of Thrones: Winter Is Coming",
      seasonNumber: 1,
      episodeNumber: 1,
      stillPath: "/wrGWeW4WKxnaeA8sxJb2T9O6hm8.jpg",
      parentMediaId: parentTvId,
    });
    createdMediaIds.push(testEpisodeId);
  }

  // Seed one standalone rating-only entry for the user
  const standaloneRatingId = `rating_standalone_${tag}`;
  await db.insert(ratings).values({
    id: standaloneRatingId,
    userId,
    mediaItemId: testEpisodeId,
    calculatedOverallScore: 9.0,
    sourceRating: 9.0,
    sourceScale: 10,
  });
  createdRatingIds.push(standaloneRatingId);

  // Start standalone server with verified test database in environment
  console.log(`Starting standalone server on port ${PORT}...`);
  serverProcess = spawn("node", [".next/standalone/server.js"], {
    env: { ...process.env, PORT: String(PORT), HOSTNAME: "localhost", DATABASE_URL: parsedUrl.toString() },
    stdio: "pipe",
  });

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const ping = await fetch(`${BASE_URL}/api/health`);
      if (ping.ok) {
        console.log("Server is ready!");
        return;
      }
    } catch {}
  }
  throw new Error("Server failed to respond within 20 seconds");
}

let cleanedUp = false;
async function teardown() {
  if (cleanedUp) return;
  cleanedUp = true;
  console.log("Cleaning up test data and shutting down server...");

  try {
    if (createdReviewIds.length > 0) {
      await db.delete(reviews).where(inArray(reviews.id, createdReviewIds));
    }
    if (createdRatingIds.length > 0) {
      await db.delete(ratings).where(inArray(ratings.id, createdRatingIds));
    }
    if (userId) {
      await db.delete(reviews).where(eq(reviews.userId, userId));
      await db.delete(ratings).where(eq(ratings.userId, userId));
    }
    // Delete episode first, then parent shows/movies to satisfy foreign keys
    if (createdMediaIds.length > 0) {
      for (const mId of [...createdMediaIds].reverse()) {
        await db.delete(mediaItems).where(eq(mediaItems.id, mId));
      }
    }
    if (userId) {
      await db.delete(user).where(eq(user.id, userId));
    }
  } catch (err) {
    console.warn("Cleanup warning:", err);
  }

  if (serverProcess) {
    serverProcess.kill();
  }
  try {
    await pool.end();
  } catch {}
}

async function runJourneys() {
  await setup();

  const browser = await chromium.launch({ headless: true });

  try {
    // =========================================================================
    // Journey 1: Logged-out Visitor (Desktop & Mobile)
    // =========================================================================
    console.log("Verifying Journey 1: Logged-out Visitor...");
    const desktopVisitorContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const desktopVisitorPage = await desktopVisitorContext.newPage();
    await desktopVisitorPage.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    // Assert balanced hero copy
    const heroHeading = await desktopVisitorPage.textContent("h1");
    console.log("Hero Heading:", heroHeading?.replace(/\s+/g, " ").trim());
    assert.ok(heroHeading?.includes("LOG. CRITIQUE.") || heroHeading?.includes("Log. Critique."));
    assert.ok(heroHeading?.includes("RANK WHAT YOU WATCH") || heroHeading?.includes("Rank What You Watch."));

    // Screenshot 1: Logged-out Homepage Desktop
    await desktopVisitorPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey1-loggedout-homepage-desktop.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey1-loggedout-homepage-desktop.png");

    // Mobile Visitor
    const mobileVisitorContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
    });
    const mobileVisitorPage = await mobileVisitorContext.newPage();
    await mobileVisitorPage.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await mobileVisitorPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey1-loggedout-homepage-mobile.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey1-loggedout-homepage-mobile.png");

    // =========================================================================
    // Journey 2: Authenticated Navigation & Library
    // =========================================================================
    console.log("Verifying Journey 2: Authenticated Navigation & Library...");
    const authContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    await authContext.addCookies([
      {
        name: "better-auth.session_token",
        value: sessionCookie,
        domain: "localhost",
        path: "/",
      },
    ]);

    const authPage = await authContext.newPage();
    await authPage.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    // Verify navbar has Journal link
    const journalNavLink = await authPage.$('nav a[href="/journal"]');
    assert.ok(journalNavLink, "Navbar should have a direct link to /journal");

    // Verify library header has "Add to Journal"
    const addToJournalBtn = await authPage.$('a[href="/discover"]:has-text("Add to Journal")');
    assert.ok(addToJournalBtn, "Library header should have 'Add to Journal' CTA");

    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey2-library-desktop.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey2-library-desktop.png");

    // =========================================================================
    // Journey 3: Discover (Signed-Out vs Signed-In Search)
    // =========================================================================
    console.log("Verifying Journey 3: Discover Page...");
    // 3a. Signed-out Discover: verify clear sign-in required prompt & no broken search input
    console.log("Verifying signed-out Discover page...");
    await desktopVisitorPage.goto(`${BASE_URL}/discover`, { waitUntil: "networkidle" });
    const signInPrompt = await desktopVisitorPage.textContent("text=Sign in to Search & Journal");
    assert.ok(signInPrompt, "Signed-out visitors must see clear 'Sign in to Search & Journal' banner");
    const visitorInput = await desktopVisitorPage.$('input[placeholder*="Search by title"]');
    assert.equal(visitorInput, null, "Signed-out visitors must not have active search input triggering 401s");

    // 3b. Signed-in Discover: interactive search
    await authPage.route("**/api/tmdb/search*", async (route) => {
      const url = new URL(route.request().url());
      const q = (url.searchParams.get("q") || "").toLowerCase();
      if (q.includes("game") || q.includes("thrones")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: [
              {
                id: testTvTmdbId,
                name: "Game of Thrones",
                media_type: "tv",
                poster_path: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
                first_air_date: "2011-04-17",
              },
            ],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: [
              {
                id: testMovieTmdbId,
                title: "Fight Club",
                media_type: "movie",
                poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
                release_date: "1999-10-15",
              },
            ],
          }),
        });
      }
    });

    await authPage.goto(`${BASE_URL}/discover`, { waitUntil: "networkidle" });

    // Screenshot Discover default state
    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey3-discover-desktop.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey3-discover-desktop.png");

    // Search for a movie
    console.log("Searching for movie on Discover...");
    const searchInput = await authPage.$('input[type="text"]');
    assert.ok(searchInput, "Signed-in user must have interactive search input");
    await searchInput.fill("Fight Club");
    await authPage.waitForTimeout(1000);

    const movieCardAction = await authPage.$('a:has-text("Add to Journal")');
    assert.ok(movieCardAction, "Movie result card must have 'Add to Journal' action");

    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey3-discover-movie-search.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey3-discover-movie-search.png");

    // Search for a TV Show
    console.log("Searching for TV series on Discover...");
    await searchInput.fill("Game of Thrones");
    await authPage.waitForTimeout(1000);

    const tvActionOnCard = await authPage.$('a:has-text("Episodes & Journal")');
    assert.ok(tvActionOnCard, "TV result card must have 'Episodes & Journal' action");

    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey3-discover-tv-search.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey3-discover-tv-search.png");

    // =========================================================================
    // Journey 4: Movie Flow: Add to Journal → Save Private Entry
    // =========================================================================
    console.log("Verifying Journey 4: Movie Flow & Saving Private Entry...");
    // Reset search to movie and click Add to Journal
    await searchInput.fill("Fight Club");
    await authPage.waitForTimeout(1000);
    const movieJournalBtn = await authPage.$('a:has-text("Add to Journal")');
    assert.ok(movieJournalBtn);
    await movieJournalBtn.click();

    // Dialog auto-opens via ?journal=1
    await authPage.waitForSelector('[role="dialog"]', { timeout: 8000 });
    const dialog = await authPage.$('[role="dialog"]');
    assert.ok(dialog, "ReviewEditorDialog should auto-open on media page via ?journal=1");

    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey4-journal-editor-dialog.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey4-journal-editor-dialog.png");

    // Fill in title and content
    const privateMovieReviewTitle = `Private Fincher Critique ${tag}`;
    const titleInput = await dialog.$('input[type="text"]');
    if (titleInput) {
      await titleInput.fill(privateMovieReviewTitle);
    }

    const contentTextarea = await dialog.$("textarea");
    if (contentTextarea) {
      await contentTextarea.fill("An exacting look at consumerism and dissociative identity.");
    }

    // Ensure visibility is Private
    const privateVisibilityBtn = await dialog.$('button:has-text("Private")');
    if (privateVisibilityBtn) {
      await privateVisibilityBtn.click();
    }

    // Click Save Private Entry
    const savePrivateBtn = await dialog.$('button:has-text("Save Private Entry"), button:has-text("Save Draft")');
    assert.ok(savePrivateBtn, "Should have a Save Private Entry / Save Draft button");
    await savePrivateBtn.click();

    // Wait for dialog to close
    await authPage.waitForSelector('[role="dialog"]', { state: "hidden", timeout: 8000 });
    console.log("Saved private movie entry successfully!");

    // Capture movie page after saving
    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey4-movie-detail-desktop.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey4-movie-detail-desktop.png");

    // Query DB to record created review ID for exact cleanup
    const savedMovieReview = await db.query.reviews.findFirst({
      where: eq(reviews.userId, userId),
    });
    if (savedMovieReview) {
      createdReviewIds.push(savedMovieReview.id);
    }

    // =========================================================================
    // Journey 5: Dedicated /journal Destination & Reopen Saved Entry
    // =========================================================================
    console.log("Verifying Journey 5: Dedicated /journal Destination & Entry Reopen...");
    await authPage.goto(`${BASE_URL}/journal`, { waitUntil: "networkidle" });

    const journalHeading = await authPage.textContent("h1");
    assert.ok(journalHeading?.includes("My Journal") || journalHeading?.includes("MY JOURNAL"));

    // Verify badge says "Personal Journal · Recent Activity"
    const recentActivityBadge = await authPage.textContent("text=Personal Journal · Recent Activity");
    assert.ok(recentActivityBadge, "Header must label view as Recent Activity, not chronological watch history");

    // Verify saved entry is listed
    const savedEntryTitle = await authPage.textContent(`text=${privateMovieReviewTitle}`);
    assert.ok(savedEntryTitle, "Saved private entry must be displayed in /journal");

    // Verify visibility badge displays Private
    const privateBadge = await authPage.$('text=Private');
    assert.ok(privateBadge, "Visibility must be clearly distinguished as Private");

    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey5-my-journal-desktop.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey5-my-journal-desktop.png");

    // Reopen saved entry to verify content persistence
    const openEditBtn = await authPage.$('a:has-text("Open & Edit"), a:has-text("Resume Draft")');
    assert.ok(openEditBtn, "Entry card should have Open & Edit or Resume Draft button");
    await openEditBtn.click();

    await authPage.waitForSelector('[role="dialog"]', { timeout: 8000 });
    const reopenedDialog = await authPage.$('[role="dialog"]');
    assert.ok(reopenedDialog, "Dialog should reopen on media page");
    const titleVal = await reopenedDialog.$eval('input[type="text"]', (el) => (el as HTMLInputElement).value);
    assert.equal(titleVal, privateMovieReviewTitle, "Reopened dialog must display the saved title");

    // Close dialog
    const cancelBtn = await reopenedDialog.$('button:has-text("Cancel")');
    if (cancelBtn) await cancelBtn.click();
    await authPage.waitForSelector('[role="dialog"]', { state: "hidden", timeout: 5000 });

    // =========================================================================
    // Journey 6: TV Series Episodes Flow & Journal Creation
    // =========================================================================
    console.log("Verifying Journey 6: TV Series Episodes & Entry Creation...");
    await authPage.goto(`${BASE_URL}/media/${parentTvId}?type=tv`, { waitUntil: "networkidle" });

    // Episode 1 must be visible with Add to Journal button
    const epJournalBtn = await authPage.$('a:has-text("Add to Journal")');
    assert.ok(epJournalBtn, "TV episode must have 'Add to Journal' button");
    await epJournalBtn.click();

    // Dialog opens for Episode 1
    await authPage.waitForSelector('[role="dialog"]', { timeout: 8000 });
    const epDialog = await authPage.$('[role="dialog"]');
    assert.ok(epDialog, "ReviewEditorDialog should open for TV episode");

    const epReviewTitle = `Episode 1 Private Analysis ${tag}`;
    const epTitleInput = await epDialog.$('input[type="text"]');
    if (epTitleInput) {
      await epTitleInput.fill(epReviewTitle);
    }
    const epTextarea = await epDialog.$("textarea");
    if (epTextarea) {
      await epTextarea.fill("Strong world-building and character establishment.");
    }
    const epPrivateBtn = await epDialog.$('button:has-text("Private")');
    if (epPrivateBtn) {
      await epPrivateBtn.click();
    }
    const epSaveBtn = await epDialog.$('button:has-text("Save Private Entry"), button:has-text("Save Draft")');
    assert.ok(epSaveBtn);
    await epSaveBtn.click();
    await authPage.waitForSelector('[role="dialog"]', { state: "hidden", timeout: 8000 });

    // Record created episode review ID
    const epReview = await db.query.reviews.findFirst({
      where: eq(reviews.mediaItemId, testEpisodeId),
    });
    if (epReview) {
      createdReviewIds.push(epReview.id);
    }

    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey4-tv-series-episodes-desktop.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey4-tv-series-episodes-desktop.png");

    // Verify /journal displays both the movie and TV episode entries
    await authPage.goto(`${BASE_URL}/journal`, { waitUntil: "networkidle" });
    const epEntryOnJournal = await authPage.$(`text=${epReviewTitle}`);
    assert.ok(epEntryOnJournal, "TV episode journal entry must appear in /journal");

    // =========================================================================
    // Journey 7: Public Discovery Safety Check (Private entries never exposed)
    // =========================================================================
    console.log("Verifying Journey 7: Confirming private entries do NOT appear in public discovery...");
    // Check as unauthenticated visitor
    await desktopVisitorPage.goto(`${BASE_URL}/media/${testMovieId}`, { waitUntil: "networkidle" });
    const visiblePrivateTitle = await desktopVisitorPage.$(`text=${privateMovieReviewTitle}`);
    assert.equal(visiblePrivateTitle, null, "Private entry must NEVER appear on the public media page for visitors");

    // Check public reviews API
    const publicReviewsRes = await fetch(`${BASE_URL}/api/reviews?mediaItemId=${testMovieId}`);
    assert.equal(publicReviewsRes.status, 200);
    const publicReviewsJson = await publicReviewsRes.json();
    assert.equal(publicReviewsJson.reviews.length, 0, "Public reviews API must return 0 items for private entries");
    console.log("✔ Verified private entries are strictly hidden from public discovery");

    // =========================================================================
    // Journey 8: Mobile Experience Check
    // =========================================================================
    console.log("Verifying Journey 8: Mobile Experience...");
    const mobileAuthContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
    });
    await mobileAuthContext.addCookies([
      {
        name: "better-auth.session_token",
        value: sessionCookie,
        domain: "localhost",
        path: "/",
      },
    ]);
    const mobileAuthPage = await mobileAuthContext.newPage();

    // Mobile /journal
    await mobileAuthPage.goto(`${BASE_URL}/journal`, { waitUntil: "networkidle" });
    const mobileJournalNav = await mobileAuthPage.$('nav a[href="/journal"]');
    assert.ok(mobileJournalNav, "Mobile bottom navigation must have Journal item");

    await mobileAuthPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey6-my-journal-mobile.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey6-my-journal-mobile.png");

    // Mobile Media Page
    await mobileAuthPage.goto(`${BASE_URL}/media/${testMovieId}?type=movie`, { waitUntil: "networkidle" });
    await mobileAuthPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey6-movie-detail-mobile.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey6-movie-detail-mobile.png");

    console.log("\n🎉 All Phase 13 UX browser verification journeys passed cleanly!");
  } finally {
    await browser.close();
    await teardown();
  }
}

runJourneys().catch(async (err) => {
  console.error("Verification failed:", err);
  await teardown();
  process.exit(1);
});
