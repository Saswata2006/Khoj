import { describe, it, expect } from "vitest";
import { siteConfig } from "@/config/site";
import { campusConfig } from "@/config/campus";

describe("Site Configuration", () => {
  it("should have correct branding, name and tagline", () => {
    expect(siteConfig.name).toBe("Khoj");
    expect(siteConfig.tagline).toBe("Find it. Sell it. Reclaim it.");
    expect(siteConfig.description).toContain("marketplace");
  });

  it("should include defined navigation items with badges", () => {
    expect(siteConfig.navItems.length).toBeGreaterThan(0);
    const marketplace = siteConfig.navItems.find((item) => item.label === "Marketplace");
    expect(marketplace).toBeDefined();
    expect(marketplace?.badge).toBe("Coming Soon");

    const lostAndFound = siteConfig.navItems.find((item) => item.label === "Lost & Found");
    expect(lostAndFound).toBeDefined();
    expect(lostAndFound?.badge).toBe("Coming Soon");
  });
});

describe("Platform Configuration", () => {
  it("should define configurable hostel blocks without hardcoded campus assumptions", () => {
    expect(campusConfig.hostelBlocks).toBeDefined();
    expect(Array.isArray(campusConfig.hostelBlocks)).toBe(true);
    expect(campusConfig.hostelBlocks.length).toBeGreaterThan(0);
  });

  it("should allow all valid emails with no college-domain or hostel-block restriction", () => {
    expect(campusConfig.verification.requireCollegeEmail).toBe(false);
    expect(campusConfig.verification.requireHostelBlock).toBe(false);
    expect(campusConfig.platformName).toBeTruthy();
    expect(campusConfig.supportEmail).toContain("@");
  });
});
