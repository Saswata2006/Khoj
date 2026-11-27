import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ---------------------------------------------------------------------------
// Mocks (no real database, no real emails, no Next runtime required)
// ---------------------------------------------------------------------------

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/authorization", async () => {
  const { AuthorizationError, isAuthorizationError } = await vi.importActual<
    typeof import("@/lib/authorization")
  >("@/lib/authorization");
  return {
    getCurrentUser: vi.fn(),
    requireUser: vi.fn(),
    requireAdmin: vi.fn(),
    AuthorizationError,
    isAuthorizationError,
  };
});

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    listing: { count: vi.fn() },
    claim: { count: vi.fn() },
    contactRequest: { count: vi.fn() },
  },
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    listing: { count: vi.fn() },
    claim: { count: vi.fn() },
    contactRequest: { count: vi.fn() },
  },
}));

vi.mock("@/lib/auth-client", () => ({
  sendOtp: vi.fn().mockResolvedValue({ success: true }),
  verifyOtp: vi.fn().mockResolvedValue({ success: true }),
  getSession: vi.fn().mockResolvedValue(null),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

import {
  AuthorizationError,
  requireAdmin,
  requireUser,
} from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { signOut } from "@/lib/auth-client";
import {
  computeUserInitials,
  sanitizeRedirectPath,
  POST_AUTH_REDIRECT_PATH,
} from "@/lib/auth-ui";
import {
  getDashboardSummary,
  getProfileCompletion,
  profileUpdateSchema,
  updateOwnProfile,
} from "@/lib/profile";
import { GET as profileGet, PATCH as profilePatch } from "@/app/api/profile/route";
import { Navbar } from "@/components/layout/Navbar";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ProfileForm } from "@/components/profile/ProfileForm";

// ---------------------------------------------------------------------------
// 1. Safe Redirect Destinations (Open Redirect Prevention)
// ---------------------------------------------------------------------------

describe("Safe redirect validation", () => {
  it("defaults post-auth redirect to /dashboard", () => {
    expect(POST_AUTH_REDIRECT_PATH).toBe("/dashboard");
    expect(sanitizeRedirectPath(undefined)).toBe("/dashboard");
    expect(sanitizeRedirectPath(null)).toBe("/dashboard");
    expect(sanitizeRedirectPath("")).toBe("/dashboard");
  });

  it("allows safe internal relative paths", () => {
    expect(sanitizeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/profile")).toBe("/profile");
    expect(sanitizeRedirectPath("/admin?tab=overview")).toBe("/admin?tab=overview");
  });

  it("blocks external URLs, protocol-relative URLs, backslashes, and auth loops", () => {
    expect(sanitizeRedirectPath("https://evil.example.com")).toBe("/dashboard");
    expect(sanitizeRedirectPath("//evil.example.com")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/\\evil.example.com")).toBe("/dashboard");
    expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/login")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/verify")).toBe("/dashboard");
  });
});

// ---------------------------------------------------------------------------
// 2. Profile Validation & Privilege Escalation Prevention
// ---------------------------------------------------------------------------

describe("Profile validation & allowlisting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts valid display name, location, and optional hostelBlock", () => {
    const parsed = profileUpdateSchema.parse({
      name: "  Aarav Mehta  ",
      location: "  North Campus  ",
      hostelBlock: "",
    });
    expect(parsed).toEqual({
      name: "Aarav Mehta",
      location: "North Campus",
      hostelBlock: null,
    });
  });

  it("rejects empty display name", () => {
    expect(() =>
      profileUpdateSchema.parse({ name: "   ", location: "Delhi" })
    ).toThrow();
  });

  it("rejects unknown or privileged fields (role, email, emailVerified, id)", () => {
    expect(() =>
      profileUpdateSchema.parse({
        name: "Attacker",
        role: "ADMIN",
      })
    ).toThrow();

    expect(() =>
      profileUpdateSchema.parse({
        name: "Attacker",
        email: "victim@example.com",
      })
    ).toThrow();

    expect(() =>
      profileUpdateSchema.parse({
        name: "Attacker",
        emailVerified: true,
      })
    ).toThrow();
  });

  it("updates only the authenticated user's record with allowlisted fields", async () => {
    const updatedRow = {
      id: "usr_1",
      name: "Priya Sen",
      email: "priya@example.com",
      emailVerified: true,
      image: null,
      location: "Powai",
      hostelBlock: "Hostel 2",
      role: "USER" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(prisma.user.update).mockResolvedValueOnce(updatedRow as never);

    const result = await updateOwnProfile("usr_1", {
      name: "Priya Sen",
      location: "Powai",
      hostelBlock: "Hostel 2",
    });

    expect(result.email).toBe("priya@example.com");
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "usr_1" },
        data: {
          name: "Priya Sen",
          location: "Powai",
          hostelBlock: "Hostel 2",
        },
      })
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Protected /api/profile Route Handler
// ---------------------------------------------------------------------------

describe("Protected /api/profile route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated GET with 401", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(
      new AuthorizationError("Authentication required.", 401)
    );

    const res = await profileGet();
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated PATCH with 401 before parsing body", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(
      new AuthorizationError("Authentication required.", 401)
    );

    const req = new Request("http://localhost:3000/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacker" }),
    });
    const res = await profilePatch(req);
    expect(res.status).toBe(401);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects privilege escalation in PATCH /api/profile with 400", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_1",
      email: "user@example.com",
      role: "USER",
    } as never);

    const req = new Request("http://localhost:3000/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "User", role: "ADMIN" }),
    });
    const res = await profilePatch(req);
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("updates authenticated user profile on valid PATCH", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_1",
      email: "user@example.com",
      role: "USER",
    } as never);

    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: "usr_1",
      name: "Updated Name",
      email: "user@example.com",
      emailVerified: true,
      image: null,
      location: "South Campus",
      hostelBlock: null,
      role: "USER",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const req = new Request("http://localhost:3000/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated Name",
        location: "South Campus",
        hostelBlock: "",
      }),
    });

    const res = await profilePatch(req);
    const json = (await res.json()) as { profile: { name: string; role: string } };
    expect(res.status).toBe(200);
    expect(json.profile.name).toBe("Updated Name");
    expect(json.profile.role).toBe("USER");
  });
});

// ---------------------------------------------------------------------------
// 4. Dashboard Summary & Profile Completion (Honest Counts)
// ---------------------------------------------------------------------------

describe("Dashboard summary & profile completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes profile completion accurately", () => {
    expect(getProfileCompletion({ name: "", location: null })).toEqual({
      isComplete: false,
      completedCount: 0,
      totalCount: 2,
      missingFields: ["Display name", "Location"],
    });

    expect(
      getProfileCompletion({ name: "Rohan", location: "Block C" })
    ).toEqual({
      isComplete: true,
      completedCount: 2,
      totalCount: 2,
      missingFields: [],
    });
  });

  it("returns real zero counts for new users without fabricating stats", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "usr_1",
      name: "New User",
      email: "new@example.com",
      emailVerified: true,
      image: null,
      location: null,
      hostelBlock: null,
      role: "USER",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(prisma.listing.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.claim.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.contactRequest.count).mockResolvedValueOnce(0);

    const summary = await getDashboardSummary("usr_1");
    expect(summary?.counts).toEqual({
      listings: 0,
      claims: 0,
      contactRequests: 0,
    });
    expect(summary?.completion.isComplete).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Session-Aware Navigation, ProfileForm & Admin Authorization
// ---------------------------------------------------------------------------

describe("Session-aware navigation, profile form & logout", () => {
  it("computes user initials from display name or email", () => {
    expect(computeUserInitials("Saswata Saha", "s@example.com")).toBe("SS");
    expect(computeUserInitials("Aarav", "a@example.com")).toBe("AA");
    expect(computeUserInitials("", "khoj@example.com")).toBe("KH");
  });

  it("renders Sign In for anonymous visitors in Navbar", () => {
    const html = renderToStaticMarkup(
      React.createElement(Navbar, { initialUser: null })
    );
    expect(html).toContain('href="/login"');
    expect(html).toContain("Sign In");
    expect(html).not.toContain("Logout");
  });

  it("renders Dashboard, Profile, initials, and Logout for authenticated USER without Admin link", () => {
    const html = renderToStaticMarkup(
      React.createElement(Navbar, {
        initialUser: {
          id: "usr_1",
          name: "Riya Das",
          email: "riya@example.com",
          role: "USER",
        },
      })
    );
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/profile"');
    expect(html).toContain("RD");
    expect(html).toContain("Logout");
    expect(html).not.toContain('href="/admin"');
  });

  it("renders Admin link for authenticated ADMIN user", () => {
    const html = renderToStaticMarkup(
      React.createElement(Navbar, {
        initialUser: {
          id: "usr_admin",
          name: "Admin User",
          email: "admin@example.com",
          role: "ADMIN",
        },
      })
    );
    expect(html).toContain('href="/admin"');
  });

  it("renders read-only verified email in ProfileForm", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProfileForm, {
        initialProfile: {
          id: "usr_1",
          name: "Riya Das",
          email: "riya@example.com",
          emailVerified: true,
          location: "North Campus",
          hostelBlock: "Hostel 1",
          role: "USER",
        },
      })
    );
    expect(html).toContain("riya@example.com");
    expect(html).toContain('aria-readonly="true"');
    expect(html).toContain("Verified");
    expect(html).toContain("Save Profile");
  });

  it("renders LogoutButton and wires signOut helper", async () => {
    const html = renderToStaticMarkup(React.createElement(LogoutButton));
    expect(html).toContain("Logout");
    await expect(signOut()).resolves.toBeUndefined();
  });

  it("rejects non-admin USER on requireAdmin authorization check", async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(
      new AuthorizationError("Admin access required.", 403)
    );
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });
});
