"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Film, Tv, Users, Compass, ArrowRight, Loader2, Star } from "lucide-react";
import { resolveArtworkUrl, resolvePosterUrl } from "@/lib/artwork";

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "rankings" | "media" | "people">("all");
  const [loading, setLoading] = useState(false);

  const [tmdbResults, setTmdbResults] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setTmdbResults([]);
      setUserResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [tmdbRes, userRes] = await Promise.all([
          fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}&type=all`).then((r) =>
            r.ok ? r.json() : { results: [] }
          ),
          fetch(`/api/user/search?q=${encodeURIComponent(query)}`).then((r) =>
            r.ok ? r.json() : { users: [] }
          ),
        ]);

        setTmdbResults(tmdbRes.results || []);
        setUserResults(userRes.users || []);
      } catch (err) {
        console.error("Explore search failed", err);
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1b2520] border border-[#3b4c40] text-xs font-semibold text-[#89d5d5] uppercase tracking-wider mb-2">
          <Compass size={13} />
          <span>Social Discovery</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight text-[#f1f0e9]">
          Explore & Discover
        </h1>
        <p className="text-xs text-[#9aa79e] mt-1 max-w-xl">
          Search movies, television series, community curators, and public rankings across Aubrey Rankings.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative max-w-2xl">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8fa095]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, director, series, or username..."
          autoFocus
          className="w-full h-12 pl-12 pr-10 rounded-xl bg-[#141a17] border border-[#303b34] text-sm text-[#f1f0e9] placeholder-[#6c7d73] focus:outline-none focus:border-[#89d5d5] transition-colors"
        />
        {loading && (
          <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#89d5d5] animate-spin" />
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#303b34] pb-px text-xs">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-3 py-2 border-b-2 font-semibold transition-colors cursor-pointer ${
            activeTab === "all" ? "border-[#89d5d5] text-[#f1f0e9]" : "border-transparent text-[#8fa095] hover:text-[#f1f0e9]"
          }`}
        >
          All Results
        </button>
        <button
          onClick={() => setActiveTab("media")}
          className={`px-3 py-2 border-b-2 font-semibold transition-colors cursor-pointer ${
            activeTab === "media" ? "border-[#89d5d5] text-[#f1f0e9]" : "border-transparent text-[#8fa095] hover:text-[#f1f0e9]"
          }`}
        >
          Movies & TV ({tmdbResults.length})
        </button>
        <button
          onClick={() => setActiveTab("people")}
          className={`px-3 py-2 border-b-2 font-semibold transition-colors cursor-pointer ${
            activeTab === "people" ? "border-[#89d5d5] text-[#f1f0e9]" : "border-transparent text-[#8fa095] hover:text-[#f1f0e9]"
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
                <Users size={16} className="text-[#89d5d5]" />
                <h2 className="font-display text-lg uppercase tracking-wider text-[#f1f0e9]">
                  Curators & Members
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {userResults.map((u) => {
                  const initial = (u.name || u.username || "U").charAt(0).toUpperCase();
                  const handle = u.username || u.id;
                  return (
                    <Link
                      key={u.id}
                      href={`/u/${handle}`}
                      className="p-4 rounded-xl border border-[#303b34] bg-[#141a17] hover:border-[#425247] transition-colors flex items-center gap-3.5 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#1c2721] border border-[#3b4c40] flex items-center justify-center font-bold text-sm text-[#89d5d5] shrink-0 overflow-hidden">
                        {u.image ? (
                          <img src={u.image} alt={u.name || handle} className="w-full h-full object-cover" />
                        ) : (
                          initial
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-xs text-[#f1f0e9] group-hover:text-[#89d5d5] transition-colors truncate">
                          {u.name || `@${handle}`}
                        </h4>
                        <span className="text-[11px] text-[#8fa095] block truncate">@{handle}</span>
                        {u.bio && <p className="text-[11px] text-[#6c7d73] line-clamp-1 mt-0.5">{u.bio}</p>}
                      </div>
                      <ArrowRight size={14} className="text-[#6c7d73] group-hover:text-[#89d5d5] shrink-0 transition-colors" />
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Media Results */}
          {(activeTab === "all" || activeTab === "media") && tmdbResults.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Film size={16} className="text-[#89d5d5]" />
                <h2 className="font-display text-lg uppercase tracking-wider text-[#f1f0e9]">
                  Movies & Television Series
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {tmdbResults.map((m) => {
                  const title = m.title || m.name;
                  const year = (m.release_date || m.first_air_date || "").split("-")[0];
                  const poster = m.poster_path ? resolvePosterUrl(m.poster_path, "w342") : null;
                  const isTv = m.media_type === "tv" || !m.title;

                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border border-[#2b3730] bg-[#141a17] overflow-hidden flex flex-col justify-between group hover:border-[#89d5d5]/40 transition-colors"
                    >
                      <div className="aspect-[2/3] w-full bg-black relative overflow-hidden">
                        {poster ? (
                          <img
                            src={poster}
                            alt={title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-[#6c7d73] p-2 text-center">
                            {title}
                          </div>
                        )}
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-black/80 text-[#89d5d5] border border-[#89d5d5]/30">
                          {isTv ? "TV" : "Movie"}
                        </span>
                      </div>
                      <div className="p-3 space-y-1">
                        <h4 className="font-semibold text-xs text-[#f1f0e9] line-clamp-1">{title}</h4>
                        <span className="text-[10px] text-[#8fa095] block">{year || "—"}</span>
                        <Link
                          href={`/create?type=${isTv ? "tv_show" : "movie_franchise"}&suggest=${encodeURIComponent(title)}`}
                          className="mt-2 w-full py-1.5 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40] text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <span>Start Ranking</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {userResults.length === 0 && tmdbResults.length === 0 && !loading && (
            <div className="text-center py-20 border border-dashed border-[#303b34] rounded-xl text-xs text-[#8fa095]">
              No titles or curators found matching &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>
      ) : (
        /* Discovery Prompts / Suggested Hubs */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-3">
            <div className="w-9 h-9 rounded-lg bg-[#1c2721] border border-[#3b4c40] flex items-center justify-center text-[#89d5d5]">
              <Tv size={18} />
            </div>
            <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
              TV Anthologies & Series
            </h3>
            <p className="text-xs text-[#9aa79e] leading-relaxed">
              Explore episode-by-episode weighted breakdowns for series like Severance, Twin Peaks, and Black Mirror.
            </p>
            <Link
              href="/create?type=tv_show"
              className="inline-flex items-center gap-1.5 text-xs text-[#89d5d5] hover:underline font-semibold pt-1"
            >
              <span>Rank a Television Series</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-3">
            <div className="w-9 h-9 rounded-lg bg-[#1c2721] border border-[#3b4c40] flex items-center justify-center text-[#89d5d5]">
              <Film size={18} />
            </div>
            <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
              Director & Franchise Canons
            </h3>
            <p className="text-xs text-[#9aa79e] leading-relaxed">
              Compare complete cinematic universes like Alien, James Bond, Denis Villeneuve, or Stanley Kubrick.
            </p>
            <Link
              href="/create?type=movie_franchise"
              className="inline-flex items-center gap-1.5 text-xs text-[#89d5d5] hover:underline font-semibold pt-1"
            >
              <span>Rank a Movie Franchise</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-3">
            <div className="w-9 h-9 rounded-lg bg-[#1c2721] border border-[#3b4c40] flex items-center justify-center text-[#89d5d5]">
              <Users size={18} />
            </div>
            <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
              Community Curators
            </h3>
            <p className="text-xs text-[#9aa79e] leading-relaxed">
              Follow fellow critics, inspect their weighted evaluation rubrics, and read detailed critical commentary.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-[#89d5d5] hover:underline font-semibold pt-1"
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
