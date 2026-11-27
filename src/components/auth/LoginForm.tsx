"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const email = emailInput ?? pendingEmail ?? "";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to home</span>
        </Link>
      </div>

      <Card className="shadow-sm border-border bg-card py-6">
        <CardHeader className="px-6 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Badge
              variant="secondary"
              className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[11px] font-medium"
            >
              <ShieldCheck className="h-3 w-3 mr-1 text-accent" />
              Passwordless Sign-In
            </Badge>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Sign in to Khoj
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground leading-relaxed">
            Enter any personal or institutional email address. We&apos;ll send a
            6-digit one-time code &mdash; no password needed.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-foreground"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                  aria-describedby={error ? "login-email-error" : undefined}
                  className="h-10 pl-9 bg-card"
                />
              </div>
            </div>

            {error && (
              <div
                id="login-email-error"
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting || !email.trim()}
              className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Sending verification code...</span>
                </>
              ) : (
                <span>Send OTP</span>
              )}
            </Button>
          </form>
        </CardContent>

        <Separator />

        <CardFooter className="px-6 py-4 bg-muted/40 text-xs text-muted-foreground leading-relaxed">
          New to Khoj? Your account is created automatically once you verify
          your one-time code.
        </CardFooter>
      </Card>
    </div>
  );
}
