export type ChatMessage = { role: 'user' | 'assistant' | 'system' | 'developer'; content: string };

async function geminiFetch(apiKey: string, path: string, init: RequestInit): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function geminiChat(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
}): Promise<{ message: string; usage?: unknown }> {
  const modelId = params.model.replace(/^models\//, '');
  const contents = [
    {
      parts: [
        {
          text: params.messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
        },
      ],
    },
  ];

  const data = await geminiFetch(
    params.apiKey,
    `models/${encodeURIComponent(modelId)}:generateContent`,
    {
      method: 'POST',
      body: JSON.stringify({ contents }),
    }
  );

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { message: text, usage: data?.usageMetadata };
}

export async function geminiListModels(apiKey: string): Promise<string[]> {
  const data = await geminiFetch(apiKey, 'models', { method: 'GET' });
  const ids: string[] = (data.models || [])
    .map((m: any) => m.name as string)
    .filter((id: string) => id && /gemini-/.test(id));
  return ids;
}


