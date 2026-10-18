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

  const filmMap = new Map<string, ParsedLetterboxdFilm>();

  const getOrCreateFilm = (title: string, yearStr: string, uri: string): ParsedLetterboxdFilm => {
    const year = yearStr ? parseInt(yearStr.trim(), 10) || null : null;
    const cleanTitle = title.trim();
    const key = uri.trim() || `${cleanTitle.toLowerCase()}::${year || ""}`;

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

  let totalRatings = 0;
  let totalReviews = 0;
  let totalWatched = 0;

  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;
    const fileName = entry.entryName.toLowerCase();

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
          if (!isNaN(ratingVal) && ratingVal > 0) {
            film.rating = ratingVal;
            totalRatings++;
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
          totalWatched++;
          if (date && !film.watchDate) {
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
            totalReviews++;
          }
          if (!isNaN(ratingVal) && ratingVal > 0 && film.rating === undefined) {
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
          if (watchDate && !film.watchDate) {
            film.watchDate = watchDate;
          }
          if (!isNaN(ratingVal) && ratingVal > 0 && film.rating === undefined) {
            film.rating = ratingVal;
          }
        }
      }
    }
  }

  const films = Array.from(filmMap.values());

  return {
    totalUniqueFilms: films.length,
    totalRatings,
    totalReviews,
    totalWatched,
    films,
  };
}
