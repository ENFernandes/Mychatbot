# Database

## Visão geral

PostgreSQL 16 gerido via Prisma ORM. O schema vive em `backend/prisma/schema.prisma`.
O cliente Prisma é um singleton em `backend/src/config/database.ts`.

---

## Tabelas principais

### Autenticação e utilizadores
```
users
  ├── id (uuid)
  ├── email (unique)
  ├── name
  ├── passwordHash
  ├── isActive (bool) — false até verificação de email
  ├── emailVerificationToken
  ├── passwordResetToken
  ├── passwordResetExpiry
  └── createdAt / updatedAt
```

### API Keys (encriptadas)
```
api_keys
  ├── id (uuid)
  ├── userId (FK → users)
  ├── provider (openai | gemini | claude)
  ├── encryptedKey (AES-256-GCM)
  └── createdAt / updatedAt
```

### Conversas e mensagens
```
conversations
  ├── id (uuid)
  ├── userId (FK → users)
  ├── title
  ├── provider
  ├── model
  └── createdAt / updatedAt

messages
  ├── id (uuid)
  ├── conversationId (FK → conversations)
  ├── role (user | assistant)
  ├── content (text)
  └── createdAt
```

### Billing (Stripe)
```
plans                    → catálogo: trial, pro
user_subscriptions       → subscrição activa por utilizador
stripe_customers         → userId ↔ Stripe customerId
stripe_subscriptions     → detalhe de cada subscrição Stripe
subscription_events      → log de eventos Stripe recebidos
```

---

## Encriptação de API keys

Implementação: `backend/src/services/encryptionService.ts`
Algoritmo: AES-256-GCM

Cada key é encriptada com:
- Uma chave mestre de 32 bytes (`ENCRYPTION_KEY` da env)
- Um IV aleatório por operação (incluído no valor guardado)
- Tag de autenticação GCM (garante integridade)

Formato guardado na base de dados: `iv:tag:ciphertext` (base64)

**CRÍTICO:** Se `ENCRYPTION_KEY` for alterada, **todas as API keys guardadas ficam ilegíveis**. Esta chave nunca deve ser rotacionada sem um processo de re-encriptação de todos os registos. Nunca alterar `encryptionService.ts` sem revisão humana.

---

## Migrações

### Desenvolvimento
```bash
cd backend
npm run prisma:push    # aplica schema directamente (sem histórico)
```

### Produção
```bash
cd backend
npm run prisma:migrate  # aplica migrações versionadas
```

**Regra:** Em produção, apenas migrações versionadas. `prisma:push` pode perder dados.

### Migração de normalização de billing
Existe uma migração manual em:
`backend/prisma/migrations/20251111_normalize_subscriptions/migration.sql`

Esta migração copia dados da tabela `users` para as novas tabelas de billing. Deve ser aplicada manualmente em bases de dados existentes antes de fazer deploy da versão que usa as novas tabelas.

---

## Conexão à base de dados

O cliente Prisma é um singleton para evitar múltiplas conexões em desenvolvimento (hot reload):

```typescript
// backend/src/config/database.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

Sempre importar `prisma` deste ficheiro — nunca instanciar `PrismaClient` directamente.

---

## Variáveis de ambiente

```
DATABASE_URL=postgresql://chatbot:chatbot@localhost:5432/chatbot
ENCRYPTION_KEY=<32 bytes em hex ou base64>
```

---

## Regras de modelação

- UUIDs como primary keys — nunca integers sequenciais.
- `createdAt` e `updatedAt` em todas as tabelas de entidade.
- Soft deletes não estão implementados — deleção é permanente.
- Foreign keys com CASCADE em conversas/mensagens (apagar conversa apaga mensagens).
- API keys: uma por provider por utilizador (constraint unique em userId + provider).
