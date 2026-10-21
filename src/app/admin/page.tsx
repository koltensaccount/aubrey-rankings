"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Database,
  Bug,
  ShieldCheck,
  CheckCircle2,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Top Navbar Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
              aria-label="Back to Aubrey Home"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-serif font-black tracking-wider text-base text-primary">
                AUBREY
              </span>
              <span className="text-muted-foreground font-mono text-xs">/</span>
              <h1 className="text-sm font-bold tracking-tight text-foreground">
                Administration
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/25">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span>Admin Operations</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Hero Section */}
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
            Operations & Diagnostics
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Administrative consoles for data reliability, isolated import testing, system diagnostics, and issue tracking.
          </p>
        </div>

        {/* Console Hub Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Import Lab & Letterboxd Diagnostics */}
          <Link
            href="/admin/import-lab"
            className="group block p-6 rounded-2xl bg-surface border border-border hover:border-primary/50 transition-all hover:shadow-lg space-y-5"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                <Layers size={24} />
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-primary/15 text-primary">
                Phase 14D
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                <span>Import Lab</span>
                <ArrowRight
                  size={16}
                  className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary"
                />
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Letterboxd import diagnostics, isolated disposable test workspace, candidate quarantine & disambiguation, and verified personal library cleanup.
              </p>
            </div>

            <div className="pt-4 border-t border-border flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-background border border-border text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <ShieldCheck size={11} className="text-primary" />
                <span>Test Workspace</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-background border border-border text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Database size={11} className="text-primary" />
                <span>Letterboxd Engine</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-background border border-border text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle2 size={11} className="text-primary" />
                <span>Preview Protection</span>
              </span>
            </div>
          </Link>

          {/* Card 2: Bug Reports & Issue Tracker */}
          <Link
            href="/admin/reports"
            className="group block p-6 rounded-2xl bg-surface border border-border hover:border-primary/50 transition-all hover:shadow-lg space-y-5"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-foreground group-hover:scale-105 transition-transform">
                <Bug size={24} />
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-surface-elevated text-muted-foreground">
                Issues
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                <span>Issue Tracker</span>
                <ArrowRight
                  size={16}
                  className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary"
                />
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Review submitted bug reports, examine client diagnostics, inspect captured screenshot artifacts, and manage report investigation lifecycle.
              </p>
            </div>

            <div className="pt-4 border-t border-border flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-background border border-border text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Activity size={11} className="text-muted-foreground" />
                <span>Diagnostic Logs</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-background border border-border text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle2 size={11} className="text-primary" />
                <span>Triage & Resolve</span>
              </span>
            </div>
          </Link>
        </div>

        {/* Security & Isolation Summary Banner */}
        <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
          <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
            <ShieldCheck size={16} className="text-primary" />
            <span>Administrative Security & Safeguards</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
            <div className="p-3 rounded-lg bg-background border border-border">
              <p className="font-semibold text-foreground">Zero Production Impact</p>
              <p className="mt-1 text-[11px]">
                Import Lab operations execute against a dedicated, isolated test workspace account.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-background border border-border">
              <p className="font-semibold text-foreground">Cryptographic Safeguard</p>
              <p className="mt-1 text-[11px]">
                Personal cleanup operations are preview-first, signed cryptographically, and fail closed.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-background border border-border">
              <p className="font-semibold text-foreground">Session Verification</p>
              <p className="mt-1 text-[11px]">
                Administrative routes authenticate against database sessions and strictly verify ownership.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
