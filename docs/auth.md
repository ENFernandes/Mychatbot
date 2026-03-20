# Auth

## Visão geral

O sistema de autenticação cobre registo, verificação de email, login, refresh automático de sessão e recuperação de password. Todas as rotas vivem em `backend/src/routes/auth.ts`.

---

## Fluxo de registo

```
POST /auth/register
        ↓
Validar password policy (10+ chars, upper, lower, dígito, símbolo)
        ↓
Hash da password com bcrypt
        ↓
Criar utilizador com status inactivo
        ↓
Gerar token de verificação
        ↓
Enviar email via Resend (link /verify-email?token=...)
        ↓
Resposta: 201 + mensagem de confirmação (sem JWT ainda)
```

**Regra importante:** O utilizador não consegue fazer login enquanto o email não estiver verificado. Retorna `403` com mensagem genérica.

---

## Fluxo de login

```
POST /auth/login
        ↓
Verificar email + password (bcrypt.compare)
        ↓
Verificar que conta está activa (email verificado)
        ↓
Gerar access token JWT (3h) com payload:
  { userId, email, plan, sig: ACCESS_SIGNATURE }
        ↓
Resposta: 200 + { token, user }
```

**ACCESS_SIGNATURE:** Campo adicional no payload do JWT que é validado em cada rota protegida pelo middleware `auth.ts`. Permite invalidar todos os tokens existentes mudando a variável de ambiente, sem precisar de base de dados de tokens revogados.

---

## Middleware de autenticação

Ficheiro: `backend/src/middleware/auth.ts`

Valida em cada pedido protegido:
1. Header `Authorization: Bearer <token>` presente
2. Token JWT válido e não expirado
3. Campo `sig` do payload == `ACCESS_SIGNATURE` da env
4. Utilizador existe na base de dados

Se qualquer validação falhar → `401 Unauthorized`.

---

## Fluxo de verificação de email

```
GET /auth/verify-email?token=...
        ↓
Validar token (existe + não expirado)
        ↓
Marcar utilizador como activo
        ↓
Resposta: 200 + JWT (utilizador fica logo autenticado)
```

---

## Fluxo de recuperação de password

```
POST /auth/recover
  body: { name, email }
        ↓
Validar que name + email correspondem ao mesmo utilizador
(resposta genérica se não corresponder — previne enumeração)
        ↓
Gerar token de reset (expira em 1h)
        ↓
Enviar email com link /reset-password?token=...

POST /auth/reset
  body: { token, newPassword }
        ↓
Validar token (existe + não expirado)
        ↓
Validar nova password policy
        ↓
Hash da nova password com bcrypt
        ↓
Invalidar token de reset
        ↓
Resposta: 200
```

**Nota de segurança:** A validação de nome + email antes de enviar o email de recuperação é deliberada — evita que alguém descubra se um email está registado apenas pelo comportamento da resposta.

---

## Password policy

Mínimo 10 caracteres com:
- Pelo menos uma letra maiúscula
- Pelo menos uma letra minúscula
- Pelo menos um dígito
- Pelo menos um símbolo

Esta validação existe tanto no frontend (UX imediato) como no backend (segurança).

---

## Refresh automático de sessão

O frontend detecta tokens próximos de expirar e faz refresh silencioso enquanto o utilizador está activo. Implementado em `frontend/src/context/AuthContext.tsx`.

---

## Códigos de resposta

| Situação                         | Código |
|----------------------------------|--------|
| Login bem-sucedido               | 200    |
| Registo bem-sucedido             | 201    |
| Email não verificado             | 403    |
| Token inválido ou expirado       | 401    |
| Credenciais incorrectas          | 401    |
| Email já registado               | 409    |

---

## O que NÃO alterar sem revisão

- A lógica de `ACCESS_SIGNATURE` no middleware — quebra todas as sessões activas se mal implementada.
- O esquema de hash bcrypt — nunca reduzir os salt rounds.
- A validação de nome + email na recuperação — foi deliberada por razões de segurança.
