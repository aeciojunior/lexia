import { cn } from "@/lib/utils";
import React from "react";

interface LexCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "ai" | "process" | "glass";
  hover?: boolean;
}

const LexCard = React.forwardRef<HTMLDivElement, LexCardProps>(
  ({ className, variant = "default", hover = true, children, ...props }, ref) => {
    const variants = {
      default: "bg-card border border-border shadow-sm",
      ai: "bg-card border border-secondary/20 shadow-sm",
      process: "bg-card border border-primary/20 shadow-sm",
      glass: "glass",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg p-6 transition-all duration-normal",
          variants[variant],
          hover && "hover:shadow-md hover:-translate-y-0.5",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
LexCard.displayName = "LexCard";

interface LexCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const LexCardHeader = React.forwardRef<HTMLDivElement, LexCardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mb-4 flex items-start justify-between", className)} {...props} />
  )
);
LexCardHeader.displayName = "LexCardHeader";

interface LexCardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const LexCardTitle = React.forwardRef<HTMLHeadingElement, LexCardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-display-sm", className)} {...props} />
  )
);
LexCardTitle.displayName = "LexCardTitle";

export { LexCard, LexCardHeader, LexCardTitle };
