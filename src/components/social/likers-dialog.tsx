"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Liker = { id: string; name: string; username: string; image: string | null };

export function LikersDialog({ open, onOpenChange, collectionId, reviewId }: {
  open: boolean; onOpenChange: (open: boolean) => void; collectionId?: string; reviewId?: string;
}) {
  const [users, setUsers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setError(null);
    const query = reviewId ? `reviewId=${encodeURIComponent(reviewId)}` : `collectionId=${encodeURIComponent(collectionId || "")}`;
    fetch(`/api/social/like?${query}&list=true&limit=40`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load likes");
        setUsers(Array.isArray(data.users) ? data.users : []);
      })
      .catch((reason) => { if (reason?.name !== "AbortError") setError(reason?.message || "Could not load likes"); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, collectionId, reviewId]);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Liked by</DialogTitle></DialogHeader>
      <div className="max-h-80 overflow-y-auto space-y-1">
        {loading ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-primary" aria-label="Loading likes" /></div>
          : error ? <p role="alert" className="py-8 text-center text-sm text-destructive">{error}</p>
          : users.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No likes yet.</p>
          : users.map((person) => <Link key={person.id} href={`/u/${encodeURIComponent(person.username)}`} onClick={() => onOpenChange(false)} className="flex items-center gap-3 rounded-button p-2 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="w-9 h-9 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center font-semibold text-xs">{person.image ? <img src={person.image} alt="" className="w-full h-full object-cover" /> : (person.name || person.username).charAt(0).toUpperCase()}</span>
              <span className="min-w-0"><span className="block text-sm font-semibold truncate">{person.name || `@${person.username}`}</span><span className="block text-xs text-muted-foreground truncate">@{person.username}</span></span>
            </Link>)}
      </div>
    </DialogContent>
  </Dialog>;
}
