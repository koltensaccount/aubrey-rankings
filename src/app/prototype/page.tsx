"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  TrendingUp,
  Star,
  CheckCircle2,
  Tv,
  Film,
  Flame,
  Search,
  Filter,
} from "lucide-react";

export default function PrototypeHomePage() {
  const [feedFilter, setFeedFilter] = useState<"all" | "rankings" | "reviews">("all");
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({
    post_1: 42,
    post_2: 19,
    post_3: 31,
  });

  const toggleLike = (postId: string) => {
    setLikedPosts((prev) => {
      const isLiked = !prev[postId];
      setLikeCounts((counts) => ({
        ...counts,
        [postId]: counts[postId] + (isLiked ? 1 : -1),
      }));
      return { ...prev, [postId]: isLiked };
    });
  };

  const curatedLists = [
    {
      id: "bm",
      title: "Every Black Mirror Episode",
      author: "Aubrey",
      count: "33 Episodes",
      avg: "8.7",
      image: "https://image.tmdb.org/t/p/original/9w27Lgeq8KVxhz4ysygT6ranxf1.jpg",
      tag: "Editorial Feature",
      href: "/prototype/ranking",
    },
    {
      id: "nolan",
      title: "Christopher Nolan: 70mm Sagas",
      author: "Julian Vance",
      count: "12 Films",
      avg: "9.1",
      image: "https://image.tmdb.org/t/p/original/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
      tag: "Auteur Study",
      href: "/prototype/ranking",
    },
    {
      id: "a24",
      title: "A24: Modern American Dread",
      author: "Elena Rostova",
      count: "18 Films",
      avg: "8.9",
      image: "https://image.tmdb.org/t/p/original/5mzr6AnAnUkfdo2Ut5Yr8CcBEas.jpg",
      tag: "Genre Index",
      href: "/prototype/ranking",
    },
    {
      id: "fincher",
      title: "David Fincher: Calculated Paranoia",
      author: "Marcus Chen",
      count: "11 Films",
      avg: "9.2",
      image: "https://image.tmdb.org/t/p/original/bptfVGEQuv6vDTIMVCHjJ9Dz8PX.jpg",
      tag: "Mastery",
      href: "/prototype/ranking",
    },
  ];

  return (
    <div className="space-y-16 pb-24">
      {/* =========================================================================
          HERO EDITORIAL COMPOSITION
          Influenced by Poster References: Taxi Driver (Red), Parasite, Marty Supreme
          - Monumental display type
          - Photographic collage & dramatic framing
          - Pull-quote & category weight preview
          ========================================================================= */}
      <section className="relative pt-6 sm:pt-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden bg-[#161614] border border-[#2A2926] p-6 sm:p-10 lg:p-14">
          {/* Ambient Film Glow */}
          <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-[#D93829]/10 via-[#D93829]/5 to-transparent blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
            {/* Left: Monumental Typography & Editorial Narrative */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-[#20201D] border border-[#343331] text-[11px] font-semibold text-[#F2EFE9] uppercase tracking-widest">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D93829] animate-pulse" />
                  Featured Editorial Critique
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#181816] border border-[#2E2D2A] text-[10px] font-mono text-[#D89B38]">
                  <Sparkles className="h-3 w-3" />
                  <span>Kodi / Fanart Media Assets Active</span>
                </span>
              </div>

              {/* Authentic Kodi-style ClearLOGO */}
              <div className="pt-1">
                <img
                  src="https://image.tmdb.org/t/p/original/bQGVstVOI79nDmswbo3umB0lmrp.png"
                  alt="Black Mirror Transparent ClearLOGO"
                  className="h-12 sm:h-16 w-auto object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.85)] filter brightness-110"
                />
              </div>

              {/* Monumental Headline */}
              <div className="space-y-1">
                <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl tracking-tight text-[#F2EFE9] leading-[0.9] uppercase">
                  EVERY EPISODE,
                  <br />
                  <span className="text-[#D93829] font-editorial italic normal-case text-4xl sm:text-6xl lg:text-7xl block pt-2 sm:pt-3">
                    ranked and calibrated.
                  </span>
                </h1>
              </div>

              {/* Aubrey's Editorial Pull-Quote */}
              <p className="font-editorial text-lg sm:text-xl text-[#9C9993] leading-relaxed max-w-xl italic">
                &ldquo;Charlie Brooker&apos;s dystopian anthologies dissected and calibrated
                by sensory weight: Writing (8x), Acting (8x), Cinematography (7x),
                Music (3x), and unvarnished Vibes (8x).&rdquo;
              </p>

              {/* Top Ranked Quick Preview Strip */}
              <div className="pt-2 border-t border-[#262523] flex flex-wrap gap-4 text-xs font-mono text-[#9C9993]">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#D89B38]">#01</span>
                  <span className="text-[#F2EFE9]">San Junipero</span>
                  <span className="opacity-60">(9.6)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#D89B38]">#02</span>
                  <span className="text-[#F2EFE9]">White Christmas</span>
                  <span className="opacity-60">(9.5)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#D89B38]">#03</span>
                  <span className="text-[#F2EFE9]">USS Callister</span>
                  <span className="opacity-60">(9.4)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <Link
                  href="/prototype/ranking"
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#D93829] hover:bg-[#C83225] text-white font-semibold text-sm shadow-xl shadow-[#D93829]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Explore Complete Ranking</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href="/prototype/profile"
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#20201D] hover:bg-[#282824] text-[#F2EFE9] border border-[#343331] font-semibold text-sm transition-colors"
                >
                  <span>View @aubrey&apos;s Profile</span>
                </Link>
              </div>
            </div>

            {/* Right: Photographic Collage Composition */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-sm lg:max-w-none">
                {/* Main Hero Panel */}
                <div className="relative aspect-[16/11] rounded-2xl overflow-hidden border border-[#383632] shadow-2xl bg-black">
                  <img
                    src="https://image.tmdb.org/t/p/original/9w27Lgeq8KVxhz4ysygT6ranxf1.jpg"
                    alt="San Junipero Still"
                    className="w-full h-full object-cover object-center filter saturate-[1.1]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                    <div>
                      <span className="font-display text-sm tracking-widest text-[#D93829] uppercase">
                        #01 All-Time
                      </span>
                      <h3 className="font-bold text-white text-base leading-tight">
                        San Junipero (S3, Ep 4)
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-black/80 border border-[#D89B38]/40 text-[#D89B38] font-bold text-sm">
                      ★ 9.6
                    </span>
                  </div>
                </div>

                {/* Overlapping Secondary Panel (Marty Supreme / Taxi Driver Style) */}
                <div className="hidden sm:block absolute -bottom-6 -left-6 w-48 aspect-video rounded-xl overflow-hidden border-2 border-[#161614] shadow-2xl bg-black">
                  <img
                    src="https://image.tmdb.org/t/p/original/c62HKSbeTRkatK223O3m58CmmPd.jpg"
                    alt="Fifteen Million Merits Still"
                    className="w-full h-full object-cover filter contrast-[1.05]"
                  />
                  <div className="absolute inset-0 bg-black/30" />
                  <span className="absolute bottom-1.5 left-2 text-[10px] font-mono text-white/90">
                    #05 Merits (9.1)
                  </span>
                </div>

                {/* Graphic Stamp / Festival Badge */}
                <div className="absolute -top-3 -right-3 h-14 w-14 rounded-full bg-[#1B1B19] border border-[#383632] flex flex-col items-center justify-center text-center p-1 shadow-xl">
                  <span className="font-display text-xs text-[#D89B38] leading-none">33</span>
                  <span className="text-[8px] uppercase tracking-wider text-[#9C9993] leading-none mt-0.5">
                    Ep Rated
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          EDITORIAL TYPOGRAPHY MARQUEE
          ========================================================================= */}
      <div className="border-y border-[#262523] py-3.5 bg-[#141412] overflow-hidden whitespace-nowrap">
        <div className="flex items-center gap-8 text-xs font-display tracking-widest text-[#6B6862] uppercase animate-pulse">
          <span>AUBREY RANKINGS</span>
          <span>&bull;</span>
          <span className="text-[#9C9993]">WEIGHTED CRITIQUE ENGINE</span>
          <span>&bull;</span>
          <span>WRITING (8X)</span>
          <span>&bull;</span>
          <span>ACTING (8X)</span>
          <span>&bull;</span>
          <span>CINEMATOGRAPHY (7X)</span>
          <span>&bull;</span>
          <span>VIBES (8X)</span>
          <span>&bull;</span>
          <span className="text-[#D93829]">NO GENERIC 5-STAR AVERAGES</span>
          <span>&bull;</span>
          <span>A24 &bull; WARNER &bull; CRITERION &bull; MUBI</span>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: CURATED COLLECTIONS & AUTEUR DOSSIERS
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-3 border-b border-[#262523]">
          <div>
            <span className="font-editorial italic text-sm text-[#D93829]">
              Curated Index
            </span>
            <h2 className="font-display text-3xl sm:text-4xl tracking-wide text-[#F2EFE9] uppercase mt-0.5">
              ESSENTIAL FILM & TV COLLECTIONS
            </h2>
          </div>
          <Link
            href="/prototype/ranking"
            className="text-xs uppercase tracking-wider font-semibold text-[#9C9993] hover:text-[#D93829] transition-colors flex items-center gap-1"
          >
            <span>View All Curations</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* 4-Card Film Panel Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {curatedLists.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group block rounded-2xl overflow-hidden bg-[#1B1B19] border border-[#2A2926] hover:border-[#383632] hover:shadow-2xl transition-all duration-300"
            >
              {/* Artwork Container */}
              <div className="aspect-[16/10] relative overflow-hidden bg-black">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 filter contrast-[1.05]"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1B1B19] via-transparent to-black/30" />

                {/* Score Pill */}
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-[#D89B38]/40 text-[#D89B38] font-bold text-xs">
                  ★ {item.avg}
                </div>

                {/* Category Tag */}
                <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono uppercase tracking-wider text-[#9C9993] border border-[#343331]">
                  {item.tag}
                </div>
              </div>

              {/* Title & Metadata */}
              <div className="p-4 space-y-2">
                <h3 className="font-bold text-[#F2EFE9] text-base group-hover:text-[#D93829] transition-colors line-clamp-1">
                  {item.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-[#9C9993] font-mono">
                  <span>Curated by {item.author}</span>
                  <span>{item.count}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: SOCIAL DISPATCH & COMMUNITY FEED
          Magazine style community updates with rich quotes & category breakdowns
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-3 border-b border-[#262523]">
          <div>
            <span className="font-editorial italic text-sm text-[#D93829]">
              Social Dispatch
            </span>
            <h2 className="font-display text-3xl sm:text-4xl tracking-wide text-[#F2EFE9] uppercase mt-0.5">
              CRITIC ACTIVITY & COMMUNITY DIALOGUE
            </h2>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-[#1B1B19] p-1 rounded-xl border border-[#2A2926]">
            {(["all", "rankings", "reviews"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setFeedFilter(filter)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                  feedFilter === filter
                    ? "bg-[#2A2926] text-[#F2EFE9]"
                    : "text-[#9C9993] hover:text-[#F2EFE9]"
                }`}
              >
                {filter === "all" ? "All Activity" : filter}
              </button>
            ))}
          </div>
        </div>

        {/* Feed Items Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Feed Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Feed Item 1: Aubrey's Black Mirror Ranking Post */}
            {(feedFilter === "all" || feedFilter === "rankings") && (
              <article className="p-6 sm:p-7 rounded-2xl bg-[#181816] border border-[#2A2926] space-y-5 hover:border-[#383632] transition-colors">
                {/* Header info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Link
                      href="/prototype/profile"
                      className="h-10 w-10 rounded-full bg-[#D93829] text-white flex items-center justify-center font-display text-lg"
                    >
                      A
                    </Link>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href="/prototype/profile"
                          className="font-bold text-[#F2EFE9] text-sm hover:underline"
                        >
                          Aubrey
                        </Link>
                        <span className="text-xs text-[#9C9993]">published a ranking</span>
                      </div>
                      <span className="text-[11px] font-mono text-[#6B6862]">
                        2 hours ago &bull; Verified Spreadsheet Importer
                      </span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-[#242321] text-[11px] font-mono text-[#D89B38] border border-[#383632]">
                    33 Entries
                  </span>
                </div>

                {/* Content snippet & Still Collage */}
                <div className="space-y-3">
                  <h3 className="font-display text-2xl tracking-wide text-[#F2EFE9]">
                    <Link href="/prototype/ranking" className="hover:text-[#D93829] transition-colors">
                      BLACK MIRROR: THE DEFINITIVE S1–S6 RANKINGS
                    </Link>
                  </h3>
                  <p className="font-editorial text-base text-[#9C9993] leading-relaxed italic">
                    &ldquo;Finally finalized the full 33-episode hierarchy. San Junipero holds
                    firm at #1 with a near-perfect 9.6 weighted score, but White Christmas and
                    USS Callister are breathing down its neck.&rdquo;
                  </p>
                </div>

                {/* Visual Artwork Feature Banner */}
                <Link
                  href="/prototype/ranking"
                  className="block relative aspect-[21/9] rounded-xl overflow-hidden border border-[#2A2926] group bg-black"
                >
                  <img
                    src="https://image.tmdb.org/t/p/original/4PWu1S4RME6RnGSJUJuuSz19R2G.jpg"
                    alt="The Entire History of You"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs font-mono text-white">
                    <span>Rank #03 &bull; The Entire History of You</span>
                    <span className="text-[#D89B38] font-bold">Score: 9.3</span>
                  </div>
                </Link>

                {/* Weighted Category Breakdown Preview */}
                <div className="p-3.5 rounded-xl bg-[#131312] border border-[#242321] grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs font-mono">
                  <div>
                    <span className="text-[#6B6862] text-[10px] block">WRITING (8x)</span>
                    <span className="text-[#F2EFE9] font-bold">9.2</span>
                  </div>
                  <div>
                    <span className="text-[#6B6862] text-[10px] block">ACTING (8x)</span>
                    <span className="text-[#F2EFE9] font-bold">9.0</span>
                  </div>
                  <div>
                    <span className="text-[#6B6862] text-[10px] block">CINEMA (7x)</span>
                    <span className="text-[#F2EFE9] font-bold">8.8</span>
                  </div>
                  <div>
                    <span className="text-[#6B6862] text-[10px] block">MUSIC (3x)</span>
                    <span className="text-[#F2EFE9] font-bold">8.5</span>
                  </div>
                  <div>
                    <span className="text-[#6B6862] text-[10px] block">VIBES (8x)</span>
                    <span className="text-[#D93829] font-bold">9.5</span>
                  </div>
                </div>

                {/* Footer Interactions */}
                <div className="pt-2 flex items-center justify-between border-t border-[#262523] text-xs text-[#9C9993]">
                  <div className="flex items-center gap-5">
                    <button
                      onClick={() => toggleLike("post_1")}
                      className={`flex items-center gap-1.5 transition-colors ${
                        likedPosts["post_1"] ? "text-[#D93829]" : "hover:text-[#F2EFE9]"
                      }`}
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          likedPosts["post_1"] ? "fill-[#D93829]" : ""
                        }`}
                      />
                      <span>{likeCounts["post_1"]}</span>
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-[#F2EFE9] transition-colors">
                      <MessageSquare className="h-4 w-4" />
                      <span>14 thoughts</span>
                    </button>
                  </div>
                  <Link
                    href="/prototype/ranking"
                    className="text-xs font-semibold text-[#D93829] hover:underline"
                  >
                    Open Ranking &rarr;
                  </Link>
                </div>
              </article>
            )}

            {/* Feed Item 2: Julian Vance Review of Interstellar */}
            {(feedFilter === "all" || feedFilter === "reviews") && (
              <article className="p-6 sm:p-7 rounded-2xl bg-[#181816] border border-[#2A2926] space-y-4 hover:border-[#383632] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#2A2926] text-[#F2EFE9] flex items-center justify-center font-display text-lg">
                      J
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#F2EFE9] text-sm">Julian Vance</span>
                        <span className="text-xs text-[#9C9993]">reviewed a film</span>
                      </div>
                      <span className="text-[11px] font-mono text-[#6B6862]">
                        5 hours ago &bull; Christopher Nolan Collection
                      </span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-md bg-black border border-[#D89B38]/50 text-[#D89B38] font-bold text-sm">
                    ★ 9.5
                  </span>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-[#F2EFE9] text-lg">
                    Interstellar (2014) &bull; 70mm IMAX Presentation
                  </h4>
                  <p className="font-editorial text-sm sm:text-base text-[#9C9993] leading-relaxed italic">
                    &ldquo;Hans Zimmer&apos;s pipe organ score is essentially the fifth dimensional
                    tesseract in auditory form. The docking sequence alone justifies Christopher
                    Nolan&apos;s career.&rdquo;
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-[#262523] text-xs text-[#9C9993]">
                  <div className="flex items-center gap-5">
                    <button
                      onClick={() => toggleLike("post_2")}
                      className={`flex items-center gap-1.5 transition-colors ${
                        likedPosts["post_2"] ? "text-[#D93829]" : "hover:text-[#F2EFE9]"
                      }`}
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          likedPosts["post_2"] ? "fill-[#D93829]" : ""
                        }`}
                      />
                      <span>{likeCounts["post_2"]}</span>
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-[#F2EFE9] transition-colors">
                      <MessageSquare className="h-4 w-4" />
                      <span>8 thoughts</span>
                    </button>
                  </div>
                  <span className="text-[11px] text-[#6B6862]">IMAX 70mm Enthusiast</span>
                </div>
              </article>
            )}
          </div>

          {/* Right Sidebar: Critic Philosophy & Trending Rankings */}
          <div className="lg:col-span-4 space-y-6">
            {/* The Aubrey Philosophy Panel */}
            <div className="p-6 rounded-2xl bg-[#161614] border border-[#2A2926] space-y-4">
              <span className="font-editorial italic text-xs text-[#D93829]">
                The Aubrey Standard
              </span>
              <h4 className="font-display text-xl tracking-wide text-[#F2EFE9] uppercase">
                WHY WEIGHTED SCORING?
              </h4>
              <p className="text-xs text-[#9C9993] leading-relaxed">
                Most platforms boil cinema down to a lazy 5-star metric. Aubrey Rankings
                isolates <strong className="text-[#F2EFE9]">Writing</strong>,{" "}
                <strong className="text-[#F2EFE9]">Acting</strong>,{" "}
                <strong className="text-[#F2EFE9]">Cinematography</strong>,{" "}
                <strong className="text-[#F2EFE9]">Sound</strong>, and the all-important{" "}
                <strong className="text-[#F2EFE9]">Vibes</strong> to produce true, mathematically
                defensible rankings.
              </p>
              <div className="pt-2">
                <Link
                  href="/prototype/ranking"
                  className="text-xs font-semibold text-[#D93829] hover:underline flex items-center gap-1"
                >
                  <span>Inspect Aubrey&apos;s formula &rarr;</span>
                </Link>
              </div>
            </div>

            {/* Trending Curators Mini-Index */}
            <div className="p-6 rounded-2xl bg-[#181816] border border-[#2A2926] space-y-4">
              <h4 className="font-display text-lg tracking-wide text-[#F2EFE9] uppercase">
                TRENDING CURATORS
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#242321]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-[#D93829] text-white flex items-center justify-center font-display text-sm">
                      A
                    </div>
                    <div>
                      <span className="font-bold text-xs text-[#F2EFE9] block">@aubrey</span>
                      <span className="text-[10px] text-[#6B6862]">33 Black Mirror Episodes</span>
                    </div>
                  </div>
                  <Link
                    href="/prototype/profile"
                    className="text-xs px-2.5 py-1 rounded bg-[#20201D] text-[#F2EFE9] hover:bg-[#282824] border border-[#343331]"
                  >
                    View
                  </Link>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-[#242321]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-[#2A2926] text-[#F2EFE9] flex items-center justify-center font-display text-sm">
                      M
                    </div>
                    <div>
                      <span className="font-bold text-xs text-[#F2EFE9] block">@marcus_c</span>
                      <span className="text-[10px] text-[#6B6862]">David Fincher Dossier</span>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded bg-[#20201D] text-[#9C9993] border border-[#343331]">
                    Follow
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
