"use client";

import { useState } from "react";
import {
  Film,
  ExternalLink,
  UploadCloud,
  FileSpreadsheet,
  Download,
} from "lucide-react";

export function DataTab() {
  const [lbFile, setLbFile] = useState<File | null>(null);
  const [lbPreviewLoading, setLbPreviewLoading] = useState(false);
  const [lbPreviewData, setLbPreviewData] = useState<any | null>(null);
  const [lbImporting, setLbImporting] = useState(false);
  const [lbSuccessMsg, setLbSuccessMsg] = useState<string | null>(null);
  const [lbErrorMsg, setLbErrorMsg] = useState<string | null>(null);

  const handleLbFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLbFile(file);
    setLbErrorMsg(null);
    setLbSuccessMsg(null);
    setLbPreviewLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/letterboxd/preview", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to parse Letterboxd ZIP archive.");
      }

      setLbPreviewData(json);
    } catch (err: any) {
      setLbErrorMsg(err?.message || "Failed to preview Letterboxd archive.");
      setLbPreviewData(null);
    } finally {
      setLbPreviewLoading(false);
    }
  };

  const handleLbExecuteImport = async () => {
    if (!lbFile) return;

    setLbImporting(true);
    setLbErrorMsg(null);
    setLbSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", lbFile);

      const res = await fetch("/api/import/letterboxd/execute", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to execute import.");
      }

      setLbSuccessMsg(json.message || "Import completed successfully!");
      setLbPreviewData(null);
      setLbFile(null);
    } catch (err: any) {
      setLbErrorMsg(err?.message || "Import failed.");
    } finally {
      setLbImporting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* SECTION 1: LETTERBOXD ZIP IMPORTER */}
      <div className="p-6 rounded-card border border-border-card bg-card space-y-5 shadow-card">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-button bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Film size={20} />
            </div>
            <div>
              <h3 className="font-display text-xl uppercase font-bold text-foreground">
                Import from Letterboxd
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Repeatable, non-destructive import of your watched films, star ratings, diary dates, and reviews.
              </p>
            </div>
          </div>
          <a
            href="https://letterboxd.com/settings/data/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline"
          >
            <span>Export Page</span>
            <ExternalLink size={12} />
          </a>
        </div>

        {lbErrorMsg && (
          <div className="p-3 rounded-card bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {lbErrorMsg}
          </div>
        )}

        {lbSuccessMsg && (
          <div className="p-3 rounded-card bg-primary/10 border border-primary/30 text-primary text-xs">
            {lbSuccessMsg}
          </div>
        )}

        {/* Upload Area */}
        {!lbPreviewData ? (
          <div className="p-6 rounded-card border border-dashed border-border bg-surface text-center space-y-3">
            <UploadCloud size={28} className="mx-auto text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">
                Upload your Letterboxd export ZIP
              </p>
              <p className="text-[11px] text-muted-foreground">
                Download your data ZIP from Letterboxd Settings → Export, then drop it here.
              </p>
            </div>
            <input
              type="file"
              accept=".zip"
              onChange={handleLbFileChange}
              disabled={lbPreviewLoading}
              className="block w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-button file:border file:border-border file:text-xs file:font-semibold file:bg-surface-elevated file:text-foreground hover:file:bg-muted file:cursor-pointer cursor-pointer"
            />
            {lbPreviewLoading && (
              <p className="text-xs text-primary animate-pulse">
                Analyzing Letterboxd archive contents and matching records...
              </p>
            )}
          </div>
        ) : (
          /* Preview Area */
          <div className="space-y-4 rounded-card border border-border bg-surface p-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h4 className="font-display text-base uppercase font-bold text-foreground">
                  Archive Preview: {lbPreviewData.totalFilms} Films
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Found {lbPreviewData.totalRatings} star ratings and {lbPreviewData.totalReviews} written reviews.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLbPreviewData(null);
                  setLbFile(null);
                }}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-card bg-card border border-border">
                <div className="font-display text-xl font-bold text-primary">
                  {lbPreviewData.newCount}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  New to Library
                </div>
              </div>
              <div className="p-3 rounded-card bg-card border border-border">
                <div className="font-display text-xl font-bold text-foreground">
                  {lbPreviewData.existingCount}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Existing / Updated
                </div>
              </div>
              <div className="p-3 rounded-card bg-card border border-border col-span-2 sm:col-span-1">
                <div className="font-display text-xl font-bold text-foreground">
                  {lbPreviewData.totalReviews}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Reviews to Sync
                </div>
              </div>
            </div>

            {/* Sample items */}
            {lbPreviewData.sampleFilms?.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Sample Archive Items:
                </div>
                <div className="space-y-1">
                  {lbPreviewData.sampleFilms.slice(0, 5).map((f: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-card bg-card border border-border"
                    >
                      <span className="text-foreground font-medium">
                        {f.title} {f.year ? `(${f.year})` : ""}
                      </span>
                      <span className="text-primary font-mono text-[11px]">
                        {f.rating ? `★ ${f.rating.toFixed(1)}/5` : "Watched"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleLbExecuteImport}
                disabled={lbImporting}
                className="px-5 py-2.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-display text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {lbImporting ? "Importing Archive..." : "Confirm & Sync into Library"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: AUBREY'S BLACK MIRROR SPREADSHEET IMPORTER */}
      <div className="p-6 rounded-card border border-border-card bg-card space-y-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-button bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <h3 className="font-display text-xl uppercase font-bold text-foreground">
              Aubrey&apos;s Black Mirror Importer
            </h3>
            <p className="text-xs text-muted-foreground">
              Import ratings and weights directly from Aubrey&apos;s Spreadsheet format.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-card border border-dashed border-border bg-surface text-center space-y-3">
          <p className="text-xs text-muted-foreground">
            Paste CSV or JSON export from the original spreadsheet:
          </p>
          <textarea
            rows={4}
            placeholder="Episode, Season, Music, Acting, Cinematography, Writing, Vibes, Notes..."
            className="w-full rounded-input border border-border-input bg-card p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono resize-none"
          />
          <div className="flex justify-end">
            <button className="px-4 py-2 rounded-button bg-surface-elevated hover:bg-muted text-foreground border border-border text-xs font-semibold cursor-pointer">
              Import Spreadsheet Ratings
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: EXPORT */}
      <div className="p-6 rounded-card border border-border-card bg-card space-y-3 shadow-card">
        <h3 className="font-display text-xl uppercase font-bold text-foreground">
          Export Your Data
        </h3>
        <p className="text-xs text-muted-foreground">
          Download your complete library, rating histories, and reviews in JSON format.
        </p>
        <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-surface-elevated hover:bg-muted text-foreground border border-border text-xs font-semibold transition-colors cursor-pointer">
          <Download size={14} />
          <span>Export JSON</span>
        </button>
      </div>
    </div>
  );
}
