"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Check, AlertCircle, ArrowRight, Sparkles, User, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getSafeCallbackUrl } from "@/lib/safe-url";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<{
    checked: boolean;
    available: boolean;
    reason?: string;
  }>({ checked: false, available: false });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending) {
      if (!session?.user) {
        router.push("/login");
      } else {
        // Pre-fill display name from session if available
        if (session.user.name && !displayName) {
          setDisplayName(session.user.name);
        }
        // If user already has a username in database, check profile
        fetch("/api/user/profile")
          .then((res) => res.json())
          .then((data) => {
            if (data?.user?.username && data.user.username.trim()) {
              const rawRedirect = typeof window !== "undefined"
                ? new URLSearchParams(window.location.search).get("redirect") || new URLSearchParams(window.location.search).get("callbackUrl")
                : null;
              const safeRedirect = getSafeCallbackUrl(rawRedirect, "/profile");
              router.push(safeRedirect);
            } else if (data?.user) {
              if (data.user.name && !displayName) {
                setDisplayName(data.user.name);
              }
              if (data.user.bio && !bio) {
                setBio(data.user.bio);
              }
            }
          })
          .catch(() => {});
      }
    }
  }, [session, isPending, router, displayName, bio]);

  // Debounce username availability check
  useEffect(() => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed || trimmed.length < 3) {
      setAvailability({ checked: false, available: false });
      return;
    }

    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await fetch(`/api/user/check-username?username=${encodeURIComponent(trimmed)}`);
        const json = await res.json();
        setAvailability({
          checked: true,
          available: json.available,
          reason: json.reason,
        });
      } catch (err) {
        setAvailability({
          checked: true,
          available: false,
          reason: "Error verifying availability.",
        });
      } finally {
        setChecking(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!availability.available || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          name: displayName.trim() || undefined,
          bio: bio.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to set username.");
      }

      const rawRedirect = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("redirect") || new URLSearchParams(window.location.search).get("callbackUrl")
        : null;
      const safeRedirect = getSafeCallbackUrl(rawRedirect, "/profile");
      router.push(safeRedirect);
      router.refresh();
    } catch (err: any) {
      setSubmitError(err?.message || "An unexpected error occurred.");
      setSubmitting(false);
    }
  };

  if (isPending) {
    return (
      <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground animate-pulse">
          Loading credentials...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-lg rounded-card border border-border-card bg-card p-8 shadow-card space-y-8">
        <div className="text-center space-y-2">
          <Link href="/" className="ar-brand justify-center">
            aubrey<span>rankings</span>
            <i />
          </Link>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-[10px] font-semibold uppercase tracking-widest text-primary-text mt-3">
            <Sparkles size={11} />
            Choose a Username
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-foreground pt-1">
            Claim Your Handle
          </h1>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Choose your unique public handle. This will identify your journal entries, critiques, and ranked collections across Aubrey Rankings.
          </p>
        </div>

        {submitError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username Input */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Unique Username *</span>
              <span className="text-[10px] text-muted-foreground/75">3–20 chars · a–z, 0–9, _</span>
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-muted-foreground/70 font-mono text-sm select-none">
                @
              </span>
              <input
                type="text"
                placeholder="cinemaphile"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                maxLength={20}
                required
                className="w-full h-11 pl-8 pr-10 rounded-input border border-border-input bg-surface text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
              <div className="absolute right-3">
                {checking ? (
                  <span className="text-[10px] text-muted-foreground animate-pulse">verifying...</span>
                ) : availability.checked ? (
                  availability.available ? (
                    <Check size={16} className="text-primary" />
                  ) : (
                    <AlertCircle size={16} className="text-destructive" />
                  )
                ) : null}
              </div>
            </div>

            {/* Availability message */}
            {availability.checked && (
              <p
                className={`text-[11px] flex items-center gap-1.5 ${
                  availability.available ? "text-primary-text" : "text-destructive"
                }`}
              >
                {availability.available ? (
                  <>
                    <ShieldCheck size={13} />
                    <span>Handle @{username} is available!</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={13} />
                    <span>{availability.reason}</span>
                  </>
                )}
              </p>
            )}
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Display Name
            </label>
            <input
              type="text"
              placeholder="Aubrey"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              className="w-full h-11 px-3.5 rounded-input border border-border-input bg-surface text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Bio (Optional)</span>
              <span className="text-[10px] text-muted-foreground/75">{bio.length}/300</span>
            </label>
            <textarea
              placeholder="Obsessive cataloger of dystopian sci-fi, 70mm epics, and Charlie Brooker nightmares."
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 300))}
              rows={3}
              className="w-full p-3 rounded-input border border-border-input bg-surface text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!availability.available || submitting}
            className="w-full h-12 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-display text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {submitting ? "Securing Handle..." : "Complete Registry & Enter"}
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
