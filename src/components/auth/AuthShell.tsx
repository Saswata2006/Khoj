import type { ReactNode } from "react";
import Link from "next/link";
import { Compass, ShieldCheck } from "lucide-react";
import { siteConfig } from "@/config/site";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-[#09090B] px-4 py-8 text-[#FAFAFA] sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-khoj-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-36 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-[#10B981]/10 blur-3xl"
      />

      {/* Minimal Header Brand Link */}
      <div className="relative mx-auto flex w-full max-w-md items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 rounded-lg py-1 pr-2 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#27272A] bg-[#111113] text-[#10B981]">
            <Compass className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="font-heading text-lg font-semibold tracking-tight text-[#FAFAFA]">
            {siteConfig.name}
          </span>
        </Link>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#27272A] bg-[#111113] px-3 py-1 text-[11px] font-medium text-[#A1A1AA]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
          <span>6-Digit Email OTP</span>
        </span>
      </div>

      {/* Centered Auth Card Slot */}
      <main className="relative mx-auto my-8 w-full max-w-md animate-khoj-enter">
        {children}
      </main>

      {/* Subtle Privacy Footer */}
      <footer className="relative mx-auto w-full max-w-md text-center text-xs text-[#71717A]">
        Passwordless one-time email codes protect account sign-in without storing
        static passwords.
      </footer>
    </div>
  );
}
