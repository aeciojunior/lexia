import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LexPageHeaderProps {
  overline?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Cabeçalho padronizado de páginas internas */
export function LexPageHeader({
  overline,
  title,
  description,
  actions,
  className,
}: LexPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        "pb-1 animate-fade-up",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {overline && (
          <p className="text-overline text-primary">{overline}</p>
        )}
        <h1 className="text-display-lg truncate">{title}</h1>
        {description && (
          <p className="text-body-sm text-muted-foreground max-w-2xl">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}

interface LexSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Card de seção com borda suave */
export function LexSection({ title, description, children, className }: LexSectionProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm overflow-hidden",
        "shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      {(title || description) && (
        <div className="px-5 py-4 border-b border-border/50 bg-muted/15">
          {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
