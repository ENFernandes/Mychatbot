# Providers

## Visão geral

O sistema suporta múltiplos providers de IA em paralelo. Cada provider tem um cliente dedicado
em `backend/src/providers/`. As API keys são fornecidas pelo utilizador, encriptadas em repouso,
e desencriptadas apenas no momento de fazer o pedido ao provider.

---

## Providers actuais

| Provider          | Ficheiro             | Modelos suportados                        |
|-------------------|----------------------|-------------------------------------------|
| OpenAI            | `openaiClient.ts`    | GPT-4o, GPT-4, GPT-3.5, GPT-5 (web search incluso) |
| Google Gemini     | `geminiClient.ts`    | Gemini 2.5 Flash, Gemini 2.5 Pro          |
| Anthropic Claude  | `claudeClient.ts`    | Claude 3.5 Sonnet e variantes             |

---

## Contrato de interface

Cada cliente de provider deve implementar o mesmo contrato:

```typescript
interface ProviderClient {
  sendMessage(params: {
    apiKey: string;          // já desencriptada — nunca logar
    model: string;
    messages: Message[];
    onChunk: (chunk: string) => void;  // callback para streaming
  }): Promise<void>;
}
```

**Regra:** Se um novo provider não consegue implementar este contrato sem alterações, o contrato deve ser discutido antes de ser alterado. Mudar o contrato afecta todos os providers existentes.

---

## Fluxo de um pedido a um provider

```
conversation service
        ↓
Buscar API key encriptada do utilizador (via apiKeys service)
        ↓
encryptionService.decrypt(encryptedKey)
        ↓
providerClient.sendMessage({ apiKey, model, messages, onChunk })
        ↓
Provider externo (OpenAI / Gemini / Claude)
        ↓
Chunks de resposta via onChunk callback → streaming para o frontend
        ↓
Mensagem completa guardada em PostgreSQL
```

**Crítico:** A API key desencriptada existe apenas em memória durante o pedido. Nunca é serializada, loggada ou guardada de novo.

---

## Como adicionar um novo provider

1. Criar `backend/src/providers/novoProviderClient.ts` com o contrato acima.
2. Adicionar o provider à rota `backend/src/routes/models.ts` — lista de modelos disponíveis.
3. Adicionar o provider ao switch de selecção em `conversation service`.
4. Adicionar o campo de API key no `frontend/src/pages/Settings.tsx`.
5. Actualizar `env.example` se o provider precisar de variáveis adicionais.
6. Actualizar este ficheiro com os modelos suportados.

**Nunca** chamar o provider directamente de uma rota — vai sempre via service.

---

## Gestão de API keys

As keys são guardadas na tabela `api_keys` do PostgreSQL, encriptadas com AES-256-GCM.
Ver `docs/database.md` para o schema e `encryptionService.ts` para a implementação.

Cada utilizador pode ter uma key por provider. A UI de gestão vive em `frontend/src/pages/Settings.tsx`.

---

## Modelos disponíveis

A rota `GET /api/models` retorna os modelos disponíveis por provider. É usada pelo `ModelSelect.tsx`
no frontend para popular o selector.

Os modelos são definidos estaticamente em `backend/src/routes/models.ts`. Ao adicionar um novo
modelo, actualizar essa lista.

---

## Tratamento de erros de provider

Erros dos providers externos (rate limit, key inválida, timeout) devem ser:
- Loggados no backend com contexto (provider, modelo) mas **sem a API key**
- Retornados ao frontend com mensagem genérica — nunca expor detalhes internos do provider
- Tratados com código `502 Bad Gateway` para distinguir de erros internos (`500`)
