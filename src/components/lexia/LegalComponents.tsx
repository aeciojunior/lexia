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

const statusColors = {
  completed: "bg-success border-success",
  active: "bg-primary border-primary animate-pulse-glow",
  pending: "bg-muted border-border",
  overdue: "bg-destructive border-destructive",
};

const statusLine = {
  completed: "bg-success",
  active: "bg-primary",
  pending: "bg-border",
  overdue: "bg-destructive",
};

export const LegalTimeline: React.FC<LegalTimelineProps> = ({ items, className }) => (
  <div className={cn("relative space-y-6 pl-8", className)}>
    {items.map((item, i) => (
      <div key={i} className="relative animate-fade-up" style={{ animationDelay: `${i * 100}ms` }}>
        {/* Line */}
        {i < items.length - 1 && (
          <div className={cn("absolute left-[-24px] top-4 h-full w-0.5", statusLine[item.status || "pending"])} />
        )}
        {/* Dot */}
        <div className={cn("absolute left-[-28px] top-1 h-3 w-3 rounded-full border-2", statusColors[item.status || "pending"])} />
        {/* Content */}
        <div>
          <p className="text-caption text-muted-foreground">{item.date}</p>
          <p className="text-label text-foreground">{item.title}</p>
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
  low: { color: "bg-success", text: "text-success", label: "Baixo" },
  medium: { color: "bg-warning", text: "text-warning", label: "Médio" },
  high: { color: "bg-destructive/70", text: "text-destructive", label: "Alto" },
  critical: { color: "bg-destructive", text: "text-destructive", label: "Crítico" },
};

export const RiskIndicator: React.FC<RiskIndicatorProps> = ({ level, label }) => {
  const config = riskConfig[level];
  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-2.5 w-2.5 rounded-full", config.color)} />
      <span className={cn("text-label", config.text)}>{label || config.label}</span>
    </div>
  );
};
