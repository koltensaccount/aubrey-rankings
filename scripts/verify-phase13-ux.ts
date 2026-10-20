import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, ChildProcess, execSync } from "node:child_process";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { db, pool } from "../src/db";
import {
  user,
  mediaItems,
  ratings,
  reviews,
} from "../src/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "../src/lib/auth";

try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
} catch {}

const PORT = 3012;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";

const tag = randomUUID().slice(0, 6);
const testUser = {
  name: `Phase 13 Critic ${tag}`,
  email: `critic-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `critic_${tag}`,
};

let serverProcess: ChildProcess | null = null;
let userId: string = "";
let sessionCookie: string = "";
let testMovieId: string = "";
let testEpisodeId: string = "";

async function setup() {
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
  await db.update(user).set({ username: testUser.username, emailVerified: true }).where(eq(user.id, userId));

  // Seed sample movie & episode (with parent TV show for foreign key constraint)
  testMovieId = `tmdb-movie-550`;
  const parentTvId = "tv_1399";
  testEpisodeId = `tv_1399_s1_e1`;

  await db.insert(mediaItems).values({
    id: parentTvId,
    tmdbId: 1399,
    mediaType: "tv",
    title: "Game of Thrones",
    overview: "Seven noble families fight for control of the mythical land of Westeros.",
    posterPath: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
  }).onConflictDoNothing();

  await db.insert(mediaItems).values([
    {
      id: testMovieId,
      tmdbId: 550,
      mediaType: "movie",
      title: "Fight Club",
      overview: "An insomniac office worker and a devil-may-care soap maker form an underground fight club.",
      posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    },
    {
      id: testEpisodeId,
      tmdbId: 63056,
      mediaType: "episode",
      title: "Game of Thrones: Winter Is Coming",
      seasonNumber: 1,
      episodeNumber: 1,
      stillPath: "/wrGWeW4WKxnaeA8sxJb2T9O6hm8.jpg",
      parentMediaId: parentTvId,
    },
  ]).onConflictDoNothing();

  // Seed one draft review for the user
  await db.insert(reviews).values({
    id: `rev_draft_${tag}`,
    userId,
    mediaItemId: testMovieId,
    title: "Draft Critique of Fight Club",
    content: "Exploring the psychological breakdown and cinematic style of Fincher.",
    draftContent: "Exploring the psychological breakdown and cinematic style of Fincher.",
    status: "draft",
    visibility: "private",
    isSpoiler: false,
    isJournal: true,
  });

  // Seed one standalone rating
  await db.insert(ratings).values({
    id: `rating_ep_${tag}`,
    userId,
    mediaItemId: testEpisodeId,
    calculatedOverallScore: 9.0,
    sourceRating: 9.0,
    sourceScale: 10,
  });

  // Start standalone server
  console.log(`Starting standalone server on port ${PORT}...`);
  serverProcess = spawn("node", [".next/standalone/server.js"], {
    env: { ...process.env, PORT: String(PORT), HOSTNAME: "localhost" },
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
  if (userId) {
    try {
      await db.delete(reviews).where(eq(reviews.userId, userId));
      await db.delete(ratings).where(eq(ratings.userId, userId));
      await db.delete(user).where(eq(user.id, userId));
    } catch {}
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
    const desktopPage = await desktopVisitorContext.newPage();
    await desktopPage.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    // Assert balanced hero copy
    const heroHeading = await desktopPage.textContent("h1");
    console.log("Hero Heading:", heroHeading?.replace(/\s+/g, " ").trim());
    assert.ok(heroHeading?.includes("LOG. CRITIQUE.") || heroHeading?.includes("Log. Critique."));
    assert.ok(heroHeading?.includes("RANK WHAT YOU WATCH") || heroHeading?.includes("Rank What You Watch."));

    // Screenshot 1: Logged-out Homepage Desktop
    await desktopPage.screenshot({
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
    // Journey 2: Authenticated User Navigation & My Library
    // =========================================================================
    console.log("Verifying Journey 2: Authenticated User Navigation & My Library...");
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
    // Journey 3: Discover Page with Direct Add to Journal & TV Episode Flow
    // =========================================================================
    console.log("Verifying Journey 3: Discover Page...");
    await authPage.route("**/api/tmdb/search*", async (route) => {
      const url = new URL(route.request().url());
      const q = (url.searchParams.get("q") || "").toLowerCase();
      if (q.includes("game")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: [
              {
                id: 1399,
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
                id: 550,
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
    console.log("Searching for 'Fight Club' on Discover...");
    const searchInput = await authPage.$('input[type="text"]');
    assert.ok(searchInput);
    await searchInput.fill("Fight Club");
    await authPage.waitForTimeout(1500);

    // Verify Add to Journal button appears in movie results
    const journalActionOnCard = await authPage.$('a:has-text("Add to Journal")');
    assert.ok(journalActionOnCard, "Movie result card must have 'Add to Journal' action");

    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey3-discover-movie-search.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey3-discover-movie-search.png");

    // Search for a TV Show
    console.log("Searching for 'Game of Thrones' on Discover...");
    await searchInput.fill("Game of Thrones");
    await authPage.waitForTimeout(1500);

    const tvActionOnCard = await authPage.$('a:has-text("Episodes & Journal")');
    assert.ok(tvActionOnCard, "TV result card must have 'Episodes & Journal' action");

    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey3-discover-tv-search.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey3-discover-tv-search.png");

    // =========================================================================
    // Journey 4: Media Detail Hierarchy & TV Episodes Journaling
    // =========================================================================
    console.log("Verifying Journey 4: Media Detail Hierarchy...");
    // 4a. Movie Page
    await authPage.goto(`${BASE_URL}/media/${testMovieId}?type=movie`, { waitUntil: "networkidle" });

    // Assert Media Action Bar exists near the top
    const mediaActionBar = await authPage.$('section[aria-label="Media actions"]');
    assert.ok(mediaActionBar, "Primary Media actions bar must be rendered near the top");

    // Assert canonical journal button is in the action bar, not down in community reviews
    const journalBtnInActionBar = await mediaActionBar.$('#canonical-journal-button');
    assert.ok(journalBtnInActionBar, "Canonical journal button must be located in top action bar");

    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey4-movie-detail-desktop.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey4-movie-detail-desktop.png");

    // Click Add to Journal to open Journal Editor Dialog
    console.log("Opening Journal Editor Dialog from top action bar...");
    await journalBtnInActionBar.click();
    await authPage.waitForTimeout(800);

    const dialog = await authPage.$('[role="dialog"]');
    assert.ok(dialog, "ReviewEditorDialog should open when clicking Journal button");

    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey4-journal-editor-dialog.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey4-journal-editor-dialog.png");

    // Close dialog
    const cancelBtn = await dialog.$('button:has-text("Cancel")');
    if (cancelBtn) await cancelBtn.click();
    await authPage.waitForTimeout(400);

    // 4b. TV Series Page: Seasons & Episodes
    console.log("Navigating to TV series details page...");
    await authPage.goto(`${BASE_URL}/media/1399?type=tv`, { waitUntil: "networkidle" });
    await authPage.waitForTimeout(1000);

    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey4-tv-series-episodes-desktop.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey4-tv-series-episodes-desktop.png");

    // =========================================================================
    // Journey 5: Dedicated /journal Destination
    // =========================================================================
    console.log("Verifying Journey 5: Dedicated /journal Destination...");
    await authPage.goto(`${BASE_URL}/journal`, { waitUntil: "networkidle" });

    const journalHeading = await authPage.textContent("h1");
    console.log("Journal Heading:", journalHeading);
    assert.ok(journalHeading?.includes("My Journal") || journalHeading?.includes("MY JOURNAL"));

    // Verify summary metrics are present
    const totalLogged = await authPage.textContent("text=Total Logged");
    assert.ok(totalLogged, "Summary metrics should include Total Logged");

    // Verify draft entry and rated entry are visible
    const draftCard = await authPage.$('text=Draft Critique of Fight Club');
    assert.ok(draftCard, "Draft journal entry must be visible in /journal");

    const resumeDraftBtn = await authPage.$('a:has-text("Resume Draft")');
    assert.ok(resumeDraftBtn, "'Resume Draft' action must be available for draft items");

    await authPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "phase13-journey5-my-journal-desktop.png"),
      fullPage: false,
    });
    console.log("Saved screenshot: phase13-journey5-my-journal-desktop.png");

    // =========================================================================
    // Journey 6: Mobile Experience
    // =========================================================================
    console.log("Verifying Journey 6: Mobile Experience...");
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

    console.log("\n🎉 All 6 UI journeys passed with visual evidence captured successfully!");
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
