import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { useLandingMotion } from "./landing-motion";
const testimonials = [
  {
    name: "Dra. Camila Ferreira",
    role: "Sócia — Ferreira & Associados",
    avatar: "CF",
    stars: 5,
    text: "O LexIA revolucionou nosso escritório. Reduzimos em 60% o tempo gasto com prazos e a IA nos ajuda a montar estratégias em minutos.",
  },
  {
    name: "Dr. Rafael Mendes",
    role: "Advogado Tributarista",
    avatar: "RM",
    stars: 5,
    text: "A análise preditiva de processos é impressionante. Já conseguimos antecipar decisões e preparar recursos com muito mais assertividade.",
  },
  {
    name: "Dra. Juliana Costa",
    role: "Diretora Jurídica — TechCorp",
    avatar: "JC",
    stars: 5,
    text: "Gerenciar o departamento jurídico ficou muito mais simples. Os dashboards e relatórios automáticos economizam horas por semana.",
  },
];

const TestimonialsSection = () => {
  const motionVariant = useLandingMotion();

  return (
  <section className="border-t border-border/50 py-20 sm:py-24">    <div className="container mx-auto px-6 max-w-6xl">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
        <motion.p variants={motionVariant} custom={0} className="text-overline text-primary mb-3">Depoimentos</motion.p>
        <motion.h2 variants={motionVariant} custom={1} className="text-display-xl mb-4 text-balance">
          O que nossos <span className="gradient-text">clientes</span> dizem
        </motion.h2>
        <motion.p variants={motionVariant} custom={2} className="text-body-lg text-muted-foreground max-w-2xl mx-auto text-pretty">          Advogados e escritórios de todo o Brasil confiam no LexIA para transformar sua prática jurídica.
        </motion.p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {testimonials.map((t, i) => (
          <motion.div
            key={t.name}
            variants={motionVariant}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="relative rounded-2xl border border-border/70 bg-card/80 p-7 sm:p-8 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg group"          >
            <Quote className="absolute top-6 right-6 h-8 w-8 text-primary/10 group-hover:text-primary/20 transition-colors" />
            <div className="flex items-center gap-1 mb-4">
              {Array.from({ length: t.stars }).map((_, si) => (
                <Star key={si} className="h-4 w-4 fill-warning text-warning" />
              ))}
            </div>
            <p className="text-body-sm text-muted-foreground mb-6 leading-relaxed">"{t.text}"</p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                {t.avatar}
              </div>
              <div>
                <p className="text-body-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-caption text-muted-foreground">{t.role}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
  );
};

export default TestimonialsSection;