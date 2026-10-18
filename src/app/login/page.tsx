"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { AlertCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        router.push("/");
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
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-[#303b34] bg-[#141a17] p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="ar-brand justify-center">
            aubrey<span>rankings</span>
            <i />
          </Link>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-[#f1f0e9] pt-2">
            Sign In
          </h1>
          <p className="text-xs text-[#9aa79e]">
            Access your curated media rankings and weighted ratings.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full h-11 rounded-md border border-[#303b34] bg-[#181f1b] hover:bg-[#202924] hover:border-[#414e45] text-xs font-semibold uppercase tracking-wider text-[#f1f0e9] transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
        >
          <Image src="/brands/google-g.png" alt="" width={18} height={18.36} className="shrink-0" />
          {googleLoading
            ? "Connecting..."
            : googleAvailable === false
              ? "Continue with Google (Setup Required)"
              : "Continue with Google"}
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#232d27] w-full" />
          <span className="bg-[#141a17] px-3 text-[10px] uppercase tracking-widest text-[#6c7d73] absolute">
            Or with email
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
              Email Address
            </label>
            <input
              type="email"
              placeholder="aubrey@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[11px] text-[#89d5d5] hover:underline"
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
              className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded bg-[#d8e2d8] hover:bg-[#edf5ed] text-[#102523] text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>

          <p className="text-xs text-center text-[#8fa095] pt-2">
            Don&apos;t have an account yet?{" "}
            <Link href="/signup" className="text-[#89d5d5] hover:underline font-medium">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
