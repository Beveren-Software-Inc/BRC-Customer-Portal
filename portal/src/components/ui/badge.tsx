import type * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        "secondary-purple":
          "border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800",
        destructive:
          "border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800",
        success:
          "border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800",
        warning:
          "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800",
        info: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

