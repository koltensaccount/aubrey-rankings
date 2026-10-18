"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { Bell, BellOff, Loader2, Sparkles, Tv, Film } from "lucide-react";

interface ReleaseTrackingToggleProps {
  collectionId: string;
  collectionType: string;
  tmdbId?: number | null;
  isOwner?: boolean;
}

export function ReleaseTrackingToggle({
  collectionId,
  collectionType,
  tmdbId,
  isOwner = false,
}: ReleaseTrackingToggleProps) {
  const { data: session } = useSession();
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    async function loadStatus() {
      if (!tmdbId || collectionType === "custom") {
        setSupported(false);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/collections/${collectionId}/tracking`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            setSupported(data.supported);
            setEnabled(data.enabled);
            setExplanation(data.explanation || "");
          }
        }
      } catch {
        // Ignore
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadStatus();
    return () => {
      isCancelled = true;
    };
  }, [collectionId, collectionType, tmdbId]);

  if (!supported || !session?.user) {
    return null;
  }

  const handleToggle = async () => {
    if (toggling) return;
    setToggling(true);
    const nextState = !enabled;
    setEnabled(nextState);

    try {
      const res = await fetch(`/api/collections/${collectionId}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextState }),
      });
      if (res.ok) {
        const data = await res.json();
        setEnabled(data.enabled);
      } else {
        // Rollback
        setEnabled(!nextState);
      }
    } catch {
      // Rollback
      setEnabled(!nextState);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading || toggling}
        title={explanation || "Notify me about new releases"}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
          enabled
            ? "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25"
            : "bg-surface text-muted-foreground border border-border hover:text-foreground hover:bg-surface-raised"
        }`}
      >
        {toggling ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : enabled ? (
          <>
            <Bell className="w-3.5 h-3.5 fill-primary/20" />
            <span>Tracking releases</span>
          </>
        ) : (
          <>
            <BellOff className="w-3.5 h-3.5" />
            <span>Notify new releases</span>
          </>
        )}
      </button>
    </div>
  );
}
