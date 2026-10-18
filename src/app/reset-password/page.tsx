"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Loader2 } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Invalid or expired password reset link.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await authClient.resetPassword({
        newPassword,
        token,
      });

      if (res?.error) {
        throw new Error(res.error.message || "Failed to reset password.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch (err: any) {
      setError(err?.message || "Password reset token is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-[#303b34] bg-[#141a17] p-8 shadow-2xl space-y-6">
      <div className="text-center space-y-2">
        <Link href="/" className="ar-brand justify-center">
          aubrey<span>rankings</span>
          <i />
        </Link>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-[#f1f0e9] pt-2">
          New Password
        </h1>
        <p className="text-xs text-[#9aa79e]">
          Choose a new secure password for your Aubrey Rankings account.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div className="p-5 rounded-lg bg-[#18231e] border border-[#3b4c40] text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#89d5d5]/10 border border-[#89d5d5]/30 flex items-center justify-center text-[#89d5d5]">
            <CheckCircle2 size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-lg font-bold uppercase text-[#f1f0e9]">
              Password Updated
            </h3>
            <p className="text-xs text-[#9aa79e] leading-relaxed">
              Your password has been securely reset. Redirecting to sign in...
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#89d5d5] hover:underline pt-2"
          >
            <span>Proceed to Sign In</span>
          </Link>
        </div>
      ) : !token ? (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-center space-y-3">
          <p className="text-xs text-red-400">
            No recovery token detected in the URL. Please request a new password reset link.
          </p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center gap-1.5 text-xs text-[#89d5d5] hover:underline"
          >
            <ArrowLeft size={13} />
            <span>Request New Reset Link</span>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
              New Password
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
              Confirm Password
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded bg-[#d8e2d8] hover:bg-[#edf5ed] text-[#102523] text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Updating Password...</span>
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                <span>Set New Password</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md p-10 text-center">
            <Loader2 className="h-6 w-6 text-[#89d5d5] animate-spin mx-auto" />
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
