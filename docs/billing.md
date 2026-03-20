# Billing

## Visão geral

O sistema de billing usa Stripe para gerir subscrições mensais (EUR 5/mês) com trial de 2 dias.
Os dados de subscrição são sincronizados em tabelas dedicadas via Prisma.

---

## Planos

| Plano   | Código    | Descrição                              |
|---------|-----------|----------------------------------------|
| Trial   | `trial`   | 2 dias gratuitos após registo          |
| Pro     | `pro`     | EUR 5/mês via Stripe                   |

O plano actual do utilizador é devolvido em `GET /api/auth/me` no campo `plan`.

---

## Tabelas de billing (Prisma)

```
plans                    → catálogo de planos disponíveis
user_subscriptions       → subscrição activa por utilizador
stripe_customers         → mapeamento utilizador ↔ Stripe customer ID
stripe_subscriptions     → subscrições Stripe em detalhe
subscription_events      → log de todos os eventos Stripe recebidos
```

**Regra:** Nunca alterar o estado de subscrição directamente nas tabelas. Toda a mutação deve passar pelos webhooks Stripe ou pelo serviço de billing.

---

## Fluxo de upgrade (trial → pro)

```
Utilizador clica "Upgrade"
        ↓
POST /api/billing/checkout
  → backend cria Stripe Checkout Session com trial de 2 dias
  → retorna URL do Checkout
        ↓
Utilizador completa pagamento no Stripe
        ↓
Stripe envia webhook: checkout.session.completed
  → backend busca subscrição no Stripe
  → actualiza user_subscriptions para plan_code='pro'
  → cria/actualiza stripe_subscriptions
        ↓
Utilizador é imediatamente PRO (não espera próximo ciclo)
```

**Crítico:** O upgrade deve acontecer no handler do `checkout.session.completed`, não no redirect do Stripe. O redirect pode falhar; o webhook é a fonte de verdade.

---

## Webhooks Stripe

Ficheiro: `backend/src/routes/stripeWebhook.ts`

Eventos tratados:

| Evento                              | Acção                                    |
|-------------------------------------|------------------------------------------|
| `checkout.session.completed`        | Upgrade imediato para PRO                |
| `customer.subscription.updated`     | Actualizar plan, status, period dates    |
| `customer.subscription.deleted`     | Fazer downgrade / cancelar               |
| `invoice.payment_failed`            | Marcar subscrição como past_due          |

**Idempotência:** Todos os handlers são idempotentes — processar o mesmo evento duas vezes não corrompe dados. Isto é essencial porque o Stripe pode reenviar eventos.

**Validação:** Cada webhook é validado com `STRIPE_WEBHOOK_SECRET` antes de ser processado. Pedidos sem assinatura válida retornam `400`.

---

## Portal de billing

```
POST /api/billing/portal
  → backend cria Stripe Billing Portal Session
  → retorna URL do portal
```

Permite ao utilizador PRO gerir ou cancelar a subscrição directamente no Stripe.

---

## Variáveis de ambiente necessárias

```
STRIPE_SECRET_KEY        → chave secreta Stripe
STRIPE_PRICE_ID          → ID do preço (price_xxx)
STRIPE_WEBHOOK_SECRET    → segredo de validação de webhooks (whsec_xxx)
STRIPE_SUCCESS_URL       → URL de redirect após pagamento bem-sucedido
STRIPE_CANCEL_URL        → URL de redirect após cancelamento no Checkout
STRIPE_PORTAL_RETURN_URL → URL de regresso após fechar o portal
```

---

## Desenvolvimento local com webhooks

```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

O `STRIPE_WEBHOOK_SECRET` para desenvolvimento é mostrado pelo comando acima. **Não é o mesmo que produção.**

---

## Script de backfill

Se utilizadores pagaram durante o trial mas não foram actualizados (webhook em falta):

```bash
cd backend
npx ts-node scripts/backfill-stripe-subscriptions.ts
```

**Atenção:** Correr em staging antes de produção. Requer `STRIPE_SECRET_KEY` e `DATABASE_URL`.

---

## O que NÃO alterar sem revisão

- A lógica de idempotência nos webhooks — risco de dupla cobrança ou upgrades duplicados.
- O mapeamento `checkout.session.completed` → upgrade imediato — é o único ponto onde o utilizador muda de plano após pagamento.
- As tabelas de billing — qualquer alteração de schema requer migração versionada.
