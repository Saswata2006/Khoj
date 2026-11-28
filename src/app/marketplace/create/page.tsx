import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/authorization";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CreateListingForm } from "@/components/marketplace/CreateListingForm";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Create Listing — Khoj",
  description:
    "Create a new Khoj marketplace listing with product details and photos.",
};

async function CreateListingContent() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirectTo=/marketplace/create");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar
        activePath="/marketplace/create"
        initialUser={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role ?? undefined,
        }}
      />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <CreateListingForm />
      </main>

      <Footer />
    </div>
  );
}

function CreateListingSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 sm:p-10 max-w-6xl mx-auto space-y-6">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-9 w-72" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Skeleton className="lg:col-span-7 h-[520px] rounded-xl" />
        <div className="lg:col-span-5 space-y-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function CreateListingPage() {
  return (
    <Suspense fallback={<CreateListingSkeleton />}>
      <CreateListingContent />
    </Suspense>
  );
}
