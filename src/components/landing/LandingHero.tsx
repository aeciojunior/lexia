import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Shield,
  Clock,
  TrendingUp,
  FileText,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-bg.jpg";

const trustItems = [
  { icon: Shield, label: "LGPD compliant" },
  { icon: Clock, label: "Setup em 2 min" },
  { icon: TrendingUp, label: "ROI comprovado" },
];

export default function LandingHero() {
  const reduced = useReducedMotion();

  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20 lg:pt-36 lg:pb-28">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/85 to-background" aria-hidden />
      <div className="absolute inset-0 landing-hero-mesh" aria-hidden />
      <div className="absolute inset-0 dot-grid opacity-[0.07]" aria-hidden />

      {!reduced && (
        <>
          <div className="landing-orb landing-orb-primary absolute -left-24 top-20 h-72 w-72 sm:h-96 sm:w-96" aria-hidden />
          <div className="landing-orb landing-orb-secondary absolute -right-16 bottom-10 h-64 w-64 sm:h-80 sm:w-80" aria-hidden />
        </>
      )}

      <div className="container relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 xl:gap-16">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-center lg:text-left"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-1.5 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="text-caption font-semibold text-primary">Powered by AI</span>
            </div>

            <h1 className="landing-display mb-6 text-balance">
              Inteligência jurídica que{" "}
              <span className="gradient-text">transforma</span> resultados
            </h1>

            <p className="mx-auto mb-8 max-w-xl text-body-lg text-muted-foreground text-pretty lg:mx-0 lg:max-w-lg">
              Gerencie processos, automatize prazos e tome decisões estratégicas com a plataforma de IA mais avançada para o direito brasileiro.
            </p>

            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
              <Button variant="hero" size="xl" className="w-full sm:w-auto" asChild>
                <Link to="/auth">
                  Começar gratuitamente <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="hero-outline" size="xl" className="w-full sm:w-auto" asChild>
                <a href="#features">Ver funcionalidades</a>
              </Button>
            </div>

            <ul className="mt-10 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              {trustItems.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-caption font-medium text-muted-foreground backdrop-blur-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 36, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative mx-auto w-full max-w-md lg:max-w-none"
          >
            <div className="landing-preview-glow absolute -inset-4 rounded-3xl opacity-60 blur-2xl" aria-hidden />
            <div className="landing-preview relative overflow-hidden rounded-2xl border border-border/80 bg-card/90 p-4 shadow-xl backdrop-blur-md sm:p-5">
              <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                    <Brain className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-caption font-semibold text-foreground">LexIA Copilot</p>
                    <p className="text-[11px] text-muted-foreground">Análise em tempo real</p>
                  </div>
                </div>
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                  Live
                </span>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <p className="text-[11px] font-medium text-muted-foreground">Processo #2024.001234</p>
                  <p className="mt-1 text-body-sm font-semibold">Probabilidade de êxito: 78%</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                    <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-primary to-accent" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                    <FileText className="mb-2 h-4 w-4 text-secondary" />
                    <p className="text-lg font-bold">142</p>
                    <p className="text-[11px] text-muted-foreground">Documentos</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                    <Clock className="mb-2 h-4 w-4 text-warning" />
                    <p className="text-lg font-bold">3</p>
                    <p className="text-[11px] text-muted-foreground">Prazos hoje</p>
                  </div>
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <p className="text-body-sm leading-relaxed text-foreground/90">
                    Sugestão: reforçar fundamentação com Súmula 331 do STJ e jurisprudência recente do TJSP.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
