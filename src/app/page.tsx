import Link from "next/link";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { collections, ratings } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Film,
  Tv,
  ListPlus,
  Star,
  Pin,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Plus,
} from "lucide-react";
import { getTmdbImageUrl } from "@/lib/tmdb";

export default async function HomePage() {
  const session = await getServerSession();

  if (!session) {
    return (
      <div className="relative overflow-hidden">
        {/* Cinematic Backdrop Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-amber-500/10 via-amber-600/5 to-transparent blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 py-20 sm:py-28 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Inspired by Aubrey&apos;s Spreadsheet</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Definitive rankings for TV shows,
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
              movies & custom collections.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
            Rate every episode, franchise film, and sci-fi masterpiece with custom weighted scoring.
            Fine-tune Music, Acting, Writing, Cinematography, and Vibes to reflect your true taste.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto text-base font-bold px-8 shadow-lg shadow-amber-500/20">
                Get Started
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8">
                Sign In
              </Button>
            </Link>
          </div>

          {/* Three Ranking Types Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 text-left">
            <Card className="p-6 border-border/80 bg-card/60 backdrop-blur hover:border-amber-500/40 transition-all">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                <Tv className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">TV Show Rankings</h3>
              <p className="text-sm text-muted-foreground">
                Import complete shows or specific seasons. Rank every episode with official TMDB stills and custom weights.
              </p>
            </Card>

            <Card className="p-6 border-border/80 bg-card/60 backdrop-blur hover:border-amber-500/40 transition-all">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                <Film className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Movie Franchises</h3>
              <p className="text-sm text-muted-foreground">
                Rank entire sagas like Harry Potter, Alien, or Star Wars with official poster art and customizable order.
              </p>
            </Card>

            <Card className="p-6 border-border/80 bg-card/60 backdrop-blur hover:border-amber-500/40 transition-all">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                <ListPlus className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Custom Collections</h3>
              <p className="text-sm text-muted-foreground">
                Mix movies, single episodes, and entire shows in custom collections like &quot;Best Sci-Fi of all time&quot;.
              </p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // LOGGED IN USER LIBRARY
  const userCollections = await db.query.collections.findMany({
    where: (c, { eq }) => eq(c.userId, session.user.id),
    orderBy: [desc(collections.isPinned), desc(collections.updatedAt)],
    with: {
      entries: {
        with: {
          mediaItem: true,
        },
      },
      ratings: true,
    },
  });

  const totalRated = await db
    .select({ count: sql<number>`count(*)` })
    .from(ratings)
    .where(eq(ratings.userId, session.user.id));

  const totalRatedCount = Number(totalRated[0]?.count || 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome back, {session.user.name || "Critic"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your collections, compare weighted averages, and refine your rankings.
          </p>
        </div>
        <Link href="/create">
          <Button className="font-semibold gap-1.5 shadow-md shadow-amber-500/20">
            <Plus className="h-4 w-4" />
            <span>Create Ranking</span>
          </Button>
        </Link>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/70 bg-card/60">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Collections
          </span>
          <p className="text-2xl font-bold text-white mt-1">{userCollections.length}</p>
        </div>
        <div className="p-4 rounded-xl border border-border/70 bg-card/60">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Rated Items
          </span>
          <p className="text-2xl font-bold text-amber-400 mt-1">{totalRatedCount}</p>
        </div>
        <div className="p-4 rounded-xl border border-border/70 bg-card/60">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Pinned
          </span>
          <p className="text-2xl font-bold text-white mt-1">
            {userCollections.filter((c) => c.isPinned).length}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-border/70 bg-card/60">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Scale Mode
          </span>
          <p className="text-2xl font-bold text-white mt-1">1–10 Scale</p>
        </div>
      </div>

      {/* Collections Grid */}
      {userCollections.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-border/80 bg-card/40 space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Film className="h-6 w-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-white">Your library is waiting</h3>
            <p className="text-sm text-muted-foreground">
              Create your first TV show, franchise, or custom collection to start rating.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/create?type=tv_show&suggest=Black+Mirror">
              <Button variant="secondary" size="sm" className="gap-2">
                <Tv className="h-4 w-4 text-amber-400" />
                Rank Black Mirror
              </Button>
            </Link>
            <Link href="/create?type=movie_franchise">
              <Button variant="secondary" size="sm" className="gap-2">
                <Film className="h-4 w-4 text-amber-400" />
                Rank a Movie Franchise
              </Button>
            </Link>
            <Link href="/create?type=custom">
              <Button variant="secondary" size="sm" className="gap-2">
                <ListPlus className="h-4 w-4 text-amber-400" />
                Custom Collection
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Your Collections</span>
              <Badge variant="secondary" className="text-xs font-normal">
                {userCollections.length}
              </Badge>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {userCollections.map((col) => {
              const ratedCount = col.ratings.length;
              const totalItems = col.entries.length;
              const coverUrl = getTmdbImageUrl(
                col.customCoverImage || col.backdropImage,
                "w1280"
              );

              // Calculate collection average score
              const scores = col.ratings
                .map((r) => r.calculatedOverallScore)
                .filter((s): s is number => s !== null && s !== undefined);
              const avgScore =
                scores.length > 0
                  ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
                  : null;

              return (
                <Link
                  key={col.id}
                  href={`/collection/${col.id}`}
                  className="group block relative rounded-2xl overflow-hidden border border-border/70 bg-card hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300"
                >
                  {/* Artwork Container */}
                  <div className="aspect-[16/10] w-full overflow-hidden relative bg-muted">
                    {col.customCoverImage || col.backdropImage ? (
                      <img
                        src={coverUrl}
                        alt={col.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-card to-secondary text-muted-foreground">
                        <Film className="h-10 w-10 opacity-30" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <Badge variant="secondary" className="backdrop-blur-md bg-black/60 text-[10px] uppercase font-bold tracking-wider border-white/10">
                        {col.collectionType === "tv_show"
                          ? "TV Show"
                          : col.collectionType === "movie_franchise"
                          ? "Franchise"
                          : "Custom"}
                      </Badge>
                      {col.isPinned && (
                        <div className="h-6 w-6 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-500/40 flex items-center justify-center text-amber-300">
                          <Pin className="h-3 w-3" />
                        </div>
                      )}
                    </div>

                    {/* Bottom Stats on image */}
                    {avgScore !== null && (
                      <div className="absolute bottom-3 right-3">
                        <Badge variant="score" className="text-xs px-2 py-0.5 shadow-md">
                          ★ {avgScore.toFixed(1)}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-1.5">
                    <h3 className="font-bold text-white text-base group-hover:text-amber-400 transition-colors line-clamp-1">
                      {col.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {col.description || `${totalItems} items in collection`}
                    </p>

                    <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50">
                      <span>
                        {ratedCount} of {totalItems} rated
                      </span>
                      <span className="text-amber-400 font-medium group-hover:translate-x-0.5 transition-transform">
                        Open &rarr;
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
