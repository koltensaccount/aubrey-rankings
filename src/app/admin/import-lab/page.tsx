"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Database,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Tv,
  Film,
  Search,
  Trash2,
  ShieldCheck,
  Loader2,
  Info,
  Layers,
} from "lucide-react";

interface WorkspaceStats {
  diaryCount: number;
  reviewsCount: number;
  ratingsCount: number;
  watchlistCount: number;
  collectionsCount: number;
  unresolvedCount: number;
}

interface WorkspaceInfo {
  userId: string;
  email: string;
  name: string;
  isActive: boolean;
  stats: WorkspaceStats;
}

interface PreviewBreakdown {
  totalUniqueFilms: number;
  totalRatings: number;
  totalReviews: number;
  totalWatched: number;
  totalDiaryEntries: number;
  watchlistCount: number;
  customListsCount: number;
  unsupportedItems: Array<{ filename: string; count: number; category: string; details: string }>;
  detectedTvExceptions: Array<{
    title: string;
    year: number | null;
    seriesTitle: string;
    seasonNumber: number;
    episodeNumber: number;
  }>;
  sampleFilms: Array<{
    title: string;
    year: number | null;
    rating?: number;
    isWatched?: boolean;
    isFavorite?: boolean;
  }>;
}

export default function AdminImportLabPage() {
  const [activeTab, setActiveTab] = useState<"workspace" | "quarantine" | "cleanup">("workspace");
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState("");
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Upload & preview state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewBreakdown | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  // Quarantine & disambiguation state
  const [quarantinedItems, setQuarantinedItems] = useState<any[]>([]);
  const [loadingQuarantine, setLoadingQuarantine] = useState(false);
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<Record<string, any[]>>({});
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Cleanup preview state
  const [cleanupPreview, setCleanupPreview] = useState<any | null>(null);
  const [loadingCleanupPreview, setLoadingCleanupPreview] = useState(false);
  const [executingCleanup, setExecutingCleanup] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any | null>(null);
  const [cleanupPhrase, setCleanupPhrase] = useState("");

  const fetchWorkspace = async () => {
    setLoadingWorkspace(true);
    try {
      const res = await fetch("/api/admin/import-lab/workspace");
      if (res.ok) {
        const data = await res.json();
        setWorkspace(data.workspace);
      }
    } catch (e) {
      console.error("Failed to load workspace info", e);
    } finally {
      setLoadingWorkspace(false);
    }
  };

  const fetchQuarantine = async () => {
    setLoadingQuarantine(true);
    try {
      const res = await fetch("/api/admin/import-lab/unresolved");
      if (res.ok) {
        const data = await res.json();
        setQuarantinedItems(data.items || []);
      }
    } catch (e) {
      console.error("Failed to load quarantined items", e);
    } finally {
      setLoadingQuarantine(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
    fetchQuarantine();
  }, []);

  const handleSwitchWorkspace = async (targetActive: boolean) => {
    setSwitching(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/import-lab/workspace/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: targetActive }),
      });
      if (res.ok) {
        setActionMessage({
          type: "success",
          text: targetActive
            ? "Switched session to Test Workspace. All actions are isolated."
            : "Switched back to your personal administrator account.",
        });
        await fetchWorkspace();
        window.location.reload();
      } else {
        const err = await res.json();
        setActionMessage({ type: "error", text: err.error || "Failed to switch workspace." });
      }
    } catch (e: any) {
      setActionMessage({ type: "error", text: e.message || "Failed to switch workspace." });
    } finally {
      setSwitching(false);
    }
  };

  const handleResetWorkspace = async () => {
    if (resetConfirmInput !== "RESET_TEST_WORKSPACE") {
      setActionMessage({ type: "error", text: 'Please type "RESET_TEST_WORKSPACE" exactly.' });
      return;
    }
    setResetting(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/import-lab/workspace/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: resetConfirmInput }),
      });
      if (res.ok) {
        setActionMessage({ type: "success", text: "Test workspace data successfully reset." });
        setResetConfirmOpen(false);
        setResetConfirmInput("");
        setImportResult(null);
        await fetchWorkspace();
        await fetchQuarantine();
      } else {
        const err = await res.json();
        setActionMessage({ type: "error", text: err.error || "Failed to reset workspace." });
      }
    } catch (e: any) {
      setActionMessage({ type: "error", text: e.message || "Failed to reset workspace." });
    } finally {
      setResetting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setPreviewData(null);
      setImportResult(null);
    }
  };

  const handlePreviewArchive = async () => {
    if (!selectedFile) return;
    setPreviewing(true);
    setActionMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/admin/import-lab/preview", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data.preview);
      } else {
        const err = await res.json();
        setActionMessage({ type: "error", text: err.error || "Failed to preview ZIP archive." });
      }
    } catch (e: any) {
      setActionMessage({ type: "error", text: e.message || "Failed to preview ZIP archive." });
    } finally {
      setPreviewing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!selectedFile) return;
    setImporting(true);
    setActionMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/admin/import-lab/execute", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setImportResult(data.result);
        setActionMessage({
          type: "success",
          text: `Successfully imported into test workspace! (${data.result.newDiaryCount || 0} diary entries, ${data.result.newReviewsCount || 0} reviews).`,
        });
        await fetchWorkspace();
        await fetchQuarantine();
      } else {
        const err = await res.json();
        setActionMessage({ type: "error", text: err.error || "Failed to execute import." });
      }
    } catch (e: any) {
      setActionMessage({ type: "error", text: e.message || "Failed to execute import." });
    } finally {
      setImporting(false);
    }
  };

  const handleSearchCandidates = async (itemId: string, query: string) => {
    setSearchingId(itemId);
    try {
      const res = await fetch("/api/admin/import-lab/search-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults((prev) => ({ ...prev, [itemId]: data.candidates || [] }));
      }
    } catch (e) {
      console.error("Search candidates failed", e);
    } finally {
      setSearchingId(null);
    }
  };

  const handleResolveMapping = async (itemId: string, tmdbId: number, mediaType: string) => {
    setResolvingId(itemId);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/import-lab/resolve-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unresolvedItemId: itemId, tmdbId, mediaType }),
      });
      if (res.ok) {
        setActionMessage({ type: "success", text: "Successfully resolved and mapped item!" });
        await fetchQuarantine();
        await fetchWorkspace();
      } else {
        const err = await res.json();
        setActionMessage({ type: "error", text: err.error || "Failed to resolve mapping." });
      }
    } catch (e: any) {
      setActionMessage({ type: "error", text: e.message || "Failed to resolve mapping." });
    } finally {
      setResolvingId(null);
    }
  };

  const handleFetchCleanupPreview = async () => {
    setLoadingCleanupPreview(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/cleanup/preview", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setCleanupPreview(data.preview);
      } else {
        const err = await res.json();
        setActionMessage({ type: "error", text: err.error || "Failed to load cleanup preview." });
      }
    } catch (e: any) {
      setActionMessage({ type: "error", text: e.message || "Failed to load cleanup preview." });
    } finally {
      setLoadingCleanupPreview(false);
    }
  };

  const handleExecuteCleanupDryRun = async () => {
    if (!cleanupPreview?.token) return;
    if (cleanupPhrase !== "PERMANENTLY_CLEAN_MY_LETTERBOXD_HISTORY") {
      setActionMessage({
        type: "error",
        text: 'Exact confirmation phrase required: "PERMANENTLY_CLEAN_MY_LETTERBOXD_HISTORY".',
      });
      return;
    }
    setExecutingCleanup(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/cleanup/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: cleanupPreview.token,
          confirmationPhrase: cleanupPhrase,
          dryRun: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCleanupResult(data.result);
        setActionMessage({
          type: "success",
          text: "Dry-run validation successful! No records were altered (rolled back). All Aubrey rankings and custom rubrics verified safe.",
        });
      } else {
        const err = await res.json();
        setActionMessage({ type: "error", text: err.error || "Dry-run execution failed." });
      }
    } catch (e: any) {
      setActionMessage({ type: "error", text: e.message || "Dry-run execution failed." });
    } finally {
      setExecutingCleanup(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft size={13} />
            <span>Back to Admin Console</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <Database size={24} className="text-primary" />
            <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-foreground">
              Admin Import Lab
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Test Letterboxd imports safely inside an isolated test workspace, resolve ambiguous items to TMDB identities, and preview personal library cleanup.
          </p>
        </div>

        {/* Current Active Workspace Indicator */}
        <div className="flex items-center gap-3">
          {workspace?.isActive ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Test Mode Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-elevated border border-border text-foreground text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-muted-foreground" />
              <span>Production Admin Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Global Action Message */}
      {actionMessage && (
        <div
          className={`p-4 rounded-lg border text-xs flex items-center justify-between gap-3 ${
            actionMessage.type === "success"
              ? "bg-primary/10 border-primary/30 text-foreground"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs hover:opacity-75 transition-opacity cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-border text-xs">
        <button
          onClick={() => setActiveTab("workspace")}
          className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px cursor-pointer flex items-center gap-2 ${
            activeTab === "workspace"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers size={14} />
          <span>Test Workspace & Importer</span>
        </button>
        <button
          onClick={() => setActiveTab("quarantine")}
          className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px cursor-pointer flex items-center gap-2 ${
            activeTab === "quarantine"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle size={14} />
          <span>Quarantined & Unresolved ({quarantinedItems.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("cleanup")}
          className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px cursor-pointer flex items-center gap-2 ${
            activeTab === "cleanup"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck size={14} />
          <span>Personal Library Cleanup (Preview-First)</span>
        </button>
      </div>

      {/* TAB 1: WORKSPACE & IMPORTER */}
      {activeTab === "workspace" && (
        <div className="space-y-8">
          {/* Workspace Status Card */}
          <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Disposable Sandbox Workspace
                  </span>
                  <span className="px-2 py-0.5 rounded bg-primary/20 text-foreground text-[10px] font-mono font-bold">
                    usr_test_import_workspace
                  </span>
                </div>
                <h2 className="text-xl font-bold text-foreground mt-1">
                  Import Lab Test Account
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Transactional emails disabled. Public social feed excluded. Completely isolated from real Aubrey curator accounts.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {workspace?.isActive ? (
                  <button
                    onClick={() => handleSwitchWorkspace(false)}
                    disabled={switching}
                    className="px-4 py-2 rounded bg-surface hover:bg-surface-elevated text-foreground border border-border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {switching && <Loader2 size={13} className="animate-spin" />}
                    <span>Exit Test Mode</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSwitchWorkspace(true)}
                    disabled={switching}
                    className="px-4 py-2 rounded bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {switching && <Loader2 size={13} className="animate-spin" />}
                    <span>Switch Session to Test Workspace</span>
                  </button>
                )}

                <button
                  onClick={() => setResetConfirmOpen(true)}
                  className="px-4 py-2 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>Reset Test Workspace</span>
                </button>
              </div>
            </div>

            {/* Test Workspace Aggregate Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-border">
              <div className="bg-background/60 p-3.5 rounded-lg border border-border/60">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Diary Logs</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  {workspace?.stats?.diaryCount ?? 0}
                </p>
              </div>
              <div className="bg-background/60 p-3.5 rounded-lg border border-border/60">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Reviews</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  {workspace?.stats?.reviewsCount ?? 0}
                </p>
              </div>
              <div className="bg-background/60 p-3.5 rounded-lg border border-border/60">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ratings</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  {workspace?.stats?.ratingsCount ?? 0}
                </p>
              </div>
              <div className="bg-background/60 p-3.5 rounded-lg border border-border/60">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Watchlist</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  {workspace?.stats?.watchlistCount ?? 0}
                </p>
              </div>
              <div className="bg-background/60 p-3.5 rounded-lg border border-border/60">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Lists</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  {workspace?.stats?.collectionsCount ?? 0}
                </p>
              </div>
              <div className="bg-background/60 p-3.5 rounded-lg border border-border/60">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Quarantined</p>
                <p className="text-xl font-bold text-primary mt-1">
                  {workspace?.stats?.unresolvedCount ?? 0}
                </p>
              </div>
            </div>
          </div>

          {/* Reset Confirmation Dialog */}
          {resetConfirmOpen && (
            <div className="p-5 rounded-xl border border-destructive/40 bg-destructive/10 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-destructive shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-destructive">
                    Confirm Test Workspace Reset
                  </h3>
                  <p className="text-xs text-foreground/80 mt-1">
                    This action will purge all diary logs, reviews, ratings, watchlist items, and imported lists for{" "}
                    <strong className="font-mono text-foreground">usr_test_import_workspace</strong>.
                    Shared media items and real user accounts will remain untouched.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-wider font-semibold text-destructive">
                  Type <span className="font-mono text-foreground">RESET_TEST_WORKSPACE</span> to confirm:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={resetConfirmInput}
                    onChange={(e) => setResetConfirmInput(e.target.value)}
                    placeholder="RESET_TEST_WORKSPACE"
                    className="flex-1 px-3 py-1.5 rounded bg-background border border-border text-xs text-foreground focus:outline-none focus:border-destructive"
                  />
                  <button
                    onClick={handleResetWorkspace}
                    disabled={resetting || resetConfirmInput !== "RESET_TEST_WORKSPACE"}
                    className="px-4 py-2 rounded bg-destructive hover:bg-destructive/90 disabled:opacity-50 text-destructive-foreground text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {resetting && <Loader2 size={13} className="animate-spin" />}
                    <span>Confirm Reset</span>
                  </button>
                  <button
                    onClick={() => {
                      setResetConfirmOpen(false);
                      setResetConfirmInput("");
                    }}
                    className="px-3 py-2 rounded text-muted-foreground hover:text-foreground text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ZIP Upload Dropzone */}
          <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Letterboxd ZIP Archive Importer
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upload a raw Letterboxd export ZIP. Preview verified identities and TV exceptions before executing import into the test workspace.
              </p>
            </div>

            <div className="border-2 border-dashed border-border hover:border-primary/60 transition-colors rounded-xl p-8 text-center space-y-4 bg-background/40">
              <Upload size={32} className="mx-auto text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {selectedFile ? selectedFile.name : "Select or drag Letterboxd export ZIP"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Supports diary.csv, ratings.csv, watched.csv, reviews.csv, watchlist.csv, and lists
                </p>
              </div>

              <div className="flex items-center justify-center gap-3">
                <label className="px-4 py-2 rounded bg-surface hover:bg-surface-elevated text-foreground border border-border text-xs font-semibold transition-colors cursor-pointer">
                  Browse Files
                  <input
                    type="file"
                    accept=".zip"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {selectedFile && (
                  <button
                    onClick={handlePreviewArchive}
                    disabled={previewing}
                    className="px-4 py-2 rounded bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {previewing && <Loader2 size={13} className="animate-spin" />}
                    <span>Inspect Archive</span>
                  </button>
                )}
              </div>
            </div>

            {/* Pre-Import Preview Section */}
            {previewData && (
              <div className="space-y-6 pt-6 border-t border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Archive Inspection Breakdown
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Review detected film records, TV exceptions, and unsupported items before committing.
                    </p>
                  </div>

                  <button
                    onClick={handleExecuteImport}
                    disabled={importing}
                    className="px-5 py-2.5 rounded bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2"
                  >
                    {importing && <Loader2 size={14} className="animate-spin" />}
                    <span>Execute Import into Test Workspace</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-background/80 p-3 rounded-lg border border-border">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Unique Films</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">{previewData.totalUniqueFilms}</p>
                  </div>
                  <div className="bg-background/80 p-3 rounded-lg border border-border">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Diary Logs</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">{previewData.totalDiaryEntries}</p>
                  </div>
                  <div className="bg-background/80 p-3 rounded-lg border border-border">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Reviews</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">{previewData.totalReviews}</p>
                  </div>
                  <div className="bg-background/80 p-3 rounded-lg border border-border">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Ratings</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">{previewData.totalRatings}</p>
                  </div>
                  <div className="bg-background/80 p-3 rounded-lg border border-border">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Watchlist</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">{previewData.watchlistCount}</p>
                  </div>
                  <div className="bg-background/80 p-3 rounded-lg border border-border">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Custom Lists</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">{previewData.customListsCount}</p>
                  </div>
                </div>

                {/* Detected TV Exceptions */}
                {previewData.detectedTvExceptions.length > 0 && (
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                    <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider">
                      <Tv size={14} />
                      <span>Detected Letterboxd TV Exceptions ({previewData.detectedTvExceptions.length})</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      These titles are cataloged as films on Letterboxd but correspond to specific television episodes. Aubrey will map them to episodes with 16:9 episode stills:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      {previewData.detectedTvExceptions.map((ex, idx) => (
                        <div key={idx} className="p-2.5 rounded bg-background/60 border border-border flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-foreground">{ex.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {ex.seriesTitle} · S{ex.seasonNumber}E{ex.episodeNumber}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-semibold">
                            Episode Mapping
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unsupported Archive Files Notice */}
                {previewData.unsupportedItems.length > 0 && (
                  <div className="p-4 rounded-lg bg-surface border border-border space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      <Info size={14} />
                      <span>Transparently Ignored Letterboxd Files ({previewData.unsupportedItems.length})</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      These auxiliary files exist in Letterboxd exports but do not represent library media:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {previewData.unsupportedItems.map((u, i) => (
                        <span key={i} className="px-2.5 py-1 rounded bg-background border border-border text-[11px] text-muted-foreground">
                          {u.filename} ({u.count} items)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Import Execution Result */}
            {importResult && (
              <div className="p-5 rounded-xl border border-primary/40 bg-primary/10 space-y-4">
                <div className="flex items-center gap-2.5 text-primary font-bold text-sm">
                  <CheckCircle2 size={18} />
                  <span>Import Completed Successfully</span>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed">
                  {importResult.message}
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => handleSwitchWorkspace(true)}
                    className="px-4 py-2 rounded bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Enter Test Mode to Browse Timeline & Library
                  </button>
                  <Link
                    href="/"
                    className="px-4 py-2 rounded bg-surface hover:bg-surface-elevated border border-border text-xs text-foreground font-semibold transition-colors"
                  >
                    Go to Library
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: QUARANTINE & DISAMBIGUATION */}
      {activeTab === "quarantine" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Quarantined Import Items ({quarantinedItems.length})
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Films and dependent logs held in quarantine due to ambiguous matches, multiple database hits, or missing release years.
              </p>
            </div>

            <button
              onClick={fetchQuarantine}
              className="self-start sm:self-auto px-3.5 py-1.5 rounded bg-surface hover:bg-surface-elevated border border-border text-xs text-foreground font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={loadingQuarantine ? "animate-spin" : ""} />
              <span>Refresh Quarantine</span>
            </button>
          </div>

          {quarantinedItems.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl p-12 text-center space-y-2">
              <ShieldCheck size={36} className="mx-auto text-primary" />
              <h3 className="text-sm font-bold text-foreground">No Quarantined Items</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                All films in recent imports were successfully verified or the test workspace has been reset.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {quarantinedItems.map((item) => {
                const sourceData = item.sourceData || {};
                const title = sourceData.title || sourceData.name || item.details || "Untitled";
                const year = sourceData.year || null;
                const candidates = sourceData.candidates || searchResults[item.id] || [];

                return (
                  <div key={item.id} className="bg-surface border border-border rounded-xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-foreground">{title}</h3>
                          {year && (
                            <span className="text-xs text-muted-foreground font-mono">({year})</span>
                          )}
                          <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-semibold uppercase">
                            {item.reason}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.details}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={searchQueries[item.id] ?? title}
                          onChange={(e) =>
                            setSearchQueries((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          placeholder="Search TMDB..."
                          className="px-2.5 py-1.5 rounded bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary w-40 sm:w-52"
                        />
                        <button
                          onClick={() =>
                            handleSearchCandidates(item.id, searchQueries[item.id] ?? title)
                          }
                          disabled={searchingId === item.id}
                          className="px-3 py-1.5 rounded bg-surface hover:bg-surface-elevated border border-border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          {searchingId === item.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Search size={12} />
                          )}
                          <span>Search</span>
                        </button>
                      </div>
                    </div>

                    {/* Candidate Matches */}
                    {candidates.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Potential Matches:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {candidates.map((cand: any) => (
                            <div
                              key={cand.id}
                              className="p-3 rounded-lg bg-background border border-border flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {cand.posterPath ? (
                                  <img
                                    src={`https://image.tmdb.org/t/p/w92${cand.posterPath}`}
                                    alt=""
                                    className="w-9 h-13 object-cover rounded shrink-0 bg-surface"
                                  />
                                ) : (
                                  <div className="w-9 h-13 rounded bg-surface border border-border flex items-center justify-center shrink-0">
                                    <Film size={14} className="text-muted-foreground" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-foreground truncate">
                                    {cand.title}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {cand.year ?? "No year"} · {cand.mediaType || "movie"}
                                  </p>
                                </div>
                              </div>

                              <button
                                onClick={() =>
                                  handleResolveMapping(item.id, cand.id, cand.mediaType || "movie")
                                }
                                disabled={resolvingId === item.id}
                                className="px-2.5 py-1 rounded bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-semibold transition-colors shrink-0 cursor-pointer"
                              >
                                {resolvingId === item.id ? "Mapping..." : "Confirm"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PERSONAL LIBRARY CLEANUP (PREVIEW-FIRST) */}
      {activeTab === "cleanup" && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-primary/30 bg-primary/10 space-y-2">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <ShieldCheck size={18} />
              <span>Strict Production Safeguard & Zero Data-Loss Guarantee</span>
            </div>
            <p className="text-xs text-foreground/90 leading-relaxed">
              This cleanup tool is strictly designed to revert imported Letterboxd history.
              All custom Aubrey rankings, rubric scoring weights, collection-scoped ratings, and user authentication credentials are permanently safeguarded and will never be modified.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Personal Library Cleanup Preview
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Generate a cryptographically verified preview of records eligible for cleanup on your account.
                </p>
              </div>

              <button
                onClick={handleFetchCleanupPreview}
                disabled={loadingCleanupPreview}
                className="px-4 py-2 rounded bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 self-start sm:self-auto"
              >
                {loadingCleanupPreview && <Loader2 size={13} className="animate-spin" />}
                <span>Generate Deletion Preview</span>
              </button>
            </div>

            {cleanupPreview && (
              <div className="space-y-6 pt-4 border-t border-border">
                {/* Two-Column Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Column 1: Items to Remove */}
                  <div className="p-5 rounded-xl bg-destructive/10 border border-destructive/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs uppercase tracking-wider font-bold text-destructive">
                        Items Targeted for Cleanup
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-surface text-destructive text-xs font-mono font-bold border border-destructive/40">
                        {cleanupPreview.toRemove.totalRemovable} records
                      </span>
                    </div>
                    <ul className="space-y-2 text-xs text-foreground/90 divide-y divide-border pt-1">
                      <li className="flex justify-between py-1.5">
                        <span>Imported Diary Entries</span>
                        <strong className="font-mono">{cleanupPreview.toRemove.letterboxdDiaryEntries}</strong>
                      </li>
                      <li className="flex justify-between py-1.5">
                        <span>Letterboxd Reviews</span>
                        <strong className="font-mono">{cleanupPreview.toRemove.letterboxdReviews}</strong>
                      </li>
                      <li className="flex justify-between py-1.5">
                        <span>Watchlist Items</span>
                        <strong className="font-mono">{cleanupPreview.toRemove.letterboxdWatchlistItems}</strong>
                      </li>
                      <li className="flex justify-between py-1.5">
                        <span>Global Letterboxd Ratings</span>
                        <strong className="font-mono">{cleanupPreview.toRemove.letterboxdGlobalRatings}</strong>
                      </li>
                      <li className="flex justify-between py-1.5">
                        <span>Letterboxd Custom Lists</span>
                        <strong className="font-mono">{cleanupPreview.toRemove.letterboxdCustomLists}</strong>
                      </li>
                    </ul>
                  </div>

                  {/* Column 2: Items Permanently Preserved */}
                  <div className="p-5 rounded-xl bg-primary/10 border border-primary/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs uppercase tracking-wider font-bold text-primary">
                        Items Permanently Preserved
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-surface text-primary text-xs font-mono font-bold border border-primary/40">
                        {cleanupPreview.toPreserve.totalPreserved} records
                      </span>
                    </div>
                    <ul className="space-y-2 text-xs text-foreground/90 divide-y divide-border pt-1">
                      <li className="flex justify-between py-1.5">
                        <span>Aubrey Rankings & Collections</span>
                        <strong className="font-mono">{cleanupPreview.toPreserve.aubreyRankingsAndLists}</strong>
                      </li>
                      <li className="flex justify-between py-1.5">
                        <span>Collection Entries & Ordering</span>
                        <strong className="font-mono">{cleanupPreview.toPreserve.aubreyCollectionEntries}</strong>
                      </li>
                      <li className="flex justify-between py-1.5">
                        <span>Collection-Scoped Ratings</span>
                        <strong className="font-mono">{cleanupPreview.toPreserve.collectionScopedRatings}</strong>
                      </li>
                      <li className="flex justify-between py-1.5">
                        <span>Custom Rubric Systems & Weights</span>
                        <strong className="font-mono">{cleanupPreview.toPreserve.customRubricSystems}</strong>
                      </li>
                      <li className="flex justify-between py-1.5">
                        <span>Native Aubrey Reviews</span>
                        <strong className="font-mono">{cleanupPreview.toPreserve.nativeAubreyReviews}</strong>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Dry-Run Validation Controls */}
                <div className="p-5 rounded-xl bg-background border border-border space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Dry-Run Test Execution
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Type the required safety phrase to test cleanup in a guaranteed rolled-back transaction:
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Confirmation Phrase: <span className="font-mono text-foreground">PERMANENTLY_CLEAN_MY_LETTERBOXD_HISTORY</span>
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <input
                        type="text"
                        value={cleanupPhrase}
                        onChange={(e) => setCleanupPhrase(e.target.value)}
                        placeholder="PERMANENTLY_CLEAN_MY_LETTERBOXD_HISTORY"
                        className="flex-1 px-3 py-2 rounded bg-surface border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                      <button
                        onClick={handleExecuteCleanupDryRun}
                        disabled={
                          executingCleanup ||
                          cleanupPhrase !== "PERMANENTLY_CLEAN_MY_LETTERBOXD_HISTORY"
                        }
                        className="px-4 py-2 rounded bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {executingCleanup && <Loader2 size={13} className="animate-spin" />}
                        <span>Execute Dry-Run Test (Rollback)</span>
                      </button>
                    </div>
                  </div>

                  {cleanupResult && (
                    <div className="p-4 rounded-lg bg-surface border border-border text-xs space-y-2">
                      <p className="font-semibold text-primary">
                        Dry-Run Transaction Verified & Rolled Back
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        The database transaction successfully verified deletion of {cleanupResult.deleted?.diaryEntries} diary entries and {cleanupResult.deleted?.ratings} ratings inside an isolated transaction that was automatically rolled back. No live data was harmed.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
