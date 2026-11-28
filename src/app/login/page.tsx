import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/authorization";
import { POST_AUTH_REDIRECT_PATH, sanitizeRedirectPath } from "@/lib/auth-ui";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Sign In — Khoj",
  description:
    "Sign in to Khoj with a passwordless 6-digit email verification code.",
};

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string; next?: string }>;
}

async function LoginContent({ searchParams }: LoginPageProps) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const safeRedirect = sanitizeRedirectPath(
    params.redirectTo ?? params.next,
    POST_AUTH_REDIRECT_PATH
  );

  if (user) {
    redirect(safeRedirect);
  }

  return <LoginForm redirectTo={safeRedirect} />;
}

function LoginSkeleton() {
  return (
    <Card className="border-[#27272A] bg-[#111113] shadow-xl py-6">
      <CardHeader className="px-6 space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent className="px-6 space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <AuthShell>
      <Suspense fallback={<LoginSkeleton />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
