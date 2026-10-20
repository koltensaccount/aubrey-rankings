"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Film, Tv, Users, Compass, ArrowRight, Loader2, UserPlus, UserCheck, BookOpen, PenLine, Plus, Star } from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { useSession } from "@/lib/auth-client";

export default function ExplorePage() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "media" | "people">("all");
  const [loading, setLoading] = useState(false);

  const [tmdbResults, setTmdbResults] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [togglingMap, setTogglingMap] = useState<Record<string, boolean>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    if (pathname === "/explore") {
      router.replace(`/discover${window.location.search}`);
    }
  }, [pathname, router]);

  const handleToggleFollow = async (e: React.MouseEvent, targetUser: any) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session?.user) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }

    const currentFollowing = !!targetUser.isFollowing;
    const nextFollowing = !currentFollowing;

    // Optimistic UI update
    setUserResults((prev) =>
      prev.map((item) =>
        item.id === targetUser.id ? { ...item, isFollowing: nextFollowing } : item
      )
    );
    setTogglingMap((prev) => ({ ...prev, [targetUser.id]: true }));

    try {
      const res = await fetch("/api/social/follow", {
        method: nextFollowing ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: targetUser.id }),
      });

      if (!res.ok) {
        throw new Error("Failed to update follow status");
      }

      const data = await res.json();
      setUserResults((prev) =>
        prev.map((item) =>
          item.id === targetUser.id ? { ...item, isFollowing: data.isFollowing } : item
        )
      );
    } catch (err) {
      console.error("Error toggling follow from explore search:", err);
      // Rollback on error
      setUserResults((prev) =>
        prev.map((item) =>
          item.id === targetUser.id ? { ...item, isFollowing: currentFollowing } : item
        )
      );
    } finally {
      setTogglingMap((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  };

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setTmdbResults([]);
      setUserResults([]);
      setSearchError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError(null);
      try {
        const [tmdbRes, userRes] = await Promise.all([
          fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}&type=all`).then((r) =>
            r.ok ? r.json() : { results: [] }
          ),
          fetch(`/api/user/search?q=${encodeURIComponent(query)}`).then(async (r) => {
            if (!r.ok) {
              const err = await r.json().catch(() => ({}));
              throw new Error(err?.error || "Failed to search community members");
            }
            return r.json();
          }),
        ]);

        setTmdbResults(tmdbRes.results || []);
        setUserResults(userRes.users || []);
      } catch (err: any) {
        console.error("Explore search failed", err);
        setSearchError(err?.message || "Search request encountered an error.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary uppercase tracking-wider mb-2">
          <Compass size={13} />
          <span>Find what to watch & journal</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight text-foreground">
          Discover
        </h1>
        <p className="text-xs text-muted-foreground mt-1 max-w-xl">
          Search movies, television series, and community curators. Log what you watch directly into your personal Journal or start a ranking collection.
        </p>
        {session && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Link href="/journal" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-colors">
              <BookOpen size={14} />
              My Journal
            </Link>
            <Link href="/create" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-secondary hover:bg-muted text-secondary-foreground border border-border text-xs font-semibold transition-colors">
              <Plus size={14} />
              Create Ranking
            </Link>
          </div>
        )}
      </div>

      {/* Search Input */}
      <div className="relative max-w-2xl">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, director, series, or username..."
          autoFocus
          className="w-full h-12 pl-12 pr-10 rounded-xl bg-input border border-input-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
        />
        {loading && (
          <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary animate-spin" />
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-px text-xs">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-3 py-2 border-b-2 font-semibold transition-colors cursor-pointer ${
            activeTab === "all" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          All Results
        </button>
        <button
          onClick={() => setActiveTab("media")}
          className={`px-3 py-2 border-b-2 font-semibold transition-colors cursor-pointer ${
            activeTab === "media" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Movies & TV ({tmdbResults.length})
        </button>
        <button
          onClick={() => setActiveTab("people")}
          className={`px-3 py-2 border-b-2 font-semibold transition-colors cursor-pointer ${
            activeTab === "people" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          People ({userResults.length})
        </button>
      </div>

      {/* Results Section */}
      {query.trim().length >= 2 ? (
        <div className="space-y-10">
          {/* People Results */}
          {(activeTab === "all" || activeTab === "people") && userResults.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-primary" />
                <h2 className="font-display text-lg uppercase tracking-wider text-foreground">
                  Curators & Members
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {userResults.filter((u) => typeof u.username === "string" && u.username.trim()).map((u) => {
                  const initial = (u.name || u.username || "U").charAt(0).toUpperCase();
                  const handle = u.username;
                  const isSelf = !!u.isSelf || session?.user?.id === u.id;
                  const isFollowing = !!u.isFollowing;
                  const isToggling = !!togglingMap[u.id];
                  const isHovered = hoveredId === u.id;

                  return (
                    <div
                      key={u.id}
                      className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors flex items-center justify-between gap-3 group shadow-sm"
                    >
                      <Link
                        href={`/u/${handle}`}
                        className="flex items-center gap-3.5 min-w-0 flex-1 overflow-hidden"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-sm text-primary shrink-0 overflow-hidden">
                          {u.image ? (
                            <img src={u.image} alt={u.name || handle} className="w-full h-full object-cover" />
                          ) : (
                            initial
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                            {u.name || `@${handle}`}
                          </h4>
                          <span className="text-[11px] text-muted-foreground block truncate">@{handle}</span>
                          {u.bio && <p className="text-[11px] text-muted-foreground/80 line-clamp-1 mt-0.5">{u.bio}</p>}
                        </div>
                      </Link>

                      {isSelf ? (
                        <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-2.5 py-1 rounded-md bg-secondary/60 shrink-0">
                          You
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleToggleFollow(e, u)}
                          disabled={isToggling}
                          onMouseEnter={() => setHoveredId(u.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          aria-label={isFollowing ? `Unfollow ${u.name || handle}` : `Follow ${u.name || handle}`}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer min-w-[92px] ${
                            isFollowing
                              ? isHovered
                                ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                                : "bg-secondary hover:bg-surface-elevated text-foreground border border-border"
                              : "bg-primary hover:bg-primary-hover text-primary-foreground border border-transparent shadow-sm"
                          }`}
                        >
                          {isToggling ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isFollowing ? (
                            isHovered ? (
                              <span>Unfollow</span>
                            ) : (
                              <>
                                <UserCheck size={12} className="text-primary" />
                                <span>Following</span>
                              </>
                            )
                          ) : (
                            <>
                              <UserPlus size={12} />
                              <span>Follow</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === "people" && userResults.length === 0 && !loading && (
            <div className="p-8 rounded-xl border border-border bg-card text-center space-y-2">
              <Users className="w-8 h-8 text-muted-foreground/50 mx-auto stroke-[1.5]" />
              <p className="text-sm font-semibold text-foreground">No curators found</p>
              <p className="text-xs text-muted-foreground">
                {searchError || `No community members found matching "${query}". Curators must complete username onboarding to appear in search.`}
              </p>
            </div>
          )}

          {/* Media Results */}
          {(activeTab === "all" || activeTab === "media") && tmdbResults.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Film size={16} className="text-primary" />
                <h2 className="font-display text-lg uppercase tracking-wider text-foreground">
                  Movies & Television Series
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {tmdbResults.map((m) => {
                  const title = m.title || m.name;
                  const year = (m.release_date || m.first_air_date || "").split("-")[0];
                  const isTv = m.media_type === "tv" || !m.title;
                  const movieJournalHref = session?.user
                    ? `/media/${m.id}?type=movie&journal=1`
                    : `/login?redirect=${encodeURIComponent(`/media/${m.id}?type=movie&journal=1`)}`;
                  const tvDetailsHref = `/media/${m.id}?type=tv`;

                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border border-border bg-card overflow-hidden flex flex-col justify-between group hover:border-primary/40 transition-colors shadow-sm"
                    >
                      <div className="aspect-[2/3] w-full bg-black relative overflow-hidden">
                        <CinematicMediaCard posterPath={m.poster_path} title={title} aspect="poster" />
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-black/80 text-primary border border-primary/30">
                          {isTv ? "TV" : "Movie"}
                        </span>
                      </div>
                      <div className="p-3 space-y-1.5">
                        <Link
                          href={isTv ? tvDetailsHref : `/media/${m.id}?type=movie`}
                          className="font-semibold text-xs text-foreground hover:text-primary transition-colors line-clamp-1 block"
                        >
                          {title}
                        </Link>
                        <span className="text-[10px] text-muted-foreground block">{year || "—"}</span>

                        {/* Primary Journal Action */}
                        <div className="pt-1 space-y-1.5">
                          {isTv ? (
                            <Link
                              href={tvDetailsHref}
                              className="w-full py-1.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                            >
                              <Tv size={11} />
                              <span>Episodes & Journal</span>
                            </Link>
                          ) : (
                            <Link
                              href={movieJournalHref}
                              className="w-full py-1.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                            >
                              <PenLine size={11} />
                              <span>Add to Journal</span>
                            </Link>
                          )}

                          {/* Secondary Ranking & Reviews Actions */}
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/create?type=${isTv ? "tv_show" : "movie_franchise"}&suggest=${encodeURIComponent(title)}`}
                              className="flex-1 py-1 rounded-button bg-secondary hover:bg-muted text-secondary-foreground border border-border text-[9px] font-medium flex items-center justify-center transition-colors"
                            >
                              Rank
                            </Link>
                            <Link
                              href={isTv ? tvDetailsHref : `/media/${m.id}?type=movie`}
                              className="flex-1 py-1 rounded-button bg-surface hover:bg-surface-elevated text-foreground border border-border text-[9px] font-medium flex items-center justify-center transition-colors"
                            >
                              Reviews
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {userResults.length === 0 && tmdbResults.length === 0 && !loading && (
            <div className="text-center py-20 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
              No titles or curators found matching &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>
      ) : (
        /* Discovery Prompts / Suggested Hubs */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          <div className="p-5 rounded-xl border border-border bg-card space-y-2.5 shadow-sm flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <BookOpen size={18} />
              </div>
              <h3 className="font-display text-lg uppercase font-bold text-foreground">
                Personal Cinema Journal
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Log any film or TV episode as you watch. Rate with quick scores or weighted categories, and keep private notes.
              </p>
            </div>
            <Link
              href="/journal"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold pt-2"
            >
              <span>Open Your Journal</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card space-y-2.5 shadow-sm flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Tv size={18} />
              </div>
              <h3 className="font-display text-lg uppercase font-bold text-foreground">
                TV Anthologies & Series
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Explore episode-by-episode breakdowns for series like Severance, Twin Peaks, and Black Mirror.
              </p>
            </div>
            <Link
              href="/create?type=tv_show"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold pt-2"
            >
              <span>Rank a Television Series</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card space-y-2.5 shadow-sm flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Film size={18} />
              </div>
              <h3 className="font-display text-lg uppercase font-bold text-foreground">
                Director & Franchise Canons
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Compare complete cinematic universes like Alien, Denis Villeneuve, or Christopher Nolan.
              </p>
            </div>
            <Link
              href="/create?type=movie_franchise"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold pt-2"
            >
              <span>Rank a Movie Franchise</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card space-y-2.5 shadow-sm flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Users size={18} />
              </div>
              <h3 className="font-display text-lg uppercase font-bold text-foreground">
                Community Curators
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Follow fellow critics, read published reviews in the Feed, and discover curated rankings.
              </p>
            </div>
            <Link
              href="/feed"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold pt-2"
            >
              <span>Browse Community Feed</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
