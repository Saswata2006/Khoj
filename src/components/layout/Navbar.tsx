"use client";

import { useState } from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { MAIN_NAV_ITEMS } from "@/constants/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, ShieldCheck, Menu, X, ArrowUpRight } from "lucide-react";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <Search className="h-4.5 w-4.5 text-accent stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-heading text-xl font-bold tracking-tight text-foreground">
                {siteConfig.name}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Campus Exclusive
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {MAIN_NAV_ITEMS.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground rounded-md hover:bg-muted/60"
            >
              <span>{item.title}</span>
              {item.badge && (
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-emerald-700 text-[10px] font-semibold px-1.5 py-0 border-emerald-500/20"
                >
                  {item.badge}
                </Badge>
              )}
            </Link>
          ))}
        </nav>

        {/* Actions & Verification Indicator */}
        <div className="hidden sm:flex items-center gap-2.5">
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full border border-border">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            <span>College Email Required</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled
            className="cursor-not-allowed opacity-70 text-xs"
            title="Authentication launching on Day 2"
          >
            Sign In <span className="text-[10px] text-muted-foreground ml-1">(Coming Soon)</span>
          </Button>

          <a
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-primary text-primary-foreground hover:bg-primary/90 text-xs shadow-xs inline-flex items-center gap-1"
            )}
          >
            <span>GitHub</span>
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>

        {/* Mobile Menu Toggle Button */}
        <div className="flex sm:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-b border-border bg-card px-4 pt-3 pb-6 shadow-lg animate-in slide-in-from-top-2">
          <div className="flex flex-col gap-2">
            {MAIN_NAV_ITEMS.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                <span>{item.title}</span>
                {item.badge ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {item.badge}
                  </Badge>
                ) : null}
              </Link>
            ))}
            <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-1">
                <ShieldCheck className="h-4 w-4 text-accent" />
                <span>Verified College Students Only</span>
              </div>
              <Button disabled variant="outline" size="sm" className="w-full text-xs">
                Sign In (Coming Soon)
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
