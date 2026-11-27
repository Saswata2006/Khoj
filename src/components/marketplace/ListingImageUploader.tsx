"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  MAX_IMAGES_PER_LISTING,
  type QueuedUploadItem,
  type UploadedImageSummary,
} from "@/lib/marketplace-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ListingImageUploaderProps {
  existingImages?: UploadedImageSummary[];
  queuedImages: QueuedUploadItem[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveQueuedImage: (queueId: string) => void;
  onRetryQueuedImage?: (queueId: string) => void;
  onDeleteExistingImage?: (imageId: string) => Promise<void> | void;
  deletingImageIds?: string[];
  selectionErrors?: string[];
  deleteError?: string | null;
  disabled?: boolean;
  maxImages?: number;
}

export function ListingImageUploader({
  existingImages = [],
  queuedImages,
  onAddFiles,
  onRemoveQueuedImage,
  onRetryQueuedImage,
  onDeleteExistingImage,
  deletingImageIds = [],
  selectionErrors = [],
  deleteError = null,
  disabled = false,
  maxImages = MAX_IMAGES_PER_LISTING,
}: ListingImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const totalCount = existingImages.length + queuedImages.length;
  const remainingSlots = Math.max(0, maxImages - totalCount);
  const canAddMore = !disabled && remainingSlots > 0;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onAddFiles(files);
    }
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (!canAddMore) return;
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      onAddFiles(event.dataTransfer.files);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (canAddMore && !isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Product photos{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (optional)
            </span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            JPEG, PNG, or WebP up to 3 MiB each. Maximum {maxImages} images per
            listing.
          </p>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "shrink-0 text-xs font-medium",
            totalCount >= maxImages
              ? "bg-amber-500/15 text-amber-800"
              : "bg-muted text-foreground"
          )}
        >
          {totalCount} / {maxImages}
        </Badge>
      </div>

      {/* Dropzone & File Picker */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative rounded-xl border-2 border-dashed p-5 text-center transition-colors",
          isDragging && canAddMore
            ? "border-accent bg-emerald-500/5"
            : "border-border bg-muted/30",
          !canAddMore && "opacity-60 cursor-not-allowed"
        )}
      >
        <input
          ref={fileInputRef}
          id="listing-images-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={!canAddMore}
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Upload product images"
        />

        <div className="flex flex-col items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background border border-border text-muted-foreground shadow-2xs">
            <UploadCloud className="h-5 w-5" />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {remainingSlots > 0
                ? "Drag & drop product photos here"
                : `Maximum of ${maxImages} photos attached`}
            </p>
            <p className="text-xs text-muted-foreground">
              {remainingSlots > 0
                ? `You can add up to ${remainingSlots} more ${
                    remainingSlots === 1 ? "image" : "images"
                  }.`
                : "Remove an image below to replace it with another."}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canAddMore}
            onClick={() => fileInputRef.current?.click()}
            className="mt-1 inline-flex items-center gap-1.5 bg-card"
          >
            <ImagePlus className="h-4 w-4" />
            <span>Select Photos</span>
          </Button>
        </div>
      </div>

      {/* Selection / Upload Validation Errors */}
      {selectionErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1"
        >
          {selectionErrors.map((errMsg, index) => (
            <div key={`${errMsg}-${index}`} className="flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{errMsg}</span>
            </div>
          ))}
        </div>
      )}

      {deleteError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{deleteError}</span>
        </div>
      )}

      {/* Existing Uploaded Images Grid */}
      {existingImages.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Saved photos ({existingImages.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {existingImages.map((img, index) => {
              const isDeleting = deletingImageIds.includes(img.id);
              const isConfirming = confirmDeleteId === img.id;

              return (
                <div
                  key={img.id}
                  className="overflow-hidden rounded-lg border border-border bg-card shadow-2xs"
                >
                  <div className="relative aspect-4/3 w-full bg-muted">
                    <Image
                      unoptimized
                      src={img.imageUrl}
                      alt={`Saved listing photo ${index + 1}`}
                      fill
                      sizes="(max-width: 640px) 100vw, 240px"
                      className="object-cover"
                    />
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-0.5 text-[11px] font-medium text-emerald-700 shadow-2xs">
                      <CheckCircle2 className="h-3 w-3 text-accent" />
                      Uploaded
                    </span>
                  </div>

                  {onDeleteExistingImage && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/20 border-t border-border">
                      {isConfirming ? (
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-destructive">
                            Remove photo?
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              disabled={isDeleting || disabled}
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="xs"
                              disabled={isDeleting || disabled}
                              onClick={async () => {
                                setConfirmDeleteId(null);
                                await onDeleteExistingImage(img.id);
                              }}
                            >
                              {isDeleting ? "Removing..." : "Confirm"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="text-[11px] text-muted-foreground truncate">
                            Photo #{index + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            disabled={isDeleting || disabled}
                            onClick={() => setConfirmDeleteId(img.id)}
                            className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                            aria-label={`Remove saved photo ${index + 1}`}
                          >
                            {isDeleting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            <span>{isDeleting ? "Removing..." : "Remove"}</span>
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Queued / Uploading / Failed Local Previews Grid */}
      {queuedImages.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Upload queue ({queuedImages.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {queuedImages.map((item) => {
              const isUploading = item.status === "uploading";
              const isError = item.status === "error";
              const isUploaded = item.status === "uploaded";

              return (
                <div
                  key={item.id}
                  className={cn(
                    "overflow-hidden rounded-lg border bg-card shadow-2xs",
                    isError ? "border-destructive/50" : "border-border"
                  )}
                >
                  <div className="relative aspect-4/3 w-full bg-muted">
                    <Image
                      unoptimized
                      src={item.previewUrl}
                      alt={item.file.name}
                      fill
                      sizes="(max-width: 640px) 100vw, 240px"
                      className={cn(
                        "object-cover transition-opacity",
                        isUploading && "opacity-65"
                      )}
                    />

                    {/* Status Badge */}
                    <span
                      className={cn(
                        "absolute left-2 top-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium shadow-2xs",
                        isUploaded &&
                          "bg-background/95 text-emerald-700",
                        isUploading && "bg-primary text-primary-foreground",
                        isError && "bg-destructive text-destructive-foreground",
                        item.status === "queued" &&
                          "bg-background/95 text-foreground"
                      )}
                    >
                      {isUploading && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {isUploaded && (
                        <CheckCircle2 className="h-3 w-3 text-accent" />
                      )}
                      {isError && <AlertCircle className="h-3 w-3" />}
                      <span>
                        {item.status === "queued" && "Ready to upload"}
                        {isUploading && "Uploading..."}
                        {isUploaded && "Uploaded"}
                        {isError && "Upload failed"}
                      </span>
                    </span>

                    {/* Remove Button (disabled while uploading) */}
                    {!isUploading && !isUploaded && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onRemoveQueuedImage(item.id)}
                        aria-label={`Remove ${item.file.name}`}
                        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-2xs hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="px-3 py-2 space-y-1.5 border-t border-border bg-muted/20">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        title={item.file.name}
                        className="truncate text-xs font-medium text-foreground"
                      >
                        {item.file.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {(item.file.size / 1024).toFixed(0)} KB
                      </span>
                    </div>

                    {isError && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] leading-snug text-destructive">
                          {item.error ?? "Upload failed. Please retry or remove."}
                        </p>
                        {onRetryQueuedImage && (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={disabled}
                            onClick={() => onRetryQueuedImage(item.id)}
                            className="w-full inline-flex items-center justify-center gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>Retry Upload</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
