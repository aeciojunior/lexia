import React from "react";
import { Button } from "@/components/ui/button";
import { LexLogo } from "@/components/lexia/LexLogo";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { ChatMessage, AIProcessingIndicator, AISuggestionCard } from "@/components/lexia/AIChat";
import { LegalTimeline, RiskIndicator } from "@/components/lexia/LegalComponents";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Scale, Brain, FileText, Users, Bot, Sparkles, AlertTriangle, CheckCircle, Info, Search, Calendar, Gavel, Shield, Zap } from "lucide-react";
import heroImage from "@/assets/hero-bg.jpg";
import { motion } from "framer-motion";

const ColorSwatch = ({ name, className }: { name: string; className: string }) => (
  <div className="flex flex-col items-center gap-2">
    <div className={`h-14 w-14 rounded-xl shadow-md border border-border/50 ${className}`} />
    <span className="text-caption text-muted-foreground text-center">{name}</span>
  </div>
);

const Section = ({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) => (
  <section id={id} className="py-16 border-b border-border/50 last:border-b-0">
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
      <h2 className="text-display-lg mb-8 gradient-text">{title}</h2>
      {children}
    </motion.div>
  </section>
);

const timelineItems = [
  { date: "10/02/2026", title: "Petição inicial distribuída", description: "Vara 3ª Cível — Comarca de São Paulo", status: "completed" as const },
  { date: "15/02/2026", title: "Citação do réu", status: "completed" as const },
  { date: "01/03/2026", title: "Contestação apresentada", description: "Prazo cumprido", status: "active" as const },
  { date: "15/03/2026", title: "Réplica", description: "Prazo: 15 dias", status: "pending" as const },
  { date: "20/03/2026", title: "Audiência de conciliação", status: "pending" as const },
];

const Index = () => (
  <div className="min-h-screen bg-background">
    {/* Hero */}
    <div className="relative overflow-hidden" style={{ backgroundImage: `url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
      <div className="absolute inset-0 dot-grid opacity-15" />
      <div className="relative container mx-auto px-6 py-28 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="flex justify-center mb-8"><LexLogo size="lg" /></div>
          <h1 className="text-display-2xl mb-4 max-w-3xl mx-auto">Design System</h1>
          <p className="text-body-lg text-muted-foreground mb-10 max-w-2xl mx-auto">Tokens, componentes e padrões visuais para a plataforma jurídica inteligente</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button variant="hero" size="xl">Começar agora</Button>
            <Button variant="hero-outline" size="xl">Documentação</Button>
          </div>
        </motion.div>
      </div>
    </div>

    <div className="container mx-auto px-6 max-w-6xl">
      <Section title="1. Paleta de Cores" id="colors">
        <h3 className="text-display-sm mb-4 text-primary">Primárias — Electric Cyan</h3>
        <div className="flex flex-wrap gap-3 mb-8">
          {[50, 200, 400, 500, 700, 900].map(n => <ColorSwatch key={n} name={`P-${n}`} className={`bg-primary-${n}`} />)}
        </div>
        <h3 className="text-display-sm mb-4 text-secondary">Secundárias — Vivid Violet</h3>
        <div className="flex flex-wrap gap-3 mb-8">
          {[50, 200, 400, 500, 700, 900].map(n => <ColorSwatch key={n} name={`S-${n}`} className={`bg-secondary-${n}`} />)}
        </div>
        <h3 className="text-display-sm mb-4">Feedback</h3>
        <div className="flex flex-wrap gap-3 mb-8">
          <ColorSwatch name="Success" className="bg-success" />
          <ColorSwatch name="Warning" className="bg-warning" />
          <ColorSwatch name="Error" className="bg-destructive" />
          <ColorSwatch name="Info" className="bg-info" />
          <ColorSwatch name="Accent" className="bg-accent" />
        </div>
        <h3 className="text-display-sm mb-4">Neutros</h3>
        <div className="flex flex-wrap gap-3">
          {[50, 200, 400, 600, 800, 900].map(n => <ColorSwatch key={n} name={`N-${n}`} className={`bg-neutral-${n}`} />)}
        </div>
      </Section>

      <Section title="2. Tipografia" id="typography">
        <div className="space-y-6">
          <div><p className="text-overline text-primary mb-2">Display 2XL — Outfit 800</p><p className="text-display-2xl">LexIA Intelligence</p></div>
          <div><p className="text-overline text-primary mb-2">Display XL — Outfit 800</p><p className="text-display-xl">Gestão Jurídica</p></div>
          <div><p className="text-overline text-primary mb-2">Display LG — Outfit 700</p><p className="text-display-lg">Automação com IA</p></div>
          <div><p className="text-overline text-primary mb-2">Display MD — Outfit 700</p><p className="text-display-md">Processos e Docs</p></div>
          <div><p className="text-overline text-primary mb-2">Display SM — Outfit 600</p><p className="text-display-sm">Card Título</p></div>
          <div><p className="text-overline text-primary mb-2">Overline</p><p className="text-overline">OVERLINE TEXT — 11PX — 700 — 0.12EM</p></div>
          <div><p className="text-overline text-primary mb-2">Gradient Text</p><p className="text-display-lg gradient-text">Gradient Primary</p><p className="text-display-lg gradient-text-accent">Gradient Accent</p></div>
        </div>
      </Section>

      <Section title="3. Botões" id="buttons">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="success">Success</Button>
            <Button variant="glass">Glass</Button>
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
        </div>
      </Section>

      <Section title="4. Badges" id="badges">
        <div className="flex flex-wrap gap-3">
          <LexBadge>Primary</LexBadge>
          <LexBadge variant="secondary">Secondary</LexBadge>
          <LexBadge variant="success"><CheckCircle className="mr-1 h-3 w-3" />Success</LexBadge>
          <LexBadge variant="warning"><AlertTriangle className="mr-1 h-3 w-3" />Warning</LexBadge>
          <LexBadge variant="destructive">Error</LexBadge>
          <LexBadge variant="info"><Info className="mr-1 h-3 w-3" />Info</LexBadge>
          <LexBadge variant="ai"><Sparkles className="mr-1 h-3 w-3" />IA</LexBadge>
          <LexBadge variant="outline">Outline</LexBadge>
        </div>
      </Section>

      <Section title="5. Cards" id="cards">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <LexCard variant="glow">
            <LexCardHeader>
              <LexCardTitle>Processo</LexCardTitle>
              <LexBadge variant="success">Ativo</LexBadge>
            </LexCardHeader>
            <p className="text-body-sm text-muted-foreground mb-3 font-mono text-primary">1234567-89.2026.8.26.0100</p>
            <RiskIndicator level="low" />
          </LexCard>
          <LexCard variant="ai">
            <LexCardHeader>
              <LexCardTitle className="gradient-text">Agente IA</LexCardTitle>
              <LexBadge variant="ai">Ativo</LexBadge>
            </LexCardHeader>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-secondary/20 to-primary/20 border border-secondary/20"><Brain className="h-5 w-5 text-secondary" /></div>
              <div><p className="text-body-sm font-semibold">Análise de Risco</p><p className="text-caption text-muted-foreground">Probabilidades processuais</p></div>
            </div>
          </LexCard>
          <LexCard variant="process">
            <LexCardHeader>
              <LexCardTitle>Audiência</LexCardTitle>
              <LexBadge variant="warning"><Calendar className="mr-1 h-3 w-3" />5 dias</LexBadge>
            </LexCardHeader>
            <p className="text-body-sm text-muted-foreground mb-2">Instrução e julgamento</p>
            <div className="flex items-center gap-2 text-caption text-muted-foreground"><Gavel className="h-3.5 w-3.5 text-primary" /><span>3ª Vara Cível — SP</span></div>
          </LexCard>
          <LexCard variant="glass">
            <LexCardTitle className="mb-3">Glass Card</LexCardTitle>
            <p className="text-body-sm text-muted-foreground">Glassmorphism com blur e saturação para overlays premium.</p>
          </LexCard>
        </div>
      </Section>

      <Section title="6. Indicadores de Risco" id="risk">
        <div className="flex flex-wrap gap-8">
          <RiskIndicator level="low" />
          <RiskIndicator level="medium" />
          <RiskIndicator level="high" />
          <RiskIndicator level="critical" />
        </div>
      </Section>

      <Section title="7. Timeline Processual" id="timeline">
        <div className="max-w-xl"><LegalTimeline items={timelineItems} /></div>
      </Section>

      <Section title="8. Efeitos Visuais" id="effects">
        <div className="flex flex-wrap gap-6 mb-8">
          {["shadow-sm", "shadow-md", "shadow-lg", "shadow-xl"].map(s => (
            <div key={s} className={`h-20 w-32 rounded-xl bg-card border border-border ${s} flex items-center justify-center`}>
              <span className="text-caption text-muted-foreground">{s}</span>
            </div>
          ))}
          <div className="h-20 w-32 rounded-xl bg-card neon-border flex items-center justify-center">
            <span className="text-caption text-primary">neon-border</span>
          </div>
          <div className="h-20 w-32 rounded-xl bg-card neon-border-violet flex items-center justify-center">
            <span className="text-caption text-secondary">neon-violet</span>
          </div>
          <div className="h-20 w-32 rounded-xl glass flex items-center justify-center">
            <span className="text-caption text-foreground">glass</span>
          </div>
        </div>
      </Section>

      <Section title="9. Branding" id="branding">
        <div className="flex flex-wrap items-center gap-12 mb-8">
          <LexLogo size="lg" />
          <LexLogo size="md" />
          <LexLogo size="sm" />
          <LexLogo size="md" showText={false} />
        </div>
        <div className="rounded-2xl p-10 relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
          <div className="absolute inset-0 dot-grid opacity-10" />
          <div className="relative z-10">
            <LexLogo size="lg" className="mb-6" />
            <p className="text-body-lg text-muted-foreground max-w-lg">
              Inteligência jurídica que transforma a prática do direito com tecnologia de ponta e IA avançada.
            </p>
          </div>
        </div>
      </Section>

      <div className="py-12 text-center border-t border-border/50">
        <LexLogo size="sm" showText className="justify-center mx-auto mb-4" />
        <p className="text-caption text-muted-foreground">LexIA Design System v2.0 — Bold & Tech</p>
      </div>
    </div>
  </div>
);

export default Index;
