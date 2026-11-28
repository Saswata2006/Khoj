"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import { sendOtp } from "@/lib/auth-client";
import {
  isValidEmailInput,
  loadPendingVerification,
  normalizeEmailInput,
  savePendingVerification,
} from "@/lib/auth-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const subscribeNoop = () => () => {};
const getPendingEmailSnapshot = () => loadPendingVerification().email;
const getServerNullSnapshot = () => null;

interface LoginFormProps {
  redirectTo?: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const pendingEmail = useSyncExternalStore(
    subscribeNoop,
    getPendingEmailSnapshot,
    getServerNullSnapshot
  );
  const [emailInput, setEmailInput] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = emailInput ?? pendingEmail ?? "";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    const normalized = normalizeEmailInput(email);

    if (!isValidEmailInput(normalized)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await sendOtp(normalized);
      if (!result.success) {
        setError(
          result.error ?? "Failed to send verification code. Please try again."
        );
        return;
      }

      savePendingVerification(normalized, Date.now(), redirectTo);
      router.push("/verify");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to home</span>
        </Link>
      </div>

      <Card className="border-[#27272A] bg-[#111113] shadow-xl py-6">
        <CardHeader className="px-6 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="accent" className="gap-1.5">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              <span>Passwordless Sign-In</span>
            </Badge>
          </div>
          <CardTitle className="font-heading text-2xl font-semibold tracking-tight text-[#FAFAFA]">
            Sign in to Khoj
          </CardTitle>
          <CardDescription className="text-sm text-[#A1A1AA] leading-relaxed">
            Enter any personal or institutional email address. We&apos;ll send a
            6-digit one-time code &mdash; no password needed.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pt-1">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-[#FAFAFA]"
              >
                Email address
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]"
                  aria-hidden="true"
                />
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  disabled={isSubmitting}
                  value={email}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="you@example.com"
                  aria-invalid={Boolean(error) || undefined}
                  aria-describedby={error ? "login-email-error" : "login-email-hint"}
                  className="h-10 pl-9"
                />
              </div>

              {error ? (
                <div
                  id="login-email-error"
                  role="alert"
                  className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-xs font-medium text-[#FCA5A5]"
                >
                  {error}
                </div>
              ) : (
                <p id="login-email-hint" className="text-xs text-[#71717A]">
                  We&apos;ll send a one-time code valid for 5 minutes.
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="accent"
              size="lg"
              disabled={isSubmitting || !email.trim()}
              className="w-full h-10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Sending verification code...</span>
                </>
              ) : (
                <>
                  <span>Send OTP</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
        </CardContent>

        <Separator className="bg-[#27272A]" />

        <CardFooter className="px-6 py-4 bg-[#18181B]/60 text-xs text-[#A1A1AA] leading-relaxed">
          New to Khoj? Your account is created automatically once you verify
          your one-time code.
        </CardFooter>
      </Card>
    </div>
  );
}
