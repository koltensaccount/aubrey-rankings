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
  customLists: ParsedCustomList[];
  likedFilms: Array<{ title: string; year: number | null; letterboxdUri: string }>;
  unresolved: UnresolvedSourceItem[];
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
  const diaryEntries: ParsedDiaryEntry[] = [];
  const reviews: ParsedReview[] = [];
  const watchlist: ParsedWatchlistItem[] = [];
  const customLists: ParsedCustomList[] = [];
  const likedFilms: Array<{ title: string; year: number | null; letterboxdUri: string }> = [];
  const unresolved: UnresolvedSourceItem[] = [];
  let otherLikesCount = 0;

  const getOrCreateFilm = (
    title: string,
    yearStr: string,
    uri: string,
  ): ParsedLetterboxdFilm | null => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return null;

    const year = parseYear(yearStr);
    const key = `${cleanTitle.toLowerCase()}::${year ?? ""}`;

    if (!filmMap.has(key)) {
      filmMap.set(key, {
        title: cleanTitle,
        year,
        letterboxdUri: uri.trim(),
        isWatched: false,
        isFavorite: false,
      });
    }
    const film = filmMap.get(key)!;
    if (!film.letterboxdUri && uri.trim()) {
      film.letterboxdUri = uri.trim();
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

    // ----------------------------------------------------
    // 1. ratings.csv
    // ----------------------------------------------------
    if (fileName === "ratings.csv" && !isInsideLists) {
      const csvText = entry.getData().toString("utf8");
      const rows = parseCSV(csvText);
      if (rows.length > 1) {
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const nameIdx = header.indexOf("name");
        const yearIdx = header.indexOf("year");
        const uriIdx = header.indexOf("letterboxd uri");
        const ratingIdx = header.indexOf("rating");

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = row[nameIdx] || "";
          if (!name.trim()) {
            unresolved.push({
              sourceType: "film",
              rawRow: { raw: row.join(",") },
              reason: "missing_metadata",
              details: "Missing film title in ratings.csv",
            });
            continue;
          }
          const year = row[yearIdx] || "";
          const uri = row[uriIdx] || "";
          const ratingVal = parseRating(row[ratingIdx]);

          const film = getOrCreateFilm(name, year, uri);
          if (film) {
            film.isWatched = true;
            if (ratingVal !== undefined) {
              film.rating = ratingVal;
            }
          }
        }
      }
      continue;
    }

    // ----------------------------------------------------
    // 2. watched.csv
    // ----------------------------------------------------
    if (fileName === "watched.csv" && !isInsideLists) {
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
          if (!name.trim()) continue;
          const year = row[yearIdx] || "";
          const uri = row[uriIdx] || "";
          const date = row[dateIdx] || "";

          const film = getOrCreateFilm(name, year, uri);
          if (film) {
            film.isWatched = true;
            if (isValidWatchDate(date) && !film.watchDate) {
              film.watchDate = date;
            }
          }
        }
      }
      continue;
    }

    // ----------------------------------------------------
    // 3. reviews.csv
    // ----------------------------------------------------
    if (fileName === "reviews.csv" && !isInsideLists) {
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
          if (!name.trim()) continue;
          const year = row[yearIdx] || "";
          const uri = row[uriIdx] || "";
          const review = (row[reviewIdx] || "").trim();
          const ratingVal = parseRating(row[ratingIdx]);
          const reviewDate = row[dateIdx] || "";
          const rawWatchedDate = watchedDateIdx !== -1 ? row[watchedDateIdx] || "" : "";
          const watchedDate = isValidWatchDate(rawWatchedDate) ? rawWatchedDate : null;
          const isRewatch = rewatchIdx !== -1 && /^yes$/i.test((row[rewatchIdx] || "").trim());
          const tags = tagsIdx !== -1 ? parseTags(row[tagsIdx]) : [];

          const film = getOrCreateFilm(name, year, uri);
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
    if (fileName === "diary.csv" && !isInsideLists) {
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
          if (!name.trim()) continue;
          const year = row[yearIdx] || "";
          const uri = row[uriIdx] || "";
          const watchDate = row[watchDateIdx] || "";
          const loggedDate = dateIdx !== -1 ? row[dateIdx] || "" : "";
          const ratingVal = parseRating(row[ratingIdx]);
          const isRewatch = rewatchIdx !== -1 && /^yes$/i.test((row[rewatchIdx] || "").trim());
          const tags = tagsIdx !== -1 ? parseTags(row[tagsIdx]) : [];

          const film = getOrCreateFilm(name, year, uri);
          if (film) {
            film.isWatched = true;
            if (isValidWatchDate(watchDate)) {
              // Always keep the latest watch date if multiple viewings exist
              if (!film.watchDate || watchDate > film.watchDate) {
                film.watchDate = watchDate;
              }
            }
            if (ratingVal !== undefined && film.rating === undefined) {
              film.rating = ratingVal;
            }
          }

          diaryEntries.push({
            title: name.trim(),
            year: parseYear(year),
            letterboxdUri: uri.trim(),
            watchedDate: isValidWatchDate(watchDate) ? watchDate : null,
            loggedDate: isValidWatchDate(loggedDate) ? loggedDate : null,
            isRewatch,
            rating: ratingVal,
            tags,
          });
        }
      }
      continue;
    }

    // ----------------------------------------------------
    // 5. watchlist.csv
    // ----------------------------------------------------
    if (fileName === "watchlist.csv" && !isInsideLists) {
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
          if (!name.trim()) continue;
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
            film.isFavorite = true;
            film.isWatched = true;
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

    // Other likes (reviews/lists) counted for summary
    if (lowerName.includes("likes/reviews.csv") || lowerName.includes("likes/lists.csv")) {
      const csvText = entry.getData().toString("utf8");
      const rows = parseCSV(csvText);
      if (rows.length > 1) {
        otherLikesCount += rows.length - 1;
      }
      continue;
    }

    // ----------------------------------------------------
    // 7. lists/*.csv (custom lists)
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

          // Entries start after the second header row (usually row 3 or 4)
          startRowIdx = 2;
          for (let r = 2; r < rows.length; r++) {
            const rHeader = rows[r].map((h) => h.trim().toLowerCase());
            if (rHeader.includes("name") || rHeader.includes("position")) {
              startRowIdx = r + 1;
              break;
            }
          }
        }

        // Detect entry columns from the header row right before entries
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

        if (entries.length > 0) {
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
    customLists,
    likedFilms,
    unresolved,
  };
}
