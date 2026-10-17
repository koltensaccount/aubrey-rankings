"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Film,
  PlusCircle,
  Settings,
  LogOut,
  User,
  Sparkles,
} from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-lg tracking-tight hover:opacity-90 transition-opacity"
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-stone-950 font-black text-xl">
              A
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-white font-extrabold flex items-center gap-1.5">
                Aubrey <span className="text-amber-400">Rankings</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                Definitive Media Ratings
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          {session && (
            <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-border/60">
              <Link
                href="/"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/"
                    ? "bg-accent text-white"
                    : "text-muted-foreground hover:text-white hover:bg-accent/50"
                }`}
              >
                Library
              </Link>
              <Link
                href="/create"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/create"
                    ? "bg-accent text-white"
                    : "text-muted-foreground hover:text-white hover:bg-accent/50"
                }`}
              >
                New Ranking
              </Link>
            </nav>
          )}
        </div>

        {/* Right Section / Auth */}
        <div className="flex items-center gap-3">
          {isPending ? (
            <div className="h-8 w-24 rounded-lg bg-card animate-pulse" />
          ) : session ? (
            <div className="flex items-center gap-2.5">
              <Link href="/create">
                <Button size="sm" className="hidden sm:inline-flex gap-1.5 font-semibold">
                  <PlusCircle className="h-4 w-4" />
                  <span>Create Ranking</span>
                </Button>
              </Link>

              <Link href="/settings">
                <Button variant="ghost" size="icon" title="Settings" className="text-muted-foreground hover:text-white">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>

              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border/60 text-xs text-muted-foreground">
                <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-amber-300 font-semibold uppercase border border-amber-500/30">
                  {session.user.name ? session.user.name[0] : "U"}
                </div>
                <span className="font-medium text-slate-200 max-w-[120px] truncate">
                  {session.user.name || session.user.email}
                </span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                title="Log Out"
                className="text-muted-foreground hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Sign Up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
