"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import {
  Sparkles,
  ArrowLeft,
  Sliders,
  Star,
  Layers,
  List,
  Grid,
  Check,
  ChevronDown,
  X,
  Share2,
  Lock,
  Globe,
  Award,
  Filter,
} from "lucide-react";

interface EpisodeEntry {
  id: string;
  rank: number;
  title: string;
  season: number;
  episode: number;
  year: string;
  overallScore: number;
  still: string;
  quote?: string;
  categories: {
    writing: number;
    acting: number;
    cinematography: number;
    music: number;
    vibes: number;
  };
}

const INITIAL_EPISODES: EpisodeEntry[] = [
  {
    id: "ep_1",
    rank: 1,
    title: "San Junipero",
    season: 3,
    episode: 4,
    year: "2016",
    overallScore: 9.6,
    still: "https://image.tmdb.org/t/p/original/9w27Lgeq8KVxhz4ysygT6ranxf1.jpg",
    quote: "A rare transcendent romance in an otherwise bleak anthology. Clint Mansell's synth score and Gugu Mbatha-Raw's acting elevate it to sublime art.",
    categories: { writing: 9.5, acting: 9.8, cinematography: 9.5, music: 10.0, vibes: 9.8 },
  },
  {
    id: "ep_2",
    rank: 2,
    title: "White Christmas",
    season: 2,
    episode: 4,
    year: "2014",
    overallScore: 9.5,
    still: "https://image.tmdb.org/t/p/original/bptfVGEQuv6vDTIMVCHjJ9Dz8PX.jpg",
    quote: "Three interwoven horrors culminating in the most terrifying punishment ever conceived on television. Jon Hamm at his absolute best.",
    categories: { writing: 10.0, acting: 9.5, cinematography: 9.0, music: 8.5, vibes: 9.5 },
  },
  {
    id: "ep_3",
    rank: 3,
    title: "USS Callister",
    season: 4,
    episode: 1,
    year: "2017",
    overallScore: 9.4,
    still: "https://image.tmdb.org/t/p/original/c62HKSbeTRkatK223O3m58CmmPd.jpg",
    quote: "Toby Haynes balances high-camp Star Trek technicolor pastiche with genuinely chilling psychological workplace abuse.",
    categories: { writing: 9.2, acting: 9.5, cinematography: 9.6, music: 9.0, vibes: 9.4 },
  },
  {
    id: "ep_4",
    rank: 4,
    title: "The Entire History of You",
    season: 1,
    episode: 3,
    year: "2011",
    overallScore: 9.3,
    still: "https://image.tmdb.org/t/p/original/4PWu1S4RME6RnGSJUJuuSz19R2G.jpg",
    quote: "The definitive early episode. Relentless, intimate paranoia where memory itself becomes a self-inflicted interrogation device.",
    categories: { writing: 9.5, acting: 9.2, cinematography: 8.8, music: 8.5, vibes: 9.4 },
  },
  {
    id: "ep_5",
    rank: 5,
    title: "Fifteen Million Merits",
    season: 1,
    episode: 2,
    year: "2011",
    overallScore: 9.1,
    still: "https://image.tmdb.org/t/p/original/dg3OindVAGZBjlT3xYKqIAdukPL.jpg",
    quote: "Daniel Kaluuya's monologue against the monolithic judges remains the series' rawest emotional eruption.",
    categories: { writing: 9.0, acting: 9.5, cinematography: 9.2, music: 8.5, vibes: 9.0 },
  },
  {
    id: "ep_6",
    rank: 6,
    title: "Nosedive",
    season: 3,
    episode: 1,
    year: "2016",
    overallScore: 9.0,
    still: "https://image.tmdb.org/t/p/original/ztdy1f1cAjwsO0GpVKzNuqZ0PMv.jpg",
    quote: "Joe Wright's pastel aesthetic renders social-media validation anxiety into a darkly hilarious pastel panic.",
    categories: { writing: 8.8, acting: 9.2, cinematography: 9.6, music: 8.6, vibes: 9.0 },
  },
  {
    id: "ep_7",
    rank: 7,
    title: "Be Right Back",
    season: 2,
    episode: 1,
    year: "2013",
    overallScore: 8.9,
    still: "https://image.tmdb.org/t/p/original/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    quote: "Hayley Atwell and Domhnall Gleeson deliver an emotionally devastating study on grief and AI replicas.",
    categories: { writing: 9.0, acting: 9.2, cinematography: 8.5, music: 8.5, vibes: 8.8 },
  },
  {
    id: "ep_8",
    rank: 8,
    title: "Black Museum",
    season: 4,
    episode: 6,
    year: "2017",
    overallScore: 8.8,
    still: "https://image.tmdb.org/t/p/original/5mzr6AnAnUkfdo2Ut5Yr8CcBEas.jpg",
    quote: "Grim carnival of high-tech atrocities that doubles as an encyclopedia of easter eggs.",
    categories: { writing: 8.8, acting: 9.0, cinematography: 8.5, music: 8.0, vibes: 8.9 },
  },
];

export default function PrototypeRankingPage() {
  const [episodes, setEpisodes] = useState<EpisodeEntry[]>(INITIAL_EPISODES);
  const [viewMode, setViewMode] = useState<"editorial" | "compact">("editorial");
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"rank" | "season" | "title">("rank");

  // Interactive Rating Modal State
  const [editingEpisode, setEditingEpisode] = useState<EpisodeEntry | null>(null);
  const [sliderWriting, setSliderWriting] = useState(9.0);
  const [sliderActing, setSliderActing] = useState(9.0);
  const [sliderCinema, setSliderCinema] = useState(8.5);
  const [sliderMusic, setSliderMusic] = useState(8.5);
  const [sliderVibes, setSliderVibes] = useState(9.0);

  const openRatingModal = (ep: EpisodeEntry) => {
    setEditingEpisode(ep);
    setSliderWriting(ep.categories.writing);
    setSliderActing(ep.categories.acting);
    setSliderCinema(ep.categories.cinematography);
    setSliderMusic(ep.categories.music);
    setSliderVibes(ep.categories.vibes);
  };

  const calculatedLiveScore = useMemo(() => {
    // Formula: Writing(8) + Acting(8) + Cinema(7) + Music(3) + Vibes(8) = total 34
    const weighted =
      sliderWriting * 8 +
      sliderActing * 8 +
      sliderCinema * 7 +
      sliderMusic * 3 +
      sliderVibes * 8;
    return Math.round((weighted / 34) * 10) / 10;
  }, [sliderWriting, sliderActing, sliderCinema, sliderMusic, sliderVibes]);

  const saveLiveRating = () => {
    if (!editingEpisode) return;
    setEpisodes((prev) =>
      prev.map((ep) =>
        ep.id === editingEpisode.id
          ? {
              ...ep,
              overallScore: calculatedLiveScore,
              categories: {
                writing: sliderWriting,
                acting: sliderActing,
                cinematography: sliderCinema,
                music: sliderMusic,
                vibes: sliderVibes,
              },
            }
          : ep
      )
    );
    setEditingEpisode(null);
  };

  const filteredEpisodes = useMemo(() => {
    let list = [...episodes];
    if (seasonFilter !== "all") {
      list = list.filter((ep) => ep.season === Number(seasonFilter));
    }
    if (sortBy === "rank") {
      list.sort((a, b) => b.overallScore - a.overallScore);
    } else if (sortBy === "season") {
      list.sort((a, b) => (a.season !== b.season ? a.season - b.season : a.episode - b.episode));
    } else if (sortBy === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [episodes, seasonFilter, sortBy]);

  return (
    <div className="space-y-12 pb-28">
      {/* =========================================================================
          ATMOSPHERIC EDITORIAL COLLECTION HEADER
          - Influenced by Taxi Driver Red & Parasite
          - Premium Kodi / Jellyfin / Plex aesthetic: ClearLOGO + 4K Fanart Backdrop
          - Editorial film-magazine typography & weighted rubric
          ========================================================================= */}
      <section className="relative overflow-hidden bg-[#10100E] border-b border-[#2A2926]">
        {/* Cinematic 4K Backdrop Overlay with Soft Vignette */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://image.tmdb.org/t/p/original/38aCLy0BdFbOAIEfuDladoITHN0.jpg"
            alt="Black Mirror 4K Fanart Backdrop"
            className="w-full h-full object-cover object-top opacity-30 filter contrast-125 saturate-110 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#10100E] via-[#10100E]/75 to-[#10100E]/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#10100E] via-[#10100E]/40 to-[#10100E]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 sm:pt-14 sm:pb-16 space-y-6">
          {/* Breadcrumb Navigation & Cinematic Asset Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-[#9C9993]">
            <div className="flex items-center gap-2">
              <Link href="/prototype" className="hover:text-[#F2EFE9] transition-colors flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Dispatch</span>
              </Link>
              <span>/</span>
              <span className="text-[#D93829]">TV Anthology</span>
              <span>/</span>
              <span className="text-[#F2EFE9]">Black Mirror</span>
            </div>

            {/* Kodi / Plex / Jellyfin Theme Badges */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#181816]/90 border border-[#302F2C] text-[10px] text-[#D89B38]">
                <Sparkles className="h-3 w-3" />
                <span>ClearLOGO &bull; 4K Fanart &bull; Title Cards</span>
              </span>
            </div>
          </div>

          {/* Collection Title & Editorial Meta */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1F1E1B] border border-[#343331] text-[11px] font-mono text-[#D89B38]">
                <Award className="h-3 w-3" />
                <span>Aubrey&apos;s Correct &amp; Definitive Ratings</span>
              </div>

              {/* Authentic Kodi-Style ClearLOGO (Transparent PNG Title Logo) */}
              <div className="pt-1 pb-2">
                <img
                  src="https://image.tmdb.org/t/p/original/bQGVstVOI79nDmswbo3umB0lmrp.png"
                  alt="Black Mirror Transparent Title Logo (ClearLOGO)"
                  className="h-14 sm:h-20 md:h-24 w-auto object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.9)] filter brightness-110"
                />
              </div>

              <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl tracking-tight text-[#F2EFE9] leading-[0.95] uppercase">
                AUBREY&apos;S AWESOME AND CORRECT
                <br />
                <span className="text-[#D93829] font-editorial italic normal-case block pt-1 text-2xl sm:text-4xl lg:text-5xl">
                  The Unassailable Episode Hierarchy
                </span>
              </h1>

              <p className="font-editorial text-base sm:text-lg text-[#9C9993] max-w-2xl leading-relaxed italic">
                A mathematical and aesthetic breakdown of every single episode from Season 1
                through Season 6. Graded on Aubrey&apos;s custom weighted rubric to establish
                the true, unassailable hierarchy.
              </p>

              {/* Creator & Privacy Tag */}
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[#9C9993]">
                <Link
                  href="/prototype/profile"
                  className="flex items-center gap-2 text-[#F2EFE9] hover:underline"
                >
                  <div className="h-6 w-6 rounded-full bg-[#D93829] text-white flex items-center justify-center font-display text-xs">
                    A
                  </div>
                  <span className="font-semibold">Curated by Aubrey (@aubrey)</span>
                </Link>
                <span>&bull;</span>
                <span className="flex items-center gap-1 text-[#6B6862]">
                  <Globe className="h-3 w-3" />
                  <span>Public Ranking</span>
                </span>
                <span>&bull;</span>
                <span className="font-mono text-[#D89B38]">33 Episodes Ranked</span>
              </div>
            </div>

            {/* Right: Weighted Rubric & Artwork Showcase Card */}
            <div className="lg:col-span-4 space-y-4">
              {/* Alternative Movie/Series Poster (Criterion / Fanart style) */}
              <div className="p-4 rounded-2xl bg-[#161614]/90 backdrop-blur-md border border-[#2A2926] flex items-center gap-4 group">
                <div className="relative w-16 h-24 rounded-lg overflow-hidden border border-[#3A3935] shadow-lg flex-shrink-0 bg-black">
                  <img
                    src="https://image.tmdb.org/t/p/original/seN6rRfN0I6n8iDXjlSMk1QjNcq.jpg"
                    alt="Black Mirror Alternative Criterion Poster"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/80 text-[8px] font-mono text-[#D89B38]">
                    ALT ART
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <span className="font-mono text-[10px] text-[#D89B38] uppercase tracking-wider block">
                    Alternative Key Art
                  </span>
                  <p className="font-semibold text-[#F2EFE9] text-xs">
                    Criterion-Grade Poster &amp; ClearLOGO
                  </p>
                  <p className="text-[#9C9993] text-[11px] leading-tight">
                    Kodi / Jellyfin fanart library asset integration
                  </p>
                </div>
              </div>

              {/* Rubric Breakdown */}
              <div className="p-5 rounded-2xl bg-[#161614]/90 backdrop-blur-md border border-[#2A2926] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-[#F2EFE9] font-bold">
                  Weighted Category Rubric
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#2A2926] text-[#D89B38]">
                  Scale 1–10
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center py-1 border-b border-[#242321]">
                  <span className="text-[#9C9993]">Writing & Narrative</span>
                  <span className="font-bold text-[#F2EFE9]">8x Weight</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#242321]">
                  <span className="text-[#9C9993]">Acting & Performance</span>
                  <span className="font-bold text-[#F2EFE9]">8x Weight</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#242321]">
                  <span className="text-[#9C9993]">Cinematography & Direction</span>
                  <span className="font-bold text-[#F2EFE9]">7x Weight</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#242321]">
                  <span className="text-[#9C9993]">Music & Sound Design</span>
                  <span className="font-bold text-[#F2EFE9]">3x Weight</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#D93829] font-semibold">Vibes & Atmosphere</span>
                  <span className="font-bold text-[#D93829]">8x Weight</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          CONTROLS TOOLBAR: VIEW SWITCHER & FILTERS
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-3 rounded-2xl bg-[#161614] border border-[#2A2926]">
          {/* Season Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {["all", "1", "2", "3", "4", "5", "6"].map((season) => (
              <button
                key={season}
                onClick={() => setSeasonFilter(season)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all whitespace-nowrap ${
                  seasonFilter === season
                    ? "bg-[#D93829] text-white font-bold"
                    : "text-[#9C9993] hover:text-[#F2EFE9] hover:bg-[#1E1E1C]"
                }`}
              >
                {season === "all" ? "All Seasons (33)" : `Season ${season}`}
              </button>
            ))}
          </div>

          {/* View Mode & Sort Toggle */}
          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#262523]">
            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#1E1E1C] text-xs font-mono text-[#F2EFE9] border border-[#343331] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#D93829]"
            >
              <option value="rank">Sort: Highest Score</option>
              <option value="season">Sort: Chronological (S/E)</option>
              <option value="title">Sort: Alphabetical</option>
            </select>

            {/* View Mode Buttons */}
            <div className="flex items-center gap-1 bg-[#121212] p-1 rounded-lg border border-[#2A2926]">
              <button
                onClick={() => setViewMode("editorial")}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === "editorial"
                    ? "bg-[#282826] text-[#F2EFE9]"
                    : "text-[#9C9993] hover:text-[#F2EFE9]"
                }`}
                title="Editorial Card View"
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("compact")}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === "compact"
                    ? "bg-[#282826] text-[#F2EFE9]"
                    : "text-[#9C9993] hover:text-[#F2EFE9]"
                }`}
                title="Compact Table View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          RANKED CONTENT DISPLAY
          Two Modes:
          A. EDITORIAL VIEW: 01 Heroic -> 02/03 Feature Duo -> 04+ High-Density Rows
          B. COMPACT LIST VIEW: High-density scan table (ideal for 100+ items)
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {viewMode === "editorial" ? (
          <div className="space-y-12">
            {/* -------------------------------------------------------------
                #01 HEROIC TOP PRESENTATION
                ------------------------------------------------------------- */}
            {filteredEpisodes[0] && (
              <div className="rounded-3xl overflow-hidden bg-[#181816] border-2 border-[#D93829]/50 shadow-2xl relative group">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-center">
                  {/* Left: 1920x1080 Full Still */}
                  <div className="lg:col-span-7 aspect-[16/10] relative overflow-hidden bg-black">
                    <img
                      src={filteredEpisodes[0].still}
                      alt={filteredEpisodes[0].title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#181816] via-transparent to-transparent lg:hidden" />
                    <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-md bg-[#D93829] text-white font-display text-lg tracking-widest uppercase">
                      #01 ALL-TIME CHAMPION
                    </div>
                  </div>

                  {/* Right: Editorial Narrative & Category Bars */}
                  <div className="lg:col-span-5 p-6 sm:p-10 space-y-6">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-[#D89B38] font-semibold">
                          Season {filteredEpisodes[0].season}, Episode {filteredEpisodes[0].episode} &bull; {filteredEpisodes[0].year}
                        </span>
                        <div className="px-3 py-1 rounded-lg bg-black/80 border border-[#D89B38]/50 text-[#D89B38] font-bold text-lg">
                          ★ {filteredEpisodes[0].overallScore.toFixed(1)}
                        </div>
                      </div>
                      <h2 className="font-display text-4xl sm:text-5xl text-[#F2EFE9] tracking-tight uppercase leading-none">
                        {filteredEpisodes[0].title}
                      </h2>
                    </div>

                    <p className="font-editorial italic text-base text-[#9C9993] leading-relaxed">
                      &ldquo;{filteredEpisodes[0].quote}&rdquo;
                    </p>

                    {/* Category Breakdown Bars */}
                    <div className="space-y-2 pt-2 border-t border-[#2A2926] text-xs font-mono">
                      {Object.entries(filteredEpisodes[0].categories).map(([cat, val]) => (
                        <div key={cat} className="space-y-1">
                          <div className="flex justify-between text-[#9C9993] text-[11px]">
                            <span className="uppercase">{cat}</span>
                            <span className="text-[#F2EFE9] font-bold">{val.toFixed(1)}/10</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#10100E] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                cat === "vibes" ? "bg-[#D93829]" : "bg-[#D89B38]"
                              }`}
                              style={{ width: `${(val / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-[#6B6862]">
                        Audrey Formula: 9.6 Weighted Index
                      </span>
                      <button
                        onClick={() => openRatingModal(filteredEpisodes[0])}
                        className="px-4 py-2 rounded-xl bg-[#22211F] hover:bg-[#2A2926] text-[#F2EFE9] border border-[#343331] text-xs font-semibold transition-colors"
                      >
                        Adjust Score &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                #02 & #03 FEATURE DUO PRESENTATION
                ------------------------------------------------------------- */}
            {filteredEpisodes.length >= 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {filteredEpisodes.slice(1, 3).map((ep, idx) => (
                  <div
                    key={ep.id}
                    className="rounded-2xl overflow-hidden bg-[#181816] border border-[#2A2926] hover:border-[#383632] transition-colors group flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-[16/10] relative overflow-hidden bg-black">
                        <img
                          src={ep.still}
                          alt={ep.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded bg-black/80 backdrop-blur-md border border-[#D89B38]/40 font-display text-sm text-[#D89B38]">
                          #{idx + 2}
                        </div>
                        <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-white font-bold text-sm">
                          ★ {ep.overallScore.toFixed(1)}
                        </div>
                      </div>

                      <div className="p-6 space-y-3">
                        <span className="text-[11px] font-mono text-[#6B6862]">
                          Season {ep.season}, Episode {ep.episode} &bull; {ep.year}
                        </span>
                        <h3 className="font-display text-3xl text-[#F2EFE9] tracking-tight uppercase leading-none">
                          {ep.title}
                        </h3>
                        <p className="font-editorial italic text-sm text-[#9C9993] line-clamp-3">
                          &ldquo;{ep.quote}&rdquo;
                        </p>
                      </div>
                    </div>

                    <div className="p-6 pt-0 border-t border-[#242321] flex items-center justify-between text-xs font-mono">
                      <span className="text-[#9C9993]">Vibes: {ep.categories.vibes}/10</span>
                      <button
                        onClick={() => openRatingModal(ep)}
                        className="text-xs text-[#D93829] font-semibold hover:underline"
                      >
                        Rate / Adjust
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* -------------------------------------------------------------
                #04+ HIGH-DENSITY EDITORIAL ROWS
                ------------------------------------------------------------- */}
            <div className="space-y-4">
              <h3 className="font-display text-2xl tracking-wide text-[#F2EFE9] uppercase pb-2 border-b border-[#262523]">
                REMAINING EPISODE HIERARCHY (#04 – #{filteredEpisodes.length})
              </h3>

              <div className="space-y-3">
                {filteredEpisodes.slice(3).map((ep, idx) => (
                  <div
                    key={ep.id}
                    className="p-4 sm:p-5 rounded-xl bg-[#161614] border border-[#242321] hover:border-[#383632] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank Number */}
                      <span className="font-display text-2xl text-[#6B6862] w-8 text-center shrink-0">
                        #{idx + 4}
                      </span>

                      {/* Small Crisp Still */}
                      <img
                        src={ep.still}
                        alt={ep.title}
                        className="w-20 h-14 object-cover rounded-lg bg-black shrink-0 hidden sm:block border border-[#2A2926]"
                      />

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-[#F2EFE9] text-base hover:text-[#D93829] transition-colors">
                            {ep.title}
                          </h4>
                          <span className="text-xs font-mono text-[#6B6862]">
                            (S{ep.season}E{ep.episode})
                          </span>
                        </div>
                        <p className="font-editorial italic text-xs text-[#9C9993] line-clamp-1 max-w-lg mt-0.5">
                          {ep.quote}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#242321]">
                      {/* Scores & Breakdown */}
                      <div className="text-right font-mono">
                        <span className="text-sm font-bold text-[#D89B38] block">
                          ★ {ep.overallScore.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-[#6B6862]">
                          Vibes: {ep.categories.vibes} &bull; Writing: {ep.categories.writing}
                        </span>
                      </div>

                      <button
                        onClick={() => openRatingModal(ep)}
                        className="px-3 py-1.5 rounded-lg bg-[#20201D] hover:bg-[#282824] text-[#F2EFE9] border border-[#343331] text-xs font-semibold transition-colors"
                      >
                        Adjust
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
              COMPACT LIST VIEW (HIGH DENSITY TABLE)
              ========================================================================= */
          <div className="rounded-2xl border border-[#2A2926] bg-[#161614] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#2A2926] bg-[#1B1B19] text-[#9C9993]">
                    <th className="py-3 px-4 w-12 text-center">Rank</th>
                    <th className="py-3 px-4">Title & Season</th>
                    <th className="py-3 px-4 text-center hidden sm:table-cell">Writing (8x)</th>
                    <th className="py-3 px-4 text-center hidden md:table-cell">Acting (8x)</th>
                    <th className="py-3 px-4 text-center hidden md:table-cell">Cinema (7x)</th>
                    <th className="py-3 px-4 text-center hidden lg:table-cell">Music (3x)</th>
                    <th className="py-3 px-4 text-center hidden sm:table-cell text-[#D93829]">Vibes (8x)</th>
                    <th className="py-3 px-4 text-right">Score</th>
                    <th className="py-3 px-4 text-right w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22211F]">
                  {filteredEpisodes.map((ep, idx) => (
                    <tr key={ep.id} className="hover:bg-[#1E1E1C] transition-colors">
                      <td className="py-3 px-4 text-center font-display text-sm text-[#D89B38]">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold text-[#F2EFE9]">
                        {ep.title}
                        <span className="font-mono text-[11px] text-[#6B6862] ml-2">
                          S{ep.season}E{ep.episode}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center hidden sm:table-cell text-[#9C9993]">
                        {ep.categories.writing.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-center hidden md:table-cell text-[#9C9993]">
                        {ep.categories.acting.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-center hidden md:table-cell text-[#9C9993]">
                        {ep.categories.cinematography.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-center hidden lg:table-cell text-[#9C9993]">
                        {ep.categories.music.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-center hidden sm:table-cell text-[#D93829] font-bold">
                        {ep.categories.vibes.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#F2EFE9]">
                        {ep.overallScore.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openRatingModal(ep)}
                          className="px-2.5 py-1 rounded bg-[#242321] text-white hover:bg-[#D93829] transition-colors"
                        >
                          Rate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          INTERACTIVE RATING MODAL (MOCK PROTOTYPE)
          Silky sliders with real-time weighted score recalculation
          ========================================================================= */}
      {editingEpisode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-[#383632] bg-[#161614] p-6 sm:p-8 space-y-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#2A2926]">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#D93829]">
                  Audrey Weighted Scoring Engine
                </span>
                <h3 className="font-display text-3xl text-[#F2EFE9] tracking-tight uppercase mt-0.5">
                  {editingEpisode.title}
                </h3>
                <span className="text-xs text-[#9C9993]">
                  Season {editingEpisode.season}, Episode {editingEpisode.episode}
                </span>
              </div>
              <button
                onClick={() => setEditingEpisode(null)}
                className="p-1 rounded-full text-[#9C9993] hover:text-white hover:bg-[#242321]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Live Calculated Overall Score Callout */}
            <div className="p-4 rounded-2xl bg-[#1B1B19] border border-[#2A2926] flex items-center justify-between">
              <div>
                <span className="text-xs text-[#9C9993] uppercase font-mono block">
                  Weighted Overall Score
                </span>
                <span className="text-[11px] text-[#6B6862]">
                  Recalculated from 5 weighted categories
                </span>
              </div>
              <div className="text-right">
                <span className="font-display text-4xl text-[#D89B38]">
                  {calculatedLiveScore.toFixed(1)}
                </span>
                <span className="text-xs text-[#6B6862] font-mono block">/ 10.0</span>
              </div>
            </div>

            {/* Sliders Container */}
            <div className="space-y-4 font-mono text-xs">
              {/* Writing */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[#F2EFE9]">
                  <span>Writing (Weight 8x)</span>
                  <span className="font-bold text-[#D89B38]">{sliderWriting.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  value={sliderWriting}
                  onChange={(e) => setSliderWriting(parseFloat(e.target.value))}
                  className="w-full accent-[#D93829] cursor-pointer"
                />
              </div>

              {/* Acting */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[#F2EFE9]">
                  <span>Acting (Weight 8x)</span>
                  <span className="font-bold text-[#D89B38]">{sliderActing.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  value={sliderActing}
                  onChange={(e) => setSliderActing(parseFloat(e.target.value))}
                  className="w-full accent-[#D93829] cursor-pointer"
                />
              </div>

              {/* Cinematography */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[#F2EFE9]">
                  <span>Cinematography (Weight 7x)</span>
                  <span className="font-bold text-[#D89B38]">{sliderCinema.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  value={sliderCinema}
                  onChange={(e) => setSliderCinema(parseFloat(e.target.value))}
                  className="w-full accent-[#D93829] cursor-pointer"
                />
              </div>

              {/* Music */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[#F2EFE9]">
                  <span>Music & Sound (Weight 3x)</span>
                  <span className="font-bold text-[#D89B38]">{sliderMusic.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  value={sliderMusic}
                  onChange={(e) => setSliderMusic(parseFloat(e.target.value))}
                  className="w-full accent-[#D93829] cursor-pointer"
                />
              </div>

              {/* Vibes */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[#D93829]">
                  <span className="font-bold">Vibes & Atmosphere (Weight 8x)</span>
                  <span className="font-bold">{sliderVibes.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  value={sliderVibes}
                  onChange={(e) => setSliderVibes(parseFloat(e.target.value))}
                  className="w-full accent-[#D93829] cursor-pointer"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingEpisode(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#9C9993] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={saveLiveRating}
                className="px-6 py-2.5 rounded-xl bg-[#D93829] hover:bg-[#C83225] text-white text-xs font-bold shadow-lg shadow-[#D93829]/20"
              >
                Save Weighted Rating
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
