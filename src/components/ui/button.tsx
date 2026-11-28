import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-150 outline-none select-none focus-visible:border-[#10B981] focus-visible:ring-3 focus-visible:ring-[#10B981]/25 active:not-aria-[haspopup]:scale-[0.98] active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/25 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[#FAFAFA] text-[#09090B] hover:bg-[#E4E4E7] shadow-[0_1px_0_rgba(255,255,255,0.2)_inset]",
        accent:
          "bg-[#10B981] text-[#052E16] font-semibold hover:bg-[#34D399] shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_6px_20px_-6px_rgba(16,185,129,0.5)]",
        outline:
          "border-[#27272A] bg-[#111113] text-[#FAFAFA] hover:bg-[#18181B] hover:border-[#3F3F46] aria-expanded:bg-[#18181B] aria-expanded:text-[#FAFAFA]",
        secondary:
          "border-[#27272A] bg-[#1C1C20] text-[#FAFAFA] hover:bg-[#27272A] aria-expanded:bg-[#27272A]",
        ghost:
          "text-[#A1A1AA] hover:bg-[#18181B] hover:text-[#FAFAFA] aria-expanded:bg-[#18181B] aria-expanded:text-[#FAFAFA]",
        destructive:
          "border-[#EF4444]/30 bg-[#EF4444]/15 text-[#FCA5A5] hover:bg-[#EF4444]/25 hover:border-[#EF4444]/50 focus-visible:border-[#EF4444] focus-visible:ring-[#EF4444]/25",
        link: "text-[#34D399] underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-7 gap-1 rounded-md px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-lg px-3 text-xs font-medium in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 rounded-lg px-4 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-9",
        "icon-xs":
          "size-7 rounded-md in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm":
          "size-8 rounded-lg in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
