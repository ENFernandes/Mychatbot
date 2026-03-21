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
  uri?: string;
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_UPLOAD_URL = 'https://generativelanguage.googleapis.com/upload/v1beta';

async function geminiFetch(apiKey: string, path: string, init: RequestInit): Promise<any> {
  const url = `${GEMINI_API_URL}/${path}`;
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

export async function geminiUploadFile(params: {
  apiKey: string;
  file: FileContent;
}): Promise<UploadedFileInfo> {
  const startUploadUrl = `${GEMINI_UPLOAD_URL}/files?key=${params.apiKey}`;

  const metadata = {
    file: { display_name: params.file.filename },
  };

  const startRes = await fetch(startUploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': params.file.buffer.length.toString(),
      'X-Goog-Upload-Header-Content-Type': params.file.mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`Gemini Files API start upload error ${startRes.status}: ${text}`);
  }

  const uploadUri = startRes.headers.get('X-Goog-Upload-URL');
  if (!uploadUri) {
    throw new Error('Failed to get upload URI from Gemini');
  }

  const uploadRes = await fetch(uploadUri, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type': params.file.mimeType,
    },
    body: params.file.buffer,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Gemini Files API upload error ${uploadRes.status}: ${text}`);
  }

  const fileData = await uploadRes.json() as { file?: { name?: string; uri?: string } };

  return {
    providerId: fileData.file?.name || '',
    filename: params.file.filename,
    mimeType: params.file.mimeType,
    uri: fileData.file?.uri || '',
  };
}

export async function geminiDeleteFile(params: {
  apiKey: string;
  fileId: string;
}): Promise<boolean> {
  try {
    const url = `${GEMINI_API_URL}/${params.fileId}?key=${params.apiKey}`;
    const res = await fetch(url, { method: 'DELETE' });
    return res.ok;
  } catch (error) {
    console.error('Error deleting file from Gemini:', error);
    return false;
  }
}

async function waitForFileProcessing(apiKey: string, fileName: string, maxAttempts: number = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const url = `${GEMINI_API_URL}/${fileName}?key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as { state?: string };
        if (data.state === 'ACTIVE') return true;
        if (data.state === 'FAILED') {
          console.error('File processing failed:', data);
          return false;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Error checking file status:', error);
    }
  }
  return false;
}

function buildPartsWithFiles(
  textContent: string,
  files: FileContent[],
  uploadedFiles: UploadedFileInfo[]
): any[] {
  const parts: any[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const uploaded = uploadedFiles[i];

    if (uploaded && uploaded.uri) {
      parts.push({
        file_data: { mime_type: file.mimeType, file_uri: uploaded.uri },
      });
    } else {
      parts.push({
        inline_data: { mime_type: file.mimeType, data: file.buffer.toString('base64') },
      });
    }
  }

  if (textContent) {
    parts.push({ text: textContent });
  }

  return parts;
}

async function uploadFilesIfNeeded(
  apiKey: string,
  files?: FileContent[]
): Promise<UploadedFileInfo[]> {
  const uploadedFiles: UploadedFileInfo[] = [];

  if (!files || files.length === 0) return uploadedFiles;

  const shouldUpload = files.some(f =>
    f.buffer.length > 4 * 1024 * 1024 ||
    f.mimeType === 'application/pdf' ||
    f.mimeType.startsWith('video/') ||
    f.mimeType.startsWith('audio/')
  );

  for (const file of files) {
    if (shouldUpload) {
      try {
        const uploaded = await geminiUploadFile({ apiKey, file });
        if (uploaded.providerId) {
          await waitForFileProcessing(apiKey, uploaded.providerId);
        }
        uploadedFiles.push(uploaded);
      } catch (err) {
        console.error('Error uploading file to Gemini:', err);
        uploadedFiles.push({ providerId: '', filename: file.filename, mimeType: file.mimeType });
      }
    } else {
      uploadedFiles.push({ providerId: '', filename: file.filename, mimeType: file.mimeType });
    }
  }

  return uploadedFiles;
}

export async function geminiChat(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  files?: FileContent[];
}): Promise<{ message: string; usage?: unknown }> {
  const modelId = params.model.replace(/^models\//, '');
  const uploadedFiles = await uploadFilesIfNeeded(params.apiKey, params.files);

  let contents: any[];

  if (params.files && params.files.length > 0) {
    const conversationText = params.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const parts = buildPartsWithFiles(conversationText, params.files, uploadedFiles);
    contents = [{ parts }];
  } else {
    contents = [{ parts: [{ text: params.messages.map((m) => `${m.role}: ${m.content}`).join('\n') }] }];
  }

  const data = await geminiFetch(
    params.apiKey,
    `models/${encodeURIComponent(modelId)}:generateContent`,
    { method: 'POST', body: JSON.stringify({ contents }) }
  );

  for (const file of uploadedFiles) {
    if (file.providerId) {
      await geminiDeleteFile({ apiKey: params.apiKey, fileId: file.providerId });
    }
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { message: text, usage: data?.usageMetadata };
}

export async function geminiChatStream(
  params: {
    apiKey: string;
    model: string;
    messages: ChatMessage[];
    files?: FileContent[];
  },
  callbacks: StreamCallbacks
): Promise<void> {
  const modelId = params.model.replace(/^models\//, '');
  const uploadedFiles = await uploadFilesIfNeeded(params.apiKey, params.files);

  let contents: any[];

  if (params.files && params.files.length > 0) {
    const conversationText = params.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const parts = buildPartsWithFiles(conversationText, params.files, uploadedFiles);
    contents = [{ parts }];
  } else {
    contents = [{ parts: [{ text: params.messages.map((m) => `${m.role}: ${m.content}`).join('\n') }] }];
  }

  try {
    const url = `${GEMINI_API_URL}/models/${encodeURIComponent(modelId)}:streamGenerateContent?key=${params.apiKey}&alt=sse`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${text}`);
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
            const data = JSON.parse(line.slice(6));
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              callbacks.onChunk(text);
            }
          } catch (e) {}
        }
      }
    }

    if (buffer.startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.slice(6));
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          callbacks.onChunk(text);
        }
      } catch (e) {}
    }

    callbacks.onComplete();
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  } finally {
    for (const file of uploadedFiles) {
      if (file.providerId) {
        await geminiDeleteFile({ apiKey: params.apiKey, fileId: file.providerId });
      }
    }
  }
}

export async function geminiListModels(apiKey: string): Promise<string[]> {
  const data = await geminiFetch(apiKey, 'models', { method: 'GET' });
  const ids: string[] = (data.models || [])
    .map((m: any) => m.name as string)
    .filter((id: string) => id && /gemini-/.test(id));
  return ids;
}
