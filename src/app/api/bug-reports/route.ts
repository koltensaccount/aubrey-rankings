import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { bugReports } from "@/db/schema";
import { nanoid } from "@/lib/utils";
import { desc } from "drizzle-orm";
import { checkIsAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { description, pageUrl, userAgent, screenshotUrl } = body;

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    if (!pageUrl || typeof pageUrl !== "string") {
      return NextResponse.json(
        { error: "Page URL is required" },
        { status: 400 }
      );
    }

    const reportId = `bug_${Date.now()}_${nanoid(6)}`;

    // Ensure table exists safely before insert
    await db.insert(bugReports).values({
      id: reportId,
      userId: session?.user?.id || null,
      description: description.trim(),
      pageUrl: pageUrl.trim(),
      userAgent: userAgent || request.headers.get("user-agent") || null,
      screenshotUrl: screenshotUrl || null,
      status: "open",
    });

    return NextResponse.json({ success: true, id: reportId });
  } catch (error: any) {
    console.error("[Create Bug Report Error]", error);
    return NextResponse.json(
      { error: "Failed to submit bug report" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session || !checkIsAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const reports = await db.query.bugReports.findMany({
      orderBy: [desc(bugReports.createdAt)],
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            username: true,
          },
        },
      },
      limit: 100,
    });

    return NextResponse.json({ reports });
  } catch (error: any) {
    console.error("[Get Bug Reports Error]", error);
    return NextResponse.json(
      { error: "Failed to fetch bug reports" },
      { status: 500 }
    );
  }
}
