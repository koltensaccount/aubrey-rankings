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
    <header className="sticky top-0 z-50 w-full border-b border-[#303b34] bg-[#111514]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link href="/" className="ar-brand">
            aubrey<span>rankings</span>
            <i />
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs text-[#939f98]">
            <Link
              href="/"
              className={`transition-colors py-1 ${
                pathname === "/" ? "text-[#f1f0e9] font-semibold" : "hover:text-[#f1f0e9]"
              }`}
            >
              Feed
            </Link>
            <Link
              href="/explore"
              className={`transition-colors py-1 ${
                pathname === "/explore" ? "text-[#f1f0e9] font-semibold" : "hover:text-[#f1f0e9]"
              }`}
            >
              Explore
            </Link>
            {session && (
              <>
                <Link
                  href="/profile"
                  className={`transition-colors py-1 ${
                    pathname === "/profile" ? "text-[#f1f0e9] font-semibold" : "hover:text-[#f1f0e9]"
                  }`}
                >
                  My Library
                </Link>
                <Link
                  href="/create"
                  className={`transition-colors py-1 ${
                    pathname === "/create" ? "text-[#f1f0e9] font-semibold" : "hover:text-[#f1f0e9]"
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
            <div className="h-8 w-20 rounded bg-[#1c2420] animate-pulse" />
          ) : session ? (
            <div className="flex items-center gap-3">
              <Link
                href="/create"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#d8e2d8] hover:bg-[#edf5ed] text-[#102523] text-xs font-semibold transition-colors"
              >
                <Plus size={14} />
                <span>New ranking</span>
              </Link>

              <Link
                href="/settings"
                title="Settings"
                className="p-2 text-[#939f98] hover:text-[#f1f0e9] transition-colors"
              >
                <Settings size={17} />
              </Link>

              <Link
                href="/profile"
                className="ar-avatar"
                aria-label="Your profile"
                title={session.user.name || session.user.email}
              >
                {initial}
              </Link>

              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-2 text-[#939f98] hover:text-red-400 transition-colors bg-transparent border-0 cursor-pointer"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-xs">
              <Link
                href="/login"
                className="text-[#939f98] hover:text-[#f1f0e9] transition-colors px-3 py-1.5 font-medium"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 rounded bg-[#89d5d5] hover:bg-[#a5dfdf] text-[#102523] font-semibold transition-colors"
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
