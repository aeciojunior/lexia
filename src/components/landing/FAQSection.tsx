import React from "react";
import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

const faqs = [
  {
    q: "O LexIA é seguro para armazenar dados sensíveis de processos?",
    a: "Sim. Utilizamos criptografia end-to-end, isolamento completo de dados por organização (multi-tenant com RLS) e estamos em conformidade total com a LGPD. Seus dados nunca são compartilhados entre escritórios.",
  },
  {
    q: "Preciso instalar algum software?",
    a: "Não. O LexIA é 100% web e funciona em qualquer navegador moderno, no computador, tablet ou celular. Basta criar uma conta e começar a usar.",
  },
  {
    q: "A inteligência artificial substitui o advogado?",
    a: "De forma alguma. A IA do LexIA é uma ferramenta de apoio que analisa dados, sugere argumentos e automatiza tarefas repetitivas. Todas as decisões estratégicas continuam nas mãos do advogado.",
  },
  {
    q: "Posso importar processos de outros sistemas?",
    a: "Sim. O LexIA suporta importação de documentos em diversos formatos (PDF, DOCX, etc.) e possui integrações com sistemas de tribunais para sincronização automática de movimentações.",
  },
  {
    q: "Existe período de teste gratuito?",
    a: "Sim! Oferecemos 14 dias de teste gratuito no plano Profissional, sem necessidade de cartão de crédito. Você pode explorar todas as funcionalidades antes de decidir.",
  },
  {
    q: "Como funciona o suporte técnico?",
    a: "O plano Starter inclui suporte por email. O Profissional conta com suporte prioritário via chat. E o Enterprise oferece um gerente de conta dedicado com SLA garantido.",
  },
];

const FAQSection = () => (
  <section className="py-24 border-t border-border/50">
    <div className="container mx-auto px-6 max-w-3xl">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
        <motion.p variants={fadeUp} custom={0} className="text-overline text-primary mb-3">FAQ</motion.p>
        <motion.h2 variants={fadeUp} custom={1} className="text-display-xl mb-4">
          Perguntas <span className="gradient-text-accent">frequentes</span>
        </motion.h2>
        <motion.p variants={fadeUp} custom={2} className="text-body-lg text-muted-foreground">
          Tire suas dúvidas sobre o LexIA.
        </motion.p>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeUp}
        custom={3}
      >
        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="rounded-xl border border-border bg-card px-6 data-[state=open]:border-primary/30 transition-colors"
            >
              <AccordionTrigger className="text-body-sm font-semibold text-foreground hover:text-primary py-5 text-left">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-body-sm text-muted-foreground leading-relaxed pb-5">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </motion.div>
    </div>
  </section>
);

export default FAQSection;
