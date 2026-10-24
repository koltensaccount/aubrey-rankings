# Phase 15B corrective maintenance

This corrective PR requires migration `0020_postmerge_source_identity.sql` before
running the updated application. It retains review IDs, writing, links, source
URIs and audit timestamps, replaces the incorrect film-URI uniqueness constraint
with review-event uniqueness, and adds separate verified source dates. No data
reset or destructive consolidation is required.

Imported reviews without verified source dates remain undated, including for
latest-rated-review selection. Pre-0020 watchlist rows lack
per-item source provenance: an imported rating for the same title cannot establish
whether a watchlist item was native or imported. The migration leaves these rows
unclassified and preserves their timestamps, including authentic native dates.
Some old import timestamps may therefore remain indistinguishable from native
watchlist dates; neither a source nor a replacement date can be inferred safely.
Explicitly stored source metadata is preserved; new imports use separate verified
source dates. Authentic source information is required to resolve old ambiguity. A published review with an unknown source date
is still published; it is not treated as a draft.

To recover original dates for existing imports, reimport the original Letterboxd
ZIP. Only unambiguous review identities are enriched. A review URL is a review
identity; a film URL is not. With film-only URLs, a composite source row key and
occurrence preserve separate same-day rows and identical duplicates. Changed
source rows that cannot be matched safely are quarantined for manual review,
without changing existing writing, scores, privacy, or viewing links. Source
scores/tags in changed diary exports do not overwrite established Aubrey values.
A ZIP with missing dates cannot recover those dates.

Timeline reads no longer reconcile data or write to the database. Existing users
can be reconciled explicitly, per user, after migration:

```sh
DATABASE_URL=<intended-database-url> npx tsx scripts/reconcile-activity.ts <user-id>
```

The command runs in a transaction and is idempotent. It rebuilds missing source
activities and refreshes derived fields, without assigning dates to legacy
standalone scores/status when their historical activity date is unknown.
Reimport also invokes reconciliation for the importing user. No production
maintenance command has been executed as part of this PR.

Dated pagination selects complete card identities in SQL, then fetches relations
for the selected cards. Explicitly linked reviews combine with one viewing only
on the same genuine date. Undated activities remain a separate collection in the
existing response format; exceptionally large undated histories still return in
full. Offset pagination is deterministic for an unchanged history; edits refresh
page one and invalidate category caches rather than continuing stale offsets.
