# Aubrey Rankings — Product Roadmap (Phases 15C – 16)

This durable roadmap governs the final phases of Aubrey Rankings development, continuing from Phase 15B's production verification through Phases 15C, 15D, 15E, and 16.

---

## 1. Core Product Philosophy

1. **One Media Identity**: A film, TV series, or individual episode has exactly one canonical database identity (`media_items`) across Library, Journal, reviews, rankings, Discover, Feed, and Title Overview pages.
2. **Two Connected Views**:
   * **Your View** (`/media/[id]?view=personal`): Owner's private workspace, viewing history, authoritative notes, personal reviews, and saved ratings.
   * **Title Overview** (`/media/[id]`): Public community hub displaying community scores, authorized public reviews, and public rankings featuring the title.
   * Switching between them preserves contextual back-navigation.
3. **Notes vs. Reviews**:
   * Private Notes (`media_notes`) is strictly one canonical private record per user and title.
   * Reviews (`reviews`) are distinct, independently publishable writing records with individual ratings, privacy settings, and publication dates. Users can write multiple reviews for a single title.
4. **Reviews vs. Rankings**:
   * Review ratings represent individual opinions.
   * Ranking scores (`collection_entries`, rubric scores) are collection-specific evaluations.
   * Never silently conflate, synchronize, or average ranking rubric scores into review ratings.
5. **One Accurate Personal History**:
   * The Journal displays authentic dated events.
   * Rewatches and multiple reviews are preserved.
   * Historical dates are never fabricated from audit timestamps or import markers.
6. **Explicit Privacy**:
   * Private notes, drafts, unpublished reviews, and unshared ratings must remain private.
   * Visitors never receive unshared data (payloads send `null` or are excluded in SQL).
7. **Unmistakable Ownership**:
   * Visitors can browse and interact with permitted public content (likes, comments).
   * Visitors must never encounter controls implying they can edit, delete, or modify another person's ratings, reviews, or rankings.
8. **Visually Rich but Restrained**:
   * Editorial, cinematic typography, 2:3 posters, clear hierarchy, responsive layout.
   * Strict adherence to design tokens; no hardcoded hex colors or arbitrary overrides.
9. **Reuse Instead of Duplicate**:
   * Extend existing tables, APIs, and components rather than creating parallel systems.
   * Retire legacy paths safely without breaking historical data.
10. **Protect Production**:
    * Zero data resets. Additive, checksum-protected migrations only. Verified backups before writes.

---

## 2. Phase Execution Sequence & Deliverables

### Checkpoint 0 — Phase 15B Production Maintenance
* **Status**: Completed (2026-10-24).
* **Summary**: Deployed revision `a644e922a91c69e0500ae31b65ac8775d58139a4` verified on production. Pre-maintenance backup verified. Packaged maintenance runner executed on production for account `TfQ9INqotAsMcG5HpaSue54fW49l7CHQ`. Idempotence confirmed.
* **Documented Limitations**: 25 imported Letterboxd reviews lack original verified review dates and remain safely undated pending reimport with the original export ZIP. 1 review is unpublished/private with no activity event. 5 pre-0020 watchlist items retain native timestamps.

---

### Phase 15C — Public Title Overview, Community Ratings & Ownership
* **Branch**: `feature/phase15c-public-title-overview`
* **Goal**: Transform the public Title Overview (`/media/[id]`) into an authoritative, trustworthy community hub.
* **Scope**:
  * **Community Review Scores**:
    * Calculate community average score from all eligible, explicitly shared review ratings (`reviews.status = 'published'`, `reviews.visibility = 'public'`, `reviews.share_rating = true`, rating is not null).
    * Count all public rated reviews independently (multiple reviews from the same account each count toward community score).
    * Normalize scores using authentic source scales (e.g., Letterboxd 5-star / half-star scaled to 10 or 5-star standard).
    * Exclude drafts, private reviews, unshared ratings, and independent ranking rubric scores.
    * Provide rating count, community average, and distribution histogram (1–5 stars or half-star buckets).
    * Gracefully handle titles with zero public ratings.
  * **Community Reviews Section**:
    * Display authorized public reviews for the media item.
    * Author details, review score (if shared), authentic published date, spoiler masking controls.
    * Multiple reviews by the same author appear with distinct identities.
    * Exclude private notes, legacy commentary, drafts, and blocked users.
    * Connect to existing like/comment interactions without duplicating social tables.
  * **Public Rankings Featuring this Title**:
    * Query public collections (`collections.visibility = 'public'`) containing this media item.
    * Display owner, rank/tier placement, and direct link to the canonical collection.
    * Exclude unlisted or private collections.
  * **Ownership & Contextual Navigation**:
    * Clear distinction: Visitors see public Title Overview; owners see link to "Your View".
    * Edit/delete controls never shown to non-owners.
    * Contextual Back navigation preserves origin (`?from=...`) across views and tabs.
* **Deliverable**: Independent PR, integration tests, design system compliance, passing CI.

---

### Phase 15D — Visual Feed & Tier-List Overhaul
* **Branch**: `feature/phase15d-visual-feed-tier-lists`
* **Goal**: Editorial, visually rich activity feed rendering real tier lists with poster previews.
* **Scope**:
  * Real tier list preview cards in social feed with actual tier labels and poster rows.
  * Responsive layout, expandable preview for large rankings.
  * Prominent authorship, visual hierarchy, no stretched posters.
  * Visitor read-only guarantees; no private activity leakage.
* **Deliverable**: Independent PR, visual & integration tests, passing CI.

---

### Phase 15E — Final Visual & UX Consolidation
* **Branch**: `feature/phase15e-visual-ux-consolidation`
* **Goal**: Final UI polish, design token consolidation, and poster-first Standalone Ratings.
* **Scope**:
  * Palette updates: Signature Pink (`#E8638B`) default for new users, Dusty Rose, Classic Teal (`#89D5D5`).
  * Poster-first Standalone Ratings page (proportional 2:3 posters, clear 5-star display).
  * Consistency pass across Library, Journal, Your View, Title Overview, Feed, Discover, Settings.
* **Deliverable**: Independent PR, responsive Playwright tests, passing CI.

---

### Phase 16 — Interactive Onboarding
* **Branch**: `feature/phase16-interactive-onboarding`
* **Goal**: Lightweight, non-intrusive product walkthrough introducing Aubrey's unified experience.
* **Scope**:
  * Walkthrough covering Library, Your View, Title Overview, Journal, Notes vs. Reviews, Rankings, and Feed.
  * Short, skippable, repeatable from Settings.
  * Accessible, mobile-friendly, respects existing username onboarding.
* **Deliverable**: Independent PR, test coverage for new/existing users, passing CI.

---

## 3. Governance Rules
* Strict phase progression: **15C → 15D → 15E → 16**.
* One independent PR per phase branched from verified `main`.
* No merging or deploying without explicit user approval.
* Full test suite and design system checks must pass before opening PR.
