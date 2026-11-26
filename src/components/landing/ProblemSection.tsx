import { Card, CardContent } from "@/components/ui/card";
import { MessageSquareOff, UserX, AlertTriangle, HelpCircle } from "lucide-react";

export function ProblemSection() {
  const problems = [
    {
      icon: MessageSquareOff,
      title: "Chaotic WhatsApp Groups",
      description:
        "Listing messages get drowned in minutes under hundreds of spam posts, academic queries, and unorganized chatter.",
    },
    {
      icon: UserX,
      title: "Unverified Outside Buyers",
      description:
        "Public classified sites invite strangers and fraudsters onto campus grounds without college accountability.",
    },
    {
      icon: HelpCircle,
      title: "Lost Items Lost Forever",
      description:
        "Misplaced earphones, calculators, and cycle keys end up abandoned at security booths or scattered across random group chats.",
    },
    {
      icon: AlertTriangle,
      title: "Awkward Hostel Lobby Bargains",
      description:
        "Lack of standardized pricing, clear item conditions, and structured contact requests leads to friction between peers.",
    },
  ];

  return (
    <section className="py-14 sm:py-18 bg-muted/30 border-y border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-accent">
            The Campus Reality
          </h2>
          <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-heading">
            Why traditional campus selling and lost & found are broken
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Students waste hours scouring unstructured chats and bulletin boards. Khoj solves this with a purpose-built campus directory.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {problems.map((prob) => {
            const Icon = prob.icon;
            return (
              <Card
                key={prob.title}
                className="bg-card border-border shadow-2xs hover:shadow-xs transition-shadow"
              >
                <CardContent className="pt-6">
                  <div className="h-10 w-10 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading font-semibold text-base text-foreground mb-1.5">
                    {prob.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {prob.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
