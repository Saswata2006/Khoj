import Link from "next/link";
import { siteConfig } from "@/config/site";
import { FOOTER_NAV_SECTIONS } from "@/constants/navigation";
import { Search, Activity, ArrowUpRight } from "lucide-react";

export function Footer() {
  const currentYear = 2026;

  return (
    <footer className="border-t border-border bg-card text-card-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand and Description */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Search className="h-4 w-4 text-accent stroke-[2.5]" />
              </div>
              <span className="font-heading text-lg font-bold tracking-tight text-foreground">
                {siteConfig.name}
              </span>
            </Link>
            <p className="text-sm font-semibold text-accent">
              {siteConfig.tagline}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              {siteConfig.description}
            </p>
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-700 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                Auth Active
              </span>
              <span>&bull;</span>
              <Link
                href="/api/health"
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                target="_blank"
              >
                <Activity className="h-3 w-3 text-emerald-600" />
                <span>API Health Check</span>
              </Link>
              <span>&bull;</span>
              <a
                href={siteConfig.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-foreground hover:text-accent transition-colors"
              >
                <span>GitHub</span>
                <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Navigation Columns */}
          {FOOTER_NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.title}>
                    {link.disabled ? (
                      <span className="text-xs text-muted-foreground/70 cursor-not-allowed flex items-center justify-between">
                        <span>{link.title}</span>
                        <span className="text-[10px] text-muted-foreground/60">
                          (Soon)
                        </span>
                      </span>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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

        {/* Bottom Bar */}
        <div className="mt-12 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>
            &copy; {currentYear} {siteConfig.name}. Community marketplace &amp;
            lost &amp; found for local neighborhoods and campuses.
          </p>
          <p>Email-verified accounts &bull; Built for local meetups</p>
        </div>
      </div>
    </footer>
  );
}
