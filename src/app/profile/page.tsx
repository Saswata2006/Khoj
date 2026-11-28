import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/authorization";
import { getSafeUserProfile } from "@/lib/profile";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Profile — Khoj",
  description: "View and update your Khoj display name and meetup location.",
};

async function ProfileContent() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirectTo=/profile");
  }

  const profile = await getSafeUserProfile(user.id);
  if (!profile) {
    redirect("/login?redirectTo=/profile");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar
        activePath="/profile"
        initialUser={{
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
        }}
      />

      <main className="flex-1">
        <WorkspaceShell
          active="profile"
          user={{
            name: profile.name,
            email: profile.email,
            role: profile.role,
          }}
        >
          <div className="max-w-2xl">
            <ProfileForm
              initialProfile={{
                id: profile.id,
                name: profile.name,
                email: profile.email,
                emailVerified: profile.emailVerified,
                location: profile.location,
                hostelBlock: profile.hostelBlock,
                role: profile.role,
              }}
            />
          </div>
        </WorkspaceShell>
      </main>

      <Footer />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 sm:p-10 max-w-2xl mx-auto space-y-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-[460px] w-full rounded-xl" />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}
