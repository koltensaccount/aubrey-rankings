"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signUp, signIn } from "@/lib/auth-client";
import { AlertCircle } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signUp.email({
        name,
        email,
        password,
      });

      if (res.error) {
        setError(res.error.message || "Failed to create account. Please try again.");
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

  const handleGoogleSignUp = async () => {
    setError(null);
    if (googleAvailable === false) {
      setError(
        "Google Sign-Up is not configured on this instance. Please create an account with email and password."
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
            "Google Sign-Up is not configured on this server. Please create an account with email and password."
        );
        setGoogleLoading(false);
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Google Sign-Up is currently unavailable. Please create an account with email and password."
      );
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
            Create Account
          </h1>
          <p className="text-xs text-[#9aa79e]">
            Join Aubrey Rankings to build custom ratings and rank media collections.
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
          onClick={handleGoogleSignUp}
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
              Full Name
            </label>
            <input
              type="text"
              placeholder="Aubrey"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5] transition-colors"
            />
          </div>

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
            <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
              Password (min 8 characters)
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={loading}
              className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded bg-[#89d5d5] hover:bg-[#a5dfdf] text-[#102523] text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>

          <p className="text-xs text-center text-[#8fa095] pt-2">
            Already have an account?{" "}
            <Link href="/login" className="text-[#89d5d5] hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
