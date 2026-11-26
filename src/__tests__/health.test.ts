import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma client to ensure unit tests do NOT touch the live Neon database
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/health/route";

describe("Health API Route (/api/health)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return HTTP 200 and connected status on query success", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "ok",
      database: "connected",
    });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("should return HTTP 503 and unavailable status on database failure without leaking error details", async () => {
    // Simulate database network timeout or internal error with sensitive credentials
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(
      new Error("FATAL: connection to neon host postgresql://user:secret123@ep-xyz.neon.tech failed")
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      status: "error",
      database: "unavailable",
    });

    // Verify secrets, hostnames, and error messages are NEVER revealed in response
    const stringified = JSON.stringify(body);
    expect(stringified).not.toContain("secret123");
    expect(stringified).not.toContain("neon.tech");
    expect(stringified).not.toContain("FATAL");
  });
});
