import { useState, useCallback, useRef } from 'react';
import { api, uploadFile } from '../services/api';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  fileIds?: string[];
  filenames?: string[];
}

interface UseChatProps {
  provider: string;
  model: string;
  conversationId: string | null;
  onConversationChange: (id: string | null) => void;
  activeProjectId?: string | null;
}

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
  sendMessage: (content: string, files?: File[]) => Promise<void>;
  clearMessages: () => void;
  abortRequest: () => void;
}

export function useChat({
  provider,
  model,
  conversationId,
  onConversationChange,
  activeProjectId,
}: UseChatProps): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const loadMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    try {
      const { data } = await api.get(`/conversations/${conversationId}/messages`);
      setMessages(
        (data.messages || []).map((m: any) => ({
          role: m.role,
          content: m.content,
          provider: m.provider,
        }))
      );
    } catch (e) {
      console.error('Error loading messages:', e);
      setMessages([]);
    }
  }, [conversationId]);

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];

    setIsUploading(true);
    const uploadedIds: string[] = [];

    try {
      for (const file of files) {
        const response = await uploadFile(file);
        uploadedIds.push(response.id);
      }
      return uploadedIds;
    } finally {
      setIsUploading(false);
    }
  };

  const sendMessage = useCallback(
    async (content: string, files?: File[]) => {
      if ((!content.trim() && (!files || files.length === 0)) || isLoading || isUploading) {
        return;
      }

      const previousMessages = messages;
      let fileIds: string[] = [];
      const filenames: string[] = [];

      if (files && files.length > 0) {
        try {
          fileIds = await uploadFiles(files);
          for (const file of files) {
            filenames.push(file.name);
          }
        } catch (err) {
          setError('Failed to upload files. Please try again.');
          return;
        }
      }

      const userMessage: Message = {
        role: 'user',
        content: content.trim(),
        fileIds: fileIds.length > 0 ? fileIds : undefined,
        filenames: filenames.length > 0 ? filenames : undefined,
      };

      const optimisticMessages = [...previousMessages, userMessage];
      setMessages(optimisticMessages);
      setError(null);
      setIsLoading(true);

      let convId = conversationId;
      let createdConversationId: string | null = null;

      try {
        if (!convId) {
          const payload: { projectId?: string } = {};
          if (activeProjectId) {
            payload.projectId = activeProjectId;
          }
          const { data } = await api.post('/conversations', payload);
          convId = data.id;
          createdConversationId = convId;
          onConversationChange(convId);
          window.dispatchEvent(new CustomEvent('conversation-created'));
        }

        await api.post(`/conversations/${convId}/messages`, {
          role: 'user',
          content: userMessage.content,
        });

        abortControllerRef.current = new AbortController();
        let fullResponse = '';

        setMessages((prev) => [...prev, { role: 'assistant', content: '', provider }]);

        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            provider,
            model,
            messages: optimisticMessages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            stream: true,
            conversationId: convId,
            fileIds: fileIds.length > 0 ? fileIds : undefined,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(errorData.error || 'Request failed');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const event = JSON.parse(line.slice(6));
                  if (event.type === 'chunk') {
                    fullResponse += event.text;
                    setMessages((prev) =>
                      prev.map((msg, idx) =>
                        idx === prev.length - 1 ? { ...msg, content: fullResponse } : msg
                      )
                    );
                  } else if (event.type === 'error') {
                    throw new Error(event.error);
                  }
                } catch (e) {}
              }
            }
          }
        }

        if (fullResponse) {
          await api.post(`/conversations/${convId}/messages`, {
            role: 'assistant',
            content: fullResponse,
            provider,
          });
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('Request aborted');
        } else {
          console.error('Error sending message:', err);

          if (createdConversationId) {
            try {
              await api.delete(`/conversations/${createdConversationId}`);
              window.dispatchEvent(new CustomEvent('conversation-created'));
            } catch (cleanupError) {
              console.error('Error deleting conversation:', cleanupError);
            }
            onConversationChange(null);
          }

          setMessages(previousMessages);
          setError(err.response?.data?.error || err.message || 'Error communicating with the API');
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [messages, isLoading, isUploading, provider, model, conversationId, activeProjectId, onConversationChange]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const abortRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    messages,
    isLoading,
    isUploading,
    error,
    sendMessage,
    clearMessages,
    abortRequest,
  };
}
