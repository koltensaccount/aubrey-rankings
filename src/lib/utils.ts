import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import crypto from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function nanoid(length = 16): string {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function roundScore(score: number | null | undefined, decimals = 1): number | null {
  if (score === null || score === undefined || isNaN(score)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(score * factor) / factor;
}
