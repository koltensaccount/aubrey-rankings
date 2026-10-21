import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { diaryEntries } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const entry = await db.query.diaryEntries.findFirst({
      where: and(
        eq(diaryEntries.id, id),
        eq(diaryEntries.userId, session.user.id),
      ),
      with: {
        mediaItem: true,
        rating: true,
        review: true,
      },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, entry });
  } catch (error: any) {
    console.error("[Diary [id] GET Error]", error);
    return NextResponse.json(
      { error: "Failed to retrieve diary entry" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.query.diaryEntries.findFirst({
      where: and(
        eq(diaryEntries.id, id),
        eq(diaryEntries.userId, session.user.id),
      ),
    });

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const body = await req.json();
    const updateData: Partial<typeof diaryEntries.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.watchedDate !== undefined) {
      updateData.watchedDate =
        typeof body.watchedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.watchedDate.trim())
          ? body.watchedDate.trim()
          : null;
    }

    if (body.isRewatch !== undefined) {
      updateData.isRewatch = Boolean(body.isRewatch);
    }

    if (body.ratingValue !== undefined) {
      const parsed =
        typeof body.ratingValue === "number" && !isNaN(body.ratingValue)
          ? Math.max(0, Math.min(10, body.ratingValue))
          : null;
      updateData.ratingValue = parsed;
      updateData.sourceRating =
        typeof body.sourceRating === "number" && !isNaN(body.sourceRating)
          ? Math.max(0.5, Math.min(5, body.sourceRating))
          : parsed !== null
            ? parsed / 2
            : null;
      updateData.sourceScale = updateData.sourceRating !== null ? 5 : null;
    }

    if (body.notes !== undefined) {
      updateData.notes = typeof body.notes === "string" ? body.notes.trim() : null;
    }

    if (body.tags !== undefined) {
      updateData.tags = Array.isArray(body.tags) ? body.tags : null;
    }

    await db
      .update(diaryEntries)
      .set(updateData)
      .where(eq(diaryEntries.id, id));

    const updated = await db.query.diaryEntries.findFirst({
      where: eq(diaryEntries.id, id),
      with: {
        mediaItem: true,
        rating: true,
        review: true,
      },
    });

    return NextResponse.json({ success: true, entry: updated });
  } catch (error: any) {
    console.error("[Diary [id] PATCH Error]", error);
    return NextResponse.json(
      { error: "Failed to update diary entry" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.query.diaryEntries.findFirst({
      where: and(
        eq(diaryEntries.id, id),
        eq(diaryEntries.userId, session.user.id),
      ),
    });

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await db.delete(diaryEntries).where(eq(diaryEntries.id, id));

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error("[Diary [id] DELETE Error]", error);
    return NextResponse.json(
      { error: "Failed to delete diary entry" },
      { status: 500 },
    );
  }
}
