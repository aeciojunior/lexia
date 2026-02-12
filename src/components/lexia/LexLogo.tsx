import { Scale, Zap } from "lucide-react";
import React from "react";

interface LexLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { box: "h-9 w-9", icon: 18, text: "text-lg", spark: "h-3.5 w-3.5" },
  md: { box: "h-11 w-11", icon: 24, text: "text-2xl", spark: "h-4 w-4" },
  lg: { box: "h-14 w-14", icon: 30, text: "text-4xl", spark: "h-5 w-5" },
};

export const LexLogo: React.FC<LexLogoProps> = ({ size = "md", showText = true, className }) => {
  const s = sizes[size];
  return (
    <div className={`flex items-center gap-3 ${className || ""}`}>
      <div className="relative">
        <div className={`flex ${s.box} items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-glow-primary`}>
          <Scale className="text-primary-foreground" size={s.icon} strokeWidth={2.5} />
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent shadow-glow-accent">
          <Zap className="text-accent-foreground" size={9} strokeWidth={3} />
        </div>
      </div>
      {showText && (
        <div className="flex items-baseline gap-0.5">
          <span className={`font-display font-bold text-foreground ${s.text}`}>Lex</span>
          <span className={`font-display font-extrabold gradient-text ${s.text}`}>IA</span>
        </div>
      )}
    </div>
  );
};
