import { Card, CardContent } from "@/components/ui/card";
import { MessageSquareOff, Layers, HelpCircle, PhoneOff } from "lucide-react";

export function ProblemSection() {
  const problems = [
    {
      icon: MessageSquareOff,
      title: "Chaotic Group Chats",
      description:
        "Listings and lost-item alerts get buried in minutes under unrelated messages and unsearchable chat threads.",
    },
    {
      icon: Layers,
      title: "Noisy Public Classifieds",
      description:
        "Generic listing boards lack clear condition grading, structured ownership claims, and organized local categories.",
    },
    {
      icon: HelpCircle,
      title: "Lost Belongings Unclaimed",
      description:
        "Misplaced calculators, headphones, keys, and bags stay scattered across notice boards with no claim review flow.",
    },
    {
      icon: PhoneOff,
      title: "Exposed Contact Info",
      description:
        "Posting personal phone numbers in public posts invites spam instead of structured, consent-based contact requests.",
    },
  ];

  return (
    <section className="py-14 sm:py-18 bg-muted/30 border-y border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-accent">
            Why Khoj
          </h2>
          <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-heading">
            Why local buying, selling, and lost &amp; found feel broken
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Communities waste hours digging through unstructured chats and
            scattered boards. Khoj brings marketplace listings and item recovery
            into one organized space.
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
