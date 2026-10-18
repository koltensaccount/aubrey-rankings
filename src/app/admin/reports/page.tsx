"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bug, ArrowLeft, ExternalLink, Check, Clock, AlertCircle, Loader2, Image as ImageIcon, X } from "lucide-react";

export default function AdminBugReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "investigating" | "resolved">("all");
  const [viewingScreenshot, setViewingScreenshot] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bug-reports");
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          throw new Error("You must be an administrator to access bug reports.");
        }
        throw new Error("Failed to load bug reports.");
      }
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/bug-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setReports((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
        );
      }
    } catch (err) {
      console.error("Failed to update status", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (statusFilter === "all") return true;
    return r.status === statusFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#303b34] pb-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[#8fa095] hover:text-[#f1f0e9] transition-colors mb-2"
          >
            <ArrowLeft size={13} />
            <span>Back to Application</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <Bug size={24} className="text-[#89d5d5]" />
            <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#f1f0e9]">
              Issue Tracker & Bug Reports
            </h1>
          </div>
          <p className="text-xs text-[#9aa79e] mt-1">
            Review user-submitted defect reports, page contexts, and screenshot attachments.
          </p>
        </div>

        <button
          onClick={fetchReports}
          className="self-start sm:self-auto px-4 py-2 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40] text-xs font-semibold transition-colors cursor-pointer"
        >
          Refresh Reports
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 rounded-full font-semibold transition-colors cursor-pointer ${
            statusFilter === "all"
              ? "bg-[#89d5d5] text-[#102523]"
              : "bg-[#18211d] text-[#8fa095] hover:text-[#f1f0e9] border border-[#303b34]"
          }`}
        >
          All ({reports.length})
        </button>
        <button
          onClick={() => setStatusFilter("open")}
          className={`px-3 py-1.5 rounded-full font-semibold transition-colors cursor-pointer ${
            statusFilter === "open"
              ? "bg-red-500 text-white"
              : "bg-[#18211d] text-[#8fa095] hover:text-[#f1f0e9] border border-[#303b34]"
          }`}
        >
          Open ({reports.filter((r) => r.status === "open").length})
        </button>
        <button
          onClick={() => setStatusFilter("investigating")}
          className={`px-3 py-1.5 rounded-full font-semibold transition-colors cursor-pointer ${
            statusFilter === "investigating"
              ? "bg-amber-500 text-black"
              : "bg-[#18211d] text-[#8fa095] hover:text-[#f1f0e9] border border-[#303b34]"
          }`}
        >
          Investigating ({reports.filter((r) => r.status === "investigating").length})
        </button>
        <button
          onClick={() => setStatusFilter("resolved")}
          className={`px-3 py-1.5 rounded-full font-semibold transition-colors cursor-pointer ${
            statusFilter === "resolved"
              ? "bg-emerald-600 text-white"
              : "bg-[#18211d] text-[#8fa095] hover:text-[#f1f0e9] border border-[#303b34]"
          }`}
        >
          Resolved ({reports.filter((r) => r.status === "resolved").length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 size={24} className="mx-auto text-[#89d5d5] animate-spin" />
          <p className="text-xs text-[#8fa095]">Loading reports...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl border border-red-500/20 bg-red-500/5 text-center max-w-md mx-auto space-y-3">
          <AlertCircle size={24} className="mx-auto text-red-400" />
          <h3 className="font-display text-lg uppercase text-[#f1f0e9]">Access Restricted</h3>
          <p className="text-xs text-[#9aa79e]">{error}</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-[#303b34] rounded-xl text-xs text-[#8fa095]">
          No {statusFilter === "all" ? "" : statusFilter} bug reports found.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const dateStr = new Date(report.createdAt).toLocaleString();
            const submitter = report.user?.name || report.user?.username || report.user?.email || "Guest Visitor";

            return (
              <div
                key={report.id}
                className="p-5 rounded-xl border border-[#303b34] bg-[#141a17] space-y-4 hover:border-[#425247] transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        report.status === "open"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : report.status === "investigating"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {report.status}
                    </span>
                    <span className="font-semibold text-[#f1f0e9]">{submitter}</span>
                    <span className="text-[#6c7d73]">·</span>
                    <span className="text-[#8fa095]">{dateStr}</span>
                  </div>

                  {/* Status Changer */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#8fa095] uppercase">Status:</span>
                    <select
                      value={report.status}
                      disabled={updatingId === report.id}
                      onChange={(e) => handleUpdateStatus(report.id, e.target.value)}
                      className="bg-[#18211d] text-xs text-[#f1f0e9] border border-[#303b34] rounded px-2 py-1 focus:outline-none focus:border-[#89d5d5]"
                    >
                      <option value="open">Open</option>
                      <option value="investigating">Investigating</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-[#e4ede5] leading-relaxed whitespace-pre-wrap">
                  {report.description}
                </p>

                {/* Metadata & Page URL */}
                <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-[#232d26] text-[#8fa095]">
                  <div className="flex items-center gap-1.5 truncate max-w-md">
                    <span className="text-[10px] uppercase font-semibold text-[#6c7d73]">URL:</span>
                    <a
                      href={report.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#89d5d5] hover:underline flex items-center gap-1 truncate"
                    >
                      <span className="truncate">{report.pageUrl}</span>
                      <ExternalLink size={11} className="shrink-0" />
                    </a>
                  </div>

                  {report.screenshotUrl && (
                    <button
                      type="button"
                      onClick={() => setViewingScreenshot(report.screenshotUrl)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40] text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <ImageIcon size={13} />
                      <span>View Screenshot</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Screenshot Modal */}
      {viewingScreenshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative max-w-5xl max-h-[90vh] rounded-xl overflow-hidden bg-[#101513] border border-[#303b34] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-[#28342d] bg-[#141a17]">
              <span className="text-xs font-semibold text-[#f1f0e9]">Screenshot Attachment</span>
              <button
                type="button"
                onClick={() => setViewingScreenshot(null)}
                className="text-[#8fa095] hover:text-[#f1f0e9] p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-2 overflow-auto max-h-[80vh] flex items-center justify-center">
              <img
                src={viewingScreenshot}
                alt="Full screenshot"
                className="max-h-[75vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
