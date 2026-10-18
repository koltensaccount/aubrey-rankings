import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { bugReports } from "@/db/schema";
import { checkIsAdmin } from "@/lib/admin";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session || !checkIsAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { status, adminNotes } = body;

    const payload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (["open", "investigating", "resolved"].includes(status)) {
      payload.status = status;
    }
    if (adminNotes !== undefined) {
      payload.adminNotes = adminNotes;
    }

    await db.update(bugReports).set(payload).where(eq(bugReports.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Update Bug Report Error]", error);
    return NextResponse.json(
      { error: "Failed to update bug report" },
      { status: 500 }
    );
  }
}
