import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface TaskProgressChartProps {
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
}

const TaskProgressChart = ({ todoCount, inProgressCount, doneCount }: TaskProgressChartProps) => {
  const total = todoCount + inProgressCount + doneCount;
  if (total === 0) return null;

  const data = [
    { name: "A fazer", value: todoCount, color: "hsl(var(--muted-foreground))" },
    { name: "Em progresso", value: inProgressCount, color: "hsl(var(--warning))" },
    { name: "Concluído", value: doneCount, color: "hsl(var(--accent))" },
  ].filter(d => d.value > 0);

  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-14 w-14 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={18}
              outerRadius={26}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
          {pct}%
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-[10px] text-muted-foreground">{d.name}: {d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskProgressChart;
