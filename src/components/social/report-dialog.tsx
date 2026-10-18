"use client";

import { useState } from "react";
import { Flag, X, Loader2, Check, AlertCircle, Shield } from "lucide-react";

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: "comment" | "review" | "ranking" | "user";
  targetId: string;
  targetTitle?: string;
}

const REASONS = [
  { id: "harassment", label: "Harassment or bullying" },
  { id: "spam", label: "Spam or promotional content" },
  { id: "spoiler", label: "Unmarked major plot spoiler" },
  { id: "hate_speech", label: "Hate speech or discrimination" },
  { id: "inappropriate", label: "Explicit or inappropriate material" },
  { id: "other", label: "Other community guideline violation" },
];

export function ReportDialog({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
}: ReportDialogProps) {
  const [reason, setReason] = useState<string>("harassment");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          details: details.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit report");
      }

      setSuccessMessage(data.message || "Report submitted successfully");
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getTargetLabel = () => {
    switch (targetType) {
      case "comment":
        return "Comment";
      case "review":
        return "Review";
      case "ranking":
        return "Ranking";
      case "user":
        return "User Profile";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-foreground">
            <div className="h-7 w-7 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
              <Flag size={14} />
            </div>
            <div>
              <h2 className="font-display text-lg uppercase font-bold text-foreground leading-none">
                Report {getTargetLabel()}
              </h2>
              {targetTitle && (
                <span className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                  "{targetTitle}"
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {successMessage ? (
          <div className="py-8 text-center space-y-3">
            <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Check size={20} />
            </div>
            <p className="text-xs text-foreground font-medium">{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2.5 text-xs text-destructive">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Why are you reporting this?
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {REASONS.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      reason === r.id
                        ? "border-primary bg-primary/10 text-foreground font-medium"
                        : "border-border bg-card/60 text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={r.id}
                      checked={reason === r.id}
                      onChange={() => setReason(r.id)}
                      className="sr-only"
                    />
                    <div
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        reason === r.id
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      }`}
                    >
                      {reason === r.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-background" />
                      )}
                    </div>
                    <span>{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-foreground uppercase tracking-wider">
                  Additional Details (Optional)
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {details.length}/1000
                </span>
              </div>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
                rows={3}
                placeholder="Provide any relevant context to assist moderator review..."
                className="w-full p-2.5 rounded-lg border border-border bg-surface text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-surface/50 border border-border flex items-start gap-2 text-[11px] text-muted-foreground">
              <Shield size={13} className="shrink-0 text-primary mt-0.5" />
              <span>
                Reports are strictly confidential. Content authors and profile owners are never told who submitted a report.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3.5 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Report</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
