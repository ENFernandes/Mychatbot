export type ChatMessage = {
  role: 'user' | 'assistant' | 'system' | 'developer';
  content: string;
  fileIds?: string[];
};

export interface FileContent {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface UploadedFileInfo {
  providerId: string;
  filename: string;
  mimeType: string;
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1';

async function anthropicFetch(apiKey: string, path: string, init: RequestInit, useBeta: boolean = false): Promise<any> {
  const url = `${ANTHROPIC_API_URL}/${path}`;
  const headers: Record<string, string> = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
  };

  if (useBeta) {
    headers['anthropic-beta'] = 'files-api-2025-04-14,pdfs-2024-09-25';
  }

  const res = await fetch(url, { ...init, headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function claudeUploadFile(params: {
  apiKey: string;
  file: FileContent;
}): Promise<UploadedFileInfo> {
  const url = `${ANTHROPIC_API_URL}/files`;
  const formData = new FormData();
  const blob = new Blob([params.file.buffer], { type: params.file.mimeType });
  formData.append('file', blob, params.file.filename);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'files-api-2025-04-14',
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic Files API error ${res.status}: ${text}`);
  }

  const data = await res.json() as { id: string; filename?: string; mime_type?: string };

  return {
    providerId: data.id,
    filename: data.filename || params.file.filename,
    mimeType: data.mime_type || params.file.mimeType,
  };
}

export async function claudeDeleteFile(params: {
  apiKey: string;
  fileId: string;
}): Promise<boolean> {
  try {
    const url = `${ANTHROPIC_API_URL}/files/${params.fileId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'x-api-key': params.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'files-api-2025-04-14',
      },
    });
    return res.ok;
  } catch (error) {
    console.error('Error deleting file from Anthropic:', error);
    return false;
  }
}

function buildContentWithFiles(
  textContent: string,
  files: FileContent[],
  uploadedFiles: UploadedFileInfo[]
): any[] {
  const content: any[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const uploaded = uploadedFiles[i];

    if (file.mimeType.startsWith('image/')) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: file.mimeType, data: file.buffer.toString('base64') },
      });
    } else if (file.mimeType === 'application/pdf') {
      if (uploaded?.providerId) {
        content.push({ type: 'document', source: { type: 'file', file_id: uploaded.providerId } });
      } else {
        content.push({
          type: 'document',
          source: { type: 'base64', media_type: file.mimeType, data: file.buffer.toString('base64') },
        });
      }
    } else {
      if (uploaded?.providerId) {
        content.push({ type: 'document', source: { type: 'file', file_id: uploaded.providerId } });
      } else {
        try {
          const textFromFile = file.buffer.toString('utf-8');
          content.push({ type: 'text', text: `[Content from ${file.filename}]:\n${textFromFile}` });
        } catch {
          content.push({
            type: 'document',
            source: { type: 'base64', media_type: file.mimeType, data: file.buffer.toString('base64') },
          });
        }
      }
    }
  }

  if (textContent) {
    content.push({ type: 'text', text: textContent });
  }

  return content;
}

async function uploadFilesIfNeeded(apiKey: string, files?: FileContent[]): Promise<UploadedFileInfo[]> {
  const uploadedFiles: UploadedFileInfo[] = [];

  if (!files || files.length === 0) return uploadedFiles;

  for (const file of files) {
    if (!file.mimeType.startsWith('image/')) {
      try {
        const uploaded = await claudeUploadFile({ apiKey, file });
        uploadedFiles.push(uploaded);
      } catch (err) {
        console.error('Error uploading file to Anthropic:', err);
        uploadedFiles.push({ providerId: '', filename: file.filename, mimeType: file.mimeType });
      }
    } else {
      uploadedFiles.push({ providerId: '', filename: file.filename, mimeType: file.mimeType });
    }
  }

  return uploadedFiles;
}

export async function claudeChat(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  files?: FileContent[];
}): Promise<{ message: string; usage?: unknown }> {
  const uploadedFiles = await uploadFilesIfNeeded(params.apiKey, params.files);

  const processedMessages = params.messages.map((m, idx) => {
    const isLastUserMessage = m.role === 'user' &&
      idx === params.messages.map((msg, i) => ({ msg, i })).filter(({ msg }) => msg.role === 'user').pop()?.i;

    if (isLastUserMessage && params.files && params.files.length > 0) {
      return {
        role: m.role === 'developer' ? 'user' : m.role,
        content: buildContentWithFiles(m.content, params.files, uploadedFiles),
      };
    }

    return { role: m.role === 'developer' ? 'user' : m.role, content: m.content };
  });

  const payload = { model: params.model, messages: processedMessages, max_tokens: 4096 };
  const useBeta = params.files && params.files.length > 0;

  const data = await anthropicFetch(params.apiKey, 'messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, useBeta);

  for (const file of uploadedFiles) {
    if (file.providerId) {
      await claudeDeleteFile({ apiKey: params.apiKey, fileId: file.providerId });
    }
  }

  const text = data?.content?.[0]?.text || data?.content?.[0]?.content?.[0]?.text || '';
  return { message: text, usage: data?.usage };
}

export async function claudeChatStream(
  params: {
    apiKey: string;
    model: string;
    messages: ChatMessage[];
    files?: FileContent[];
  },
  callbacks: StreamCallbacks
): Promise<void> {
  const uploadedFiles = await uploadFilesIfNeeded(params.apiKey, params.files);

  const processedMessages = params.messages.map((m, idx) => {
    const isLastUserMessage = m.role === 'user' &&
      idx === params.messages.map((msg, i) => ({ msg, i })).filter(({ msg }) => msg.role === 'user').pop()?.i;

    if (isLastUserMessage && params.files && params.files.length > 0) {
      return {
        role: m.role === 'developer' ? 'user' : m.role,
        content: buildContentWithFiles(m.content, params.files, uploadedFiles),
      };
    }

    return { role: m.role === 'developer' ? 'user' : m.role, content: m.content };
  });

  const payload = { model: params.model, messages: processedMessages, max_tokens: 4096, stream: true };
  const useBeta = params.files && params.files.length > 0;

  const url = `${ANTHROPIC_API_URL}/messages`;
  const headers: Record<string, string> = {
    'x-api-key': params.apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  };

  if (useBeta) {
    headers['anthropic-beta'] = 'files-api-2025-04-14,pdfs-2024-09-25';
  }

  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${text}`);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'content_block_delta') {
              const text = event.delta?.text || '';
              if (text) {
                callbacks.onChunk(text);
              }
            } else if (event.type === 'message_stop') {
              callbacks.onComplete();
            }
          } catch (e) {}
        }
      }
    }

    callbacks.onComplete();
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  } finally {
    for (const file of uploadedFiles) {
      if (file.providerId) {
        await claudeDeleteFile({ apiKey: params.apiKey, fileId: file.providerId });
      }
    }
  }
}

export async function claudeListModels(apiKey: string): Promise<string[]> {
  const data = await anthropicFetch(apiKey, 'models', { method: 'GET' });
  const ids: string[] = (data.data || [])
    .map((m: any) => m.id as string)
    .filter((id: string) => id && /claude-/.test(id));
  return ids;
}
