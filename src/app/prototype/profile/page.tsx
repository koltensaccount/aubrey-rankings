"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Sparkles,
  Award,
  Globe,
  Sliders,
  Film,
  Tv,
  ListPlus,
  Star,
  Pin,
  Calendar,
  Share2,
  Heart,
  MessageSquare,
  Check,
  UserPlus,
  ArrowRight,
} from "lucide-react";

export default function PrototypeProfilePage() {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(842);
  const [activeTab, setActiveTab] = useState<"rankings" | "favorites" | "journal">("rankings");

  const handleFollowToggle = () => {
    setIsFollowing((prev) => !prev);
    setFollowerCount((c) => (isFollowing ? c - 1 : c + 1));
  };

  const topAuteurs = [
    { name: "Charlie Brooker", works: "Black Mirror (33 Ep)", avg: "8.7", image: "https://image.tmdb.org/t/p/original/9w27Lgeq8KVxhz4ysygT6ranxf1.jpg" },
    { name: "David Fincher", works: "11 Films Ranked", avg: "9.2", image: "https://image.tmdb.org/t/p/original/bptfVGEQuv6vDTIMVCHjJ9Dz8PX.jpg" },
    { name: "Denis Villeneuve", works: "Dune & Sci-Fi (6 Films)", avg: "9.4", image: "https://image.tmdb.org/t/p/original/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg" },
    { name: "Bong Joon-ho", works: "Memories to Parasite (7 Films)", avg: "9.3", image: "https://image.tmdb.org/t/p/original/5mzr6AnAnUkfdo2Ut5Yr8CcBEas.jpg" },
  ];

  const publishedRankings = [
    {
      id: "bm",
      title: "Aubrey's Awesome and Correct Black Mirror Ratings",
      type: "TV Anthology",
      episodes: 33,
      avg: "8.7",
      isPinned: true,
      image: "https://image.tmdb.org/t/p/original/9w27Lgeq8KVxhz4ysygT6ranxf1.jpg",
      description: "The complete, mathematical ranking of every episode from The National Anthem to Demon 79. Graded on writing, acting, cinematography, sound, and unyielding vibes.",
      href: "/prototype/ranking",
    },
    {
      id: "fincher",
      title: "David Fincher: Controlled Paranoia & Methodical Horror",
      type: "Movie Franchise / Canon",
      episodes: 11,
      avg: "9.2",
      isPinned: true,
      image: "https://image.tmdb.org/t/p/original/bptfVGEQuv6vDTIMVCHjJ9Dz8PX.jpg",
      description: "From Se7en and Fight Club to Zodiac and The Social Network. Every shot examined for precision editing and sound design.",
      href: "/prototype/ranking",
    },
    {
      id: "scifi",
      title: "Modern Dystopian Sci-Fi: The Master Index",
      type: "Custom Collection",
      episodes: 24,
      avg: "9.0",
      isPinned: false,
      image: "https://image.tmdb.org/t/p/original/4PWu1S4RME6RnGSJUJuuSz19R2G.jpg",
      description: "Blending single episodes of Severance, Black Mirror, and feature monoliths like Children of Men, Blade Runner 2049, and Ex Machina.",
      href: "/prototype/ranking",
    },
  ];

  return (
    <div className="space-y-14 pb-28">
      {/* =========================================================================
          PROFILE HEADER / DOSSIER MASTHEAD
          Curated film journal aesthetic (Not generic social dashboard cards!)
          ========================================================================= */}
      <section className="relative overflow-hidden bg-[#10100E] border-b border-[#2A2926]">
        {/* Subtle Backdrop Glow */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://image.tmdb.org/t/p/original/dg3OindVAGZBjlT3xYKqIAdukPL.jpg"
            alt="Backdrop Atmosphere"
            className="w-full h-full object-cover opacity-15 filter blur-md"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#10100E] via-[#10100E]/90 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-12 space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-6 border-b border-[#242321]">
            <div className="flex items-start gap-5">
              {/* Profile Avatar / Initial */}
              <div className="h-24 w-24 rounded-2xl bg-[#D93829] text-white flex items-center justify-center font-display text-5xl shadow-2xl border-2 border-[#383632] shrink-0">
                A
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-4xl sm:text-5xl text-[#F2EFE9] tracking-tight uppercase leading-none">
                    AUBREY
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#1B1B19] border border-[#383632] text-xs font-mono text-[#D89B38]">
                    Founding Critic
                  </span>
                </div>
                <span className="font-mono text-sm text-[#D93829] block">@aubrey</span>
                <p className="font-editorial italic text-base text-[#9C9993] max-w-xl leading-relaxed pt-1">
                  &ldquo;Evaluating media by narrative rigor, visual texture, and mathematical sensory weights.
                  Creator of Aubrey Rankings.&rdquo;
                </p>
              </div>
            </div>

            {/* Follow & Action Buttons */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={handleFollowToggle}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-semibold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 ${
                  isFollowing
                    ? "bg-[#242321] text-[#F2EFE9] border border-[#383632]"
                    : "bg-[#D93829] hover:bg-[#C83225] text-white shadow-lg shadow-[#D93829]/20"
                }`}
              >
                {isFollowing ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#D89B38]" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Follow Critic</span>
                  </>
                )}
              </button>

              <button className="p-2.5 rounded-xl bg-[#1B1B19] text-[#9C9993] hover:text-[#F2EFE9] border border-[#2A2926] transition-colors">
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Taste & Curation Stats Bar (Editorial Style) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-[#141412] border border-[#242321]">
              <span className="text-[#6B6862] text-[10px] uppercase tracking-wider block">
                Ranked Curations
              </span>
              <span className="font-display text-2xl text-[#F2EFE9] mt-0.5 block">3 Published</span>
            </div>
            <div className="p-4 rounded-xl bg-[#141412] border border-[#242321]">
              <span className="text-[#6B6862] text-[10px] uppercase tracking-wider block">
                Rated Media Items
              </span>
              <span className="font-display text-2xl text-[#D89B38] mt-0.5 block">142 Entries</span>
            </div>
            <div className="p-4 rounded-xl bg-[#141412] border border-[#242321]">
              <span className="text-[#6B6862] text-[10px] uppercase tracking-wider block">
                Subscribers / Followers
              </span>
              <span className="font-display text-2xl text-[#F2EFE9] mt-0.5 block">{followerCount}</span>
            </div>
            <div className="p-4 rounded-xl bg-[#141412] border border-[#242321]">
              <span className="text-[#6B6862] text-[10px] uppercase tracking-wider block">
                Scale Philosophy
              </span>
              <span className="font-display text-2xl text-[#D93829] mt-0.5 block">5-Part Weighted</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: AUTEUR OBSESSIONS (TASTE SHOWCASE)
          The user's media taste is the centerpiece
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#262523]">
          <div>
            <span className="font-editorial italic text-xs text-[#D93829]">
              Curatorial Cornerstones
            </span>
            <h2 className="font-display text-2xl sm:text-3xl tracking-wide text-[#F2EFE9] uppercase mt-0.5">
              AUTEUR OBSESSIONS
            </h2>
          </div>
          <span className="text-xs font-mono text-[#6B6862]">
            Highest Weighted Auteurs
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {topAuteurs.map((auteur) => (
            <div
              key={auteur.name}
              className="rounded-2xl overflow-hidden bg-[#161614] border border-[#2A2926] hover:border-[#383632] transition-colors group flex flex-col justify-between"
            >
              <div className="aspect-[16/10] relative overflow-hidden bg-black">
                <img
                  src={auteur.image}
                  alt={auteur.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#161614] via-transparent to-transparent" />
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-[#D89B38]/40 text-[#D89B38] font-mono font-bold text-xs">
                  ★ {auteur.avg}
                </div>
              </div>

              <div className="p-4 space-y-1">
                <h3 className="font-bold text-[#F2EFE9] text-base group-hover:text-[#D93829] transition-colors">
                  {auteur.name}
                </h3>
                <span className="text-xs font-mono text-[#9C9993] block">
                  {auteur.works}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: PUBLISHED COLLECTIONS & RANKING DOSSIERS
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-3 border-b border-[#262523]">
          <div>
            <span className="font-editorial italic text-xs text-[#D93829]">
              Published Dossiers
            </span>
            <h2 className="font-display text-2xl sm:text-3xl tracking-wide text-[#F2EFE9] uppercase mt-0.5">
              AUBREY&apos;S CURATED RANKINGS
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <button
              onClick={() => setActiveTab("rankings")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === "rankings"
                  ? "bg-[#282826] text-[#F2EFE9] font-bold"
                  : "text-[#9C9993] hover:text-[#F2EFE9]"
              }`}
            >
              Rankings (3)
            </button>
            <button
              onClick={() => setActiveTab("journal")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === "journal"
                  ? "bg-[#282826] text-[#F2EFE9] font-bold"
                  : "text-[#9C9993] hover:text-[#F2EFE9]"
              }`}
            >
              Critical Journal
            </button>
          </div>
        </div>

        {/* Published Dossiers List */}
        <div className="space-y-6">
          {publishedRankings.map((ranking) => (
            <div
              key={ranking.id}
              className="rounded-2xl bg-[#181816] border border-[#2A2926] hover:border-[#383632] p-6 sm:p-8 space-y-5 transition-colors group"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Visual Thumbnail with Kodi-style ClearLOGO for Black Mirror */}
                <div className="md:col-span-4 aspect-[16/10] rounded-xl overflow-hidden bg-black relative border border-[#2A2926]">
                  <img
                    src={ranking.image}
                    alt={ranking.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                  />
                  {ranking.id === "bm" && (
                    <div className="absolute inset-0 flex items-center justify-center p-6 bg-gradient-to-t from-black/80 via-transparent to-black/30">
                      <img
                        src="https://image.tmdb.org/t/p/original/bQGVstVOI79nDmswbo3umB0lmrp.png"
                        alt="Black Mirror ClearLOGO"
                        className="w-3/4 max-h-12 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.9)]"
                      />
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[10px] font-mono text-[#D89B38] border border-[#D89B38]/30">
                    ★ {ranking.avg} Avg
                  </div>
                  {ranking.isPinned && (
                    <div className="absolute top-2.5 right-2.5 h-6 w-6 rounded-full bg-[#D93829]/90 text-white flex items-center justify-center">
                      <Pin className="h-3 w-3" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="md:col-span-8 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#6B6862]">
                    <span className="text-[#D93829] font-semibold">{ranking.type}</span>
                    <span>&bull;</span>
                    <span>{ranking.episodes} Items Ranked</span>
                    {ranking.isPinned && (
                      <>
                        <span>&bull;</span>
                        <span className="text-[#D89B38]">Pinned by Aubrey</span>
                      </>
                    )}
                  </div>

                  <h3 className="font-display text-2xl sm:text-3xl text-[#F2EFE9] tracking-tight uppercase group-hover:text-[#D93829] transition-colors">
                    <Link href={ranking.href}>{ranking.title}</Link>
                  </h3>

                  <p className="font-editorial italic text-sm text-[#9C9993] leading-relaxed">
                    {ranking.description}
                  </p>

                  <div className="pt-2 flex items-center justify-between border-t border-[#242321]">
                    <span className="text-xs font-mono text-[#6B6862]">
                      Weighted formula: Writing 8x, Acting 8x, Cinema 7x, Music 3x, Vibes 8x
                    </span>
                    <Link
                      href={ranking.href}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D93829] hover:underline"
                    >
                      <span>Explore Dossier</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
