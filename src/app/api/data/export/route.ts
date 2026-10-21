import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import {
  user,
  ratings,
  reviews,
  watchlistItems,
  diaryEntries,
  collections,
  ratingSystems,
  unresolvedImportItems,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. User profile (explicitly sanitized, no credentials/secrets)
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: {
        id: true,
        name: true,
        username: true,
        bio: true,
        preferredTheme: true,
        accentColor: true,
        commentPermission: true,
        defaultReviewVisibility: true,
        defaultReviewSpoiler: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Ratings (global and collection-scoped)
    const userRatings = await db.query.ratings.findMany({
      where: eq(ratings.userId, userId),
      orderBy: [desc(ratings.updatedAt)],
      with: {
        mediaItem: true,
        categoryScores: {
          with: {
            category: true,
          },
        },
        tier: true,
        ratingSystem: true,
      },
    });

    // 3. First-class reviews & Journal
    const userReviews = await db.query.reviews.findMany({
      where: eq(reviews.userId, userId),
      orderBy: [desc(reviews.updatedAt)],
      with: {
        mediaItem: true,
      },
    });

    // 4. Watchlist
    const userWatchlist = await db.query.watchlistItems.findMany({
      where: eq(watchlistItems.userId, userId),
      orderBy: [desc(watchlistItems.createdAt)],
      with: {
        mediaItem: true,
      },
    });

    // 5. Viewing Diary
    const userDiary = await db.query.diaryEntries.findMany({
      where: eq(diaryEntries.userId, userId),
      orderBy: [desc(diaryEntries.watchedDate), desc(diaryEntries.createdAt)],
      with: {
        mediaItem: true,
      },
    });

    // 6. Collections & Lists
    const userCollections = await db.query.collections.findMany({
      where: eq(collections.userId, userId),
      orderBy: [desc(collections.updatedAt)],
      with: {
        entries: {
          with: {
            mediaItem: true,
          },
          orderBy: (entry, { asc }) => [asc(entry.sortOrder)],
        },
      },
    });

    // 7. Custom rating systems
    const userRatingSystems = await db.query.ratingSystems.findMany({
      where: eq(ratingSystems.userId, userId),
      orderBy: [desc(ratingSystems.updatedAt)],
      with: {
        categories: {
          orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
        },
        tiers: {
          orderBy: (t, { asc }) => [asc(t.sortOrder)],
        },
      },
    });

    // 8. Import provenance & unresolved items
    const unresolvedItems = await db.query.unresolvedImportItems.findMany({
      where: eq(unresolvedImportItems.userId, userId),
      orderBy: [desc(unresolvedImportItems.createdAt)],
    });

    const exportPayload = {
      aubreyExportVersion: "1.0.0",
      exportedAt: new Date().toISOString(),
      user: userRecord,
      summary: {
        totalWatched: userRatings.filter((r) => r.isWatched).length,
        totalRatings: userRatings.filter((r) => r.calculatedOverallScore !== null || r.sourceRating !== null).length,
        totalReviews: userReviews.length,
        totalDiaryEntries: userDiary.length,
        totalWatchlistItems: userWatchlist.length,
        totalCollections: userCollections.length,
        totalRatingSystems: userRatingSystems.length,
      },
      watched: userRatings
        .filter((r) => r.isWatched)
        .map((r) => ({
          mediaItemId: r.mediaItemId,
          title: r.mediaItem?.title,
          releaseDate: r.mediaItem?.releaseDate,
          mediaType: r.mediaItem?.mediaType,
          watchDate: r.watchDate,
          isFavorite: r.isFavorite,
          sourceService: r.sourceService,
          sourceUri: r.letterboxdUri,
        })),
      watchlist: userWatchlist.map((w) => ({
        id: w.id,
        mediaItemId: w.mediaItemId,
        title: w.mediaItem?.title,
        releaseDate: w.mediaItem?.releaseDate,
        mediaType: w.mediaItem?.mediaType,
        notes: w.notes,
        createdAt: w.createdAt,
      })),
      diary: userDiary.map((d) => ({
        id: d.id,
        mediaItemId: d.mediaItemId,
        title: d.mediaItem?.title,
        releaseDate: d.mediaItem?.releaseDate,
        mediaType: d.mediaItem?.mediaType,
        watchedDate: d.watchedDate,
        loggedDate: d.loggedDate,
        isRewatch: d.isRewatch,
        ratingValue: d.ratingValue,
        tags: d.tags,
        notes: d.notes,
        sourceService: d.sourceService,
        sourceUri: d.sourceUri,
      })),
      reviews: userReviews.map((rev) => ({
        id: rev.id,
        mediaItemId: rev.mediaItemId,
        title: rev.title,
        content: rev.content,
        draftContent: rev.draftContent,
        contentFormat: rev.contentFormat,
        draftContentFormat: rev.draftContentFormat,
        status: rev.status,
        visibility: rev.visibility,
        isSpoiler: rev.isSpoiler,
        isJournal: rev.isJournal,
        shareRating: rev.shareRating,
        watchedDate: rev.watchedDate,
        media: {
          title: rev.mediaItem?.title,
          releaseDate: rev.mediaItem?.releaseDate,
          mediaType: rev.mediaItem?.mediaType,
        },
        publishedAt: rev.publishedAt,
        createdAt: rev.createdAt,
        updatedAt: rev.updatedAt,
        sourceService: rev.sourceService,
        sourceUri: rev.sourceUri,
      })),
      ratings: userRatings.map((r) => ({
        id: r.id,
        mediaItemId: r.mediaItemId,
        collectionId: r.collectionId,
        ratingSystemId: r.ratingSystemId,
        tierId: r.tierId,
        score: r.calculatedOverallScore,
        sourceRating: r.sourceRating,
        sourceScale: r.sourceScale,
        sourceService: r.sourceService,
        letterboxdUri: r.letterboxdUri,
        watchDate: r.watchDate,
        reviewText: r.reviewText,
        personalNotes: r.personalNotes,
        shareCommentary: r.shareCommentary,
        isWatched: r.isWatched,
        isFavorite: r.isFavorite,
        media: {
          title: r.mediaItem?.title,
          releaseDate: r.mediaItem?.releaseDate,
          mediaType: r.mediaItem?.mediaType,
        },
        tier: r.tier ? { name: r.tier.name, color: r.tier.color } : null,
        categoryScores: r.categoryScores.map((cs) => ({
          categoryName: cs.category?.name,
          score: cs.score,
          weightApplied: cs.weightApplied,
        })),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      ratingSystems: userRatingSystems.map((rs) => ({
        id: rs.id,
        name: rs.name,
        description: rs.description,
        scale: rs.scale,
        type: rs.type,
        isDefault: rs.isDefault,
        categories: rs.categories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          weight: c.weight,
          sortOrder: c.sortOrder,
          isRequired: c.isRequired,
        })),
        tiers: rs.tiers.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          color: t.color,
          sortOrder: t.sortOrder,
        })),
        createdAt: rs.createdAt,
        updatedAt: rs.updatedAt,
      })),
      collections: userCollections.map((col) => ({
        id: col.id,
        title: col.title,
        description: col.description,
        collectionType: col.collectionType,
        isRanked: col.isRanked,
        visibility: col.visibility,
        isPublic: col.isPublic,
        isPinned: col.isPinned,
        allowComments: col.allowComments,
        defaultRatingSystemId: col.defaultRatingSystemId,
        customCoverImage: col.customCoverImage,
        backdropImage: col.backdropImage,
        shareSlug: col.shareSlug,
        sourceService: col.sourceService,
        sourceUri: col.sourceUri,
        createdAt: col.createdAt,
        updatedAt: col.updatedAt,
        entries: col.entries.map((e) => ({
          mediaItemId: e.mediaItemId,
          title: e.mediaItem?.title,
          releaseDate: e.mediaItem?.releaseDate,
          mediaType: e.mediaItem?.mediaType,
          sortOrder: e.sortOrder,
          notes: e.notes,
        })),
      })),
      provenance: {
        unresolvedItems: unresolvedItems.map((u) => ({
          sourceService: u.sourceService,
          sourceType: u.sourceType,
          sourceData: u.sourceData,
          reason: u.reason,
          details: u.details,
          createdAt: u.createdAt,
        })),
      },
    };

    const usernameSlug = userRecord.username || "user";
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `aubrey-export-${usernameSlug}-${dateStr}.json`;

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("[Aubrey Data Export Error]", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 },
    );
  }
}
