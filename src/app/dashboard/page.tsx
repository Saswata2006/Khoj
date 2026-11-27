import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  HandHelping,
  MessageSquare,
  Package,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { getCurrentUser } from "@/lib/authorization";
import { getDashboardSummary } from "@/lib/profile";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard — Khoj",
  description: "Your personal Khoj marketplace and lost & found workspace.",
};

async function DashboardContent() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirectTo=/dashboard");
  }

  const summary = await getDashboardSummary(user.id);
  if (!summary) {
    redirect("/login?redirectTo=/dashboard");
  }

  const { profile, completion, counts } = summary;
  const displayName = profile.name?.trim() || profile.email;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar
        initialUser={{
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
        }}
      />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Welcome & Account Actions Header */}
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {profile.emailVerified ? (
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-xs font-medium"
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-1 text-accent" />
                  Email Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Verification Pending
                </Badge>
              )}

              <Badge variant="outline" className="text-xs">
                {profile.role === "ADMIN" ? "Administrator" : "Community Member"}
              </Badge>
            </div>

            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Welcome back, {displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {profile.email}
              {profile.location ? ` • ${profile.location}` : ""}
              {profile.hostelBlock ? ` • ${profile.hostelBlock}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/marketplace/create"
              className={cn(
                buttonVariants({ size: "sm" }),
                "bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Sell an Item</span>
            </Link>
            <Link
              href="/profile"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "inline-flex items-center gap-1.5"
              )}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Profile Settings</span>
            </Link>

            {profile.role === "ADMIN" && (
              <Link
                href="/admin"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  "inline-flex items-center gap-1.5"
                )}
              >
                <Shield className="h-3.5 w-3.5 text-accent" />
                <span>Admin Panel</span>
              </Link>
            )}

            <LogoutButton />
          </div>
        </section>

        {/* Status & Quick Shortcuts */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Profile Completion Card */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-accent" />
                  <span>Profile Completion</span>
                </CardTitle>
                <span className="text-xs font-semibold text-foreground">
                  {completion.completedCount}/{completion.totalCount}
                </span>
              </div>
              <CardDescription>
                {completion.isComplete
                  ? "Your profile details are ready for community exchanges."
                  : `Add ${completion.missingFields.join(" and ")} so others know where to meet.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-accent transition-all"
                  style={{
                    width: `${(completion.completedCount / completion.totalCount) * 100}%`,
                  }}
                />
              </div>
              <Link
                href="/profile"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full text-xs"
                )}
              >
                {completion.isComplete ? "Review Profile" : "Complete Profile"}
              </Link>
            </CardContent>
          </Card>

          {/* Marketplace Shortcut */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-accent" />
                  <span>Marketplace</span>
                </CardTitle>
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-emerald-700 text-[10px]"
                >
                  Live
                </Badge>
              </div>
              <CardDescription>
                Browse active listings or sell textbooks, electronics, cycles,
                and essentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link
                href="/marketplace"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "flex-1 text-xs inline-flex items-center justify-center gap-1.5"
                )}
              >
                <ShoppingBag className="h-3.5 w-3.5 text-accent" />
                <span>Browse</span>
              </Link>
              <Link
                href="/marketplace/create"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "flex-1 bg-primary text-primary-foreground hover:bg-primary/90 text-xs inline-flex items-center justify-center gap-1.5"
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Sell Item</span>
              </Link>
            </CardContent>
          </Card>

          {/* Lost & Found Shortcut */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Search className="h-4 w-4 text-accent" />
                  <span>Lost &amp; Found</span>
                </CardTitle>
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-emerald-700 text-[10px]"
                >
                  Launching Next
                </Badge>
              </div>
              <CardDescription>
                Report lost belongings or verify ownership claims for found items.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/#lost-and-found"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full text-xs inline-flex items-center gap-1.5"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>View Lost &amp; Found Preview</span>
              </Link>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Activity Sections — Honest Empty States backed by real DB counts */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* My Listings */}
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span>My Listings</span>
                </CardTitle>
                <Badge variant="secondary">{counts.listings}</Badge>
              </div>
              <CardDescription>
                Items you have posted for sale or reported on Khoj.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center space-y-3">
                <p className="text-sm font-medium text-foreground">
                  {counts.listings > 0
                    ? `${counts.listings} ${
                        counts.listings === 1 ? "listing" : "listings"
                      } in your account`
                    : "No listings yet"}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {counts.listings > 0
                    ? "Manage your active, sold, and removed marketplace items from your listings workspace."
                    : "Post your first second-hand textbook, gadget, cycle, or essential to the Khoj Marketplace."}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Link
                    href="/dashboard/listings"
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      "bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 text-xs"
                    )}
                  >
                    <Package className="h-3.5 w-3.5" />
                    <span>Manage My Listings</span>
                  </Link>
                  <Link
                    href="/marketplace/create"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "inline-flex items-center gap-1.5 text-xs bg-card"
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>
                      {counts.listings > 0
                        ? "Create Another"
                        : "Create Listing"}
                    </span>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* My Claims */}
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <HandHelping className="h-4 w-4 text-primary" />
                  <span>My Claims</span>
                </CardTitle>
                <Badge variant="secondary">{counts.claims}</Badge>
              </div>
              <CardDescription>
                Ownership claims you submitted on found items.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center space-y-1.5">
                <p className="text-sm font-medium text-foreground">
                  No claims submitted
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Submitted ownership claims and verification statuses will
                  appear here.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Requests */}
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span>Contact Requests</span>
                </CardTitle>
                <Badge variant="secondary">{counts.contactRequests}</Badge>
              </div>
              <CardDescription>
                Seller contact requests you sent or received.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center space-y-1.5">
                <p className="text-sm font-medium text-foreground">
                  No contact requests
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Contact exchange requests will appear here once listings go
                  live.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Account Security Summary */}
        <section className="rounded-xl border border-border bg-card p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
            <span>
              Signed in with passwordless email OTP. Database-backed 7-day
              session active.
            </span>
          </div>
          <Link
            href="/profile"
            className="font-medium text-foreground hover:text-accent transition-colors"
          >
            Manage profile &rarr;
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 sm:p-10 max-w-7xl mx-auto space-y-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
