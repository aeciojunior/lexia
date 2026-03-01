import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DiffLine {
  type: "equal" | "added" | "removed";
  text: string;
}

function computeLineDiff(original: string, revised: string): DiffLine[] {
  const origLines = original.split("\n");
  const revLines = revised.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const m = origLines.length;
  const n = revLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origLines[i - 1] === revLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const actions: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === revLines[j - 1]) {
      actions.push({ type: "equal", text: origLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      actions.push({ type: "added", text: revLines[j - 1] });
      j--;
    } else {
      actions.push({ type: "removed", text: origLines[i - 1] });
      i--;
    }
  }

  return actions.reverse();
}

interface DiffViewProps {
  original: string;
  revised: string;
}

export default function DiffView({ original, revised }: DiffViewProps) {
  const lines = useMemo(() => computeLineDiff(original, revised), [original, revised]);

  const stats = useMemo(() => {
    const added = lines.filter(l => l.type === "added").length;
    const removed = lines.filter(l => l.type === "removed").length;
    return { added, removed };
  }, [lines]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Comparação</span>
        <span className="text-green-600">+{stats.added} adicionadas</span>
        <span className="text-destructive">−{stats.removed} removidas</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="font-mono text-xs leading-relaxed">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className={`px-4 py-0.5 border-l-2 ${
                line.type === "added"
                  ? "bg-green-500/10 border-l-green-500 text-green-700 dark:text-green-400"
                  : line.type === "removed"
                  ? "bg-destructive/10 border-l-destructive text-destructive line-through"
                  : "border-l-transparent text-muted-foreground"
              }`}
            >
              <span className="select-none mr-2 opacity-40">
                {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
              </span>
              {line.text || "\u00A0"}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
