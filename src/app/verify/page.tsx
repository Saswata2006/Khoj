import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/authorization";
import { POST_AUTH_REDIRECT_PATH } from "@/lib/auth-ui";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyOtpForm } from "@/components/auth/VerifyOtpForm";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Verify Code — Khoj",
  description: "Enter the 6-digit verification code sent to your email address.",
};

async function VerifyContent() {
  const user = await getCurrentUser();
  if (user) {
    redirect(POST_AUTH_REDIRECT_PATH);
  }
  return <VerifyOtpForm />;
}

function VerifySkeleton() {
  return (
    <Card className="border-[#27272A] bg-[#111113] shadow-xl py-6">
      <CardHeader className="px-6 space-y-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="px-6 space-y-4">
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 6 }, (_, idx) => (
            <Skeleton key={idx} className="h-12 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <AuthShell>
      <Suspense fallback={<VerifySkeleton />}>
        <VerifyContent />
      </Suspense>
    </AuthShell>
  );
}
