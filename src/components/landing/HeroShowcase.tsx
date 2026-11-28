import { BookOpen, Compass, Headphones, MapPin, ShieldCheck, SlidersHorizontal } from "lucide-react";

/**
 * Original layered abstract UI artwork representing Khoj's marketplace workflows
 * (discovery, verified email access, and item categories) without fabricated
 * listings, prices, or fake user metrics.
 */
export function HeroShowcase() {
  return (
    <div
      aria-label="Khoj platform architectural preview"
      className="relative mx-auto w-full max-w-lg animate-khoj-stagger-2"
    >
      {/* Subtle ambient emerald halo behind the composition */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 rounded-3xl bg-[radial-gradient(circle_at_60%_25%,rgba(16,185,129,0.14),transparent_65%)] blur-xl"
      />

      {/* Outer Architectural Frame */}
      <div className="relative overflow-hidden rounded-2xl border border-[#27272A] bg-[#111113] p-5 surface-specular">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-khoj-dots opacity-40"
        />

        {/* Top Bar Window Chrome */}
        <div className="relative flex items-center justify-between border-b border-[#27272A] pb-3.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#27272A]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27272A]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]/75" />
            <span className="ml-2 font-mono text-[11px] text-[#71717A]">
              khoj / marketplace
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-2.5 py-0.5 font-mono text-[10px] font-medium text-[#34D399]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
            <span>INR • URL SYNC</span>
          </span>
        </div>

        {/* Center Geometric Artwork + Floating Conceptual Frames */}
        <div className="relative mt-4 grid grid-cols-12 gap-3">
          {/* Abstract Radar / Compass Canvas */}
          <div className="col-span-12 rounded-xl border border-[#27272A] bg-[#0B0B0E] p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#10B981]">
                  Structured Discovery
                </p>
                <p className="font-heading text-sm font-medium text-[#FAFAFA]">
                  Instant keyword, price &amp; condition filtering
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="rounded-md border border-[#27272A] bg-[#141418] px-2 py-0.5 font-mono text-[10px] text-[#A1A1AA]">
                    category
                  </span>
                  <span className="rounded-md border border-[#27272A] bg-[#141418] px-2 py-0.5 font-mono text-[10px] text-[#A1A1AA]">
                    condition
                  </span>
                  <span className="rounded-md border border-[#10B981]/30 bg-[#10B981]/10 px-2 py-0.5 font-mono text-[10px] text-[#34D399]">
                    minPrice..maxPrice
                  </span>
                </div>
              </div>

              {/* Original Compass SVG Emblem */}
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-[#27272A] bg-[#111113]">
                <svg
                  viewBox="0 0 80 80"
                  fill="none"
                  className="h-16 w-16"
                  aria-hidden="true"
                >
                  <circle
                    cx="40"
                    cy="40"
                    r="30"
                    stroke="#27272A"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="19"
                    stroke="#10B981"
                    strokeOpacity="0.35"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M40 12V20M40 60V68M12 40H20M60 40H68"
                    stroke="#3F3F46"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M48 32L43 43L32 48L37 37L48 32Z"
                    fill="#10B981"
                    fillOpacity="0.22"
                    stroke="#34D399"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                  <circle cx="40" cy="40" r="2.2" fill="#FAFAFA" />
                </svg>
              </div>
            </div>
          </div>

          {/* Left Spec Card: Abstract Category Composition */}
          <div className="col-span-12 sm:col-span-7 rounded-xl border border-[#27272A] bg-[#141418] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#71717A]">
                Catalog Archetypes
              </span>
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-2.5 space-y-1.5">
                <BookOpen className="h-4 w-4 text-[#34D399]" aria-hidden="true" />
                <div className="h-1.5 w-14 rounded-full bg-[#27272A]" />
                <div className="h-1.5 w-9 rounded-full bg-[#27272A]/70" />
              </div>
              <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-2.5 space-y-1.5">
                <Headphones className="h-4 w-4 text-[#FAFAFA]" aria-hidden="true" />
                <div className="h-1.5 w-12 rounded-full bg-[#27272A]" />
                <div className="h-1.5 w-8 rounded-full bg-[#27272A]/70" />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#27272A] pt-2.5 text-[11px] text-[#A1A1AA]">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-[#10B981]" aria-hidden="true" />
                <span>General meetup area</span>
              </span>
              <span className="font-mono text-[10px] text-[#71717A]">4:3 Media</span>
            </div>
          </div>

          {/* Right Privacy & Verification Pill Card */}
          <div className="col-span-12 sm:col-span-5 flex flex-col justify-between rounded-xl border border-[#27272A] bg-[#18181B] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#10B981]/30 bg-[#10B981]/12 text-[#34D399]">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </span>
              <Compass className="h-3.5 w-3.5 text-[#71717A]" aria-hidden="true" />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#FAFAFA]">
                Privacy-first profiles
              </p>
              <p className="text-[11px] leading-relaxed text-[#A1A1AA]">
                Public cards show initials only. Emails require 6-digit OTP verification.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-[#27272A] bg-[#111113] px-2.5 py-1.5 font-mono text-[10px] text-[#A1A1AA]">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-[#1C1C20] text-[#34D399]">
                K
              </span>
              <span>No phone leaks</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
