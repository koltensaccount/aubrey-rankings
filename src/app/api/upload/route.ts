import { boundedFormData, requireRateLimit, RequestError } from "@/lib/request-limits";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { artworkOverrides, user } from "@/db/schema";
import { nanoid } from "@/lib/utils";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRateLimit(`upload:${session.user.id}`, 20);
    if (Number(request.headers.get("content-length")) > MAX_FILE_SIZE + 65536) throw new RequestError("Upload exceeds 5MB limit",413);
    const formData = await boundedFormData(request, MAX_FILE_SIZE + 65536);
    const file = formData.get("file") as File | null;
    const uploadType = formData.get("type") as string | null; // "avatar" | "backdrop" | "media"
    const mediaItemId = formData.get("mediaItemId") as string | null;

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Image file is required" },
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
    const metadata = await sharp(buffer,{limitInputPixels:16000000}).metadata();
    if (!metadata.format || !["jpeg","png","webp"].includes(metadata.format) || !metadata.width || !metadata.height) {
      return NextResponse.json(
        { error: "Invalid or corrupted image file" },
        { status: 400 }
      );
    }

    // 1. Avatar upload
    if (uploadType === "avatar") {
      const avatarsDir = path.join(process.cwd(), "public", "uploads", "avatars");
      await fs.mkdir(avatarsDir, { recursive: true });

      const filename = `${session.user.id}_${Date.now()}_${nanoid(6)}.webp`;
      const targetPath = path.join(avatarsDir, filename);

      await sharp(buffer,{limitInputPixels:16000000})
        .resize(400, 400, { fit: "cover" })
        .webp({ quality: 85 })
        .toFile(targetPath);

      const avatarUrl = `/uploads/avatars/${filename}`;

      // Update user record in database
      await db
        .update(user)
        .set({
          image: avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(user.id, session.user.id));

      return NextResponse.json({
        success: true,
        url: avatarUrl,
        image: avatarUrl,
      });
    }

    // 2. Backdrop / Banner upload
    if (uploadType === "backdrop" || uploadType === "banner") {
      const backdropsDir = path.join(process.cwd(), "public", "uploads", "backdrops");
      await fs.mkdir(backdropsDir, { recursive: true });

      const filename = `${session.user.id}_${Date.now()}_${nanoid(6)}.webp`;
      const targetPath = path.join(backdropsDir, filename);

      await sharp(buffer,{limitInputPixels:16000000})
        .resize({ width: 1920, height: 1080, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(targetPath);

      const backdropUrl = `/uploads/backdrops/${filename}`;

      return NextResponse.json({
        success: true,
        url: backdropUrl,
      });
    }

    // 3. Media Item Artwork Override
    if (mediaItemId) {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });

      const filename = `${session.user.id}_${Date.now()}_${nanoid(8)}.webp`;
      const targetPath = path.join(uploadsDir, filename);

      await sharp(buffer,{limitInputPixels:16000000})
        .resize({ width: 1200, height: 1800, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(targetPath);

      const customArtworkUrl = `/uploads/${filename}`;

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
        url: customArtworkUrl,
      });
    }

    return NextResponse.json(
      { error: "Invalid upload request. Must specify upload type or mediaItemId." },
      { status: 400 }
    );
  } catch (error: any) {
    if (error instanceof RequestError) return NextResponse.json({error:error.message},{status:error.status});
    console.error("[Upload Error]", error);
    return NextResponse.json(
      { error: "Invalid image or upload target" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type === "avatar") {
      await db
        .update(user)
        .set({
          image: null,
          updatedAt: new Date(),
        })
        .where(eq(user.id, session.user.id));

      return NextResponse.json({ success: true, image: null });
    }

    return NextResponse.json({ error: "Unsupported delete target" }, { status: 400 });
  } catch (error: any) {
    console.error("[Upload Delete Error]", error);
    return NextResponse.json(
      { error: "Failed to delete asset" },
      { status: 500 }
    );
  }
}
