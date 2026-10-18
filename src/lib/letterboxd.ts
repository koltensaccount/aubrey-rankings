import AdmZip from "adm-zip";

export interface ParsedLetterboxdFilm {
  title: string;
  year: number | null;
  letterboxdUri: string;
  rating?: number; // 0.5 to 5.0
  review?: string;
  watchDate?: string;
  isWatched: boolean;
}

export interface LetterboxdExportSummary {
  totalUniqueFilms: number;
  totalRatings: number;
  totalReviews: number;
  totalWatched: number;
  films: ParsedLetterboxdFilm[];
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

/**
 * Parses an official Letterboxd ZIP export archive buffer
 */
export function parseLetterboxdZip(zipBuffer: Buffer): LetterboxdExportSummary {
  const zip = new AdmZip(zipBuffer);
  const zipEntries = zip.getEntries();
  if (zipEntries.length > 10000 || zipEntries.reduce((size, entry) => size + entry.header.size, 0) > 100 * 1024 * 1024) {
    throw new Error("Expanded archive exceeds permitted size");
  }


  const filmMap = new Map<string, ParsedLetterboxdFilm>();

  const getOrCreateFilm = (title: string, yearStr: string, uri: string): ParsedLetterboxdFilm => {
    const year = /^\d{4}$/.test(yearStr.trim()) ? Number(yearStr.trim()) : null;
    const cleanTitle = title.trim();
    const key = `${cleanTitle.toLowerCase()}::${year || ""}`;

    if (!filmMap.has(key)) {
      filmMap.set(key, {
        title: cleanTitle,
        year,
        letterboxdUri: uri.trim(),
        isWatched: false,
      });
    }
    return filmMap.get(key)!;
  };


  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;
    const pathParts = entry.entryName.toLowerCase().split("/");
    const fileName = pathParts.at(-1) ?? "";
    if (pathParts.includes("lists") || !["ratings.csv", "watched.csv", "reviews.csv", "diary.csv"].includes(fileName)) continue;
    if (entry.header.size > 50 * 1024 * 1024) throw new Error("CSV exceeds permitted size");

    // 1. Process ratings.csv
    if (fileName.endsWith("ratings.csv")) {
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
          if (!name.trim()) continue;
          const year = row[yearIdx] || "";
          const uri = row[uriIdx] || "";
          const ratingVal = parseFloat(row[ratingIdx] || "");

          const film = getOrCreateFilm(name, year, uri);
          film.isWatched = true;
          if (Number.isFinite(ratingVal) && ratingVal >= 0.5 && ratingVal <= 5 && Number.isInteger(ratingVal * 2)) {
            film.rating = ratingVal;
          }
        }
      }
    }

    // 2. Process watched.csv
    if (fileName.endsWith("watched.csv")) {
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
          film.isWatched = true;
          if (isValidWatchDate(date) && !film.watchDate) {
            film.watchDate = date;
          }
        }
      }
    }

    // 3. Process reviews.csv
    if (fileName.endsWith("reviews.csv")) {
      const csvText = entry.getData().toString("utf8");
      const rows = parseCSV(csvText);
      if (rows.length > 1) {
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const nameIdx = header.indexOf("name");
        const yearIdx = header.indexOf("year");
        const uriIdx = header.indexOf("letterboxd uri");
        const ratingIdx = header.indexOf("rating");
        const reviewIdx = header.indexOf("review");

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = row[nameIdx] || "";
          if (!name.trim()) continue;
          const year = row[yearIdx] || "";
          const uri = row[uriIdx] || "";
          const review = row[reviewIdx] || "";
          const ratingVal = parseFloat(row[ratingIdx] || "");

          const film = getOrCreateFilm(name, year, uri);
          film.isWatched = true;
          if (review.trim()) {
            film.review = review.trim();
          }
          if (Number.isFinite(ratingVal) && ratingVal >= 0.5 && ratingVal <= 5 && Number.isInteger(ratingVal * 2) && film.rating === undefined) {
            film.rating = ratingVal;
          }
        }
      }
    }

    // 4. Process diary.csv
    if (fileName.endsWith("diary.csv")) {
      const csvText = entry.getData().toString("utf8");
      const rows = parseCSV(csvText);
      if (rows.length > 1) {
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const nameIdx = header.indexOf("name");
        const yearIdx = header.indexOf("year");
        const uriIdx = header.indexOf("letterboxd uri");
        const ratingIdx = header.indexOf("rating");
        const watchDateIdx = header.indexOf("watched date");

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = row[nameIdx] || "";
          if (!name.trim()) continue;
          const year = row[yearIdx] || "";
          const uri = row[uriIdx] || "";
          const watchDate = row[watchDateIdx] || "";
          const ratingVal = parseFloat(row[ratingIdx] || "");

          const film = getOrCreateFilm(name, year, uri);
          film.isWatched = true;
          if (isValidWatchDate(watchDate) && !film.watchDate) {
            film.watchDate = watchDate;
          }
          if (Number.isFinite(ratingVal) && ratingVal >= 0.5 && ratingVal <= 5 && Number.isInteger(ratingVal * 2) && film.rating === undefined) {
            film.rating = ratingVal;
          }
        }
      }
    }
  }

  const films = Array.from(filmMap.values());

  return {
    totalUniqueFilms: films.length,
    totalRatings: films.filter(film => film.rating !== undefined).length,
    totalReviews: films.filter(film => !!film.review).length,
    totalWatched: films.filter(film => film.isWatched).length,
    films,
  };
}

function isValidWatchDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
