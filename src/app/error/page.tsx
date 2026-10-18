"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error") || searchParams.get("code") || "unknown_error";

  let title = "Authentication Error";
  let message = "An error occurred during authentication. Please try again.";

  switch (errorCode) {
    case "account_not_linked":
      title = "Account Linking Required";
      message =
        "An account already exists with this email address. Please sign in with your email and password, or use the original sign-in method.";
      break;
    case "access_denied":
      title = "Access Canceled";
      message = "The sign-in request was canceled. Please try again when you are ready.";
      break;
    case "configuration_error":
    case "oauth_error":
      title = "Provider Configuration Issue";
      message =
        "Could not complete Google Sign-In. Please check your network connection or sign in with email and password.";
      break;
    case "session_expired":
      title = "Session Expired";
      message = "Your session has expired. Please sign in again.";
      break;
    default:
      if (errorCode && errorCode !== "unknown_error") {
        message = `Authentication was interrupted (${errorCode}). Please return to sign in.`;
      }
      break;
  }

  return (
    <div className="w-full max-w-md rounded-card border border-border-card bg-card p-8 shadow-card space-y-6 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
        <AlertCircle size={24} />
      </div>

      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {message}
        </p>
      </div>

      <div className="pt-2">
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold uppercase tracking-wider transition-all shadow-sm"
        >
          <ArrowLeft size={14} />
          <span>Return to Sign In</span>
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="text-center text-xs text-muted-foreground">Loading error details...</div>
        }
      >
        <ErrorContent />
      </Suspense>
    </div>
  );
}
