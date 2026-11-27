"use client";

import { IndianRupee, MapPin } from "lucide-react";
import { CATEGORY_LIST, CONDITIONS } from "@/constants/categories";
import {
  MARKETPLACE_CONDITIONS,
  type ListingFormFieldErrors,
  type ListingFormValues,
} from "@/lib/marketplace-ui";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ListingFormFieldsProps {
  values: ListingFormValues;
  fieldErrors: ListingFormFieldErrors;
  onChange: <K extends keyof ListingFormValues>(
    field: K,
    value: ListingFormValues[K]
  ) => void;
  disabled?: boolean;
  statusField?: {
    value: "ACTIVE" | "SOLD";
    onChange: (value: "ACTIVE" | "SOLD") => void;
    disabled?: boolean;
  };
}

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

export function ListingFormFields({
  values,
  fieldErrors,
  onChange,
  disabled = false,
  statusField,
}: ListingFormFieldsProps) {
  const selectedConditionMeta =
    values.condition in CONDITIONS
      ? CONDITIONS[values.condition as keyof typeof CONDITIONS]
      : null;

  return (
    <div className="space-y-5">
      {/* Product Title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="listing-title"
            className="block text-sm font-medium text-foreground"
          >
            Product title <span className="text-destructive">*</span>
          </label>
          <span className="text-[11px] text-muted-foreground">
            {values.title.trim().length} / 120
          </span>
        </div>
        <Input
          id="listing-title"
          name="title"
          type="text"
          maxLength={120}
          required
          disabled={disabled}
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={
            fieldErrors.title ? "listing-title-error" : "listing-title-hint"
          }
          value={values.title}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="e.g., Casio fx-991EX Scientific Calculator"
          className="h-10 bg-card"
        />
        {fieldErrors.title ? (
          <p
            id="listing-title-error"
            role="alert"
            className="text-xs text-destructive"
          >
            {fieldErrors.title}
          </p>
        ) : (
          <p id="listing-title-hint" className="text-[11px] text-muted-foreground">
            Use a clear, descriptive title (3–120 characters).
          </p>
        )}
      </div>

      {/* Category & Condition Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Category */}
        <div className="space-y-1.5">
          <label
            htmlFor="listing-category"
            className="block text-sm font-medium text-foreground"
          >
            Category <span className="text-destructive">*</span>
          </label>
          <select
            id="listing-category"
            name="category"
            required
            disabled={disabled}
            aria-invalid={Boolean(fieldErrors.category)}
            aria-describedby={
              fieldErrors.category ? "listing-category-error" : undefined
            }
            value={values.category}
            onChange={(e) => onChange("category", e.target.value)}
            className={selectClassName}
          >
            <option value="">Select category</option>
            {CATEGORY_LIST.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {fieldErrors.category && (
            <p
              id="listing-category-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {fieldErrors.category}
            </p>
          )}
        </div>

        {/* Product Condition */}
        <div className="space-y-1.5">
          <label
            htmlFor="listing-condition"
            className="block text-sm font-medium text-foreground"
          >
            Condition <span className="text-destructive">*</span>
          </label>
          <select
            id="listing-condition"
            name="condition"
            required
            disabled={disabled}
            aria-invalid={Boolean(fieldErrors.condition)}
            aria-describedby={
              fieldErrors.condition
                ? "listing-condition-error"
                : "listing-condition-hint"
            }
            value={values.condition}
            onChange={(e) => onChange("condition", e.target.value)}
            className={selectClassName}
          >
            <option value="">Select condition</option>
            {MARKETPLACE_CONDITIONS.map((condKey) => (
              <option key={condKey} value={condKey}>
                {CONDITIONS[condKey].label}
              </option>
            ))}
          </select>
          {fieldErrors.condition ? (
            <p
              id="listing-condition-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {fieldErrors.condition}
            </p>
          ) : selectedConditionMeta ? (
            <p
              id="listing-condition-hint"
              className="text-[11px] text-muted-foreground"
            >
              {selectedConditionMeta.description}
            </p>
          ) : (
            <p
              id="listing-condition-hint"
              className="text-[11px] text-muted-foreground"
            >
              Describe the physical state accurately.
            </p>
          )}
        </div>
      </div>

      {/* Price & General Location Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Price in INR */}
        <div className="space-y-1.5">
          <label
            htmlFor="listing-price"
            className="block text-sm font-medium text-foreground"
          >
            Price (INR) <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="listing-price"
              name="price"
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              max="10000000"
              required
              disabled={disabled}
              aria-invalid={Boolean(fieldErrors.price)}
              aria-describedby={
                fieldErrors.price ? "listing-price-error" : "listing-price-hint"
              }
              value={values.price}
              onChange={(e) => onChange("price", e.target.value)}
              placeholder="850"
              className="h-10 pl-9 bg-card"
            />
          </div>
          {fieldErrors.price ? (
            <p
              id="listing-price-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {fieldErrors.price}
            </p>
          ) : (
            <p id="listing-price-hint" className="text-[11px] text-muted-foreground">
              Enter your fixed asking price in INR (₹).
            </p>
          )}
        </div>

        {/* General Location */}
        <div className="space-y-1.5">
          <label
            htmlFor="listing-location"
            className="block text-sm font-medium text-foreground"
          >
            General location <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="listing-location"
              name="location"
              type="text"
              maxLength={120}
              required
              disabled={disabled}
              aria-invalid={Boolean(fieldErrors.location)}
              aria-describedby={
                fieldErrors.location
                  ? "listing-location-error"
                  : "listing-location-hint"
              }
              value={values.location}
              onChange={(e) => onChange("location", e.target.value)}
              placeholder="e.g., North Campus Library, Indiranagar"
              className="h-10 pl-9 bg-card"
            />
          </div>
          {fieldErrors.location ? (
            <p
              id="listing-location-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {fieldErrors.location}
            </p>
          ) : (
            <p
              id="listing-location-hint"
              className="text-[11px] text-muted-foreground"
            >
              Safe public meetup spot or neighborhood (2–120 chars).
            </p>
          )}
        </div>
      </div>

      {/* Optional Status Field (Edit mode) */}
      {statusField && (
        <div className="space-y-1.5">
          <label
            htmlFor="listing-status"
            className="block text-sm font-medium text-foreground"
          >
            Listing availability
          </label>
          <select
            id="listing-status"
            name="status"
            disabled={disabled || statusField.disabled}
            value={statusField.value}
            onChange={(e) =>
              statusField.onChange(e.target.value as "ACTIVE" | "SOLD")
            }
            className={selectClassName}
          >
            <option value="ACTIVE">Active (Visible on Marketplace)</option>
            <option value="SOLD">Sold (Marks item sold and closes edits)</option>
          </select>
          <p className="text-[11px] text-muted-foreground">
            Marking a listing as Sold locks further editing to keep buyer records
            consistent.
          </p>
        </div>
      )}

      {/* Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="listing-description"
            className="block text-sm font-medium text-foreground"
          >
            Description <span className="text-destructive">*</span>
          </label>
          <span className="text-[11px] text-muted-foreground">
            {values.description.trim().length} / 3000
          </span>
        </div>
        <textarea
          id="listing-description"
          name="description"
          rows={5}
          maxLength={3000}
          required
          disabled={disabled}
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby={
            fieldErrors.description
              ? "listing-description-error"
              : "listing-description-hint"
          }
          value={values.description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Describe age, usage, included accessories, flaws, and convenient meetup hours..."
          className={cn(
            "min-h-[130px] w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
          )}
        />
        {fieldErrors.description ? (
          <p
            id="listing-description-error"
            role="alert"
            className="text-xs text-destructive"
          >
            {fieldErrors.description}
          </p>
        ) : (
          <p
            id="listing-description-hint"
            className="text-[11px] text-muted-foreground"
          >
            Minimum 10 characters. Be transparent about condition and accessories.
          </p>
        )}
      </div>
    </div>
  );
}
