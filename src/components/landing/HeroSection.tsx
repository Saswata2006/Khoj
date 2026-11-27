import Link from "next/link";
import { siteConfig } from "@/config/site";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ShoppingBag,
  ShieldCheck,
  MapPin,
  FileCheck2,
  ArrowRight,
  Store,
} from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
      {/* Background Decorative Accents */}
      <div className="absolute inset-0 -z-10 pointer-events-none flex items-center justify-center">
        <div className="h-[320px] w-[320px] sm:h-[480px] sm:w-[480px] rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="h-[240px] w-[240px] sm:h-[360px] sm:w-[360px] rounded-full bg-slate-900/5 blur-2xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-800 shadow-xs mb-6">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Community Marketplace &bull; Email-Verified Accounts</span>
        </div>

        {/* Hero Headline */}
        <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.12]">
          <span className="text-primary">{siteConfig.name}</span>
          <span className="text-accent ml-2">&mdash;</span>{" "}
          <span className="block mt-1 sm:inline sm:mt-0 text-foreground">
            {siteConfig.tagline}
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-5 text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          A community marketplace to buy and sell pre-owned items, report lost
          belongings, and reconnect people with what matters.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-lg mx-auto">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: "lg" }),
              "w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold h-11 px-6 shadow-sm"
            )}
          >
            <span>Get Started with Email OTP</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>

          <a
            href="#marketplace"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full sm:w-auto border-border text-foreground text-sm font-semibold h-11 px-6"
            )}
          >
            <ShoppingBag className="mr-2 h-4 w-4 text-accent" />
            <span>Explore Modules</span>
          </a>
        </div>

        {/* Secondary anchor */}
        <div className="mt-4">
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>See how Khoj works for local &amp; campus communities</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>

        {/* Key Highlights Ribbon */}
        <div className="mt-14 pt-10 border-t border-border/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
          <div className="p-4 rounded-lg bg-card border border-border/60 shadow-2xs">
            <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg">
              <ShieldCheck className="h-5 w-5 text-accent shrink-0" />
              <span>Email-Verified Accounts</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Passwordless 6-digit email OTP sign-in open to any valid email address
            </p>
          </div>

          <div className="p-4 rounded-lg bg-card border border-border/60 shadow-2xs">
            <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg">
              <Store className="h-5 w-5 text-accent shrink-0" />
              <span>Community Marketplace</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Buy and sell pre-owned essentials directly with zero listing fees (Coming Soon)
            </p>
          </div>

          <div className="p-4 rounded-lg bg-card border border-border/60 shadow-2xs">
            <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg">
              <MapPin className="h-5 w-5 text-accent shrink-0" />
              <span>Local Meetups</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Arrange convenient in-person handoffs in your neighborhood or campus
            </p>
          </div>

          <div className="p-4 rounded-lg bg-card border border-border/60 shadow-2xs">
            <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg">
              <FileCheck2 className="h-5 w-5 text-primary shrink-0" />
              <span>Ownership Claims</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Structured claim details to help return lost items to rightful owners (Coming Soon)
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
