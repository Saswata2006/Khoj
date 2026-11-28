"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  archiveListingRequest,
  deleteListingImageRequest,
  updateListingRequest,
  uploadPendingListingImages,
  validateListingFormValues,
  validateSelectedImageFiles,
  type ListingFormFieldErrors,
  type ListingFormValues,
  type MarketplaceListingClientDTO,
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface EditListingFormProps {
  listing: MarketplaceListingClientDTO;
}

function generateQueueId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function EditListingForm({ listing }: EditListingFormProps) {
  const router = useRouter();

  const [values, setValues] = useState<ListingFormValues>({
    title: listing.title,
    description: listing.description,
    category: listing.category,
    condition: listing.condition ?? "",
    price: String(listing.price),
    location: listing.location,
  });
  const [status, setStatus] = useState<"ACTIVE" | "SOLD">(
    listing.status === "SOLD" ? "SOLD" : "ACTIVE"
  );
  const [persistedStatus, setPersistedStatus] = useState<
    "ACTIVE" | "SOLD" | "REMOVED"
  >(listing.status === "SOLD" ? "SOLD" : "ACTIVE");

  const [fieldErrors, setFieldErrors] = useState<ListingFormFieldErrors>({});
  const [existingImages, setExistingImages] = useState<UploadedImageSummary[]>(
    listing.images
  );
  const [queuedImages, setQueuedImages] = useState<QueuedUploadItem[]>([]);
  const [selectionErrors, setSelectionErrors] = useState<string[]>([]);
  const [deletingImageIds, setDeletingImageIds] = useState<string[]>([]);
  const [deleteImageError, setDeleteImageError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isRemovingListing, setIsRemovingListing] = useState(false);
  const [confirmRemoveListing, setConfirmRemoveListing] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [imageUploadMessage, setImageUploadMessage] = useState<string | null>(
    null
  );

  const inFlightRef = useRef(false);
  const previewUrlsRef = useRef<Map<string, string>>(new Map());

  const isLocked = persistedStatus !== "ACTIVE";
  const isBusy = isSaving || isUploadingPhotos || isRemovingListing;

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
    if (saveError) setSaveError(null);
    if (saveSuccess) setSaveSuccess(null);
  };

  const handleAddFiles = (incoming: FileList | File[]) => {
    if (isLocked) return;
    const fileArray = Array.from(incoming);
    const currentCount = existingImages.length + queuedImages.length;
    const { accepted, errors } = validateSelectedImageFiles(
      fileArray,
      currentCount
    );

    setSelectionErrors(errors);
    setImageUploadMessage(null);
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
    if (isLocked || inFlightRef.current) return;

    setDeleteImageError(null);
    setSaveSuccess(null);
    setDeletingImageIds((prev) => [...prev, imageId]);

    try {
      const res = await deleteListingImageRequest(listing.id, imageId);
      if (!res.ok) {
        setDeleteImageError(res.error);
        if (res.status === 409) {
          router.refresh();
        }
        return;
      }

      setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
      if (res.notice) {
        setImageUploadMessage(res.notice);
      }
      router.refresh();
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
    setExistingImages((prev) => [...prev, image]);
  };

  const markQueueItemError = (queueId: string, error: string) => {
    setQueuedImages((prev) =>
      prev.map((item) =>
        item.id === queueId ? { ...item, status: "error", error } : item
      )
    );
  };

  const uploadQueueSubset = async (items: QueuedUploadItem[]) => {
    if (items.length === 0 || isLocked) return { uploadedCount: 0, failedCount: 0 };

    setIsUploadingPhotos(true);
    setImageUploadMessage(null);
    try {
      const res = await uploadPendingListingImages(
        listing.id,
        items,
        {
          onItemStart: markQueueItemUploading,
          onItemSuccess: markQueueItemSuccess,
          onItemError: markQueueItemError,
        },
        2
      );

      if (res.failed.length > 0) {
        setImageUploadMessage(
          `${res.failed.length} ${
            res.failed.length === 1 ? "photo" : "photos"
          } failed to upload. Retry or remove failed items below.`
        );
      } else if (res.uploaded.length > 0) {
        setImageUploadMessage(
          `Uploaded ${res.uploaded.length} new ${
            res.uploaded.length === 1 ? "photo" : "photos"
          }.`
        );
      }

      router.refresh();
      return {
        uploadedCount: res.uploaded.length,
        failedCount: res.failed.length,
      };
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const handleUploadPendingPhotosOnly = async () => {
    if (inFlightRef.current || isLocked) return;
    const pending = queuedImages.filter(
      (item) => item.status === "queued" || item.status === "error"
    );
    if (pending.length === 0) return;

    inFlightRef.current = true;
    try {
      await uploadQueueSubset(pending);
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleRetrySingleImage = async (queueId: string) => {
    if (inFlightRef.current || isLocked) return;
    const target = queuedImages.find((item) => item.id === queueId);
    if (!target) return;

    inFlightRef.current = true;
    try {
      await uploadQueueSubset([target]);
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleSaveChanges = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlightRef.current || isLocked) return;

    setSaveError(null);
    setSaveSuccess(null);
    setImageUploadMessage(null);

    const validation = validateListingFormValues(values);
    if (!validation.valid || !validation.data) {
      setFieldErrors(validation.fieldErrors);
      setSaveError("Please fix the highlighted form errors before saving.");
      return;
    }

    const pendingPhotos = queuedImages.filter(
      (item) => item.status === "queued" || item.status === "error"
    );
    if (status === "SOLD" && pendingPhotos.length > 0) {
      setSaveError(
        "Upload or remove queued photos before marking this listing as Sold (sold listings lock image uploads)."
      );
      return;
    }

    inFlightRef.current = true;
    setIsSaving(true);

    try {
      const updateRes = await updateListingRequest(listing.id, {
        ...validation.data,
        status,
      });

      if (!updateRes.ok) {
        setSaveError(updateRes.error);
        if (updateRes.status === 409) {
          router.refresh();
        }
        return;
      }

      setPersistedStatus(
        updateRes.listing.status === "SOLD" ? "SOLD" : "ACTIVE"
      );

      if (status === "SOLD") {
        setSaveSuccess(
          "Listing details updated and marked as Sold. Further edits are now locked."
        );
        router.push(`/marketplace/${listing.id}`);
        router.refresh();
        return;
      }

      if (pendingPhotos.length > 0) {
        const uploadRes = await uploadQueueSubset(pendingPhotos);
        if (uploadRes.failedCount > 0) {
          setSaveSuccess("Listing details saved, but some photos failed to upload.");
        } else {
          setSaveSuccess("Listing details and new photos saved.");
          router.push(`/marketplace/${listing.id}`);
        }
      } else {
        setSaveSuccess("Listing changes saved.");
        router.push(`/marketplace/${listing.id}`);
      }

      router.refresh();
    } finally {
      inFlightRef.current = false;
      setIsSaving(false);
    }
  };

  const handleRemoveListing = async () => {
    if (inFlightRef.current || isLocked) return;
    inFlightRef.current = true;
    setIsRemovingListing(true);
    setSaveError(null);

    try {
      const res = await archiveListingRequest(listing.id);
      if (!res.ok) {
        setSaveError(res.error);
        setConfirmRemoveListing(false);
        return;
      }

      for (const id of previewUrlsRef.current.keys()) {
        revokePreviewUrl(id);
      }
      setQueuedImages([]);
      setPersistedStatus("REMOVED");
      setConfirmRemoveListing(false);
      router.refresh();
    } finally {
      inFlightRef.current = false;
      setIsRemovingListing(false);
    }
  };

  if (persistedStatus === "REMOVED") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-border bg-card shadow-xs py-6">
          <CardHeader className="px-6 space-y-2">
            <Badge variant="secondary" className="w-fit bg-muted text-foreground">
              Removed
            </Badge>
            <CardTitle className="text-xl font-bold text-foreground">
              Listing removed from Marketplace
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              &ldquo;{values.title}&rdquo; has been archived and is no longer
              visible to buyers.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 flex flex-wrap gap-3">
            <Link
              href="/dashboard/listings"
              className={cn(
                buttonVariants({ size: "default" }),
                "bg-primary text-primary-foreground"
              )}
            >
              Back to My Listings
            </Link>
            <Link
              href="/marketplace"
              className={buttonVariants({ variant: "outline", size: "default" })}
            >
              Browse Marketplace
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingUploadCount = queuedImages.filter(
    (item) => item.status === "queued" || item.status === "error"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard/listings"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to My Listings</span>
          </Link>
          <Link
            href={`/marketplace/${listing.id}`}
            className="text-xs font-medium text-accent hover:underline"
          >
            View Public Listing
          </Link>
        </div>

        <Badge
          variant={persistedStatus === "SOLD" ? "warning" : "accent"}
        >
          Status: {persistedStatus === "SOLD" ? "Sold" : "Active"}
        </Badge>
      </div>

      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight text-[#FAFAFA]">
          Edit listing
        </h1>
        <p className="text-sm text-[#A1A1AA]">
          Update item details, manage uploaded photos, or update availability.
        </p>
      </div>

      {persistedStatus === "SOLD" && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-[#F59E0B]/35 bg-[#F59E0B]/10 px-4 py-3 text-xs text-[#FCD34D]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#F59E0B] mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-[#FAFAFA]">
              This listing has been marked as Sold
            </p>
            <p className="text-[#FDE68A]/90">
              Editing details and modifying photos is locked for sold items.{" "}
              <Link href="/dashboard/listings" className="underline font-medium text-[#FAFAFA]">
                Return to My Listings
              </Link>{" "}
              or{" "}
              <Link
                href={`/marketplace/${listing.id}`}
                className="underline font-medium text-[#FAFAFA]"
              >
                view public listing
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSaveChanges}
        noValidate
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
      >
        {/* Left Column: Details */}
        <Card className="lg:col-span-7 border-border bg-card shadow-xs py-6">
          <CardHeader className="px-6 space-y-1">
            <CardTitle className="text-lg font-semibold text-foreground">
              Item details
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Changes take effect immediately on the marketplace after saving.
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="px-6 pt-2">
            <ListingFormFields
              values={values}
              fieldErrors={fieldErrors}
              onChange={handleFieldChange}
              disabled={isBusy || isLocked}
              statusField={{
                value: status,
                onChange: (nextStatus) => {
                  setStatus(nextStatus);
                  if (saveError) setSaveError(null);
                  if (saveSuccess) setSaveSuccess(null);
                },
                disabled: isBusy || isLocked,
              }}
            />
          </CardContent>
        </Card>

        {/* Sticky Right Column: Photos & Actions */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
          <Card className="border-border bg-card shadow-xs py-6">
            <CardContent className="px-6 space-y-4">
              <ListingImageUploader
                existingImages={existingImages}
                queuedImages={queuedImages}
                onAddFiles={handleAddFiles}
                onRemoveQueuedImage={handleRemoveQueuedImage}
                onRetryQueuedImage={handleRetrySingleImage}
                onDeleteExistingImage={handleDeleteExistingImage}
                deletingImageIds={deletingImageIds}
                selectionErrors={selectionErrors}
                deleteError={deleteImageError}
                disabled={isBusy || isLocked || status === "SOLD"}
              />

              {imageUploadMessage && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-foreground"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-accent mt-0.5" />
                  <span>{imageUploadMessage}</span>
                </div>
              )}

              {pendingUploadCount > 0 && !isLocked && status === "ACTIVE" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={handleUploadPendingPhotosOnly}
                  className="w-full inline-flex items-center justify-center gap-1.5"
                >
                  {isUploadingPhotos ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Uploading queued photos...</span>
                    </>
                  ) : queuedImages.some((item) => item.status === "error") ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>
                        Upload / Retry {pendingUploadCount} Queued{" "}
                        {pendingUploadCount === 1 ? "Photo" : "Photos"}
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      <span>
                        Upload {pendingUploadCount} Queued{" "}
                        {pendingUploadCount === 1 ? "Photo" : "Photos"} Now
                      </span>
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Save Changes Card */}
          <Card className="border-border bg-card shadow-xs py-6">
            <CardContent className="px-6 space-y-4">
              {saveError && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive"
                >
                  {saveError}
                </div>
              )}

              {saveSuccess && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-2.5 text-xs font-medium text-[#34D399]"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
                  <span>{saveSuccess}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5">
                <Button
                  type="submit"
                  variant="accent"
                  size="lg"
                  disabled={isBusy || isLocked}
                  className="flex-1 h-11 inline-flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </Button>

                <Link
                  href={`/marketplace/${listing.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-11 px-5"
                  )}
                >
                  Cancel
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Archive / Soft-Delete Listing */}
          {!isLocked && (
            <Card className="border-destructive/25 bg-card shadow-xs py-5">
              <CardHeader className="px-6 space-y-1">
                <CardTitle className="text-sm font-semibold text-destructive">
                  Remove listing
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Archive this listing if you no longer wish to sell the item.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pt-1">
                {confirmRemoveListing ? (
                  <div className="space-y-2.5">
                    <p className="text-xs font-medium text-destructive">
                      Are you sure? Removed listings cannot be restored from the
                      UI.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => setConfirmRemoveListing(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={isBusy}
                        onClick={handleRemoveListing}
                        className="flex-1 inline-flex items-center justify-center gap-1.5"
                      >
                        {isRemovingListing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {isRemovingListing ? "Removing..." : "Confirm Remove"}
                        </span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => setConfirmRemoveListing(true)}
                    className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 inline-flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove Listing</span>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </form>
    </div>
  );
}
