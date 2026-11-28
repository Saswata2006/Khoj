import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { HeroSearchForm } from "@/components/landing/HeroSearchForm";
import { HeroShowcase } from "@/components/landing/HeroShowcase";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const QUICK_CATEGORIES = [
  { label: "Books & Study", href: "/marketplace?category=BOOKS" },
  { label: "Electronics", href: "/marketplace?category=ELECTRONICS" },
  { label: "Cycles", href: "/marketplace?category=CYCLES" },
  { label: "Accessories", href: "/marketplace?category=ACCESSORIES" },
  { label: "Stationery", href: "/marketplace?category=STATIONERY" },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-[#27272A] bg-[#09090B]">
      {/* Architectural Grid + Subtle Emerald Vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-khoj-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_72%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[50rem] -translate-x-1/2 rounded-full bg-[#10B981]/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-18 lg:px-8 lg:pb-28 lg:pt-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
          {/* Editorial Column */}
          <div className="lg:col-span-7 space-y-7">
            <div className="animate-khoj-enter inline-flex items-center gap-2 rounded-full border border-[#27272A] bg-[#111113] px-3 py-1 text-xs font-medium text-[#A1A1AA] surface-specular">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#10B981]"
                aria-hidden="true"
              />
              <span>Verified Peer Marketplace &amp; Item Recovery</span>
            </div>

            <div className="animate-khoj-stagger-1 space-y-5">
              <h1 className="font-heading text-display-hero text-[#FAFAFA]">
                <span>Find it. Sell it. </span>
                <span className="bg-gradient-to-r from-[#FAFAFA] via-[#D1FAE5] to-[#34D399] bg-clip-text text-transparent">
                  Reclaim it.
                </span>
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-[#A1A1AA] sm:text-lg">
                A dedicated community marketplace for textbooks, gadgets, cycles,
                and everyday essentials—built around clear discovery and safe
                in-person meetups.
              </p>
            </div>

            {/* Search & Real Category Filter Shortcuts */}
            <div className="animate-khoj-stagger-2 max-w-xl space-y-3.5">
              <HeroSearchForm />

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-[#71717A]">
                  Popular:
                </span>
                {QUICK_CATEGORIES.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full border border-[#27272A] bg-[#111113] px-3 py-1 text-xs text-[#A1A1AA] transition-colors hover:border-[#3F3F46] hover:bg-[#18181B] hover:text-[#FAFAFA]"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Action Hierarchy */}
            <div className="animate-khoj-stagger-3 flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/marketplace"
                className={cn(
                  buttonVariants({ variant: "accent", size: "lg" }),
                  "h-11 px-6"
                )}
              >
                <span>Browse Marketplace</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/marketplace/create"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 px-5"
                )}
              >
                <Plus className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
                <span>Sell an Item</span>
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "h-11 px-4 text-[#A1A1AA] hover:text-[#FAFAFA]"
                )}
              >
                <span>Sign In</span>
              </Link>
            </div>
          </div>

          {/* Right Conceptual Marketplace Artwork */}
          <div className="lg:col-span-5">
            <HeroShowcase />
          </div>
        </div>
      </div>
    </section>
  );
}
