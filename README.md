# LexIA — Plataforma Jurídica Inteligente

Plataforma SaaS multi-tenant para escritórios de advocacia e departamentos jurídicos, com automação de processos, integração com tribunais, geração de minutas por IA, gestão de contratos, assinaturas eletrônicas e portal do cliente.

## 🏷️ Identidade da marca: nome "LexIA"

O nome oficial do produto é **LexIA** e deve ser grafado sempre da mesma forma em todos os contextos (código, UI, documentação, e-mails, materiais de marketing, mensagens de erro, metadados e comunicações com o cliente).

### ✅ Forma correta

- **LexIA** — `L` maiúsculo, `e` e `x` minúsculos, `I` e `A` maiúsculos, sem espaço, sem hífen, sem ponto.

### ❌ Variações proibidas

Nunca use nenhuma das formas abaixo, mesmo informalmente:

| Errado          | Motivo                                    |
| --------------- | ----------------------------------------- |
| `LegalFlow`     | Nome legado, descontinuado                |
| `Lex IA`        | Espaço no meio quebra a identidade visual |
| `Lexia`         | Sem destaque para o sufixo "IA"           |
| `LEXIA`         | Caixa alta total não é a marca oficial    |
| `lexia`         | Caixa baixa total não é a marca oficial   |
| `LexAI` / `Lex.IA` | Outras variações não autorizadas       |

### 📐 Regras de uso

- **Em texto corrido**: trate "LexIA" como nome próprio — não traduza, não pluralize ("LexIAs" ❌) e não use possessivo apostrofado ("LexIA's" ❌).
- **Em títulos e headings**: mantenha exatamente "LexIA", mesmo que o restante do título esteja em caixa alta (ex.: `BEM-VINDO À LexIA`).
- **Em URLs, IDs e nomes de arquivo**: use `lexia` em minúsculas (ex.: `src/components/lexia/`, rota `/lexia-chat`). Esta é a única exceção à regra de capitalização e aplica-se apenas a identificadores técnicos.
- **Em e-mails e comunicações**: sempre "LexIA" no corpo da mensagem; o domínio/handle pode usar `lexia` minúsculo.
- **Logo e assinatura visual**: ver `src/components/lexia/LexLogo.tsx` — não recriar o nome manualmente em SVG/imagem sem seguir o componente oficial.

### 🔧 Aplicação no projeto

A regra é reforçada em múltiplas camadas:

1. **Memória do agente Lovable** (`mem://produto/nome` e regra Core em `mem://index.md`): garante que qualquer alteração feita por IA respeite a grafia.
2. **Metadados da aplicação** (`index.html`): `<title>`, `<meta name="description">` e tags Open Graph usam "LexIA".
3. **Componentes de marca** (`src/components/lexia/LexLogo.tsx`, `LexBadge.tsx`, `LexCard.tsx`): centralizam a identidade visual.
4. **Documentação** (`README.md`): este documento é a referência canônica para colaboradores humanos.
5. **Revisão de PRs**: qualquer ocorrência de `LegalFlow`, `Lex IA`, `Lexia`, `LEXIA` ou `LexAI` deve ser corrigida antes do merge.

### 🔍 Como auditar rapidamente

```sh
# Procura variações proibidas no código-fonte
grep -rEn "LegalFlow|Lex IA|Lexia|LEXIA|LexAI|Lex\.IA" src index.html README.md \
  --exclude-dir=node_modules
```

Se o comando retornar resultados, substitua todas as ocorrências por **LexIA** (ou `lexia` quando se tratar de identificador técnico).

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

## 🛟 Troubleshooting

Erros comuns e como resolvê-los rapidamente.

### 🔐 Autenticação

**`Invalid login credentials` mesmo com senha correta**
- Confirme que o e-mail foi confirmado em **Supabase → Authentication → Users**.
- Em desenvolvimento, desabilite "Confirm email" em **Authentication → Providers → Email** para acelerar testes.
- Verifique se o provider Email está habilitado.

**Loop infinito de redirecionamento após login**
- Verifique a ordem dos listeners em `useAuth`: `onAuthStateChange` deve ser registrado **antes** de `getSession()`.
- Nunca chame funções `async` diretamente dentro do callback de `onAuthStateChange` — use `setTimeout(() => {...}, 0)`.

**Reset de senha falha silenciosamente**
- Tokens de recuperação expiram em **30 minutos**. Solicite um novo link.
- A URL de redirect deve estar listada em **Authentication → URL Configuration → Redirect URLs**.
- Mensagens genéricas são intencionais (anti-enumeração) — verifique os logs do Supabase para detalhes.

**`AuthSessionMissingError`**
- Garanta que `persistSession: true` e `autoRefreshToken: true` estão configurados no client Supabase.
- Limpe `localStorage` e faça login novamente.

### 🛡️ RLS (Row Level Security)

**`new row violates row-level security policy`**
- Confirme que o `INSERT` define **explicitamente** `user_id` e `organization_id` com os valores do usuário autenticado.
- Esses campos **não devem ser nullable** quando usados em policies.
- Confirme que o usuário pertence à organização (tabela `organization_members`).

**Query retorna array vazio mesmo com dados existentes**
- A RLS está filtrando — verifique a policy de `SELECT` para a tabela.
- Confirme que `auth.uid()` está disponível (usuário autenticado, não anônimo).
- Para checagem de role, **sempre** use a função `has_role(auth.uid(), 'admin')` — nunca consulte `user_roles` diretamente em policies (causa recursão).

**Recursão infinita em policy (`infinite recursion detected`)**
- Substitua subqueries em `user_roles` ou `organization_members` por funções `SECURITY DEFINER`.
- Exemplo: `public.has_role()`, `public.is_org_member()`.

**Limite de 1000 linhas**
- Use `.range(start, end)` para paginação. O limite padrão do PostgREST é 1000 linhas por query.

### 🧪 Testes (Vitest / E2E)

**`ReferenceError: IS_REACT_ACT_ENVIRONMENT is not defined`**
- Adicione `globalThis.IS_REACT_ACT_ENVIRONMENT = true;` em `src/test/setup.ts`.

**`Cannot find module '@/...'` nos testes**
- Confirme que `vitest.config.ts` possui o alias `@` apontando para `./src`.

**Testes E2E falham com `useNavigate must be used within a Router`**
- Envolva o componente em `<MemoryRouter>` (use o helper `renderWithProviders` em `src/test/helpers.tsx`).

**Testes que dependem do Supabase falham com `fetch is not defined` ou erros de rede**
- Faça mock do client: `vi.mock('@/integrations/supabase/client')`.
- Nunca chame Supabase real em testes unitários.

**Timeouts em testes assíncronos**
- Use `await waitFor(() => expect(...))` em vez de `setTimeout`.
- Aumente o timeout pontualmente: `it('...', async () => {...}, 10000)`.

### 🏗️ Build / Dev

**`Module not found` após instalar dependência**
- Reinicie o dev server. Dependências novas exigem reload do Vite.

**TypeScript: `Cannot find name 'X'` em arquivos do Supabase**
- Não edite `src/integrations/supabase/types.ts` manualmente — ele é regenerado a partir do schema.
- Após alterar o schema, aguarde a regeneração automática dos tipos.

**Build falha com `Out of memory`**
- Aumente o heap do Node: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`.

**HMR não atualiza o navegador**
- Limpe o cache do Vite: `rm -rf node_modules/.vite && npm run dev`.
- Verifique se há erros de sintaxe bloqueando o reload no terminal.

**Erro em produção mas não em dev**
- Rode `npm run build && npm run preview` localmente para reproduzir.
- Confira variáveis `VITE_*` — apenas variáveis com esse prefixo são expostas ao client.

### ⚡ Edge Functions

**`401 Unauthorized` ao chamar edge function**
- Use a **anon key** (`VITE_SUPABASE_PUBLISHABLE_KEY`) no client, **nunca** a `service_role_key`.
- Dentro da função, use `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` para operações privilegiadas.

**Secret retorna `undefined` na edge function**
- Adicione o secret em **Supabase → Edge Functions → Settings**.
- Após adicionar, a função é redeployada automaticamente — aguarde alguns segundos.

**CORS bloqueando chamadas**
- Inclua os headers `Access-Control-Allow-Origin: *` e trate o método `OPTIONS` no início do handler.

---

## 📄 Licença

Projeto proprietário. Todos os direitos reservados.
