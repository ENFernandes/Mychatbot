import OpenAI from 'openai';
import { Readable } from 'stream';

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

/**
 * Upload a file to OpenAI (for non-image files)
 */
export async function openaiUploadFile(params: {
  apiKey: string;
  file: FileContent;
}): Promise<UploadedFileInfo> {
  const client = new OpenAI({ apiKey: params.apiKey });

  // Create a File object from buffer
  // The OpenAI SDK accepts File, Blob, or Readable stream
  // For Node.js, we'll use a File-like object
  const fileStream = Readable.from(params.file.buffer);
  
  // Add properties that the SDK might need
  (fileStream as any).name = params.file.filename;
  (fileStream as any).type = params.file.mimeType;
  (fileStream as any).size = params.file.buffer.length;

  const uploadedFile = await client.files.create({
    file: fileStream as any,
    purpose: 'assistants',
  });

  return {
    providerId: uploadedFile.id,
    filename: params.file.filename,
    mimeType: params.file.mimeType,
  };
}

/**
 * Delete a file from OpenAI
 */
export async function openaiDeleteFile(params: {
  apiKey: string;
  fileId: string;
}): Promise<boolean> {
  const client = new OpenAI({ apiKey: params.apiKey });

  try {
    await client.files.del(params.fileId);
    return true;
  } catch (error) {
    console.error('Error deleting file from OpenAI:', error);
    return false;
  }
}

export async function openaiChat(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  files?: FileContent[];
}): Promise<{ message: string; usage?: unknown }> {
  const client = new OpenAI({ apiKey: params.apiKey });

  // Separate images from other files
  const imageFiles: FileContent[] = [];
  const otherFiles: FileContent[] = [];
  
  if (params.files && params.files.length > 0) {
    for (const file of params.files) {
      if (file.mimeType.startsWith('image/')) {
        imageFiles.push(file);
      } else {
        otherFiles.push(file);
      }
    }
  }

  // Upload non-image files if any
  const uploadedFiles: UploadedFileInfo[] = [];
  if (otherFiles.length > 0) {
    for (const file of otherFiles) {
      try {
        const uploaded = await openaiUploadFile({ apiKey: params.apiKey, file });
        uploadedFiles.push(uploaded);
      } catch (err) {
        console.error('Error uploading file to OpenAI:', err);
      }
    }
  }

  const tryModels = [params.model, 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'].filter(Boolean);
  let lastError: any = null;

  for (const model of tryModels) {
    try {
      // Check if model supports vision (images)
      const isVisionModel = /gpt-4o|gpt-4-turbo|gpt-4-vision/i.test(model);
      
      // If we have images or other files, use chat.completions API
      if (imageFiles.length > 0 || uploadedFiles.length > 0) {
        // Build messages with proper content format
        const messagesWithFiles = params.messages.map((m, idx) => {
          // Find the last user message to attach files to
          const userMessages = params.messages
            .map((msg, i) => ({ msg, i }))
            .filter(({ msg }) => msg.role === 'user');
          const lastUserMessageIndex = userMessages.length > 0 
            ? userMessages[userMessages.length - 1].i 
            : -1;
          
          const isLastUserMessage = m.role === 'user' && idx === lastUserMessageIndex;

          // Build content array for messages with files
          if (isLastUserMessage && (imageFiles.length > 0 || uploadedFiles.length > 0)) {
            const content: Array<
              | { type: 'text'; text: string }
              | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
            > = [];

            // Add text content if present (or default message if no text)
            const textContent = m.content || (imageFiles.length > 0 ? 'What do you see in this image?' : '');
            if (textContent) {
              content.push({ type: 'text', text: textContent });
            }

            // Add images as base64 inline (required for vision models)
            // Always add images if we have them, regardless of model check (will fail gracefully if model doesn't support)
            if (imageFiles.length > 0) {
              for (const imageFile of imageFiles) {
                const base64Image = imageFile.buffer.toString('base64');
                const dataUrl = `data:${imageFile.mimeType};base64,${base64Image}`;
                content.push({
                  type: 'image_url',
                  image_url: {
                    url: dataUrl,
                    detail: 'auto', // Can be 'low', 'high', or 'auto'
                  },
                });
              }
            }

            // Note: Non-image files (PDFs, etc.) are not directly supported in chat.completions
            // They would need to be handled via Assistants API or converted to text

            return {
              role: m.role === 'developer' ? 'system' : m.role,
              content: content.length > 0 ? content : m.content,
            };
          }

          // Regular message without files
          return {
            role: m.role === 'developer' ? 'system' : m.role,
            content: m.content,
          };
        });

        // Use chat.completions API for vision support
        // For images, we need a vision-capable model
        let modelToUse = model;
        if (imageFiles.length > 0) {
          // Force vision-capable model if current model doesn't support vision
          if (!isVisionModel) {
            modelToUse = 'gpt-4o'; // Default to gpt-4o which supports vision
          }
        }

        console.log(`[OpenAI] Using model: ${modelToUse}, Images: ${imageFiles.length}, Other files: ${uploadedFiles.length}`);
        
        const response = await client.chat.completions.create({
          model: modelToUse,
          messages: messagesWithFiles as any,
          max_tokens: 4096,
        });

        const output = response.choices[0]?.message?.content || '';
        
        // Clean up uploaded files
        for (const file of uploadedFiles) {
          try {
            await openaiDeleteFile({ apiKey: params.apiKey, fileId: file.providerId });
          } catch (e) {
            // Ignore cleanup errors
          }
        }

        return { message: output, usage: response.usage };
      }

      // Standard flow without files - use responses API if available, otherwise chat.completions
      try {
        const response = await client.chat.completions.create({
          model,
          messages: params.messages.map((m) => ({
            role: m.role === 'developer' ? 'system' : m.role,
            content: m.content,
          })),
          max_tokens: 4096,
        });

        const output = response.choices[0]?.message?.content || '';
        return { message: output, usage: response.usage };
      } catch (chatError) {
        // Fallback to responses API if chat.completions fails
        const inputText = params.messages
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n');

        const response = await (client as any).responses.create({
          model,
          tools: [{ type: 'web_search_preview' }],
          input: inputText,
        });

        const output = (response as any).output_text
          || (response as any).text
          || (response as any).output?.[0]?.content?.[0]?.text
          || '';

        return { message: output, usage: (response as any).usage };
      }
    } catch (err) {
      lastError = err;
      console.error(`Error with model ${model}:`, err);
      continue;
    }
  }

  throw lastError || new Error('Failed to get response from OpenAI');
}

export async function openaiListModels(apiKey: string): Promise<string[]> {
  try {
    const client = new OpenAI({ apiKey });
    const list = await client.models.list();
    const ids = list.data
      .map((m) => ({ id: (m as any).id as string, created: (m as any).created as number }))
      .filter((m) => /gpt|o\b|o-mini|gpt-/.test(m.id))
      .sort((a, b) => (b.created || 0) - (a.created || 0))
      .map((m) => m.id);
    return ids;
  } catch (error: any) {
    throw error;
  }
}
