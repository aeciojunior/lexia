# LegalFlow — Plataforma Jurídica Inteligente

Plataforma SaaS multi-tenant para escritórios de advocacia e departamentos jurídicos, com automação de processos, integração com tribunais, geração de minutas por IA, gestão de contratos, assinaturas eletrônicas e portal do cliente.

## ✨ Principais funcionalidades

- **Núcleo Jurídico**: cadastro de processos com validação CNJ (`0000000-00.0000.0.00.0000`), audiências, prazos, movimentações e timeline visual.
- **Integração com Tribunais**: sincronização automática (PJe, PROJUDI, eSAJ) com identificação do sistema a partir do número CNJ.
- **Inteligência Artificial**:
  - Geração de minutas e peças processuais
  - Resumos 360° de processos com Human-in-the-Loop
  - Classificação automática de documentos com badge de confiança
  - Comandos por voz (Web Speech API)
  - Predições processuais (sem fornecer datas, valores ou percentuais exatos)
- **Gestão de Contratos**: editor com seções obrigatórias, geração de PDF, assinatura via ClickSign e faturamento automático.
- **Comparação Avançada de Documentos**: suporte a PDF, DOCX e TXT com diff visual.
- **Due Diligence** automatizada e relatórios em PDF.
- **Portal do Cliente** (`/portal`): área restrita ao papel `client`, sem modo de pré-visualização administrativo.
- **Governança & Auditoria**: logs de segurança, ACL granular, gestão de organização e detecção de anomalias.
- **Automação Agendada**: rotinas em background via cron (notificações de prazos, faturas, movimentações, etc.).

## 🛠️ Stack Tecnológica

- **Frontend**: React 18 + Vite 5 + TypeScript 5
- **UI**: Tailwind CSS v3 + shadcn/ui + Framer Motion
- **Tema**: Dark Midnight com Electric Cyan, Vivid Violet e Neon Emerald — tipografia Outfit (títulos) + Inter (corpo)
- **Backend**: Lovable Cloud (Supabase) com RLS estrita por `organization_id`
- **IA**: Lovable AI Gateway (Azure OpenAI)
- **Pagamentos**: PagSeguro
- **Assinatura eletrônica**: ClickSign
- **Testes**: Vitest + Testing Library (unitários e E2E)

## 🚀 Como executar localmente

Pré-requisitos: Node.js 18+ e npm (recomendado instalar via [nvm](https://github.com/nvm-sh/nvm)).

```sh
# 1. Clonar o repositório
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# 2. Instalar dependências
npm install

# 3. Iniciar o servidor de desenvolvimento
npm run dev
```

A aplicação ficará disponível em `http://localhost:8080`.

## 📜 Scripts disponíveis

| Script              | Descrição                                       |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento com HMR             |
| `npm run build`     | Build de produção                               |
| `npm run build:dev` | Build em modo desenvolvimento                   |
| `npm run preview`   | Preview do build de produção                    |
| `npm run lint`      | Lint com ESLint                                 |
| `npm run test`      | Executa todos os testes (Vitest)                |
| `npm run test:watch`| Testes em modo watch                            |

## 🧪 Testes

O projeto possui cobertura ampla de testes unitários e end-to-end localizados em:

- `src/**/__tests__/` — testes unitários de componentes, hooks e libs
- `src/test/e2e/` — testes end-to-end de fluxos completos
- `supabase/functions/**/*.test.ts` — testes de edge functions

```sh
npm run test
```

## 📁 Estrutura do projeto

```
src/
├── components/        # Componentes reutilizáveis (UI, layout, domínio)
│   ├── ui/            # shadcn/ui
│   ├── landing/       # Seções da landing page
│   ├── contracts/     # Contratos e geração de PDF
│   ├── lexia/         # Componentes da assistente IA
│   └── process/       # Componentes do núcleo processual
├── hooks/             # Hooks customizados (auth, organização, permissões)
├── integrations/      # Cliente Supabase e tipos gerados
├── lib/               # Utilitários (validação fiscal, extração PDF/DOCX)
├── pages/             # Rotas da aplicação
└── test/              # Setup, helpers e testes E2E

supabase/
├── functions/         # Edge Functions (IA, integrações, automações)
└── config.toml
```

## 🔒 Segurança & Multi-tenancy

- Isolamento estrito por `organization_id` em todas as queries (RLS)
- Tokens de recuperação de senha expiram em 30 minutos
- Mensagens genéricas em fluxos de autenticação para evitar enumeração de usuários
- Roles armazenadas em tabela dedicada (`user_roles`) com função `SECURITY DEFINER` para evitar escalonamento de privilégios
- Auditoria completa via `audit_logs`

## 🌐 Deploy

Publicação via [Lovable](https://lovable.dev) → **Share → Publish**.

Para conectar um domínio customizado: **Project → Settings → Domains → Connect Domain**.

## 📄 Licença

Projeto proprietário. Todos os direitos reservados.
