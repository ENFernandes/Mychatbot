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

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1';

async function anthropicFetch(apiKey: string, path: string, init: RequestInit, useBeta: boolean = false): Promise<any> {
  const url = `${ANTHROPIC_API_URL}/${path}`;
  const headers: Record<string, string> = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
  };

  // Add beta header for files API
  if (useBeta) {
    headers['anthropic-beta'] = 'files-api-2025-04-14,pdfs-2024-09-25';
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * Upload a file to Anthropic (Claude)
 * Uses the Files API beta
 */
export async function claudeUploadFile(params: {
  apiKey: string;
  file: FileContent;
}): Promise<UploadedFileInfo> {
  const url = `${ANTHROPIC_API_URL}/files`;
  
  // Create form data for multipart upload
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

/**
 * Delete a file from Anthropic
 */
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

/**
 * Build message content with files for Claude
 * Claude supports inline document content as base64 or file references
 */
function buildContentWithFiles(
  textContent: string,
  files: FileContent[],
  uploadedFiles: UploadedFileInfo[]
): any[] {
  const content: any[] = [];

  // Add file content blocks
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const uploaded = uploadedFiles[i];

    if (file.mimeType.startsWith('image/')) {
      // For images, use base64 inline (Claude supports this directly)
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: file.mimeType,
          data: file.buffer.toString('base64'),
        },
      });
    } else if (file.mimeType === 'application/pdf') {
      // For PDFs, use file reference if uploaded, or base64
      if (uploaded) {
        content.push({
          type: 'document',
          source: {
            type: 'file',
            file_id: uploaded.providerId,
          },
        });
      } else {
        // Fallback to base64 for PDFs
        content.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: file.mimeType,
            data: file.buffer.toString('base64'),
          },
        });
      }
    } else {
      // For other document types, try file reference first
      if (uploaded) {
        content.push({
          type: 'document',
          source: {
            type: 'file',
            file_id: uploaded.providerId,
          },
        });
      } else {
        // For text-based files, include content as text
        try {
          const textFromFile = file.buffer.toString('utf-8');
          content.push({
            type: 'text',
            text: `[Content from ${file.filename}]:\n${textFromFile}`,
          });
        } catch {
          // If not text, try base64
          content.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: file.mimeType,
              data: file.buffer.toString('base64'),
            },
          });
        }
      }
    }
  }

  // Add text content
  if (textContent) {
    content.push({
      type: 'text',
      text: textContent,
    });
  }

  return content;
}

export async function claudeChat(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  files?: FileContent[];
}): Promise<{ message: string; usage?: unknown }> {
  // Upload files if provided
  const uploadedFiles: UploadedFileInfo[] = [];
  if (params.files && params.files.length > 0) {
    for (const file of params.files) {
      try {
        // Only upload PDFs and documents, images can be sent inline
        if (!file.mimeType.startsWith('image/')) {
          const uploaded = await claudeUploadFile({ apiKey: params.apiKey, file });
          uploadedFiles.push(uploaded);
        } else {
          // For images, we don't need to upload, just mark as placeholder
          uploadedFiles.push({
            providerId: '',
            filename: file.filename,
            mimeType: file.mimeType,
          });
        }
      } catch (err) {
        console.error('Error uploading file to Anthropic:', err);
        // Continue without file upload, will use base64 fallback
        uploadedFiles.push({
          providerId: '',
          filename: file.filename,
          mimeType: file.mimeType,
        });
      }
    }
  }

  // Build messages with file content
  const processedMessages = params.messages.map((m, idx) => {
    const isLastUserMessage = m.role === 'user' &&
      idx === params.messages.map((msg, i) => ({ msg, i }))
        .filter(({ msg }) => msg.role === 'user')
        .pop()?.i;

    // Attach files to the last user message
    if (isLastUserMessage && params.files && params.files.length > 0) {
      return {
        role: m.role === 'developer' ? 'user' : m.role,
        content: buildContentWithFiles(m.content, params.files, uploadedFiles),
      };
    }

    return {
      role: m.role === 'developer' ? 'user' : m.role,
      content: m.content,
    };
  });

  const payload = {
    model: params.model,
    messages: processedMessages,
    max_tokens: 4096,
  };

  // Use beta header if we have files
  const useBeta = params.files && params.files.length > 0;

  const data = await anthropicFetch(params.apiKey, 'messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, useBeta);

  // Clean up uploaded files
  for (const file of uploadedFiles) {
    if (file.providerId) {
      await claudeDeleteFile({ apiKey: params.apiKey, fileId: file.providerId });
    }
  }

  const text = data?.content?.[0]?.text || data?.content?.[0]?.content?.[0]?.text || '';
  return { message: text, usage: data?.usage };
}

export async function claudeListModels(apiKey: string): Promise<string[]> {
  const data = await anthropicFetch(apiKey, 'models', { method: 'GET' });
  const ids: string[] = (data.data || [])
    .map((m: any) => m.id as string)
    .filter((id: string) => id && /claude-/.test(id));
  return ids;
}
