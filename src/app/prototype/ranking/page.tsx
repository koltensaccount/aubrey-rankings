"use client";

import { BlackMirrorFeature } from "../black-mirror-feature";
import { useState, useMemo } from "react";
import { Sliders, List, Grid, X, ArrowUpRight, Table2 } from "lucide-react";

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
    still: "/prototype-art/san-junipero.jpg",
    quote:
      "A love story that finds warmth inside the machine. Kelly and Yorkie turn the series’ usual fear of technology into something quietly hopeful.",
    categories: {
      writing: 9.5,
      acting: 9.8,
      cinematography: 9.5,
      music: 10.0,
      vibes: 9.8,
    },
  },
  {
    id: "ep_2",
    rank: 2,
    title: "White Christmas",
    season: 2,
    episode: 4,
    year: "2014",
    overallScore: 9.5,
    still: "/prototype-art/white-christmas.jpg",
    quote:
      "Three interwoven horrors culminating in the most terrifying punishment ever conceived on television. Jon Hamm at his absolute best.",
    categories: {
      writing: 10.0,
      acting: 9.5,
      cinematography: 9.0,
      music: 8.5,
      vibes: 9.5,
    },
  },
  {
    id: "ep_3",
    rank: 3,
    title: "USS Callister",
    season: 4,
    episode: 1,
    year: "2017",
    overallScore: 9.4,
    still: "/prototype-art/uss-callister.jpg",
    quote:
      "Toby Haynes balances high-camp Star Trek technicolor pastiche with genuinely chilling psychological workplace abuse.",
    categories: {
      writing: 9.2,
      acting: 9.5,
      cinematography: 9.6,
      music: 9.0,
      vibes: 9.4,
    },
  },
  {
    id: "ep_4",
    rank: 4,
    title: "The Entire History of You",
    season: 1,
    episode: 3,
    year: "2011",
    overallScore: 9.3,
    still: "/prototype-art/entire-history.jpg",
    quote:
      "The definitive early episode. Relentless, intimate paranoia where memory itself becomes a self-inflicted interrogation device.",
    categories: {
      writing: 9.5,
      acting: 9.2,
      cinematography: 8.8,
      music: 8.5,
      vibes: 9.4,
    },
  },
  {
    id: "ep_5",
    rank: 5,
    title: "Fifteen Million Merits",
    season: 1,
    episode: 2,
    year: "2011",
    overallScore: 9.1,
    still: "/prototype-art/fifteen-million.jpg",
    quote:
      "Daniel Kaluuya's monologue against the monolithic judges remains the series' rawest emotional eruption.",
    categories: {
      writing: 9.0,
      acting: 9.5,
      cinematography: 9.2,
      music: 8.5,
      vibes: 9.0,
    },
  },
  {
    id: "ep_6",
    rank: 6,
    title: "Nosedive",
    season: 3,
    episode: 1,
    year: "2016",
    overallScore: 9.0,
    still: "/prototype-art/nosedive.jpg",
    quote:
      "Joe Wright's pastel aesthetic renders social-media validation anxiety into a darkly hilarious pastel panic.",
    categories: {
      writing: 8.8,
      acting: 9.2,
      cinematography: 9.6,
      music: 8.6,
      vibes: 9.0,
    },
  },
  {
    id: "ep_7",
    rank: 7,
    title: "Be Right Back",
    season: 2,
    episode: 1,
    year: "2013",
    overallScore: 8.9,
    still: "/prototype-art/be-right-back.jpg",
    quote:
      "Hayley Atwell and Domhnall Gleeson deliver an emotionally devastating study on grief and AI replicas.",
    categories: {
      writing: 9.0,
      acting: 9.2,
      cinematography: 8.5,
      music: 8.5,
      vibes: 8.8,
    },
  },
  {
    id: "ep_8",
    rank: 8,
    title: "Black Museum",
    season: 4,
    episode: 6,
    year: "2017",
    overallScore: 8.8,
    still: "/prototype-art/black-museum.jpg",
    quote:
      "Grim carnival of high-tech atrocities that doubles as an encyclopedia of easter eggs.",
    categories: {
      writing: 8.8,
      acting: 9.0,
      cinematography: 8.5,
      music: 8.0,
      vibes: 8.9,
    },
  },
];

export default function PrototypeRankingPage() {
  const [episodes, setEpisodes] = useState<EpisodeEntry[]>(INITIAL_EPISODES);
  const [viewMode, setViewMode] = useState<"list" | "editorial" | "compact">(
    "list",
  );
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"rank" | "season" | "title">("rank");

  // Interactive Rating Modal State
  const [editingEpisode, setEditingEpisode] = useState<EpisodeEntry | null>(
    null,
  );
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
          : ep,
      ),
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
      list.sort((a, b) =>
        a.season !== b.season ? a.season - b.season : a.episode - b.episode,
      );
    } else if (sortBy === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [episodes, seasonFilter, sortBy]);

  return (
    <div className="ar-rankingContent pb-28">
      <BlackMirrorFeature detail />

      {/* =========================================================================
          CONTROLS TOOLBAR: VIEW SWITCHER & FILTERS
          ========================================================================= */}
      <section
        id="episode-ranking"
        className="ar-contentSection ar-rankingControls scroll-mt-6"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-3 rounded-2xl bg-[#161614] border border-[#2A2926]">
          {/* Season Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {["all", "1", "2", "3", "4", "5", "6"].map((season) => (
              <button
                key={season}
                onClick={() => setSeasonFilter(season)}
                aria-pressed={seasonFilter === season}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all whitespace-nowrap ${
                  seasonFilter === season
                    ? "bg-[#89D5D5] text-[#102523] font-bold"
                    : "text-[#9C9993] hover:text-[#F2EFE9] hover:bg-[#1E1E1C]"
                }`}
              >
                {season === "all" ? "All seasons" : `Season ${season}`}
              </button>
            ))}
          </div>

          {/* View Mode & Sort Toggle */}
          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#262523]">
            {/* Sort Dropdown */}
            <select
              value={sortBy}
              aria-label="Sort episodes"
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-[#1E1E1C] text-xs font-mono text-[#F2EFE9] border border-[#343331] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#89D5D5]"
            >
              <option value="rank">Sort: Highest Score</option>
              <option value="season">Sort: Chronological (S/E)</option>
              <option value="title">Sort: Alphabetical</option>
            </select>

            {/* View Mode Buttons */}
            <div className="flex items-center gap-1 bg-[#121212] p-1 rounded-lg border border-[#2A2926]">
              <button
                onClick={() => setViewMode("list")}
                title="List view"
                aria-pressed={viewMode === "list"}
                className={viewMode === "list" ? "ar-viewSelected" : ""}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("editorial")}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === "editorial"
                    ? "bg-[#282826] text-[#F2EFE9]"
                    : "text-[#9C9993] hover:text-[#F2EFE9]"
                }`}
                aria-pressed={viewMode === "editorial"}
                title="Editorial view"
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
                aria-pressed={viewMode === "compact"}
                title="Score table"
              >
                <Table2 className="h-4 w-4" />
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
      <section className="ar-contentSection ar-rankingBody">
        {viewMode === "list" ? (
          <div className="ar-defaultRanking">
            <header className="ar-sectionHeading">
              <h2>Episodes</h2>
              <span className="ar-previewCount">
                {filteredEpisodes.length} entries ·{" "}
                {sortBy === "rank"
                  ? "Highest rated first"
                  : sortBy === "title"
                    ? "Alphabetical"
                    : "Season order"}
              </span>
            </header>
            {filteredEpisodes.map((ep, index) => (
              <article
                key={ep.id}
                className={`ar-episodeRow ${index === 0 ? "ar-firstEpisode" : ""}`}
              >
                <span className="ar-rowRank">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <img src={ep.still} alt={ep.title} />
                <div className="ar-rowTitle">
                  <h3>{ep.title}</h3>
                  <p>
                    Season {ep.season} · Episode {ep.episode} · {ep.year}
                  </p>
                  <span className="ar-rowReview">{ep.quote}</span>
                </div>
                <span className="ar-rowScore">
                  {ep.overallScore.toFixed(1)}
                  <small>/ 10</small>
                </span>
                <button
                  onClick={() => openRatingModal(ep)}
                  aria-label={`Adjust ${ep.title} rating`}
                  className="ar-rowAdjust"
                >
                  <Sliders size={16} />
                </button>
              </article>
            ))}
            {filteredEpisodes.length === 0 && (
              <div className="ar-feedEmpty">
                <h3>No episodes in this preview season.</h3>
                <button
                  className="ar-textButton"
                  onClick={() => setSeasonFilter("all")}
                >
                  Show all episodes
                </button>
              </div>
            )}
          </div>
        ) : viewMode === "editorial" ? (
          <div className="ar-episodeEditorial">
            <header className="ar-sectionHeading ar-rankingHeading">
              <div>
                <span className="ar-sectionLabel">The episodes</span>
                <h2>Every story leaves a mark.</h2>
              </div>
              <span className="ar-previewCount">
                {filteredEpisodes.length} episodes in this preview
              </span>
            </header>
            {filteredEpisodes[0] && (
              <article className="ar-episodeFeature">
                <div className="ar-episodeImage">
                  <img
                    src={filteredEpisodes[0].still}
                    alt={filteredEpisodes[0].title}
                  />
                  <span className="ar-rankNumeral">01</span>
                  <div className="ar-episodeImageTitle">
                    <p>
                      Season {filteredEpisodes[0].season} · Episode{" "}
                      {filteredEpisodes[0].episode} · {filteredEpisodes[0].year}
                    </p>
                    <h2>{filteredEpisodes[0].title}</h2>
                  </div>
                </div>
                <div className="ar-episodeNotes">
                  <div className="ar-leadingScore">
                    <span>Aubrey’s score</span>
                    <strong>
                      {filteredEpisodes[0].overallScore.toFixed(1)}
                      <small>/ 10</small>
                    </strong>
                  </div>
                  <p className="ar-episodeQuote">{filteredEpisodes[0].quote}</p>
                  <dl className="ar-categoryScores">
                    {Object.entries(filteredEpisodes[0].categories).map(
                      ([category, value]) => (
                        <div key={category}>
                          <dt>
                            {category === "cinematography"
                              ? "Cinematography"
                              : category[0].toUpperCase() + category.slice(1)}
                          </dt>
                          <dd>{value.toFixed(1)}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                  <button
                    className="ar-textButton"
                    onClick={() => openRatingModal(filteredEpisodes[0])}
                  >
                    Adjust rating <ArrowUpRight size={15} />
                  </button>
                </div>
              </article>
            )}
            {filteredEpisodes.length > 1 && (
              <div className="ar-episodeDuo">
                {filteredEpisodes.slice(1, 3).map((ep, index) => (
                  <article key={ep.id} className="ar-supportEpisode">
                    <div className="ar-supportImage">
                      <img src={ep.still} alt={ep.title} loading="lazy" />
                      <span>0{index + 2}</span>
                    </div>
                    <div className="ar-supportTitle">
                      <div>
                        <p>
                          Season {ep.season} · Episode {ep.episode}
                        </p>
                        <h3>{ep.title}</h3>
                      </div>
                      <span>
                        {ep.overallScore.toFixed(1)}
                        <small>/ 10</small>
                      </span>
                    </div>
                    <p className="ar-supportQuote">{ep.quote}</p>
                    <button
                      className="ar-textButton"
                      onClick={() => openRatingModal(ep)}
                    >
                      Adjust rating <ArrowUpRight size={15} />
                    </button>
                  </article>
                ))}
              </div>
            )}
            {filteredEpisodes.length > 3 && (
              <div className="ar-remainingEpisodes">
                <h3>The rest of the ranking</h3>
                {filteredEpisodes.slice(3).map((ep, index) => (
                  <article className="ar-episodeRow" key={ep.id}>
                    <span className="ar-rowRank">
                      {String(index + 4).padStart(2, "0")}
                    </span>
                    <img src={ep.still} alt="" loading="lazy" />
                    <div className="ar-rowTitle">
                      <h4>{ep.title}</h4>
                      <p>
                        Season {ep.season} · Episode {ep.episode}
                      </p>
                    </div>
                    <span className="ar-rowScore">
                      {ep.overallScore.toFixed(1)}
                    </span>
                    <button
                      onClick={() => openRatingModal(ep)}
                      aria-label={`Adjust ${ep.title} rating`}
                      className="ar-rowAdjust"
                    >
                      <Sliders size={16} />
                    </button>
                  </article>
                ))}
              </div>
            )}
            {filteredEpisodes.length === 0 && (
              <div className="ar-emptyState">
                <h3>More stories to come.</h3>
                <p>This season isn’t included in the eight-episode preview.</p>
                <button
                  className="ar-textButton"
                  onClick={() => setSeasonFilter("all")}
                >
                  See all preview episodes <ArrowUpRight size={16} />
                </button>
              </div>
            )}
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
                    <th className="py-3 px-4 text-center hidden sm:table-cell">
                      Writing (8x)
                    </th>
                    <th className="py-3 px-4 text-center hidden md:table-cell">
                      Acting (8x)
                    </th>
                    <th className="py-3 px-4 text-center hidden md:table-cell">
                      Cinema (7x)
                    </th>
                    <th className="py-3 px-4 text-center hidden lg:table-cell">
                      Music (3x)
                    </th>
                    <th className="py-3 px-4 text-center hidden sm:table-cell text-[#89D5D5]">
                      Vibes (8x)
                    </th>
                    <th className="py-3 px-4 text-right">Score</th>
                    <th className="py-3 px-4 text-right w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22211F]">
                  {filteredEpisodes.map((ep, idx) => (
                    <tr
                      key={ep.id}
                      className="hover:bg-[#1E1E1C] transition-colors"
                    >
                      <td className="py-3 px-4 text-center font-display text-sm text-[#B8DAD6]">
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
                      <td className="py-3 px-4 text-center hidden sm:table-cell text-[#89D5D5] font-bold">
                        {ep.categories.vibes.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#F2EFE9]">
                        {ep.overallScore.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openRatingModal(ep)}
                          className="px-2.5 py-1 rounded bg-[#242321] text-white hover:bg-[#89D5D5] transition-colors"
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
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Adjust episode rating"
            className="relative w-full max-w-lg rounded-3xl border border-[#383632] bg-[#161614] p-6 sm:p-8 space-y-6 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#2A2926]">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#89D5D5]">
                  Adjust your rating
                </span>
                <h3 className="font-display text-3xl text-[#F2EFE9] tracking-tight uppercase mt-0.5">
                  {editingEpisode.title}
                </h3>
                <span className="text-xs text-[#9C9993]">
                  Season {editingEpisode.season}, Episode{" "}
                  {editingEpisode.episode}
                </span>
              </div>
              <button
                onClick={() => setEditingEpisode(null)}
                aria-label="Close rating editor"
                className="p-1 rounded-full text-[#9C9993] hover:text-white hover:bg-[#242321]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Live Calculated Overall Score Callout */}
            <div className="p-4 rounded-2xl bg-[#1B1B19] border border-[#2A2926] flex items-center justify-between">
              <div>
                <span className="text-xs text-[#9C9993] uppercase font-mono block">
                  Overall score
                </span>
                <span className="text-[11px] text-[#6B6862]">
                  Recalculated from 5 weighted categories
                </span>
              </div>
              <div className="text-right">
                <span className="font-display text-4xl text-[#B8DAD6]">
                  {calculatedLiveScore.toFixed(1)}
                </span>
                <span className="text-xs text-[#6B6862] font-mono block">
                  / 10.0
                </span>
              </div>
            </div>

            {/* Sliders Container */}
            <div className="space-y-4 font-mono text-xs">
              {/* Writing */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[#F2EFE9]">
                  <span>Writing (Weight 8x)</span>
                  <span className="font-bold text-[#B8DAD6]">
                    {sliderWriting.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  aria-label="Writing score"
                  value={sliderWriting}
                  onChange={(e) => setSliderWriting(parseFloat(e.target.value))}
                  className="w-full accent-[#89D5D5] cursor-pointer"
                />
              </div>

              {/* Acting */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[#F2EFE9]">
                  <span>Acting (Weight 8x)</span>
                  <span className="font-bold text-[#B8DAD6]">
                    {sliderActing.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  aria-label="Acting score"
                  value={sliderActing}
                  onChange={(e) => setSliderActing(parseFloat(e.target.value))}
                  className="w-full accent-[#89D5D5] cursor-pointer"
                />
              </div>

              {/* Cinematography */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[#F2EFE9]">
                  <span>Cinematography (Weight 7x)</span>
                  <span className="font-bold text-[#B8DAD6]">
                    {sliderCinema.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  aria-label="Cinematography score"
                  value={sliderCinema}
                  onChange={(e) => setSliderCinema(parseFloat(e.target.value))}
                  className="w-full accent-[#89D5D5] cursor-pointer"
                />
              </div>

              {/* Music */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[#F2EFE9]">
                  <span>Music & Sound (Weight 3x)</span>
                  <span className="font-bold text-[#B8DAD6]">
                    {sliderMusic.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  aria-label="Music score"
                  value={sliderMusic}
                  onChange={(e) => setSliderMusic(parseFloat(e.target.value))}
                  className="w-full accent-[#89D5D5] cursor-pointer"
                />
              </div>

              {/* Vibes */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[#89D5D5]">
                  <span className="font-bold">
                    Vibes & Atmosphere (Weight 8x)
                  </span>
                  <span className="font-bold">{sliderVibes.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  aria-label="Vibes score"
                  value={sliderVibes}
                  onChange={(e) => setSliderVibes(parseFloat(e.target.value))}
                  className="w-full accent-[#89D5D5] cursor-pointer"
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
                className="px-6 py-2.5 rounded-xl bg-[#89D5D5] hover:bg-[#B7ECE8] text-[#102523] text-xs font-bold shadow-lg shadow-[#89D5D5]/20"
              >
                Save rating
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
