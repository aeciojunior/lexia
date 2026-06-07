import { motion } from "framer-motion";
import { Scale, Building2, Globe, Database, Lock, Webhook } from "lucide-react";
import { useLandingMotion } from "./landing-motion";
const integrations = [
  { icon: Scale, name: "Tribunais Estaduais", desc: "TJ de todos os estados" },
  { icon: Building2, name: "Tribunais Superiores", desc: "STF, STJ, TST, TSE" },
  { icon: Globe, name: "PJe", desc: "Processo Judicial Eletrônico" },
  { icon: Database, name: "PROJUDI", desc: "Processo Digital Unificado" },
  { icon: Lock, name: "ClickSign", desc: "Assinatura digital" },
  { icon: Webhook, name: "API Aberta", desc: "Integre com seus sistemas" },
];

const IntegrationsSection = () => {
  const motionVariant = useLandingMotion();

  return (
  <section className="relative overflow-hidden border-t border-border/50 py-20 sm:py-24">    <div className="absolute inset-0 dot-grid opacity-5" />
    <div className="relative container mx-auto px-6 max-w-5xl">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
        <motion.p variants={motionVariant} custom={0} className="text-overline text-primary mb-3">Integrações</motion.p>
        <motion.h2 variants={motionVariant} custom={1} className="text-display-xl mb-4 text-balance">
          Conectado aos <span className="gradient-text">principais</span> sistemas
        </motion.h2>
        <motion.p variants={motionVariant} custom={2} className="text-body-lg text-muted-foreground max-w-2xl mx-auto text-pretty">          Sincronize processos, documentos e movimentações automaticamente com tribunais e ferramentas do ecossistema jurídico.
        </motion.p>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {integrations.map((item, i) => (
          <motion.div
            key={item.name}
            variants={motionVariant}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="flex flex-col items-center text-center rounded-xl p-6 bg-card border border-border hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
              <item.icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-body-sm font-semibold text-foreground mb-1">{item.name}</h3>
            <p className="text-caption text-muted-foreground">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
  );
};

export default IntegrationsSection;