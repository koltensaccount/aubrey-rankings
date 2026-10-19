import { getServerSession } from "@/lib/server-session";
import { CommunityFeed } from "@/components/social/community-feed";

export default async function FeedPage() {
  const session = await getServerSession();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <header>
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Community activity</span>
        <h1 className="font-display text-4xl sm:text-5xl uppercase text-foreground tracking-tight mt-1">Feed</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">Follow people whose rankings and reviews you want to keep up with, or browse the wider community.</p>
      </header>
      <CommunityFeed isAuthenticated={Boolean(session)} />
    </div>
  );
}
