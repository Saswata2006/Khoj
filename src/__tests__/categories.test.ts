import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  CATEGORY_LIST,
  LISTING_TYPES,
  CONDITIONS,
  getCategoryMetadata,
  isValidCategory,
} from "@/constants/categories";

describe("Category Constants and Helpers", () => {
  it("should define all 7 required campus categories", () => {
    const requiredKeys = [
      "BOOKS",
      "ELECTRONICS",
      "CYCLES",
      "ACCESSORIES",
      "STATIONERY",
      "CLOTHING",
      "OTHER",
    ];

    expect(CATEGORY_LIST).toHaveLength(7);
    requiredKeys.forEach((key) => {
      expect(CATEGORIES).toHaveProperty(key);
      expect(CATEGORIES[key as keyof typeof CATEGORIES].label).toBeDefined();
      expect(CATEGORIES[key as keyof typeof CATEGORIES].icon).toBeDefined();
    });
  });

  it("should validate categories with isValidCategory", () => {
    expect(isValidCategory("BOOKS")).toBe(true);
    expect(isValidCategory("ELECTRONICS")).toBe(true);
    expect(isValidCategory("INVALID_CAT")).toBe(false);
  });

  it("should return category metadata or fallback to OTHER", () => {
    const books = getCategoryMetadata("BOOKS");
    expect(books.value).toBe("BOOKS");
    expect(books.label).toBe("Books & Study Material");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallback = getCategoryMetadata("NON_EXISTENT" as any);
    expect(fallback.value).toBe("OTHER");
  });

  it("should define valid listing types and conditions", () => {
    expect(LISTING_TYPES.SALE.label).toBe("Buy & Sell");
    expect(LISTING_TYPES.LOST.label).toBe("Lost Item");
    expect(LISTING_TYPES.FOUND.label).toBe("Found Item");

    expect(CONDITIONS.NEW.label).toBe("Brand New");
    expect(CONDITIONS.LIKE_NEW.label).toBe("Like New");
    expect(CONDITIONS.GOOD.label).toBe("Good");
    expect(CONDITIONS.FAIR.label).toBe("Fair");
  });
});
