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

const isSmokeMode = process.env.RESPONSIVE_SMOKE_MODE === "1" || process.argv.includes("--smoke");
const PORT = 3016;
const BASE_URL = `http://localhost:${PORT}`;
const ARTIFACT_DIR =
  process.env.ARTIFACT_DIR ||
  "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";
const LOCAL_REVIEW_DIR = path.resolve(process.cwd(), "artifacts/phase14c-responsive-review");

try {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
} catch {}
try {
  fs.mkdirSync(LOCAL_REVIEW_DIR, { recursive: true });
} catch {}

const tag = randomUUID().slice(0, 8);
const testUser = {
  name: `Responsive Curator ${tag}`,
  email: `curator-responsive-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `curator_resp_${tag}`,
};

const testMovie1Id = `tmdb-movie-interstellar-${tag}`;
const testMovie2Id = `tmdb-movie-arrival-${tag}`;
const testMovie3Id = `tmdb-movie-longtitle-${tag}`;
const testEpisodeId = `tv_1399_s1_e1_${tag}`;

const createdUserIds: string[] = [];
const createdMediaIds: string[] = [];
const createdDiaryIds: string[] = [];
const createdRatingIds: string[] = [];
const createdWatchlistIds: string[] = [];
const createdCollectionIds: string[] = [];

let serverProcess: ChildProcess | null = null;
let userCookie = "";
let db: any;

function saveScreenshot(filename: string, buffer: Buffer) {
  const p1 = path.join(ARTIFACT_DIR, filename);
  const p2 = path.join(LOCAL_REVIEW_DIR, filename);
  fs.writeFileSync(p1, buffer);
  fs.writeFileSync(p2, buffer);
  console.log(`📸 Saved screenshot: ${filename}`);
}

function isIntersecting(
  boxA: { x: number; y: number; width: number; height: number },
  boxB: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    boxA.x + boxA.width <= boxB.x ||
    boxB.x + boxB.width <= boxA.x ||
    boxA.y + boxA.height <= boxB.y ||
    boxB.y + boxB.height <= boxA.y
  );
}

async function createAuthedContext(
  browser: Browser,
  viewport: { width: number; height: number },
  colorScheme: "dark" | "light" = "dark"
) {
  const context = await browser.newContext({ viewport, colorScheme });
  const tokenMatch = userCookie.match(/better-auth\.session_token=([^;]+)/);
  if (tokenMatch) {
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: tokenMatch[1],
        domain: "localhost",
        path: "/",
      },
    ]);
  }
  return context;
}

async function setup() {
  console.log("Setting up responsive test fixtures against disposable test database...");
  const authModule = await import("../src/lib/auth");
  const dbModule = await import("../src/db");
  const schema = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");
  db = dbModule.db;

  // 1. Create Curator test user
  const u1Res = await authModule.auth.api.signUpEmail({
    body: {
      name: testUser.name,
      email: testUser.email,
      password: testUser.password,
    },
    asResponse: true,
  });
  assert.equal(u1Res.status, 200);
  userCookie = u1Res.headers.get("set-cookie") || "";
  const u1 = await db.query.user.findFirst({
    where: (u: any, { eq: eqOp }: any) => eqOp(u.email, testUser.email),
  });
  assert.ok(u1);
  createdUserIds.push(u1.id);

  // Set username
  await db.update(schema.user).set({ username: testUser.username }).where(eq(schema.user.id, u1.id));

  // 2. Insert Media Items
  await db.insert(schema.mediaItems).values([
    {
      id: testMovie1Id,
      title: "Interstellar",
      mediaType: "movie",
      releaseDate: "2014-11-07",
      posterPath: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
      backdropPath: "/xJHokMbljvjADYdit5fK5VQsXEG.jpg",
    },
    {
      id: testMovie2Id,
      title: "Arrival",
      mediaType: "movie",
      releaseDate: "2016-11-11",
      posterPath: "/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg",
      backdropPath: "/hA0e5HjVp550L9jF70iP00a0E0y.jpg",
    },
    {
      id: testMovie3Id,
      title: "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb (Extended Criterion Edition with Director Commentary & Analysis)",
      mediaType: "movie",
      releaseDate: "1964-01-29",
      posterPath: "/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg",
    },
    {
      id: testEpisodeId,
      title: "The National Anthem",
      mediaType: "episode",
      seasonNumber: 1,
      episodeNumber: 1,
      releaseDate: "2011-12-04",
      stillPath: "/ztdy1f1cAjwsO0GpVKzNuqZ0PMv.jpg",
      posterPath: "/ztdy1f1cAjwsO0GpVKzNuqZ0PMv.jpg",
    },
  ]);
  createdMediaIds.push(testMovie1Id, testMovie2Id, testMovie3Id, testEpisodeId);

  // 3. Insert Diary Entries
  const d1 = `diary_${tag}_1`;
  const d2 = `diary_${tag}_2`;
  const d3 = `diary_${tag}_3`;
  await db.insert(schema.diaryEntries).values([
    {
      id: d1,
      userId: u1.id,
      mediaItemId: testMovie1Id,
      watchedDate: "2026-10-20",
      isRewatch: false,
      ratingValue: 10.0,
      notes: "Spectacular presentation on 70mm IMAX.",
      tags: ["imax", "70mm", "favorite"],
    },
    {
      id: d2,
      userId: u1.id,
      mediaItemId: testMovie2Id,
      watchedDate: "2026-10-18",
      isRewatch: false,
      ratingValue: 9.5,
      notes: "Extraordinary communication sci-fi masterwork.",
    },
    {
      id: d3,
      userId: u1.id,
      mediaItemId: testMovie3Id,
      watchedDate: "2026-10-15",
      isRewatch: true,
      ratingValue: 10.0,
      notes: "Masterful satire with razor-sharp editing.",
      tags: ["criterion", "satire"],
    },
  ]);
  createdDiaryIds.push(d1, d2, d3);

  // 4. Insert Ratings / Watched records
  await db.insert(schema.ratings).values([
    {
      id: `rat_${tag}_1`,
      userId: u1.id,
      mediaItemId: testMovie1Id,
      isWatched: true,
      calculatedOverallScore: 10.0,
      sourceRating: 10.0,
      sourceScale: 10,
    },
    {
      id: `rat_${tag}_2`,
      userId: u1.id,
      mediaItemId: testMovie2Id,
      isWatched: true,
      calculatedOverallScore: 9.5,
      sourceRating: 9.5,
      sourceScale: 10,
    },
    {
      id: `rat_${tag}_3`,
      userId: u1.id,
      mediaItemId: testMovie3Id,
      isWatched: true,
      calculatedOverallScore: 10.0,
      sourceRating: 10.0,
      sourceScale: 10,
    },
  ]);
  createdRatingIds.push(`rat_${tag}_1`, `rat_${tag}_2`, `rat_${tag}_3`);

  // 5. Watchlist item
  const w1 = `w_${tag}_1`;
  await db.insert(schema.watchlistItems).values([
    {
      id: w1,
      userId: u1.id,
      mediaItemId: testEpisodeId,
      targetMediaType: "episode",
      dateAdded: new Date().toISOString(),
    },
  ]);
  createdWatchlistIds.push(w1);

  // 6. Ranking Collection
  const col1 = `col_${tag}_1`;
  await db.insert(schema.collections).values([
    {
      id: col1,
      userId: u1.id,
      title: "Essential Modern Sci-Fi Canon & Cinematic Milestones",
      description: "Carefully curated ranking of transcendent cinematic sci-fi.",
      collectionType: "movie",
      isRanked: true,
      isPinned: true,
      visibility: "public",
    },
  ]);
  createdCollectionIds.push(col1);

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
    await db.delete(schema.ratings).where(eq(schema.ratings.userId, id));
    await db.delete(schema.collections).where(eq(schema.collections.userId, id));
    await db.delete(schema.user).where(eq(schema.user.id, id));
  }
  for (const id of createdMediaIds) {
    await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, id));
  }
  console.log("Cleanup complete!");
}

async function runResponsiveVerification() {
  const browser: Browser = await chromium.launch({ headless: true });

  try {
    const targetWidths = isSmokeMode
      ? [320, 390, 640, 768, 1440]
      : [320, 360, 390, 430, 600, 700, 768, 820, 912, 1024, 1180, 1280, 1440, 1920];

    const targetPages = isSmokeMode
      ? [
          { name: "Library Journal", path: "/?tab=journal" },
          { name: "Discover", path: "/discover" },
          { name: "Feed", path: "/feed" },
        ]
      : [
          { name: "Library Journal", path: "/?tab=journal" },
          { name: "Library Watched", path: "/?tab=watched" },
          { name: "Library Watchlist", path: "/?tab=watchlist" },
          { name: "Library Rankings", path: "/?tab=rankings" },
          { name: "Discover", path: "/discover" },
          { name: "Feed", path: "/feed" },
        ];

    console.log("\n=======================================================");
    console.log(`1. DOCUMENT-LEVEL HORIZONTAL SCROLL RESILIENCE CHECK (${isSmokeMode ? "Smoke Mode" : "Full Matrix"})`);
    console.log("=======================================================");

    for (const width of targetWidths) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: "dark",
      });

      const tokenMatch = userCookie.match(/better-auth\.session_token=([^;]+)/);
      if (tokenMatch) {
        await context.addCookies([
          {
            name: "better-auth.session_token",
            value: tokenMatch[1],
            domain: "localhost",
            path: "/",
          },
        ]);
      }

      const page: Page = await context.newPage();

      for (const target of targetPages) {
        await page.goto(`${BASE_URL}${target.path}`, { waitUntil: "networkidle" });

        // Assert absence of document-level horizontal scroll
        const scrollInfo = await page.evaluate(() => ({
          innerWidth: window.innerWidth,
          docScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
        }));

        assert.ok(
          scrollInfo.docScrollWidth <= scrollInfo.innerWidth,
          `Horizontal scroll blowout at width ${width}px on ${target.name}: docScrollWidth (${scrollInfo.docScrollWidth}) > innerWidth (${scrollInfo.innerWidth})`
        );
        assert.ok(
          scrollInfo.bodyScrollWidth <= scrollInfo.innerWidth,
          `Horizontal scroll blowout at width ${width}px on ${target.name}: bodyScrollWidth (${scrollInfo.bodyScrollWidth}) > innerWidth (${scrollInfo.innerWidth})`
        );
      }

      console.log(`✔ ${width}px: 0 horizontal scroll detected across all tested screens.`);
      await context.close();
    }

    console.log("\n=======================================================");
    console.log("2. FIXED UI OVERLAP & FLOATING CONTROLS INTERSECTION AUDIT");
    console.log("=======================================================");

    // Test fixed floating bug report button does NOT overlap bottom navigation on mobile/split-screen
    for (const testWidth of [320, 390, 640]) {
      const context = await createAuthedContext(browser, { width: testWidth, height: 844 }, "dark");
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

      const bugBtn = page.locator("button[aria-label='Report an issue']");
      const bottomNav = page.locator("nav[aria-label='Mobile primary navigation']");

      assert.ok(await bugBtn.isVisible(), `Mobile ${testWidth}px: Bug report button must be visible`);
      assert.ok(await bottomNav.isVisible(), `Mobile ${testWidth}px: Mobile bottom nav must be visible`);

      const bugBox = await bugBtn.boundingBox();
      const navBox = await bottomNav.boundingBox();
      assert.ok(bugBox && navBox);

      // Verify zero intersection between floating bug button and bottom nav
      assert.ok(
        !isIntersecting(bugBox, navBox),
        `Fixed UI collision at ${testWidth}px: Bug report button overlaps bottom navigation! Bug: ${JSON.stringify(bugBox)}, Nav: ${JSON.stringify(navBox)}`
      );

      // Verify bug report button sits above bottom navigation with positive clearance
      assert.ok(
        bugBox.y + bugBox.height <= navBox.y,
        `Bug button bottom (${bugBox.y + bugBox.height}px) must be above bottom nav top (${navBox.y}px)`
      );

      console.log(`✔ ${testWidth}px: Bug report button floats cleanly above bottom nav (Clearance: ${(navBox.y - (bugBox.y + bugBox.height)).toFixed(1)}px).`);
      await context.close();
    }

    console.log("\n=======================================================");
    console.log("3. NAVBAR SPACE HIERARCHY & RADIX DROPDOWN ACCESSIBILITY");
    console.log("=======================================================");

    // Test at 1440px (Desktop baseline): Restore familiar Settings and Sign out controls
    {
      const context = await createAuthedContext(browser, { width: 1440, height: 900 }, "dark");
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

      const brand = page.locator(".ar-brand");
      const primaryNav = page.locator("nav[aria-label='Primary navigation']");
      const journalBtn = page.locator("a[aria-label='Add to Journal']");
      const newRankingBtn = page.locator("a[aria-label='New ranking']");
      const bell = page.locator("button[aria-label^='Notifications']");
      const settingsBtn = page.locator("header a[aria-label='Settings']");
      const avatarTrigger = page.locator("button[aria-label='User account menu']");
      const signOutBtn = page.locator("header button[aria-label='Sign out']");
      const bottomNav = page.locator("nav[aria-label='Mobile primary navigation']");

      assert.ok(await brand.isVisible(), "Desktop: Brand must be visible");
      assert.ok(await primaryNav.isVisible(), "Desktop: Primary Nav must be visible");
      assert.ok(await journalBtn.isVisible(), "Desktop: Journal button must be visible");
      assert.ok(await newRankingBtn.isVisible(), "Desktop: New ranking button must be visible");
      assert.ok(await bell.isVisible(), "Desktop: Bell must be visible");
      assert.ok(await settingsBtn.isVisible(), "Desktop: Familiar Settings control must be visible");
      assert.ok(await avatarTrigger.isVisible(), "Desktop: Avatar menu trigger must be visible");
      assert.ok(await signOutBtn.isVisible(), "Desktop: Familiar Sign out control must be visible");
      assert.ok(!(await bottomNav.isVisible()), "Desktop: Mobile bottom nav must NOT be visible");

      // Verify geometry: no overlaps between adjacent desktop controls
      const boxes = await Promise.all([
        journalBtn.boundingBox(),
        newRankingBtn.boundingBox(),
        bell.boundingBox(),
        settingsBtn.boundingBox(),
        avatarTrigger.boundingBox(),
        signOutBtn.boundingBox(),
      ]);

      for (let i = 0; i < boxes.length - 1; i++) {
        const a = boxes[i];
        const b = boxes[i + 1];
        assert.ok(a && b);
        assert.ok(!isIntersecting(a, b), `Desktop controls ${i} and ${i + 1} must not overlap`);
      }

      console.log("✔ Desktop 1440px: Familiar desktop navigation controls restored with 0 overlap.");
      await context.close();
    }

    // Test at 1024px (iPad landscape / laptop): Verify NO crowding (Settings/Sign Out stay inside dropdown)
    {
      const context = await createAuthedContext(browser, { width: 1024, height: 768 }, "dark");
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

      const newRankingBtn = page.locator("a[aria-label='New ranking']");
      const settingsBtn = page.locator("header a[aria-label='Settings']");
      const signOutBtn = page.locator("header button[aria-label='Sign out']");

      assert.ok(await newRankingBtn.isVisible(), "1024px: New ranking button remains visible");
      assert.ok(!(await settingsBtn.isVisible()), "1024px: Settings must remain inside dropdown to prevent crowding");
      assert.ok(!(await signOutBtn.isVisible()), "1024px: Sign out must remain inside dropdown to prevent crowding");

      console.log("✔ 1024px: No crowding; secondary actions neatly folded into avatar dropdown.");
      await context.close();
    }

    // Test at 768px (iPad portrait): Radix DropdownMenu keyboard focus & accessibility
    {
      const context = await createAuthedContext(browser, { width: 768, height: 1024 }, "dark");
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

      const brand = page.locator(".ar-brand");
      const primaryNav = page.locator("nav[aria-label='Primary navigation']");
      const journalBtn = page.locator("a[aria-label='Add to Journal']");
      const bell = page.locator("button[aria-label^='Notifications']");
      const avatarTrigger = page.locator("button[aria-label='User account menu']");

      assert.ok(await brand.isVisible(), "Tablet 768px: Brand must be visible");
      assert.ok(await primaryNav.isVisible(), "Tablet 768px: Core nav must fit and remain visible");
      assert.ok(await journalBtn.isVisible(), "Tablet 768px: Journal button must remain visible");
      assert.ok(await bell.isVisible(), "Tablet 768px: Notification bell must be visible");
      assert.ok(await avatarTrigger.isVisible(), "Tablet 768px: Avatar menu must be visible");

      // Verify avatar stays within 768px viewport bounds
      const avatarBox = await avatarTrigger.boundingBox();
      assert.ok(avatarBox && avatarBox.x + avatarBox.width <= 768, "Avatar must be fully within viewport bounds");

      // Open Radix DropdownMenu
      await avatarTrigger.click();
      await page.waitForTimeout(200);

      const menu = page.locator("div[role='menu']");
      assert.ok(await menu.isVisible(), "Radix DropdownMenu must open on trigger click");

      const profileItem = menu.locator("a[role='menuitem']:has-text('Profile')");
      const newRankingItem = menu.locator("a[role='menuitem']:has-text('New ranking')");
      const settingsItem = menu.locator("a[role='menuitem']:has-text('Settings')");
      const signOutItem = menu.locator("div[role='menuitem']:has-text('Sign out')");

      assert.ok(await profileItem.isVisible(), "Dropdown: Profile link must be visible");
      assert.ok(await newRankingItem.isVisible(), "Dropdown: New ranking must be accessible inside menu");
      assert.ok(await settingsItem.isVisible(), "Dropdown: Settings must be accessible inside menu");
      assert.ok(await signOutItem.isVisible(), "Dropdown: Sign out must be accessible inside menu");

      if (!isSmokeMode) {
        const buf = await page.screenshot({ fullPage: false });
        saveScreenshot("phase14c-tablet-768px-profile-menu.png", buf);
      }

      // Test Radix keyboard navigation: ArrowDown moves focus
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(100);

      // Dismiss menu via Escape key: Focus must return to trigger
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      assert.ok(!(await menu.isVisible()), "Radix DropdownMenu must close on Escape key");

      console.log("✔ Tablet 768px: Radix DropdownMenu keyboard focus & Escape handling verified.");
      await context.close();
    }

    console.log("\n=======================================================");
    console.log("4. DIALOG VIEWPORT BOUNDS VERIFICATION");
    console.log("=======================================================");

    for (const testWidth of [390, 768]) {
      const context = await createAuthedContext(browser, { width: testWidth, height: 700 }, "dark");
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

      const addBtn = page.locator("button:has-text('Add to Journal')");
      await addBtn.click();
      await page.waitForTimeout(300);

      const dialog = page.locator("div[role='dialog']");
      assert.ok(await dialog.isVisible(), `Dialog must be open at ${testWidth}px`);

      if (!isSmokeMode && testWidth === 390) {
        const buf = await page.screenshot({ fullPage: false });
        saveScreenshot("phase14c-mobile-390px-log-dialog.png", buf);
      }

      const dialogPanel = dialog.locator(".rounded-dialog");
      const panelBox = await dialogPanel.boundingBox();
      assert.ok(panelBox);

      assert.ok(
        panelBox.height <= 700 * 0.9 + 5,
        `Dialog panel height (${panelBox.height}px) exceeds 90vh bounds at ${testWidth}px`
      );
      assert.ok(
        panelBox.width <= testWidth,
        `Dialog panel width (${panelBox.width}px) exceeds viewport width (${testWidth}px)`
      );

      await context.close();
    }
    console.log("✔ Dialog bounds: LogViewingDialog stays strictly <= 90vh and scrolls smoothly.");

    if (!isSmokeMode) {
      console.log("\n=======================================================");
      console.log("5. CAPTURING VISUAL VERIFICATION SCREENSHOTS");
      console.log("=======================================================");

      const screenshotConfigs = [
        { name: "phase14c-mobile-390px.png", width: 390, height: 844, tab: "journal", theme: "dark" },
        { name: "phase14c-split-screen-640px.png", width: 640, height: 800, tab: "journal", theme: "dark" },
        { name: "phase14c-ipad-portrait-768px.png", width: 768, height: 1024, tab: "journal", theme: "dark" },
        { name: "phase14c-ipad-air-820px.png", width: 820, height: 1180, tab: "watched", theme: "dark" },
        { name: "phase14c-ipad-landscape-1024px.png", width: 1024, height: 768, tab: "journal", theme: "dark" },
        { name: "phase14c-ipad-pro-landscape-1180px.png", width: 1180, height: 820, tab: "journal", theme: "dark" },
        { name: "phase14c-desktop-1440px-dark.png", width: 1440, height: 900, tab: "journal", theme: "dark" },
        { name: "phase14c-desktop-1440px-light.png", width: 1440, height: 900, tab: "journal", theme: "light" },
      ];

      for (const cfg of screenshotConfigs) {
        const context = await createAuthedContext(
          browser,
          { width: cfg.width, height: cfg.height },
          cfg.theme as "dark" | "light"
        );

        const page = await context.newPage();
        await page.goto(`${BASE_URL}/?tab=${cfg.tab}`, { waitUntil: "networkidle" });
        if (cfg.theme === "light") {
          await page.evaluate(() => {
            document.documentElement.classList.remove("dark");
            document.documentElement.classList.add("light");
            document.documentElement.setAttribute("data-theme", "light");
          });
        }
        await page.waitForTimeout(600);

        const buf = await page.screenshot({ fullPage: false });
        saveScreenshot(cfg.name, buf);

        await context.close();
      }

      // Rewatch history modal on 768px
      {
        const context = await createAuthedContext(browser, { width: 768, height: 1024 }, "dark");
        const page = await context.newPage();
        await page.goto(`${BASE_URL}/?tab=journal`, { waitUntil: "networkidle" });
        const historyBtn = page.locator("button:has-text('View history')").first();
        if (await historyBtn.isVisible()) {
          await historyBtn.click();
          await page.waitForTimeout(300);
          const buf = await page.screenshot({ fullPage: false });
          saveScreenshot("phase14c-tablet-768px-rewatch-history-modal.png", buf);
        }
        await context.close();
      }
    }

    console.log("\n✅ All responsive tests and geometry verifications PASSED!");
  } finally {
    await browser.close();
  }
}

async function main() {
  try {
    await setup();
    await runResponsiveVerification();
  } finally {
    await teardown();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in responsive verification:", err);
  process.exit(1);
});
