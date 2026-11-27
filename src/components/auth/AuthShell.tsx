import Link from "next/link";
import { Search } from "lucide-react";
import { siteConfig } from "@/config/site";

interface AuthShellProps {
  children: React.ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Bar */}
      <header className="w-full border-b border-border/80 bg-background/95">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
              <Search className="h-4.5 w-4.5 text-accent stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-heading text-xl font-bold tracking-tight text-foreground">
                  {siteConfig.name}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {siteConfig.tagline}
              </span>
            </div>
          </Link>
        </div>
      </header>

      {/* Centered Card Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* Minimal Footer */}
      <footer className="py-6 text-center text-xs text-muted-foreground px-4">
        <p>
          {siteConfig.name} &mdash; Passwordless sign-in protected by one-time email verification.
        </p>
      </footer>
    </div>
  );
}
