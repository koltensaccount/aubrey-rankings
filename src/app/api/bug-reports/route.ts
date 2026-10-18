import sharp from "sharp";
import { boundedJson, requireRateLimit, RequestError } from "@/lib/request-limits";
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
    requireRateLimit(`reports:${session?.user.id ?? "anonymous"}`, 5);
    const body = await boundedJson(request, 3 * 1024 * 1024);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { description, pageUrl, userAgent } = body;
    let screenshotUrl: string | null = null;
    if (typeof description !== "string" || description.length > 10000 || typeof pageUrl !== "string" || pageUrl.length > 2048 || (userAgent != null && (typeof userAgent !== "string" || userAgent.length > 1000))) throw new RequestError("Invalid report fields");
    if (body.screenshotUrl != null && body.screenshotUrl !== "") {
      if (typeof body.screenshotUrl !== "string" || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.screenshotUrl)) throw new RequestError("Screenshot must be a PNG, JPEG, or WebP image");
      const input = Buffer.from(body.screenshotUrl.split(",")[1],"base64");
      if (input.length > 2*1024*1024) throw new RequestError("Screenshot exceeds 2MB",413);
      try {
        const output = await sharp(input,{limitInputPixels:16000000}).rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).webp({quality:80}).toBuffer();
        screenshotUrl = `data:image/webp;base64,${output.toString("base64")}`;
      } catch { throw new RequestError("Invalid screenshot image"); }
    }

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
    if (error instanceof RequestError) return NextResponse.json({error:error.message},{status:error.status});
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
