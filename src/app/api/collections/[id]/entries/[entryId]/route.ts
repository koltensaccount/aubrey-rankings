import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { removeCollectionEntry } from "@/lib/collection-management";

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
