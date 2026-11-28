import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.ComponentProps<"select"> {
  hasError?: boolean;
  containerClassName?: string;
}

/**
 * Dark-themed native select control with consistent height, chevron affordance,
 * and WCAG-compliant contrast across browsers via `color-scheme: dark`.
 */
function Select({
  className,
  containerClassName,
  hasError = false,
  children,
  ...props
}: SelectProps) {
  return (
    <div className={cn("relative", containerClassName)}>
      <select
        data-slot="select"
        aria-invalid={hasError || undefined}
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-[#27272A] bg-[#111113] pr-9 pl-3 text-sm text-[#FAFAFA] transition-colors outline-none hover:border-[#3F3F46] focus-visible:border-[#10B981] focus-visible:ring-3 focus-visible:ring-[#10B981]/25 disabled:cursor-not-allowed disabled:bg-[#18181B] disabled:opacity-55 aria-invalid:border-[#EF4444] aria-invalid:ring-3 aria-invalid:ring-[#EF4444]/25",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]"
        aria-hidden="true"
      />
    </div>
  );
}

export { Select };
