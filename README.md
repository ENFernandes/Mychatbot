# Multi-Provider Chatbot with Authentication and Persistence

## Description

Full chatbot platform with native support for multiple providers (OpenAI, Google Gemini, Anthropic Claude), JWT-based authentication, PostgreSQL conversation persistence, API key encryption, and Docker-based containerization.

## Prerequisites

- Docker and Docker Compose installed
- Accounts with API keys for the desired providers (OpenAI, Gemini, Claude)

## Run with Docker

### Option 1: Docker Compose (Recommended)

```
docker-compose up --build
```

This starts:
- PostgreSQL on port 5432
- Backend on port 3001
- Frontend on port 3000

The Postgres service is built from the Dockerfile in `database/` and automatically applies the required schema on first boot.

### Option 2: Local Development

#### Backend

```
cd backend
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

> **Note:** `npm run prisma:push` needs an accessible PostgreSQL instance (see next section). Use migrations in production (`npm run prisma:migrate`).

#### Frontend

```
cd frontend
npm install
npm run dev
```

#### Database

Ensure PostgreSQL is running locally or spin it up with Docker:

```
docker build -t chatbot-postgres database
docker run -d -p 5432:5432 chatbot-postgres
```

## Features

### Authentication
- **User registration**: Create an account with email and password
- **Email verification**: New accounts stay inactive until the user confirms via a link
- **Login**: JWT authentication with 3-hour sessions
- **Password policy**: Minimum 10 characters with uppercase, lowercase, digits, and symbols
- **Password recovery**: Email-based reset flow
- **Automatic refresh**: Token refreshes automatically while the user is active

### Multiple Providers
- **OpenAI**: GPT models (including GPT-5) with built-in web search
- **Google Gemini**: Gemini 2.5 Flash and Pro models
- **Anthropic Claude**: Claude 3.5 Sonnet and variants

### API Key Management
- **AES-256-GCM encryption**: All API keys are encrypted at rest
- **Per-user management**: Each user supplies their own keys
- **Settings UI**: Dedicated page to configure provider keys

### Conversation Persistence
- **Full history**: All conversations are stored in the database
- **Conversation sidebar**: Lists every thread for the current user
- **Title editing**: Rename conversations
- **Deletion**: Remove unwanted threads
- **Conversation selection**: Load past messages by clicking a conversation

### Chat Interface
- **Expandable textarea**: Multi-line input field
- **Line breaks**: Shift+Enter inserts a newline; Enter sends the message
- **Rich formatting**: 
  - Colored headings (H1, H2, H3)
  - Styled lists
  - Bold and underlined text
  - Clickable links displaying domain names
- **Auto-scroll**: Scrolls to the latest message automatically
- **Stripe billing**: Pro subscription with a 4-hours trial via Stripe Checkout

## Usage

1. Visit `http://localhost:3000`
2. Register or log in
3. Configure your API keys in Settings
4. Choose a provider and model in Chat
5. Start chatting—messages persist automatically
6. Use the sidebar to revisit previous conversations

### Email Verification Flow

1. Submit the registration form; the UI confirms the verification email was sent.
2. Open the email (mocked in the backend via `console.info`) and follow the `verify-email` link.
3. The frontend calls `POST /auth/verify-email` with the token. You can call it manually via `curl` or any HTTP client.
4. After a successful verification, log in normally.

> Tip: set `APP_BASE_URL` in the backend so verification links point to the correct frontend domain.

### Transactional Emails (Resend)

The project relies on [Resend](https://resend.mintlify.dev/docs/introduction) for transactional email delivery:

1. Create a Resend account and add the `multiproviderai.me` domain.
2. Publish the suggested DNS records (SPF, DKIM, tracking) and wait for validation.
3. Create an API key with send permissions.
4. Set `noreply@multiproviderai.me` as the primary sender and optionally a reply-to (for example `support@multiproviderai.me`).
5. Configure `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, and optionally `RESEND_REPLY_TO` in the backend.
6. Set `APP_BASE_URL` to the public domain (prod: `https://multiproviderai.me`) so verification and recovery links target the correct frontend.

With this setup enabled:

- Verification email during registration (`/auth/register`)
- Password recovery email (`/auth/recover`)

## Project Structure

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

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, PostgreSQL, JWT, bcrypt, AES-256-GCM
- **Frontend**: React, TypeScript, Vite, Axios
- **Database**: PostgreSQL 16
- **Containerization**: Docker, Docker Compose, Nginx

## Environment Variables

Create a `.env` file at the project root for production:

```
DATABASE_URL=postgresql://chatbot:chatbot@localhost:5432/chatbot
JWT_SECRET=your-secure-jwt-secret
ACCESS_SIGNATURE=sig_f5e1d2c4a7b94f6e8c3d1a2b709c4e6
ENCRYPTION_KEY=your-32-byte-encryption-key
APP_BASE_URL=http://localhost:3000
RESEND_API_KEY=your-resend-token
RESEND_FROM_EMAIL=noreply@multiproviderai.me
RESEND_FROM_NAME=Multiprovider AI
RESEND_REPLY_TO=support@multiproviderai.me
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_PRICE_ID=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_SUCCESS_URL=http://localhost:3000/billing-success
STRIPE_CANCEL_URL=http://localhost:3000/billing-cancel
STRIPE_PORTAL_RETURN_URL=http://localhost:3000/settings
```

These variables can also be provided to `docker-compose` (see `docker-compose.yml`).

> **Note:** `RESEND_REPLY_TO` is optional; if omitted, emails use only the primary sender `noreply@multiproviderai.me`.

## Prisma & Database

- Generate the Prisma client after installing dependencies:

  ```
  cd backend
  npm run prisma:generate
  ```

- Push the schema to the development environment (creates/updates tables to match the current model):

  ```
  npm run prisma:push
  ```

- For controlled environments rely on versioned migrations. The normalization migration lives at `backend/prisma/migrations/20251111_normalize_subscriptions/migration.sql`.
  - Run it manually on legacy databases to copy data from `users` into the new tables (`plans`, `user_subscriptions`, `stripe_customers`, `stripe_subscriptions`, `subscription_events`) before dropping old columns.

- Rebuild the backend after schema changes:

  ```
  npm run build
  ```

## Stripe Billing

- Create a Stripe product named "MyChatbot Pro" with a recurring monthly price of EUR 5.
- Enable a 2-day trial on the price or configure it manually while creating the subscription (already handled in the backend).
- Set `STRIPE_PRICE_ID` to the price ID you just created.
- Configure success/cancel URLs to match the frontend (defaults to `http://localhost:3000/...`).
- To receive webhooks during development, use the Stripe CLI:

  ```
  stripe listen --forward-to localhost:3001/api/stripe/webhook
  ```

- Ensure `STRIPE_WEBHOOK_SECRET` matches the secret shown by the command above.
- The backend syncs Stripe customers, subscriptions, and events into dedicated tables (`plans`, `user_subscriptions`, `stripe_customers`, `stripe_subscriptions`, `subscription_events`) via Prisma.

### Subscription Flow

1. Trial users click **Upgrade** (sidebar or Settings page) → backend creates a Checkout session with a 2-day trial.
2. After payment, the `checkout.session.completed` webhook stores the `subscription_id` and links the Stripe customer.
3. `customer.subscription.*` events automatically update plan, status, and period dates.
4. Pro users can open the **Billing Portal** to manage or cancel the subscription.

## Security

- Passwords hashed with bcrypt
- API keys encrypted with AES-256-GCM before storage
- JWT tokens expire after 3 hours
- Auth middleware protects sensitive routes
- Automatic refresh tokens keep active sessions alive
- Password policy and email verification block weak or unconfirmed accounts
- Access tokens include a secret signature (`sig`) validated on every protected route

## Recommended Manual Tests

1. **Registration**: Submit valid data and confirm the verification email notice appears.
2. **Blocked login**: Attempt to log in before verifying the email and confirm the `403` response.
3. **Verification**: Call `POST /auth/verify-email` with the token and confirm the JWT response.
4. **Weak password**: Try passwords that violate each rule and confirm both frontend and backend errors.
5. **Password reset**: Request `recover`, capture the token, and confirm `/auth/reset` rejects weak passwords but accepts a strong one.
6. **Stripe subscription**: Start Checkout, finish payment, verify the webhook, and open the billing portal to cancel.
