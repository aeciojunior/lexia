import { cn } from "@/lib/utils";
import React from "react";

interface TimelineItem {
  date: string;
  title: string;
  description?: string;
  status?: "completed" | "active" | "pending" | "overdue";
}

interface LegalTimelineProps {
  items: TimelineItem[];
  className?: string;
}

const dotStyles = {
  completed: "bg-success border-success shadow-glow-accent",
  active: "bg-primary border-primary shadow-glow-primary animate-pulse-glow",
  pending: "bg-muted border-border",
  overdue: "bg-destructive border-destructive",
};

const lineStyles = {
  completed: "bg-success/50",
  active: "bg-primary/50",
  pending: "bg-border",
  overdue: "bg-destructive/50",
};

export const LegalTimeline: React.FC<LegalTimelineProps> = ({ items, className }) => (
  <div className={cn("relative space-y-8 pl-8", className)}>
    {items.map((item, i) => (
      <div key={i} className="relative opacity-0 animate-fade-up" style={{ animationDelay: `${i * 120}ms` }}>
        {i < items.length - 1 && (
          <div className={cn("absolute left-[-24px] top-5 h-full w-px", lineStyles[item.status || "pending"])} />
        )}
        <div className={cn("absolute left-[-28px] top-1.5 h-3 w-3 rounded-full border-2", dotStyles[item.status || "pending"])} />
        <div>
          <p className="text-overline text-muted-foreground mb-0.5">{item.date}</p>
          <p className="text-body-sm font-semibold text-foreground">{item.title}</p>
          {item.description && <p className="mt-0.5 text-body-sm text-muted-foreground">{item.description}</p>}
        </div>
      </div>
    ))}
  </div>
);

interface RiskIndicatorProps {
  level: "low" | "medium" | "high" | "critical";
  label?: string;
}

const riskConfig = {
  low: { color: "bg-success", text: "text-success", glow: "shadow-glow-accent", label: "Baixo" },
  medium: { color: "bg-warning", text: "text-warning", glow: "", label: "Médio" },
  high: { color: "bg-destructive/70", text: "text-destructive", glow: "", label: "Alto" },
  critical: { color: "bg-destructive", text: "text-destructive", glow: "", label: "Crítico" },
};

export const RiskIndicator: React.FC<RiskIndicatorProps> = ({ level, label }) => {
  const c = riskConfig[level];
  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-2.5 w-2.5 rounded-full", c.color, c.glow)} />
      <span className={cn("text-xs font-semibold", c.text)}>{label || c.label}</span>
    </div>
  );
};
