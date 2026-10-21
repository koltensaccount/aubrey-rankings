import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { parseLetterboxdZip } from "@/lib/letterboxd";
import { executeLetterboxdImport } from "@/lib/letterboxd-import";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No ZIP file uploaded." },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json(
        { error: "Invalid file format. Please upload a .zip archive." },
        { status: 400 },
      );
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Archive exceeds maximum permitted size of 25MB." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let summary;
    try {
      summary = parseLetterboxdZip(buffer);
    } catch {
      return NextResponse.json(
        { error: "Invalid or oversized Letterboxd archive." },
        { status: 400 },
      );
    }
    if (summary.films.length === 0) {
      return NextResponse.json(
        { error: "No films found in archive." },
        { status: 400 },
      );
    }

    const result = await executeLetterboxdImport(
      session.user.id,
      summary,
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[Letterboxd Execute Error]", error);
    return NextResponse.json(
      { error: "Failed to execute Letterboxd import. No changes were saved." },
      { status: 500 },
    );
  }
}
