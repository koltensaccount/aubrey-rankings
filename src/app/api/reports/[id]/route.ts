import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { contentReports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkIsAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["open", "investigating", "resolved", "dismissed"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(request);
  if (!session || !checkIsAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Report ID required" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const { status, adminNotes } = body;

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "Invalid status. Must be 'open', 'investigating', 'resolved', or 'dismissed'" },
      { status: 400 }
    );
  }

  const existing = await db.query.contentReports.findFirst({
    where: (r, { eq }) => eq(r.id, id),
  });

  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  await db
    .update(contentReports)
    .set({
      status: status || existing.status,
      adminNotes: adminNotes !== undefined ? adminNotes : existing.adminNotes,
      resolvedById: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(contentReports.id, id));

  const updated = await db.query.contentReports.findFirst({
    where: (r, { eq }) => eq(r.id, id),
  });

  return NextResponse.json({ success: true, report: updated });
}
