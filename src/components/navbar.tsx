"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Plus, Settings, LogOut } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  const initial = session?.user?.name
    ? session.user.name.charAt(0).toLowerCase()
    : session?.user?.email
      ? session.user.email.charAt(0).toLowerCase()
      : "a";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link href="/" className="ar-brand">
            aubrey<span>rankings</span>
            <i />
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs text-muted-foreground">
            <Link
              href="/"
              className={`transition-colors py-1 ${
                pathname === "/" ? "text-foreground font-semibold" : "hover:text-foreground"
              }`}
            >
              Feed
            </Link>
            <Link
              href="/explore"
              className={`transition-colors py-1 ${
                pathname === "/explore" ? "text-foreground font-semibold" : "hover:text-foreground"
              }`}
            >
              Explore
            </Link>
            {session && (
              <>
                <Link
                  href="/profile"
                  className={`transition-colors py-1 ${
                    pathname === "/profile" ? "text-foreground font-semibold" : "hover:text-foreground"
                  }`}
                >
                  My Library
                </Link>
                <Link
                  href="/create"
                  className={`transition-colors py-1 ${
                    pathname === "/create" ? "text-foreground font-semibold" : "hover:text-foreground"
                  }`}
                >
                  Create
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Right Section / Auth */}
        <div className="flex items-center gap-3">
          {isPending ? (
            <div className="h-8 w-20 rounded bg-muted animate-pulse" />
          ) : session ? (
            <div className="flex items-center gap-3">
              <Link
                href="/create"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded border border-border bg-secondary hover:bg-muted text-secondary-foreground text-xs font-semibold transition-colors"
              >
                <Plus size={14} />
                <span>New ranking</span>
              </Link>

              <Link
                href="/settings"
                title="Settings"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings size={17} />
              </Link>

              <Link
                href="/profile"
                className="ar-avatar overflow-hidden"
                aria-label="Your profile"
                title={session.user.name || session.user.email}
              >
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initial
                )}
              </Link>

              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-2 text-muted-foreground hover:text-red-400 transition-colors bg-transparent border-0 cursor-pointer"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-xs">
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 font-medium"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 rounded bg-primary hover:bg-primary-hover text-primary-foreground font-semibold transition-colors shadow-sm"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
