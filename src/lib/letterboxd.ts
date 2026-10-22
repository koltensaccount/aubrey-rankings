import AdmZip from "adm-zip";

export interface ParsedLetterboxdFilm {
  title: string;
  year: number | null;
  letterboxdUri: string;
  rating?: number; // 0.5 to 5.0
  review?: string;
  reviewDate?: string;
  reviewUri?: string;
  watchDate?: string;
  isWatched: boolean;
  isFavorite?: boolean;
}

export interface ParsedDiaryEntry {
  title: string;
  year: number | null;
  letterboxdUri: string;
  watchedDate: string | null;
  loggedDate: string | null;
  isRewatch: boolean;
  rating?: number;
  tags: string[];
  occurrenceIndex: number;
  sourceEventKey?: string;
}

export function canonicalFilmKey(d: {
  title: string;
  year: number | null;
  letterboxdUri?: string | null;
}): string {
  if (d.letterboxdUri && d.letterboxdUri.trim()) {
    return normalizeLetterboxdFilmUri(d.letterboxdUri);
  }
  return `${d.title.trim().toLowerCase()}::${d.year ?? ""}`;
}

export function buildDiaryEventKey(d: {
  title: string;
  year: number | null;
  letterboxdUri?: string | null;
  watchedDate: string | null;
  loggedDate: string | null;
  isRewatch: boolean;
  occurrenceIndex?: number;
}): string {
  const filmKey = canonicalFilmKey(d);
  const watched = d.watchedDate || "";
  const logged = d.loggedDate || "";
  const rewatch = d.isRewatch ? "1" : "0";
  const occ = d.occurrenceIndex || 1;
  return `${filmKey}::${watched}::${logged}::${rewatch}::${occ}`;
}

export interface ParsedReview {
  title: string;
  year: number | null;
  letterboxdUri: string;
  reviewDate: string | null;
  watchedDate: string | null;
  rating?: number;
  isRewatch: boolean;
  review: string;
  tags: string[];
}

export interface ParsedWatchlistItem {
  title: string;
  year: number | null;
  letterboxdUri: string;
  dateAdded: string | null;
}

export interface ParsedRatingEvent {
  title: string;
  year: number | null;
  letterboxdUri: string;
  ratingDate: string | null;
  rating: number;
}

export interface ParsedWatchedEvent {
  title: string;
  year: number | null;
  letterboxdUri: string;
  watchedDate: string | null;
}

export interface ParsedListEntry {
  position: number;
  title: string;
  year: number | null;
  letterboxdUri: string;
  notes?: string;
}

export interface ParsedCustomList {
  filename: string;
  title: string;
  description?: string;
  tags: string[];
  url?: string;
  entries: ParsedListEntry[];
}

export interface UnresolvedSourceItem {
  sourceType: "film" | "diary" | "review" | "list" | "watchlist";
  rawRow: Record<string, string>;
  reason: "ambiguous_media" | "missing_metadata" | "malformed_row";
  details?: string;
}

export interface UnsupportedSourceItem {
  filename: string;
  category: "external_social_activity" | "unsupported_file" | "malformed_data";
  details: string;
  count?: number;
}

export interface LetterboxdExportSummary {
  totalUniqueFilms: number;
  totalRatings: number;
  totalReviews: number;
  totalWatched: number;
  totalDiaryEntries: number;
  totalWatchlistItems: number;
  totalCustomLists: number;
  totalCustomListEntries: number;
  totalLikes: number;
  films: ParsedLetterboxdFilm[];
  diaryEntries: ParsedDiaryEntry[];
  reviews: ParsedReview[];
  watchlist: ParsedWatchlistItem[];
  ratingEvents: ParsedRatingEvent[];
  watchedEvents: ParsedWatchedEvent[];
  customLists: ParsedCustomList[];
  likedFilms: Array<{ title: string; year: number | null; letterboxdUri: string }>;
  unresolved: UnresolvedSourceItem[];
  unsupportedItems: UnsupportedSourceItem[];
}

/**
 * Robust CSV Line Parser that handles escaped quotes and commas within quotes
 */
export function parseCSV(content: string): string[][] {
  content = content.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < lines.length; i++) {
    const char = lines[i];
    const nextChar = lines[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\n") {
        currentRow.push(currentField);
        if (currentRow.length > 0 && currentRow.some((f) => f.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (inQuotes) throw new Error("Unterminated CSV quoted field");

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function isValidWatchDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseYear(yearStr?: string): number | null {
  if (!yearStr) return null;
  const clean = yearStr.trim();
  return /^\d{4}$/.test(clean) ? Number(clean) : null;
}

function parseRating(ratingStr?: string): number | undefined {
  if (!ratingStr) return undefined;
  const val = parseFloat(ratingStr.trim());
  if (Number.isFinite(val) && val >= 0.5 && val <= 5.0 && Number.isInteger(val * 2)) {
    return val;
  }
  return undefined;
}

function parseTags(tagStr?: string): string[] {
  if (!tagStr) return [];
  return tagStr
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function cleanFilenameTitle(filename: string): string {
  const base = filename.replace(/\.csv$/i, "").replace(/[_-]+/g, " ").trim();
  return base
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Parses an official Letterboxd ZIP export archive buffer
 */
export function normalizeLetterboxdFilmUri(uri: string): string {
  if (!uri) return "";
  const trimmed = uri.trim();
  // Match letterboxd.com/[username]/film/<slug>/[viewing-number]/ -> normalize to https://letterboxd.com/film/<slug>/
  const diaryMatch = trimmed.match(
    /^(https?:\/\/letterboxd\.com\/)[^\/]+\/film\/([^\/\?#]+)(?:\/\d+)?\/?$/i
  );
  if (diaryMatch) {
    return `https://letterboxd.com/film/${diaryMatch[2].toLowerCase()}/`;
  }

  const filmMatch = trimmed.match(
    /^(https?:\/\/letterboxd\.com\/film\/[^\/\?#]+)\/?$/i
  );
  if (filmMatch) {
    return `${filmMatch[1].toLowerCase()}/`;
  }

  return trimmed.toLowerCase();
}

export function parseLetterboxdZip(zipBuffer: Buffer): LetterboxdExportSummary {
  const zip = new AdmZip(zipBuffer);
  const zipEntries = zip.getEntries();
  if (
    zipEntries.length > 10000 ||
    zipEntries.reduce((size, entry) => size + entry.header.size, 0) > 100 * 1024 * 1024
  ) {
    throw new Error("Expanded archive exceeds permitted size");
  }

  const filmMap = new Map<string, ParsedLetterboxdFilm>();
  const titleYearToFilms = new Map<string, Set<ParsedLetterboxdFilm>>();
  const diaryEntries: ParsedDiaryEntry[] = [];
  const reviews: ParsedReview[] = [];
  const watchlist: ParsedWatchlistItem[] = [];
  const ratingEvents: ParsedRatingEvent[] = [];
  const watchedEvents: ParsedWatchedEvent[] = [];
  const customLists: ParsedCustomList[] = [];
  const likedFilms: Array<{ title: string; year: number | null; letterboxdUri: string }> = [];
  const unresolved: UnresolvedSourceItem[] = [];
  const unsupportedItems: UnsupportedSourceItem[] = [];
  const diaryOccurrenceTracker = new Map<string, number>();
  let otherLikesCount = 0;

  const getOrCreateFilm = (
    title: string,
    yearStr: string,
    uri: string,
    options?: { isDiaryOrReview?: boolean }
  ): ParsedLetterboxdFilm | null => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return null;

    const year = parseYear(yearStr);
    const cleanUri = uri?.trim() || "";
    const titleYearKey = `${cleanTitle.toLowerCase()}::${year ?? ""}`;
    const normUri = normalizeLetterboxdFilmUri(cleanUri);

    // 1. Direct lookup by normalized URI
    if (normUri && filmMap.has(normUri)) {
      return filmMap.get(normUri)!;
    }

    // 2. Direct lookup by raw cleanUri
    if (cleanUri && filmMap.has(cleanUri.toLowerCase())) {
      return filmMap.get(cleanUri.toLowerCase())!;
    }

    const existingCandidates = titleYearToFilms.get(titleYearKey);

    // 3. If this call comes from diary.csv or reviews.csv:
    // In Letterboxd exports, diary and review files contain viewing/review-specific URLs
    // (e.g. /username/film/slug/1/ or synthetic repeat URLs).
    // If there is already exactly ONE film for this title and year, attach to it!
    if (options?.isDiaryOrReview && existingCandidates && existingCandidates.size === 1) {
      return Array.from(existingCandidates)[0];
    }

    // 4. If an un-URI'd film was previously created for this title/year, adopt this URI
    if (existingCandidates && existingCandidates.size === 1) {
      const candidate = Array.from(existingCandidates)[0];
      if (!candidate.letterboxdUri) {
        candidate.letterboxdUri = cleanUri;
        filmMap.delete(titleYearKey);
        filmMap.set(normUri || cleanUri.toLowerCase(), candidate);
        return candidate;
      }
    }

    // 5. If URI is present: create a distinct film for this URI
    if (cleanUri) {
      const key = normUri || cleanUri.toLowerCase();
      const film: ParsedLetterboxdFilm = {
        title: cleanTitle,
        year,
        letterboxdUri: cleanUri,
        isWatched: false,
        isFavorite: false,
      };
      filmMap.set(key, film);
      if (!titleYearToFilms.has(titleYearKey)) {
        titleYearToFilms.set(titleYearKey, new Set());
      }
      titleYearToFilms.get(titleYearKey)!.add(film);
      return film;
    }

    // 6. If NO URI is present:
    if (existingCandidates && existingCandidates.size === 1) {
      return Array.from(existingCandidates)[0];
    }

    let film = filmMap.get(titleYearKey);
    if (!film) {
      film = {
        title: cleanTitle,
        year,
        letterboxdUri: "",
        isWatched: false,
        isFavorite: false,
      };
      filmMap.set(titleYearKey, film);
      if (!titleYearToFilms.has(titleYearKey)) {
        titleYearToFilms.set(titleYearKey, new Set());
      }
      titleYearToFilms.get(titleYearKey)!.add(film);
    }
    return film;
  };

  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;
    if (entry.header.size > 50 * 1024 * 1024) {
      throw new Error("CSV exceeds permitted size");
    }

    const entryName = entry.entryName.replace(/\\/g, "/");
    const lowerName = entryName.toLowerCase();
    const pathParts = lowerName.split("/").filter(Boolean);
    const fileName = pathParts[pathParts.length - 1] ?? "";
    const isInsideLists = pathParts.slice(0, -1).includes("lists");
    const isInsideLikes = pathParts.slice(0, -1).includes("likes");

    // ----------------------------------------------------
    // 1. ratings.csv
    // ----------------------------------------------------
    if (fileName === "ratings.csv" && !isInsideLists && !isInsideLikes) {
      const csvText = entry.getData().toString("utf8");
      const rows = parseCSV(csvText);
      if (rows.length > 1) {
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const nameIdx = header.indexOf("name");
        const yearIdx = header.indexOf("year");
        const uriIdx = header.indexOf("letterboxd uri");
        const ratingIdx = header.indexOf("rating");
        const dateIdx = header.indexOf("date");

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = row[nameIdx] || "";
          if (!name.trim()) {
            unresolved.push({
              sourceType: "film",
              rawRow: { file: "ratings.csv", row: String(i), raw: row.join(",") },
              reason: "missing_metadata",
              details: `Row ${i} in ratings.csv is missing a film title.`,
            });
            continue;
          }
          const year = row[yearIdx] || "";
          const uri = row[uriIdx] || "";
          const ratingVal = parseRating(row[ratingIdx]);
          const ratingDate = dateIdx !== -1 ? row[dateIdx] || "" : "";

          const film = getOrCreateFilm(name, year, uri);
          if (film) {
            film.isWatched = true;
            if (ratingVal !== undefined) {
              film.rating = ratingVal;
            }
          }

          if (ratingVal !== undefined) {
            ratingEvents.push({
              title: name.trim(),
              year: parseYear(year),
              letterboxdUri: uri.trim(),
              ratingDate: isValidWatchDate(ratingDate) ? ratingDate : null,
              rating: ratingVal,
            });
          }
        }
      }
      continue;
    }

    // ----------------------------------------------------
    // 2. watched.csv
    // ----------------------------------------------------
    if (fileName === "watched.csv" && !isInsideLists && !isInsideLikes) {
      const csvText = entry.getData().toString("utf8");
      const rows = parseCSV(csvText);
      if (rows.length > 1) {
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const nameIdx = header.indexOf("name");
        const yearIdx = header.indexOf("year");
        const uriIdx = header.indexOf("letterboxd uri");
        const dateIdx = header.indexOf("date");

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = row[nameIdx] || "";
          if (!name.trim()) {
            unresolved.push({
              sourceType: "film",
              rawRow: { file: "watched.csv", row: String(i), raw: row.join(",") },
              reason: "missing_metadata",
              details: `Row ${i} in watched.csv is missing a film title.`,
            });
            continue;
          }
          const year = row[yearIdx] || "";
          const uri = row[uriIdx] || "";
          const rawDate = dateIdx !== -1 ? row[dateIdx] || "" : "";
          const watchedDate = isValidWatchDate(rawDate) ? rawDate : null;

          const film = getOrCreateFilm(name, year, uri);
          if (film) {
            // watched.csv confirms the film was watched, but its Date column is only an activity date
            // not an actual viewing date. We do NOT set film.watchDate here.
            film.isWatched = true;
          }

          watchedEvents.push({
            title: name.trim(),
            year: parseYear(year),
            letterboxdUri: uri.trim(),
            watchedDate,
          });
        }
      }
      continue;
    }

    // ----------------------------------------------------
    // 3. reviews.csv
    // ----------------------------------------------------
    if (fileName === "reviews.csv" && !isInsideLists && !isInsideLikes) {
      const csvText = entry.getData().toString("utf8");
      const rows = parseCSV(csvText);
      if (rows.length > 1) {
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const nameIdx = header.indexOf("name");
        const yearIdx = header.indexOf("year");
        const uriIdx = header.indexOf("letterboxd uri");
        const ratingIdx = header.indexOf("rating");
        const reviewIdx = header.indexOf("review");
        const dateIdx = header.indexOf("date");
        const watchedDateIdx = header.indexOf("watched date");
        const rewatchIdx = header.indexOf("rewatch");
        const tagsIdx = header.indexOf("tags");

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = row[nameIdx] || "";
          if (!name.trim()) {
            unresolved.push({
              sourceType: "review",
              rawRow: { file: "reviews.csv", row: String(i), raw: row.join(",") },
              reason: "missing_metadata",
              details: `Row ${i} in reviews.csv is missing a film title.`,
            });
            continue;
          }
          const year = row[yearIdx] || "";
          const uri = row[uriIdx] || "";
          const review = (row[reviewIdx] || "").trim();
          const ratingVal = parseRating(row[ratingIdx]);
          const reviewDate = row[dateIdx] || "";
          const rawWatchedDate = watchedDateIdx !== -1 ? row[watchedDateIdx] || "" : "";
          const watchedDate = isValidWatchDate(rawWatchedDate) ? rawWatchedDate : null;
          const isRewatch = rewatchIdx !== -1 && /^yes$/i.test((row[rewatchIdx] || "").trim());
          const tags = tagsIdx !== -1 ? parseTags(row[tagsIdx]) : [];

          const film = getOrCreateFilm(name, year, uri, { isDiaryOrReview: true });
          if (film) {
            film.isWatched = true;
            if (review) {
              film.review = review;
              film.reviewDate = reviewDate;
              film.reviewUri = uri;
            }
            if (ratingVal !== undefined && film.rating === undefined) {
              film.rating = ratingVal;
            }
            if (watchedDate && !film.watchDate) {
              film.watchDate = watchedDate;
            }
          }

          if (review) {
            reviews.push({
              title: name.trim(),
              year: parseYear(year),
              letterboxdUri: uri.trim(),
              reviewDate: isValidWatchDate(reviewDate) ? reviewDate : null,
              watchedDate,
              rating: ratingVal,
              isRewatch,
              review,
              tags,
            });
          }
        }
      }
      continue;
    }

    // ----------------------------------------------------
    // 4. diary.csv
    // ----------------------------------------------------
    if (fileName === "diary.csv" && !isInsideLists && !isInsideLikes) {
      const csvText = entry.getData().toString("utf8");
      const rows = parseCSV(csvText);
      if (rows.length > 1) {
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const nameIdx = header.indexOf("name");
        const yearIdx = header.indexOf("year");
        const uriIdx = header.indexOf("letterboxd uri");
        const ratingIdx = header.indexOf("rating");
        const watchDateIdx = header.indexOf("watched date");
        const dateIdx = header.indexOf("date");
        const rewatchIdx = header.indexOf("rewatch");
        const tagsIdx = header.indexOf("tags");

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = row[nameIdx] || "";
          if (!name.trim()) {
            unresolved.push({
              sourceType: "diary",
              rawRow: { file: "diary.csv", row: String(i), raw: row.join(",") },
              reason: "missing_metadata",
              details: `Row ${i} in diary.csv is missing a film title.`,
            });
            continue;
          }
          const year = row[yearIdx] || "";
          const uri = row[uriIdx] || "";
          const watchDate = row[watchDateIdx] || "";
          const loggedDate = dateIdx !== -1 ? row[dateIdx] || "" : "";
          const ratingVal = parseRating(row[ratingIdx]);
          const isRewatch = rewatchIdx !== -1 && /^yes$/i.test((row[rewatchIdx] || "").trim());
          const tags = tagsIdx !== -1 ? parseTags(row[tagsIdx]) : [];

          const film = getOrCreateFilm(name, year, uri, { isDiaryOrReview: true });
          if (film) {
            film.isWatched = true;
            if (isValidWatchDate(watchDate)) {
              if (!film.watchDate || watchDate > film.watchDate) {
                film.watchDate = watchDate;
              }
            }
            if (ratingVal !== undefined && film.rating === undefined) {
              film.rating = ratingVal;
            }
          }

          // Distinguish multiple genuine viewings deterministically using an occurrence index
          // Stable signature separates film identity and viewing timing from mutable ratings and tags
          const watchedDateValid = isValidWatchDate(watchDate) ? watchDate : null;
          const loggedDateValid = isValidWatchDate(loggedDate) ? loggedDate : null;
          const eventSig = `${canonicalFilmKey({ title: name, year: parseYear(year), letterboxdUri: uri })}::${watchedDateValid || ""}::${loggedDateValid || ""}::${isRewatch ? "1" : "0"}`;
          const currentOcc = (diaryOccurrenceTracker.get(eventSig) || 0) + 1;
          diaryOccurrenceTracker.set(eventSig, currentOcc);

          const sourceEventKey = `${eventSig}::${currentOcc}`;

          diaryEntries.push({
            title: name.trim(),
            year: parseYear(year),
            letterboxdUri: uri.trim(),
            watchedDate: watchedDateValid,
            loggedDate: loggedDateValid,
            isRewatch,
            rating: ratingVal,
            tags,
            occurrenceIndex: currentOcc,
            sourceEventKey,
          });
        }
      }
      continue;
    }

    // ----------------------------------------------------
    // 5. watchlist.csv
    // ----------------------------------------------------
    if (fileName === "watchlist.csv" && !isInsideLists && !isInsideLikes) {
      const csvText = entry.getData().toString("utf8");
      const rows = parseCSV(csvText);
      if (rows.length > 1) {
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const nameIdx = header.indexOf("name");
        const yearIdx = header.indexOf("year");
        const uriIdx = header.indexOf("letterboxd uri");
        const dateIdx = header.indexOf("date");

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = row[nameIdx] || "";
          if (!name.trim()) {
            unresolved.push({
              sourceType: "watchlist",
              rawRow: { file: "watchlist.csv", row: String(i), raw: row.join(",") },
              reason: "missing_metadata",
              details: `Row ${i} in watchlist.csv is missing a film title.`,
            });
            continue;
          }
          const year = row[yearIdx] || "";
          const uri = row[uriIdx] || "";
          const date = row[dateIdx] || "";

          watchlist.push({
            title: name.trim(),
            year: parseYear(year),
            letterboxdUri: uri.trim(),
            dateAdded: isValidWatchDate(date) ? date : null,
          });
        }
      }
      continue;
    }

    // ----------------------------------------------------
    // 6. likes/films.csv or likes.csv
    // ----------------------------------------------------
    if (
      (lowerName.includes("likes/films.csv") || fileName === "likes.csv") &&
      !isInsideLists
    ) {
      const csvText = entry.getData().toString("utf8");
      const rows = parseCSV(csvText);
      if (rows.length > 1) {
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const nameIdx = header.indexOf("name");
        const yearIdx = header.indexOf("year");
        const uriIdx = header.indexOf("letterboxd uri");

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = row[nameIdx] || "";
          if (!name.trim()) continue;
          const year = row[yearIdx] || "";
          const uri = row[uriIdx] || "";

          const film = getOrCreateFilm(name, year, uri);
          if (film) {
            // Liking a film only sets isFavorite. It does NOT automatically imply the film was watched!
            film.isFavorite = true;
          }

          likedFilms.push({
            title: name.trim(),
            year: parseYear(year),
            letterboxdUri: uri.trim(),
          });
        }
      }
      continue;
    }

    // ----------------------------------------------------
    // 7. External social activity: likes/reviews.csv & likes/lists.csv
    // ----------------------------------------------------
    if (lowerName.includes("likes/reviews.csv")) {
      const csvText = entry.getData().toString("utf8");
      const rows = parseCSV(csvText);
      const rowCount = Math.max(rows.length - 1, 0);
      otherLikesCount += rowCount;
      unsupportedItems.push({
        filename: entryName,
        category: "external_social_activity",
        details: `Found ${rowCount} likes on other users' Letterboxd reviews. These cannot map to Aubrey records without matching accounts.`,
        count: rowCount,
      });
      continue;
    }

    if (lowerName.includes("likes/lists.csv")) {
      const csvText = entry.getData().toString("utf8");
      const rows = parseCSV(csvText);
      const rowCount = Math.max(rows.length - 1, 0);
      otherLikesCount += rowCount;
      unsupportedItems.push({
        filename: entryName,
        category: "external_social_activity",
        details: `Found ${rowCount} likes on other users' Letterboxd lists. These cannot map to Aubrey collections without matching accounts.`,
        count: rowCount,
      });
      continue;
    }

    // ----------------------------------------------------
    // 8. Unsupported optional Letterboxd files (comments, orphans, profile)
    // ----------------------------------------------------
    if (fileName === "comments.csv") {
      const csvText = entry.getData().toString("utf8");
      const rowCount = Math.max(parseCSV(csvText).length - 1, 0);
      unsupportedItems.push({
        filename: entryName,
        category: "unsupported_file",
        details: `Found ${rowCount} Letterboxd comments. Aubrey comments are scoped to rankings and reviews.`,
        count: rowCount,
      });
      continue;
    }

    if (fileName === "orphans.csv") {
      const csvText = entry.getData().toString("utf8");
      const rowCount = Math.max(parseCSV(csvText).length - 1, 0);
      unsupportedItems.push({
        filename: entryName,
        category: "unsupported_file",
        details: `Found ${rowCount} orphan records removed from Letterboxd catalog.`,
        count: rowCount,
      });
      continue;
    }

    if (fileName === "profile.csv") {
      unsupportedItems.push({
        filename: entryName,
        category: "unsupported_file",
        details: "Letterboxd profile export skipped; Aubrey profile settings are managed in Account.",
      });
      continue;
    }

    // ----------------------------------------------------
    // 9. lists/*.csv (custom lists)
    // ----------------------------------------------------
    if (isInsideLists && fileName.endsWith(".csv")) {
      const csvText = entry.getData().toString("utf8");
      const rows = parseCSV(csvText);
      if (rows.length >= 2) {
        let listTitle = cleanFilenameTitle(fileName);
        let listDesc = "";
        let listTags: string[] = [];
        let listUrl = "";
        let startRowIdx = 1;

        // Check if Row 0 is the metadata header: Date,Name,Tags,URL,Description
        const row0 = rows[0].map((h) => h.trim().toLowerCase());
        if (
          row0.includes("date") &&
          row0.includes("name") &&
          row0.includes("url") &&
          row0.includes("description")
        ) {
          const metaRow = rows[1];
          const nameIdx = row0.indexOf("name");
          const tagsIdx = row0.indexOf("tags");
          const urlIdx = row0.indexOf("url");
          const descIdx = row0.indexOf("description");

          if (metaRow[nameIdx]?.trim()) {
            listTitle = metaRow[nameIdx].trim();
          }
          if (tagsIdx !== -1 && metaRow[tagsIdx]) {
            listTags = parseTags(metaRow[tagsIdx]);
          }
          if (urlIdx !== -1 && metaRow[urlIdx]?.trim()) {
            listUrl = metaRow[urlIdx].trim();
          }
          if (descIdx !== -1 && metaRow[descIdx]?.trim()) {
            listDesc = metaRow[descIdx].trim();
          }

          startRowIdx = 2;
          for (let r = 2; r < rows.length; r++) {
            const rHeader = rows[r].map((h) => h.trim().toLowerCase());
            if (rHeader.includes("name") || rHeader.includes("position")) {
              startRowIdx = r + 1;
              break;
            }
          }
        }

        const entryHeaderRow = rows[startRowIdx - 1]?.map((h) => h.trim().toLowerCase()) || [];
        const posIdx = entryHeaderRow.indexOf("position");
        const nameIdx = entryHeaderRow.indexOf("name");
        const yearIdx = entryHeaderRow.indexOf("year");
        const uriIdx =
          entryHeaderRow.indexOf("letterboxd uri") !== -1
            ? entryHeaderRow.indexOf("letterboxd uri")
            : entryHeaderRow.indexOf("url");
        const descIdx =
          entryHeaderRow.indexOf("description") !== -1
            ? entryHeaderRow.indexOf("description")
            : entryHeaderRow.indexOf("notes");

        const entries: ParsedListEntry[] = [];
        for (let r = startRowIdx; r < rows.length; r++) {
          const row = rows[r];
          const name = (nameIdx !== -1 ? row[nameIdx] : row[1]) || "";
          if (!name.trim()) continue;

          const year = yearIdx !== -1 ? row[yearIdx] : "";
          const uri = uriIdx !== -1 ? row[uriIdx] : "";
          const notes = descIdx !== -1 ? (row[descIdx] || "").trim() : undefined;
          const posVal = posIdx !== -1 ? parseInt(row[posIdx], 10) : NaN;
          const position = Number.isFinite(posVal) && posVal > 0 ? posVal : entries.length + 1;

          entries.push({
            position,
            title: name.trim(),
            year: parseYear(year),
            letterboxdUri: (uri || "").trim(),
            notes: notes || undefined,
          });
        }

        if (listTitle) {
          customLists.push({
            filename: fileName,
            title: listTitle,
            description: listDesc || undefined,
            tags: listTags,
            url: listUrl || undefined,
            entries,
          });
        }
      }
      continue;
    }

    // Any other unrecognized .csv file
    if (fileName.endsWith(".csv")) {
      unsupportedItems.push({
        filename: entryName,
        category: "unsupported_file",
        details: `Unrecognized archive file "${entryName}".`,
      });
    }
  }

  const films = Array.from(filmMap.values());

  return {
    totalUniqueFilms: films.length,
    totalRatings: films.filter((film) => film.rating !== undefined).length,
    totalReviews: reviews.length,
    totalWatched: films.filter((film) => film.isWatched).length,
    totalDiaryEntries: diaryEntries.length,
    totalWatchlistItems: watchlist.length,
    totalCustomLists: customLists.length,
    totalCustomListEntries: customLists.reduce((sum, l) => sum + l.entries.length, 0),
    totalLikes: likedFilms.length + otherLikesCount,
    films,
    diaryEntries,
    reviews,
    watchlist,
    ratingEvents,
    watchedEvents,
    customLists,
    likedFilms,
    unresolved,
    unsupportedItems,
  };
}
