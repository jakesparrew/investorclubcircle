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
