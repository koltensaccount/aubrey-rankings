"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const res = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      });

      if (res?.error) {
        throw new Error(res.error.message || "Failed to process password reset request.");
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Failed to send reset link. Please try again.");
    } finally {
      setLoading(false);
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
            Reset Password
          </h1>
          <p className="text-xs text-[#9aa79e]">
            Enter your account email to receive a password recovery link.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="p-5 rounded-lg bg-[#18231e] border border-[#3b4c40] text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#89d5d5]/10 border border-[#89d5d5]/30 flex items-center justify-center text-[#89d5d5]">
              <CheckCircle2 size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-lg font-bold uppercase text-[#f1f0e9]">
                Check Your Inbox
              </h3>
              <p className="text-xs text-[#9aa79e] leading-relaxed">
                If an account exists for <strong className="text-[#89d5d5]">{email}</strong>, we have dispatched a secure recovery link.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#89d5d5] hover:underline pt-2"
            >
              <ArrowLeft size={13} />
              <span>Back to Sign In</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                Account Email Address
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

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full mt-2 py-3 rounded bg-[#d8e2d8] hover:bg-[#edf5ed] text-[#102523] text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Sending Link...</span>
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  <span>Send Recovery Link</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs text-[#8fa095] hover:text-[#f1f0e9] transition-colors"
              >
                <ArrowLeft size={13} />
                <span>Return to Sign In</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
