import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface DraftFormState {
  parties: string;
  object: string;
  sector: string;
  contractType: string;
  value: string;
  currency: string;
  duration: string;
  jurisdiction: string;
  riskLevel: string;
  formality: string;
  complexity: string;
  lgpdRequired: boolean;
  arbitration: boolean;
  includeAnnexes: boolean;
}

interface Props {
  form: DraftFormState;
  onChange: (updater: (prev: DraftFormState) => DraftFormState) => void;
}

const SECTORS = [
  "tecnologia", "energia", "telecomunicações", "saúde", "financeiro",
  "varejo", "logística", "indústria", "agronegócio", "transporte", "setor público",
];

const CONTRACT_TYPES = [
  { k: "service", l: "Prestação de Serviços" },
  { k: "supply", l: "Fornecimento" },
  { k: "nda", l: "Confidencialidade (NDA)" },
  { k: "partnership", l: "Parceria Comercial" },
  { k: "regulated", l: "Contrato Regulado" },
  { k: "financial", l: "Financeiro" },
  { k: "tech", l: "Tecnologia (SaaS/DPA)" },
  { k: "labor", l: "Trabalhista" },
  { k: "international", l: "Internacional" },
];

export const ContractDraftForm = ({ form, onChange }: Props) => {
  const set = (key: keyof DraftFormState, value: any) =>
    onChange(f => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4">
      {/* Row 1: Parties & Object */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Partes</Label>
          <Textarea
            placeholder="Descreva as partes do contrato (nome, CNPJ/CPF, endereço, representante)..."
            value={form.parties}
            onChange={e => set("parties", e.target.value)}
            rows={3}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Objeto</Label>
          <Textarea
            placeholder="Descreva o objeto do contrato, escopo e entregáveis..."
            value={form.object}
            onChange={e => set("object", e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* Row 2: Sector, Type, Value, Currency */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Setor</Label>
          <Select value={form.sector} onValueChange={v => set("sector", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SECTORS.map(s => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
          <Select value={form.contractType} onValueChange={v => set("contractType", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTRACT_TYPES.map(t => <SelectItem key={t.k} value={t.k}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Valor</Label>
          <Input
            placeholder="Ex: 150.000,00"
            value={form.value}
            onChange={e => set("value", e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Moeda</Label>
          <Select value={form.currency} onValueChange={v => set("currency", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="BRL">BRL (R$)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 3: Duration, Jurisdiction, Risk, Formality, Complexity */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Duração (meses)</Label>
          <Input
            placeholder="Ex: 12"
            type="number"
            value={form.duration}
            onChange={e => set("duration", e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Foro / Jurisdição</Label>
          <Input
            placeholder="Ex: São Paulo/SP"
            value={form.jurisdiction}
            onChange={e => set("jurisdiction", e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Nível de Risco</Label>
          <Select value={form.riskLevel} onValueChange={v => set("riskLevel", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="conservative">Conservador</SelectItem>
              <SelectItem value="moderate">Moderado</SelectItem>
              <SelectItem value="aggressive">Agressivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Formalidade</Label>
          <Select value={form.formality} onValueChange={v => set("formality", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="formal">Formal</SelectItem>
              <SelectItem value="simplified">Simplificado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Complexidade</Label>
          <Select value={form.complexity} onValueChange={v => set("complexity", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="executive">Executivo</SelectItem>
              <SelectItem value="technical">Técnico</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 4: Toggles */}
      <div className="flex flex-wrap gap-6 pt-1">
        <div className="flex items-center gap-2">
          <Switch
            id="lgpd"
            checked={form.lgpdRequired}
            onCheckedChange={v => set("lgpdRequired", v)}
          />
          <Label htmlFor="lgpd" className="text-xs cursor-pointer">Cláusulas LGPD</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="arbitration"
            checked={form.arbitration}
            onCheckedChange={v => set("arbitration", v)}
          />
          <Label htmlFor="arbitration" className="text-xs cursor-pointer">Cláusula de Arbitragem</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="annexes"
            checked={form.includeAnnexes}
            onCheckedChange={v => set("includeAnnexes", v)}
          />
          <Label htmlFor="annexes" className="text-xs cursor-pointer">Gerar Anexos</Label>
        </div>
      </div>
    </div>
  );
};
