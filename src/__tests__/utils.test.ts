import { describe, it, expect } from "vitest";
import { cn, formatPrice, formatDate } from "@/lib/utils";

describe("Utility Functions", () => {
  it("should merge tailwind classes properly with cn", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("text-red-500", undefined, null, false, "text-blue-500")).toBe("text-blue-500");
  });

  it("should format currency in INR properly with formatPrice", () => {
    expect(formatPrice(500)).toContain("500");
    expect(formatPrice(1250.5)).toContain("1,251");
    expect(formatPrice("750")).toContain("750");
    expect(formatPrice(null)).toBe("Free / Exchange");
    expect(formatPrice(undefined)).toBe("Free / Exchange");
    expect(formatPrice("invalid")).toBe("Free / Exchange");
  });

  it("should format dates properly with formatDate", () => {
    const formatted = formatDate(new Date("2026-11-27T00:00:00Z"));
    expect(formatted).toContain("Nov");
    expect(formatted).toContain("2026");
  });
});
