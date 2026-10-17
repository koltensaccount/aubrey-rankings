import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { artworkOverrides } from "@/db/schema";
import { nanoid } from "@/lib/utils";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mediaItemId = formData.get("mediaItemId") as string | null;

    if (!file || !mediaItemId) {
      return NextResponse.json(
        { error: "File and mediaItemId are required" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 5MB limit" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are allowed" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate image integrity with sharp
    const metadata = await sharp(buffer).metadata();
    if (!metadata.format || !metadata.width || !metadata.height) {
      return NextResponse.json(
        { error: "Invalid or corrupted image file" },
        { status: 400 }
      );
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    // Generate secure randomized filename
    const filename = `${session.user.id}_${Date.now()}_${nanoid(8)}.webp`;
    const targetPath = path.join(uploadsDir, filename);

    // Convert to webp and resize if overly large for efficient bandwidth
    await sharp(buffer)
      .resize({ width: 1200, height: 1800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(targetPath);

    const customArtworkUrl = `/uploads/${filename}`;

    // Upsert into artwork_overrides
    const overrideId = `art_${Date.now()}_${nanoid(6)}`;
    await db
      .insert(artworkOverrides)
      .values({
        id: overrideId,
        userId: session.user.id,
        mediaItemId,
        customArtworkUrl,
      })
      .onConflictDoUpdate({
        target: [artworkOverrides.userId, artworkOverrides.mediaItemId],
        set: {
          customArtworkUrl,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({
      success: true,
      customArtworkUrl,
    });
  } catch (error: any) {
    console.error("[Upload Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process image upload" },
      { status: 500 }
    );
  }
}
