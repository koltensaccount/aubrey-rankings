"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Plus, Settings, LogOut, Library, Compass, Rss, PenLine, User, Database } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

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
  const username = (session?.user as { username?: string } | undefined)?.username;
  const primaryNavigation = [
    { href: "/", label: "Library", icon: Library, active: pathname === "/" || pathname === "/profile" || pathname.startsWith("/journal") },
    { href: "/discover", label: "Discover", icon: Compass, active: pathname === "/discover" || pathname === "/explore" || pathname.startsWith("/media/") },
    { href: "/feed", label: "Feed", icon: Rss, active: pathname === "/feed" },
  ];
  const mobileNavigation = session
    ? primaryNavigation
    : primaryNavigation.filter(({ href }) => href !== "/");

  const isTestMode = Boolean(
    (session?.user as any)?.isTestWorkspace ||
    session?.user?.id === "usr_test_import_workspace"
  );

  return (
    <>
      {isTestMode && (
        <aside
          role="region"
          aria-label="Test Workspace Active Banner"
          className="bg-primary/10 border-b border-primary/30 text-primary py-2 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-40 backdrop-blur-md"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-foreground shrink-0 border border-primary/40">
              Test Mode
            </span>
            <span className="truncate text-[11px] sm:text-xs text-foreground">
              Active workspace: <strong className="font-mono text-primary">usr_test_import_workspace</strong> (isolated from production accounts & feed)
            </span>
          </div>
          <button
            onClick={async () => {
              await fetch("/api/admin/import-lab/workspace/switch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: false }),
              });
              window.location.href = "/admin/import-lab";
            }}
            className="shrink-0 px-2.5 py-1 rounded bg-primary/20 hover:bg-primary/30 text-foreground border border-primary/40 font-medium text-[11px] transition-colors cursor-pointer"
          >
            Exit Test Mode
          </button>
        </aside>
      )}
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

          {/* Right-hand side actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {isPending ? (
              <div className="h-8 w-20 rounded-button bg-muted animate-pulse" />
            ) : session ? (
              <div className="flex items-center gap-1.5 sm:gap-2.5 xl:gap-3">
                {/* Priority 3: Main Add/Log action */}
                <Link
                  href="/discover"
                  aria-label="Add to Journal"
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-button border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors shrink-0"
                >
                  <PenLine size={13} />
                  <span className="hidden sm:inline">Journal</span>
                </Link>

                {/* Priority 5 (Promoted on Desktop): New ranking button on viewports >= 1024px */}
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

                {/* Familiar Desktop Control: Settings exposed directly on wide desktop viewports (>= 1280px) */}
                <Link
                  href="/settings"
                  title="Settings"
                  aria-label="Settings"
                  className="hidden xl:inline-flex p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0 rounded-button"
                >
                  <Settings size={17} />
                </Link>

                {/* Priority 4 & 5: Accessible Radix Dropdown Menu for User Profile */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="User account menu"
                      className="ar-avatar overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all select-none shrink-0"
                    >
                      {session.user.image ? (
                        <img src={session.user.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        initial
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8}>
                    <DropdownMenuLabel className="font-normal border-b border-border/80 pb-2">
                      <p className="text-xs font-bold text-foreground truncate">
                        {session.user.name || "Curator"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate font-mono">
                        {username ? `@${username}` : session.user.email}
                      </p>
                    </DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href={username ? `/u/${username}` : "/"}>
                        <User size={14} className="text-muted-foreground" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/create">
                        <Plus size={14} className="text-muted-foreground" />
                        <span>New ranking</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings">
                        <Settings size={14} className="text-muted-foreground" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/import-lab">
                        <Database size={14} className="text-muted-foreground" />
                        <span>Import Lab</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <LogOut size={14} />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Familiar Desktop Control: Sign out exposed directly on wide desktop viewports (>= 1280px) */}
                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Sign out"
                  aria-label="Sign out"
                  className="hidden xl:inline-flex p-2 text-muted-foreground hover:text-red-400 transition-colors bg-transparent border-0 cursor-pointer shrink-0 rounded-button"
                >
                  <LogOut size={16} />
                </button>
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
