import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import {
  Search,
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  MapPin,
  Clock,
  ArrowRight,
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
        {/* Verification Status Pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-800 shadow-xs mb-6">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Campus Exclusive • Verified College Students Only</span>
        </div>

        {/* Hero Headline */}
        <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.12]">
          <span className="text-primary">{siteConfig.name}</span>
          <span className="text-accent ml-2">—</span>{" "}
          <span className="block mt-1 sm:inline sm:mt-0 text-foreground">
            {siteConfig.tagline}
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-5 text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          The unified campus platform to buy and sell second-hand course gear, report lost items,
          and securely reclaim belongings with verified student peers.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          <Button
            size="lg"
            disabled
            className="w-full sm:w-auto bg-primary text-primary-foreground opacity-90 cursor-not-allowed text-sm font-semibold h-11 px-6 shadow-sm"
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            <span>Marketplace (Coming Soon)</span>
          </Button>

          <Button
            size="lg"
            disabled
            variant="outline"
            className="w-full sm:w-auto border-border text-foreground opacity-90 cursor-not-allowed text-sm font-semibold h-11 px-6"
          >
            <Search className="mr-2 h-4 w-4 text-emerald-600" />
            <span>Lost & Found (Coming Soon)</span>
          </Button>
        </div>

        {/* Secondary anchor */}
        <div className="mt-4">
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Learn how Khoj works on your campus</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>

        {/* Key Highlights Ribbon */}
        <div className="mt-14 pt-10 border-t border-border/80 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
          <div className="p-3 rounded-lg bg-card border border-border/60 shadow-2xs">
            <div className="flex items-center gap-2 text-primary font-bold text-lg sm:text-xl">
              <ShieldCheck className="h-5 w-5 text-accent" />
              <span>100% Peer Verified</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Protected by college domain email authentication
            </p>
          </div>

          <div className="p-3 rounded-lg bg-card border border-border/60 shadow-2xs">
            <div className="flex items-center gap-2 text-primary font-bold text-lg sm:text-xl">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <span>0% Commission</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Direct student-to-student transactions with zero platform cut
            </p>
          </div>

          <div className="p-3 rounded-lg bg-card border border-border/60 shadow-2xs">
            <div className="flex items-center gap-2 text-primary font-bold text-lg sm:text-xl">
              <MapPin className="h-5 w-5 text-accent" />
              <span>Hostel Meetups</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Safe exchanges at known campus landmarks & dining halls
            </p>
          </div>

          <div className="p-3 rounded-lg bg-card border border-border/60 shadow-2xs">
            <div className="flex items-center gap-2 text-primary font-bold text-lg sm:text-xl">
              <Clock className="h-5 w-5 text-primary" />
              <span>Verified Claims</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ownership proof questions before releasing lost belongings
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
