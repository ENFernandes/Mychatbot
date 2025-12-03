import React, { useState, useRef, useEffect } from 'react';
import { api, uploadFile } from '../services/api';
import FileUpload, { UploadedFile } from './FileUpload';
import './Chat.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  provider?: 'openai' | 'gemini' | 'claude' | 'agent';
  fileIds?: string[];
  filenames?: string[];
}

interface ChatProps {
  provider: 'openai' | 'gemini' | 'claude';
  model: string;
  conversationId: string | null;
  onConversationChange: (id: string | null) => void;
  workflowId?: string | null;
  isAgentMode?: boolean;
  selectedWorkflowId?: string | null;
  activeProjectId?: string | null;
}

const Chat: React.FC<ChatProps> = ({ provider, model, conversationId, onConversationChange, workflowId, isAgentMode = false, selectedWorkflowId, activeProjectId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Provider icons mapping
  const getProviderIcon = (provider?: 'openai' | 'gemini' | 'claude' | 'agent'): string => {
    const icons: Record<string, string> = {
      openai: '🤖',
      gemini: '✨',
      claude: '🧠',
      agent: '🚀',
    };
    return provider ? (icons[provider] || '🤖') : '🤖';
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!conversationId) {
        setMessages([]);
        return;
      }
      try {
        const { data } = await api.get(`/conversations/${conversationId}/messages`);
        setMessages((data.messages || []).map((m: any) => ({ role: m.role, content: m.content, provider: m.provider })));
      } catch (e) {
        console.error('Error loading messages:', e);
        setMessages([]);
      }
    };
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputMessage]);

  // Clear attached files when provider changes
  useEffect(() => {
    setAttachedFiles([]);
  }, [provider]);

  const uploadAllFiles = async (): Promise<string[]> => {
    const pendingFiles = attachedFiles.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) {
      // Return IDs of already uploaded files
      return attachedFiles
        .filter((f) => f.status === 'uploaded' && !f.id.startsWith('temp-'))
        .map((f) => f.id);
    }

    setIsUploading(true);
    const uploadedIds: string[] = [];

    // Update all pending files to uploading status
    setAttachedFiles((prev) =>
      prev.map((f) => (f.status === 'pending' ? { ...f, status: 'uploading' as const } : f))
    );

    for (const fileItem of pendingFiles) {
      try {
        const response = await uploadFile(fileItem.file);
        uploadedIds.push(response.id);

        // Update file status to uploaded with the server ID
        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? { ...f, id: response.id, status: 'uploaded' as const }
              : f
          )
        );
      } catch (err: any) {
        console.error('Error uploading file:', err);
        // Update file status to error
        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? { ...f, status: 'error' as const, error: err.message || 'Upload failed' }
              : f
          )
        );
      }
    }

    setIsUploading(false);

    // Get all successfully uploaded file IDs
    return [
      ...uploadedIds,
      ...attachedFiles
        .filter((f) => f.status === 'uploaded' && !f.id.startsWith('temp-'))
        .map((f) => f.id),
    ];
  };

  const sendMessage = async () => {
    if ((!inputMessage.trim() && attachedFiles.length === 0) || isLoading || isUploading) {
      return;
    }

    const previousMessages = messages;
    const trimmedInput = inputMessage.trim();

    // Upload files first
    let fileIds: string[] = [];
    const filenames: string[] = attachedFiles.map((f) => f.filename);

    if (attachedFiles.length > 0) {
      try {
        fileIds = await uploadAllFiles();
        if (fileIds.length === 0 && attachedFiles.some((f) => f.status === 'error')) {
          setError('Failed to upload some files. Please try again.');
          return;
        }
      } catch (err) {
        setError('Failed to upload files. Please try again.');
        return;
      }
    }

    const userMessage: Message = {
      role: 'user',
      content: trimmedInput || (filenames.length > 0 ? `[Attached files: ${filenames.join(', ')}]` : ''),
      fileIds: fileIds.length > 0 ? fileIds : undefined,
      filenames: filenames.length > 0 ? filenames : undefined,
    };

    const optimisticMessages = [...previousMessages, userMessage];
    setMessages(optimisticMessages);
    setInputMessage('');
    setAttachedFiles([]); // Clear attached files after sending
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

      let response;
      
      if (isAgentMode) {
        // Use the Agent workflow endpoint
        response = await api.post('/workflows/run', {
          message: userMessage.content,
          workflowId: selectedWorkflowId || undefined,
        });
      } else {
        const chatPayload: any = {
          provider,
          model,
          messages: optimisticMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        };

        // Add conversationId for project context
        if (convId) {
          chatPayload.conversationId = convId;
        }

        // Add file IDs if present
        if (fileIds.length > 0) {
          chatPayload.fileIds = fileIds;
        }

        // If workflowId is provided, add it to the payload
        if (workflowId) {
          chatPayload.workflowId = workflowId;
        }

        response = await api.post('/chat', chatPayload);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.message,
        provider: isAgentMode ? 'agent' : provider,
      };

      const fullConversation = [...optimisticMessages, assistantMessage];
      setMessages(fullConversation);

      try {
        await api.post(`/conversations/${convId}/messages`, {
          role: 'assistant',
          content: assistantMessage.content,
          provider: isAgentMode ? 'agent' : provider,
        });
      } catch (persistError) {
        console.error('Error saving assistant message:', persistError);
      }
    } catch (err: any) {
      console.error('Error sending message:', err);

      if (createdConversationId) {
        try {
          await api.delete(`/conversations/${createdConversationId}`);
          window.dispatchEvent(new CustomEvent('conversation-created'));
        } catch (cleanupError) {
          console.error('Error deleting conversation after failure:', cleanupError);
        }
        onConversationChange(null);
      }

      setMessages(previousMessages);
      setError(
        err.response?.data?.error || 'Error communicating with the API. Please check your API keys.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatBoldUnderline = (segment: string, keyBase: number) => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*[^*]+\*\*)|(\_\_[^_]+\_\_)/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = regex.exec(segment)) !== null) {
      if (match.index > lastIndex) {
        parts.push(segment.slice(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**')) {
        parts.push(<strong key={`${keyBase}-${parts.length}`}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('__')) {
        parts.push(
          <span key={`${keyBase}-${parts.length}`} className="underline">
            {token.slice(2, -2)}
          </span>
        );
      }
      lastIndex = match.index + token.length;
    }
    if (lastIndex < segment.length) {
      parts.push(segment.slice(lastIndex));
    }
    return parts;
  };

  const inlineFormat = (text: string) => {
    const out: React.ReactNode[] = [];
    const linkRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|((https?:\/\/[^\s)]+))/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const before = text.slice(lastIndex, match.index);
        out.push(...formatBoldUnderline(before, out.length));
      }
      const mdFull = match[1];
      const mdText = match[2];
      const mdUrl = match[3];
      const rawUrl = match[5];
      const url = mdUrl || rawUrl || '';
      let label = mdText || '';
      if (!label) {
        try {
          const u = new URL(url);
          label = u.hostname.replace(/^www\./, '');
        } catch (_) {
          label = url;
        }
      }
      out.push(
        <a
          key={`a-${out.length}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="message-link"
        >
          {label}
        </a>
      );
      lastIndex = match.index + (mdFull ? mdFull.length : rawUrl!.length);
    }
    if (lastIndex < text.length) {
      out.push(...formatBoldUnderline(text.slice(lastIndex), out.length));
    }
    return <>{out}</>;
  };

  const renderAssistantBlock = (block: string, idx: number) => {
    const lines = block.split('\n').filter((l) => l.trim().length > 0);
    const isList = lines.every((l) => /^[-\*]\s+/.test(l));
    const headingMatch = /^(#{1,3})\s+(.*)/.exec(lines[0] || '');

    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      return (
        <div key={idx} className={`message-heading message-heading-${level}`}>
          {inlineFormat(text)}
        </div>
      );
    }

    if (isList) {
      return (
        <ul key={idx} className="message-list">
          {lines.map((l, i) => (
            <li key={i}>{inlineFormat(l.replace(/^[-\*]\s+/, ''))}</li>
          ))}
        </ul>
      );
    }

    return (
      <div key={idx} className="message-paragraph">{inlineFormat(block)}</div>
    );
  };

  const renderFileAttachments = (filenames?: string[]) => {
    if (!filenames || filenames.length === 0) return null;
    return (
      <div className="message-files">
        {filenames.map((filename, idx) => (
          <span key={idx} className="message-file-tag">
            📎 {filename}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="empty-icon">{isAgentMode ? '🚀' : '💬'}</div>
            <h2 className="empty-title">{isAgentMode ? 'Agent Mode Active' : 'Start a conversation'}</h2>
            <p className="empty-description">
              {isAgentMode 
                ? 'Send a message to interact with the AI Agent (powered by OpenAI Agents SDK)'
                : `Send a message to begin chatting with ${model}`
              }
            </p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`message-wrapper message-${msg.role}`}
            >
              <div className="message-avatar">
                {msg.role === 'user' ? '👤' : getProviderIcon(msg.provider || provider)}
              </div>
              <div className="message-content">
                {msg.role === 'user' && renderFileAttachments(msg.filenames)}
                <div className="message-bubble">
                  {msg.role === 'assistant'
                    ? msg.content
                        .split('\n\n')
                        .map((block, i) => renderAssistantBlock(block, i))
                    : msg.content}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="message-wrapper message-assistant">
            <div className="message-avatar">{getProviderIcon(isAgentMode ? 'agent' : provider)}</div>
            <div className="message-content">
              <div className="message-bubble message-typing">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="chat-error">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
        </div>
      )}

      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <FileUpload
            files={attachedFiles}
            onFilesChange={setAttachedFiles}
            disabled={isLoading || isUploading}
            provider={provider}
          />
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachedFiles.length > 0 ? "Add a message or send files..." : "Type your message..."}
            disabled={isLoading || isUploading}
            className="chat-input"
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || isUploading || (!inputMessage.trim() && attachedFiles.length === 0)}
            className="chat-send-button"
            aria-label="Send message"
          >
            {isUploading ? (
              <div className="send-spinner"></div>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M18 2L9 11M18 2L12 18L9 11M18 2L2 8L9 11"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
        <div className="chat-footer">
          <span className="chat-shortcut">Press Enter to send, Shift+Enter for new line</span>
          {attachedFiles.length > 0 && (
            <span className="chat-file-count">
              {attachedFiles.length} file{attachedFiles.length > 1 ? 's' : ''} attached
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
