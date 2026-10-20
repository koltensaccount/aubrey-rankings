import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq, sql, and, ne } from "drizzle-orm";
import { validateUsername, normalizeUsername } from "@/lib/username";
import { isValidHexColor, normalizeHexColor, isValidThemeMode, ThemeMode } from "@/lib/theme";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [found] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        username: user.username,
        bio: user.bio,
        preferredTheme: user.preferredTheme,
        accentColor: user.accentColor,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!found) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: found });
  } catch (error) {
    console.error("[Profile GET Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(()=>null);
    if (!body || typeof body !== "object" || Array.isArray(body) || (body.username !== undefined && typeof body.username !== "string")) return NextResponse.json({error:"Invalid profile fields"},{status:400});
    const {
      name,
      username: candidateUsername,
      bio,
      image,
      preferredTheme,
      accentColor,
    } = body;

    const updates: Partial<{
      name: string;
      username: string | null;
      bio: string | null;
      image: string | null;
      preferredTheme: string;
      accentColor: string;
      updatedAt: Date;
    }> = {
      updatedAt: new Date(),
    };

    if (preferredTheme !== undefined) {
      if (!isValidThemeMode(preferredTheme)) {
        return NextResponse.json(
          { error: "Invalid theme mode. Must be 'light', 'dark', or 'system'." },
          { status: 400 }
        );
      }
      updates.preferredTheme = preferredTheme;
    }

    if (accentColor !== undefined) {
      if (!isValidHexColor(accentColor)) {
        return NextResponse.json(
          { error: "Invalid accent color. Must be a valid hex color code (e.g. #89D5D5)." },
          { status: 400 }
        );
      }
      updates.accentColor = normalizeHexColor(accentColor);
    }

    if (typeof name === "string" && name.trim()) {
      updates.name = name.trim();
    }

    if (typeof bio === "string") {
      updates.bio = bio.trim().slice(0, 500); // Max 500 characters
    }

    if (image === null || image === "") {
      updates.image = null;
    } else if (typeof image === "string") {
      const prefix = `/uploads/avatars/${session.user.id}_`;
      if (!image.startsWith(prefix) || !/^\/uploads\/avatars\/[A-Za-z0-9_-]+\.webp$/.test(image)) return NextResponse.json({error:"Use an avatar uploaded by this account"},{status:400});
      updates.image = image;
    }

    if (candidateUsername !== undefined) {
      if (!candidateUsername) {
        return NextResponse.json(
          { error: "Username cannot be empty." },
          { status: 400 }
        );
      }

      const validation = validateUsername(candidateUsername);
      if (!validation.valid || !validation.normalized) {
        return NextResponse.json(
          { error: validation.error || "Invalid username format." },
          { status: 400 }
        );
      }

      const normalized = validation.normalized;

      // Ensure no OTHER user is currently using this username
      const existing = await db
        .select({ id: user.id })
        .from(user)
        .where(
          and(
            sql`LOWER(${user.username}) = LOWER(${normalized})`,
            ne(user.id, session.user.id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json(
          { error: `The username "${normalized}" is already taken.` },
          { status: 409 }
        );
      }

      updates.username = normalized;
    }

    const [updated] = await db
      .update(user)
      .set(updates)
      .where(eq(user.id, session.user.id))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        username: user.username,
        bio: user.bio,
        preferredTheme: user.preferredTheme,
        accentColor: user.accentColor,
      });

    return NextResponse.json({ user: updated, success: true });
  } catch (error) {
    console.error("[Profile PATCH Error]", error);
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
