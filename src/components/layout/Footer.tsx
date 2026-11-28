import Link from "next/link";
import { Activity, ArrowUpRight, Compass } from "lucide-react";
import { siteConfig } from "@/config/site";
import { FOOTER_NAV_SECTIONS } from "@/constants/navigation";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  const year = 2026;

  return (
    <footer className="relative overflow-hidden border-t border-[#27272A] bg-[#09090B]">
      {/* Subtle top emerald specular line */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#10B981]/40 to-transparent"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          {/* Large Brand Wordmark & Honest Status */}
          <div className="md:col-span-5 space-y-5">
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#27272A] bg-[#111113] text-[#10B981]">
                <Compass className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="font-heading text-3xl font-semibold tracking-tight text-[#FAFAFA]">
                {siteConfig.name}
              </span>
            </Link>

            <p className="font-mono text-xs uppercase tracking-widest text-[#34D399]">
              {siteConfig.tagline}
            </p>

            <p className="max-w-sm text-sm leading-relaxed text-[#A1A1AA]">
              {siteConfig.description}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#A1A1AA]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#27272A] bg-[#111113] px-3 py-1">
                <span
                  className="h-2 w-2 rounded-full bg-[#10B981]"
                  aria-hidden="true"
                />
                <span>Marketplace Live</span>
              </span>
              <Link
                href="/api/health"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-[#27272A] bg-[#111113] px-3 py-1 transition-colors hover:border-[#3F3F46] hover:text-[#FAFAFA]"
              >
                <Activity className="h-3 w-3 text-[#10B981]" aria-hidden="true" />
                <span>API Health</span>
              </Link>
              <a
                href={siteConfig.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-[#27272A] bg-[#111113] px-3 py-1 font-medium text-[#FAFAFA] transition-colors hover:border-[#3F3F46] hover:text-[#34D399]"
              >
                <span>GitHub</span>
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Navigation Columns */}
          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {FOOTER_NAV_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-3.5">
                <h3 className="font-mono text-xs uppercase tracking-widest text-[#71717A]">
                  {section.title}
                </h3>
                <ul className="space-y-2.5">
                  {section.links.map((link) => (
                    <li key={link.title}>
                      {link.disabled ? (
                        <span className="flex items-center justify-between text-xs text-[#71717A] cursor-not-allowed">
                          <span>{link.title}</span>
                          <span className="font-mono text-[10px]">(Soon)</span>
                        </span>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-sm text-[#A1A1AA] transition-colors hover:text-[#FAFAFA]"
                        >
                          {link.title}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-10 bg-[#27272A]" />

        <div className="flex flex-col gap-3 text-xs text-[#71717A] sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {siteConfig.name}. Community marketplace &amp; upcoming
            lost &amp; found portal.
          </p>
          <p>Email-verified access &bull; In-person meetups</p>
        </div>
      </div>
    </footer>
  );
}
