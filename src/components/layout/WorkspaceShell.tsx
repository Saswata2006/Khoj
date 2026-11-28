import type { ReactNode } from "react";
import Link from "next/link";
import {
  Clock,
  Compass,
  LayoutDashboard,
  MessageSquare,
  Package,
  Plus,
  Search,
  Shield,
  ShoppingBag,
  User,
} from "lucide-react";
import { computeUserInitials } from "@/lib/auth-ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WorkspaceShellProps {
  active: "overview" | "listings" | "profile" | "admin";
  user: {
    name?: string | null;
    email: string;
    role?: string | null;
  };
  children?: ReactNode;
}

export function WorkspaceShell({ active, user, children }: WorkspaceShellProps) {
  const isAdmin = user.role === "ADMIN";
  const initials = computeUserInitials(user.name, user.email);
  const displayName = user.name?.trim() || "Khoj Member";

  const navItems = [
    {
      key: "overview" as const,
      href: "/dashboard",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      key: "listings" as const,
      href: "/dashboard/listings",
      label: "My Listings",
      icon: Package,
    },
    {
      key: "profile" as const,
      href: "/profile",
      label: "Profile",
      icon: User,
    },
    ...(isAdmin
      ? [
          {
            key: "admin" as const,
            href: "/admin",
            label: "Admin",
            icon: Shield,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Compact Mobile Workspace Bar */}
      <div className="mb-6 flex flex-col gap-3 lg:hidden">
        <div className="flex items-center justify-between gap-2 overflow-x-auto rounded-xl border border-[#27272A] bg-[#111113] p-1.5">
          <nav
            aria-label="Mobile workspace navigation"
            className="flex items-center gap-1"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isCurrent = active === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    isCurrent
                      ? "border border-[#10B981]/35 bg-[#10B981]/12 text-[#34D399]"
                      : "border border-transparent text-[#A1A1AA] hover:bg-[#18181B] hover:text-[#FAFAFA]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <Link
            href="/marketplace/create"
            className={cn(
              buttonVariants({ variant: "accent", size: "xs" }),
              "shrink-0 inline-flex items-center gap-1"
            )}
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            <span>Sell</span>
          </Link>
        </div>
      </div>

      {/* Desktop Left Sidebar + Main Workspace Canvas */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[256px_minmax(0,1fr)] lg:items-start">
        <aside
          aria-label="Workspace sidebar"
          className="hidden lg:flex lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto flex-col gap-5 rounded-2xl border border-[#27272A] bg-[#111113] p-4 surface-specular"
        >
          {/* Compact Identity Chip */}
          <div className="flex items-center gap-3 border-b border-[#27272A] pb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#27272A] bg-[#18181B] font-mono text-xs font-semibold text-[#34D399]">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#FAFAFA]">
                {displayName}
              </p>
              <p className="truncate text-[11px] text-[#71717A]">
                {user.email}
              </p>
            </div>
          </div>

          {/* Primary Navigation */}
          <div className="space-y-1">
            <p className="px-2.5 pb-1 font-mono text-[10px] uppercase tracking-widest text-[#71717A]">
              Workspace
            </p>
            <nav aria-label="Desktop workspace navigation" className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isCurrent = active === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                      isCurrent
                        ? "border-[#10B981]/35 bg-[#10B981]/12 text-[#34D399]"
                        : "border-transparent text-[#A1A1AA] hover:bg-[#18181B] hover:text-[#FAFAFA]"
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.label}</span>
                    </span>
                    {isCurrent && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-[#10B981]"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Reserved Roadmap Slots (Honest Preview for Day 5 & Day 6) */}
          <div className="space-y-1 border-t border-[#27272A] pt-4">
            <p className="px-2.5 pb-1 font-mono text-[10px] uppercase tracking-widest text-[#71717A]">
              Upcoming Modules
            </p>
            <div className="flex items-center justify-between rounded-xl px-3 py-2 text-xs text-[#71717A]">
              <span className="inline-flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Contact Requests</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#27272A] bg-[#18181B] px-1.5 py-0.5 font-mono text-[9px]">
                <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                <span>Soon</span>
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl px-3 py-2 text-xs text-[#71717A]">
              <span className="inline-flex items-center gap-2">
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Lost &amp; Found</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#27272A] bg-[#18181B] px-1.5 py-0.5 font-mono text-[9px]">
                <Compass className="h-2.5 w-2.5" aria-hidden="true" />
                <span>Next</span>
              </span>
            </div>
          </div>

          {/* Primary Quick Actions */}
          <div className="space-y-2 border-t border-[#27272A] pt-4">
            <Link
              href="/marketplace/create"
              className={cn(
                buttonVariants({ variant: "accent", size: "sm" }),
                "w-full inline-flex items-center justify-center gap-1.5"
              )}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sell an Item</span>
            </Link>
            <Link
              href="/marketplace"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "w-full inline-flex items-center justify-center gap-1.5"
              )}
            >
              <ShoppingBag className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
              <span>Browse Marketplace</span>
            </Link>
          </div>
        </aside>

        {/* Main Workspace Content */}
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
