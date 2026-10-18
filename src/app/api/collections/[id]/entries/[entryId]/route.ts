import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { collections, collectionEntries } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { id, entryId } = await params;
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Verify that user owns the collection
    const col = await db.query.collections.findFirst({
      where: (c, { eq, and }) =>
        and(eq(c.id, id), eq(c.userId, session.user.id)),
    });

    if (!col) {
      return NextResponse.json(
        { error: "Collection not found or access denied" },
        { status: 404 }
      );
    }

    // 2. Find the entry belonging to this collection
    const entry = await db.query.collectionEntries.findFirst({
      where: (ce, { eq, and }) =>
        and(eq(ce.id, entryId), eq(ce.collectionId, id)),
    });

    if (!entry) {
      return NextResponse.json(
        { error: "Entry not found in this collection" },
        { status: 404 }
      );
    }

    // 3. Delete the entry record (note: this preserves shared mediaItem metadata)
    await db
      .delete(collectionEntries)
      .where(
        and(
          eq(collectionEntries.id, entryId),
          eq(collectionEntries.collectionId, id)
        )
      );

    return NextResponse.json({
      success: true,
      deletedEntryId: entryId,
      mediaItemId: entry.mediaItemId,
    });
  } catch (error: any) {
    console.error("[Delete Collection Entry Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to remove entry from collection" },
      { status: 500 }
    );
  }
}
