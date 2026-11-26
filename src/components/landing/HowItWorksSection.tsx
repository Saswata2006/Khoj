import { MailCheck, PlusCircle, Handshake, CheckCircle } from "lucide-react";

export function HowItWorksSection() {
  const steps = [
    {
      step: "01",
      icon: MailCheck,
      title: "Verify Student Email",
      description:
        "Authenticate using your college email address. This ensures you only trade and interact with enrolled peers.",
    },
    {
      step: "02",
      icon: PlusCircle,
      title: "Post Item or Claim",
      description:
        "List items for sale with clear photos and prices, or report lost/found items with designated campus meetup spots.",
    },
    {
      step: "03",
      icon: Handshake,
      title: "Request or Prove Claim",
      description:
        "Buyers request seller details privately. For lost items, submit proof of ownership for the finder to verify.",
    },
    {
      step: "04",
      icon: CheckCircle,
      title: "Meetup & Complete",
      description:
        "Meet at convenient campus spots (canteen, library lobby, or hostel gates) for cash or UPI exchange.",
    },
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-20 bg-muted/40 border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-accent">
            Simple Process
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground font-heading">
            How Khoj works in 4 easy steps
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Built from scratch to prioritize student safety, speed, and accountability.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="relative flex flex-col p-6 rounded-xl bg-card border border-border shadow-2xs">
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
