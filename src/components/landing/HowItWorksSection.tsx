import { MailCheck, PlusCircle, Handshake, MapPin } from "lucide-react";

export function HowItWorksSection() {
  const steps = [
    {
      step: "01",
      icon: MailCheck,
      title: "Verify Your Email",
      description:
        "Sign in using any valid email address with a passwordless 6-digit one-time code.",
    },
    {
      step: "02",
      icon: PlusCircle,
      title: "Browse or Post Items",
      description:
        "Browse or post Marketplace items with photos and condition grades (Lost & Found reporting launching next).",
    },
    {
      step: "03",
      icon: Handshake,
      title: "Claims & Requests (Soon)",
      description:
        "Buyers send contact requests privately, while finders review ownership claims before releasing items.",
    },
    {
      step: "04",
      icon: MapPin,
      title: "Local Meetups",
      description:
        "Coordinate a safe, public local or campus meetup to inspect the item and complete the handover.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="py-16 sm:py-20 bg-muted/40 border-t border-border"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-accent">
            Simple Process
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground font-heading">
            How Khoj works in 4 clear steps
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Structured around email-verified accounts, transparent listings, and
            thoughtful local meetups.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative flex flex-col p-6 rounded-xl bg-card border border-border shadow-2xs"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <span className="font-mono text-2xl font-black text-muted-foreground/30">
                    {item.step}
                  </span>
                </div>
                <h3 className="font-heading font-semibold text-base text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
