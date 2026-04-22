import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-md border border-border-primary bg-transparent font-medium text-text-secondary transition-colors outline-none select-none hover:bg-hover-fill hover:text-text-primary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-pressed:border-brand-blue/40 data-pressed:bg-brand-blue/15 data-pressed:text-brand-blue",
  {
    variants: {
      size: {
        default: "h-8 gap-1.5 px-2.5 text-[12px]",
        sm: "h-7 gap-1 px-2 text-[12px]",
        lg: "h-9 gap-1.5 px-3 text-[13px]",
        icon: "size-8",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

function Toggle({
  className,
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ size, className }))}
      {...props}
    />
  )
}

export { Toggle }
