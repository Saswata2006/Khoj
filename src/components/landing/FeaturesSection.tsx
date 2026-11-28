import Link from "next/link";
import {
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Clock,
  EyeOff,
  KeyRound,
  Search,
  ShoppingBag,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="border-b border-[#27272A] bg-[#09090B] py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-2.5">
            <p className="font-mono text-xs uppercase tracking-widest text-[#10B981]">
              Platform Architecture
            </p>
            <h2 className="font-heading text-section-heading text-[#FAFAFA]">
              Designed around speed, privacy, and clear state transitions.
            </h2>
          </div>

          <Link
            href="/marketplace"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "w-fit inline-flex items-center gap-1.5"
            )}
          >
            <span>Explore Catalog</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Asymmetric Bento Composition */}
        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Tile 1 (7 cols): Buying & Selling */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-[#27272A] bg-[#111113] p-6 sm:p-7 surface-specular transition-colors hover:border-[#3F3F46]">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#10B981]/30 bg-[#10B981]/12 text-[#34D399]">
                  <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                </span>
                <Badge variant="accent">Live Now</Badge>
              </div>

              <div className="space-y-2">
                <h3 className="font-heading text-xl font-semibold text-[#FAFAFA]">
                  Buying &amp; Selling Without Platform Friction
                </h3>
                <p className="max-w-xl text-sm leading-relaxed text-[#A1A1AA]">
                  Publish pre-owned books, electronics, cycles, and essentials with
                  fixed INR pricing, accurate condition tiers, and up to 5 photos.
                  Active listings go live immediately and lock cleanly once Sold.
                </p>
              </div>

              <ul className="grid grid-cols-1 gap-2 pt-2 text-xs text-[#A1A1AA] sm:grid-cols-2">
                {[
                  "Fixed INR pricing & condition tiers",
                  "One-click Sold status locking",
                  "Draft recovery on refresh",
                  "Direct photo queue management",
                ].map((point) => (
                  <li key={point} className="flex items-center gap-2">
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 text-[#10B981]"
                      aria-hidden="true"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-2.5 border-t border-[#27272A] pt-5">
              <Link
                href="/marketplace"
                className={cn(
                  buttonVariants({ variant: "accent", size: "sm" }),
                  "px-4"
                )}
              >
                Browse Marketplace
              </Link>
              <Link
                href="/marketplace/create"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "px-4"
                )}
              >
                Sell an Item
              </Link>
            </div>
          </div>

          {/* Tile 2 (5 cols): Advanced Product Discovery */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-[#27272A] bg-[#111113] p-6 surface-specular transition-colors hover:border-[#3F3F46]">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#27272A] bg-[#18181B] text-[#FAFAFA]">
                  <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-[11px] text-[#71717A]">
                  400ms Debounce
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="font-heading text-lg font-semibold text-[#FAFAFA]">
                  Advanced Product Discovery
                </h3>
                <p className="text-sm leading-relaxed text-[#A1A1AA]">
                  Filter concurrently by keyword, category, item condition, INR
                  price range, and general meetup area—with bookmarkable URL query
                  parameters and deterministic sorting.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-[#27272A] bg-[#18181B]/70 p-3 font-mono text-[11px] text-[#A1A1AA]">
              ?category=ELECTRONICS&amp;condition=LIKE_NEW&amp;sort=price_asc
            </div>
          </div>

          {/* Tile 3 (4 cols): Email-Verified Accounts (Honest Description) */}
          <div
            id="security"
            className="lg:col-span-4 rounded-2xl border border-[#27272A] bg-[#111113] p-6 surface-specular transition-colors hover:border-[#3F3F46]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#10B981]/30 bg-[#10B981]/12 text-[#34D399]">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              </span>
              <Badge variant="secondary">Email OTP</Badge>
            </div>

            <h3 className="mt-4 font-heading text-base font-semibold text-[#FAFAFA]">
              Email-Verified Accounts
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
              Every seller signs in using a 6-digit one-time email passcode. This
              verifies email address ownership for account access—without claiming
              real-world background screening or payment guarantees.
            </p>
          </div>

          {/* Tile 4 (4 cols): Seller Privacy & Signed Media */}
          <div className="lg:col-span-4 rounded-2xl border border-[#27272A] bg-[#111113] p-6 surface-specular transition-colors hover:border-[#3F3F46]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#27272A] bg-[#18181B] text-[#FAFAFA]">
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#27272A] bg-[#18181B] text-[#A1A1AA]">
                  <Camera className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <Badge variant="secondary">Privacy</Badge>
            </div>

            <h3 className="mt-4 font-heading text-base font-semibold text-[#FAFAFA]">
              Seller Privacy &amp; Validated Uploads
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
              Public listing views expose only display names, initials, and
              general meetup spots—never email addresses. Uploaded photos pass
              magic-byte and dimension validation via Cloudinary.
            </p>
          </div>

          {/* Tile 5 (4 cols): Lost & Found Upcoming Module */}
          <div
            id="lost-and-found"
            className="lg:col-span-4 rounded-2xl border border-[#27272A] bg-[#111113] p-6 surface-specular transition-colors hover:border-[#3F3F46]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/12 text-[#FBBF24]">
                <Search className="h-4 w-4" aria-hidden="true" />
              </span>
              <Badge variant="warning" className="gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                <span>Coming Soon</span>
              </Badge>
            </div>

            <h3 className="mt-4 font-heading text-base font-semibold text-[#FAFAFA]">
              Lost &amp; Found Recovery
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
              Structured lost &amp; found reporting with private ownership claim
              workflows and owner handover review is planned for the upcoming
              release.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
