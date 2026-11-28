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
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
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
          <Card className="w-full max-w-md border-[#EF4444]/30 bg-[#111113]">
            <CardHeader className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/15 text-[#FCA5A5]">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl font-semibold">
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
                  buttonVariants({ variant: "accent", size: "sm" }),
                  "w-full"
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
        activePath="/admin"
        initialUser={{
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role ?? "ADMIN",
        }}
      />

      <main className="flex-1">
        <WorkspaceShell
          active="admin"
          user={{
            name: adminUser.name,
            email: adminUser.email,
            role: adminUser.role ?? "ADMIN",
          }}
        >
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to dashboard</span>
            </Link>
          </div>

          <Card className="border-[#27272A] bg-[#111113]">
            <CardHeader className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Badge variant="accent" className="gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Admin Verified</span>
                </Badge>
              </div>
              <CardTitle className="font-heading text-2xl font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#10B981]" />
                <span>Khoj Administration</span>
              </CardTitle>
              <CardDescription>
                Protected workspace for community administrators ({adminUser.email}).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-dashed border-[#27272A] bg-[#18181B]/60 p-6 text-sm text-[#A1A1AA]">
                Server-side <code className="font-mono text-[#FAFAFA]">ADMIN</code>{" "}
                role authorization is active. Listing moderation and report review
                tools will be added in an upcoming milestone.
              </div>
            </CardContent>
          </Card>
        </WorkspaceShell>
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
