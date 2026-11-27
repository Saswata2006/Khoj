import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, SearchX, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/authorization";
import { sanitizeRedirectPath } from "@/lib/auth-ui";
import { getOwnedMarketplaceListingForEdit } from "@/lib/services/listings";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { EditListingForm } from "@/components/marketplace/EditListingForm";
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
  title: "Edit Listing — Khoj",
  description:
    "Update your Khoj marketplace listing details, images, and availability.",
};

interface EditListingPageProps {
  params: Promise<{ id: string }>;
}

function EditUnavailableView({
  user,
  variant,
  title,
  description,
}: {
  user: {
    id: string;
    name?: string | null;
    email: string;
    role?: string | null;
  };
  variant: "not_found" | "forbidden" | "not_editable";
  title: string;
  description: string;
}) {
  const Icon =
    variant === "forbidden"
      ? ShieldAlert
      : variant === "not_editable"
        ? Lock
        : SearchX;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar
        initialUser={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role ?? undefined,
        }}
      />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card
          className={cn(
            "w-full max-w-md bg-card shadow-xs py-6",
            variant === "forbidden" ? "border-destructive/30" : "border-border"
          )}
        >
          <CardHeader className="px-6 space-y-2">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                variant === "forbidden"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl font-bold">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="px-6 flex flex-col sm:flex-row gap-2.5">
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ size: "sm" }),
                "flex-1 bg-primary text-primary-foreground"
              )}
            >
              Return to Dashboard
            </Link>
            <Link
              href="/marketplace/create"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "flex-1"
              )}
            >
              Create Listing
            </Link>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}

async function EditListingContent({ params }: EditListingPageProps) {
  const [user, { id }] = await Promise.all([getCurrentUser(), params]);

  if (!user) {
    const candidateTarget = /^[a-zA-Z0-9_-]+$/.test(id)
      ? `/marketplace/${id}/edit`
      : "/dashboard";
    const safeRedirect = sanitizeRedirectPath(candidateTarget, "/dashboard");
    redirect(`/login?redirectTo=${encodeURIComponent(safeRedirect)}`);
  }

  const check = await getOwnedMarketplaceListingForEdit(id, user.id);

  if (check.status === "not_found") {
    return (
      <EditUnavailableView
        user={user}
        variant="not_found"
        title="Listing Not Found (404)"
        description="This marketplace listing does not exist or may have been deleted."
      />
    );
  }

  if (check.status === "forbidden") {
    return (
      <EditUnavailableView
        user={user}
        variant="forbidden"
        title="Access Denied (403)"
        description="Only the seller who created this listing can edit its details or photos."
      />
    );
  }

  if (check.status === "not_editable") {
    return (
      <EditUnavailableView
        user={user}
        variant="not_editable"
        title={`Editing Locked (${check.listingStatus})`}
        description={
          check.listingStatus === "SOLD"
            ? "Sold listings are locked to preserve marketplace history and cannot be edited."
            : "This listing is no longer active and cannot be edited."
        }
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar
        initialUser={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role ?? undefined,
        }}
      />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <EditListingForm listing={check.listing} />
      </main>

      <Footer />
    </div>
  );
}

function EditListingSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 sm:p-10 max-w-6xl mx-auto space-y-6">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Skeleton className="lg:col-span-7 h-[540px] rounded-xl" />
        <div className="lg:col-span-5 space-y-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function EditListingPage({ params }: EditListingPageProps) {
  return (
    <Suspense fallback={<EditListingSkeleton />}>
      <EditListingContent params={params} />
    </Suspense>
  );
}
