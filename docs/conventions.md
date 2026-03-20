# Conventions

## Regras gerais

- TypeScript estrito em todo o projecto — `strict: true` no `tsconfig.json`.
- `any` explícito requer comentário que justifica a excepção.
- Imports absolutos no backend, relativos no frontend.
- Nenhum segredo ou chave hardcoded — sempre via variáveis de ambiente.

---

## Naming

| Contexto              | Convenção         | Exemplo                        |
|-----------------------|-------------------|--------------------------------|
| Ficheiros TypeScript  | camelCase         | `emailService.ts`              |
| Componentes React     | PascalCase        | `ConversationSidebar.tsx`      |
| Variáveis / funções   | camelCase         | `getUserById`                  |
| Constantes globais    | UPPER_SNAKE_CASE  | `MAX_TOKEN_LENGTH`             |
| Tabelas Prisma        | snake_case        | `user_subscriptions`           |
| Variáveis de ambiente | UPPER_SNAKE_CASE  | `JWT_SECRET`                   |
| Rotas HTTP            | kebab-case        | `/api/api-keys`                |
| Commits               | tipo: descrição   | `feat: add gemini streaming`   |

---

## Estrutura de respostas HTTP

### Sucesso
```json
{ "data": { ... } }          // recurso único
{ "data": [ ... ] }          // lista
{ "token": "...", "user": {} } // excepção: login/verify retornam directamente
```

### Erro
```json
{ "error": "mensagem legível por humano" }
```

### Códigos de estado usados

| Código | Quando usar                                          |
|--------|------------------------------------------------------|
| 200    | Sucesso geral                                        |
| 201    | Criação bem-sucedida                                 |
| 400    | Input inválido (validação falhou)                    |
| 401    | Não autenticado (token em falta ou inválido)         |
| 403    | Autenticado mas sem permissão (ex: email não verificado) |
| 404    | Recurso não encontrado                               |
| 409    | Conflito (ex: email já existe)                       |
| 500    | Erro interno inesperado                              |
| 502    | Erro de provider externo (OpenAI, Gemini, etc.)      |

**Nunca** retornar `500` para erros de autenticação — usar sempre `401` ou `403`.

---

## Logging

- Logs de desenvolvimento: `console.info`, `console.error` são aceitáveis.
- **Nunca** logar: tokens JWT, passwords, API keys, dados pessoais de utilizadores.
- Erros de provider: logar provider + modelo + código de erro, nunca a key.
- Formato sugerido: `[módulo] acção: detalhe` — ex: `[auth] login failed: email not verified`

---

## Tratamento de erros no backend

```typescript
// padrão nas rotas
try {
  // lógica
} catch (error) {
  console.error('[rota] contexto:', error);
  res.status(500).json({ error: 'Internal server error' });
}
```

Erros esperados (validação, auth) devem ser tratados explicitamente com o código correcto — não deixar cair no catch genérico.

---

## Frontend — regras de componentes

- Componentes em `components/` são reutilizáveis e não conhecem routing.
- Páginas em `pages/` conhecem routing mas delegam lógica a componentes.
- Todo o acesso HTTP passa por `services/api.ts` — nunca `fetch`/`axios` directamente num componente.
- Estado global de autenticação em `context/AuthContext.tsx`.
- Sem lógica de negócio em componentes — vai para hooks ou services.

---

## Commits

Formato: `tipo(âmbito opcional): descrição curta em inglês`

| Tipo       | Quando usar                                    |
|------------|------------------------------------------------|
| `feat`     | Nova funcionalidade                            |
| `fix`      | Correcção de bug                               |
| `docs`     | Documentação apenas                            |
| `refactor` | Refactoring sem mudança de comportamento       |
| `test`     | Adicionar ou corrigir testes                   |
| `chore`    | Configuração, dependências, CI                 |
| `security` | Correcção de segurança                         |

Exemplos:
```
feat(auth): add rate limiting to login endpoint
fix(billing): handle missing webhook secret gracefully
docs: update providers.md with Gemini 2.5 models
```

---

## O que o agente deve fazer quando encontra inconsistências

1. Se o código viola uma regra deste ficheiro, corrigir na mesma PR.
2. Se a regra não está clara para o caso em questão, adicionar uma nota em `docs/conventions.md` com a decisão tomada.
3. Se uma decisão de arquitectura foi alterada, actualizar o ficheiro `docs/` relevante na mesma PR que altera o código.
