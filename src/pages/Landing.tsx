import React from "react";
import { Button } from "@/components/ui/button";
import { LexLogo } from "@/components/lexia/LexLogo";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Scale, Brain, FileText, Users, Shield, Zap, Sparkles,
  CheckCircle, ArrowRight, Bot, Calendar, BarChart3
} from "lucide-react";
import heroImage from "@/assets/hero-bg.jpg";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import IntegrationsSection from "@/components/landing/IntegrationsSection";
import FAQSection from "@/components/landing/FAQSection";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

const features = [
  { icon: Brain, title: "IA Jurídica Avançada", desc: "Análise preditiva de processos, cálculo de risco e sugestões estratégicas em tempo real." },
  { icon: FileText, title: "Gestão de Documentos", desc: "Organize petições, contratos e pareceres com categorização automática por IA." },
  { icon: Calendar, title: "Prazos Inteligentes", desc: "Nunca perca um prazo. Notificações automáticas e sincronização com tribunais." },
  { icon: Users, title: "Multi-tenant", desc: "Escritórios com múltiplos advogados, permissões granulares e isolamento de dados." },
  { icon: Shield, title: "Segurança Total", desc: "Criptografia end-to-end, RLS por organização e conformidade com LGPD." },
  { icon: BarChart3, title: "Dashboards Analíticos", desc: "Visualize métricas de desempenho, volume processual e indicadores de produtividade." },
];

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

const Landing = () => (
  <div className="min-h-screen bg-background">
    {/* Navbar */}
    <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <LexLogo size="sm" />
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-body-sm text-muted-foreground hover:text-foreground transition-colors">Funcionalidades</a>
          <a href="#pricing" className="text-body-sm text-muted-foreground hover:text-foreground transition-colors">Preços</a>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/auth">Criar conta</Link>
          </Button>
        </div>
      </div>
    </nav>

    {/* Hero */}
    <section
      className="relative overflow-hidden pt-32 pb-24"
      style={{ backgroundImage: `url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
      <div className="absolute inset-0 dot-grid opacity-10" />
      <div className="relative container mx-auto px-6 text-center max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 mb-8">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-caption text-primary font-semibold">Powered by AI</span>
          </div>
          <h1 className="text-display-2xl mb-6">
            Inteligência jurídica que{" "}
            <span className="gradient-text">transforma</span> resultados
          </h1>
          <p className="text-body-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Gerencie processos, automatize prazos e tome decisões estratégicas com a plataforma de IA mais avançada para o direito brasileiro.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button variant="hero" size="xl" asChild>
              <Link to="/auth">
                Começar gratuitamente <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="hero-outline" size="xl" asChild>
              <a href="#features">Ver funcionalidades</a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>

    {/* Social proof */}
    <section className="border-b border-border/50 py-10">
      <div className="container mx-auto px-6 text-center">
        <p className="text-overline text-muted-foreground mb-6">Utilizado por escritórios em todo o Brasil</p>
        <div className="flex flex-wrap justify-center gap-12 items-center">
          {["500+ advogados", "12.000+ processos", "99.8% uptime", "4.9★ avaliação"].map((stat) => (
            <div key={stat} className="text-body-sm font-semibold text-foreground/70">{stat}</div>
          ))}
        </div>
      </div>
    </section>

    {/* Features */}
    <section id="features" className="py-24">
      <div className="container mx-auto px-6 max-w-6xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
          <motion.p variants={fadeUp} custom={0} className="text-overline text-primary mb-3">Funcionalidades</motion.p>
          <motion.h2 variants={fadeUp} custom={1} className="text-display-xl mb-4">
            Tudo que seu escritório <span className="gradient-text">precisa</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
            Uma plataforma completa para gestão jurídica inteligente, do primeiro contato ao encerramento do processo.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="rounded-xl p-6 bg-card border border-border hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-normal group"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-display-sm mb-2">{f.title}</h3>
              <p className="text-body-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* How it works */}
    <HowItWorksSection />

    {/* Integrations */}
    <IntegrationsSection />

    {/* Testimonials */}
    <TestimonialsSection />

    {/* Pricing */}
    <section id="pricing" className="py-24 border-t border-border/50">
      <div className="container mx-auto px-6 max-w-5xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
          <motion.p variants={fadeUp} custom={0} className="text-overline text-primary mb-3">Preços</motion.p>
          <motion.h2 variants={fadeUp} custom={1} className="text-display-xl mb-4">
            Planos que <span className="gradient-text-accent">cabem</span> no seu escritório
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-body-lg text-muted-foreground">
            Comece grátis. Escale conforme cresce.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              variants={fadeUp}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className={`rounded-2xl p-8 border transition-all duration-normal relative ${
                plan.popular
                  ? "border-primary/40 bg-card neon-border shadow-lg scale-[1.02]"
                  : "border-border bg-card hover:border-primary/20"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-4 py-1 text-caption font-bold text-primary-foreground">
                    Mais popular
                  </span>
                </div>
              )}
              <p className="text-overline text-muted-foreground mb-2">{plan.name}</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-display-lg">{plan.price}</span>
                {plan.period && <span className="text-body-sm text-muted-foreground">{plan.period}</span>}
              </div>
              <p className="text-body-sm text-muted-foreground mb-6">{plan.desc}</p>
              <Button variant={plan.variant} className="w-full mb-6" size="lg" asChild>
                <Link to="/auth">{plan.cta}</Link>
              </Button>
              <ul className="space-y-3">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-body-sm">
                    <CheckCircle className="h-4 w-4 text-accent shrink-0" />
                    <span className="text-muted-foreground">{feat}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-24">
      <div className="container mx-auto px-6 max-w-3xl text-center">
        <div className="rounded-2xl p-12 relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
          <div className="absolute inset-0 dot-grid opacity-10" />
          <div className="relative z-10">
            <Bot className="h-12 w-12 text-primary mx-auto mb-6" />
            <h2 className="text-display-lg mb-4">Pronto para transformar seu escritório?</h2>
            <p className="text-body-lg text-muted-foreground mb-8 max-w-xl mx-auto">
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

    {/* Footer */}
    <footer className="border-t border-border/50 py-10">
      <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <LexLogo size="sm" />
        <p className="text-caption text-muted-foreground">© 2026 LexIA. Todos os direitos reservados.</p>
      </div>
    </footer>
  </div>
);

export default Landing;
