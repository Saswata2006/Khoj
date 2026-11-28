"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
} from "lucide-react";
import { sendOtp, verifyOtp } from "@/lib/auth-client";
import {
  OTP_LENGTH,
  POST_AUTH_REDIRECT_PATH,
  clearPendingVerification,
  createEmptyOtpDigits,
  getRemainingCooldownSeconds,
  loadPendingVerification,
  sanitizeRedirectPath,
  savePendingVerification,
} from "@/lib/auth-ui";
import { OtpInput } from "@/components/auth/OtpInput";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => {};
const getHydratedSnapshot = () => true;
const getServerFalseSnapshot = () => false;
const getPendingEmailSnapshot = () => loadPendingVerification().email;
const getPendingCooldownSnapshot = () => loadPendingVerification().cooldownUntilMs;
const getServerNullSnapshot = () => null;
const getPendingRedirectSnapshot = () => loadPendingVerification().redirectTo;

export function VerifyOtpForm() {
  const router = useRouter();
  const isHydrated = useSyncExternalStore(
    subscribeNoop,
    getHydratedSnapshot,
    getServerFalseSnapshot
  );
  const storedEmail = useSyncExternalStore(
    subscribeNoop,
    getPendingEmailSnapshot,
    getServerNullSnapshot
  );
  const storedCooldownUntil = useSyncExternalStore(
    subscribeNoop,
    getPendingCooldownSnapshot,
    getServerNullSnapshot
  );
  const storedRedirectTo = useSyncExternalStore(
    subscribeNoop,
    getPendingRedirectSnapshot,
    () => POST_AUTH_REDIRECT_PATH
  );

  const [digits, setDigits] = useState<string[]>(createEmptyOtpDigits);
  const [overrideCooldownUntil, setOverrideCooldownUntil] = useState<number | null>(
    null
  );
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isInitializing = !isHydrated;
  const email = isHydrated ? storedEmail : null;
  const activeCooldownUntil = overrideCooldownUntil ?? storedCooldownUntil;
  const countdown =
    isHydrated && activeCooldownUntil !== null
      ? getRemainingCooldownSeconds(
          activeCooldownUntil,
          nowMs ?? activeCooldownUntil - 60_000
        )
      : 0;

  useEffect(() => {
    if (!activeCooldownUntil) return;
    const immediate = window.setTimeout(() => {
      setNowMs(Date.now());
    }, 0);
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
    };
  }, [activeCooldownUntil]);

  const otpCode = digits.join("");
  const isOtpComplete = otpCode.length === OTP_LENGTH && /^\d{6}$/.test(otpCode);

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !isOtpComplete || isVerifying || isSuccess) return;

    setError(null);
    setStatusMessage(null);
    setIsVerifying(true);

    try {
      const result = await verifyOtp(email, otpCode);
      if (!result.success) {
        setError(
          result.error ?? "Invalid or expired verification code. Please try again."
        );
        return;
      }

      const targetPath = sanitizeRedirectPath(
        storedRedirectTo,
        POST_AUTH_REDIRECT_PATH
      );
      clearPendingVerification();
      setIsSuccess(true);
      setStatusMessage("Verified! Redirecting...");
      router.replace(targetPath);
      router.refresh();
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email || countdown > 0 || isResending || isVerifying || isSuccess) {
      return;
    }

    setError(null);
    setStatusMessage(null);
    setIsResending(true);

    try {
      const result = await sendOtp(email);
      if (!result.success) {
        setError(
          result.error ??
            "Unable to resend code right now. Please wait and try again."
        );
        return;
      }

      const nextCooldownUntil = savePendingVerification(email);
      setOverrideCooldownUntil(nextCooldownUntil);
      setNowMs(Date.now());
      setDigits(createEmptyOtpDigits());
      setStatusMessage("A new 6-digit verification code has been sent.");
    } catch {
      setError("Unable to resend code right now. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  const handleChangeEmail = () => {
    router.push("/login");
  };

  if (isInitializing) {
    return (
      <Card className="border-[#27272A] bg-[#111113] shadow-xl py-6">
        <CardHeader className="px-6 space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="px-6 space-y-4">
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: OTP_LENGTH }, (_, idx) => (
              <Skeleton key={idx} className="h-12 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!email) {
    return (
      <Card className="border-[#27272A] bg-[#111113] shadow-xl py-6">
        <CardHeader className="px-6 space-y-2">
          <CardTitle className="font-heading text-xl font-semibold text-[#FAFAFA]">
            Verification session missing
          </CardTitle>
          <CardDescription className="text-sm text-[#A1A1AA] leading-relaxed">
            Enter your email address first to receive a 6-digit verification
            code.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "accent", size: "lg" }),
              "w-full h-10"
            )}
          >
            Go to Sign In
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to sign in</span>
        </Link>
      </div>

      <Card className="border-[#27272A] bg-[#111113] shadow-xl py-6">
        <CardHeader className="px-6 space-y-2.5">
          <Badge variant="accent" className="gap-1.5">
            <KeyRound className="h-3 w-3" aria-hidden="true" />
            <span>Email Verification</span>
          </Badge>
          <CardTitle className="font-heading text-2xl font-semibold tracking-tight text-[#FAFAFA]">
            Check your email
          </CardTitle>
          <CardDescription className="text-sm text-[#A1A1AA] leading-relaxed">
            Enter the 6-digit code sent to{" "}
            <span className="font-mono font-medium text-[#FAFAFA] break-all">
              {email}
            </span>
            . It expires in 5 minutes.
          </CardDescription>
          <div>
            <button
              type="button"
              onClick={handleChangeEmail}
              disabled={isVerifying || isSuccess}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#34D399] hover:underline disabled:opacity-50"
            >
              <Mail className="h-3 w-3" aria-hidden="true" />
              <span>Change email</span>
            </button>
          </div>
        </CardHeader>

        <CardContent className="px-6 space-y-4">
          <form onSubmit={handleVerify} noValidate className="space-y-4">
            <OtpInput
              digits={digits}
              onChange={(next) => {
                setDigits(next);
                if (error) setError(null);
              }}
              disabled={isVerifying || isSuccess}
              hasError={Boolean(error)}
              autoFocus
            />

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-xs font-medium text-[#FCA5A5]"
              >
                {error}
              </div>
            )}

            {statusMessage && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-2 text-xs font-medium text-[#34D399]"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
                <span>{statusMessage}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="accent"
              size="lg"
              disabled={!isOtpComplete || isVerifying || isSuccess}
              className="w-full h-10"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Verifying...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>Verified</span>
                </>
              ) : (
                <span>Verify &amp; Continue</span>
              )}
            </Button>
          </form>
        </CardContent>

        <Separator className="bg-[#27272A]" />

        <CardFooter className="px-6 py-4 bg-[#18181B]/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#A1A1AA]">
          <span>Didn&apos;t receive the code?</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={countdown > 0 || isResending || isVerifying || isSuccess}
            onClick={handleResend}
            className="text-xs font-medium text-[#34D399] hover:text-[#34D399]"
          >
            {isResending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                <span>Sending...</span>
              </>
            ) : countdown > 0 ? (
              <span className="font-mono text-[#71717A]">
                Resend in {countdown}s
              </span>
            ) : (
              <>
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                <span>Resend code</span>
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
