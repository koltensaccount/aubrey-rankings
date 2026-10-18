import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { ratingSystems, ratingCategories, ratingTiers } from "@/db/schema";
import { nanoid } from "@/lib/utils";
import { eq, and, or, isNull } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const source = await db.query.ratingSystems.findFirst({
      where: (rs, { eq, and, or, isNull }) =>
        and(
          eq(rs.id, id),
          or(
            eq(rs.userId, session.user.id),
            and(isNull(rs.userId), eq(rs.isSystemTemplate, true))
          )
        ),
      with: {
        categories: {
          orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
        },
        tiers: {
          orderBy: (tier, { asc }) => [asc(tier.sortOrder)],
        },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Rating system not found" }, { status: 404 });
    }

    const newSystemId = `rs_${Date.now()}_${nanoid(6)}`;

    await db.transaction(async (tx) => {
      await tx.insert(ratingSystems).values({
        id: newSystemId,
        userId: session.user.id,
        name: `Copy of ${source.name}`,
        description: source.description,
        scale: source.scale,
        type: source.type || "numerical",
        isDefault: false,
        isSystemTemplate: false,
      });

      if (source.type === "tier" && Array.isArray(source.tiers)) {
        for (const t of source.tiers) {
          await tx.insert(ratingTiers).values({
            id: `tier_${Date.now()}_${nanoid(6)}`,
            ratingSystemId: newSystemId,
            name: t.name,
            description: t.description,
            color: t.color,
            sortOrder: t.sortOrder,
          });
        }
      } else if (Array.isArray(source.categories)) {
        for (const cat of source.categories) {
          await tx.insert(ratingCategories).values({
            id: `rc_${Date.now()}_${nanoid(6)}`,
            ratingSystemId: newSystemId,
            name: cat.name,
            description: cat.description,
            weight: cat.weight,
            sortOrder: cat.sortOrder,
            isRequired: cat.isRequired,
          });
        }
      }
    });

    const created = await db.query.ratingSystems.findFirst({
      where: (rs, { eq }) => eq(rs.id, newSystemId),
      with: {
        categories: {
          orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
        },
        tiers: {
          orderBy: (tier, { asc }) => [asc(tier.sortOrder)],
        },
      },
    });

    return NextResponse.json({ success: true, ratingSystem: created });
  } catch (error: any) {
    console.error("[Duplicate Rating System Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to duplicate rating system" },
      { status: 500 }
    );
  }
}
