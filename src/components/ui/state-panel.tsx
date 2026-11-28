import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatePanelProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone?: "neutral" | "error" | "warning" | "accent";
  actions?: React.ReactNode;
  className?: string;
  role?: "status" | "alert";
}

const TONE_CLASSES: Record<
  NonNullable<StatePanelProps["tone"]>,
  { wrapper: string; iconWrap: string }
> = {
  neutral: {
    wrapper: "border-[#27272A] bg-[#111113]",
    iconWrap: "border-[#27272A] bg-[#18181B] text-[#A1A1AA]",
  },
  accent: {
    wrapper: "border-[#10B981]/25 bg-[#111113]",
    iconWrap: "border-[#10B981]/30 bg-[#10B981]/12 text-[#34D399]",
  },
  warning: {
    wrapper: "border-[#F59E0B]/30 bg-[#111113]",
    iconWrap: "border-[#F59E0B]/30 bg-[#F59E0B]/12 text-[#FBBF24]",
  },
  error: {
    wrapper: "border-[#EF4444]/30 bg-[#EF4444]/5",
    iconWrap: "border-[#EF4444]/30 bg-[#EF4444]/15 text-[#FCA5A5]",
  },
};

export function StatePanel({
  icon,
  title,
  description,
  tone = "neutral",
  actions,
  className,
  role,
}: StatePanelProps) {
  const palette = TONE_CLASSES[tone];

  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border px-6 py-12 text-center",
        palette.wrapper,
        className
      )}
    >
      <div
        className={cn(
          "mb-4 flex h-12 w-12 items-center justify-center rounded-xl border",
          palette.iconWrap
        )}
      >
        {icon}
      </div>
      <h2 className="font-heading text-lg font-semibold tracking-tight text-[#FAFAFA]">
        {title}
      </h2>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#A1A1AA]">
        {description}
      </p>
      {actions && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {actions}
        </div>
      )}
    </div>
  );
}
