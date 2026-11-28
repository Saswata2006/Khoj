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
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
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
  const trimmedName = profile.name?.trim() || "";
  const welcomeHeading = trimmedName
    ? `Welcome back, ${trimmedName}`
    : "Welcome to your Khoj workspace";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar
        activePath="/dashboard"
        initialUser={{
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
        }}
      />

      <main className="flex-1">
        <WorkspaceShell
          active="overview"
          user={{
            name: profile.name,
            email: profile.email,
            role: profile.role,
          }}
        >
          {/* Personalized Workspace Hero Banner */}
          <section className="relative overflow-hidden rounded-2xl border border-[#27272A] bg-[#111113] p-6 sm:p-7 surface-specular">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#10B981]/10 blur-3xl"
            />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {profile.emailVerified ? (
                    <Badge variant="accent" className="gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Email Verified</span>
                    </Badge>
                  ) : (
                    <Badge variant="warning">Verification Pending</Badge>
                  )}

                  <Badge variant="outline">
                    {profile.role === "ADMIN" ? "Administrator" : "Community Member"}
                  </Badge>
                </div>

                <h1 className="font-heading text-section-heading text-[#FAFAFA]">
                  {welcomeHeading}
                </h1>

                <p className="text-xs sm:text-sm text-[#A1A1AA]">
                  {profile.email}
                  {profile.location ? ` • ${profile.location}` : ""}
                  {profile.hostelBlock ? ` • ${profile.hostelBlock}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Link
                  href="/marketplace/create"
                  className={cn(
                    buttonVariants({ variant: "accent", size: "sm" }),
                    "inline-flex items-center gap-1.5"
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
                    <Shield className="h-3.5 w-3.5 text-[#FBBF24]" />
                    <span>Admin Panel</span>
                  </Link>
                )}
                <LogoutButton variant="ghost" size="sm" />
              </div>
            </div>

            {/* Real DB Count Strip (Honest Metrics Only) */}
            <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-[#27272A] pt-5">
              <div className="rounded-xl border border-[#27272A] bg-[#18181B]/70 px-3.5 py-2.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#71717A]">
                  Listings
                </p>
                <p className="mt-0.5 font-heading text-xl font-semibold text-[#FAFAFA] price-tabular">
                  {counts.listings}
                </p>
              </div>
              <div className="rounded-xl border border-[#27272A] bg-[#18181B]/70 px-3.5 py-2.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#71717A]">
                  Contact Requests
                </p>
                <p className="mt-0.5 font-heading text-xl font-semibold text-[#FAFAFA] price-tabular">
                  {counts.contactRequests}
                </p>
              </div>
              <div className="rounded-xl border border-[#27272A] bg-[#18181B]/70 px-3.5 py-2.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#71717A]">
                  Claims
                </p>
                <p className="mt-0.5 font-heading text-xl font-semibold text-[#FAFAFA] price-tabular">
                  {counts.claims}
                </p>
              </div>
            </div>
          </section>

          {/* Asymmetric Workspace Row 1: Primary Listings Hub + Profile Readiness */}
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Listings Management Hub (7 cols) */}
            <Card className="lg:col-span-7 border-[#27272A] bg-[#111113]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4 text-[#10B981]" />
                    <span>My Listings</span>
                  </CardTitle>
                  <Badge variant="secondary" className="font-mono">
                    {counts.listings}
                  </Badge>
                </div>
                <CardDescription>
                  Manage active marketplace items, update details, or mark items sold.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-dashed border-[#27272A] bg-[#18181B]/60 p-6 text-center space-y-3">
                  <p className="text-sm font-medium text-[#FAFAFA]">
                    {counts.listings > 0
                      ? `${counts.listings} ${
                          counts.listings === 1 ? "listing" : "listings"
                        } in your account`
                      : "No listings yet"}
                  </p>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed max-w-md mx-auto">
                    {counts.listings > 0
                      ? "Review your active, sold, and archived items from the dedicated listings manager."
                      : "Post your first pre-owned textbook, gadget, cycle, or essential to Khoj Marketplace."}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                    <Link
                      href="/dashboard/listings"
                      className={cn(
                        buttonVariants({ variant: "default", size: "sm" }),
                        "inline-flex items-center gap-1.5 text-xs"
                      )}
                    >
                      <Package className="h-3.5 w-3.5" />
                      <span>Manage My Listings</span>
                    </Link>
                    <Link
                      href="/marketplace/create"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "inline-flex items-center gap-1.5 text-xs"
                      )}
                    >
                      <Plus className="h-3.5 w-3.5 text-[#10B981]" />
                      <span>
                        {counts.listings > 0 ? "Create Another" : "Create Listing"}
                      </span>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profile Readiness & Quick Discovery (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <Card className="border-[#27272A] bg-[#111113]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-[#10B981]" />
                      <span>Profile Completion</span>
                    </CardTitle>
                    <span className="font-mono text-xs font-semibold text-[#FAFAFA]">
                      {completion.completedCount}/{completion.totalCount}
                    </span>
                  </div>
                  <CardDescription>
                    {completion.isComplete
                      ? "Display name and general area configured for listings."
                      : `Add ${completion.missingFields.join(" and ")} so buyers know the meetup zone.`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#1C1C20]">
                    <div
                      className="h-full bg-[#10B981] transition-all"
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

              <Card className="border-[#27272A] bg-[#111113]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-[#10B981]" />
                      <span>Marketplace Catalog</span>
                    </CardTitle>
                    <Badge variant="accent" className="text-[10px]">
                      Live
                    </Badge>
                  </div>
                  <CardDescription>
                    Explore live listings across books, gadgets, cycles, and gear.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href="/marketplace"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "w-full text-xs inline-flex items-center justify-center gap-1.5"
                    )}
                  >
                    <ShoppingBag className="h-3.5 w-3.5 text-[#10B981]" />
                    <span>Browse Marketplace</span>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Row 2: Honest Request & Recovery States */}
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Contact Requests */}
            <Card className="border-[#27272A] bg-[#111113]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-[#A1A1AA]" />
                    <span>Contact Requests</span>
                  </CardTitle>
                  <Badge variant="secondary" className="font-mono">
                    {counts.contactRequests}
                  </Badge>
                </div>
                <CardDescription>
                  Private buyer-seller contact inquiries when enabled in UI.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-dashed border-[#27272A] bg-[#18181B]/60 p-5 text-center space-y-1.5">
                  <p className="text-sm font-medium text-[#FAFAFA]">
                    No contact requests
                  </p>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    Private seller contact threads will surface here once enabled.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Lost & Found Claims */}
            <Card className="border-[#27272A] bg-[#111113]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <HandHelping className="h-4 w-4 text-[#FBBF24]" />
                    <span>Lost &amp; Found Claims</span>
                  </CardTitle>
                  <Badge variant="warning" className="text-[10px]">
                    Launching Next
                  </Badge>
                </div>
                <CardDescription>
                  Ownership verification requests for recovered belongings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-dashed border-[#27272A] bg-[#18181B]/60 p-5 text-center space-y-2.5">
                  <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-[#FAFAFA]">
                    <Search className="h-3.5 w-3.5 text-[#FBBF24]" />
                    <span>No claims submitted</span>
                  </div>
                  <Link
                    href="/#lost-and-found"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "xs" }),
                      "inline-flex items-center gap-1.5"
                    )}
                  >
                    <Sparkles className="h-3 w-3 text-[#FBBF24]" />
                    <span>View Lost &amp; Found Preview</span>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Subtle Session Bar */}
          <section className="rounded-xl border border-[#27272A] bg-[#111113] p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-[#A1A1AA]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />
              <span>
                Signed in via passwordless email OTP with a 7-day database session.
              </span>
            </div>
            <Link
              href="/profile"
              className="font-medium text-[#FAFAFA] hover:text-[#34D399] transition-colors"
            >
              Manage profile &rarr;
            </Link>
          </section>
        </WorkspaceShell>
      </main>

      <Footer />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 sm:p-10 max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[256px_minmax(0,1fr)]">
        <Skeleton className="hidden lg:block h-[420px] rounded-2xl" />
        <div className="space-y-5">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <Skeleton className="lg:col-span-7 h-56 rounded-2xl" />
            <Skeleton className="lg:col-span-5 h-56 rounded-2xl" />
          </div>
        </div>
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
