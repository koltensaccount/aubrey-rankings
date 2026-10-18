import type { Metadata } from "next";
import "./globals.css";
import "./profile.css";
import { Navbar } from "@/components/navbar";
import { BugReportButton } from "@/components/bug-report-button";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Aubrey Rankings — Cinema Journal & Weighted Critique",
  description:
    "Self-hosted, weighted media rating platform for TV series, episodes, movie franchises, and custom collections.",
};

const themeInitScript = `
(function() {
  try {
    var storedTheme = localStorage.getItem('ar_theme') || 'dark';
    var storedAccent = localStorage.getItem('ar_accent') || '#89D5D5';
    var isDark = storedTheme === 'dark';
    if (storedTheme === 'system') {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    var resolved = isDark ? 'dark' : 'light';
    var root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    root.setAttribute('data-theme', resolved);

    var hex = storedAccent.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function(c) { return c + c; }).join('');
    if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
      var r = parseInt(hex.substring(0, 2), 16);
      var g = parseInt(hex.substring(2, 4), 16);
      var b = parseInt(hex.substring(4, 6), 16);
      function toLinear(c) { var s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }
      var lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
      var darkLum = 0.02;
      var darkContrast = (Math.max(lum, darkLum) + 0.05) / (Math.min(lum, darkLum) + 0.05);
      var lightContrast = 1.05 / (lum + 0.05);
      var fg = darkContrast >= lightContrast ? '#102523' : '#FFFFFF';
      var factor = lum > 0.4 ? 0.88 : 1.15;
      function clamp(n) { return Math.min(255, Math.max(0, Math.round(n * factor))); }
      var hr = clamp(r).toString(16).padStart(2, '0');
      var hg = clamp(g).toString(16).padStart(2, '0');
      var hb = clamp(b).toString(16).padStart(2, '0');
      var hover = '#' + hr + hg + hb;

      var fullHex = '#' + hex.toUpperCase();
      var primaryText = fullHex;
      if (resolved === 'light') {
        var lightBgLum = 0.94;
        var textContrast = (lightBgLum + 0.05) / (lum + 0.05);
        if (textContrast < 4.5) {
          var tfactor = 0.85;
          for (var i = 0; i < 15; i++) {
            var tr = Math.max(0, Math.round(r * tfactor));
            var tg = Math.max(0, Math.round(g * tfactor));
            var tb = Math.max(0, Math.round(b * tfactor));
            var tlum = 0.2126 * toLinear(tr) + 0.7152 * toLinear(tg) + 0.0722 * toLinear(tb);
            if ((lightBgLum + 0.05) / (tlum + 0.05) >= 4.5) {
              primaryText = '#' + tr.toString(16).padStart(2, '0') + tg.toString(16).padStart(2, '0') + tb.toString(16).padStart(2, '0');
              break;
            }
            tfactor -= 0.05;
          }
        }
      }

      root.style.setProperty('--primary', fullHex);
      root.style.setProperty('--primary-foreground', fg);
      root.style.setProperty('--primary-hover', hover);
      root.style.setProperty('--primary-text', primaryText);
      root.style.setProperty('--ring', fullHex);
      root.style.setProperty('--feature-accent', fullHex);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
