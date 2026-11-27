"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { siteConfig } from "@/config/site";
import { MAIN_NAV_ITEMS } from "@/constants/navigation";
import { getSession, signOut } from "@/lib/auth-client";
import { computeUserInitials } from "@/lib/auth-ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Search,
  Menu,
  X,
  LayoutDashboard,
  User as UserIcon,
  LogOut,
  Loader2,
  Shield,
} from "lucide-react";

export interface NavbarUser {
  id: string;
  name?: string | null;
  email: string;
  role?: string;
}

interface NavbarProps {
  initialUser?: NavbarUser | null;
}

export function Navbar({ initialUser = null }: NavbarProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<NavbarUser | null>(initialUser);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    getSession()
      .then((session) => {
        if (!active) return;
        if (session?.user) {
          const roleValue =
            "role" in session.user && typeof session.user.role === "string"
              ? session.user.role
              : undefined;
          setUser({
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            role: roleValue,
          });
        } else if (initialUser === null) {
          setUser(null);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [initialUser]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await signOut();
      setUser(null);
      setMobileMenuOpen(false);
      router.replace("/");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const initials = user ? computeUserInitials(user.name, user.email) : "";
  const displayLabel = user?.name?.trim() || user?.email || "";

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
              {siteConfig.tagline}
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

        {/* Desktop Session-Aware Actions */}
        <div className="hidden sm:flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "text-xs font-medium inline-flex items-center gap-1.5"
                )}
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-accent" />
                <span>Dashboard</span>
              </Link>

              <Link
                href="/profile"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "text-xs font-medium inline-flex items-center gap-1.5"
                )}
              >
                <UserIcon className="h-3.5 w-3.5" />
                <span>Profile</span>
              </Link>

              {user.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "text-xs font-medium inline-flex items-center gap-1"
                  )}
                >
                  <Shield className="h-3.5 w-3.5 text-accent" />
                  <span>Admin</span>
                </Link>
              )}

              <Link
                href="/profile"
                title={displayLabel}
                aria-label={`Signed in as ${displayLabel}`}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold ring-2 ring-accent/30 hover:ring-accent transition-all"
              >
                {initials}
              </Link>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="text-xs inline-flex items-center gap-1.5"
              >
                {isLoggingOut ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5" />
                )}
                <span>Logout</span>
              </Button>
            </>
          ) : (
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "text-xs"
              )}
            >
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile Menu Toggle Button */}
        <div className="flex sm:hidden items-center gap-2">
          {user && (
            <Link
              href="/profile"
              aria-label={`Signed in as ${displayLabel}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold"
            >
              {initials}
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-b border-border bg-card px-4 pt-3 pb-6 shadow-lg">
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

            <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
              {user ? (
                <>
                  <div className="flex items-center gap-2.5 px-3 py-1.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {displayLabel}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "w-full justify-start text-xs gap-2"
                    )}
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 text-accent" />
                    <span>Dashboard</span>
                  </Link>

                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "w-full justify-start text-xs gap-2"
                    )}
                  >
                    <UserIcon className="h-3.5 w-3.5" />
                    <span>Profile</span>
                  </Link>

                  {user.role === "ADMIN" && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "w-full justify-start text-xs gap-2"
                      )}
                    >
                      <Shield className="h-3.5 w-3.5 text-accent" />
                      <span>Admin</span>
                    </Link>
                  )}

                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full justify-start text-xs gap-2"
                  >
                    {isLoggingOut ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LogOut className="h-3.5 w-3.5" />
                    )}
                    <span>{isLoggingOut ? "Signing out..." : "Logout"}</span>
                  </Button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "w-full text-xs"
                  )}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
