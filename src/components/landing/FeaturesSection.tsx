import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShoppingBag, Search, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";

export function FeaturesSection() {
  return (
    <section id="features" className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-accent">
            Core Modules
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground font-heading">
            Built for local communities and campuses
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Whether you are selling pre-owned gear in your neighborhood, trading
            textbooks on campus, or helping recover a misplaced item, Khoj keeps
            everything organized.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1: Marketplace */}
          <Card
            id="marketplace"
            className="relative flex flex-col justify-between border-border bg-card shadow-xs hover:border-slate-400 transition-colors"
          >
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-emerald-400" />
                </div>
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/15 text-emerald-700 text-xs"
                >
                  Live Now
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold font-heading">
                Community Marketplace
              </CardTitle>
              <CardDescription className="text-sm">
                Buy and sell pre-owned books, electronics, cycles, and everyday
                items nearby.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>
                    Clear item condition grading (New, Like New, Good, Fair)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>
                    Structured contact requests coming soon &mdash; no public phone spam
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>
                    Organized categories for local neighborhoods and campus living
                  </span>
                </li>
              </ul>

              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href="/marketplace"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "bg-primary text-primary-foreground hover:bg-primary/90 text-xs inline-flex items-center gap-1.5"
                  )}
                >
                  <span>Browse Marketplace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/marketplace/create"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "text-xs"
                  )}
                >
                  Sell an Item
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Feature 2: Lost & Found */}
          <Card
            id="lost-and-found"
            className="relative flex flex-col justify-between border-border bg-card shadow-xs hover:border-slate-400 transition-colors"
          >
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="h-10 w-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <Search className="h-5 w-5" />
                </div>
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-emerald-700 text-xs"
                >
                  Coming Soon
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold font-heading">
                Lost &amp; Found Registry
              </CardTitle>
              <CardDescription className="text-sm">
                Structured listings for lost and found belongings with ownership
                claim reviews.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>
                    Ownership claims with identifying details before item handover
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>
                    Location notes for public venues, transit stops, or campus buildings
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>
                    Dedicated LOST and FOUND workflows separated from sales listings
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Feature 3: Trust & Safety */}
          <Card
            id="security"
            className="relative flex flex-col justify-between border-border bg-card shadow-xs hover:border-slate-400 transition-colors"
          >
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="h-10 w-10 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                </div>
                <Badge
                  variant="default"
                  className="bg-primary text-primary-foreground text-xs"
                >
                  Auth Active
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold font-heading">
                Email-Verified Accounts &amp; Reporting
              </CardTitle>
              <CardDescription className="text-sm">
                Passwordless email verification paired with structured reporting
                and local meetup tools.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>
                    Active now: 6-digit email OTP sign-in for personal or institutional emails
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>
                    Report suspicious activity and review flagged listings (Coming Soon)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>
                    Optional location and campus block profile settings for local meetups
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
