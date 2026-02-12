import { cn } from "@/lib/utils";
import React from "react";

interface LexCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "ai" | "process" | "glass" | "glow";
  hover?: boolean;
}

const LexCard = React.forwardRef<HTMLDivElement, LexCardProps>(
  ({ className, variant = "default", hover = true, children, ...props }, ref) => {
    const base = "rounded-xl p-6 transition-all duration-normal relative";
    const variants = {
      default: "bg-card border border-border shadow-sm",
      ai: "bg-card border border-secondary/20 shadow-sm neon-border-violet",
      process: "bg-card border border-primary/20 shadow-sm neon-border",
      glass: "glass",
      glow: "bg-card border border-border shadow-sm ambient-glow",
    };

    return (
      <div
        ref={ref}
        className={cn(base, variants[variant], hover && "hover:shadow-lg hover:-translate-y-1 hover:border-primary/30", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
LexCard.displayName = "LexCard";

const LexCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mb-4 flex items-start justify-between", className)} {...props} />
  )
);
LexCardHeader.displayName = "LexCardHeader";

const LexCardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-display-sm text-foreground", className)} {...props} />
  )
);
LexCardTitle.displayName = "LexCardTitle";

export { LexCard, LexCardHeader, LexCardTitle };
