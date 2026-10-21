"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Plus, Settings, LogOut, Library, Compass, Rss, PenLine, User } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  // Close profile menu upon route navigation
  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    setIsProfileMenuOpen(false);
    await signOut();
    router.push("/login");
    router.refresh();
  };

  const initial = session?.user?.name
    ? session.user.name.charAt(0).toLowerCase()
    : session?.user?.email
      ? session.user.email.charAt(0).toLowerCase()
      : "a";
  const username = (session?.user as { username?: string } | undefined)?.username;
  const primaryNavigation = [
    { href: "/", label: "Library", icon: Library, active: pathname === "/" || pathname === "/profile" || pathname.startsWith("/journal") },
    { href: "/discover", label: "Discover", icon: Compass, active: pathname === "/discover" || pathname === "/explore" || pathname.startsWith("/media/") },
    { href: "/feed", label: "Feed", icon: Rss, active: pathname === "/feed" },
  ];
  const mobileNavigation = session
    ? primaryNavigation
    : primaryNavigation.filter(({ href }) => href !== "/");

  return (
    <>
      <header className="sticky top-0 z-30 w-full border-b border-border bg-background/90 backdrop-blur-md transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Priority 1 & 2: Branding + Core Navigation */}
          <div className="flex items-center gap-4 sm:gap-6 lg:gap-8 min-w-0">
            <Link href="/" className="ar-brand shrink-0">
              aubrey<span>rankings</span>
              <i />
            </Link>

            {/* Desktop / Tablet Primary Navigation: activates at md (768px) with progressive spacing */}
            <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-4 lg:gap-6 text-xs text-muted-foreground whitespace-nowrap">
              {session ? primaryNavigation.map(({ href, label, active }) => (
                <Link
                  key={href}
                  href={href}
                  className={`transition-colors py-1 ${active ? "text-foreground font-semibold" : "hover:text-foreground"}`}
                >
                  {label}
                </Link>
              )) : (
                <Link
                  href="/discover"
                  className={`transition-colors py-1 ${pathname === "/discover" || pathname === "/explore" ? "text-foreground font-semibold" : "hover:text-foreground"}`}
                >
                  Discover
                </Link>
              )}
            </nav>
          </div>

          {/* Right-hand side actions (Priority 3, 4, 5) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {isPending ? (
              <div className="h-8 w-20 rounded-button bg-muted animate-pulse" />
            ) : session ? (
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Priority 3: Main Add/Log action */}
                <Link
                  href="/discover"
                  aria-label="Add to Journal"
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-button border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors shrink-0"
                >
                  <PenLine size={13} />
                  <span className="hidden sm:inline">Journal</span>
                </Link>

                {/* Priority 5 (Promoted on Desktop): New ranking button on large viewports (>=1024px) */}
                <Link
                  href="/create"
                  aria-label="New ranking"
                  className="hidden lg:inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-button border border-border bg-secondary hover:bg-muted text-secondary-foreground text-xs font-semibold transition-colors shrink-0"
                >
                  <Plus size={14} />
                  <span>New ranking</span>
                </Link>

                {/* Priority 4: Notifications bell */}
                <div className="shrink-0">
                  <NotificationBell />
                </div>

                {/* Priority 4 & 5: Accessible User Profile Trigger & Secondary Actions Menu */}
                <div className="relative shrink-0" ref={profileMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                    aria-expanded={isProfileMenuOpen}
                    aria-haspopup="menu"
                    aria-label="User account menu"
                    className="ar-avatar overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all select-none"
                  >
                    {session.user.image ? (
                      <img src={session.user.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initial
                    )}
                  </button>

                  {/* Accessible Profile / Secondary Overflow Dropdown Menu */}
                  {isProfileMenuOpen && (
                    <div
                      role="menu"
                      aria-orientation="vertical"
                      aria-label="User account menu options"
                      className="absolute right-0 mt-2 w-52 sm:w-56 rounded-card border border-border bg-card shadow-dialog p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                    >
                      {/* User Identity Header */}
                      <div className="px-3 py-2 border-b border-border/80 mb-1">
                        <p className="text-xs font-bold text-foreground truncate">
                          {session.user.name || "Curator"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate font-mono">
                          {username ? `@${username}` : session.user.email}
                        </p>
                      </div>

                      {/* Profile Link */}
                      <Link
                        href={username ? `/u/${username}` : "/"}
                        role="menuitem"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-button text-xs font-medium text-foreground hover:bg-surface-elevated transition-colors"
                      >
                        <User size={14} className="text-muted-foreground" />
                        <span>Profile</span>
                      </Link>

                      {/* New Ranking Action (Always accessible even when navbar button folds) */}
                      <Link
                        href="/create"
                        role="menuitem"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-button text-xs font-medium text-foreground hover:bg-surface-elevated transition-colors"
                      >
                        <Plus size={14} className="text-muted-foreground" />
                        <span>New ranking</span>
                      </Link>

                      {/* Settings */}
                      <Link
                        href="/settings"
                        role="menuitem"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-button text-xs font-medium text-foreground hover:bg-surface-elevated transition-colors"
                      >
                        <Settings size={14} className="text-muted-foreground" />
                        <span>Settings</span>
                      </Link>

                      {/* Divider */}
                      <div className="border-t border-border/80 my-1" role="separator" />

                      {/* Sign Out Action */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-button text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer"
                      >
                        <LogOut size={14} />
                        <span>Sign out</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3 text-xs shrink-0">
                <Link
                  href="/login"
                  className="text-muted-foreground hover:text-foreground transition-colors px-2.5 sm:px-3 py-1.5 font-medium whitespace-nowrap"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="px-3 sm:px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-semibold transition-colors shadow-xs whitespace-nowrap"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Handle Completion Alert Banner (Responsive flex-wrap) */}
        {session && !(session.user as { username?: string }).username && pathname !== "/onboarding" && (
          <div className="bg-primary/10 border-t border-primary/20 py-2 px-4 text-center text-xs text-foreground flex flex-wrap items-center justify-center gap-2">
            <span>Complete your profile to unlock public rankings and social discovery.</span>
            <Link
              href="/onboarding"
              className="font-semibold text-primary underline hover:text-primary-hover inline-flex items-center gap-0.5 whitespace-nowrap"
            >
              Choose your handle →
            </Link>
          </div>
        )}
      </header>

      {/* Phone Mobile Bottom Navigation: Fixed to bottom on < md */}
      {!isPending && (
        <nav
          aria-label={session ? "Mobile primary navigation" : "Mobile public navigation"}
          className="fixed inset-x-0 bottom-0 z-40 flex md:hidden border-t border-border bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md"
        >
          {mobileNavigation.map(({ href, label, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-button text-[10px] font-semibold transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
