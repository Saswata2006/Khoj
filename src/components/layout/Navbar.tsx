"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Compass,
  LayoutDashboard,
  Menu,
  Package,
  Plus,
  Shield,
  ShoppingBag,
  User as UserIcon,
  X,
} from "lucide-react";
import { getSession } from "@/lib/auth-client";
import { computeUserInitials } from "@/lib/auth-ui";
import { MAIN_NAV_ITEMS } from "@/constants/navigation";
import { siteConfig } from "@/config/site";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NavbarUser {
  id: string;
  name?: string | null;
  email: string;
  role?: string | null;
}

interface NavbarProps {
  initialUser?: NavbarUser | null;
  activePath?: string;
}

const subscribePath = () => () => {};
const getClientPath = () =>
  typeof window !== "undefined" ? window.location.pathname : "";
const getServerPath = () => "";

export function Navbar({ initialUser = null, activePath }: NavbarProps) {
  const clientPath = useSyncExternalStore(
    subscribePath,
    getClientPath,
    getServerPath
  );
  const currentPath = activePath ?? clientPath;

  const [user, setUser] = useState<NavbarUser | null>(initialUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    getSession()
      .then((session) => {
        if (!active) return;

        if (session?.user) {
          const roleValue =
            "role" in session.user && typeof session.user.role === "string"
              ? session.user.role
              : null;
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

  useEffect(() => {
    if (!accountMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [accountMenuOpen]);

  const isAdmin = user?.role === "ADMIN";
  const initials = user ? computeUserInitials(user.name, user.email) : "";
  const shortName = user?.name?.trim()?.split(/\s+/)[0] || "Account";

  const isRouteActive = (href: string) => {
    if (!currentPath) return false;
    if (href === "/") return currentPath === "/";
    if (href === "/marketplace") {
      return (
        currentPath === "/marketplace" ||
        (currentPath.startsWith("/marketplace/") &&
          currentPath !== "/marketplace/create")
      );
    }
    if (href === "/dashboard") return currentPath === "/dashboard";
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  const navLinkClass = (active: boolean) =>
    cn(
      "relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-[#18181B] text-[#FAFAFA] border border-[#27272A]"
        : "text-[#A1A1AA] hover:bg-[#18181B]/75 hover:text-[#FAFAFA] border border-transparent"
    );

  return (
    <header className="sticky top-0 z-50 w-full pt-3 px-3 sm:px-6 lg:px-8 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-7xl rounded-2xl border border-[#27272A]/90 bg-[#0C0C0F]/88 px-3.5 sm:px-5 backdrop-blur-xl shadow-[0_14px_40px_-16px_rgba(0,0,0,0.92)]">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Refined Brand Wordmark */}
          <Link
            href="/"
            aria-current={isRouteActive("/") ? "page" : undefined}
            className="group inline-flex items-center gap-2.5 rounded-xl py-1 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]"
          >
            <span className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-[#27272A] bg-[#141418] text-[#10B981] transition-all duration-200 group-hover:border-[#10B981]/50 group-hover:bg-[#18181B]">
              <Compass className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="flex items-baseline gap-2">
              <span className="font-heading text-lg font-semibold tracking-tight text-[#FAFAFA]">
                {siteConfig.name}
              </span>
              <span className="hidden xl:inline-block font-mono text-[10px] uppercase tracking-widest text-[#71717A]">
                Campus &amp; Local
              </span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-1"
          >
            {!user ? (
              MAIN_NAV_ITEMS.map((item) => {
                const active = isRouteActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={navLinkClass(active)}
                  >
                    {item.href === "/marketplace" && (
                      <ShoppingBag
                        className="h-3.5 w-3.5 text-[#10B981]"
                        aria-hidden="true"
                      />
                    )}
                    <span>{item.title}</span>
                    {item.badge && (
                      <span className="hidden lg:inline-flex rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#FBBF24]">
                        Soon
                      </span>
                    )}
                    {active && (
                      <span
                        aria-hidden="true"
                        className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#10B981]"
                      />
                    )}
                  </Link>
                );
              })
            ) : (
              <>
                <Link
                  href="/marketplace"
                  aria-current={isRouteActive("/marketplace") ? "page" : undefined}
                  className={navLinkClass(isRouteActive("/marketplace"))}
                >
                  <ShoppingBag
                    className="h-3.5 w-3.5 text-[#10B981]"
                    aria-hidden="true"
                  />
                  <span>Marketplace</span>
                </Link>
                <Link
                  href="/dashboard"
                  aria-current={isRouteActive("/dashboard") ? "page" : undefined}
                  className={navLinkClass(isRouteActive("/dashboard"))}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  href="/dashboard/listings"
                  aria-current={
                    isRouteActive("/dashboard/listings") ? "page" : undefined
                  }
                  className={navLinkClass(isRouteActive("/dashboard/listings"))}
                >
                  <Package className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>My Listings</span>
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    aria-current={isRouteActive("/admin") ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors",
                      isRouteActive("/admin")
                        ? "border-[#F59E0B]/45 bg-[#F59E0B]/20 text-[#FCD34D]"
                        : "border-[#F59E0B]/25 bg-[#F59E0B]/10 text-[#FBBF24] hover:bg-[#F59E0B]/20"
                    )}
                  >
                    <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Admin</span>
                  </Link>
                )}
              </>
            )}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2.5">
            <Link
              href="/marketplace/create"
              className={cn(
                buttonVariants({
                  variant: user ? "accent" : "outline",
                  size: "sm",
                }),
                "inline-flex items-center gap-1.5"
              )}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sell</span>
            </Link>

            {user ? (
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  aria-controls="navbar-account-menu"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#27272A] bg-[#141418] py-1 pl-1 pr-2.5 text-xs font-medium text-[#FAFAFA] transition-colors hover:border-[#3F3F46] hover:bg-[#18181B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#27272A] bg-[#1C1C20] font-mono text-[11px] font-semibold text-[#34D399]">
                    {initials}
                  </span>
                  <span className="max-w-[100px] truncate">{shortName}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-[#71717A] transition-transform duration-150",
                      accountMenuOpen && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </button>

                {/* Dropdown Panel */}
                <div
                  id="navbar-account-menu"
                  role="menu"
                  aria-label="Account menu"
                  className={cn(
                    "absolute right-0 mt-2 w-60 origin-top-right rounded-xl border border-[#27272A] bg-[#141418] p-1.5 shadow-2xl surface-specular transition-all duration-150",
                    accountMenuOpen
                      ? "block opacity-100 scale-100"
                      : "hidden opacity-0 scale-95"
                  )}
                >
                  <div className="border-b border-[#27272A] px-3 py-2.5">
                    <p className="truncate text-xs font-semibold text-[#FAFAFA]">
                      {user.name?.trim() || "Khoj Member"}
                    </p>
                    <p className="truncate text-[11px] text-[#71717A]">
                      {user.email}
                    </p>
                  </div>

                  <div className="py-1 space-y-0.5">
                    <Link
                      href="/profile"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#A1A1AA] transition-colors hover:bg-[#1C1C20] hover:text-[#FAFAFA]"
                    >
                      <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Profile Settings</span>
                    </Link>
                    <Link
                      href="/dashboard/listings"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#A1A1AA] transition-colors hover:bg-[#1C1C20] hover:text-[#FAFAFA]"
                    >
                      <Package className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Manage Listings</span>
                    </Link>
                  </div>

                  <div className="border-t border-[#27272A] pt-1.5">
                    <LogoutButton
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start px-3 text-xs text-[#A1A1AA] hover:text-[#FCA5A5]"
                      onLoggedOut={() => setAccountMenuOpen(false)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "accent", size: "sm" }),
                  "px-3.5"
                )}
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Trigger Controls */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href="/marketplace/create"
              aria-label="Sell an item"
              className={cn(
                buttonVariants({ variant: "outline", size: "icon-sm" }),
                "border-[#27272A] text-[#34D399]"
              )}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#27272A] bg-[#141418] text-[#FAFAFA] transition-colors hover:bg-[#18181B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]"
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            id="mobile-nav-drawer"
            className="md:hidden border-t border-[#27272A] py-3 space-y-3"
          >
            <div className="grid gap-1">
              <Link
                href="/marketplace"
                onClick={() => setMobileMenuOpen(false)}
                className={navLinkClass(isRouteActive("/marketplace"))}
              >
                <ShoppingBag className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
                <span>Marketplace</span>
              </Link>
              <Link
                href="/marketplace/create"
                onClick={() => setMobileMenuOpen(false)}
                className={navLinkClass(isRouteActive("/marketplace/create"))}
              >
                <Plus className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
                <span>Sell an Item</span>
              </Link>

              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className={navLinkClass(isRouteActive("/dashboard"))}
                  >
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                    <span>Dashboard</span>
                  </Link>
                  <Link
                    href="/dashboard/listings"
                    onClick={() => setMobileMenuOpen(false)}
                    className={navLinkClass(isRouteActive("/dashboard/listings"))}
                  >
                    <Package className="h-4 w-4" aria-hidden="true" />
                    <span>My Listings</span>
                  </Link>
                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className={navLinkClass(isRouteActive("/profile"))}
                  >
                    <UserIcon className="h-4 w-4" aria-hidden="true" />
                    <span>Profile</span>
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#F59E0B]/25 bg-[#F59E0B]/10 px-3 py-2 text-sm font-medium text-[#FBBF24]"
                    >
                      <Shield className="h-4 w-4" aria-hidden="true" />
                      <span>Admin</span>
                    </Link>
                  )}
                </>
              ) : (
                <Link
                  href="/#lost-and-found"
                  onClick={() => setMobileMenuOpen(false)}
                  className={navLinkClass(false)}
                >
                  <span>Lost &amp; Found</span>
                  <span className="ml-auto rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-2 py-0.5 text-[10px] font-medium text-[#FBBF24]">
                    Soon
                  </span>
                </Link>
              )}
            </div>

            <div className="border-t border-[#27272A] pt-3">
              {user ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#27272A] bg-[#1C1C20] font-mono text-xs font-semibold text-[#34D399]">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[#FAFAFA]">
                        {user.name?.trim() || "Khoj Member"}
                      </p>
                      <p className="truncate text-[11px] text-[#71717A]">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <LogoutButton
                    variant="outline"
                    size="sm"
                    onLoggedOut={() => setMobileMenuOpen(false)}
                  />
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    buttonVariants({ variant: "accent", size: "default" }),
                    "w-full"
                  )}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
