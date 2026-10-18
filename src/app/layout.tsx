import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { BugReportButton } from "@/components/bug-report-button";

export const metadata: Metadata = {
  title: "Aubrey Rankings — Cinema Journal & Weighted Critique",
  description:
    "Self-hosted, weighted media rating platform for TV series, episodes, movie franchises, and custom collections.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[#111514] text-[#f1f0e9]">
        <Navbar />
        <main className="flex-1">{children}</main>
        <BugReportButton />
        <footer className="border-t border-[#303b34] py-8 px-4 text-xs text-[#9aa79e] bg-[#111514]">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-display text-base tracking-wider text-[#f1f0e9]">
                AUBREY RANKINGS
              </span>
              <span className="text-[#6d7e74]">·</span>
              <span className="text-[#9aa79e]">Modern Cinema Editorial</span>
            </div>
            <p className="text-[11px] text-[#78887e]">
              This product uses the TMDB API but is not endorsed or certified by TMDB.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
