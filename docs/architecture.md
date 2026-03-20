# Architecture

## Visão geral

O Mychatbot é uma plataforma SaaS de chatbot multi-provider com três camadas principais:

```
[Frontend React]  →  [Backend Express/Node]  →  [PostgreSQL]
      ↕                       ↕
  Vite/Nginx            Providers externos
                    (OpenAI, Gemini, Claude)
```

Todas as camadas correm em Docker via `docker-compose.yml`.

---

## Stack

| Camada      | Tecnologia                        | Versão / Notas                        |
|-------------|-----------------------------------|---------------------------------------|
| Frontend    | React + TypeScript + Vite         | Servido por Nginx em produção         |
| Backend     | Node.js + Express + TypeScript    | Porta 3001                            |
| ORM         | Prisma                            | Schema em `backend/prisma/`           |
| Base dados  | PostgreSQL 16                     | Porta 5432, Docker                    |
| Auth        | JWT (jsonwebtoken) + bcrypt       | Tokens de 3h com refresh automático  |
| Encriptação | AES-256-GCM                       | Para API keys em repouso              |
| Email       | Resend                            | Verificação e recuperação de password |
| Billing     | Stripe                            | Subscrição mensal EUR 5 + trial 2 dias|
| Container   | Docker + Docker Compose + Nginx   |                                       |

---

## Decisões de design e porquê

### 1. API keys encriptadas por utilizador (não partilhadas)
Cada utilizador fornece as suas próprias API keys para os providers. Estão encriptadas com AES-256-GCM antes de serem guardadas. Decisão deliberada: evita custos partilhados e mantém separação de responsabilidades.

**Implicação:** Nunca guardar keys em texto limpo. Nunca logar keys. Ver `docs/database.md` para detalhes da encriptação.

### 2. Separação routes / services / providers
As rotas (`routes/`) são finas — apenas validação de input e delegação. A lógica de negócio vive em `services/`. Os clientes de providers externos vivem em `providers/`. Esta separação permite testar services sem HTTP e trocar providers sem tocar em rotas.

### 3. JWT com access token + refresh automático
Sessões de 3 horas com refresh silencioso enquanto o utilizador está activo. O token inclui uma assinatura adicional (`ACCESS_SIGNATURE`) validada em cada rota protegida — camada extra de invalidação sem base de dados de tokens.

### 4. Schema Prisma como fonte de verdade
O schema Prisma define todos os modelos. Em desenvolvimento, `prisma:push` aplica mudanças directamente. Em produção, apenas migrações versionadas (`prisma:migrate`). Nunca alterar tabelas directamente na base de dados.

### 5. Frontend desacoplado via `services/api.ts`
Todo o acesso ao backend passa por `frontend/src/services/api.ts`. Componentes nunca fazem chamadas HTTP directas. Isto permite trocar a URL base ou adicionar interceptors num único lugar.

---

## Fluxo de um pedido de chat

```
Utilizador escreve mensagem
        ↓
Chat.tsx → api.ts (POST /api/conversations/:id/messages)
        ↓
auth middleware (valida JWT + ACCESS_SIGNATURE)
        ↓
conversations route → conversation service
        ↓
service desencripta API key do utilizador
        ↓
provider client (openaiClient / geminiClient / claudeClient)
        ↓
resposta streaming → frontend
        ↓
mensagem guardada em PostgreSQL via Prisma
```

---

## Estrutura de pastas — backend

```
backend/src/
├── config/
│   └── database.ts          # cliente Prisma singleton
├── middleware/
│   └── auth.ts              # validação JWT + ACCESS_SIGNATURE
├── providers/
│   ├── openaiClient.ts      # cliente OpenAI
│   ├── geminiClient.ts      # cliente Google Gemini
│   └── claudeClient.ts      # cliente Anthropic Claude
├── routes/
│   ├── auth.ts              # registo, login, verificação, reset
│   ├── apiKeys.ts           # CRUD de API keys do utilizador
│   ├── conversations.ts     # CRUD de conversas + mensagens
│   ├── models.ts            # listar modelos disponíveis por provider
│   ├── billing.ts           # Stripe checkout e portal
│   └── stripeWebhook.ts     # webhooks Stripe (idempotentes)
├── services/
│   ├── emailService.ts      # envio via Resend
│   └── encryptionService.ts # AES-256-GCM para API keys
└── server.ts                # ponto de entrada Express
```

---

## Variáveis de ambiente críticas

Ver `env.example` para a lista completa. As mais críticas:

- `JWT_SECRET` — nunca reutilizar entre ambientes
- `ACCESS_SIGNATURE` — assinatura adicional nos tokens
- `ENCRYPTION_KEY` — 32 bytes, para AES-256-GCM — se mudar, todas as keys guardadas ficam ilegíveis
- `STRIPE_WEBHOOK_SECRET` — validação de webhooks Stripe

---

## O que ainda não existe (áreas de melhoria)

- Testes automatizados (unitários e integração)
- Rate limiting por utilizador
- Observabilidade (logs estruturados, métricas)
- Sistema de roles/permissões além de trial/pro
- Cache de respostas
