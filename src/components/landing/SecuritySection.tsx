import { motion } from "framer-motion";
import { Lock, ShieldCheck, Eye, Server, FileKey, BadgeCheck } from "lucide-react";
import { useLandingMotion } from "./landing-motion";

const pillars = [
  {
    icon: Lock,
    title: "Criptografia em trânsito e repouso",
    desc: "TLS 1.3 na comunicação e dados protegidos com padrões de mercado em todos os ambientes.",
  },
  {
    icon: ShieldCheck,
    title: "Isolamento multi-tenant (RLS)",
    desc: "Cada organização opera em ambiente isolado. Nenhum escritório acessa dados de outro.",
  },
  {
    icon: Eye,
    title: "Auditoria e rastreabilidade",
    desc: "Logs de acesso e ações críticas para compliance interno e resposta a incidentes.",
  },
  {
    icon: Server,
    title: "Infraestrutura confiável",
    desc: "99.8% uptime, backups automáticos e arquitetura preparada para alta disponibilidade.",
  },
  {
    icon: FileKey,
    title: "Conformidade LGPD",
    desc: "Controles de consentimento, minimização de dados e políticas alinhadas à legislação brasileira.",
  },
  {
    icon: BadgeCheck,
    title: "Controle de acesso granular",
    desc: "Permissões por papel, convites seguros e autenticação robusta para cada membro do time.",
  },
];

export default function SecuritySection() {
  const motionVariant = useLandingMotion();

  return (
    <section id="security" className="relative overflow-hidden border-t border-border/50 py-20 sm:py-24">
      <div className="absolute inset-0 landing-security-bg" aria-hidden />
      <div className="container relative mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto mb-14 max-w-3xl text-center"
        >
          <motion.p variants={motionVariant} custom={0} className="text-overline text-primary mb-3">
            Segurança
          </motion.p>
          <motion.h2 variants={motionVariant} custom={1} className="text-display-xl mb-4 text-balance">
            Proteção de nível <span className="gradient-text">enterprise</span> para dados sensíveis
          </motion.h2>
          <motion.p variants={motionVariant} custom={2} className="text-body-lg text-muted-foreground text-pretty">
            Segurança não é um add-on — é a base da plataforma. Projetado para escritórios que não podem errar com informação confidencial.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {pillars.map((item, i) => (
            <motion.article
              key={item.title}
              variants={motionVariant}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              className="group rounded-2xl border border-border/70 bg-card/70 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/35 hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                <item.icon className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <h3 className="text-display-sm mb-2">{item.title}</h3>
              <p className="text-body-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
