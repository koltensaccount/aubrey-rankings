# Phase 15B → Phase 15C handoff

## Phase 15B state

Phase 15B unifies personal history around immutable source records and derived
activity cards. Production migration `0020_postmerge_source_identity.sql` is
additive and checksum-protected. It preserves review identities and writing,
separate verified Letterboxd source dates, native timestamps, and ambiguous
legacy watchlist provenance.

The canonical private Notes field is `media_notes` (`user_id`, `media_item_id`).
Ranking-entry passages and legacy rating text remain historical context; they
are not alternate sources of truth for Notes. Reviews are first-class records:
multiple reviews of one title remain distinct, and the latest dated review is
chosen from verified review dates rather than a viewing or import timestamp.

`diary_entries`, `reviews`, `watchlist_items`, and eligible legacy ratings feed
`activity_events`. Timeline reads are read-only. `backfillUserActivityEvents`
is the sole reconciliation implementation; it is deliberately explicit and
idempotent. It may remove only an activity whose linked source record is gone
or no longer publishable. It never invents a historical date.

The deployed image bundles a revision-matched, opt-in maintenance command. Run
it only through the Compose `maintenance` profile after taking a verified backup:

```sh
AUBREY_IMAGE=$(docker inspect --format '{{.Image}}' aubrey-web) \
  docker compose --profile maintenance run --rm --no-deps aubrey-maintenance <user-id>
```

The command has no HTTP route, uses Compose's internal database connection, and
does not install development tooling on the host.

## Privacy and timeline rules

Notes and private reviews must never appear in public rankings or another
user's view. A timeline combines a review with a viewing only when they are
explicitly linked and share the same genuine date. Separate reviews and
rewatches remain separate. Viewing ordinals count only viewing cards; ratings,
reviews, watchlist actions, and watched marks are never rewatches by proximity.
Date-only source values retain their calendar day in every browser timezone.

## Deployment and historical limits

The updater snapshots the database and uploads, then applies migrations from
the candidate image transactionally before starting the new web container. It
health-checks the revision and restores the prior application image on failure;
migrations are additive and are not rolled back automatically.

Authentic source dates for older imports require the original Letterboxd ZIP.
Do not infer them from database audit timestamps, ratings, or associated
watchlist rows. Pre-0020 watchlist provenance can remain genuinely ambiguous.
Unmatched changed imports stay quarantined for manual review.

## Phase 15C boundary

Phase 15C starts only after separately scoped product requirements. Do not
replace these source-of-truth, privacy, reconciliation, or date-provenance
rules as part of a UI iteration. Production authenticated UI checks still need
the owner's session; do not alter real history to simulate them.
