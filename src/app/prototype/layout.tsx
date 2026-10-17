"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Film,
  Sparkles,
  LayoutGrid,
  User,
  Sliders,
  ChevronRight,
  Monitor,
  Smartphone,
  Tablet,
  Eye,
} from "lucide-react";

export default function PrototypeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [viewportMode, setViewportMode] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const screens = [
    { name: "Screen A — Social Home", path: "/prototype", label: "Editorial Feed" },
    { name: "Screen B — Ranking Detail", path: "/prototype/ranking", label: "Black Mirror Ranked" },
    { name: "Screen C — User Profile", path: "/prototype/profile", label: "@aubrey Journal" },
  ];

  return (
    <div className="min-h-screen bg-[#121212] text-[#F2EFE9] font-ui selection:bg-[#D93829] selection:text-white flex flex-col">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
      />
      {/* =========================================================================
          PROTOTYPE TOP SWITCHER BAR
          Allows instant navigation between all 3 screens and viewport evaluation
          ========================================================================= */}
      <div className="sticky top-0 z-50 bg-[#181816]/95 backdrop-blur-md border-b border-[#2A2926] px-4 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* Badge & Mission */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-[#D93829] text-white font-bold tracking-wider text-[10px] uppercase">
              Stage 1 Prototype
            </span>
            <span className="text-[#9C9993] hidden md:inline">
              Modern Cinema Editorial Design Language
            </span>
          </div>

          {/* Screen Switcher */}
          <nav className="flex items-center gap-1 bg-[#121212] p-1 rounded-xl border border-[#2A2926]">
            {screens.map((screen) => {
              const isActive = pathname === screen.path;
              return (
                <Link
                  key={screen.path}
                  href={screen.path}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-[#262523] text-[#F2EFE9] shadow-sm font-semibold border border-[#383632]"
                      : "text-[#9C9993] hover:text-[#F2EFE9] hover:bg-[#1B1B19]"
                  }`}
                >
                  {screen.name.split(" — ")[0]}
                  <span className="opacity-60 hidden lg:inline ml-1 font-normal">
                    ({screen.label})
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Viewport Width Indicator Helper */}
          <div className="hidden sm:flex items-center gap-2 text-[#9C9993] text-[11px]">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1B1B19] border border-[#2A2926]">
              <Monitor className="h-3 w-3 text-[#D93829]" />
              <span>1440 Desktop</span>
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1B1B19] border border-[#2A2926]">
              <Smartphone className="h-3 w-3 text-[#D89B38]" />
              <span>390 Mobile Ready</span>
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CINEMATIC MASTHEAD / MAIN NAV
          Inspired by Letterboxd, MUBI, and Apple's interface restraint
          ========================================================================= */}
      <header className="border-b border-[#2A2926] bg-[#141414]/90 backdrop-blur-md sticky top-10 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo & Identity */}
          <Link
            href="/prototype"
            className="flex items-center gap-3.5 group transition-transform active:scale-95"
          >
            <div className="h-10 w-10 rounded-lg bg-[#1B1B19] border border-[#383632] flex items-center justify-center relative overflow-hidden group-hover:border-[#D93829] transition-colors">
              <span className="font-display text-2xl text-[#F2EFE9] leading-none pt-0.5">
                A
              </span>
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-[#D93829]" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-2xl tracking-wider text-[#F2EFE9] leading-none group-hover:text-white transition-colors">
                AUBREY <span className="text-[#D93829]">RANKINGS</span>
              </span>
              <span className="font-editorial italic text-[11px] text-[#9C9993] tracking-normal leading-tight">
                Cinema Journal & Weighted Critique
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link
              href="/prototype"
              className={`transition-colors py-1 relative ${
                pathname === "/prototype"
                  ? "text-[#F2EFE9] font-semibold"
                  : "text-[#9C9993] hover:text-[#F2EFE9]"
              }`}
            >
              Feed & Dispatch
              {pathname === "/prototype" && (
                <div className="absolute -bottom-5 inset-x-0 h-[2px] bg-[#D93829]" />
              )}
            </Link>

            <Link
              href="/prototype/ranking"
              className={`transition-colors py-1 relative ${
                pathname === "/prototype/ranking"
                  ? "text-[#F2EFE9] font-semibold"
                  : "text-[#9C9993] hover:text-[#F2EFE9]"
              }`}
            >
              Featured Ranking
              {pathname === "/prototype/ranking" && (
                <div className="absolute -bottom-5 inset-x-0 h-[2px] bg-[#D93829]" />
              )}
            </Link>

            <Link
              href="/prototype/profile"
              className={`transition-colors py-1 relative ${
                pathname === "/prototype/profile"
                  ? "text-[#F2EFE9] font-semibold"
                  : "text-[#9C9993] hover:text-[#F2EFE9]"
              }`}
            >
              Aubrey&apos;s Journal
              {pathname === "/prototype/profile" && (
                <div className="absolute -bottom-5 inset-x-0 h-[2px] bg-[#D93829]" />
              )}
            </Link>
          </nav>

          {/* Actions & Avatar */}
          <div className="flex items-center gap-3">
            <Link
              href="/prototype/ranking"
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#202020] hover:bg-[#282826] text-[#F2EFE9] border border-[#343331] transition-all hover:border-[#D93829]/60"
            >
              <Sliders className="h-3.5 w-3.5 text-[#D93829]" />
              <span>Weighted Scale (1–10)</span>
            </Link>

            <Link
              href="/prototype/profile"
              className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-[#1B1B19] border border-[#2A2926] hover:border-[#383632] transition-colors"
            >
              <div className="h-7 w-7 rounded-full bg-[#D93829] text-white flex items-center justify-center font-display text-sm">
                A
              </div>
              <span className="text-xs font-semibold text-[#F2EFE9] hidden sm:inline">
                @aubrey
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 film-grain">{children}</main>

      {/* =========================================================================
          EDITORIAL MASTHEAD FOOTER
          Vintage publication footer with volume & issue styling
          ========================================================================= */}
      <footer className="border-t border-[#2A2926] bg-[#101010] py-14 px-4 sm:px-6 lg:px-8 text-xs text-[#9C9993]">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-[#242321]">
            <div className="space-y-1.5">
              <h4 className="font-display text-2xl tracking-widest text-[#F2EFE9]">
                AUBREY RANKINGS
              </h4>
              <p className="font-editorial italic text-sm text-[#9C9993] max-w-md">
                A definitive intersection of contemporary film criticism,
                weighted sensory scoring, and editorial graphic design.
              </p>
            </div>
            <div className="flex flex-wrap gap-6 text-xs uppercase tracking-wider font-semibold text-[#F2EFE9]">
              <Link href="/prototype" className="hover:text-[#D93829] transition-colors">
                Social Dispatch
              </Link>
              <Link href="/prototype/ranking" className="hover:text-[#D93829] transition-colors">
                Black Mirror Ranked
              </Link>
              <Link href="/prototype/profile" className="hover:text-[#D93829] transition-colors">
                Critic Dossier
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#6B6862]">
            <p>
              Aubrey Rankings &bull; Stage 1 Prototype &bull; Modern Cinema Editorial
              Direction.
            </p>
            <p className="font-editorial italic text-xs">
              &ldquo;Cinema is a matter of what&apos;s in the frame and what&apos;s out.&rdquo; &mdash; Martin Scorsese
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
