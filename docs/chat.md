# Chat & Streaming

## Visão geral

O sistema de chat suporta dois modos de operação:
1. **Resposta completa** — o servidor espera a resposta completa e retorna de uma vez
2. **Streaming SSE** — o servidor envia tokens em tempo real via Server-Sent Events

O streaming é o modo preferido para melhor UX, mas o fallback para resposta completa garante compatibilidade.

---

## Fluxo de streaming SSE

```
Frontend                          Backend                          Provider
   |                                 |                                |
   |--- POST /api/chat ------------->|                                |
   |    { stream: true, ... }       |                                |
   |                                 |--- chatStream() -------------->|
   |                                 |                                |
   |<-- text/event-stream ----------|                                |
   |    data: {"type":"chunk",      |<-- chunks (texto) ------------|
   |           "text":"Hello"}       |                                |
   |                                 |                                |
   |<-- data: {"type":"chunk",      |<-- chunks ---------------------|
   |           "text":" world"}      |                                |
   |                                 |                                |
   |<-- data: {"type":"complete",   |<-- done ------------------------|
   |           "message":"Hello..."} |                                |
```

---

## API Endpoint

### POST `/api/chat`

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```typescript
{
  message?: string;                    // Mensagem única (alternativa a messages)
  messages?: Array<{                   // Histórico de mensagens
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  provider: 'openai' | 'gemini' | 'claude';
  model?: string;                      // Default:.provider-specific
  fileIds?: string[];                  // IDs de ficheiros uploadados
  conversationId?: string;             // Para contexto de projeto
  stream?: boolean;                    // true = SSE, false = resposta completa
}
```

**Resposta (non-streaming):**
```json
{
  "message": "Resposta completa do modelo",
  "usage": { ... }
}
```

**Resposta (streaming):** `Content-Type: text/event-stream`

```
data: {"type":"chunk","text":"Olá"}
data: {"type":"chunk","text":" mundo"}
data: {"type":"complete","message":"Olá mundo"}
```

**Eventos SSE:**
| Tipo | Descrição |
|------|-----------|
| `chunk` | Fragmento de texto incremental |
| `complete` | Resposta completa, última mensagem |
| `error` | Erro durante o stream |

---

## chatService

O `chatService.ts` é responsável por:
1. Carregar contexto de projeto (se aplicável)
2. Processar ficheiros uploads
3. Desencriptar API key do utilizador
4. Rotear para o provider correto
5. Cleanup de ficheiros após uso

### Estrutura

```typescript
// src/services/chatService.ts

export interface ChatRequest {
  userId: string;
  message?: string;
  messages: Array<{ role: string; content: string }>;
  provider: ApiProvider;
  model: string;
  fileIds?: string[];
  conversationId?: string;
}

// Resposta completa
export async function chat(request: ChatRequest): Promise<ChatResponse>

// Streaming
export async function chatStream(
  request: ChatRequest,
  callbacks: {
    onChunk: (text: string) => void;
    onComplete: (fullText: string) => void;
    onError: (error: Error) => void;
  }
): Promise<void>
```

---

## Providers com streaming

Cada provider tem duas funções:
- `xxxChat()` — resposta completa
- `xxxChatStream()` — streaming

### OpenAI

```typescript
// src/providers/openaiClient.ts
export async function openaiChat(params: {...}): Promise<{ message: string; usage?: unknown }>
export async function openaiChatStream(params: {...}, callbacks: StreamCallbacks): Promise<void>
```

### Gemini

```typescript
// src/providers/geminiClient.ts
export async function geminiChat(params: {...}): Promise<{ message: string; usage?: unknown }>
export async function geminiChatStream(params: {...}, callbacks: StreamCallbacks): Promise<void>
```

### Claude

```typescript
// src/providers/claudeClient.ts
export async function claudeChat(params: {...}): Promise<{ message: string; usage?: unknown }>
export async function claudeChatStream(params: {...}, callbacks: StreamCallbacks): Promise<void>
```

---

## Frontend streaming

O componente `Chat.tsx` usa streaming por padrão:

```typescript
// src/components/Chat.tsx

// Fetch API com streaming
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ ...payload, stream: true }),
  signal: abortController.signal,
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value, { stream: true });
  // Processar SSE events do chunk
}
```

---

## Rate Limiting

O endpoint `/api/chat` tem rate limiting específico:
- **30 pedidos por minuto** por utilizador autenticado
- **10 pedidos por minuto** para IP (não autenticados)

Ver `middleware/rateLimiter.ts` para configuração.

---

## Error Handling

| Erro | HTTP Code | Ação |
|------|-----------|------|
| API key não configurada | 400 | Mostrar erro no UI |
| API key inválida | 401 | Prompt para re-inserir |
| Ficheiro não encontrado | 400 | Mostrar erro específico |
| Rate limit exceeded | 429 | Mostrar mensagem de espera |
| Provider error | 502 | Retry automático (frontend) |

---

## Boas práticas

1. **Sempre usar streaming** — melhor UX
2. **Implementar abort** — permite cancelar pedidos
3. **Lidar com desconexões** — retry com backoff
4. **Cleanup de ficheiros** — feito automaticamente pelo service
5. **Não guardar state durante stream** — guardar após `complete`
