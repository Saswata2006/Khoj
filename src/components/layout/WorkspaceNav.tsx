import Link from "next/link";
import { LayoutDashboard, Package, Plus, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WorkspaceNavProps {
  active: "overview" | "listings" | "profile" | "admin";
  isAdmin?: boolean;
}

export function WorkspaceNav({ active, isAdmin = false }: WorkspaceNavProps) {
  const items = [
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#27272A] bg-[#111113] p-2">
      <nav
        aria-label="Workspace navigation"
        className="flex flex-wrap items-center gap-1"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isCurrent = active === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
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
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#27272A] bg-[#18181B] px-3 py-1.5 text-xs font-medium text-[#FAFAFA] transition-colors hover:border-[#3F3F46] hover:text-[#34D399]"
      >
        <Plus className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
        <span>Sell Item</span>
      </Link>
    </div>
  );
}
