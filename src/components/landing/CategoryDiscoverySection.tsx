import Link from "next/link";
import type { Category } from "@prisma/client";
import {
  ArrowUpRight,
  Bike,
  BookOpen,
  Laptop,
  Package,
  PenTool,
  Shirt,
  Watch,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_LIST } from "@/constants/categories";
import { cn } from "@/lib/utils";

const CATEGORY_ICON_MAP: Record<Category, LucideIcon> = {
  BOOKS: BookOpen,
  ELECTRONICS: Laptop,
  CYCLES: Bike,
  ACCESSORIES: Watch,
  STATIONERY: PenTool,
  CLOTHING: Shirt,
  OTHER: Package,
};

export function CategoryDiscoverySection() {
  return (
    <section className="border-b border-[#27272A] bg-[#09090B] py-16 sm:py-22">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-2.5">
            <p className="font-mono text-xs uppercase tracking-widest text-[#10B981]">
              Browse by Category
            </p>
            <h2 className="font-heading text-section-heading text-[#FAFAFA]">
              Jump straight into the gear your community trades most.
            </h2>
          </div>

          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#A1A1AA] transition-colors hover:text-[#34D399]"
          >
            <span>View full catalog</span>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-12">
          {CATEGORY_LIST.map((category, idx) => {
            const Icon = CATEGORY_ICON_MAP[category.value] ?? Package;
            const isFeatured = idx < 2;

            return (
              <Link
                key={category.value}
                href={`/marketplace?category=${category.value}`}
                className={cn(
                  "group relative flex flex-col justify-between rounded-2xl border border-[#27272A] bg-[#111113] p-5 card-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]",
                  isFeatured
                    ? "lg:col-span-6 sm:p-6"
                    : "lg:col-span-4"
                )}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#27272A] bg-[#18181B] text-[#34D399] transition-colors group-hover:border-[#10B981]/40 group-hover:bg-[#10B981]/10">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>

                    <ArrowUpRight
                      className="h-4 w-4 text-[#71717A] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#34D399]"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="font-heading text-base font-semibold text-[#FAFAFA] transition-colors group-hover:text-[#34D399]">
                      {category.label}
                    </h3>
                    <p className="text-xs leading-relaxed text-[#A1A1AA] sm:text-sm">
                      {category.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[#27272A]/80 pt-3.5">
                  {category.exampleItems.slice(0, 3).map((example) => (
                    <span
                      key={example}
                      className="rounded-md border border-[#27272A] bg-[#18181B] px-2 py-0.5 text-[11px] text-[#A1A1AA]"
                    >
                      {example}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
