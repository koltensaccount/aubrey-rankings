import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { collections, collectionEntries, mediaItems, ratings, ratingSystems, follows } from "@/db/schema";
import { eq, and, or, isNull, asc, sql } from "drizzle-orm";
import { tmdb } from "@/lib/tmdb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(request);

  try {
    const col = await db.query.collections.findFirst({
      where: (c, { eq }) => eq(c.id, id),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        defaultRatingSystem: {
          with: {
            categories: {
              orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
            },
            tiers: {
              orderBy: (tier, { asc }) => [asc(tier.sortOrder)],
            },
          },
        },
        entries: {
          orderBy: [asc(collectionEntries.sortOrder)],
          with: {
            mediaItem: {
              with: {
                // Security Fix: Do not disclose other users' artwork overrides
                artworkOverrides: session
                  ? {
                      where: (ao, { eq }) => eq(ao.userId, session.user.id),
                    }
                  : undefined,
              },
            },
          },
        },
      },
    });

    if (!col) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Access control:
    // If private: ONLY the owner can access. Others receive 404.
    const isOwner = session ? session.user.id === col.userId : false;
    const isPrivate = col.visibility === "private" || (!col.isPublic && col.visibility !== "unlisted");

    if (isPrivate && !isOwner) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Fetch ratings:
    // If owner: fetch their ratings including personal notes.
    // If visitor: fetch owner's ratings for this collection, but STRIP personal notes!
    let collectionRatings: any[] = [];
    const targetUserId = isOwner ? session!.user.id : col.userId;

    const rawRatings = await db.query.ratings.findMany({
      where: (r, { eq, and }) =>
        and(eq(r.userId, targetUserId), eq(r.collectionId, col.id)),
      with: {
        categoryScores: true,
        tier: true,
        ratingSystem: { with: { categories: true, tiers: true } },
      },
    });

    if (isOwner) {
      collectionRatings = rawRatings;
    } else {
      // Securely strip personal notes for visitors and guests
      collectionRatings = rawRatings.map((r) => ({
        ...r,
        personalNotes: null,
      }));
    }

    let clearLogoUrl: string | null = null;
    if (col.tmdbId) {
      const mediaType = col.collectionType === "tv_show" ? "tv" : "movie";
      clearLogoUrl = await tmdb.getClearLogo(col.tmdbId, mediaType).catch(() => null);
    }

    let isFollowing = false;
    let followersCount = 0;
    let followingCount = 0;

    if (!isOwner && col.user) {
      if (session) {
        const follow = await db.query.follows.findFirst({
          where: (f, { eq, and }) =>
            and(eq(f.followerId, session.user.id), eq(f.followingId, col.userId)),
          columns: { id: true },
        });
        isFollowing = Boolean(follow);
      }

      const [fc, fgc] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(follows)
          .where(eq(follows.followingId, col.userId)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(follows)
          .where(eq(follows.followerId, col.userId)),
      ]);
      followersCount = Number(fc[0]?.count || 0);
      followingCount = Number(fgc[0]?.count || 0);
    }

    return NextResponse.json({
      collection: {
        ...col,
        clearLogoUrl,
        isFollowing,
        user: col.user
          ? {
              ...col.user,
              isFollowing,
              followersCount,
              followingCount,
            }
          : null,
      },
      ratings: collectionRatings,
      isOwner,
    });
  } catch (error: any) {
    console.error("[Get Collection Detail Error]", error);
    return NextResponse.json(
      { error: "Failed to fetch collection" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify collection ownership
    const col = await db.query.collections.findFirst({
      where: (c, { eq, and }) => and(eq(c.id, id), eq(c.userId, session.user.id)),
    });

    if (!col) {
      return NextResponse.json(
        { error: "Collection not found or access denied" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "A JSON object is required" }, { status: 400 });
    const updateData: Partial<typeof collections.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return NextResponse.json({ error: "Title must be a non-empty string" }, { status: 400 });
      }
      updateData.title = body.title.trim();
    }

    if (body.description !== undefined) {
      updateData.description = typeof body.description === "string" ? body.description : null;
    }

    if (body.visibility !== undefined) {
      if (!["private", "unlisted", "public"].includes(body.visibility)) {
        return NextResponse.json(
          { error: "Visibility must be 'private', 'unlisted', or 'public'" },
          { status: 400 }
        );
      }
      updateData.visibility = body.visibility;
      updateData.isPublic = body.visibility === "public" || body.visibility === "unlisted";
    }

    // Security Fix: Strict boolean validation against coercion
    if (body.isPublic !== undefined) {
      if (typeof body.isPublic !== "boolean") {
        return NextResponse.json({ error: "isPublic must be an explicit boolean" }, { status: 400 });
      }
      if (body.visibility !== undefined && body.isPublic !== (body.visibility !== "private")) {
        return NextResponse.json({ error: "isPublic conflicts with visibility" }, { status: 400 });
      }
      updateData.isPublic = body.isPublic;
      if (body.visibility === undefined) {
        updateData.visibility = body.isPublic ? "public" : "private";
      }
    }

    if (body.isPinned !== undefined) {
      if (typeof body.isPinned !== "boolean") {
        return NextResponse.json({ error: "isPinned must be an explicit boolean" }, { status: 400 });
      }
      updateData.isPinned = body.isPinned;
    }

    // Rating method switching (numerical <-> tier)
    if (body.ratingMethod !== undefined) {
      if (body.ratingMethod === "tier") {
        const userTier = await db.query.ratingSystems.findFirst({
          where: (rs, { eq, and }) =>
            and(eq(rs.userId, session.user.id), eq(rs.type, "tier"), eq(rs.isDefault, true)),
        });
        const anyUserTier = userTier || await db.query.ratingSystems.findFirst({
          where: (rs, { eq, and }) =>
            and(eq(rs.userId, session.user.id), eq(rs.type, "tier")),
        });
        const systemTier = anyUserTier || await db.query.ratingSystems.findFirst({
          where: (rs, { eq, and }) =>
            and(eq(rs.type, "tier"), eq(rs.isSystemTemplate, true)),
        });
        updateData.defaultRatingSystemId = systemTier?.id || "rs_template_standard_tiers";
      } else if (body.ratingMethod === "numerical") {
        let defaultRs = await db.query.ratingSystems.findFirst({
          where: (rs, { eq, and }) =>
            and(eq(rs.userId, session.user.id), eq(rs.isDefault, true), eq(rs.type, "numerical")),
        });
        if (!defaultRs) {
          defaultRs = await db.query.ratingSystems.findFirst({
            where: (rs, { eq, and }) =>
              and(eq(rs.userId, session.user.id), eq(rs.type, "numerical")),
          });
        }
        updateData.defaultRatingSystemId = defaultRs?.id || null;
      }
    }

    // Explicit rating system assignment (supports user systems AND system templates)
    if (body.defaultRatingSystemId !== undefined) {
      if (body.defaultRatingSystemId !== null) {
        const rs = await db.query.ratingSystems.findFirst({
          where: (r, { eq, and, or, isNull }) =>
            and(
              eq(r.id, body.defaultRatingSystemId),
              or(
                eq(r.userId, session.user.id),
                and(eq(r.isSystemTemplate, true), isNull(r.userId))
              )
            ),
        });
        if (!rs) {
          return NextResponse.json(
            { error: "Invalid rating system or access denied" },
            { status: 400 }
          );
        }
      }
      updateData.defaultRatingSystemId = body.defaultRatingSystemId;
    }

    if (body.customCoverImage !== undefined) {
      updateData.customCoverImage = typeof body.customCoverImage === "string" ? body.customCoverImage : null;
    }

    if (body.backdropImage !== undefined) {
      updateData.backdropImage = typeof body.backdropImage === "string" ? body.backdropImage : null;
    }

    await db.update(collections).set(updateData).where(and(eq(collections.id, id), eq(collections.userId, session.user.id)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Update Collection Error]", error);
    return NextResponse.json(
      { error: "Failed to update collection" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const col = await db.query.collections.findFirst({
      where: (c, { eq, and }) => and(eq(c.id, id), eq(c.userId, session.user.id)),
    });

    if (!col) {
      return NextResponse.json(
        { error: "Collection not found or access denied" },
        { status: 404 }
      );
    }

    await db.delete(collections).where(and(eq(collections.id, id), eq(collections.userId, session.user.id)));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Delete Collection Error]", error);
    return NextResponse.json(
      { error: "Failed to delete collection" },
      { status: 500 }
    );
  }
}
