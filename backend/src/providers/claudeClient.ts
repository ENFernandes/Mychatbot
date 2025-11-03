export type ChatMessage = { role: 'user' | 'assistant' | 'system' | 'developer'; content: string };

async function anthropicFetch(apiKey: string, path: string, init: RequestInit): Promise<any> {
  const url = `https://api.anthropic.com/v1/${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function claudeChat(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
}): Promise<{ message: string; usage?: unknown }> {
  const payload = {
    model: params.model,
    messages: params.messages.map((m) => ({ role: m.role === 'developer' ? 'system' : m.role, content: m.content })),
    max_tokens: 1024,
  };

  const data = await anthropicFetch(params.apiKey, 'messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const text = data?.content?.[0]?.text || data?.content?.[0]?.content?.[0]?.text || '';
  return { message: text, usage: data?.usage };
}

export async function claudeListModels(apiKey: string): Promise<string[]> {
  const data = await anthropicFetch(apiKey, 'models', { method: 'GET' });
  const ids: string[] = (data.data || [])
    .map((m: any) => m.id as string)
    .filter((id: string) => id && /claude-/.test(id));
  return ids.slice(0, 3);
}


