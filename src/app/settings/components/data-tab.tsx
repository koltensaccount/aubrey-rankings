"use client";

import { useState } from "react";
import {
  Film,
  ExternalLink,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  Bookmark,
  ListOrdered,
  Heart,
  Loader2,
} from "lucide-react";

export function DataTab() {
  const [lbFile, setLbFile] = useState<File | null>(null);
  const [lbPreviewLoading, setLbPreviewLoading] = useState(false);
  const [lbPreviewData, setLbPreviewData] = useState<any | null>(null);
  const [lbImporting, setLbImporting] = useState(false);
  const [lbReconciliation, setLbReconciliation] = useState<any | null>(null);
  const [lbSuccessMsg, setLbSuccessMsg] = useState<string | null>(null);
  const [lbErrorMsg, setLbErrorMsg] = useState<string | null>(null);

  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleLbFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLbFile(file);
    setLbErrorMsg(null);
    setLbSuccessMsg(null);
    setLbReconciliation(null);
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
      setLbReconciliation(json.reconciliation || json);
      setLbPreviewData(null);
      setLbFile(null);
    } catch (err: any) {
      setLbErrorMsg(err?.message || "Import failed.");
    } finally {
      setLbImporting(false);
    }
  };

  const handleExportJson = async () => {
    setExportLoading(true);
    setExportError(null);

    try {
      const res = await fetch("/api/data/export");
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Failed to export data.");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition");
      let filename = "aubrey-data-export.json";
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err?.message || "Export download failed.");
    } finally {
      setExportLoading(false);
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
                Migration of viewing diary, watch history, ratings, private reviews, watchlists, and custom lists.
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
          <div className="p-3 rounded-card bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{lbErrorMsg}</span>
          </div>
        )}

        {lbSuccessMsg && (
          <div className="p-3 rounded-card bg-primary/10 border border-primary/30 text-primary text-xs flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{lbSuccessMsg}</span>
          </div>
        )}

        {/* Post-Import Reconciliation Report */}
        {lbReconciliation && (
          <div className="p-5 rounded-card border border-primary/30 bg-surface space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="flex items-center gap-2 text-primary font-display font-bold text-sm uppercase">
                <CheckCircle2 size={16} />
                <span>Reconciliation Report</span>
              </div>
              <button
                type="button"
                onClick={() => setLbReconciliation(null)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Dismiss
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
              <div className="p-2.5 rounded-card bg-card border border-border">
                <div className="font-display text-lg font-bold text-foreground">
                  {lbReconciliation.films?.new ?? 0}
                </div>
                <div className="text-[10px] uppercase text-muted-foreground">New Titles</div>
              </div>
              <div className="p-2.5 rounded-card bg-card border border-border">
                <div className="font-display text-lg font-bold text-foreground">
                  {lbReconciliation.films?.updated ?? 0}
                </div>
                <div className="text-[10px] uppercase text-muted-foreground">Updated</div>
              </div>
              <div className="p-2.5 rounded-card bg-card border border-border">
                <div className="font-display text-lg font-bold text-primary">
                  {lbReconciliation.diary?.created ?? 0}
                </div>
                <div className="text-[10px] uppercase text-muted-foreground">Diary Logs</div>
              </div>
              <div className="p-2.5 rounded-card bg-card border border-border">
                <div className="font-display text-lg font-bold text-foreground">
                  {lbReconciliation.reviews?.created ?? 0}
                </div>
                <div className="text-[10px] uppercase text-muted-foreground">Private Reviews</div>
              </div>
            </div>

            <div className="p-3 rounded-card bg-card border border-border text-[11px] text-muted-foreground space-y-1.5">
              <p>
                • <strong>Privacy Preserved:</strong> All imported reviews and custom lists are stored with <em>Private</em> visibility. They are not visible to other users until deliberately shared.
              </p>
              <p>
                • <strong>Aubrey Data Integrity:</strong> Any pre-existing Aubrey custom rubrics, weights, or scores were preserved and not overwritten.
              </p>
              {(lbReconciliation.unresolvedCount ?? lbReconciliation.unresolved?.length ?? 0) > 0 && (
                <p className="text-muted-foreground">
                  • <strong>Quarantined Records:</strong> {lbReconciliation.unresolvedCount ?? lbReconciliation.unresolved?.length} entries with missing titles or ambiguous matches were quarantined in your unresolved import log for safe review.
                </p>
              )}
              {lbReconciliation.unsupportedItems?.length > 0 && (
                <div className="pt-1 space-y-0.5 border-t border-border mt-1">
                  <p className="font-semibold text-foreground">
                    External / Unsupported Content (Reported, not imported into library):
                  </p>
                  {lbReconciliation.unsupportedItems.map((item: any, idx: number) => (
                    <p key={idx}>
                      • <strong>{item.filename}:</strong> {item.details}
                    </p>
                  ))}
                </div>
              )}
            </div>
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
                Download your data ZIP from Letterboxd Settings → Export, then select it here.
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
              <p className="text-xs text-primary animate-pulse flex items-center justify-center gap-1.5 pt-1">
                <Loader2 size={13} className="animate-spin" />
                <span>Analyzing Letterboxd archive contents, diary history, and custom lists...</span>
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
                  Found {lbPreviewData.totalWatched} watched films, {lbPreviewData.totalRatings} star ratings, {lbPreviewData.totalReviews} written reviews, and {lbPreviewData.totalDiaryEntries} diary entries.
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

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="p-2.5 rounded-card bg-card border border-border">
                <div className="font-display text-lg font-bold text-primary">
                  {lbPreviewData.newCount}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  New Titles
                </div>
              </div>
              <div className="p-2.5 rounded-card bg-card border border-border">
                <div className="font-display text-lg font-bold text-foreground">
                  {lbPreviewData.existingCount}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Existing / Update
                </div>
              </div>
              <div className="p-2.5 rounded-card bg-card border border-border">
                <div className="font-display text-lg font-bold text-foreground">
                  {lbPreviewData.totalDiaryEntries}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Diary Events
                </div>
              </div>
              <div className="p-2.5 rounded-card bg-card border border-border">
                <div className="font-display text-lg font-bold text-foreground">
                  {lbPreviewData.totalWatchlistItems}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Watchlist
                </div>
              </div>
            </div>

            {/* Detailed Categories Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-card bg-card border border-border flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <BookOpen size={14} className="text-primary" />
                  <span>Written Reviews (Private)</span>
                </span>
                <span className="font-bold text-foreground">{lbPreviewData.totalReviews}</span>
              </div>
              <div className="p-3 rounded-card bg-card border border-border flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <ListOrdered size={14} className="text-primary" />
                  <span>Custom Lists</span>
                </span>
                <span className="font-bold text-foreground">
                  {lbPreviewData.totalCustomLists} ({lbPreviewData.totalCustomListEntries} entries)
                </span>
              </div>
              <div className="p-3 rounded-card bg-card border border-border flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Heart size={14} className="text-primary" />
                  <span>Liked Films (Favorites)</span>
                </span>
                <span className="font-bold text-foreground">{lbPreviewData.totalLikes}</span>
              </div>
              <div className="p-3 rounded-card bg-card border border-border flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Clock size={14} className="text-primary" />
                  <span>Preserved Aubrey Edits</span>
                </span>
                <span className="font-bold text-foreground">
                  {lbPreviewData.breakdown?.ratings?.preservedAubreyEdits ?? 0}
                </span>
              </div>
            </div>

            {/* Unsupported / Warnings notice */}
            {lbPreviewData.unsupportedReasons?.length > 0 && (
              <div className="p-3 rounded-card bg-surface-elevated border border-border text-[11px] text-muted-foreground space-y-1">
                {lbPreviewData.unsupportedReasons.map((r: string, idx: number) => (
                  <p key={idx}>⚠️ {r}</p>
                ))}
              </div>
            )}

            {/* Sample items */}
            {lbPreviewData.sampleFilms?.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Sample Archive Films:
                </div>
                <div className="space-y-1">
                  {lbPreviewData.sampleFilms.slice(0, 4).map((f: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 px-2.5 rounded-card bg-card border border-border"
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
                className="px-5 py-2.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-display text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                {lbImporting && <Loader2 size={13} className="animate-spin" />}
                <span>{lbImporting ? "Importing Archive..." : "Confirm & Sync into Library"}</span>
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

      {/* SECTION 3: EXPORT YOUR DATA */}
      <div className="p-6 rounded-card border border-border-card bg-card space-y-3 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-xl uppercase font-bold text-foreground">
              Export Your Data
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Download your complete personal media history, viewing diary, ratings, reviews, watchlists, and custom lists in standard JSON format.
            </p>
          </div>
        </div>

        {exportError && (
          <div className="p-3 rounded-card bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{exportError}</span>
          </div>
        )}

        <div className="pt-1">
          <button
            type="button"
            onClick={handleExportJson}
            disabled={exportLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-button bg-surface-elevated hover:bg-muted text-foreground border border-border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            {exportLoading ? (
              <Loader2 size={14} className="animate-spin text-primary" />
            ) : (
              <Download size={14} className="text-primary" />
            )}
            <span>{exportLoading ? "Preparing Export..." : "Export Complete JSON Archive"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
