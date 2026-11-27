"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import {
  clearPendingListingRecovery,
  executeCreateListingWorkflow,
  deleteListingImageRequest,
  parsePendingListingRecoveryRaw,
  readPendingListingRecoveryRaw,
  savePendingListingRecovery,
  uploadPendingListingImages,
  validateSelectedImageFiles,
  type ListingFormFieldErrors,
  type ListingFormValues,
  type QueuedUploadItem,
  type UploadedImageSummary,
} from "@/lib/marketplace-ui";
import { ListingFormFields } from "@/components/marketplace/ListingFormFields";
import { ListingImageUploader } from "@/components/marketplace/ListingImageUploader";
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
import { cn } from "@/lib/utils";

const INITIAL_VALUES: ListingFormValues = {
  title: "",
  description: "",
  category: "",
  condition: "",
  price: "",
  location: "",
};

const subscribeNoop = () => () => {};
const getHydratedSnapshot = () => true;
const getServerFalseSnapshot = () => false;
const getServerNullSnapshot = () => null;

function generateQueueId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function CreateListingForm() {
  const router = useRouter();
  const isHydrated = useSyncExternalStore(
    subscribeNoop,
    getHydratedSnapshot,
    getServerFalseSnapshot
  );
  const rawRecovery = useSyncExternalStore(
    subscribeNoop,
    readPendingListingRecoveryRaw,
    getServerNullSnapshot
  );
  const recoveredDraft = isHydrated
    ? parsePendingListingRecoveryRaw(rawRecovery)
    : null;

  const [values, setValues] = useState<ListingFormValues>(INITIAL_VALUES);
  const [fieldErrors, setFieldErrors] = useState<ListingFormFieldErrors>({});

  const [queuedImages, setQueuedImages] = useState<QueuedUploadItem[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImageSummary[]>(
    []
  );
  const [selectionErrors, setSelectionErrors] = useState<string[]>([]);
  const [deletingImageIds, setDeletingImageIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ambiguousNetworkError, setAmbiguousNetworkError] = useState(false);
  const [dismissedRecovery, setDismissedRecovery] = useState(false);

  // Preserved once POST /api/listings succeeds so retries never duplicate the listing
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const [createdTitle, setCreatedTitle] = useState<string>("");
  const [completed, setCompleted] = useState(false);

  const inFlightRef = useRef(false);
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const previewUrlsRef = useRef<Map<string, string>>(new Map());

  const createPreviewUrl = (queueId: string, file: File): string => {
    if (
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function"
    ) {
      const url = URL.createObjectURL(file);
      previewUrlsRef.current.set(queueId, url);
      return url;
    }
    return "";
  };

  const revokePreviewUrl = (queueId: string) => {
    const url = previewUrlsRef.current.get(queueId);
    if (!url) return;
    previewUrlsRef.current.delete(queueId);
    if (
      typeof URL !== "undefined" &&
      typeof URL.revokeObjectURL === "function"
    ) {
      URL.revokeObjectURL(url);
    }
  };

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      for (const url of urls.values()) {
        if (
          typeof URL !== "undefined" &&
          typeof URL.revokeObjectURL === "function"
        ) {
          URL.revokeObjectURL(url);
        }
      }
      urls.clear();
    };
  }, []);

  const handleFieldChange = <K extends keyof ListingFormValues>(
    field: K,
    value: ListingFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (submitError) {
      setSubmitError(null);
    }
  };

  const handleAddFiles = (incoming: FileList | File[]) => {
    const fileArray = Array.from(incoming);
    const currentCount = uploadedImages.length + queuedImages.length;
    const { accepted, errors } = validateSelectedImageFiles(
      fileArray,
      currentCount
    );

    setSelectionErrors(errors);
    if (accepted.length === 0) return;

    const newItems: QueuedUploadItem[] = accepted.map((file) => {
      const queueId = generateQueueId();
      return {
        id: queueId,
        file,
        previewUrl: createPreviewUrl(queueId, file),
        status: "queued",
      };
    });

    setQueuedImages((prev) => [...prev, ...newItems]);
  };

  const handleRemoveQueuedImage = (queueId: string) => {
    revokePreviewUrl(queueId);
    setQueuedImages((prev) => prev.filter((item) => item.id !== queueId));
    setSelectionErrors([]);
  };

  const handleDeleteExistingImage = async (imageId: string) => {
    if (!createdListingId) return;
    setDeleteError(null);
    setDeletingImageIds((prev) => [...prev, imageId]);

    try {
      const res = await deleteListingImageRequest(createdListingId, imageId);
      if (!res.ok) {
        setDeleteError(res.error);
        return;
      }

      setUploadedImages((prev) => prev.filter((img) => img.id !== imageId));
    } finally {
      setDeletingImageIds((prev) => prev.filter((id) => id !== imageId));
    }
  };

  const markQueueItemUploading = (queueId: string) => {
    setQueuedImages((prev) =>
      prev.map((item) =>
        item.id === queueId
          ? { ...item, status: "uploading", error: undefined }
          : item
      )
    );
  };

  const markQueueItemSuccess = (
    queueId: string,
    image: UploadedImageSummary
  ) => {
    revokePreviewUrl(queueId);
    setQueuedImages((prev) => prev.filter((item) => item.id !== queueId));
    setUploadedImages((prev) => [...prev, image]);
  };

  const markQueueItemError = (queueId: string, error: string) => {
    setQueuedImages((prev) =>
      prev.map((item) =>
        item.id === queueId ? { ...item, status: "error", error } : item
      )
    );
  };

  const handleRetrySingleImage = async (queueId: string) => {
    if (!createdListingId || inFlightRef.current) return;

    const target = queuedImages.find((item) => item.id === queueId);
    if (!target) return;

    inFlightRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await uploadPendingListingImages(
        createdListingId,
        [target],
        {
          onItemStart: markQueueItemUploading,
          onItemSuccess: markQueueItemSuccess,
          onItemError: markQueueItemError,
        },
        1
      );

      if (result.failed.length === 0) {
        // Check if any other failed/queued items still remain
        const hasRemaining = queuedImages.some(
          (item) =>
            item.id !== queueId &&
            (item.status === "error" || item.status === "queued")
        );
        if (!hasRemaining) {
          clearPendingListingRecovery();
          setCompleted(true);
          router.push(`/marketplace/${createdListingId}?created=1`);
          router.refresh();
        }
      } else {
        setSubmitError(
          "Photo upload still failed. Retry below, remove the failed photo, or proceed to Edit Listing."
        );
      }
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    setAmbiguousNetworkError(false);
    setSelectionErrors([]);
    setDeleteError(null);

    try {
      const result = await executeCreateListingWorkflow({
        values,
        existingListingId: createdListingId,
        lastSavedSnapshot: lastSavedSnapshotRef.current,
        queuedImages,
        onListingSaved: (listing, snapshot) => {
          lastSavedSnapshotRef.current = snapshot;
          setCreatedListingId(listing.id);
          setCreatedTitle(listing.title);
          savePendingListingRecovery({
            listingId: listing.id,
            title: listing.title,
            values,
            snapshot,
          });
        },
        uploadCallbacks: {
          onItemStart: markQueueItemUploading,
          onItemSuccess: markQueueItemSuccess,
          onItemError: markQueueItemError,
        },
        concurrency: 2,
      });

      if (!result.ok) {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        if (result.error) {
          setSubmitError(result.error);
        }
        setAmbiguousNetworkError(Boolean(result.isAmbiguousNetworkError));
        return;
      }

      clearPendingListingRecovery();
      setCompleted(true);
      if (result.listingId) {
        router.push(`/marketplace/${result.listingId}?created=1`);
      }
      router.refresh();
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    for (const id of previewUrlsRef.current.keys()) {
      revokePreviewUrl(id);
    }
    clearPendingListingRecovery();
    setValues(INITIAL_VALUES);
    setFieldErrors({});
    setQueuedImages([]);
    setUploadedImages([]);
    setSelectionErrors([]);
    setDeleteError(null);
    setSubmitError(null);
    setAmbiguousNetworkError(false);
    setCreatedListingId(null);
    setCreatedTitle("");
    setCompleted(false);
    lastSavedSnapshotRef.current = null;
  };

  const handleResumeRecoveredDraft = () => {
    if (!recoveredDraft) return;
    setValues(recoveredDraft.values);
    setCreatedListingId(recoveredDraft.listingId);
    setCreatedTitle(recoveredDraft.title);
    lastSavedSnapshotRef.current = recoveredDraft.snapshot;
    setDismissedRecovery(true);
    setSubmitError(null);
    setAmbiguousNetworkError(false);
  };

  const handleDismissRecovery = () => {
    clearPendingListingRecovery();
    setDismissedRecovery(true);
  };

  if (completed && createdListingId) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-emerald-500/30 bg-card shadow-sm py-6">
          <CardHeader className="px-6 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 text-accent">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <Badge
                variant="secondary"
                className="bg-emerald-500/15 text-emerald-700 font-medium"
              >
                Status: Active
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Listing published to Khoj Marketplace
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{createdTitle}</span>{" "}
              is now saved and live with{" "}
              {uploadedImages.length === 1
                ? "1 uploaded photo"
                : `${uploadedImages.length} uploaded photos`}
              .
            </CardDescription>
          </CardHeader>

          <Separator />

          <CardContent className="px-6 py-5 space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground leading-relaxed">
              Your listing is active immediately. You can edit item details,
              adjust photos, mark it as sold later, or manage it from your edit
              workspace.
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/marketplace/${createdListingId}`}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-medium inline-flex items-center justify-center gap-2"
                )}
              >
                <ExternalLink className="h-4 w-4" />
                <span>View Listing</span>
              </Link>

              <Link
                href="/dashboard/listings"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "flex-1 inline-flex items-center justify-center gap-2"
                )}
              >
                <span>My Listings</span>
              </Link>
            </div>
          </CardContent>

          <CardFooter className="px-6 py-3 justify-center bg-muted/30">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetForAnother}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Post another item</span>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const failedQueuedCount = queuedImages.filter(
    (item) => item.status === "error"
  ).length;
  const totalAttachedCount = uploadedImages.length + queuedImages.length;

  return (
    <div className="space-y-6">
      {/* Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to dashboard</span>
        </Link>
        <Badge
          variant="secondary"
          className="bg-emerald-500/10 text-emerald-700 text-[11px] font-medium inline-flex items-center gap-1.5"
        >
          <ShoppingBag className="h-3 w-3 text-accent" />
          <span>Marketplace Sale Listing</span>
        </Badge>
      </div>

      {/* Page Title */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Sell an item on Khoj
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          List textbooks, electronics, cycles, or everyday essentials for your
          community. Listings become active immediately upon publishing.
        </p>
      </div>

      {/* Browser-Refresh Session Recovery Prompt */}
      {!createdListingId && recoveredDraft && !dismissedRecovery && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">
                Previously created listing found from this session: &ldquo;
                {recoveredDraft.title}&rdquo;
              </p>
              <p className="text-amber-800/90">
                Resume this saved Active listing to add remaining photos without
                creating a duplicate post, or dismiss to start fresh.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="default"
              size="xs"
              onClick={handleResumeRecoveredDraft}
              className="bg-primary text-primary-foreground"
            >
              Resume Saved Listing
            </Button>
            <Link
              href={`/marketplace/${recoveredDraft.listingId}/edit`}
              className={buttonVariants({ variant: "outline", size: "xs" })}
            >
              Open Edit Page
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleDismissRecovery}
            >
              Start Fresh
            </Button>
          </div>
        </div>
      )}

      {/* Partial Failure Notice once listing ID already exists */}
      {createdListingId && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">
                Listing saved as Active — finish photo uploads below
              </p>
              <p className="text-amber-800/90 dark:text-amber-200/80">
                Retrying will upload only failed photos without creating a
                duplicate listing.
              </p>
            </div>
          </div>
          <Link
            href={`/marketplace/${createdListingId}/edit`}
            className={cn(
              buttonVariants({ variant: "outline", size: "xs" }),
              "shrink-0 border-amber-600/30 bg-background/80"
            )}
          >
            Open Edit Page
          </Link>
        </div>
      )}

      {/* Main Responsive Two-Column Layout */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
      >
        {/* Left Column: Listing Details */}
        <Card className="lg:col-span-7 border-border bg-card shadow-xs py-6">
          <CardHeader className="px-6 space-y-1">
            <CardTitle className="text-lg font-semibold text-foreground">
              Item details
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Provide accurate condition details, a fixed price in INR, and a
              public meetup location.
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="px-6 pt-2">
            <ListingFormFields
              values={values}
              fieldErrors={fieldErrors}
              onChange={handleFieldChange}
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        {/* Right Column: Photos & Publish Actions */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-border bg-card shadow-xs py-6">
            <CardContent className="px-6">
              <ListingImageUploader
                existingImages={uploadedImages}
                queuedImages={queuedImages}
                onAddFiles={handleAddFiles}
                onRemoveQueuedImage={handleRemoveQueuedImage}
                onRetryQueuedImage={
                  createdListingId ? handleRetrySingleImage : undefined
                }
                onDeleteExistingImage={
                  createdListingId ? handleDeleteExistingImage : undefined
                }
                deletingImageIds={deletingImageIds}
                selectionErrors={selectionErrors}
                deleteError={deleteError}
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-xs py-6">
            <CardHeader className="px-6 space-y-1">
              <CardTitle className="text-base font-semibold text-foreground">
                Ready to publish
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {totalAttachedCount === 0
                  ? "Publishing without photos — you can also add photos anytime from Edit Listing."
                  : `${totalAttachedCount} ${
                      totalAttachedCount === 1 ? "photo" : "photos"
                    } attached (${uploadedImages.length} uploaded).`}
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 space-y-4">
              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
                <Info className="h-4 w-4 shrink-0 text-accent mt-0.5" />
                <span>
                  Publishing makes this listing <strong className="text-foreground">Active</strong>{" "}
                  right away (no draft mode). Only fixed prices in INR (₹) are
                  supported.
                </span>
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive space-y-2"
                >
                  <p>{submitError}</p>
                  {ambiguousNetworkError && (
                    <Link
                      href="/dashboard/listings"
                      className="inline-block underline font-semibold hover:opacity-80"
                    >
                      Check My Listings before retrying
                    </Link>
                  )}
                </div>
              )}

              <div className="space-y-2.5">
                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-medium inline-flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>
                        {createdListingId
                          ? "Uploading photos..."
                          : "Publishing listing..."}
                      </span>
                    </>
                  ) : createdListingId && failedQueuedCount > 0 ? (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      <span>Retry Failed Photo Uploads</span>
                    </>
                  ) : createdListingId ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Save &amp; Upload Remaining Photos</span>
                    </>
                  ) : (
                    <span>Publish Listing</span>
                  )}
                </Button>

                {createdListingId && (
                  <Link
                    href="/dashboard/listings"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "default" }),
                      "w-full"
                    )}
                  >
                    Continue to My Listings
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
