"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Film, Tv, Users, Compass, ArrowRight, Loader2, UserPlus, UserCheck } from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { useSession } from "@/lib/auth-client";

function ExplorePageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
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

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "people" || requestedTab === "media" || requestedTab === "all") setActiveTab(requestedTab);
  }, [searchParams]);

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
        const [tmdbResult, userResult] = await Promise.allSettled([
          fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}&type=all`).then(async (r) => { const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.error || "Title search is unavailable"); return data; }),
          fetch(`/api/user/search?q=${encodeURIComponent(query)}`).then(async (r) => { const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.error || "People search is unavailable"); return data; }),
        ]);
        setTmdbResults(tmdbResult.status === "fulfilled" ? tmdbResult.value.results || [] : []);
        setUserResults(userResult.status === "fulfilled" ? userResult.value.users || [] : []);
        const errors = [tmdbResult, userResult].filter((result): result is PromiseRejectedResult => result.status === "rejected").map((result) => result.reason?.message).filter(Boolean);
        if (errors.length) setSearchError(errors.join(" "));
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
          <span>Find what to watch</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight text-foreground">
          Discover
        </h1>
        <p className="text-xs text-muted-foreground mt-1 max-w-xl">
          Search movies, television series, and community members. Start a ranking whenever you find a collection worth making your own.
        </p>
        {session && (
          <Link href="/create" className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-colors">
            <Film size={14} />
            Create Ranking
          </Link>
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
                      <div className="p-3 space-y-1">
                        <Link
                          href={`/media/${m.id}?type=${isTv ? "tv" : "movie"}`}
                          className="font-semibold text-xs text-foreground hover:text-primary transition-colors line-clamp-1 block"
                        >
                          {title}
                        </Link>
                        <span className="text-[10px] text-muted-foreground block">{year || "—"}</span>
                        <div className="flex items-center gap-1.5 pt-1.5">
                          <Link
                            href={`/media/${m.id}?type=${isTv ? "tv" : "movie"}`}
                            className="flex-1 py-1 rounded-md bg-surface hover:bg-surface-raised text-foreground border border-border text-[10px] font-semibold flex items-center justify-center transition-colors"
                          >
                            Reviews
                          </Link>
                          <Link
                            href={`/create?type=${isTv ? "tv_show" : "movie_franchise"}&suggest=${encodeURIComponent(title)}`}
                            className="flex-1 py-1 rounded-md bg-secondary hover:bg-muted text-secondary-foreground border border-border text-[10px] font-semibold flex items-center justify-center transition-colors"
                          >
                            Rank
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {searchError && !loading && <p role="alert" className="text-xs text-destructive">{searchError}</p>}
          {userResults.length === 0 && tmdbResults.length === 0 && !loading && !searchError && (
            <div className="text-center py-20 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
              No titles or curators found matching &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>
      ) : (
        /* Discovery Prompts / Suggested Hubs */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="p-6 rounded-xl border border-border bg-card space-y-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Tv size={18} />
            </div>
            <h3 className="font-display text-xl uppercase font-bold text-foreground">
              TV Anthologies & Series
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Explore episode-by-episode weighted breakdowns for series like Severance, Twin Peaks, and Black Mirror.
            </p>
            <Link
              href="/create?type=tv_show"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold pt-1"
            >
              <span>Rank a Television Series</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card space-y-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Film size={18} />
            </div>
            <h3 className="font-display text-xl uppercase font-bold text-foreground">
              Director & Franchise Canons
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Compare complete cinematic universes like Alien, James Bond, Denis Villeneuve, or Stanley Kubrick.
            </p>
            <Link
              href="/create?type=movie_franchise"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold pt-1"
            >
              <span>Rank a Movie Franchise</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card space-y-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Users size={18} />
            </div>
            <h3 className="font-display text-xl uppercase font-bold text-foreground">
              Community Curators
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Follow fellow critics, inspect their weighted evaluation rubrics, and read detailed critical commentary.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold pt-1"
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

export default function ExplorePage() {
  return <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-16 text-sm text-muted-foreground">Loading discovery…</div>}><ExplorePageContent /></Suspense>;
}
