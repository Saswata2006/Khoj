"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
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
  const [overrideCooldownUntil, setOverrideCooldownUntil] = useState<number | null>(null);
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
      ? getRemainingCooldownSeconds(activeCooldownUntil, nowMs ?? activeCooldownUntil - 60_000)
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
          result.error ?? "Unable to resend code right now. Please wait and try again."
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
      <Card className="shadow-sm border-border bg-card py-6">
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
      <Card className="shadow-sm border-border bg-card py-6">
        <CardHeader className="px-6 space-y-2">
          <CardTitle className="text-xl font-bold text-foreground">
            Verification session missing
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground leading-relaxed">
            Enter your email address first to receive a 6-digit verification
            code.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: "lg" }),
              "w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90"
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
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to sign in</span>
        </Link>
      </div>

      <Card className="shadow-sm border-border bg-card py-6">
        <CardHeader className="px-6 space-y-2">
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Check your email
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground leading-relaxed">
            Enter the 6-digit code sent to{" "}
            <span className="font-medium text-foreground break-all">{email}</span>
            . It expires in 5 minutes.
          </CardDescription>
          <div>
            <button
              type="button"
              onClick={handleChangeEmail}
              disabled={isVerifying || isSuccess}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:opacity-50"
            >
              <Mail className="h-3 w-3" />
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
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
              >
                {error}
              </div>
            )}

            {statusMessage && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                <span>{statusMessage}</span>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={!isOtpComplete || isVerifying || isSuccess}
              className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  <span>Verified</span>
                </>
              ) : (
                <span>Verify &amp; Continue</span>
              )}
            </Button>
          </form>
        </CardContent>

        <Separator />

        <CardFooter className="px-6 py-4 bg-muted/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Didn&apos;t receive the code?</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={countdown > 0 || isResending || isVerifying || isSuccess}
            className="text-xs font-medium text-foreground hover:text-accent"
          >
            {isResending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : countdown > 0 ? (
              <span>Resend code in {countdown}s</span>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Resend OTP</span>
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
