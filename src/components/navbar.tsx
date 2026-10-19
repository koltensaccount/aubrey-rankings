"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Plus, Settings, LogOut, Library, Compass, Rss } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";

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
    { href: "/", label: "My Library", icon: Library, active: pathname === "/" || pathname === "/profile" },
    { href: "/discover", label: "Discover", icon: Compass, active: pathname === "/discover" || pathname === "/explore" || pathname.startsWith("/media/") },
    { href: "/feed", label: "Feed", icon: Rss, active: pathname === "/feed" },
  ];

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link href="/" className="ar-brand">
            aubrey<span>rankings</span>
            <i />
          </Link>

          {/* Navigation Links */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-6 text-xs text-muted-foreground">
            {session ? primaryNavigation.map(({ href, label, active }) => (
              <Link key={href} href={href} className={`transition-colors py-1 ${active ? "text-foreground font-semibold" : "hover:text-foreground"}`}>
                {label}
              </Link>
            )) : (
              <Link href="/discover" className={`transition-colors py-1 ${pathname === "/discover" || pathname === "/explore" ? "text-foreground font-semibold" : "hover:text-foreground"}`}>
                Discover
              </Link>
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
                aria-label="New ranking"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded border border-border bg-secondary hover:bg-muted text-secondary-foreground text-xs font-semibold transition-colors"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">New ranking</span>
              </Link>

              <NotificationBell />

              <Link
                href="/settings"
                title="Settings"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings size={17} />
              </Link>

              <Link
                href={username ? `/u/${username}` : "/"}
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
      {session && !(session.user as any)?.username && pathname !== "/onboarding" && (
        <div className="bg-primary/10 border-t border-primary/20 py-2 px-4 text-center text-xs text-foreground flex items-center justify-center gap-2">
          <span>Complete your profile to unlock public rankings and social discovery.</span>
          <Link
            href="/onboarding"
            className="font-semibold text-primary underline hover:text-primary-hover inline-flex items-center gap-0.5"
          >
            Choose your handle →
          </Link>
        </div>
      )}
      {session && !isPending && (
        <nav aria-label="Mobile primary navigation" className="fixed inset-x-0 bottom-0 z-40 flex md:hidden border-t border-border bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md">
          {primaryNavigation.map(({ href, label, icon: Icon, active }) => (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-button text-[10px] font-semibold transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
