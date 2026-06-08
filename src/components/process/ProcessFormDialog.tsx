import { useMemo } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  FileText,
  Gavel,
  HelpCircle,
  Scale,
  Shield,
  UserCheck,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RiskIndicator } from "@/components/lexia/LegalComponents";
import {
  PROCESS_CLASSE_OPTIONS as classeOptions,
  PROCESS_FASE_OPTIONS as faseOptions,
  PROCESS_FORO_OPTIONS as foroOptions,
  PROCESS_VARAS_BY_FORO as varasByForo,
  PROCESS_ASSUNTO_OPTIONS as assuntoOptions,
  PROCESS_STATUS_OPTIONS,
  PROCESS_TYPE_OPTIONS,
} from "@/lib/processConstants";
import { cn } from "@/lib/utils";

export interface ProcessForm {
  number: string;
  title: string;
  client_name: string;
  type: string;
  status: string;
  risk_level: string;
  court: string;
  judge: string;
  notes: string;
  description: string;
  tags: string;
  responsible_id: string;
  foro: string;
  vara: string;
  classe: string;
  assunto: string[];
  fase: string;
  valor_causa: string;
  partes_autores: string;
  partes_reus: string;
  client_id?: string;
}

export const emptyProcessForm: ProcessForm = {
  number: "",
  title: "",
  client_name: "",
  type: "civil",
  status: "active",
  risk_level: "low",
  court: "",
  judge: "",
  notes: "",
  description: "",
  tags: "",
  responsible_id: "none",
  foro: "",
  vara: "",
  classe: "",
  assunto: [],
  fase: "",
  valor_causa: "",
  partes_autores: "",
  partes_reus: "",
  client_id: "",
};

export function maskCnjNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 20);
  let masked = "";
  for (let i = 0; i < digits.length; i++) {
    if (i === 7) masked += "-";
    if (i === 9) masked += ".";
    if (i === 13) masked += ".";
    if (i === 14) masked += ".";
    if (i === 16) masked += ".";
    masked += digits[i];
  }
  return masked;
}

function cnjDigits(value: string) {
  return value.replace(/\D/g, "");
}

const REQUIRED_CHECKS: { key: keyof ProcessForm | "cnj"; label: string; test: (f: ProcessForm) => boolean }[] = [
  { key: "cnj", label: "Número CNJ", test: (f) => cnjDigits(f.number).length === 20 },
  { key: "client_name", label: "Cliente", test: (f) => !!f.client_name.trim() },
  { key: "title", label: "Título", test: (f) => !!f.title.trim() },
  { key: "partes_autores", label: "Autor(es)", test: (f) => !!f.partes_autores.trim() },
  { key: "foro", label: "Foro", test: (f) => !!f.foro },
  { key: "vara", label: "Vara", test: (f) => !!f.vara },
  { key: "classe", label: "Classe", test: (f) => !!f.classe },
  { key: "fase", label: "Fase", test: (f) => !!f.fase },
  { key: "responsible_id", label: "Responsável", test: (f) => f.responsible_id !== "none" },
];

function fieldError(touched: boolean, invalid: boolean) {
  return touched && invalid;
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  valid?: boolean;
  className?: string;
  children: React.ReactNode;
}

function FormField({ label, required, hint, error, valid, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5 min-h-[18px]">
        <Label className="text-xs font-medium text-foreground/90">{label}</Label>
        {required && <span className="text-destructive text-xs" aria-hidden>*</span>}
        {label === "Número CNJ" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Ajuda sobre formato CNJ">
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              O número CNJ identifica unicamente o processo na Justiça brasileira. Digite apenas os dígitos — a máscara é aplicada automaticamente.
            </TooltipContent>
          </Tooltip>
        )}
        {valid && (
          <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" aria-label="Campo válido" />
        )}
      </div>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>}
      {error && <p className="text-[11px] text-destructive font-medium">{error}</p>}
    </div>
  );
}

interface FormSectionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}

function FormSection({ icon, title, description, children }: FormSectionProps) {
  return (
    <section className="rounded-2xl border border-border/70 bg-muted/10 overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5 border-b border-border/50 bg-muted/20">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

const inputClass = (invalid: boolean, valid?: boolean) =>
  cn(
    "h-10 bg-background/80 border-border rounded-xl transition-colors",
    invalid && "border-destructive ring-1 ring-destructive/25 focus-visible:ring-destructive/30",
    valid && "border-success/50 ring-1 ring-success/20",
  );

const selectTriggerClass = (invalid: boolean) =>
  cn(
    "h-10 w-full bg-background/80 border-border rounded-xl",
    invalid && "border-destructive ring-1 ring-destructive/25",
  );

interface OrgMember {
  user_id: string;
  role: string;
  profiles?: { full_name?: string } | null;
}

interface OrgClient {
  id: string;
  full_name: string;
  document_number: string | null;
}

interface ProcessFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  form: ProcessForm;
  setForm: React.Dispatch<React.SetStateAction<ProcessForm>>;
  formTouched: boolean;
  setFormTouched: (touched: boolean) => void;
  orgMembers: OrgMember[];
  orgClients: OrgClient[];
  isPending: boolean;
  onSubmit: (form: ProcessForm) => void;
}

export function ProcessFormDialog({
  open,
  onOpenChange,
  editingId,
  form,
  setForm,
  formTouched,
  setFormTouched,
  orgMembers,
  orgClients,
  isPending,
  onSubmit,
}: ProcessFormDialogProps) {
  const cnjCount = cnjDigits(form.number).length;
  const cnjValid = cnjCount === 20;

  const completion = useMemo(() => {
    const done = REQUIRED_CHECKS.filter((c) => c.test(form)).length;
    return Math.round((done / REQUIRED_CHECKS.length) * 100);
  }, [form]);

  const missingFields = useMemo(
    () => REQUIRED_CHECKS.filter((c) => !c.test(form)).map((c) => c.label),
    [form],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormTouched(true);

    if (missingFields.length > 0) {
      return;
    }

    if (form.valor_causa && Number.isNaN(parseFloat(form.valor_causa.replace(/[^\d,.-]/g, "").replace(",", ".")))) {
      return;
    }

    onSubmit(form);
  };

  const valorInvalid =
    formTouched &&
    !!form.valor_causa &&
    Number.isNaN(parseFloat(form.valor_causa.replace(/[^\d,.-]/g, "").replace(",", ".")));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0 overflow-hidden",
          "w-[min(1120px,calc(100vw-1.25rem))] max-w-none max-h-[min(940px,calc(100vh-1.25rem))]",
          "top-3 translate-y-0 sm:top-[50%] sm:translate-y-[-50%]",
          "border-border/80 bg-card shadow-2xl sm:rounded-2xl",
        )}
      >
        {/* Header */}
        <DialogHeader className="shrink-0 space-y-0 border-b border-border/60 bg-gradient-to-br from-primary/[0.07] via-card to-card px-5 py-5 sm:px-7 sm:py-6 text-left">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:pr-8">
            <div className="space-y-1.5 min-w-0">
              <DialogTitle className="text-xl sm:text-2xl font-semibold tracking-tight">
                {editingId ? "Editar Processo" : "Novo Processo"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground max-w-xl">
                {editingId
                  ? "Atualize as informações do processo. Campos marcados com * são obrigatórios."
                  : "Cadastre um novo processo judicial com dados completos para acompanhamento seguro e assertivo."}
              </DialogDescription>
            </div>
            <div className="shrink-0 rounded-xl border border-border/60 bg-background/60 px-3 py-2 min-w-[140px]">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Preenchimento</p>
              <div className="flex items-end justify-between gap-2 mt-1">
                <span className="text-lg font-semibold tabular-nums">{completion}%</span>
                <span className="text-[11px] text-muted-foreground pb-0.5">
                  {REQUIRED_CHECKS.length - missingFields.length}/{REQUIRED_CHECKS.length}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6 space-y-5">
            {formTouched && missingFields.length > 0 && (
              <div
                role="alert"
                className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
              >
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Revise os campos obrigatórios</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pendente: {missingFields.join(", ")}
                  </p>
                </div>
              </div>
            )}

            {valorInvalid && (
              <div role="alert" className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                <p className="text-destructive font-medium">Valor da causa inválido. Use apenas números.</p>
              </div>
            )}

            {/* Identificação */}
            <FormSection
              icon={<FileText className="h-4 w-4" />}
              title="Identificação"
              description="Dados principais para localizar e nomear o processo."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4">
                <FormField
                  className="md:col-span-2 xl:col-span-5"
                  label="Número CNJ"
                  required
                  valid={formTouched && cnjValid}
                  hint="Formato: 7 dígitos - 2 . 4 . 1 . 2 . 4 (20 dígitos)"
                  error={
                    fieldError(formTouched, !form.number.trim())
                      ? "Informe o número do processo"
                      : fieldError(formTouched, !!form.number.trim() && !cnjValid)
                        ? `CNJ incompleto (${cnjCount}/20 dígitos)`
                        : undefined
                  }
                >
                  <div className="relative">
                    <Input
                      className={cn(inputClass(
                        fieldError(formTouched, !form.number.trim() || !cnjValid),
                        formTouched && cnjValid,
                      ), "font-mono text-sm pr-16")}
                      value={form.number}
                      onChange={(e) => setForm({ ...form, number: maskCnjNumber(e.target.value) })}
                      placeholder="0000000-00.0000.0.00.0000"
                      maxLength={25}
                      inputMode="numeric"
                      autoComplete="off"
                      aria-invalid={fieldError(formTouched, !cnjValid)}
                    />
                    <span
                      className={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono tabular-nums",
                        cnjValid ? "text-success" : "text-muted-foreground",
                      )}
                    >
                      {cnjCount}/20
                    </span>
                  </div>
                </FormField>

                <FormField
                  className="xl:col-span-4"
                  label="Cliente"
                  required
                  error={fieldError(formTouched, !form.client_name.trim()) ? "Informe o nome do cliente" : undefined}
                >
                  <Input
                    className={inputClass(fieldError(formTouched, !form.client_name.trim()))}
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value.slice(0, 200) })}
                    placeholder="Nome do cliente principal"
                    maxLength={200}
                    aria-invalid={fieldError(formTouched, !form.client_name.trim())}
                  />
                </FormField>

                <FormField
                  className="md:col-span-2 xl:col-span-3"
                  label="Título"
                  required
                  error={fieldError(formTouched, !form.title.trim()) ? "Informe um título descritivo" : undefined}
                >
                  <Input
                    className={inputClass(fieldError(formTouched, !form.title.trim()))}
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, 300) })}
                    placeholder="Ex: Ação de Cobrança"
                    maxLength={300}
                    aria-invalid={fieldError(formTouched, !form.title.trim())}
                  />
                </FormField>
              </div>
            </FormSection>

            {/* Partes */}
            <FormSection
              icon={<Users className="h-4 w-4" />}
              title="Partes"
              description="Autores e réus envolvidos no litígio."
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField
                  label="Autor(es)"
                  required
                  hint="Separe múltiplos nomes por vírgula"
                  error={fieldError(formTouched, !form.partes_autores.trim()) ? "Informe ao menos um autor" : undefined}
                >
                  <Input
                    className={inputClass(fieldError(formTouched, !form.partes_autores.trim()))}
                    value={form.partes_autores}
                    onChange={(e) => setForm({ ...form, partes_autores: e.target.value.slice(0, 500) })}
                    placeholder="Nome do autor 1, Nome do autor 2..."
                    maxLength={500}
                  />
                </FormField>
                <FormField label="Réu(s)" hint="Separe múltiplos nomes por vírgula">
                  <Input
                    className={inputClass(false)}
                    value={form.partes_reus}
                    onChange={(e) => setForm({ ...form, partes_reus: e.target.value.slice(0, 500) })}
                    placeholder="Nome do réu 1, Nome do réu 2..."
                    maxLength={500}
                  />
                </FormField>
              </div>
            </FormSection>

            {/* Competência */}
            <FormSection
              icon={<Building2 className="h-4 w-4" />}
              title="Competência e localização"
              description="Foro, vara e fase processual atual."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <FormField
                  label="Foro"
                  required
                  error={fieldError(formTouched, !form.foro) ? "Selecione o foro" : undefined}
                >
                  <Select value={form.foro} onValueChange={(v) => setForm({ ...form, foro: v, vara: "" })}>
                    <SelectTrigger className={selectTriggerClass(fieldError(formTouched, !form.foro))}>
                      <SelectValue placeholder="Selecionar foro" />
                    </SelectTrigger>
                    <SelectContent>{foroOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField
                  label="Vara"
                  required
                  error={fieldError(formTouched, !form.vara) ? "Selecione a vara" : undefined}
                >
                  <Select value={form.vara} onValueChange={(v) => setForm({ ...form, vara: v })} disabled={!form.foro}>
                    <SelectTrigger className={selectTriggerClass(fieldError(formTouched, !form.vara))}>
                      <SelectValue placeholder={form.foro ? "Selecionar vara" : "Selecione o foro primeiro"} />
                    </SelectTrigger>
                    <SelectContent>{(varasByForo[form.foro] || []).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField
                  label="Classe"
                  required
                  error={fieldError(formTouched, !form.classe) ? "Selecione a classe" : undefined}
                >
                  <Select value={form.classe} onValueChange={(v) => setForm({ ...form, classe: v })}>
                    <SelectTrigger className={selectTriggerClass(fieldError(formTouched, !form.classe))}>
                      <SelectValue placeholder="Selecionar classe" />
                    </SelectTrigger>
                    <SelectContent>{classeOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField
                  label="Fase processual"
                  required
                  error={fieldError(formTouched, !form.fase) ? "Selecione a fase" : undefined}
                >
                  <Select value={form.fase} onValueChange={(v) => setForm({ ...form, fase: v })}>
                    <SelectTrigger className={selectTriggerClass(fieldError(formTouched, !form.fase))}>
                      <SelectValue placeholder="Selecionar fase" />
                    </SelectTrigger>
                    <SelectContent>{faseOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField className="sm:col-span-2 xl:col-span-4" label="Juiz(a)">
                  <Input
                    className={inputClass(false)}
                    value={form.judge}
                    onChange={(e) => setForm({ ...form, judge: e.target.value.slice(0, 150) })}
                    placeholder="Nome do magistrado responsável"
                    maxLength={150}
                  />
                </FormField>
              </div>
            </FormSection>

            {/* Classificação */}
            <FormSection
              icon={<Scale className="h-4 w-4" />}
              title="Classificação e valores"
              description="Tipo, status, assunto, valor da causa e tags."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <FormField label="Tipo">
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger className={selectTriggerClass(false)}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROCESS_TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Status">
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className={selectTriggerClass(false)}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROCESS_STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Assunto">
                  <Select value={form.assunto[0] || ""} onValueChange={(v) => setForm({ ...form, assunto: v ? [v] : [] })}>
                    <SelectTrigger className={selectTriggerClass(false)}><SelectValue placeholder="Selecionar assunto" /></SelectTrigger>
                    <SelectContent>{assuntoOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField
                  label="Valor da causa (R$)"
                  error={valorInvalid ? "Valor inválido" : undefined}
                >
                  <Input
                    className={inputClass(valorInvalid)}
                    value={form.valor_causa}
                    onChange={(e) => setForm({ ...form, valor_causa: e.target.value.replace(/[^\d.,]/g, "").slice(0, 18) })}
                    placeholder="0,00"
                    inputMode="decimal"
                  />
                </FormField>
                <FormField label="Nível de risco">
                  <Select value={form.risk_level} onValueChange={(v) => setForm({ ...form, risk_level: v })}>
                    <SelectTrigger className={selectTriggerClass(false)}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["low", "medium", "high", "critical"] as const).map((level) => (
                        <SelectItem key={level} value={level}>
                          <RiskIndicator level={level} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Tags" hint="Separe por vírgula — ex: cível, urgente">
                  <Input
                    className={inputClass(false)}
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value.slice(0, 200) })}
                    placeholder="cível, urgente..."
                    maxLength={200}
                  />
                </FormField>
              </div>
            </FormSection>

            {/* Gestão */}
            <FormSection
              icon={<Shield className="h-4 w-4" />}
              title="Gestão e vínculos"
              description="Responsável interno e cliente cadastrado no sistema."
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField
                  label="Advogado responsável"
                  required
                  error={fieldError(formTouched, form.responsible_id === "none") ? "Selecione o responsável" : undefined}
                >
                  <Select value={form.responsible_id} onValueChange={(v) => setForm({ ...form, responsible_id: v })}>
                    <SelectTrigger className={selectTriggerClass(fieldError(formTouched, form.responsible_id === "none"))}>
                      <SelectValue placeholder="Selecionar responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled>Nenhum</SelectItem>
                      {orgMembers.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>{m.profiles?.full_name || "Membro"}</span>
                            <span className="text-muted-foreground text-xs">({m.role})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Vincular cliente cadastrado" hint="Opcional — associa ao cadastro de clientes">
                  <Select
                    value={form.client_id || "none"}
                    onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger className={selectTriggerClass(false)}>
                      <SelectValue placeholder="Selecionar cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {orgClients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name}{c.document_number ? ` (${c.document_number})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </FormSection>

            {/* Detalhes */}
            <FormSection
              icon={<Gavel className="h-4 w-4" />}
              title="Detalhes complementares"
              description="Contexto adicional, observações internas e histórico resumido."
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField label="Descrição">
                  <Textarea
                    className="min-h-[100px] bg-background/80 border-border rounded-xl resize-y"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 2000) })}
                    placeholder="Resumo do objeto da ação, pedidos principais..."
                    maxLength={2000}
                  />
                </FormField>
                <FormField label="Observações internas">
                  <Textarea
                    className="min-h-[100px] bg-background/80 border-border rounded-xl resize-y"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value.slice(0, 2000) })}
                    placeholder="Notas confidenciais para a equipe..."
                    maxLength={2000}
                  />
                </FormField>
              </div>
            </FormSection>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border/60 bg-muted/25 px-5 py-4 sm:px-7 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[11px] text-muted-foreground text-center sm:text-left">
              <span className="text-destructive">*</span> Campos obrigatórios · Dados validados antes do envio
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="hero"
                className="rounded-xl min-w-[120px]"
                disabled={isPending}
              >
                {isPending ? "Salvando..." : editingId ? "Salvar alterações" : "Criar processo"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
