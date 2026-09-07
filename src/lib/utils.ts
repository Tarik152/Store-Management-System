import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number, currency = "$"): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const value = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${currency}${value}`;
}

/** Parse a user-typed decimal string ("12.50") into integer cents. */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.,-]/g, "").replace(",", ".");
  if (!cleaned || cleaned === "-") return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}
