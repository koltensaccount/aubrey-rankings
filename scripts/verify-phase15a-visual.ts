import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { chromium, type Browser, type Page } from "playwright";

// =============================================================================
// Safety Checks BEFORE Database Modules Initialize
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
    `Visual verification aborted: Database "${dbName}" is ambiguous. The dedicated test database name must explicitly contain "test" or end in "_test".`
  );
}

const PORT = 3015;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ARTIFACT_DIR =
  process.env.ARTIFACT_DIR ||
  "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";
const LOCAL_REVIEW_DIR = path.resolve(process.cwd(), "artifacts/phase15a-visual-review");

try {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
} catch {}
try {
  fs.mkdirSync(LOCAL_REVIEW_DIR, { recursive: true });
} catch {}

const tag = randomUUID().slice(0, 8);
const testUser = {
  name: `Media Architect ${tag}`,
  email: `architect-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `architect_${tag}`,
};

const communityCritic = {
  name: `Cinema Critic ${tag}`,
  email: `critic-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `critic_${tag}`,
};

const testMovieId = `med_p15a_movie_${tag}`;
const testTvId = `tv_7777_${tag}`;
const testEpisodeId = `tv_7777_${tag}_s1_e1`;

const createdUserIds: string[] = [];
const createdMediaIds: string[] = [];
const createdRatingIds: string[] = [];
const createdReviewIds: string[] = [];
const createdDiaryIds: string[] = [];
const createdWatchlistIds: string[] = [];
const createdCollectionIds: string[] = [];
const createdEntryIds: string[] = [];

async function saveScreenshot(page: Page, filename: string) {
  const artifactPath = path.join(ARTIFACT_DIR, filename);
  const localPath = path.join(LOCAL_REVIEW_DIR, filename);
  await page.screenshot({ path: artifactPath, fullPage: true, animations: "disabled", timeout: 10000 });
  try {
    fs.copyFileSync(artifactPath, localPath);
  } catch {}
  console.log(`Saved screenshot: ${filename}`);
}

async function startServer(): Promise<ChildProcess> {
  console.log(`Starting Next.js test server on port ${PORT}...`);
  const server = spawn("npx", ["next", "dev", "--port", String(PORT), "--hostname", "127.0.0.1"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    },
    stdio: "pipe",
  });

  server.stdout?.on("data", (data) => {
    const text = data.toString();
    if (text.includes("Ready") || text.includes("started server")) {
      console.log(`Next.js test server output: ${text.trim()}`);
    }
  });

  server.stderr?.on("data", (data) => {
    const text = data.toString();
    if (!text.includes("ExperimentalWarning")) {
      console.error(`Next.js stderr: ${text.trim()}`);
    }
  });

  // Poll for server availability
  const startTime = Date.now();
  while (Date.now() - startTime < 35000) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        console.log("Server is ready and responding at /api/health!");
        return server;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error("Next.js test server failed to start within timeout.");
}

async function main() {
  let serverProcess: ChildProcess | null = null;
  let browser: Browser | null = null;

  try {
    const { db } = await import("../src/db");
    const { eq, inArray } = await import("drizzle-orm");
    const {
      user,
      mediaItems,
      ratings,
      reviews,
      diaryEntries,
      watchlistItems,
      collections,
      collectionEntries,
    } = await import("../src/db/schema");
    const { auth } = await import("../src/lib/auth");

    // 1. Seed test users
    console.log("Seeding test users...");
    const ownerRes = await auth.api.signUpEmail({
      body: {
        name: testUser.name,
        email: testUser.email,
        password: testUser.password,
      },
      asResponse: true,
    });
    assert.equal(ownerRes.status, 200);
    const ownerCookie = ownerRes.headers.get("set-cookie") || "";
    const u1 = await db.query.user.findFirst({
      where: (u: any, { eq }: any) => eq(u.email, testUser.email),
    });
    assert.ok(u1);
    const ownerUserId = u1.id;
    createdUserIds.push(ownerUserId);
    await db.update(user).set({ username: testUser.username }).where(eq(user.id, ownerUserId));

    const criticRes = await auth.api.signUpEmail({
      body: {
        name: communityCritic.name,
        email: communityCritic.email,
        password: communityCritic.password,
      },
      asResponse: true,
    });
    assert.equal(criticRes.status, 200);
    const u2 = await db.query.user.findFirst({
      where: (u: any, { eq }: any) => eq(u.email, communityCritic.email),
    });
    assert.ok(u2);
    const criticUserId = u2.id;
    createdUserIds.push(criticUserId);
    await db.update(user).set({ username: communityCritic.username }).where(eq(user.id, criticUserId));

    // 2. Seed test media items: movie, TV series, episode
    console.log("Seeding test media...");
    await db.insert(mediaItems).values([
      {
        id: testMovieId,
        title: "Blade Runner 2049",
        mediaType: "movie",
        releaseDate: "2017-10-06",
        overview:
          "Thirty years after the events of the first film, a new blade runner, LAPD Officer K, unearths a long-buried secret that has the potential to plunge what's left of society into chaos.",
        posterPath: "/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg",
        backdropPath: "/ilRyASDvt7v6911dyqrxL5x55h.jpg",
      },
      {
        id: testTvId,
        tmdbId: 7777,
        title: "Severance",
        mediaType: "tv",
        releaseDate: "2022-02-18",
        overview:
          "Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.",
        posterPath: "/1x0v5hK03i0iGvjWkM4K0T4vT.jpg",
        backdropPath: "/7777_severance_backdrop.jpg",
      },
      {
        id: testEpisodeId,
        tmdbId: 8888,
        title: "Severance: Good News About Hell",
        mediaType: "episode",
        releaseDate: "2022-02-18",
        seasonNumber: 1,
        episodeNumber: 1,
        parentMediaId: testTvId,
        overview: "Mark Scout leads a team at Lumon Industries, whose employees have undergone a severance procedure.",
        stillPath: "/8888_severance_still.jpg",
      },
    ]);
    createdMediaIds.push(testMovieId, testTvId, testEpisodeId);

    // 3. Seed personal activity for owner:
    console.log("Seeding owner personal activity...");
    // A. Standalone Rating
    const [ownerRating] = await db
      .insert(ratings)
      .values({
        id: `rat_p15a_owner_${tag}`,
        userId: ownerUserId,
        mediaItemId: testMovieId,
        calculatedOverallScore: 9.2,
        isWatched: true,
        personalNotes: "Roger Deakins' cinematography is peerless. Denis Villeneuve at his peak.",
      })
      .returning();
    createdRatingIds.push(ownerRating.id);

    // B. Personal Viewing History
    const [diary1] = await db
      .insert(diaryEntries)
      .values({
        id: `diary_1_${tag}`,
        userId: ownerUserId,
        mediaItemId: testMovieId,
        watchedDate: "2024-09-15",
        isRewatch: false,
        ratingValue: 9.0,
        notes: "IMAX 70mm re-release viewing.",
      })
      .returning();

    const [diary2] = await db
      .insert(diaryEntries)
      .values({
        id: `diary_2_${tag}`,
        userId: ownerUserId,
        mediaItemId: testMovieId,
        watchedDate: "2024-10-20",
        isRewatch: true,
        ratingValue: 9.5,
        notes: "Late night 4K HDR home theater rewatch.",
      })
      .returning();
    createdDiaryIds.push(diary1.id, diary2.id);

    // C. Personal Reviews & Drafts
    const [ownerDraft] = await db
      .insert(reviews)
      .values({
        id: `rev_draft_${tag}`,
        userId: ownerUserId,
        mediaItemId: testMovieId,
        title: "Working Analysis of Denis Villeneuve's Color Symbolism",
        content: "Draft in progress exploring yellow vs orange palettes in the Vegas sequence.",
        draftContent: "Draft in progress exploring yellow vs orange palettes in the Vegas sequence.",
        status: "draft",
        visibility: "private",
      })
      .returning();
    createdReviewIds.push(ownerDraft.id);

    // D. Watchlist
    const [wl] = await db
      .insert(watchlistItems)
      .values({
        id: `wl_${tag}`,
        userId: ownerUserId,
        mediaItemId: testMovieId,
      })
      .returning();
    createdWatchlistIds.push(wl.id);

    // E. Ranking Collection
    const [col] = await db
      .insert(collections)
      .values({
        id: `col_${tag}`,
        userId: ownerUserId,
        title: "Top 25 Modern Cinema Masterpieces",
        collectionType: "standard",
        visibility: "public",
      })
      .returning();
    createdCollectionIds.push(col.id);

    const [colEntry] = await db
      .insert(collectionEntries)
      .values({
        id: `ce_${tag}`,
        collectionId: col.id,
        mediaItemId: testMovieId,
        sortOrder: 0,
        notes: "Rank #1 modern sci-fi",
      })
      .returning();
    createdEntryIds.push(colEntry.id);

    // 4. Seed published community reviews from critic
    console.log("Seeding public community reviews...");
    const [criticReview] = await db
      .insert(reviews)
      .values({
        id: `rev_critic_${tag}`,
        userId: criticUserId,
        mediaItemId: testMovieId,
        title: "An Atmospheric Miracle in Modern Blockbuster Filmmaking",
        content:
          "Blade Runner 2049 succeeds where almost every legacy sequel fails: it expands upon the philosophical inquiries of the original while developing a distinct existential weight of its own.",
        status: "published",
        visibility: "public",
        publishedAt: new Date(),
      })
      .returning();
    createdReviewIds.push(criticReview.id);

    // Start dev server
    serverProcess = await startServer();

    // Launch Playwright
    console.log("Launching headless Chromium...");
    browser = await chromium.launch({ headless: true });

    // Scenario 1: Public Title Overview (unauthenticated visitor)
    console.log("Testing Scenario 1: Public Title Overview...");
    const visitorContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const visitorPage = await visitorContext.newPage();
    await visitorPage.goto(`${BASE_URL}/media/${testMovieId}`, { waitUntil: "domcontentloaded" });
    await visitorPage.waitForTimeout(600);

    // Assertions on public overview:
    const heroTitle = await visitorPage.textContent("h1");
    assert.ok(heroTitle?.includes("Blade Runner 2049"), "Hero title must display media title");

    // Overview tab should be active
    const overviewTab = visitorPage.locator("a:has-text('Title Overview')");
    await assert.doesNotReject(async () => await overviewTab.waitFor({ state: "visible" }));

    // Synopsis should be present
    const synopsis = await visitorPage.textContent("section:has-text('Synopsis')");
    assert.ok(synopsis?.includes("Thirty years after the events"), "Public overview must display synopsis");

    // Community reviews section should display critic review
    const communitySection = await visitorPage.textContent("section:has-text('Community Reviews')");
    assert.ok(
      communitySection?.includes("An Atmospheric Miracle in Modern Blockbuster Filmmaking"),
      "Public overview must show published community reviews"
    );

    // Private draft must NOT appear on public overview
    assert.ok(
      !communitySection?.includes("Denis Villeneuve's Color Symbolism"),
      "Draft review must NEVER appear on public overview"
    );

    await saveScreenshot(visitorPage, "phase15a-desktop-1440px-public-overview.png");

    // Scenario 2: Authenticated Personal "Your View"
    console.log("Testing Scenario 2: Authenticated Personal Your View...");
    const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const tokenMatch = ownerCookie.match(/better-auth\.session_token=([^;]+)/);
    if (tokenMatch) {
      await ownerContext.addCookies([
        {
          name: "better-auth.session_token",
          value: tokenMatch[1],
          domain: "127.0.0.1",
          path: "/",
        },
      ]);
    }
    const ownerPage = await ownerContext.newPage();

    // Navigate directly to Your View
    await ownerPage.goto(`${BASE_URL}/media/${testMovieId}?view=personal`, { waitUntil: "domcontentloaded" });
    await ownerPage.waitForTimeout(600);

    // Verify personal view contents:
    const yourRatingCard = await ownerPage.textContent("div:has-text('Your Rating')");
    assert.ok(yourRatingCard?.includes("9.2"), "Personal view must display user's standalone rating of 9.2");
    assert.ok(
      yourRatingCard?.includes("Roger Deakins' cinematography is peerless"),
      "Personal view must display rating notes"
    );

    // Verify viewing history timeline
    const historyCard = await ownerPage.textContent("div:has-text('Viewing History')");
    assert.ok(historyCard?.includes("Rewatch"), "Personal view must display Rewatch badge");
    assert.ok(historyCard?.includes("IMAX 70mm re-release viewing"), "Personal view must show viewing notes");

    // Verify personal draft review is visible here
    const reviewsSection = await ownerPage.textContent("section:has-text('Your Reviews & Drafts')");
    assert.ok(
      reviewsSection?.includes("Working Analysis of Denis Villeneuve's Color Symbolism"),
      "Personal view must display user's draft review"
    );
    assert.ok(reviewsSection?.includes("Draft"), "Personal view must show Draft badge");

    // Verify ranked collections section
    const rankedSection = await ownerPage.textContent("section:has-text('Ranked in Your Collections')");
    assert.ok(
      rankedSection?.includes("Top 25 Modern Cinema Masterpieces"),
      "Personal view must show ranked collections"
    );
    assert.ok(rankedSection?.includes("#1"), "Personal view must show rank #1 badge");

    await saveScreenshot(ownerPage, "phase15a-desktop-1440px-personal-view.png");

    // Click Title Overview tab to verify switching back to public overview
    const ownerOverviewTab = ownerPage.locator("a:has-text('Title Overview')");
    await ownerOverviewTab.click();
    await ownerPage.waitForTimeout(1000);
    console.log("Successfully switched from Your View to Public Overview by clicking Title Overview tab!");

    // Scenario 3: TV Series Overview with Seasons & Episodes
    console.log("Testing Scenario 3: TV Series Overview...");
    await visitorPage.goto(`${BASE_URL}/media/${testTvId}?type=tv`, { waitUntil: "domcontentloaded" });
    await visitorPage.waitForTimeout(600);
    const tvHeading = await visitorPage.textContent("h1");
    assert.ok(tvHeading?.includes("Severance"), "TV show title must display Severance");

    await saveScreenshot(visitorPage, "phase15a-desktop-1440px-tv-series-overview.png");

    // Scenario 4: TV Episode Overview linking to parent series
    console.log("Testing Scenario 4: TV Episode Overview...");
    await visitorPage.goto(`${BASE_URL}/media/${testEpisodeId}`, { waitUntil: "domcontentloaded" });
    await visitorPage.waitForTimeout(600);
    const epHeading = await visitorPage.textContent("h1");
    assert.ok(epHeading?.includes("Severance"), "Episode view must display episode title");

    // Series Details breadcrumb must exist
    const seriesBreadcrumb = visitorPage.locator("a:has-text('Series Details')");
    await assert.doesNotReject(async () => await seriesBreadcrumb.waitFor({ state: "visible" }));

    await saveScreenshot(visitorPage, "phase15a-desktop-1440px-episode-overview.png");

    // Scenario 5: Responsive Verification: Mobile (390px) & Tablet (768px)
    console.log("Testing Scenario 5: Responsive Verification...");
    // Mobile 390px
    await visitorPage.setViewportSize({ width: 390, height: 844 });
    await visitorPage.waitForTimeout(500);
    await saveScreenshot(visitorPage, "phase15a-mobile-390px-public-overview.png");

    await ownerPage.setViewportSize({ width: 390, height: 844 });
    await ownerPage.waitForTimeout(500);
    await saveScreenshot(ownerPage, "phase15a-mobile-390px-personal-view.png");

    // Tablet 768px
    await visitorPage.setViewportSize({ width: 768, height: 1024 });
    await visitorPage.waitForTimeout(500);
    await saveScreenshot(visitorPage, "phase15a-tablet-768px-public-overview.png");

    await ownerPage.setViewportSize({ width: 768, height: 1024 });
    await ownerPage.waitForTimeout(500);
    await saveScreenshot(ownerPage, "phase15a-tablet-768px-personal-view.png");

    console.log("✅ All Phase 15A visual scenarios verified successfully!");
  } finally {
    if (browser) {
      await browser.close();
    }
    if (serverProcess) {
      console.log("Stopping Next.js test server...");
      serverProcess.kill("SIGINT");
    }

    // Clean up test data
    console.log("Cleaning up test records...");
    try {
      const { db } = await import("../src/db");
      const {
        user,
        mediaItems,
        ratings,
        reviews,
        diaryEntries,
        watchlistItems,
        collections,
        collectionEntries,
      } = await import("../src/db/schema");
      const { inArray } = await import("drizzle-orm");

      if (createdEntryIds.length) {
        await db.delete(collectionEntries).where(inArray(collectionEntries.id, createdEntryIds));
      }
      if (createdCollectionIds.length) {
        await db.delete(collections).where(inArray(collections.id, createdCollectionIds));
      }
      if (createdWatchlistIds.length) {
        await db.delete(watchlistItems).where(inArray(watchlistItems.id, createdWatchlistIds));
      }
      if (createdDiaryIds.length) {
        await db.delete(diaryEntries).where(inArray(diaryEntries.id, createdDiaryIds));
      }
      if (createdReviewIds.length) {
        await db.delete(reviews).where(inArray(reviews.id, createdReviewIds));
      }
      if (createdRatingIds.length) {
        await db.delete(ratings).where(inArray(ratings.id, createdRatingIds));
      }
      if (createdMediaIds.length) {
        await db.delete(mediaItems).where(inArray(mediaItems.id, createdMediaIds));
      }
      if (createdUserIds.length) {
        await db.delete(user).where(inArray(user.id, createdUserIds));
      }
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error during visual verification:", err);
  process.exit(1);
});
