import { Scale, Brain, Zap } from "lucide-react";
import React from "react";

interface LexLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { icon: 20, text: "text-lg" },
  md: { icon: 28, text: "text-2xl" },
  lg: { icon: 36, text: "text-3xl" },
};

export const LexLogo: React.FC<LexLogoProps> = ({ size = "md", showText = true, className }) => {
  const s = sizes[size];
  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      <div className="relative">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-glow-primary">
          <Scale className="text-primary-foreground" size={s.icon} strokeWidth={2.5} />
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent">
          <Zap className="text-accent-foreground" size={10} />
        </div>
      </div>
      {showText && (
        <div className="flex items-baseline gap-0.5">
          <span className={`font-display font-bold text-foreground ${s.text}`}>Lex</span>
          <span className={`font-display font-bold gradient-text ${s.text}`}>IA</span>
        </div>
      )}
    </div>
  );
};
