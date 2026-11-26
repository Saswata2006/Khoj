import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines Tailwind CSS classes safely with clsx and twMerge.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a monetary amount in Indian Rupees (INR) with standard symbol and formatting.
 */
export function formatPrice(
  price: number | string | null | undefined,
  currency: string = "INR"
): string {
  if (price === null || price === undefined || price === "") {
    return "Free / Exchange";
  }

  const numericValue = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(numericValue)) {
    return "Free / Exchange";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(numericValue);
}

/**
 * Formats date into readable string.
 */
export function formatDate(date: Date | string | number): string {
  const parsed = new Date(date);
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}
