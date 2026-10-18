# Independent audit of b70007b

Scope: collection creation/detail, rating mutations, entry/collection deletion, account recovery, password changes, public discovery/profile boundaries, and Letterboxd preview/execution. This is a code and regression audit, not a comprehensive penetration test.

## Findings fixed

| Severity | Finding | Resolution |
| --- | --- | --- |
| High | Public profiles included review text from private and unlisted collections. | Public review queries now restrict collection membership and omit personal notes at query time. Global public reviews remain supported. |
| High | Discovery and Following feeds exposed unlisted collections through the legacy `isPublic` flag; inconsistent flags could also expose private collections. | Visibility is authoritative for discovery. Direct-link access to unlisted collections remains supported. Conflicting visibility updates are rejected. |
| High | Authentication used a committed secret when configuration was absent. | Removed the application fallback; Better Auth enforces production secret configuration. Docker already requires the runtime environment secret. |
| High | Letterboxd execution matched shared media by title without release year, potentially merging remakes. Preview used a different matching rule. | Preview and execution use title/year identity, prefer the user's existing matching global rating, and preserve shared metadata and weighted ratings. Imports are atomic and serialized against concurrent imports. |
| Medium | Array-format category scores affected the overall score without persisting category rows. System changes left old rows, and clearing inputs could silently retain scores. Responses also invented defaults for unchanged fields. | Both formats share strict validation and transactional persistence. System/category ownership, finite numeric ranges, booleans and dates are checked. Old categories are removed, explicit clears are sent, and responses return the persisted rating. Per-scope locking prevents concurrent updates from losing scores. |
| Medium | Entry deletion left orphan collection-scoped ratings used in aggregates. | Association and scoped rating are removed in one owner-checked transaction. Global ratings, other users' ratings, other collections and shared media survive. |
| Medium | Resend error responses were treated as delivery success; production could simulate recovery emails and log reset URLs. | Delivery failures are detected and logged without tokens; production never simulates delivery. The reset endpoint keeps its generic response to avoid account enumeration. Resetting a password now revokes existing sessions. |
| Medium | Malformed importer form fields/ZIPs could produce server errors, inflated ZIPs were unbounded, diary URLs could duplicate films, and invalid scores/dates could enter the import. | File validation and 400 responses, expanded-size limits, film/year deduplication, BOM handling, malformed CSV rejection, and score/date checks. Summary counts represent unique films. |
| Low | Google sign-in's loading state was not released for every non-navigation return. Invalid collection creation payloads also lacked type checks. | Loading state resets in `finally`; creation validates title, collection type and import options before mutation. |

The existing `collection.title || collection.name` crash fix and database foreign-key cascades were retained. No schema migration was required.

## Verification

- Baseline: 39 tests across 10 suites passed before changes.
- Final regression suite: `npm test` — 56 tests across 14 suites passed.
- Production build: `npm run build` — passed, including TypeScript and generation of 31 routes.
- `npm run test:http` against the built standalone app and local PostgreSQL — passed. It exercises real HTTP authentication, ranking creation and validation, cross-user access denial, score-array persistence/reload, concurrent score updates, null clears, system switching, rating/entry/collection deletion, cascades, shared-media/global-rating preservation, importer preview/execution, malformed uploads, password changes, and invalid/expired/reused/valid recovery tokens. A successful recovery invalidates old sessions.
- Import regression tests cover remakes, repeat/concurrent imports, preservation of weighted scores/private notes, rollback after a database write failure, malformed CSVs and expanded ZIP limits.
- Email tests inject fake transports. No real recovery emails are sent. HTTP fixtures use temporary local accounts and are cleaned up.
- `git diff --check` passed.

To repeat the HTTP checks, start the production standalone server on loopback port 3100 against a local test database with a temporary `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL=http://localhost:3100`. Run `npm run test:http` against the same database. `AUDIT_HTTP_BASE_URL` can select another loopback address; remote servers/databases are rejected by the harness.

## Limits

Actual Google OAuth completion and delivery through the production email provider require external credentials and were not exercised. Historical imports potentially affected by the old remake-matching bug were not automatically rewritten. No production database was used for regression testing. A successful push does not itself establish that the production rollout has completed.
