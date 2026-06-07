import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Brain, FileText, Users, Shield, Calendar, BarChart3,
  CheckCircle, ArrowRight, Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LexLogo } from "@/components/lexia/LexLogo";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingHero from "@/components/landing/LandingHero";
import SecuritySection from "@/components/landing/SecuritySection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import IntegrationsSection from "@/components/landing/IntegrationsSection";
import FAQSection from "@/components/landing/FAQSection";
import { useLandingMotion } from "@/components/landing/landing-motion";

const features = [
  { icon: Brain, title: "IA Jurídica Avançada", desc: "Análise preditiva de processos, cálculo de risco e sugestões estratégicas em tempo real." },
  { icon: FileText, title: "Gestão de Documentos", desc: "Organize petições, contratos e pareceres com categorização automática por IA." },
  { icon: Calendar, title: "Prazos Inteligentes", desc: "Nunca perca um prazo. Notificações automáticas e sincronização com tribunais." },
  { icon: Users, title: "Multi-tenant", desc: "Escritórios com múltiplos advogados, permissões granulares e isolamento de dados." },
  { icon: Shield, title: "Segurança Total", desc: "Criptografia end-to-end, RLS por organização e conformidade com LGPD." },
  { icon: BarChart3, title: "Dashboards Analíticos", desc: "Visualize métricas de desempenho, volume processual e indicadores de produtividade." },
];

const stats = ["500+ advogados", "12.000+ processos", "99.8% uptime", "4.9★ avaliação"];

const plans = [
  {
    name: "Starter",
    price: "R$ 97",
    period: "/mês",
    desc: "Para advogados autônomos",
    features: ["1 usuário", "50 processos", "Chat IA — 100 msgs/mês", "5 GB armazenamento", "Suporte por email"],
    cta: "Começar grátis",
    variant: "outline" as const,
  },
  {
    name: "Profissional",
    price: "R$ 247",
    period: "/mês",
    desc: "Para escritórios em crescimento",
    features: ["5 usuários", "Processos ilimitados", "Chat IA ilimitado", "50 GB armazenamento", "Prazos inteligentes", "Suporte prioritário"],
    cta: "Teste grátis 14 dias",
    variant: "hero" as const,
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    desc: "Para grandes escritórios e departamentos jurídicos",
    features: ["Usuários ilimitados", "SSO / SAML", "API dedicada", "Armazenamento ilimitado", "SLA 99.9%", "Gerente de conta dedicado"],
    cta: "Falar com vendas",
    variant: "outline" as const,
  },
];

const footerLinks = [
  { href: "/auth", label: "Acessar plataforma" },
];

export default function Landing() {
  const motionVariant = useLandingMotion();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />

      <main id="main-content">
        <LandingHero />

        {/* Social proof */}
        <section className="border-y border-border/50 bg-card/30 py-8 sm:py-10" aria-label="Indicadores">
          <div className="container mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-overline mb-6 text-center text-muted-foreground">
              Utilizado por escritórios em todo o Brasil
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={motionVariant}
                  custom={i}
                  className="rounded-2xl border border-border/60 bg-background/50 px-3 py-4 text-center backdrop-blur-sm sm:px-4 sm:py-5"
                >
                  <p className="text-body-sm font-semibold text-foreground/85 sm:text-base">{stat}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 sm:py-24">
          <div className="container mx-auto max-w-6xl px-4 sm:px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="mx-auto mb-14 max-w-3xl text-center"
            >
              <motion.p variants={motionVariant} custom={0} className="text-overline text-primary mb-3">
                Funcionalidades
              </motion.p>
              <motion.h2 variants={motionVariant} custom={1} className="text-display-xl mb-4 text-balance">
                Tudo que seu escritório <span className="gradient-text">precisa</span>
              </motion.h2>
              <motion.p variants={motionVariant} custom={2} className="text-body-lg text-muted-foreground text-pretty">
                Uma plataforma completa para gestão jurídica inteligente, do primeiro contato ao encerramento do processo.
              </motion.p>
            </motion.div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {features.map((f, i) => (
                <motion.article
                  key={f.title}
                  variants={motionVariant}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-40px" }}
                  className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <f.icon className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <h3 className="text-display-sm mb-2">{f.title}</h3>
                  <p className="text-body-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <HowItWorksSection />
        <IntegrationsSection />
        <SecuritySection />
        <TestimonialsSection />

        {/* Pricing */}
        <section id="pricing" className="border-t border-border/50 py-20 sm:py-24">
          <div className="container mx-auto max-w-6xl px-4 sm:px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="mx-auto mb-14 max-w-3xl text-center"
            >
              <motion.p variants={motionVariant} custom={0} className="text-overline text-primary mb-3">
                Preços
              </motion.p>
              <motion.h2 variants={motionVariant} custom={1} className="text-display-xl mb-4 text-balance">
                Planos que <span className="gradient-text-accent">cabem</span> no seu escritório
              </motion.h2>
              <motion.p variants={motionVariant} custom={2} className="text-body-lg text-muted-foreground">
                Comece grátis. Escale conforme cresce.
              </motion.p>
            </motion.div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3 lg:gap-6">
              {plans.map((plan, i) => (
                <motion.article
                  key={plan.name}
                  variants={motionVariant}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className={`relative flex flex-col rounded-2xl border p-7 sm:p-8 transition-all duration-300 ${
                    plan.popular
                      ? "border-primary/40 bg-card neon-border shadow-xl md:scale-[1.02] md:-translate-y-1"
                      : "border-border/70 bg-card/80 hover:border-primary/20"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-primary px-4 py-1 text-caption font-bold text-primary-foreground shadow-glow-primary">
                        Mais popular
                      </span>
                    </div>
                  )}
                  <p className="text-overline text-muted-foreground mb-2">{plan.name}</p>
                  <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-display-lg">{plan.price}</span>
                    {plan.period && <span className="text-body-sm text-muted-foreground">{plan.period}</span>}
                  </div>
                  <p className="mb-6 text-body-sm text-muted-foreground">{plan.desc}</p>
                  <Button variant={plan.variant} className="mb-6 w-full" size="lg" asChild>
                    <Link to="/auth">{plan.cta}</Link>
                  </Button>
                  <ul className="mt-auto space-y-3">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-body-sm">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                        <span className="text-muted-foreground">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <FAQSection />

        {/* CTA */}
        <section className="py-20 sm:py-24">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-3xl border border-primary/20 p-8 sm:p-12" style={{ background: "var(--gradient-hero)" }}>
              <div className="absolute inset-0 dot-grid opacity-10" aria-hidden />
              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" aria-hidden />
              <div className="relative z-10 text-center">
                <Bot className="mx-auto mb-6 h-12 w-12 text-primary" aria-hidden />
                <h2 className="text-display-lg mb-4 text-balance">Pronto para transformar seu escritório?</h2>
                <p className="mx-auto mb-8 max-w-xl text-body-lg text-muted-foreground text-pretty">
                  Junte-se a centenas de advogados que já usam IA para ganhar tempo, reduzir erros e vencer mais causas.
                </p>
                <Button variant="hero" size="xl" asChild>
                  <Link to="/auth">
                    Criar conta gratuita <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-10 sm:py-12">
        <div className="container mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <LexLogo size="sm" />
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-body-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="text-caption text-muted-foreground">© 2026 LexIA. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
