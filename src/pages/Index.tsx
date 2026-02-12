import React from "react";
import { Button } from "@/components/ui/button";
import { LexLogo } from "@/components/lexia/LexLogo";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { ChatMessage, AIProcessingIndicator, AISuggestionCard } from "@/components/lexia/AIChat";
import { LegalTimeline, RiskIndicator } from "@/components/lexia/LegalComponents";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Scale, Brain, FileText, Users, Bot, Sparkles, AlertTriangle,
  CheckCircle, Info, Search, Calendar, Gavel, Shield, Zap,
} from "lucide-react";
import heroImage from "@/assets/hero-bg.jpg";

const ColorSwatch = ({ name, css, className }: { name: string; css: string; className: string }) => (
  <div className="flex flex-col items-center gap-2">
    <div className={`h-16 w-16 rounded-lg shadow-sm border border-border ${className}`} />
    <span className="text-caption text-muted-foreground">{name}</span>
    <span className="text-caption text-muted-foreground/60">{css}</span>
  </div>
);

const Section = ({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) => (
  <section id={id} className="py-16 border-b border-border last:border-b-0">
    <h2 className="text-display-lg mb-8 gradient-text">{title}</h2>
    {children}
  </section>
);

const timelineItems = [
  { date: "10/02/2026", title: "Petição inicial distribuída", description: "Vara 3ª Cível — Comarca de São Paulo", status: "completed" as const },
  { date: "15/02/2026", title: "Citação do réu", status: "completed" as const },
  { date: "01/03/2026", title: "Contestação apresentada", description: "Prazo cumprido", status: "active" as const },
  { date: "15/03/2026", title: "Réplica", description: "Prazo: 15 dias", status: "pending" as const },
  { date: "20/03/2026", title: "Audiência de conciliação", status: "pending" as const },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ backgroundImage: `url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/80 via-neutral-900/60 to-background" />
        <div className="relative container mx-auto px-6 py-24 text-center">
          <div className="flex justify-center mb-8">
            <LexLogo size="lg" />
          </div>
          <h1 className="text-display-xl text-primary-foreground mb-4 max-w-3xl mx-auto">
            Design System
          </h1>
          <p className="text-body-lg text-neutral-300 mb-8 max-w-2xl mx-auto">
            Tokens, componentes e padrões visuais para a plataforma jurídica inteligente LexIA
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button variant="hero" size="xl">Começar agora</Button>
            <Button variant="hero-outline" size="xl" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">Documentação</Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 max-w-6xl">
        {/* 1. Colors */}
        <Section title="1. Paleta de Cores" id="colors">
          <h3 className="text-display-sm mb-4">Primárias</h3>
          <div className="flex flex-wrap gap-4 mb-8">
            <ColorSwatch name="Primary 50" css="--primary-50" className="bg-primary-50" />
            <ColorSwatch name="Primary 200" css="--primary-200" className="bg-primary-200" />
            <ColorSwatch name="Primary 400" css="--primary-400" className="bg-primary-400" />
            <ColorSwatch name="Primary 500" css="--primary-500" className="bg-primary" />
            <ColorSwatch name="Primary 700" css="--primary-700" className="bg-primary-700" />
            <ColorSwatch name="Primary 900" css="--primary-900" className="bg-primary-900" />
          </div>
          <h3 className="text-display-sm mb-4">Secundárias (Roxo Jurídico)</h3>
          <div className="flex flex-wrap gap-4 mb-8">
            <ColorSwatch name="Secondary 50" css="--secondary-50" className="bg-secondary-50" />
            <ColorSwatch name="Secondary 200" css="--secondary-200" className="bg-secondary-200" />
            <ColorSwatch name="Secondary 500" css="--secondary-500" className="bg-secondary" />
            <ColorSwatch name="Secondary 700" css="--secondary-700" className="bg-secondary-700" />
            <ColorSwatch name="Secondary 900" css="--secondary-900" className="bg-secondary-900" />
          </div>
          <h3 className="text-display-sm mb-4">Feedback</h3>
          <div className="flex flex-wrap gap-4 mb-8">
            <ColorSwatch name="Success" css="--success" className="bg-success" />
            <ColorSwatch name="Warning" css="--warning" className="bg-warning" />
            <ColorSwatch name="Destructive" css="--destructive" className="bg-destructive" />
            <ColorSwatch name="Info" css="--info" className="bg-info" />
            <ColorSwatch name="Accent" css="--accent" className="bg-accent" />
          </div>
          <h3 className="text-display-sm mb-4">Neutros</h3>
          <div className="flex flex-wrap gap-4">
            {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map(n => (
              <ColorSwatch key={n} name={`Neutral ${n}`} css={`--neutral-${n}`} className={`bg-neutral-${n}`} />
            ))}
          </div>
        </Section>

        {/* 2. Typography */}
        <Section title="2. Tipografia" id="typography">
          <div className="space-y-6">
            <div><p className="text-caption text-muted-foreground mb-1">Display XL — Space Grotesk 700</p><p className="text-display-xl">Gestão Jurídica Inteligente</p></div>
            <div><p className="text-caption text-muted-foreground mb-1">Display LG — Space Grotesk 700</p><p className="text-display-lg">Automação com IA Avançada</p></div>
            <div><p className="text-caption text-muted-foreground mb-1">Display MD — Space Grotesk 600</p><p className="text-display-md">Processos e Documentos</p></div>
            <div><p className="text-caption text-muted-foreground mb-1">Display SM — Space Grotesk 600</p><p className="text-display-sm">Card Título</p></div>
            <div><p className="text-caption text-muted-foreground mb-1">Body LG — Inter</p><p className="text-body-lg">Parágrafo com texto de leitura confortável para blocos maiores de conteúdo jurídico.</p></div>
            <div><p className="text-caption text-muted-foreground mb-1">Body MD — Inter</p><p className="text-body-md">Texto padrão para interfaces e descrições.</p></div>
            <div><p className="text-caption text-muted-foreground mb-1">Body SM — Inter</p><p className="text-body-sm">Texto menor para detalhes e metadados.</p></div>
            <div><p className="text-caption text-muted-foreground mb-1">Caption</p><p className="text-caption">Legenda • 12px • 0.02em tracking</p></div>
            <div><p className="text-caption text-muted-foreground mb-1">Label</p><p className="text-label">Label de formulário • 13px • 500 weight</p></div>
            <div><p className="text-caption text-muted-foreground mb-1">Gradient Text</p><p className="text-display-md gradient-text">LexIA Intelligence</p></div>
          </div>
        </Section>

        {/* 3. Buttons */}
        <Section title="3. Botões" id="buttons">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="success">Success</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="hero" size="xl">Hero CTA</Button>
              <Button variant="hero-outline" size="xl">Hero Outline</Button>
              <Button variant="ai" size="lg"><Sparkles className="h-4 w-4" /> Perguntar à IA</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="xl">Extra Large</Button>
              <Button size="icon"><Search /></Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled>Disabled</Button>
              <Button variant="hero" disabled>Hero Disabled</Button>
            </div>
          </div>
        </Section>

        {/* 4. Badges */}
        <Section title="4. Badges" id="badges">
          <div className="flex flex-wrap gap-3">
            <LexBadge>Primário</LexBadge>
            <LexBadge variant="secondary">Secundário</LexBadge>
            <LexBadge variant="success"><CheckCircle className="mr-1 h-3 w-3" />Sucesso</LexBadge>
            <LexBadge variant="warning"><AlertTriangle className="mr-1 h-3 w-3" />Aviso</LexBadge>
            <LexBadge variant="destructive">Erro</LexBadge>
            <LexBadge variant="info"><Info className="mr-1 h-3 w-3" />Info</LexBadge>
            <LexBadge variant="ai"><Sparkles className="mr-1 h-3 w-3" />IA</LexBadge>
            <LexBadge variant="outline">Outline</LexBadge>
          </div>
        </Section>

        {/* 5. Inputs */}
        <Section title="5. Inputs" id="inputs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
            <div>
              <label className="text-label text-foreground mb-1.5 block">Nome do cliente</label>
              <Input placeholder="Digite o nome..." />
            </div>
            <div>
              <label className="text-label text-foreground mb-1.5 block">Buscar processo</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Nº do processo ou partes..." />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-label text-foreground mb-1.5 block">Observações</label>
              <Textarea placeholder="Adicione observações ao processo..." rows={3} />
            </div>
          </div>
        </Section>

        {/* 6. Cards */}
        <Section title="6. Cards" id="cards">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <LexCard>
              <LexCardHeader>
                <LexCardTitle>Card de Processo</LexCardTitle>
                <LexBadge variant="success">Ativo</LexBadge>
              </LexCardHeader>
              <p className="text-body-sm text-muted-foreground mb-3">Processo nº 1234567-89.2026.8.26.0100</p>
              <div className="flex items-center justify-between">
                <RiskIndicator level="low" />
                <span className="text-caption text-muted-foreground">Atualizado há 2h</span>
              </div>
            </LexCard>

            <LexCard variant="ai">
              <LexCardHeader>
                <LexCardTitle>Agente de IA</LexCardTitle>
                <LexBadge variant="ai">Ativo</LexBadge>
              </LexCardHeader>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
                  <Brain className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <p className="text-label text-foreground">Análise de Risco</p>
                  <p className="text-caption text-muted-foreground">Analisa probabilidades processuais</p>
                </div>
              </div>
              <div className="flex gap-2">
                <LexBadge variant="outline">NLP</LexBadge>
                <LexBadge variant="outline">Predição</LexBadge>
              </div>
            </LexCard>

            <LexCard variant="process">
              <LexCardHeader>
                <LexCardTitle>Documento</LexCardTitle>
                <LexBadge>Revisado</LexBadge>
              </LexCardHeader>
              <div className="flex items-center gap-3 mb-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-label text-foreground">Petição Inicial</p>
                  <p className="text-caption text-muted-foreground">Gerado por IA • 15 páginas</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full">Visualizar</Button>
            </LexCard>

            <LexCard variant="glass">
              <LexCardHeader>
                <LexCardTitle>Card Glass</LexCardTitle>
              </LexCardHeader>
              <p className="text-body-sm text-muted-foreground">Efeito glass morphism para sobreposições e highlights.</p>
            </LexCard>

            <LexCard>
              <LexCardHeader>
                <LexCardTitle>Audiência</LexCardTitle>
                <LexBadge variant="warning"><Calendar className="mr-1 h-3 w-3" />Em 5 dias</LexBadge>
              </LexCardHeader>
              <p className="text-body-sm text-muted-foreground mb-2">Audiência de instrução e julgamento</p>
              <div className="flex items-center gap-2 text-caption text-muted-foreground">
                <Gavel className="h-3.5 w-3.5" />
                <span>Vara 3ª Cível — São Paulo</span>
              </div>
            </LexCard>

            <LexCard>
              <LexCardHeader>
                <LexCardTitle>Cliente</LexCardTitle>
                <LexBadge variant="info">Pessoa Jurídica</LexBadge>
              </LexCardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-label text-foreground">Tech Solutions Ltda.</p>
                  <p className="text-caption text-muted-foreground">3 processos ativos</p>
                </div>
              </div>
            </LexCard>
          </div>
        </Section>

        {/* 7. Risk Indicators */}
        <Section title="7. Indicadores de Risco" id="risk">
          <div className="flex flex-wrap gap-8">
            <RiskIndicator level="low" />
            <RiskIndicator level="medium" />
            <RiskIndicator level="high" />
            <RiskIndicator level="critical" />
          </div>
        </Section>

        {/* 8. Timeline */}
        <Section title="8. Linha do Tempo Processual" id="timeline">
          <div className="max-w-xl">
            <LegalTimeline items={timelineItems} />
          </div>
        </Section>

        {/* 9. AI Chat */}
        <Section title="9. Componentes de IA" id="ai">
          <div className="max-w-2xl space-y-4 mb-8">
            <ChatMessage role="user" content="Qual o risco do processo 1234567?" timestamp="14:32" />
            <ChatMessage role="ai" content="Analisei o processo 1234567-89.2026.8.26.0100. Com base na jurisprudência recente do TJ-SP e nos documentos anexados, o risco é médio-baixo. A probabilidade de êxito na ação é de aproximadamente 72%." timestamp="14:32" />
            <AIProcessingIndicator />
            <ChatMessage role="agent" agentName="Agente de Risco" content="Completei a análise de risco. 3 precedentes favoráveis encontrados na mesma vara." timestamp="14:33" />
          </div>
          <h3 className="text-display-sm mb-4">Sugestões da IA</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
            <AISuggestionCard icon={<FileText className="h-5 w-5" />} title="Gerar Petição" description="Crie uma petição baseada nos dados do processo" />
            <AISuggestionCard icon={<Shield className="h-5 w-5" />} title="Análise de Risco" description="Avalie a probabilidade de sucesso" />
            <AISuggestionCard icon={<Zap className="h-5 w-5" />} title="Automação de Prazos" description="Configure alertas automáticos" />
          </div>
        </Section>

        {/* 10. Shadows & Motion */}
        <Section title="10. Sombras & Motion" id="shadows">
          <div className="flex flex-wrap gap-6 mb-8">
            {["shadow-xs", "shadow-sm", "shadow-md", "shadow-lg", "shadow-xl"].map(s => (
              <div key={s} className={`h-20 w-32 rounded-lg bg-card border border-border ${s} flex items-center justify-center`}>
                <span className="text-caption text-muted-foreground">{s}</span>
              </div>
            ))}
            <div className="h-20 w-32 rounded-lg bg-card border border-primary/20 shadow-glow-primary flex items-center justify-center">
              <span className="text-caption text-primary">glow-primary</span>
            </div>
            <div className="h-20 w-32 rounded-lg bg-card border border-accent/20 shadow-glow-accent flex items-center justify-center">
              <span className="text-caption text-accent">glow-accent</span>
            </div>
          </div>
          <h3 className="text-display-sm mb-4">Spacing Scale</h3>
          <div className="flex items-end gap-1">
            {[1, 2, 3, 4, 6, 8, 12, 16, 20, 24].map(n => (
              <div key={n} className="flex flex-col items-center gap-1">
                <div className="bg-primary/20 rounded" style={{ width: `${n * 4}px`, height: `${n * 4}px` }} />
                <span className="text-caption text-muted-foreground">{n}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* 11. Branding */}
        <Section title="11. Branding" id="branding">
          <div className="flex flex-wrap items-center gap-12">
            <LexLogo size="lg" />
            <LexLogo size="md" />
            <LexLogo size="sm" />
            <LexLogo size="md" showText={false} />
          </div>
          <div className="mt-8 rounded-xl p-8" style={{ background: "var(--gradient-hero)" }}>
            <LexLogo size="lg" className="mb-4" />
            <p className="text-body-lg text-neutral-300 max-w-lg">
              Inteligência jurídica que transforma a prática do direito com tecnologia de ponta, automação e IA avançada.
            </p>
          </div>
        </Section>

        {/* Footer */}
        <div className="py-12 text-center border-t border-border">
          <LexLogo size="sm" showText className="justify-center mb-4 mx-auto" />
          <p className="text-caption text-muted-foreground">LexIA Design System v1.0 — Plataforma Jurídica Inteligente</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
