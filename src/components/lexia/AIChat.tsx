import { cn } from "@/lib/utils";
import { Bot, User, Sparkles } from "lucide-react";
import React from "react";

interface ChatMessageProps {
  role: "user" | "ai" | "agent";
  content: string;
  agentName?: string;
  timestamp?: string;
  className?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  content,
  agentName,
  timestamp,
  className,
}) => {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 animate-fade-up",
        isUser ? "flex-row-reverse" : "flex-row",
        className
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : role === "agent"
            ? "bg-accent text-accent-foreground"
            : "bg-secondary text-secondary-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : role === "agent" ? <Sparkles className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-4 py-3 text-body-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm"
        )}
      >
        {agentName && (
          <p className="mb-1 text-caption font-semibold opacity-70">{agentName}</p>
        )}
        <p>{content}</p>
        {timestamp && (
          <p className={cn("mt-1 text-caption", isUser ? "text-primary-foreground/60" : "text-muted-foreground")}>{timestamp}</p>
        )}
      </div>
    </div>
  );
};

interface AIProcessingProps {
  label?: string;
}

export const AIProcessingIndicator: React.FC<AIProcessingProps> = ({
  label = "LexIA está analisando...",
}) => (
  <div className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3 animate-fade-up">
    <div className="flex gap-1">
      <span className="h-2 w-2 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "0ms" }} />
      <span className="h-2 w-2 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
      <span className="h-2 w-2 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "400ms" }} />
    </div>
    <span className="text-body-sm text-muted-foreground">{label}</span>
  </div>
);

interface AISuggestionCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export const AISuggestionCard: React.FC<AISuggestionCardProps> = ({
  title,
  description,
  icon,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="flex items-start gap-3 rounded-lg border border-secondary/20 bg-card p-4 text-left transition-all duration-normal hover:border-secondary/40 hover:shadow-md hover:-translate-y-0.5"
  >
    {icon && (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
        {icon}
      </div>
    )}
    <div>
      <p className="text-label text-foreground">{title}</p>
      <p className="mt-0.5 text-caption text-muted-foreground">{description}</p>
    </div>
  </button>
);
