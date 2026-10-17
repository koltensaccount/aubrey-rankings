import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { collections, collectionEntries, mediaItems, ratings, ratingSystems } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();

  try {
    const col = await db.query.collections.findFirst({
      where: (c, { eq }) => eq(c.id, id),
      with: {
        defaultRatingSystem: {
          with: {
            categories: {
              orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
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

    // Access control: if not public and not owner, reject
    if (!col.isPublic && (!session || session.user.id !== col.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Fetch user's ratings for this collection
    let userRatings: any[] = [];
    if (session) {
      userRatings = await db.query.ratings.findMany({
        where: (r, { eq, and }) =>
          and(eq(r.userId, session.user.id), eq(r.collectionId, col.id)),
        with: {
          categoryScores: true,
        },
      });
    }

    return NextResponse.json({
      collection: col,
      ratings: userRatings,
      isOwner: session ? session.user.id === col.userId : false,
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

    const body = await request.json();
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

    // Security Fix: Strict boolean validation against coercion
    if (body.isPublic !== undefined) {
      if (typeof body.isPublic !== "boolean") {
        return NextResponse.json({ error: "isPublic must be an explicit boolean" }, { status: 400 });
      }
      updateData.isPublic = body.isPublic;
    }

    if (body.isPinned !== undefined) {
      if (typeof body.isPinned !== "boolean") {
        return NextResponse.json({ error: "isPinned must be an explicit boolean" }, { status: 400 });
      }
      updateData.isPinned = body.isPinned;
    }

    // Security Fix: Verify rating system ownership
    if (body.defaultRatingSystemId !== undefined) {
      if (body.defaultRatingSystemId !== null) {
        const rs = await db.query.ratingSystems.findFirst({
          where: (r, { eq, and }) =>
            and(
              eq(r.id, body.defaultRatingSystemId),
              eq(r.userId, session.user.id)
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

    await db.update(collections).set(updateData).where(eq(collections.id, id));

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

    await db.delete(collections).where(eq(collections.id, id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Delete Collection Error]", error);
    return NextResponse.json(
      { error: "Failed to delete collection" },
      { status: 500 }
    );
  }
}
