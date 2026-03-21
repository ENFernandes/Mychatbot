import { ApiProvider } from '@prisma/client';
import OpenAI from 'openai';
import { prisma } from '../config/database';
import { decrypt, toBuffer } from './encryptionService';
import { getStoredFile, removeStoredFile, isFileSupportedByProvider } from './fileService';
import { openaiChat, openaiChatStream, FileContent as OpenAIFileContent } from '../providers/openaiClient';
import { geminiChat, geminiChatStream, FileContent as GeminiFileContent } from '../providers/geminiClient';
import { claudeChat, claudeChatStream, FileContent as ClaudeFileContent } from '../providers/claudeClient';

export interface ChatRequest {
  userId: string;
  message?: string;
  messages: Array<{ role: string; content: string }>;
  provider: ApiProvider;
  model: string;
  fileIds?: string[];
  conversationId?: string;
}

export interface ChatResponse {
  message: string;
  usage?: unknown;
}

export interface ChatStreamCallbacks {
  onChunk: (text: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

function parseProvider(value: string | undefined): ApiProvider | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase() as keyof typeof ApiProvider;
  return ApiProvider[normalized] ?? null;
}

async function getDecryptedApiKey(userId: string, provider: ApiProvider): Promise<string> {
  const keyRecord = await prisma.userApiKey.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
    select: {
      encryptedKey: true,
      iv: true,
    },
  });

  if (!keyRecord) {
    throw new Error(`API key ${provider} not configured`);
  }

  const encryptedKeyBuffer = toBuffer(keyRecord.encryptedKey);
  const ivBuffer = toBuffer(keyRecord.iv);

  if (encryptedKeyBuffer.length < 16) {
    throw new Error(`Invalid encrypted key length: ${encryptedKeyBuffer.length}`);
  }
  if (ivBuffer.length !== 12) {
    throw new Error(`Invalid IV length: ${ivBuffer.length}, expected 12`);
  }

  return decrypt(encryptedKeyBuffer, ivBuffer);
}

async function loadProjectContext(userId: string, conversationId: string): Promise<Array<{ role: string; content: string }>> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    select: { projectId: true },
  });

  if (!conversation?.projectId) {
    return [];
  }

  const projectConversations = await prisma.conversation.findMany({
    where: {
      projectId: conversation.projectId,
      userId,
      id: { not: conversationId },
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      messages: {
        select: {
          role: true,
          content: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const projectContext: Array<{ role: string; content: string }> = [];

  for (const conv of projectConversations) {
    if (conv.messages.length > 0) {
      projectContext.push({
        role: 'system',
        content: `--- Context from conversation "${conv.title}" ---`,
      });

      for (const msg of conv.messages) {
        projectContext.push({
          role: msg.role.toLowerCase(),
          content: msg.content,
        });
      }
    }
  }

  if (projectContext.length > 0) {
    projectContext.unshift({
      role: 'system',
      content: 'The following is context from other conversations in the same project. Use this context to provide better, more informed responses.',
    });
  }

  return projectContext;
}

async function processFiles(fileIds?: string[]): Promise<Array<{ buffer: Buffer; filename: string; mimeType: string }>> {
  const files: Array<{ buffer: Buffer; filename: string; mimeType: string }> = [];
  
  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    return files;
  }

  for (const fileId of fileIds) {
    const storedFile = getStoredFile(fileId);
    if (!storedFile) {
      throw new Error(`File not found: ${fileId}`);
    }
    files.push({
      buffer: storedFile.buffer,
      filename: storedFile.filename,
      mimeType: storedFile.mimeType,
    });
  }

  return files;
}

function validateFilesForProvider(files: Array<{ buffer: Buffer; filename: string; mimeType: string }>, provider: ApiProvider): void {
  if (files.length === 0) return;

  const providerName = provider.toLowerCase() as 'openai' | 'gemini' | 'claude';
  for (const file of files) {
    if (!isFileSupportedByProvider(file.mimeType, providerName)) {
      throw new Error(`File type ${file.mimeType} is not supported by ${provider}`);
    }
  }
}

function cleanupFiles(fileIds?: string[]): void {
  if (!fileIds) return;
  for (const fileId of fileIds) {
    removeStoredFile(fileId);
  }
}

export function buildChatHistory(chatRequest: ChatRequest): Array<{ role: string; content: string }> {
  if (chatRequest.messages && chatRequest.messages.length > 0) {
    return chatRequest.messages;
  }
  if (chatRequest.message) {
    return [{ role: 'user', content: chatRequest.message }];
  }
  throw new Error('Message is required');
}

export async function chat(chatRequest: ChatRequest): Promise<ChatResponse> {
  const { userId, provider, model, fileIds, conversationId } = chatRequest;
  
  let history = buildChatHistory(chatRequest);

  if (conversationId) {
    const projectContext = await loadProjectContext(userId, conversationId);
    if (projectContext.length > 0) {
      history = [...projectContext, ...history];
    }
  }

  const files = await processFiles(fileIds);
  validateFilesForProvider(files, provider);

  const decryptedKey = await getDecryptedApiKey(userId, provider);

  try {
    let result: ChatResponse;

    if (provider === ApiProvider.OPENAI) {
      result = await openaiChat({
        apiKey: decryptedKey,
        model: model || 'gpt-5',
        messages: history.map(m => ({ role: m.role as any, content: m.content })),
        files: files.length > 0 ? files : undefined,
      });
    } else if (provider === ApiProvider.GEMINI) {
      result = await geminiChat({
        apiKey: decryptedKey,
        model: model || 'gemini-2.5-flash',
        messages: history.map(m => ({ role: m.role as any, content: m.content })),
        files: files.length > 0 ? files : undefined,
      });
    } else if (provider === ApiProvider.CLAUDE) {
      result = await claudeChat({
        apiKey: decryptedKey,
        model: model || 'claude-3-5-sonnet-latest',
        messages: history.map(m => ({ role: m.role as any, content: m.content })),
        files: files.length > 0 ? files : undefined,
      });
    } else {
      throw new Error('Invalid provider');
    }

    cleanupFiles(fileIds);
    return result;
  } catch (error) {
    cleanupFiles(fileIds);
    throw error;
  }
}

export async function chatStream(
  chatRequest: ChatRequest,
  callbacks: ChatStreamCallbacks
): Promise<void> {
  const { userId, provider, model, fileIds, conversationId } = chatRequest;
  
  let history = buildChatHistory(chatRequest);

  if (conversationId) {
    const projectContext = await loadProjectContext(userId, conversationId);
    if (projectContext.length > 0) {
      history = [...projectContext, ...history];
    }
  }

  const files = await processFiles(fileIds);
  validateFilesForProvider(files, provider);

  const decryptedKey = await getDecryptedApiKey(userId, provider);
  let fullText = '';

  try {
    if (provider === ApiProvider.OPENAI) {
      await openaiChatStream({
        apiKey: decryptedKey,
        model: model || 'gpt-5',
        messages: history.map(m => ({ role: m.role as any, content: m.content })),
        files: files.length > 0 ? files : undefined,
      }, {
        onChunk: (text) => {
          fullText += text;
          callbacks.onChunk(text);
        },
        onComplete: () => {
          cleanupFiles(fileIds);
          callbacks.onComplete(fullText);
        },
        onError: (error) => {
          cleanupFiles(fileIds);
          callbacks.onError(error);
        },
      });
    } else if (provider === ApiProvider.GEMINI) {
      await geminiChatStream({
        apiKey: decryptedKey,
        model: model || 'gemini-2.5-flash',
        messages: history.map(m => ({ role: m.role as any, content: m.content })),
        files: files.length > 0 ? files : undefined,
      }, {
        onChunk: (text) => {
          fullText += text;
          callbacks.onChunk(text);
        },
        onComplete: () => {
          cleanupFiles(fileIds);
          callbacks.onComplete(fullText);
        },
        onError: (error) => {
          cleanupFiles(fileIds);
          callbacks.onError(error);
        },
      });
    } else if (provider === ApiProvider.CLAUDE) {
      await claudeChatStream({
        apiKey: decryptedKey,
        model: model || 'claude-3-5-sonnet-latest',
        messages: history.map(m => ({ role: m.role as any, content: m.content })),
        files: files.length > 0 ? files : undefined,
      }, {
        onChunk: (text) => {
          fullText += text;
          callbacks.onChunk(text);
        },
        onComplete: () => {
          cleanupFiles(fileIds);
          callbacks.onComplete(fullText);
        },
        onError: (error) => {
          cleanupFiles(fileIds);
          callbacks.onError(error);
        },
      });
    } else {
      throw new Error('Invalid provider');
    }
  } catch (error) {
    cleanupFiles(fileIds);
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

export { parseProvider };
