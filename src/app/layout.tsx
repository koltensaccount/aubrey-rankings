import type { Metadata } from "next";
import "./globals.css";
import "./profile.css";
import { Navbar } from "@/components/navbar";
import { BugReportButton } from "@/components/bug-report-button";
import { ThemeProvider } from "@/components/theme-provider";
import { getThemeInitScript } from "@/lib/theme";

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
    <html lang="en" className="h-full antialiased dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground transition-colors duration-150">
        <ThemeProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <BugReportButton />
          <footer className="border-t border-border py-8 px-4 text-xs text-muted-foreground bg-card/60 transition-colors">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="font-display text-base tracking-wider text-foreground">
                  AUBREY RANKINGS
                </span>
                <span className="text-muted-foreground/60">·</span>
                <span>Weighted Media Rubrics & Rankings</span>
              </div>
              <p className="text-[11px] text-muted-foreground/80">
                This product uses the TMDB API but is not endorsed or certified by TMDB.
              </p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
