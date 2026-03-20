# AGENTS.md — Mychatbot

> Ponto de entrada para qualquer agente de IA neste repositório.
> É um índice — não um manual. O detalhe vive em `docs/`.
> Lê sempre o ficheiro `docs/` relevante antes de alterar qualquer área.

---

## O que é este projecto

Plataforma SaaS de chatbot multi-provider (OpenAI, Google Gemini, Anthropic Claude) com:
- Autenticação JWT + verificação de email + recuperação de password
- Persistência de conversas em PostgreSQL via Prisma
- API keys por utilizador com encriptação AES-256-GCM
- Subscrições Stripe (EUR 5/mês, trial 2 dias)
- Deploy em Docker + Nginx

URL de produção: `https://multiproviderai.me`
Stack principal: Node.js · Express · TypeScript · React · PostgreSQL · Prisma · Docker

---

## Mapa do repositório

```
.
├── AGENTS.md               ← estás aqui (índice)
├── docs/
│   ├── architecture.md     ← stack, fluxos, decisões de design
│   ├── auth.md             ← JWT, registo, verificação, reset de password
│   ├── billing.md          ← Stripe, planos, webhooks, backfill
│   ├── providers.md        ← OpenAI/Gemini/Claude, contrato de interface
│   ├── database.md         ← schema Prisma, encriptação, migrações
│   └── conventions.md      ← naming, HTTP, logging, commits
├── backend/src/
│   ├── config/             ← Prisma singleton
│   ├── middleware/         ← auth JWT
│   ├── providers/          ← clientes OpenAI, Gemini, Claude
│   ├── routes/             ← auth, apiKeys, conversations, models, billing, stripeWebhook
│   ├── services/           ← emailService, encryptionService
│   └── server.ts
├── frontend/src/
│   ├── components/         ← Chat, ProviderSelector, ModelSelect, ConversationSidebar
│   ├── pages/              ← Login, Register, RecoverPassword, Settings
│   ├── context/            ← AuthContext
│   ├── services/           ← api.ts (único ponto de acesso ao backend)
│   └── App.tsx
├── database/               ← Dockerfile PostgreSQL
├── docker-compose.yml
└── env.example             ← todas as variáveis necessárias
```

---

## Antes de alterar qualquer coisa

| Se vais tocar em...            | Lê primeiro                  |
|--------------------------------|------------------------------|
| Auth, JWT, login, registo      | `docs/auth.md`               |
| Stripe, planos, subscrições    | `docs/billing.md`            |
| OpenAI / Gemini / Claude       | `docs/providers.md`          |
| Schema Prisma, base de dados   | `docs/database.md`           |
| Encriptação de API keys        | `docs/database.md`           |
| Estrutura geral, novos módulos | `docs/architecture.md`       |
| Naming, logging, HTTP codes    | `docs/conventions.md`        |

---

## Fronteiras entre camadas — enforçadas por CI

```
routes/     →  services/, middleware/, config/
services/   →  config/, providers/
providers/  →  config/
frontend/   →  services/api.ts  (nunca backend directamente)
```

Violações destas fronteiras são bugs de arquitectura — não preferências de estilo.
O CI verifica automaticamente com ESLint import rules.

---

## Convenções rápidas

- Erros de autenticação: sempre `401` ou `403` — nunca `500`.
- Erros de provider externo: `502`.
- Formato de erro: `{ "error": "mensagem" }`.
- API keys: **nunca logar** — nem em desenvolvimento.
- `any` em TypeScript: requer comentário de justificação.
- Commits em inglês: `tipo(âmbito): descrição`.

---

## Comandos essenciais

```bash
# Backend
cd backend && npm run dev              # desenvolvimento local
cd backend && npm run type-check       # verificar tipos (sem compilar)
cd backend && npm run lint             # ESLint
cd backend && npm run build            # compilar para produção
cd backend && npm run prisma:generate  # regenerar cliente Prisma
cd backend && npm run prisma:push      # aplicar schema (só dev)
cd backend && npm run prisma:migrate   # migrações versionadas (produção)

# Frontend
cd frontend && npm run dev             # desenvolvimento local
cd frontend && npm run type-check      # verificar tipos
cd frontend && npm run build           # build produção

# Docker
docker-compose up --build              # arrancar todos os serviços
docker-compose down -v                 # parar e limpar volumes

# Stripe (desenvolvimento)
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

---

## Áreas de alto risco — revisão humana obrigatória

| Ficheiro                            | Porquê                                          |
|-------------------------------------|-------------------------------------------------|
| `services/encryptionService.ts`     | Mudar quebra todas as API keys guardadas        |
| `middleware/auth.ts`                | Mudar ACCESS_SIGNATURE invalida todas as sessões|
| `routes/stripeWebhook.ts`           | Idempotência — bugs causam cobranças erradas    |
| `prisma/schema.prisma`              | Migrações mal feitas perdem dados               |

---

## O que NÃO fazer

- Lógica de negócio em `routes/` — vai para `services/`.
- Chamar providers directamente de rotas — vai via service.
- Logar tokens, passwords ou API keys.
- Alterar `ENCRYPTION_KEY` sem processo de re-encriptação.
- Usar `prisma:push` em produção.
- Criar `PrismaClient` fora de `config/database.ts`.
- Fazer `fetch`/`axios` directamente num componente React.
