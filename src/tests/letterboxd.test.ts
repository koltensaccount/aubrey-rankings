import { describe, it } from "node:test";
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { parseCSV, parseLetterboxdZip } from "../lib/letterboxd";

describe("Letterboxd ZIP & CSV Importer", () => {
  it("correctly parses CSV with embedded quotes, commas, and linebreaks", () => {
    const rawCSV = `Date,Name,Year,Letterboxd URI,Rating,Review
2026-01-15,"Zodiac",2007,https://boxd.it/20uA,5.0,"A meticulous, atmospheric masterpiece about obsession."
2026-02-10,"Everything Everywhere All at Once",2022,https://boxd.it/iVqK,4.5,"Wild, chaotic, and emotionally devastating."
`;
    const rows = parseCSV(rawCSV);
    assert.equal(rows.length, 3);
    assert.equal(rows[1][1], "Zodiac");
    assert.equal(rows[1][4], "5.0");
    assert.equal(rows[1][5], "A meticulous, atmospheric masterpiece about obsession.");
    assert.equal(rows[2][1], "Everything Everywhere All at Once");
  });

  it("extracts and merges official Letterboxd ZIP archive contents", () => {
    const zip = new AdmZip();

    const ratingsContent = `Date,Name,Year,Letterboxd URI,Rating
2026-03-01,Children of Men,2006,https://boxd.it/29G4,5.0
2026-03-02,Blade Runner 2049,2017,https://boxd.it/4U5M,4.5
2026-03-03,Arrival,2016,https://boxd.it/b7P4,4.0
`;
    const watchedContent = `Date,Name,Year,Letterboxd URI
2026-03-01,Children of Men,2006,https://boxd.it/29G4
2026-03-02,Blade Runner 2049,2017,https://boxd.it/4U5M
2026-03-04,Interstellar,2014,https://boxd.it/70Q6
`;
    const reviewsContent = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review
2026-03-01,Children of Men,2006,https://boxd.it/29G4,5.0,No,"Cuarón's relentless continuous shots define cinematic immersion."
`;

    zip.addFile("ratings.csv", Buffer.from(ratingsContent, "utf8"));
    zip.addFile("watched.csv", Buffer.from(watchedContent, "utf8"));
    zip.addFile("reviews.csv", Buffer.from(reviewsContent, "utf8"));

    const zipBuffer = zip.toBuffer();
    const summary = parseLetterboxdZip(zipBuffer);

    assert.equal(summary.totalUniqueFilms, 4); // Children of Men, Blade Runner 2049, Arrival, Interstellar
    assert.equal(summary.totalRatings, 3);
    assert.equal(summary.totalReviews, 1);
    assert.equal(summary.totalWatched, 4); // Rated and reviewed films are watched too.

    const childrenOfMen = summary.films.find((f) => f.title === "Children of Men");
    assert.ok(childrenOfMen);
    assert.equal(childrenOfMen?.rating, 5.0);
    assert.equal(childrenOfMen?.review, "Cuarón's relentless continuous shots define cinematic immersion.");
    assert.equal(childrenOfMen?.isWatched, true);

    const interstellar = summary.films.find((f) => f.title === "Interstellar");
    assert.ok(interstellar);
    assert.equal(interstellar?.isWatched, true);
    assert.equal(interstellar?.rating, undefined); // in watched but not rated
  });

  it("handles empty or minimal exports gracefully", () => {
    const zip = new AdmZip();
    zip.addFile("ratings.csv", Buffer.from("Date,Name,Year,Letterboxd URI,Rating\n", "utf8"));

    const zipBuffer = zip.toBuffer();
    const summary = parseLetterboxdZip(zipBuffer);

    assert.equal(summary.totalUniqueFilms, 0);
    assert.equal(summary.totalRatings, 0);
    assert.equal(summary.totalReviews, 0);
  });

  it("correctly aggregates duplicate imports without creating duplicate film entries", () => {
    const zip = new AdmZip();
    // Simulate multiple entries in diary and ratings for same film
    const diaryContent = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2026-01-01,Heat,1995,https://boxd.it/1Y6W,5.0,Yes,"Mann",2026-01-01
2026-04-01,Heat,1995,https://boxd.it/1Y6W,5.0,Yes,"Mann, Rewatch",2026-04-01
`;
    const ratingsContent = `Date,Name,Year,Letterboxd URI,Rating
2026-01-01,Heat,1995,https://boxd.it/1Y6W,5.0
`;
    zip.addFile("diary.csv", Buffer.from(diaryContent, "utf8"));
    zip.addFile("ratings.csv", Buffer.from(ratingsContent, "utf8"));

    const summary = parseLetterboxdZip(zip.toBuffer());
    assert.equal(summary.totalUniqueFilms, 1);
    assert.equal(summary.films[0].title, "Heat");
    assert.equal(summary.films[0].year, 1995);
    assert.equal(summary.films[0].rating, 5.0);
  });
});

describe("Letterboxd archive edge cases", () => {
  it("merges diary review URLs by film/year while keeping remakes separate", () => {
    const zip = new AdmZip();
    zip.addFile("ratings.csv", Buffer.from("Name,Year,Letterboxd URI,Rating\nSolaris,1972,https://letterboxd.com/film/solaris/,5\nSolaris,2002,https://letterboxd.com/film/solaris-2002/,4\n"));
    zip.addFile("diary.csv", Buffer.from("Name,Year,Letterboxd URI,Watched Date\nSolaris,1972,https://letterboxd.com/user/film/solaris/1/,2026-02-30\nSolaris,1972,https://letterboxd.com/user/film/solaris/2/,2026-02-28\n"));
    const summary = parseLetterboxdZip(zip.toBuffer());
    assert.equal(summary.totalUniqueFilms, 2);
    assert.equal(summary.films.find(f => f.year === 1972)?.watchDate, "2026-02-28");
  });
  it("handles BOM headers, rejects invalid ratings, and ignores nested custom lists", () => {
    const zip = new AdmZip();
    zip.addFile("ratings.csv", Buffer.from("\uFEFFName,Year,Letterboxd URI,Rating\nHeat,1995,heat,Infinity\nArrival,2016,arrival,6\nDune,2021,dune,4.5\n"));
    zip.addFile("lists/ratings.csv", Buffer.from("Name,Year,Rating\nNot a rating,2000,5\n"));
    const summary = parseLetterboxdZip(zip.toBuffer());
    assert.equal(summary.totalUniqueFilms, 3); assert.equal(summary.totalRatings, 1);
    assert.equal(summary.films.find(f => f.title === "Heat")?.rating, undefined);
  });
  it("bounds expanded archive size before decompressing", () => {
    const zip = new AdmZip(); zip.addFile("ratings.csv", Buffer.from("Name\nHeat\n"));
    const data = zip.toBuffer();
    const central = data.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
    data.writeUInt32LE(101 * 1024 * 1024, central + 24);
    assert.throws(() => parseLetterboxdZip(data), /permitted size/);
  });
});

it("rejects truncated quoted CSV instead of partially importing it", () => {
  assert.throws(() => parseCSV('Name,Review\nHeat,"unfinished'), /Unterminated/);
});
