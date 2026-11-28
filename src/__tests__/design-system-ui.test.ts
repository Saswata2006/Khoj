import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  redirect: vi.fn(),
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

import { HeroSearchForm } from "@/components/landing/HeroSearchForm";
import { HeroSection } from "@/components/landing/HeroSection";
import { HeroShowcase } from "@/components/landing/HeroShowcase";
import { CategoryDiscoverySection } from "@/components/landing/CategoryDiscoverySection";
import { Navbar } from "@/components/layout/Navbar";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { Select } from "@/components/ui/select";
import { StatePanel } from "@/components/ui/state-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LIST } from "@/constants/categories";

describe("Dark Design System V2 & Redesigned Components", () => {
  it("defines V2 expressive typography, specular depth, and reduced-motion tokens in globals.css", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "src/app/globals.css"),
      "utf-8"
    );
    expect(css).toContain("#09090B");
    expect(css).toContain("#111113");
    expect(css).toContain("#18181B");
    expect(css).toContain("#27272A");
    expect(css).toContain("#10B981");
    expect(css).toContain("text-display-hero");
    expect(css).toContain("clamp(");
    expect(css).toContain("surface-specular");
    expect(css).toContain("card-interactive");
    expect(css).toContain("price-tabular");
    expect(css).toContain("color-scheme: dark");
    expect(css).toContain("prefers-reduced-motion: reduce");

    const layout = fs.readFileSync(
      path.join(process.cwd(), "src/app/layout.tsx"),
      "utf-8"
    );
    expect(layout).toContain('themeColor: "#09090B"');
    expect(layout).toContain("dark h-full antialiased");
  });

  it("renders HeroSearchForm, HeroSection, HeroShowcase, and CategoryDiscoverySection with all real categories", () => {
    const searchHtml = renderToStaticMarkup(React.createElement(HeroSearchForm));
    expect(searchHtml).toContain('role="search"');
    expect(searchHtml).toContain('action="/marketplace"');
    expect(searchHtml).toContain('name="q"');

    const heroHtml = renderToStaticMarkup(React.createElement(HeroSection));
    expect(heroHtml).toContain("Find it. Sell it.");
    expect(heroHtml).toContain("Reclaim it.");
    expect(heroHtml).toContain('href="/marketplace?category=BOOKS"');
    expect(heroHtml).toContain('href="/marketplace?category=ELECTRONICS"');
    expect(heroHtml).not.toContain('href="/marketplace?category=FURNITURE"');
    expect(heroHtml).toContain('href="/marketplace/create"');
    expect(heroHtml).toContain('href="/login"');

    const showcaseHtml = renderToStaticMarkup(React.createElement(HeroShowcase));
    expect(showcaseHtml).toContain("Structured Discovery");
    expect(showcaseHtml).not.toContain("₹");

    const catHtml = renderToStaticMarkup(
      React.createElement(CategoryDiscoverySection)
    );
    for (const cat of CATEGORY_LIST) {
      expect(catHtml).toContain(`href="/marketplace?category=${cat.value}"`);
    }
  });

  it("renders floating Navbar dropdown for signed-in users without Sign In link", () => {
    const authNavHtml = renderToStaticMarkup(
      React.createElement(Navbar, {
        activePath: "/dashboard",
        initialUser: {
          id: "usr_1",
          name: "Riya Das",
          email: "riya@example.com",
          role: "USER",
        },
      })
    );
    expect(authNavHtml).toContain('aria-haspopup="menu"');
    expect(authNavHtml).toContain("RD");
    expect(authNavHtml).toContain('href="/profile"');
    expect(authNavHtml).toContain("Logout");
    expect(authNavHtml).not.toContain("Sign In");
    expect(authNavHtml).toContain('aria-current="page"');
  });

  it("renders WorkspaceShell, WorkspaceNav, Select, StatePanel, Button accent, and Badge variants accurately", () => {
    const shellHtml = renderToStaticMarkup(
      React.createElement(
        WorkspaceShell,
        {
          active: "overview",
          user: { name: null, email: "member@example.com", role: "ADMIN" },
        },
        React.createElement("div", null, "Overview content")
      )
    );
    expect(shellHtml).toContain("Workspace");
    expect(shellHtml).toContain('href="/dashboard"');
    expect(shellHtml).toContain('href="/dashboard/listings"');
    expect(shellHtml).toContain('href="/profile"');
    expect(shellHtml).toContain('href="/admin"');
    expect(shellHtml).toContain("Overview content");

    const navHtml = renderToStaticMarkup(
      React.createElement(WorkspaceNav, { active: "listings", isAdmin: true })
    );
    expect(navHtml).toContain('aria-current="page"');
    expect(navHtml).toContain('href="/dashboard/listings"');
    expect(navHtml).toContain('href="/admin"');
    expect(navHtml).toContain('href="/marketplace/create"');

    const selectHtml = renderToStaticMarkup(
      React.createElement(
        Select,
        { defaultValue: "BOOKS", hasError: true },
        React.createElement("option", { value: "BOOKS" }, "Books")
      )
    );
    expect(selectHtml).toContain('data-slot="select"');
    expect(selectHtml).toContain('aria-invalid="true"');

    const panelHtml = renderToStaticMarkup(
      React.createElement(StatePanel, {
        icon: React.createElement("span", null, "!"),
        title: "No listings found",
        description: "Try clearing filters.",
        tone: "error",
        role: "alert",
      })
    );
    expect(panelHtml).toContain('role="alert"');
    expect(panelHtml).toContain("No listings found");

    const ctaHtml = renderToStaticMarkup(
      React.createElement(Button, { variant: "accent" }, "Publish Listing")
    );
    expect(ctaHtml).toContain("bg-[#10B981]");

    const badgeHtml = renderToStaticMarkup(
      React.createElement(Badge, { variant: "warning" }, "Sold")
    );
    expect(badgeHtml).toContain("text-[#FBBF24]");
  });
});
