export const PROCESS_STATUS_OPTIONS = [
  { value: "active", label: "Ativo" },
  { value: "pending", label: "Pendente" },
  { value: "closed", label: "Encerrado" },
  { value: "suspended", label: "Suspenso" },
] as const;

export const PROCESS_FASE_OPTIONS = [
  "Inicial",
  "Citação",
  "Instrução",
  "Sentença",
  "Recurso",
  "Execução",
  "Arquivado",
] as const;

export const PROCESS_TYPE_OPTIONS = [
  { value: "civil", label: "Cível" },
  { value: "criminal", label: "Criminal" },
  { value: "labor", label: "Trabalhista" },
  { value: "tax", label: "Tributário" },
  { value: "admin", label: "Administrativo" },
] as const;

export const PROCESS_RISK_OPTIONS = [
  { value: "low", label: "Baixo" },
  { value: "medium", label: "Médio" },
  { value: "high", label: "Alto" },
] as const;

export const PROCESS_CLASSE_OPTIONS = [
  "Cível",
  "Trabalhista",
  "Penal",
  "Família",
  "Tributário",
  "Administrativo",
  "Consumidor",
  "Ambiental",
];

export const PROCESS_FORO_OPTIONS = [
  "Foro Central",
  "Foro Regional I",
  "Foro Regional II",
  "Foro Regional III",
  "Foro Regional IV",
  "Foro Distrital",
];

export const PROCESS_VARAS_BY_FORO: Record<string, string[]> = {
  "Foro Central": ["1ª Vara Cível", "2ª Vara Cível", "3ª Vara Cível", "1ª Vara Criminal", "2ª Vara Criminal", "Vara de Família", "Vara do Trabalho"],
  "Foro Regional I": ["1ª Vara Cível", "2ª Vara Cível", "Vara Criminal"],
  "Foro Regional II": ["1ª Vara Cível", "Vara Criminal", "Vara de Família"],
  "Foro Regional III": ["1ª Vara Cível", "Vara Criminal"],
  "Foro Regional IV": ["Vara Cível", "Vara Criminal"],
  "Foro Distrital": ["Vara Única"],
};

export const PROCESS_ASSUNTO_OPTIONS = [
  "Cobrança",
  "Indenização",
  "Contrato",
  "Trabalhista",
  "Divórcio",
  "Inventário",
  "Execução Fiscal",
  "Usucapião",
  "Despejo",
  "Alimentos",
  "Guarda",
  "Outro",
];

export const KANBAN_FASE_NONE = "__none__";
export const KANBAN_STATUS_NONE = "__none__";

export type KanbanColumnMode = "fase" | "status";

export const statusMap: Record<string, string> = Object.fromEntries(
  PROCESS_STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

export const typeMap: Record<string, string> = Object.fromEntries(
  PROCESS_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export function getProcessStatusLabel(status: string): string {
  return statusMap[status] || status;
}

export function getProcessFaseLabel(fase: string | null | undefined): string {
  if (!fase) return "Sem fase";
  return fase;
}

export function getKanbanColumns(mode: KanbanColumnMode): { id: string; label: string }[] {
  if (mode === "fase") {
    return [
      { id: KANBAN_FASE_NONE, label: "Sem fase" },
      ...PROCESS_FASE_OPTIONS.map((f) => ({ id: f, label: f })),
    ];
  }
  return [
    { id: KANBAN_STATUS_NONE, label: "Sem status" },
    ...PROCESS_STATUS_OPTIONS.map((o) => ({ id: o.value, label: o.label })),
  ];
}

export function getProcessColumnId(
  process: { fase?: string | null; status?: string | null },
  mode: KanbanColumnMode,
): string {
  if (mode === "fase") {
    return process.fase?.trim() || KANBAN_FASE_NONE;
  }
  return process.status?.trim() || KANBAN_STATUS_NONE;
}

export function columnIdToProcessPatch(
  columnId: string,
  mode: KanbanColumnMode,
): { fase?: string | null; status?: string; archived?: boolean } {
  if (mode === "fase") {
    const fase = columnId === KANBAN_FASE_NONE ? null : columnId;
    return {
      fase,
      archived: columnId === "Arquivado",
    };
  }
  const status = columnId === KANBAN_STATUS_NONE ? "active" : columnId;
  return {
    status,
    archived: columnId === "closed",
  };
}
