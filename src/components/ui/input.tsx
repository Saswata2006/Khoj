import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-[#27272A] bg-[#111113] px-3 py-1.5 text-base text-[#FAFAFA] transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#FAFAFA] placeholder:text-[#71717A] hover:border-[#3F3F46] focus-visible:border-[#10B981] focus-visible:ring-3 focus-visible:ring-[#10B981]/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#18181B] disabled:opacity-55 aria-invalid:border-[#EF4444] aria-invalid:ring-3 aria-invalid:ring-[#EF4444]/25 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
