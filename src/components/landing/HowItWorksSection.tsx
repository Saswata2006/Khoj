import { KeyRound, PackageCheck, ShieldCheck } from "lucide-react";

const STEPS = [
  {
    step: "01",
    icon: KeyRound,
    title: "Verify in Seconds",
    description:
      "Sign in with a 6-digit email OTP. No passwords to forget, and every buyer or seller starts verified.",
  },
  {
    step: "02",
    icon: PackageCheck,
    title: "Browse or Post Items",
    description:
      "Search live marketplace listings by category, price, and condition, or publish an item with signed photos in under a minute.",
  },
  {
    step: "03",
    icon: ShieldCheck,
    title: "Meet Safely in Person",
    description:
      "Coordinate at familiar campus landmarks or public spots, inspect the item firsthand, and mark listings sold cleanly.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-[#09090B] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl space-y-3">
          <p className="font-mono text-xs uppercase tracking-wider text-[#10B981]">
            Workflow
          </p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-[#FAFAFA] sm:text-3xl">
            How Khoj works from sign-in to handover.
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative rounded-xl border border-[#27272A] bg-[#111113] p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#10B981]/30 bg-[#10B981]/12 text-[#34D399]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-xs font-semibold tracking-widest text-[#71717A]">
                    STEP {item.step}
                  </span>
                </div>

                <h3 className="mt-5 font-heading text-base font-semibold text-[#FAFAFA]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
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
