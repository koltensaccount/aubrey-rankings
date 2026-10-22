import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { removeCollectionEntry } from "@/lib/collection-management";
import { db } from "@/db";
import { collections, collectionEntries, mediaNotes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { id, entryId } = await params;
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

    const entry = await db.query.collectionEntries.findFirst({
      where: (e, { eq, and }) => and(eq(e.id, entryId), eq(e.collectionId, id)),
    });
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const updateFields: any = {};
    if (typeof body.shareNotes === "boolean") {
      updateFields.shareNotes = body.shareNotes;
    }

    // If updating note content, authoritative upsert into mediaNotes
    if (typeof body.notes === "string" || body.notes === null) {
      const noteContent = body.notes ? body.notes.trim() : "";
      if (noteContent) {
        const existingNote = await db.query.mediaNotes.findFirst({
          where: and(
            eq(mediaNotes.userId, session.user.id),
            eq(mediaNotes.mediaItemId, entry.mediaItemId)
          ),
        });
        if (existingNote) {
          await db
            .update(mediaNotes)
            .set({ content: noteContent, updatedAt: new Date() })
            .where(eq(mediaNotes.id, existingNote.id));
        } else {
          await db.insert(mediaNotes).values({
            id: `note_${randomUUID()}`,
            userId: session.user.id,
            mediaItemId: entry.mediaItemId,
            content: noteContent,
          });
        }
      }
      updateFields.notes = noteContent || null;
    }

    if (Object.keys(updateFields).length > 0) {
      await db
        .update(collectionEntries)
        .set(updateFields)
        .where(eq(collectionEntries.id, entryId));
    }

    return NextResponse.json({ success: true, updated: updateFields });
  } catch (error: any) {
    console.error("[Update Collection Entry Error]", error);
    return NextResponse.json(
      { error: "Failed to update collection entry" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id, entryId } = await params;
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const entry = await removeCollectionEntry(session.user.id, id, entryId);
    if (!entry)
      return NextResponse.json(
        { error: "Entry not found or access denied" },
        { status: 404 },
      );

    return NextResponse.json({
      success: true,
      deletedEntryId: entryId,
      mediaItemId: entry.mediaItemId,
    });
  } catch (error: any) {
    console.error("[Delete Collection Entry Error]", error);
    return NextResponse.json(
      { error: "Failed to remove entry from collection" },
      { status: 500 },
    );
  }
}
