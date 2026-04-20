import React from "react";
import { motion } from "framer-motion";
import { UserPlus, Upload, Brain, TrendingUp } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.5 },
  }),
};

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Crie sua conta",
    desc: "Cadastre-se gratuitamente e configure seu escritório em menos de 2 minutos.",
  },
  {
    icon: Upload,
    step: "02",
    title: "Importe seus processos",
    desc: "Envie documentos, petições e dados processuais. A IA organiza tudo automaticamente.",
  },
  {
    icon: Brain,
    step: "03",
    title: "IA analisa e sugere",
    desc: "Receba análises preditivas, sugestões de argumentos e alertas de prazos em tempo real.",
  },
  {
    icon: TrendingUp,
    step: "04",
    title: "Acompanhe resultados",
    desc: "Monitore métricas, gere relatórios e tome decisões estratégicas com dados concretos.",
  },
];

const HowItWorksSection = () => (
  <section className="py-24 border-t border-border/50 relative overflow-hidden">
    <div className="absolute inset-0 dot-grid opacity-5" />
    <div className="relative container mx-auto px-6 max-w-5xl">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
        <motion.p variants={fadeUp} custom={0} className="text-overline text-primary mb-3">Como funciona</motion.p>
        <motion.h2 variants={fadeUp} custom={1} className="text-display-xl mb-4">
          Comece em <span className="gradient-text">4 passos</span> simples
        </motion.h2>
        <motion.p variants={fadeUp} custom={2} className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
          Do cadastro ao primeiro insight jurídico em poucos minutos.
        </motion.p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {steps.map((s, i) => (
          <motion.div
            key={s.step}
            variants={fadeUp}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="relative text-center group"
          >
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="hidden lg:block absolute top-10 left-[60%] w-[80%] h-px bg-gradient-to-r from-primary/30 to-transparent" />
            )}
            <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-5 group-hover:bg-primary/20 group-hover:border-primary/40 transition-all duration-300">
              <s.icon className="h-8 w-8 text-primary" />
            </div>
            <span className="inline-block text-caption font-bold text-primary mb-2">{s.step}</span>
            <h3 className="text-display-sm mb-2">{s.title}</h3>
            <p className="text-body-sm text-muted-foreground leading-relaxed">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorksSection;
