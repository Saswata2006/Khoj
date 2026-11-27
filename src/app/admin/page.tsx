import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  isAuthorizationError,
  requireAdmin,
} from "@/lib/authorization";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
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
  title: "Admin — Khoj",
  description: "Protected administrator area for Khoj.",
};

async function AdminContent() {
  let adminUser: Awaited<ReturnType<typeof requireAdmin>> | null = null;
  let forbidden = false;

  try {
    adminUser = await requireAdmin();
  } catch (error) {
    if (isAuthorizationError(error) && error.status === 401) {
      redirect("/login?redirectTo=/admin");
    }
    if (isAuthorizationError(error) && error.status === 403) {
      forbidden = true;
    } else {
      redirect("/login?redirectTo=/admin");
    }
  }

  if (forbidden || !adminUser) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md border-destructive/30 bg-card shadow-xs">
            <CardHeader className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl font-bold">
                Access Denied (403)
              </CardTitle>
              <CardDescription>
                Administrator privileges are required to view this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "w-full bg-primary text-primary-foreground"
                )}
              >
                Return to Dashboard
              </Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar
        initialUser={{
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role ?? "ADMIN",
        }}
      />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to dashboard</span>
          </Link>
        </div>

        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-xs"
              >
                <ShieldCheck className="h-3.5 w-3.5 mr-1 text-accent" />
                Admin Verified
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent" />
              <span>Khoj Administration</span>
            </CardTitle>
            <CardDescription>
              Protected workspace for community administrators ({adminUser.email}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
              Server-side <code className="font-mono text-foreground">ADMIN</code>{" "}
              role authorization is active. Listing moderation and report review
              tools will be added in an upcoming milestone.
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}

function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 sm:p-10 max-w-5xl mx-auto space-y-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-52 w-full rounded-xl" />
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminContent />
    </Suspense>
  );
}
