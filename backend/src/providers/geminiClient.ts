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

/**
 * Upload a file to Gemini using the Files API
 * Returns file metadata including the file URI
 */
export async function geminiUploadFile(params: {
  apiKey: string;
  file: FileContent;
}): Promise<UploadedFileInfo> {
  // Step 1: Start resumable upload to get upload URI
  const startUploadUrl = `${GEMINI_UPLOAD_URL}/files?key=${params.apiKey}`;
  
  const metadata = {
    file: {
      display_name: params.file.filename,
    },
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

  // Step 2: Upload the file data
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

/**
 * Delete a file from Gemini
 */
export async function geminiDeleteFile(params: {
  apiKey: string;
  fileId: string;
}): Promise<boolean> {
  try {
    const url = `${GEMINI_API_URL}/${params.fileId}?key=${params.apiKey}`;
    const res = await fetch(url, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (error) {
    console.error('Error deleting file from Gemini:', error);
    return false;
  }
}

/**
 * Wait for file to be processed by Gemini
 * Gemini needs time to process uploaded files
 */
async function waitForFileProcessing(apiKey: string, fileName: string, maxAttempts: number = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const url = `${GEMINI_API_URL}/${fileName}?key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as { state?: string };
        if (data.state === 'ACTIVE') {
          return true;
        }
        if (data.state === 'FAILED') {
          console.error('File processing failed:', data);
          return false;
        }
      }
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Error checking file status:', error);
    }
  }
  return false;
}

/**
 * Build content parts with files for Gemini
 */
function buildPartsWithFiles(
  textContent: string,
  files: FileContent[],
  uploadedFiles: UploadedFileInfo[]
): any[] {
  const parts: any[] = [];

  // Add file parts
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const uploaded = uploadedFiles[i];

    if (uploaded && uploaded.uri) {
      // Use file URI reference
      parts.push({
        file_data: {
          mime_type: file.mimeType,
          file_uri: uploaded.uri,
        },
      });
    } else if (file.mimeType.startsWith('image/')) {
      // For images without upload, use inline base64
      parts.push({
        inline_data: {
          mime_type: file.mimeType,
          data: file.buffer.toString('base64'),
        },
      });
    } else {
      // For other files, try to include as inline data
      parts.push({
        inline_data: {
          mime_type: file.mimeType,
          data: file.buffer.toString('base64'),
        },
      });
    }
  }

  // Add text part
  if (textContent) {
    parts.push({
      text: textContent,
    });
  }

  return parts;
}

export async function geminiChat(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  files?: FileContent[];
}): Promise<{ message: string; usage?: unknown }> {
  const modelId = params.model.replace(/^models\//, '');

  // Upload files if provided (for large files or special types)
  const uploadedFiles: UploadedFileInfo[] = [];
  const shouldUploadFiles = params.files && params.files.some(f => 
    f.buffer.length > 4 * 1024 * 1024 || // Files larger than 4MB
    f.mimeType === 'application/pdf' ||
    f.mimeType.startsWith('video/') ||
    f.mimeType.startsWith('audio/')
  );

  if (shouldUploadFiles && params.files) {
    for (const file of params.files) {
      try {
        const uploaded = await geminiUploadFile({ apiKey: params.apiKey, file });
        
        // Wait for file to be processed
        if (uploaded.providerId) {
          await waitForFileProcessing(params.apiKey, uploaded.providerId);
        }
        
        uploadedFiles.push(uploaded);
      } catch (err) {
        console.error('Error uploading file to Gemini:', err);
        // Push empty placeholder for inline fallback
        uploadedFiles.push({
          providerId: '',
          filename: file.filename,
          mimeType: file.mimeType,
        });
      }
    }
  } else if (params.files) {
    // For small files, just mark as not uploaded (will use inline)
    for (const file of params.files) {
      uploadedFiles.push({
        providerId: '',
        filename: file.filename,
        mimeType: file.mimeType,
      });
    }
  }

  // Build the content with files
  let contents: any[];

  if (params.files && params.files.length > 0) {
    // Build conversation with files attached to the last user message
    const conversationText = params.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const parts = buildPartsWithFiles(conversationText, params.files, uploadedFiles);
    contents = [{ parts }];
  } else {
    // Standard text-only content
    contents = [
      {
        parts: [
          {
            text: params.messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
          },
        ],
      },
    ];
  }

  const data = await geminiFetch(
    params.apiKey,
    `models/${encodeURIComponent(modelId)}:generateContent`,
    {
      method: 'POST',
      body: JSON.stringify({ contents }),
    }
  );

  // Clean up uploaded files
  for (const file of uploadedFiles) {
    if (file.providerId) {
      await geminiDeleteFile({ apiKey: params.apiKey, fileId: file.providerId });
    }
  }

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
