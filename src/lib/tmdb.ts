const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

function getAuthHeaders(): HeadersInit {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;

  if (token) {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  return {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function getUrl(path: string, params: Record<string, string | number> = {}): string {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  const apiKey = process.env.TMDB_API_KEY;
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;

  if (!token && apiKey) {
    url.searchParams.set("api_key", apiKey);
  }

  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null) {
      url.searchParams.set(key, String(val));
    }
  }

  return url.toString();
}

export function getTmdbImageUrl(
  path: string | null | undefined,
  size: "w185" | "w342" | "w500" | "w780" | "w1280" | "original" = "w500"
): string {
  if (!path) return "/placeholder-poster.png";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) {
    if (path.startsWith("/")) return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
    return path;
  }
  return `${TMDB_IMAGE_BASE_URL}/${size}/${path}`;
}

export interface TmdbSearchResult {
  id: number;
  media_type?: "movie" | "tv";
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
}

export interface TmdbEpisode {
  id: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string;
  episode_number: number;
  season_number: number;
  vote_average: number;
}

export interface TmdbSeason {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  episode_count: number;
  air_date: string;
  episodes?: TmdbEpisode[];
}

export interface TmdbTvShowDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: TmdbSeason[];
  vote_average: number;
}

export interface TmdbMovieCollectionPart {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
}

export interface TmdbMovieCollectionDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: TmdbMovieCollectionPart[];
}

export interface TmdbImageItem {
  file_path: string;
  aspect_ratio: number;
  height: number;
  width: number;
  vote_average: number;
}

// In-memory request cache for fast page transitions
const cache = new Map<string, { timestamp: number; data: unknown }>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

async function tmdbFetch<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = getUrl(path, params);

  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data as T;
  }

  const res = await fetch(url, {
    headers: getAuthHeaders(),
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`TMDB API request failed [${res.status}]: ${errorText}`);
  }

  const data = (await res.json()) as T;
  cache.set(url, { timestamp: Date.now(), data });
  return data;
}

export const tmdb = {
  async searchMulti(query: string, page = 1) {
    return tmdbFetch<{ results: TmdbSearchResult[]; total_pages: number; total_results: number }>(
      "/search/multi",
      { query, page }
    );
  },

  async searchTv(query: string, page = 1) {
    return tmdbFetch<{ results: TmdbSearchResult[]; total_pages: number; total_results: number }>(
      "/search/tv",
      { query, page }
    );
  },

  async searchMovieCollections(query: string, page = 1) {
    return tmdbFetch<{
      results: { id: number; name: string; poster_path: string | null; backdrop_path: string | null; overview?: string }[];
      total_pages: number;
      total_results: number;
    }>("/search/collection", { query, page });
  },

  async searchMovies(query: string, page = 1) {
    return tmdbFetch<{ results: TmdbSearchResult[]; total_pages: number; total_results: number }>(
      "/search/movie",
      { query, page }
    );
  },

  async getTvDetails(tvId: number): Promise<TmdbTvShowDetails> {
    return tmdbFetch<TmdbTvShowDetails>(`/tv/${tvId}`);
  },

  async getTvSeason(tvId: number, seasonNumber: number): Promise<TmdbSeason> {
    return tmdbFetch<TmdbSeason>(`/tv/${tvId}/season/${seasonNumber}`);
  },

  async getMovieCollection(collectionId: number): Promise<TmdbMovieCollectionDetails> {
    return tmdbFetch<TmdbMovieCollectionDetails>(`/collection/${collectionId}`);
  },

  async getMovieDetails(movieId: number) {
    return tmdbFetch<{
      id: number;
      title: string;
      overview: string;
      poster_path: string | null;
      backdrop_path: string | null;
      release_date: string;
      runtime: number;
      vote_average: number;
    }>(`/movie/${movieId}`);
  },

  async getMovieImages(movieId: number): Promise<{ posters: TmdbImageItem[]; backdrops: TmdbImageItem[] }> {
    return tmdbFetch(`/movie/${movieId}/images`);
  },

  async getTvImages(tvId: number): Promise<{ posters: TmdbImageItem[]; backdrops: TmdbImageItem[] }> {
    return tmdbFetch(`/tv/${tvId}/images`);
  },

  async getEpisodeImages(tvId: number, seasonNumber: number, episodeNumber: number): Promise<{ stills: TmdbImageItem[] }> {
    return tmdbFetch(`/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}/images`);
  },
};
