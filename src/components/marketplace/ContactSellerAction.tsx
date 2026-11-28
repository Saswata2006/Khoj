"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  LogIn,
  MessageSquare,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  buildContactLoginHref,
  recoverExistingBuyerContactRequest,
  submitContactRequest,
  type ContactRequestClientDTO,
} from "@/lib/contact-request-ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ContactSellerActionProps {
  listingId: string;
  listingTitle: string;
  formattedPrice: string;
  listingStatus: "ACTIVE" | "SOLD" | "RESOLVED" | "REMOVED";
  sellerDisplayName: string;
  sellerInitials: string;
  isAuthenticated: boolean;
  isOwner: boolean;
  initialRequest: ContactRequestClientDTO | null;
}

export function ContactSellerAction({
  listingId,
  listingTitle,
  formattedPrice,
  listingStatus,
  sellerDisplayName,
  sellerInitials,
  isAuthenticated,
  isOwner,
  initialRequest,
}: ContactSellerActionProps) {
  const router = useRouter();
  const [contactRequest, setContactRequest] =
    useState<ContactRequestClientDTO | null>(initialRequest);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requiresReauth, setRequiresReauth] = useState(false);
  const [submissionSuccessNote, setSubmissionSuccessNote] = useState<string | null>(
    null
  );

  // Synchronous guard preventing duplicate concurrent POST requests
  const inFlightRef = useRef(false);

  // Server-enforced owner safeguard (page also hides contact controls for owners)
  if (isOwner) {
    return null;
  }

  const loginHref = buildContactLoginHref(listingId);
  const isSoldOrClosed = listingStatus !== "ACTIVE";

  // 1. Existing server-derived request state (PENDING / ACCEPTED / REJECTED)
  if (contactRequest) {
    if (contactRequest.status === "PENDING") {
      return (
        <div className="space-y-3">
          <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FAFAFA]">
                <Clock className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
                <span>Request Sent — Awaiting Response</span>
              </span>
              <Badge variant="accent">Pending</Badge>
            </div>
            <p className="text-xs leading-relaxed text-[#A1A1AA]">
              {submissionSuccessNote ??
                contactRequest.contactDisclosure.message}
            </p>
          </div>

          {isSoldOrClosed && (
            <p className="text-xs text-[#FCD34D]">
              This listing is no longer active, so no new requests can be sent.
            </p>
          )}
        </div>
      );
    }

    if (contactRequest.status === "ACCEPTED") {
      return (
        <div className="space-y-3">
          <div className="rounded-xl border border-[#10B981]/35 bg-[#10B981]/12 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FAFAFA]">
                <CheckCircle2
                  className="h-4 w-4 text-[#10B981]"
                  aria-hidden="true"
                />
                <span>Request Accepted</span>
              </span>
              <Badge variant="accent">Accepted</Badge>
            </div>
            <p className="text-xs leading-relaxed text-[#D1FAE5]">
              The seller accepted your contact request, however direct contact
              sharing is not yet available.
            </p>
            <p className="text-[11px] leading-relaxed text-[#A1A1AA]">
              Personal login emails and phone numbers remain private until
              explicit consent-sharing channels are enabled in an upcoming
              release.
            </p>
          </div>
        </div>
      );
    }

    // REJECTED
    return (
      <div className="space-y-2.5">
        <div className="rounded-xl border border-[#27272A] bg-[#18181B] p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FAFAFA]">
              <XCircle
                className="h-4 w-4 text-[#F59E0B]"
                aria-hidden="true"
              />
              <span>Request Declined</span>
            </span>
            <Badge variant="warning">Declined</Badge>
          </div>
          <p className="text-xs leading-relaxed text-[#A1A1AA]">
            {contactRequest.contactDisclosure.message}
          </p>
        </div>
      </div>
    );
  }

  // 2. Listing is SOLD or REMOVED and no existing request
  if (isSoldOrClosed) {
    return (
      <div className="space-y-2 text-center">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled
          className="w-full"
        >
          Sold — Item No Longer Available
        </Button>
        <p className="text-xs text-[#A1A1AA]">
          Browse more active items on the{" "}
          <Link
            href="/marketplace"
            className="underline font-medium text-[#FAFAFA] hover:text-[#34D399]"
          >
            Marketplace
          </Link>
          .
        </p>
      </div>
    );
  }

  // 3. Anonymous visitor on ACTIVE listing -> Safe return URL to /login
  if (!isAuthenticated) {
    return (
      <div className="space-y-2.5">
        <Link
          href={loginHref}
          className={cn(
            buttonVariants({ variant: "accent", size: "lg" }),
            "w-full inline-flex items-center justify-center gap-2"
          )}
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          <span>Sign in to contact seller</span>
        </Link>
        <p className="text-xs leading-relaxed text-[#A1A1AA]">
          Sign in with your email OTP to send a consent-based contact request
          without exposing your email publicly.
        </p>
      </div>
    );
  }

  // 4. Authenticated non-owner on ACTIVE listing with no prior request
  const handleConfirmRequest = async () => {
    if (inFlightRef.current || isSubmitting) return;

    inFlightRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    setRequiresReauth(false);

    try {
      const result = await submitContactRequest(listingId);

      if (result.ok) {
        setContactRequest(result.contactRequest);
        setSubmissionSuccessNote(
          "Your request has been sent to the seller. Personal contact information is never shared automatically."
        );
        setDialogOpen(false);
        router.refresh();
        return;
      }

      if (result.requiresAuth) {
        setRequiresReauth(true);
      }

      if (result.ambiguous || result.shouldRefreshState) {
        const recovery = await recoverExistingBuyerContactRequest(listingId);
        if (recovery.contactRequest) {
          setContactRequest(recovery.contactRequest);
          setDialogOpen(false);
          router.refresh();
          return;
        }

        if (result.ambiguous && !recovery.checked) {
          setSubmitError(
            "Connection dropped and we could not confirm whether your request was saved. Please refresh the page before retrying."
          );
          return;
        }
      }

      setSubmitError(result.error);
      if (result.shouldRefreshState) {
        router.refresh();
      }
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <Button
        type="button"
        variant="accent"
        size="lg"
        onClick={() => {
          setSubmitError(null);
          setRequiresReauth(false);
          setDialogOpen(true);
        }}
        className="w-full inline-flex items-center justify-center gap-2"
      >
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
        <span>Request Contact</span>
      </Button>
      <p className="text-xs leading-relaxed text-[#A1A1AA]">
        Consent-based inquiry. Requesting contact does not automatically expose
        your or the seller&apos;s personal email address.
      </p>

      <Dialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          if (!isSubmitting) {
            setDialogOpen(nextOpen);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Contact with Seller</DialogTitle>
            <DialogDescription>
              Confirm that you want to send a private contact request for this
              listing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4 text-sm">
            {/* Listing & Seller Summary */}
            <div className="rounded-xl border border-[#27272A] bg-[#111113] p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-[#FAFAFA] line-clamp-2">
                  {listingTitle}
                </p>
                <span className="shrink-0 font-heading font-semibold text-[#34D399] price-tabular">
                  {formattedPrice}
                </span>
              </div>

              <div className="flex items-center gap-2.5 border-t border-[#27272A] pt-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#27272A] bg-[#1C1C20] font-mono text-[11px] font-semibold text-[#FAFAFA]">
                  {sellerInitials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[#FAFAFA]">
                    {sellerDisplayName}
                  </p>
                  <p className="inline-flex items-center gap-1 text-[11px] text-[#34D399]">
                    <ShieldCheck className="h-3 w-3 text-[#10B981]" />
                    <span>Email-verified account</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Consent & Privacy Notice */}
            <div className="flex items-start gap-2.5 rounded-xl border border-[#27272A] bg-[#111113]/70 p-3 text-xs leading-relaxed text-[#A1A1AA]">
              <Lock
                className="h-4 w-4 shrink-0 text-[#10B981] mt-0.5"
                aria-hidden="true"
              />
              <span>
                Sending a request notifies the seller of your interest. It{" "}
                <strong className="text-[#FAFAFA]">
                  does not automatically reveal personal contact information
                </strong>{" "}
                (email or phone).
              </span>
            </div>

            {submitError && (
              <div
                role="alert"
                className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 p-3 text-xs text-[#FCA5A5] space-y-2"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle
                    className="h-4 w-4 shrink-0 text-[#EF4444] mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{submitError}</span>
                </div>
                {requiresReauth && (
                  <Link
                    href={loginHref}
                    className="inline-flex items-center gap-1 font-semibold underline text-[#FAFAFA] hover:text-[#34D399]"
                  >
                    <span>Sign in again</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose
              disabled={isSubmitting}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" })
              )}
            >
              Cancel
            </DialogClose>
            <Button
              type="button"
              variant="accent"
              size="sm"
              disabled={isSubmitting}
              onClick={handleConfirmRequest}
            >
              {isSubmitting ? "Sending request..." : "Send Contact Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
