export interface HistoricalRatingRow {
  title: string;
  season?: number;
  episode?: number;
  music?: number;
  acting?: number;
  cinematography?: number;
  writing?: number;
  vibes?: number;
  notes?: string;
  weights?: {
    music?: number;
    acting?: number;
    cinematography?: number;
    writing?: number;
    vibes?: number;
  };
}

/**
 * Standard Black Mirror episode guide with season and episode numbers
 */
export const BLACK_MIRROR_EPISODES = [
  { season: 1, episode: 1, title: "The National Anthem" },
  { season: 1, episode: 2, title: "Fifteen Million Merits" },
  { season: 1, episode: 3, title: "The Entire History of You" },
  { season: 2, episode: 1, title: "Be Right Back" },
  { season: 2, episode: 2, title: "White Bear" },
  { season: 2, episode: 3, title: "The Waldo Moment" },
  { season: 2, episode: 4, title: "White Christmas" },
  { season: 3, episode: 1, title: "Nosedive" },
  { season: 3, episode: 2, title: "Playtest" },
  { season: 3, episode: 3, title: "Shut Up and Dance" },
  { season: 3, episode: 4, title: "San Junipero" },
  { season: 3, episode: 5, title: "Men Against Fire" },
  { season: 3, episode: 6, title: "Hated in the Nation" },
  { season: 4, episode: 1, title: "USS Callister" },
  { season: 4, episode: 2, title: "Arkangel" },
  { season: 4, episode: 3, title: "Crocodile" },
  { season: 4, episode: 4, title: "Hang the DJ" },
  { season: 4, episode: 5, title: "Metalhead" },
  { season: 4, episode: 6, title: "Black Museum" },
  { season: 5, episode: 1, title: "Striking Vipers" },
  { season: 5, episode: 2, title: "Smithereens" },
  { season: 5, episode: 3, title: "Rachel, Jack and Ashley Too" },
  { season: 6, episode: 1, title: "Joan Is Awful" },
  { season: 6, episode: 2, title: "Loch Henry" },
  { season: 6, episode: 3, title: "Beyond the Sea" },
  { season: 6, episode: 4, title: "Mazey Day" },
  { season: 6, episode: 5, title: "Demon 79" },
];

export function findMatchingEpisode(searchTitle: string) {
  const clean = searchTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
  return BLACK_MIRROR_EPISODES.find((ep) => {
    const epClean = ep.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    return epClean === clean || epClean.includes(clean) || clean.includes(epClean);
  });
}
