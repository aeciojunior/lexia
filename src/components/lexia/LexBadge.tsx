import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import React from "react";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary border border-primary/25",
        secondary: "bg-secondary/15 text-secondary border border-secondary/25",
        success: "bg-success/15 text-success border border-success/25",
        warning: "bg-warning/15 text-warning border border-warning/25",
        destructive: "bg-destructive/15 text-destructive border border-destructive/25",
        info: "bg-info/15 text-info border border-info/25",
        outline: "border border-border text-muted-foreground",
        ai: "bg-gradient-to-r from-secondary/15 to-primary/15 text-primary border border-primary/20",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface LexBadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const LexBadge = React.forwardRef<HTMLDivElement, LexBadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  )
);
LexBadge.displayName = "LexBadge";

export { LexBadge, badgeVariants };
