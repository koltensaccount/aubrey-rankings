import { db } from "@/db";
import { mediaItems, ratings } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { ParsedLetterboxdFilm } from "./letterboxd";

export function filmIdentity(film: { title: string; year: number | null }) {
  return `${film.title.trim().toLowerCase()}::${film.year ?? ""}`;
}

export async function previewLetterboxdImport(
  userId: string,
  films: ParsedLetterboxdFilm[],
) {
  const existing = await db.query.ratings.findMany({
    where: (r, { and, eq, isNull }) =>
      and(eq(r.userId, userId), isNull(r.collectionId)),
    with: { mediaItem: true },
  });
  const keys = new Set(
    existing
      .filter((r) => r.mediaItem.mediaType === "movie")
      .map((r) =>
        filmIdentity({
          title: r.mediaItem.title,
          year: r.mediaItem.releaseDate
            ? Number(r.mediaItem.releaseDate.slice(0, 4)) || null
            : null,
        }),
      ),
  );
  const existingCount = films.filter((film) =>
    keys.has(filmIdentity(film)),
  ).length;
  return { existingCount, newCount: films.length - existingCount };
}

/** One atomic import, serialized against other imports to avoid duplicate shared media/rating inserts. */
export async function executeLetterboxdImport(
  userId: string,
  films: ParsedLetterboxdFilm[],
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('aubrey:letterboxd-import', 0))`,
    );
    const userRatings = await tx.query.ratings.findMany({
      where: (r, { and, eq, isNull }) =>
        and(eq(r.userId, userId), isNull(r.collectionId)),
      with: { mediaItem: true },
    });
    const byIdentity = new Map(
      userRatings
        .filter((r) => r.mediaItem.mediaType === "movie")
        .map((r) => [
          filmIdentity({
            title: r.mediaItem.title,
            year: r.mediaItem.releaseDate
              ? Number(r.mediaItem.releaseDate.slice(0, 4)) || null
              : null,
          }),
          r,
        ]),
    );
    let newCount = 0;
    let updatedCount = 0;
    for (const film of films) {
      const releaseDate = film.year ? `${film.year}-01-01` : null;
      const knownRating = byIdentity.get(filmIdentity(film));
      const media =
        knownRating?.mediaItem ??
        (await tx.query.mediaItems.findFirst({
          where: (m, { and, eq, isNull }) =>
            and(
              eq(m.mediaType, "movie"),
              sql`lower(trim(${m.title})) = lower(${film.title.trim()})`,
              film.year
                ? sql`substring(${m.releaseDate}, 1, 4) = ${String(film.year)}`
                : isNull(m.releaseDate),
            ),
        }));
      const mediaItem =
        media ??
        (
          await tx
            .insert(mediaItems)
            .values({
              id: `media_${randomUUID()}`,
              mediaType: "movie",
              title: film.title.trim(),
              releaseDate,
            })
            .returning()
        )[0];
      // Use the same global-rating lock as POST /api/ratings, then reread under a row lock.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([userId, null, mediaItem.id])}, 0))`);
      await tx.select({ id: ratings.id }).from(ratings).where(and(eq(ratings.userId,userId),eq(ratings.mediaItemId,mediaItem.id),isNull(ratings.collectionId))).for("update");
      const existing = await tx.query.ratings.findFirst({
          where: (r, { and, eq, isNull }) =>
            and(
              eq(r.userId, userId),
              eq(r.mediaItemId, mediaItem.id),
              isNull(r.collectionId),
            ),
        });
      const imported = {
        sourceScale: 5,
        sourceService: "letterboxd",
        isWatched: film.isWatched,
        sourceRating: film.rating ?? existing?.sourceRating ?? null,
        letterboxdUri: film.letterboxdUri || existing?.letterboxdUri || null,
        reviewText: existing?.reviewText || film.review || null,
        watchDate:
          existing?.watchDate ??
          (film.watchDate ? new Date(film.watchDate) : null),
        updatedAt: new Date(),
      };
      if (existing) {
        await tx
          .update(ratings)
          .set(imported)
          .where(and(eq(ratings.id, existing.id), eq(ratings.userId, userId)));
        updatedCount++;
      } else {
        await tx
          .insert(ratings)
          .values({
            id: `rate_${randomUUID()}`,
            userId,
            mediaItemId: mediaItem.id,
            collectionId: null,
            ...imported,
          });
        newCount++;
      }
    }
    return { newCount, updatedCount };
  });
}
