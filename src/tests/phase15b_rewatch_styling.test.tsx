import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TimelineEntryCard } from "../components/library/timeline-entry-card";

it("non-viewing activity cards never receive rewatch styling from an ordinal or stale flag", () => {
  for (const eventType of ["review", "rating", "watchlist", "watched_mark"]) {
    const html = renderToStaticMarkup(<TimelineEntryCard
      entry={{ id: eventType, eventType, mediaItemId: "film", mediaItem: { id: "film", title: "Mixed history", mediaType: "movie" }, badgeLabel: "Activity", isRewatch: true }}
      ordinalIndex={9} totalViewingsForMedia={12} onOpenHistory={() => {}}
    />);
    assert.doesNotMatch(html, /class="w-3 h-3 rounded-full[^\"]*bg-primary border-primary/, eventType);
    assert.doesNotMatch(html, /Rewatch/);
  }
});

it("actual and combined same-day viewings retain rewatch styling", () => {
  for (const eventType of ["viewing", "viewing_and_review"]) {
    const html = renderToStaticMarkup(<TimelineEntryCard
      entry={{ id: eventType, eventType, mediaItemId: "film", mediaItem: { id: "film", title: "Same-day rewatch", mediaType: "movie" }, eventDate: "2024-04-03" }}
      ordinalIndex={2} totalViewingsForMedia={2} onOpenHistory={() => {}}
    />);
    assert.match(html, /class="w-3 h-3 rounded-full[^\"]*bg-primary border-primary/);
    assert.match(html, /Rewatch/);
  }
});

it("mixed-activity fallback counts only actual viewings, preserving same-day order and server metadata", async () => {
  const { getViewingOrdinals, isRewatchActivity } = await import("../lib/viewing-ordinals");
  const mediaItemId = "film";
  const entries = [
    { id: "review", mediaItemId, eventType: "review", ordinal: 99, totalViewings: 999, isRewatch: true },
    { id: "viewing-2", mediaItemId, eventType: "viewing_and_review", eventDate: "2024-04-03", createdAt: "2024-04-03T20:00:00Z" },
    { id: "rating", mediaItemId, eventType: "rating" },
    { id: "watchlist", mediaItemId, eventType: "watchlist" },
    { id: "mark", mediaItemId, eventType: "watched_mark" },
    { id: "viewing-1", mediaItemId, eventType: "viewing", eventDate: "2024-04-03", createdAt: "2024-04-03T10:00:00Z" },
  ];
  const fallback = getViewingOrdinals(entries);
  assert.equal(fallback.mediaTotalCountMap.get(mediaItemId), 2);
  assert.deepEqual([...fallback.mediaOrdinalsMap], [["viewing-1", 1], ["viewing-2", 2]]);
  assert.deepEqual(entries.filter((e) => isRewatchActivity(e, fallback.mediaOrdinalsMap.get(e.id))).map((e) => e.id), ["viewing-2"]);
  const authoritative = getViewingOrdinals(entries.map((e) => e.id === "viewing-2" ? { ...e, ordinal: 15, totalViewings: 20 } : e));
  assert.equal(authoritative.mediaOrdinalsMap.get("viewing-2"), 15);
  assert.equal(authoritative.mediaTotalCountMap.get(mediaItemId), 20);
  assert.equal(authoritative.mediaOrdinalsMap.has("review"), false);
  assert.equal(getViewingOrdinals([{ id: "legacy-diary", mediaItemId, watchedDate: null }]).mediaOrdinalsMap.get("legacy-diary"), 1);
});
