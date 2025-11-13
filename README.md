# Chatbot Multi-Provider com Autenticação e Persistência

## Descrição

Plataforma completa de chatbot com suporte para múltiplos providers (OpenAI, Google Gemini, Anthropic Claude), sistema de autenticação com JWT, persistência de conversas em PostgreSQL, encriptação de API keys, e containerização Docker.

## Pré-requisitos

- Docker e Docker Compose instalados
- Contas com API keys dos providers desejados (OpenAI, Gemini, Claude)

## Execução com Docker

### Opção 1: Docker Compose (Recomendado)

```bash
docker-compose up --build
```

Isto irá iniciar:
- PostgreSQL na porta 5432
- Backend na porta 3001
- Frontend na porta 3000

O serviço Postgres é construído a partir do Dockerfile em `database/`, que aplica automaticamente o esquema necessário na primeira inicialização.

### Opção 2: Desenvolvimento Local

#### Backend

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

> **Nota:** `npm run prisma:push` necessita de uma instância PostgreSQL acessível (ver secção seguinte). Em produção utilize migrações (`npm run prisma:migrate`).

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

#### Base de Dados

Certifique-se que tem PostgreSQL rodando localmente ou use Docker:

```bash
docker build -t chatbot-postgres database
docker run -d -p 5432:5432 chatbot-postgres
```

## Funcionalidades

### Autenticação
- **Registo de utilizadores**: Criar conta com email e password
- **Verificação de email**: Contas novas permanecem inativas até confirmação via link enviado
- **Login**: Autenticação com JWT (sessão de 3 horas)
- **Política de password**: Mínimo 10 caracteres, incluindo maiúsculas, minúsculas, números e símbolos
- **Recuperação de password**: Sistema de reset por email
- **Refresh automático**: Token renovado automaticamente quando o utilizador está ativo

### Múltiplos Providers
- **OpenAI**: Suporte para modelos GPT (incluindo GPT-5) com pesquisa na web nativa
- **Google Gemini**: Modelos Gemini 2.5 Flash e Pro
- **Anthropic Claude**: Modelos Claude 3.5 Sonnet e variantes

### Gestão de API Keys
- **Encriptação AES-256-GCM**: Todas as API keys são encriptadas na base de dados
- **Gestão por utilizador**: Cada utilizador tem as suas próprias keys
- **Interface Settings**: Página dedicada para configurar keys de cada provider

### Persistência de Conversas
- **Histórico completo**: Todas as conversas são guardadas na base de dados
- **Sidebar de conversas**: Lista todas as conversas do utilizador
- **Edição de títulos**: Renomear conversas
- **Eliminação**: Apagar conversas indesejadas
- **Seleção de conversa**: Carregar mensagens ao clicar numa conversa

### Interface de Chat
- **Textarea expansível**: Caixa de texto com suporte a múltiplas linhas
- **Quebra de linha**: Shift+Enter para nova linha, Enter para enviar
- **Formatação avançada**: 
  - Títulos com cores diferentes (H1, H2, H3)
  - Listas formatadas
  - Texto em negrito e sublinhado
  - Links clicáveis com nome do domínio
- **Auto-scroll**: Scroll automático para novas mensagens
- **Billing Stripe**: Subscrição Pro com trial de 2 dias gerida via Stripe Checkout

## Uso

1. Aceda a `http://localhost:3000`
2. Crie uma conta ou faça login
3. Configure as suas API keys em Settings
4. Selecione um provider e modelo no Chat
5. Comece a conversar - as mensagens serão guardadas automaticamente
6. Use a sidebar para navegar entre conversas anteriores

### Fluxo de Verificação de Email

1. Submeta o formulário de registo; receberá uma mensagem a confirmar o envio do email de verificação.
2. Abra o email enviado (mockado no backend via `console.info`) e siga o link `verify-email` fornecido.
3. O frontend executa a chamada `POST /auth/verify-email` com o token. Em alternativa, faça a chamada manualmente via `curl` ou cliente HTTP.
4. Após verificação com sucesso, inicie sessão normalmente.

> Dica: defina `APP_BASE_URL` no backend para que o link gerado aponte para o domínio correto do frontend.

## Estrutura do Projeto

```
.
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   ├── providers/
│   │   │   ├── openaiClient.ts
│   │   │   ├── geminiClient.ts
│   │   │   └── claudeClient.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── apiKeys.ts
│   │   │   ├── conversations.ts
│   │   │   ├── models.ts
│   │   │   ├── billing.ts
│   │   │   └── stripeWebhook.ts
│   │   ├── services/
│   │   │   ├── emailService.ts
│   │   │   └── encryptionService.ts
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── src/
    │   ├── components/
    │   │   ├── Chat.tsx
    │   │   ├── ProviderSelector.tsx
    │   │   ├── ModelSelect.tsx
    │   │   └── ConversationSidebar.tsx
    │   ├── pages/
    │   │   ├── Login.tsx
    │   │   ├── Register.tsx
    │   │   ├── RecoverPassword.tsx
    │   │   └── Settings.tsx
    │   ├── context/
    │   │   └── AuthContext.tsx
    │   ├── services/
    │   │   └── api.ts
    │   ├── App.tsx
    │   ├── index.tsx
    │   └── index.css
    ├── index.html
    ├── package.json
    └── vite.config.ts
```

## Tecnologias

- **Backend**: Node.js, Express, TypeScript, PostgreSQL, JWT, bcrypt, AES-256-GCM
- **Frontend**: React, TypeScript, Vite, Axios
- **Database**: PostgreSQL 16
- **Containerização**: Docker, Docker Compose, Nginx

## Variáveis de Ambiente

Crie um ficheiro `.env` na raiz para produção:

```
DATABASE_URL=postgresql://chatbot:chatbot@localhost:5432/chatbot
JWT_SECRET=seu-jwt-secret-seguro
ACCESS_SIGNATURE=sig_f5e1d2c4a7b94f6e8c3d1a2b709c4e6
ENCRYPTION_KEY=sua-chave-de-32-bytes-para-encriptacao
APP_BASE_URL=http://localhost:3000
STRIPE_SECRET_KEY=sua-chave-secreta-stripe
STRIPE_PRICE_ID=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_SUCCESS_URL=http://localhost:3000/billing-success
STRIPE_CANCEL_URL=http://localhost:3000/billing-cancel
STRIPE_PORTAL_RETURN_URL=http://localhost:3000/settings
```

Estas variáveis também podem ser definidas para `docker-compose` (ver `docker-compose.yml`).

## Prisma & Base de Dados

- Gerar o cliente Prisma após instalar dependências:

  ```bash
  cd backend
  npm run prisma:generate
  ```

- Aplicar o schema ao ambiente de desenvolvimento (cria/atualiza tabelas conforme o modelo atual):

  ```bash
  npm run prisma:push
  ```

- Para ambientes controlados use as migrações versionadas. A migração principal de normalização encontra-se em `backend/prisma/migrations/20251111_normalize_subscriptions/migration.sql`.
  - Execute-a manualmente em bases legadas para copiar dados de `users` para as novas tabelas (`plans`, `user_subscriptions`, `stripe_customers`, `stripe_subscriptions`, `subscription_events`) antes de remover colunas antigas.

- Após atualizações de schema, reconstruir o backend:

  ```bash
  npm run build
  ```

## Stripe Billing

- Crie no Stripe um produto "MyChatbot Pro" com preço recorrente mensal de 5 €.
- Ative o período experimental (trial) de 2 dias no preço ou configure manualmente ao criar a subscrição (já aplicado no backend).
- Ajuste `STRIPE_PRICE_ID` com o ID do preço criado.
- Defina URLs de sucesso/cancelamento para corresponder ao frontend (por padrão `http://localhost:3000/...`).
- Para receber webhooks em desenvolvimento, utilize o Stripe CLI:

  ```bash
  stripe listen --forward-to localhost:3001/api/stripe/webhook
  ```

- Garanta que o valor exibido (`STRIPE_WEBHOOK_SECRET`) corresponde ao segredo gerado pelo comando anterior.
- O backend sincroniza clientes, subscrições e eventos Stripe em tabelas dedicadas (`plans`, `user_subscriptions`, `stripe_customers`, `stripe_subscriptions`, `subscription_events`) utilizando Prisma.

### Fluxo de Subscrição

1. Utilizador em trial seleciona **Upgrade** (sidebar ou página de Settings) → backend cria sessão de Checkout com trial de 2 dias.
2. Após pagamento, o webhook `checkout.session.completed` guarda o `subscription_id` e associa o cliente Stripe.
3. Eventos `customer.subscription.*` atualizam automaticamente o plano, status e datas do período atual.
4. Utilizadores Pro podem abrir o **Portal de Billing** para gerir/cancelar a subscrição.

## Segurança

- Todas as passwords são hasheadas com bcrypt
- API keys são encriptadas com AES-256-GCM antes de serem guardadas
- JWT tokens expiram após 3 horas
- Middleware de autenticação protege todas as rotas sensíveis
- Refresh tokens automáticos mantêm sessões ativas
- Políticas de password e verificação de email evitam criação de contas fracas ou não confirmadas
- Access tokens incluem uma assinatura secreta (`sig`) validada em todas as rotas protegidas

## Testes Manuais Recomendados

1. **Registo**: Introduza dados válidos e confirme que recebe a mensagem para verificar o email.
2. **Login bloqueado**: Tente iniciar sessão antes de verificar o email e confirme a resposta `403`.
3. **Verificação**: Execute `POST /auth/verify-email` com o token e verifique a resposta com JWT.
4. **Password fraca**: Teste passwords que falham cada regra e confirme o erro apresentado no frontend e backend.
5. **Reset de password**: Solicite `recover`, obtenha o token e confirme que o endpoint `/auth/reset` rejeita passwords fracas e aceita uma forte.

