import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// =============================================================================
// Safety Precondition: Verify Test Execution Mode
// =============================================================================
try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
} catch {}

const isOptedIn = process.env.AUBREY_TEST_MODE === "1" || process.env.ALLOW_TEST_DB_WRITES === "1";
if (!isOptedIn) {
  throw new Error(
    "Phase 14C Test aborted: Refusing to run without explicit test execution opt-in. Set AUBREY_TEST_MODE=1 or ALLOW_TEST_DB_WRITES=1 to run against a dedicated disposable test database."
  );
}

test("Phase 14C: Defensive Responsive Design & Layout Resilience", async (t) => {
  const rootDir = process.cwd();

  await t.test("1. Responsive Navbar: adheres strictly to 5-tier priority hierarchy", async () => {
    const navbarFile = fs.readFileSync(path.join(rootDir, "src/components/navbar.tsx"), "utf8");

    // Priority 1: Branding
    assert.ok(navbarFile.includes('className="ar-brand shrink-0"'), "Brand must be marked shrink-0 to protect against overflow");

    // Priority 2: Primary nav with progressive spacing
    assert.ok(navbarFile.includes('nav aria-label="Primary navigation"'), "Primary nav must be present");
    assert.ok(navbarFile.includes("hidden md:flex"), "Primary nav must activate cleanly on tablet/desktop");

    // Priority 3: Main Add/Log action
    assert.ok(navbarFile.includes('aria-label="Add to Journal"'), "Add to Journal button must be present");
    assert.ok(navbarFile.includes('<span className="hidden sm:inline">Journal</span>'), "Journal text hides on phone, shows on sm+");

    // Priority 4: Notifications and Avatar
    assert.ok(navbarFile.includes("<NotificationBell />"), "NotificationBell must be present");
    assert.ok(navbarFile.includes('aria-label="User account menu"'), "Avatar trigger must have accessible account menu label");

    // Priority 5: Secondary actions inside accessible menu
    assert.ok(navbarFile.includes('role="menu"'), "Profile dropdown menu must have role='menu'");
    assert.ok(navbarFile.includes('role="menuitem"'), "Menu items must have role='menuitem'");
    assert.ok(navbarFile.includes('href="/create"'), "New ranking must be accessible inside menu");
    assert.ok(navbarFile.includes('href="/settings"'), "Settings must be accessible inside menu");
    assert.ok(navbarFile.includes("handleSignOut"), "Sign out action must be accessible inside menu");

    // Accessibility: Escape key and outside click handling
    assert.ok(navbarFile.includes('event.key === "Escape"'), "Menu must support Escape key dismissal");
    assert.ok(navbarFile.includes("handleClickOutside"), "Menu must support outside-click dismissal");

    // Mobile bottom navigation preserved
    assert.ok(navbarFile.includes('aria-label={session ? "Mobile primary navigation" : "Mobile public navigation"}'), "Mobile bottom nav preserved");
    assert.ok(navbarFile.includes("env(safe-area-inset-bottom)"), "Mobile bottom nav must respect safe-area insets");
  });

  await t.test("2. Viewport-safe dialog sizing: dialogs must never exceed viewport height with min-h-0", async () => {
    const logDialogFile = fs.readFileSync(path.join(rootDir, "src/components/library/log-viewing-dialog.tsx"), "utf8");
    const rewatchModalFile = fs.readFileSync(path.join(rootDir, "src/components/library/rewatch-history-modal.tsx"), "utf8");

    // LogViewingDialog checks
    assert.ok(logDialogFile.includes("max-h-[90vh]"), "LogViewingDialog must clamp to max-h-[90vh]");
    assert.ok(logDialogFile.includes("flex-1 min-h-0 overflow-y-auto"), "LogViewingDialog content must have flex-1 min-h-0 overflow-y-auto");

    // RewatchHistoryModal checks
    assert.ok(rewatchModalFile.includes("max-h-[90vh]"), "RewatchHistoryModal must clamp to max-h-[90vh]");
    assert.ok(rewatchModalFile.includes("flex-1 min-h-0 overflow-y-auto"), "RewatchHistoryModal content must have flex-1 min-h-0 overflow-y-auto");
  });

  await t.test("3. Media grids: responsive columns without squeezed cards", async () => {
    const watchedGridFile = fs.readFileSync(path.join(rootDir, "src/components/library/watched-grid.tsx"), "utf8");
    const watchlistGridFile = fs.readFileSync(path.join(rootDir, "src/components/library/watchlist-grid.tsx"), "utf8");

    const expectedGridClass = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4";
    assert.ok(watchedGridFile.includes(expectedGridClass), "WatchedGrid must scale progressively across all 6 breakpoint tiers");
    assert.ok(watchlistGridFile.includes(expectedGridClass), "WatchlistGrid must scale progressively across all 6 breakpoint tiers");
  });

  await t.test("4. Defensive flex protection: min-w-0 on text containers and truncate on titles", async () => {
    const timelineEntryFile = fs.readFileSync(path.join(rootDir, "src/components/library/timeline-entry-card.tsx"), "utf8");
    const feedFile = fs.readFileSync(path.join(rootDir, "src/components/social/community-feed.tsx"), "utf8");

    assert.ok(timelineEntryFile.includes("min-w-0"), "Timeline entry card must include min-w-0 on flex content");
    assert.ok(timelineEntryFile.includes("truncate"), "Timeline entry card must truncate title");

    assert.ok(feedFile.includes("min-w-0"), "Community feed must include min-w-0 on author containers");
    assert.ok(feedFile.includes("truncate"), "Community feed must truncate long author and ranking strings");
  });

  await t.test("5. Absence of global overflow suppression: no overflow:hidden on html or body", async () => {
    const globalsCss = fs.readFileSync(path.join(rootDir, "src/app/globals.css"), "utf8");

    // Must not fix overflow by globally hiding it on root or body
    const hasHtmlOverflowHidden = /html\s*\{[^}]*overflow(-x|-y)?\s*:\s*hidden/i.test(globalsCss);
    const hasBodyOverflowHidden = /body\s*\{[^}]*overflow(-x|-y)?\s*:\s*hidden/i.test(globalsCss);

    assert.equal(hasHtmlOverflowHidden, false, "Global html must not use overflow: hidden to mask component defects");
    assert.equal(hasBodyOverflowHidden, false, "Global body must not use overflow: hidden to mask component defects");
  });
});
