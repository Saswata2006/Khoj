import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("khoj-skeleton-shimmer rounded-lg border border-[#27272A]/60", className)}
      {...props}
    />
  )
}

export { Skeleton }
