import { MessageSquareOff, Search, ShieldCheck } from "lucide-react";

const CONTRASTS = [
  {
    icon: MessageSquareOff,
    code: "01",
    title: "Built to replace buried chat threads",
    description:
      "Listings in chat groups sink under unrelated chatter within hours. Khoj keeps every available item searchable by category, price, and condition.",
  },
  {
    icon: Search,
    code: "02",
    title: "Transparent availability & condition",
    description:
      "Sold items lock cleanly instead of staying vague, and fixed INR pricing sets clear expectations before anyone steps out to meet.",
  },
  {
    icon: ShieldCheck,
    code: "03",
    title: "Privacy-conscious account access",
    description:
      "Passwordless email OTP confirms inbox ownership while keeping public listing views limited to initials, display name, and general area.",
  },
];

export function ProblemSection() {
  return (
    <section className="border-b border-[#27272A] bg-[#09090B] py-16 sm:py-22">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl space-y-2.5">
          <p className="font-mono text-xs uppercase tracking-widest text-[#10B981]">
            Why Khoj
          </p>
          <h2 className="font-heading text-section-heading text-[#FAFAFA]">
            Structured community trade without group-chat clutter.
          </h2>
          <p className="text-sm leading-relaxed text-[#A1A1AA] sm:text-base">
            Clear item metadata, honest availability states, and practical
            privacy defaults designed for everyday handovers.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {CONTRASTS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.code}
                className="rounded-2xl border border-[#27272A] bg-[#111113] p-6 surface-specular transition-colors hover:border-[#3F3F46]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#27272A] bg-[#18181B] text-[#34D399]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-xs text-[#71717A]">
                    {item.code}
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
