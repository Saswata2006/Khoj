import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function ListingNotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-[#27272A] bg-[#111113] py-6">
          <CardHeader className="px-6 space-y-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#27272A] bg-[#18181B] text-[#A1A1AA]">
              <SearchX className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl font-semibold">
              Listing Not Found
            </CardTitle>
            <CardDescription>
              This marketplace item does not exist, has been removed by the
              seller, or is no longer available.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 flex flex-col sm:flex-row gap-2.5">
            <Link
              href="/marketplace"
              className={cn(
                buttonVariants({ variant: "accent", size: "sm" }),
                "flex-1 inline-flex items-center justify-center gap-1.5"
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Browse Marketplace</span>
            </Link>
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "flex-1"
              )}
            >
              Dashboard
            </Link>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
