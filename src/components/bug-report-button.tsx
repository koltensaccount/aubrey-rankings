"use client";

import React, { useState, useEffect } from "react";
import { Bug, X, UploadCloud, CheckCircle2, Loader2, Image as ImageIcon } from "lucide-react";

export function BugReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clipboard paste listener for screenshots
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
              const res = loadEvent.target?.result as string;
              if (res) setScreenshotData(res);
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Screenshot file is too large (max 5MB).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const res = loadEvent.target?.result as string;
      if (res) setScreenshotData(res);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please describe the issue.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const pageUrl = typeof window !== "undefined" ? window.location.href : "/";
      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";

      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          pageUrl,
          userAgent,
          screenshotUrl: screenshotData,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit report");
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsOpen(false);
        setDescription("");
        setScreenshotData(null);
      }, 2000);
    } catch (err: any) {
      setError(err?.message || "Failed to submit bug report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Report an issue"
        className="fixed bottom-4 right-4 z-40 px-3 py-2 rounded-full bg-[#18221c]/90 hover:bg-[#202e26] text-[#8fa095] hover:text-[#89d5d5] border border-[#303b34] hover:border-[#415247] shadow-xl backdrop-blur-md text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer group"
      >
        <Bug size={14} className="text-[#89d5d5] group-hover:scale-110 transition-transform" />
        <span className="hidden sm:inline">Report Issue</span>
      </button>

      {/* Bug Report Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-[#141a17] border border-[#303b34] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#28342d]">
              <div className="flex items-center gap-2">
                <Bug size={18} className="text-[#89d5d5]" />
                <h3 className="font-display text-lg uppercase font-bold text-[#f1f0e9]">
                  Report an Issue
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[#8fa095] hover:text-[#f1f0e9] p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {isSuccess ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 size={36} className="mx-auto text-[#89d5d5]" />
                <h4 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
                  Report Received
                </h4>
                <p className="text-xs text-[#9aa79e]">
                  Thank you for helping us polish Aubrey Rankings!
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {error}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                    Page Location
                  </label>
                  <div className="text-xs text-[#6c7d73] font-mono px-3 py-2 rounded bg-[#101513] border border-[#232d27] truncate">
                    {typeof window !== "undefined" ? window.location.pathname + window.location.search : "/"}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                    Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what happened, what you expected, or any unexpected behavior..."
                    required
                    className="w-full text-xs rounded-lg p-3 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] placeholder-[#6c7d73] focus:outline-none focus:border-[#89d5d5] transition-colors resize-none"
                  />
                </div>

                {/* Screenshot Attachment / Paste */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                      Screenshot (Optional)
                    </label>
                    <span className="text-[10px] text-[#6c7d73]">
                      Paste with Ctrl+V / ⌘V or upload
                    </span>
                  </div>

                  {screenshotData ? (
                    <div className="relative rounded-lg border border-[#303b34] bg-black overflow-hidden max-h-40 flex items-center justify-center group">
                      <img
                        src={screenshotData}
                        alt="Screenshot preview"
                        className="max-h-40 w-auto object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setScreenshotData(null)}
                        className="absolute top-2 right-2 p-1 rounded-full bg-black/80 hover:bg-black text-red-400 hover:text-red-300 transition-colors"
                        title="Remove screenshot"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-4 rounded-lg border border-dashed border-[#303b34] hover:border-[#425247] bg-[#111613] cursor-pointer transition-colors">
                      <ImageIcon size={20} className="text-[#6c7d73] mb-1" />
                      <span className="text-xs text-[#8fa095]">Click to upload or paste image</span>
                      <span className="text-[10px] text-[#55645a] mt-0.5">PNG, JPG up to 5MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs text-[#9aa79e] hover:text-[#f1f0e9] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !description.trim()}
                    className="px-5 py-2.5 rounded bg-[#89d5d5] hover:bg-[#a5e2e2] text-[#102523] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
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
      )}
    </>
  );
}
