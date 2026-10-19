import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMediaArtworkAspect, resolvePosterUrl, resolveStillUrl } from "../lib/artwork";

describe("Artwork presentation", () => {
  it("keeps movies portrait even when a still is available", () => {
    assert.equal(getMediaArtworkAspect({ mediaType: "movie", stillPath: "/still.jpg" }), "poster");
  });
  it("keeps episodes landscape even when their artwork is missing", () => {
    assert.equal(getMediaArtworkAspect({ mediaType: "episode" }), "video");
    assert.equal(getMediaArtworkAspect({ mediaType: "episode", stillPath: "/still.jpg" }), "video");
  });
  it("uses available artwork for media without an explicit movie/episode type", () => {
    assert.equal(getMediaArtworkAspect({ stillPath: "/still.jpg" }), "video");
    assert.equal(getMediaArtworkAspect({ stillPath: " " }), "poster");
    assert.equal(getMediaArtworkAspect({}), "poster");
  });
  it("preserves uploaded and absolute artwork URLs and resolves TMDB paths", () => {
    assert.equal(resolvePosterUrl("/uploads/custom.jpg"), "/uploads/custom.jpg");
    assert.equal(resolveStillUrl("https://example.com/still.jpg"), "https://example.com/still.jpg");
    assert.equal(resolvePosterUrl(" /poster.jpg "), "https://image.tmdb.org/t/p/w500/poster.jpg");
    assert.equal(resolveStillUrl("still.jpg"), "https://image.tmdb.org/t/p/w500/still.jpg");
  });
});
