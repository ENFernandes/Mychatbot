import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import './Chat.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  provider?: 'openai' | 'gemini' | 'claude';
}

interface ChatProps {
  provider: 'openai' | 'gemini' | 'claude';
  model: string;
  conversationId: string | null;
  onConversationChange: (id: string | null) => void;
}

const Chat: React.FC<ChatProps> = ({ provider, model, conversationId, onConversationChange }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Provider icons mapping
  const getProviderIcon = (provider?: 'openai' | 'gemini' | 'claude'): string => {
    const icons: Record<string, string> = {
      openai: '🤖',
      gemini: '✨',
      claude: '🧠',
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

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) {
      return;
    }

    const previousMessages = messages;
    const trimmedInput = inputMessage.trim();
    const userMessage: Message = {
      role: 'user',
      content: trimmedInput,
    };

    const optimisticMessages = [...previousMessages, userMessage];
    setMessages(optimisticMessages);
    setInputMessage('');
    setError(null);
    setIsLoading(true);

    let convId = conversationId;
    let createdConversationId: string | null = null;

    try {
      if (!convId) {
        const { data } = await api.post('/conversations', {});
        convId = data.id;
        createdConversationId = convId;
        onConversationChange(convId);
        window.dispatchEvent(new CustomEvent('conversation-created'));
      }

      await api.post(`/conversations/${convId}/messages`, {
        role: 'user',
        content: userMessage.content,
      });

      const response = await api.post('/chat', {
        provider,
        model,
        messages: optimisticMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.message,
        provider: provider,
      };

      const fullConversation = [...optimisticMessages, assistantMessage];
      setMessages(fullConversation);

      try {
        await api.post(`/conversations/${convId}/messages`, {
          role: 'assistant',
          content: assistantMessage.content,
          provider: provider,
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

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="empty-icon">💬</div>
            <h2 className="empty-title">Start a conversation</h2>
            <p className="empty-description">
              Send a message to begin chatting with {model}
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
            <div className="message-avatar">{getProviderIcon(provider)}</div>
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
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isLoading}
            className="chat-input"
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="chat-send-button"
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M18 2L9 11M18 2L12 18L9 11M18 2L2 8L9 11"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <div className="chat-footer">
          <span className="chat-shortcut">Press Enter to send, Shift+Enter for new line</span>
        </div>
      </div>
    </div>
  );
};

export default Chat;
