import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:border-[#10B981] focus-visible:ring-[3px] focus-visible:ring-[#10B981]/25 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-[#EF4444] aria-invalid:ring-[#EF4444]/25 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-[#FAFAFA] text-[#09090B]",
        accent:
          "border-[#10B981]/30 bg-[#10B981]/12 text-[#34D399]",
        secondary:
          "border-[#27272A] bg-[#1C1C20] text-[#FAFAFA]",
        warning:
          "border-[#F59E0B]/30 bg-[#F59E0B]/12 text-[#FBBF24]",
        destructive:
          "border-[#EF4444]/30 bg-[#EF4444]/15 text-[#FCA5A5]",
        outline:
          "border-[#27272A] bg-transparent text-[#A1A1AA] [a]:hover:bg-[#18181B] [a]:hover:text-[#FAFAFA]",
        ghost:
          "text-[#A1A1AA] hover:bg-[#18181B] hover:text-[#FAFAFA]",
        link: "text-[#34D399] underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
