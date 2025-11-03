import OpenAI from 'openai';

export type ChatMessage = { role: 'user' | 'assistant' | 'system' | 'developer'; content: string };

export async function openaiChat(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
}): Promise<{ message: string; usage?: unknown }> {
  const client = new OpenAI({ apiKey: params.apiKey });

  const inputText = params.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');
  const tryModels = [params.model, 'gpt-4o', 'gpt-4o-mini'].filter(Boolean);
  let lastError: any = null;
  for (const model of tryModels) {
    try {
      const response = await client.responses.create({
        model,
        tools: [{ type: 'web_search_preview' }],
        input: inputText,
      });
      const output = (response as any).output_text
        || (response as any).text
        || (response as any).output?.[0]?.content?.[0]?.text
        || '';
      return { message: output, usage: (response as any).usage };
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  throw lastError;
}

export async function openaiListModels(apiKey: string): Promise<string[]> {
  const client = new OpenAI({ apiKey });
  const list = await client.models.list();
  const ids = list.data
    .map((m) => ({ id: (m as any).id as string, created: (m as any).created as number }))
    .filter((m) => /gpt|o\b|o-mini|gpt-/.test(m.id))
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .slice(0, 3)
    .map((m) => m.id);
  return ids;
}


