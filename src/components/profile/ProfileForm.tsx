"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { campusConfig } from "@/config/campus";
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

export interface ProfileFormUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  location: string | null;
  hostelBlock: string | null;
  role: "USER" | "ADMIN";
}

interface ProfileFormProps {
  initialProfile: ProfileFormUser;
}

export function ProfileForm({ initialProfile }: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialProfile.name ?? "");
  const [location, setLocation] = useState(initialProfile.location ?? "");
  const [hostelBlock, setHostelBlock] = useState(
    initialProfile.hostelBlock ?? ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Display name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          location: location.trim(),
          hostelBlock: hostelBlock.trim(),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        profile?: ProfileFormUser;
      };

      if (!response.ok) {
        setError(payload.error ?? "Unable to update profile. Please try again.");
        return;
      }

      if (payload.profile) {
        setName(payload.profile.name ?? "");
        setLocation(payload.profile.location ?? "");
        setHostelBlock(payload.profile.hostelBlock ?? "");
      }

      setSuccessMessage("Profile updated successfully.");
      router.refresh();
    } catch {
      setError("Network error while saving profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to dashboard</span>
        </Link>
        <Badge
          variant="secondary"
          className="text-[11px] font-medium bg-muted text-foreground"
        >
          Role: {initialProfile.role}
        </Badge>
      </div>

      <Card className="shadow-sm border-border bg-card py-6">
        <CardHeader className="px-6 space-y-1.5">
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Profile settings
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Keep your display name and meetup location up to date for safe
            community exchanges.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Read-only Verified Email */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="profile-email"
                  className="block text-sm font-medium text-foreground"
                >
                  Email address
                </label>
                {initialProfile.emailVerified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                    Verified
                  </span>
                )}
              </div>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-email"
                  type="email"
                  value={initialProfile.email}
                  readOnly
                  disabled
                  aria-readonly="true"
                  className="h-10 pl-9 bg-muted/60 text-muted-foreground cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your verified sign-in email cannot be changed.
              </p>
            </div>

            <Separator />

            {/* Display Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="profile-name"
                className="block text-sm font-medium text-foreground"
              >
                Display name <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-name"
                  name="name"
                  type="text"
                  maxLength={80}
                  required
                  disabled={isSaving}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                    if (successMessage) setSuccessMessage(null);
                  }}
                  placeholder="How should community members call you?"
                  className="h-10 pl-9 bg-card"
                />
              </div>
            </div>

            {/* General Location */}
            <div className="space-y-1.5">
              <label
                htmlFor="profile-location"
                className="block text-sm font-medium text-foreground"
              >
                General location
              </label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-location"
                  name="location"
                  type="text"
                  maxLength={120}
                  disabled={isSaving}
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    if (error) setError(null);
                    if (successMessage) setSuccessMessage(null);
                  }}
                  placeholder="e.g., North Campus, Indiranagar, Powai"
                  className="h-10 pl-9 bg-card"
                />
              </div>
            </div>

            {/* Optional Hostel / Campus Info */}
            <div className="space-y-1.5">
              <label
                htmlFor="profile-hostel"
                className="block text-sm font-medium text-foreground"
              >
                Hostel / campus block{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-hostel"
                  name="hostelBlock"
                  type="text"
                  list="khoj-hostel-suggestions"
                  maxLength={80}
                  disabled={isSaving}
                  value={hostelBlock}
                  onChange={(e) => {
                    setHostelBlock(e.target.value);
                    if (error) setError(null);
                    if (successMessage) setSuccessMessage(null);
                  }}
                  placeholder="e.g., Block A, Hostel 2, Day Scholar"
                  className="h-10 pl-9 bg-card"
                />
                <datalist id="khoj-hostel-suggestions">
                  {campusConfig.hostelBlocks.map((block) => (
                    <option key={block} value={block} />
                  ))}
                </datalist>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
              >
                {error}
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <Button
                type="submit"
                size="lg"
                disabled={isSaving || !name.trim()}
                className="h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving changes...</span>
                  </>
                ) : (
                  <span>Save Profile</span>
                )}
              </Button>
            </div>
          </form>
        </CardContent>

        <Separator />

        <CardFooter className="px-6 py-4 bg-muted/40 text-xs text-muted-foreground">
          Only your display name, general location, and optional campus block
          are shared with your profile.
        </CardFooter>
      </Card>
    </div>
  );
}
