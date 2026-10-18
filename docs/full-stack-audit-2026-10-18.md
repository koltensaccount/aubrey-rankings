# Independent full-stack audit — 18 October 2026

## Scope and baseline

Started with a clean `main` at `dc6e8f4f1f1cd56c516e64b7909f5deeb1dccd48`. Reviewed changes after the earlier audit/logo fixes (`0c4d746`, `4ffd78d`), including `b74619a` and the deployment repair `9dc4a6f`, through `dc6e8f4`. Production's health endpoint and running image label both matched `dc6e8f4` at the start. No concurrent uncommitted work was overwritten.

Reviewed authentication/linking, ownership and visibility, rubric mutations and historical scores, rating UI, uploads/reports, profiles/themes, social APIs, notifications/release tracking, migration history, CI and updater. Read `DESIGN_SYSTEM.md` and compared rendered production components with the three existing prototype screens. No new product feature sprint or database rewrite.

## Confirmed defects and corrections

| Priority | Defect | Correction |
|---|---|---|
| P0 | Rubric PATCH deleted removed categories and their saved scores; changing weights/scale could reinterpret history. Deletion checked references outside its transaction. | Locked, transactional rubric mutations; reject changes to scoring definitions already used by ratings; reject deleting assigned/in-use rubrics. Creation/default selection is atomic. Historical scores are never deleted by a rubric edit. Saved `weightApplied` snapshots remain authoritative for older ratings, even if a rubric was previously edited. |
| P0 | Implicit Google linking accepted unverified local email accounts, allowing a pre-registered password account to retain access after the real email owner linked Google. | Require verified local email for implicit linking; retain existing local identity fields. Existing linked accounts are not destructively rewritten. |
| P0 | Tracking status exposed private ranking titles/TMDB IDs and accepted subscriptions from unrelated users. Old notifications could retain access after a ranking became private. | Enforce collection visibility in the tracking library; suppress inaccessible subscriptions and notification results/counts. |
| P1 | Changing a collection's rubric made historical category IDs look unrated/incompatible. | Return the saved rubric with each rating; editor and status calculations use historical definitions. Explicit, confirmed re-rating is required to replace an existing rubric. Imported source ratings remain visibly rated, including zero values. Ranking order compares score proportions across scales without changing stored values. Profile summaries exclude watch-only rows, preserve zero and use a labeled ten-point mean over all relevant scores. |
| P1 | New runtime uploads relied on Next's startup public-file inventory. | Dynamic, path-validated WebP serving from the persistent uploads volume; verified immediate avatar retrieval from the standalone production server. |
| P1 | Bug reports accepted unbounded descriptions/data URLs; upload decoding and multipart reads lacked bounded payload handling. | Streaming body limits, screenshot format/pixel/size validation and transcoding, image decode limits, sanitized errors and process-local abuse limits. Report administration still fails closed; submission does not grant management access. |
| P1 | A globally processed release event suppressed delivery to other subscribers and retries. | Per-recipient deduplication is authoritative; shared event history no longer suppresses eligible delivery. Tests pre-seed a shared event and verify delivery/retry idempotence. |
| P1 | Release-tracking UI/endpoint existed but production had no scheduler. Cron authentication could reuse the authentication signing secret. | Dedicated internal cron credential, Compose mapping and hourly scheduler; deployment installs the scheduler through the existing updater. Scheduler fails visibly on errors. Off-site backup sync is bounded to 60 seconds; a slow remote cannot indefinitely block a release after the mandatory local snapshot is verified. No application rebuild occurs on the server. |
| P1 | Appearance loaded only on provider mount and shared one storage namespace across accounts. | Reload on authenticated account changes and scope stored preferences by account; guest appearance is separate. |
| P1/P2 | Mobile ranking titles were squeezed almost out of view; specials/missing-season episodes could be rendered as portrait posters; comments were unreadable in light mode. | Mobile row arrangement corrected, episode aspect detection fixed, comments/likes use existing semantic colors, and public-profile accent text has scoped light/dark contrast tokens. Approved artwork composition and movie grid retained. |
| P2 | Sliders did not focus on pointer interaction, stepped relative to zero instead of min, had small targets, and intercepted Escape. | Correct step origin, keyboard focus, expanded pointer target, disabled semantics, click-to-unset and Escape dismissal. Rating dialog traps/restores focus; zero and unset remain distinct. |
| P2 | Malformed profile/notification inputs caused server errors; notification preference creation raced; Explore linked missing usernames to internal IDs. | Validate inputs, upsert preferences, restrict avatar references to the user's upload, and exclude handle-less accounts from profile links/search results. |

## Verification evidence

- All committed SQL migrations applied to a new, isolated local audit database. Existing production migration history was inspected read-only and remained intact through `0007`.
- Automated suite: **99 tests in 21 suites passed**, including added rubric integrity, private tracking, body/rate limits and source-rating regressions. Release tests use controlled TMDB fixtures rather than depending on live network availability.
- `npm run build` succeeded (40 generated routes; additional dynamic endpoints appear in the route listing).
- Expanded `npm run test:http` passed against the built standalone production runtime and isolated database: signup/password login, private collection and ownership boundaries, rubric protection, category persistence/concurrent writes/clearing, score-only clearing preserving reviews, explicit system replacement, report authorization, notification ownership and private metadata filtering, profile validation, avatar upload/immediate serving, deletion isolation, ZIP import/remakes, password changes and reset token/session revocation.
- `scripts/audit-browser.mjs` exercised real Chromium at 1440px and 390px: homepage, ranking and public profile in light/dark themes; no horizontal overflow; zero/unset/decimal slider states, keyboard, mouse and touch; Escape dismissal; same-browser account appearance changes; and all three prototype reference screens. No browser runtime errors. Screenshots were reviewed, not only generated.
- Production read-only integrity query found **zero** scored rubric ratings without category score rows at the time of inspection. This is a narrow consistency check, not proof of all historical content.
- Deployment uses the existing GHCR/cron/backup/migration pipeline. Final CI and live revision are reported in the completion message, separately from local verification.

## Status and limits

**VERIFIED FIXED:** The local automated, HTTP and rendered defects listed above, with production revision verification reported separately.

**IMPLEMENTED BUT NOT FULLY VERIFIED:** Real Google OAuth consent/callback with a human account; live TMDB episode/franchise import at full-series scale; naturally occurring new release notification delivery after scheduling; actual outbound recovery email delivery. Mocked release detection and built-server password-reset mechanics were verified, not external delivery.

**CONFIGURATION REPAIRED, DELIVERY UNVERIFIED:** Production initially had no Resend key. The owner configured it during the audit; a read-only Resend API check confirmed the sending domain is verified. The final container environment mapping is checked at rollout. No real recovery email was sent. The generic recovery response intentionally does not reveal account existence. Existing unverified password users cannot implicitly merge into Google; they must authenticate/link or complete recovery first. Previously linked accounts were not rewritten or revoked without evidence/approval.

**NOT YET IMPLEMENTED:** This audit does not add speculative product features. Followers, notifications, notification preferences and TV/franchise release tracking are implemented in the audited HEAD; they are not merely planned work. Other roadmap items were not invented.

**Remaining limits:** Abuse limits are process-local backstops, not a distributed rate-limit service. Visual checks used local fixture rankings and existing artwork; they do not certify every possible title/image or every device. Large live TV imports and external services require separate acceptance checks. Historical data previously removed by old code was not reconstructed from backups. No production ratings, collections, uploads or volumes were deleted or reset for testing.
