import { syncViewingActivity } from "@/lib/activity-sync";
import { isValidWatchDate } from "@/lib/letterboxd";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { diaryEntries, activityEvents } from "@/db/schema";
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
    if (body.watchedDate != null && body.watchedDate !== "" && (typeof body.watchedDate !== "string" || !isValidWatchDate(body.watchedDate.trim()))) return NextResponse.json({ error: "Invalid viewing date" }, { status: 400 });
    const updateData: Partial<typeof diaryEntries.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.watchedDate !== undefined) {
      updateData.watchedDate =
        typeof body.watchedDate === "string" && isValidWatchDate(body.watchedDate.trim())
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

    if (body.tags !== undefined) {
      updateData.tags = Array.isArray(body.tags) ? body.tags : null;
    }

    await db.transaction(async (tx) => {
      const [saved] = await tx.update(diaryEntries).set(updateData).where(eq(diaryEntries.id, id)).returning();
      await syncViewingActivity(saved, tx);
    });

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

    await db.transaction(async (tx) => {
    await tx.delete(activityEvents).where(
      and(
        eq(activityEvents.diaryEntryId, id),
        eq(activityEvents.eventType, "viewing"),
        eq(activityEvents.userId, session.user.id),
      ),
    );
    await tx.update(activityEvents).set({ diaryEntryId: null }).where(and(eq(activityEvents.diaryEntryId, id), eq(activityEvents.userId, session.user.id)));
    await tx.delete(diaryEntries).where(eq(diaryEntries.id, id));

    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error("[Diary [id] DELETE Error]", error);
    return NextResponse.json(
      { error: "Failed to delete diary entry" },
      { status: 500 },
    );
  }
}
