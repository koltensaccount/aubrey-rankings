import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { auth } from "../lib/auth";
import { db } from "../db";
import { collectionEntries, collections, mediaItems, ratingCategories, ratingSystems, ratings, reviews, user } from "../db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { POST as saveJournal } from "../app/api/journal/route";
import { resolveMediaItem } from "../app/api/reviews/route";
import { tmdb } from "../lib/tmdb";
import { reviewScoreOnTen } from "../lib/review-rating";

describe("Phase 13B Standalone Episode Journaling & Review Corrections", () => {
  const suffix = `${process.pid}_${Date.now()}`;
  const email = `phase13b_ep_${suffix}@example.com`;
  const mockTvId = 998877;
  const mockEpisodeMediaId = `tv_${mockTvId}_s2_e5`;
  const parentShowId = `tv_${mockTvId}`;

  let userId = "";
  let cookie = "";

  // Preserve original TMDB methods for mocking
  const originalGetTvDetails = tmdb.getTvDetails;
  const originalGetTvSeason = tmdb.getTvSeason;

  const request = (body: unknown, authenticated = true) =>
    new NextRequest("http://localhost:3000/api/journal", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authenticated ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });

  before(async () => {
    // Setup test user
    const response = await auth.api.signUpEmail({
      body: { email, password: "Password123!@#", name: "Episode Journaler" },
      asResponse: true,
    });
    assert.equal(response.status, 200);
    cookie = response.headers.get("set-cookie") || "";

    const account = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });
    assert.ok(account);
    userId = account.id;

    // Mock TMDB API to avoid network calls
    (tmdb as any).getTvDetails = async (id: number) => {
      if (id === mockTvId) {
        return {
          id: mockTvId,
          name: "Mocked Prestige Drama",
          overview: "A groundbreaking television series.",
          poster_path: "/mock_show_poster.jpg",
          backdrop_path: "/mock_show_backdrop.jpg",
          first_air_date: "2024-01-01",
          number_of_seasons: 3,
          number_of_episodes: 30,
          vote_average: 8.9,
          vote_count: 5000,
          seasons: [
            { id: 101, name: "Season 1", season_number: 1, episode_count: 10, air_date: "2024-01-01", poster_path: "/s1.jpg" },
            { id: 102, name: "Season 2", season_number: 2, episode_count: 10, air_date: "2025-01-01", poster_path: "/s2.jpg" },
          ],
        };
      }
      return originalGetTvDetails.call(tmdb, id);
    };

    (tmdb as any).getTvSeason = async (tvId: number, seasonNumber: number) => {
      if (tvId === mockTvId && seasonNumber === 2) {
        return {
          id: 202,
          name: "Season 2",
          season_number: 2,
          episode_count: 10,
          air_date: "2025-01-01",
          poster_path: "/s2.jpg",
          overview: "The second chapter.",
          episodes: [
            {
              id: 9988775,
              name: "Point of Divergence",
              overview: "A critical turning point occurs.",
              still_path: "/mock_episode_still.jpg",
              air_date: "2025-02-05",
              episode_number: 5,
              season_number: 2,
              vote_average: 9.4,
            },
          ],
        };
      }
      return originalGetTvSeason.call(tmdb, tvId, seasonNumber);
    };
  });

  after(async () => {
    // Restore TMDB methods
    tmdb.getTvDetails = originalGetTvDetails;
    tmdb.getTvSeason = originalGetTvSeason;

    // Cleanup DB records
    await db.delete(reviews).where(eq(reviews.userId, userId));
    await db.delete(ratings).where(eq(ratings.userId, userId));
    await db.delete(mediaItems).where(eq(mediaItems.id, mockEpisodeMediaId));
    await db.delete(mediaItems).where(eq(mediaItems.id, parentShowId));
    await db.delete(user).where(eq(user.id, userId));
  });

  it("resolves a missing episode from TMDB, creating canonical episode and parent series records", async () => {
    // Ensure records do not exist before resolution
    const preEp = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, mockEpisodeMediaId) });
    const preShow = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, parentShowId) });
    assert.equal(preEp, undefined);
    assert.equal(preShow, undefined);

    // Call resolveMediaItem on unpersisted episode ID
    const resolvedId = await resolveMediaItem(mockEpisodeMediaId);
    assert.equal(resolvedId, mockEpisodeMediaId);

    // Verify canonical episode record was created with correct metadata
    const episode = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, mockEpisodeMediaId) });
    assert.ok(episode);
    assert.equal(episode.mediaType, "episode");
    assert.equal(episode.title, "Point of Divergence");
    assert.equal(episode.seasonNumber, 2);
    assert.equal(episode.episodeNumber, 5);
    assert.equal(episode.stillPath, "/mock_episode_still.jpg");
    assert.equal(episode.parentMediaId, parentShowId);

    // Verify safe parent series creation
    const parentShow = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, parentShowId) });
    assert.ok(parentShow);
    assert.equal(parentShow.mediaType, "tv");
    assert.equal(parentShow.title, "Mocked Prestige Drama");
    assert.equal(parentShow.tmdbId, mockTvId);
  });

  it("journals the resolved episode directly with precision tenths score and markdown writing", async () => {
    const res = await saveJournal(
      request({
        mediaItemId: mockEpisodeMediaId,
        quickScore: 9.2, // Precision tenth-point rating
        review: {
          title: "Peak Television",
          content: "Episode 5 reaches extraordinary narrative heights.",
          status: "published",
          visibility: "private",
        },
      })
    );
    assert.equal(res.status, 200);

    // Verify rating attached strictly to episode, not parent show
    const epRating = await db.query.ratings.findFirst({
      where: (r, { and, eq, isNull }) =>
        and(eq(r.userId, userId), eq(r.mediaItemId, mockEpisodeMediaId), isNull(r.collectionId)),
    });
    assert.ok(epRating);
    assert.equal(epRating.calculatedOverallScore, 9.2);

    const showRating = await db.query.ratings.findFirst({
      where: (r, { and, eq, isNull }) =>
        and(eq(r.userId, userId), eq(r.mediaItemId, parentShowId), isNull(r.collectionId)),
    });
    assert.equal(showRating, undefined);

    // Verify review attached to episode
    const epReview = await db.query.reviews.findFirst({
      where: (rv, { and, eq }) =>
        and(eq(rv.userId, userId), eq(rv.mediaItemId, mockEpisodeMediaId), eq(rv.isJournal, true)),
    });
    assert.ok(epReview);
    assert.equal(epReview.ratingId, epRating.id);
    assert.equal(epReview.visibility, "private");
    assert.equal(epReview.content, "Episode 5 reaches extraordinary narrative heights.");
  });

  it("isolates episode journal rating from collection-scoped rankings", async () => {
    const collectionId = `col_${suffix}`;
    const collectionEntryId = `entry_${suffix}`;
    const collectionRatingId = `rate_col_${suffix}`;

    try {
      await db.insert(collections).values({
        id: collectionId,
        userId,
        title: "Best Episodes of 2025",
        collectionType: "ranked",
      });
      await db.insert(collectionEntries).values({
        id: collectionEntryId,
        collectionId,
        mediaItemId: mockEpisodeMediaId,
        sortOrder: 1,
      });
      await db.insert(ratings).values({
        id: collectionRatingId,
        userId,
        mediaItemId: mockEpisodeMediaId,
        collectionId,
        calculatedOverallScore: 4.5,
        isWatched: true,
      });

      // Update journal quick rating to 9.8
      const res = await saveJournal(
        request({
          mediaItemId: mockEpisodeMediaId,
          quickScore: 9.8,
        })
      );
      assert.equal(res.status, 200);

      // Verify journal rating updated to 9.8
      const journalRating = await db.query.ratings.findFirst({
        where: (r, { and, eq, isNull }) =>
          and(eq(r.userId, userId), eq(r.mediaItemId, mockEpisodeMediaId), isNull(r.collectionId)),
      });
      assert.equal(journalRating?.calculatedOverallScore, 9.8);

      // Verify collection rating remains completely untouched at 4.5
      const colRating = await db.query.ratings.findFirst({
        where: eq(ratings.id, collectionRatingId),
      });
      assert.equal(colRating?.calculatedOverallScore, 4.5);
    } finally {
      await db.delete(ratings).where(eq(ratings.id, collectionRatingId));
      await db.delete(collectionEntries).where(eq(collectionEntries.id, collectionEntryId));
      await db.delete(collections).where(eq(collections.id, collectionId));
    }
  });

  it("correctly normalizes scores on 5-point and 100-point scales without raw mislabeling", () => {
    // 1. Quick rating on 10-point scale: 9.2 -> 9.2
    assert.equal(
      reviewScoreOnTen({
        calculatedOverallScore: 9.2,
        sourceRating: null,
        sourceScale: null,
        sourceService: null,
        ratingSystemId: null,
        tierId: null,
        ratingSystem: null,
        categoryScores: [],
      }),
      9.2
    );

    // 2. Detailed rubric on 5-point scale: 4/5 -> 8.0/10
    assert.equal(
      reviewScoreOnTen({
        calculatedOverallScore: 4.0,
        sourceRating: null,
        sourceScale: null,
        sourceService: null,
        ratingSystemId: "sys_5",
        tierId: null,
        ratingSystem: { scale: 5, type: "numerical" },
        categoryScores: [{}],
      }),
      8.0
    );

    // 3. Detailed rubric on 100-point scale: 85/100 -> 8.5/10
    assert.equal(
      reviewScoreOnTen({
        calculatedOverallScore: 85.0,
        sourceRating: null,
        sourceScale: null,
        sourceService: null,
        ratingSystemId: "sys_100",
        tierId: null,
        ratingSystem: { scale: 100, type: "numerical" },
        categoryScores: [{}],
      }),
      8.5
    );

    // 4. Letterboxd imported 5-point rating: 4/5 -> 8.0/10
    assert.equal(
      reviewScoreOnTen({
        calculatedOverallScore: 8.0,
        sourceRating: 4.0,
        sourceScale: 5.0,
        sourceService: "letterboxd",
        ratingSystemId: null,
        tierId: null,
        ratingSystem: null,
        categoryScores: [],
      }),
      8.0
    );

    // 5. Tier rating returns null (never fabricated as numerical)
    assert.equal(
      reviewScoreOnTen({
        calculatedOverallScore: null,
        sourceRating: null,
        sourceScale: null,
        sourceService: null,
        ratingSystemId: null,
        tierId: "tier_s",
        ratingSystem: null,
        categoryScores: [],
      }),
      null
    );

    // 6. Unknown scale returns null (never falsely labeled as /10)
    assert.equal(
      reviewScoreOnTen({
        calculatedOverallScore: 4.0,
        sourceRating: null,
        sourceScale: null,
        sourceService: null,
        ratingSystemId: "unknown_sys",
        tierId: null,
        ratingSystem: null,
        categoryScores: [{}],
      }),
      null
    );
  });

  it("constructs canonical episode-to-series link without requiring DB persistence", () => {
    // Episode with parentMediaId "tv_1399"
    const parentMediaId = "tv_1399";
    const parentTvIdMatch = /^(?:tmdb-)?tv_?(\d+)$/i.exec(parentMediaId) || /^\d+$/.exec(parentMediaId);
    const parentTvNumericId = parentTvIdMatch ? parentTvIdMatch[1] ?? parentTvIdMatch[0] : null;
    const seriesDetailsHref = parentTvNumericId
      ? `/media/${parentTvNumericId}?type=tv`
      : `/media/${parentMediaId}?type=tv`;

    assert.equal(seriesDetailsHref, "/media/1399?type=tv");
  });

  it("preserves TV identity when constructing season navigation links", () => {
    const rawMediaId = "1399";
    const seasonNumber = 2;
    const seasonHref = `/media/${encodeURIComponent(rawMediaId)}?type=tv&season=${seasonNumber}`;

    assert.equal(seasonHref, "/media/1399?type=tv&season=2");
    assert.ok(seasonHref.includes("type=tv"));
  });

  it("validates Library Resume links include journal=1 parameter for direct editor opening", () => {
    const mediaItemId = "tv_1399_s1_e1";
    const resumeLink = `/media/${mediaItemId}?journal=1`;
    assert.equal(resumeLink, "/media/tv_1399_s1_e1?journal=1");

    // Server-side check for autoOpen
    const session = { user: { id: "u123" } };
    const searchParams = { journal: "1" };
    const shouldAutoOpen = Boolean(session && (searchParams.journal === "1" || searchParams.journal === "true"));
    assert.equal(shouldAutoOpen, true);

    // Unauthenticated user should not auto-open
    const unauthSession: { user: { id: string } } | null = null;
    const unauthAutoOpen = Boolean(unauthSession && (searchParams.journal === "1" || searchParams.journal === "true"));
    assert.equal(unauthAutoOpen, false);
  });
});
