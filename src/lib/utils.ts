import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an integer amount in minor units (cents) as a localized currency string. */
export function formatMoney(amountInCents: number, currency = "EUR", locale = "nl-BE"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amountInCents / 100);
}

/** Compact relative time, e.g. "nu", "5m", "3u", "2d", or a short date for older. */
export function timeAgo(date: Date, locale = "nl-BE"): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "nu";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}u`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date);
}
