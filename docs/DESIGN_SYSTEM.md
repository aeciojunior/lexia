# LexIA Design System v3

Documentação interna de tokens, componentes e padrões de interface do LexIA.

**Visualização interativa:** acesse `/design-system` na aplicação (menu **Conta & Configurações → Design System**).

---

## Princípios

1. **Dark-first** — interface otimizada para uso prolongado em ambientes jurídicos
2. **Clareza assertiva** — hierarquia tipográfica forte, feedback visual imediato
3. **Acessibilidade** — foco visível, contraste adequado, labels semânticos
4. **Responsividade** — mobile-first no shell; grids adaptativos nas páginas
5. **Segurança percebida** — estados de erro/destrutivo consistentes, confirmações explícitas

---

## Tipografia

| Classe | Uso | Fonte |
|--------|-----|-------|
| `text-display-2xl` … `text-display-sm` | Títulos de página e seção | Outfit |
| `text-body-lg` … `text-body-sm` | Corpo de texto | Inter |
| `text-overline` | Rótulos de categoria (uppercase) | Inter |
| `text-caption` | Metadados, hints | Inter |
| `gradient-text` | Destaques de marca | — |

### Cabeçalho de página padronizado

Use o componente `LexPageHeader`:

```tsx
import { LexPageHeader } from "@/components/lexia/LexPageHeader";

<LexPageHeader
  overline="Gestão"
  title="Processos"
  description="Gerencie todos os seus processos judiciais"
  actions={<Button variant="hero">Novo</Button>}
/>
```

---

## Cores (tokens CSS)

Definidos em `src/index.css` como variáveis HSL:

| Token | Papel |
|-------|--------|
| `--primary` | Ação principal (Electric Cyan) |
| `--secondary` | IA / destaque secundário (Violet) |
| `--accent` | Sucesso / destaque terciário |
| `--destructive` | Erros e ações irreversíveis |
| `--muted` | Fundos sutis e texto secundário |
| `--success`, `--warning`, `--info` | Feedback semântico |

Escalas completas: `--primary-50` … `--primary-900`, `--neutral-*`.

---

## Superfícies e layout

| Utilitário | Descrição |
|------------|-----------|
| `.page-shell` | Container animado do conteúdo principal |
| `.surface-card` | Card com borda, blur e sombra leve |
| `.surface-interactive` | Card com hover elevado |
| `.input-field` | Input padronizado com focus ring |
| `.glass` / `.glass-strong` | Efeito vidro fosco |
| `.neon-border` | Borda ativa no menu lateral |

---

## Componentes LexIA

| Componente | Arquivo | Uso |
|------------|---------|-----|
| `LexPageHeader` | `components/lexia/LexPageHeader.tsx` | Cabeçalho de páginas |
| `LexSection` | idem | Blocos de conteúdo agrupados |
| `LexCard` | `components/lexia/LexCard.tsx` | Cards de dados |
| `LexBadge` | `components/lexia/LexBadge.tsx` | Status compactos |
| `LexLogo` | `components/lexia/LexLogo.tsx` | Marca |
| `RiskIndicator` | `components/lexia/LegalComponents.tsx` | Nível de risco processual |

---

## Navegação

Configuração centralizada em `src/lib/navigation.ts`:

- **12 categorias** com submenus colapsáveis
- **Busca** no sidebar
- **Favoritos** — fixar até 12 rotas (localStorage por usuário)
- **Permissões** — itens filtrados via `usePermissions`

### Fixar favorito

Passe o mouse sobre um item do menu e clique no ícone de pin. Favoritos aparecem no topo da sidebar.

Hook: `useNavFavorites(userId)` em `src/hooks/useNavFavorites.ts`.

---

## Botões

Variantes shadcn customizadas:

- `default` / `secondary` / `outline` / `ghost` / `destructive`
- `hero` — CTA principal com gradiente
- `hero-outline` — CTA secundário
- `ai` — ações de inteligência artificial

---

## Formulários

- Labels com `Label` + hint opcional
- Erros inline em vermelho (`text-destructive`)
- Campos obrigatórios marcados com `*`
- Validação antes do submit (ver `ProcessFormDialog` como referência)
- `maxLength` e máscaras (ex.: CNJ) quando aplicável

---

## Motion

- Entrada de página: `.page-shell` / `animate-fade-up`
- Durações: `--duration-fast` (150ms), `--duration-normal` (250ms)
- Respeitar `prefers-reduced-motion` em animações decorativas

---

## Responsividade

| Breakpoint | Comportamento |
|------------|---------------|
| `< md` | Menu em drawer (Sheet), header compacto |
| `md+` | Sidebar fixa recolhível |
| `lg+` | Grids de 2–4 colunas nas páginas |

---

## Contribuindo

1. Novas páginas internas devem usar `LexPageHeader`
2. Novos itens de menu → `src/lib/navigation.ts`
3. Novos tokens → `src/index.css` + `tailwind.config.ts`
4. Atualize esta documentação e a página `/design-system` ao alterar padrões visuais

---

*Última atualização: Design System v3 — navegação categorizada, favoritos e LexPageHeader.*
