"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { AlertCircle } from "lucide-react";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (urlError) {
      if (urlError === "account_not_linked") {
        setError("An account already exists with that email. Please sign in with your email and password.");
      } else if (urlError === "access_denied") {
        setError("Sign-in request was canceled.");
      } else {
        setError("Google Sign-In could not be completed. Please try signing in with email.");
      }
    }
  }, [urlError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn.email({
        email,
        password,
      });

      if (res.error) {
        setError(res.error.message || "Invalid email or password.");
      } else {
        try {
          const profileRes = await fetch("/api/user/profile");
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            if (!profileData?.user?.username) {
              router.push("/onboarding");
              router.refresh();
              return;
            }
          }
        } catch {
          // If profile check fails, fallback to user payload
        }
        const user = res.data?.user as any;
        if (user && !user.username) {
          router.push("/onboarding");
        } else {
          router.push("/");
        }
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((res) => res.json())
      .then((data) => setGoogleAvailable(Boolean(data?.google)))
      .catch(() => setGoogleAvailable(false));
  }, []);

  const handleGoogleSignIn = async () => {
    setError(null);
    if (googleAvailable === false) {
      setError(
        "Google Sign-In is not configured on this instance. Please sign in with email and password."
      );
      return;
    }
    setGoogleLoading(true);
    try {
      const res = await signIn.social({
        provider: "google",
        callbackURL: "/onboarding",
        errorCallbackURL: "/login?error=oauth_error",
      });
      if (res?.error) {
        setError(
          res.error.message ||
            "Google Sign-In is not configured on this server. Please sign in with email and password."
        );
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Google Sign-In is currently unavailable. Please sign in with email and password."
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl space-y-6">
      <div className="text-center space-y-2">
        <Link href="/" className="ar-brand justify-center">
          aubrey<span>rankings</span>
          <i />
        </Link>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-foreground pt-2">
          Sign In
        </h1>
        <p className="text-xs text-muted-foreground">
          Access your curated media rankings and weighted ratings.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading || loading}
        className="w-full h-11 rounded-lg border border-border bg-secondary hover:bg-muted text-xs font-semibold uppercase tracking-wider text-secondary-foreground transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 shadow-sm"
      >
        <Image src="/brands/google-g.png" alt="" width={18} height={18.36} className="shrink-0" />
        {googleLoading
          ? "Connecting..."
          : googleAvailable === false
            ? "Continue with Google (Setup Required)"
            : "Continue with Google"}
      </button>

      <div className="relative flex items-center justify-center">
        <div className="border-t border-border w-full" />
        <span className="bg-card px-3 text-[10px] uppercase tracking-widest text-muted-foreground absolute">
          Or with email
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Email Address
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-input border border-input-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[11px] text-primary hover:underline font-medium"
            >
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-input border border-input-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 shadow-md"
        >
          {loading ? "Signing In..." : "Sign In"}
        </button>

        <p className="text-xs text-center text-muted-foreground pt-2">
          Don&apos;t have an account yet?{" "}
          <Link href="/signup" className="text-primary hover:underline font-medium">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-xs text-muted-foreground">Loading sign in...</div>}>
        <LoginFormContent />
      </Suspense>
    </div>
  );
}
