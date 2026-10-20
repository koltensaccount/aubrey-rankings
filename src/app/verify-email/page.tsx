"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { getSafeCallbackUrl } from "@/lib/safe-url";
import { Check, AlertCircle, Loader2, ArrowRight } from "lucide-react";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const callbackURL = getSafeCallbackUrl(searchParams.get("callbackURL"), "/settings?tab=account");

  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    token ? "verifying" : "error"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    token ? null : "No verification token was provided."
  );

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    authClient
      .verifyEmail({ query: { token } })
      .then((res) => {
        if (!isMounted) return;
        if (res.error) {
          setStatus("error");
          setErrorMessage(
            res.error.message ||
              "This verification link is invalid or has expired. Please request a new verification email from your account settings."
          );
        } else {
          setStatus("success");
          // Automatically redirect after brief visual confirmation
          setTimeout(() => {
            router.push(callbackURL);
            router.refresh();
          }, 2500);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setStatus("error");
        setErrorMessage(
          err?.message ||
            "Verification failed. The link may have expired. Please request a new verification email."
        );
      });

    return () => {
      isMounted = false;
    };
  }, [token, callbackURL, router]);

  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl space-y-6 text-center">
        <Link href="/" className="ar-brand justify-center">
          aubrey<span>rankings</span>
          <i />
        </Link>

        {status === "verifying" && (
          <div className="space-y-4 py-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary animate-pulse">
              <Loader2 size={24} className="animate-spin" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
                Verifying Email
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Please wait while we confirm your email address...
              </p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4 py-4">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
              <Check size={24} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
                Email Verified
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Your email has been confirmed. You can now connect Google and access all account features.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href={callbackURL}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-display text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
              >
                <span>Continue to Aubrey</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4 py-4">
            <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
              <AlertCircle size={24} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
                Verification Failed
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                {errorMessage || "The verification link has expired or is invalid."}
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                href="/settings?tab=account"
                className="inline-flex items-center justify-center px-4 py-2 rounded-button bg-surface hover:bg-surface-raised border border-border text-foreground text-xs font-semibold transition-colors"
              >
                Account Settings
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-4">
          <div className="text-muted-foreground text-xs animate-pulse">Loading verification...</div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
