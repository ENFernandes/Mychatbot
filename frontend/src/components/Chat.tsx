import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!conversationId) {
        setMessages([]);
        return;
      }
      try {
        const { data } = await api.get(`/conversations/${conversationId}/messages`);
        setMessages((data.messages || []).map((m: any) => ({ role: m.role, content: m.content })));
      } catch (e) {
        console.error('Error loading messages:', e);
        setMessages([]);
      }
    };
    loadMessages();
  }, [conversationId]);

  const sendMessage = async () => {
    if (!inputMessage.trim()) {
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: inputMessage.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage('');
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post('/chat', {
        provider,
        model,
        messages: newMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.message,
      };

      setMessages([...newMessages, assistantMessage]);

      // Persistence: create conversation if it doesn't exist and save messages
      try {
        let convId = conversationId;
        if (!convId) {
          const { data } = await api.post('/conversations', {});
          convId = data.id;
          onConversationChange(convId);
          // Trigger reload of conversations list by emitting custom event
          window.dispatchEvent(new CustomEvent('conversation-created'));
        }
        await api.post(`/conversations/${convId}/messages`, { role: 'user', content: userMessage.content });
        await api.post(`/conversations/${convId}/messages`, { role: 'assistant', content: assistantMessage.content });
      } catch (_) {
        // Ignore persistence failures to avoid blocking UX
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(
        err.response?.data?.error || 'Error communicating with the API. Please check your API keys.'
      );
      setMessages(newMessages.slice(0, -1));
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
    const regex = /(\*\*[^*]+\*\*)|(\_\_[^_]+\_\_)/g; // **bold** or __underline__
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
          <span key={`${keyBase}-${parts.length}`} style={{ textDecoration: 'underline' }}>
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
    const linkRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|((https?:\/\/[^\s)]+))/g; // [text](url) or raw url
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
          style={{ color: '#0d6efd', textDecoration: 'underline' }}
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
      const color = level === 1 ? '#0d6efd' : level === 2 ? '#20c997' : '#6f42c1';
      const size = level === 1 ? 18 : level === 2 ? 16 : 15;
      return (
        <div key={idx} style={{ marginBottom: 10, color, fontWeight: 700, fontSize: size }}>
          {inlineFormat(text)}
        </div>
      );
    }

    if (isList) {
      return (
        <ul key={idx} style={{ margin: '6px 0 10px 18px' }}>
          {lines.map((l, i) => (
            <li key={i} style={{ lineHeight: 1.5 }}>{inlineFormat(l.replace(/^[-\*]\s+/, ''))}</li>
          ))}
        </ul>
      );
    }

    return (
      <div key={idx} style={{ marginBottom: 10, lineHeight: 1.6 }}>{inlineFormat(block)}</div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          backgroundColor: '#f9f9f9',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#666',
              marginTop: '50px',
            }}
          >
            <p>Start a conversation by sending a message</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              style={{
                marginBottom: '15px',
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '12px 16px',
                  borderRadius: '18px',
                  backgroundColor: msg.role === 'user' ? '#007bff' : '#e9ecef',
                  color: msg.role === 'user' ? 'white' : '#333',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  overflowWrap: 'anywhere',
                }}
              >
                {msg.role === 'assistant'
                  ? msg.content
                      .split('\n\n')
                      .map((block, i) => renderAssistantBlock(block, i))
                  : msg.content}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              marginBottom: '15px',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '18px',
                backgroundColor: '#e9ecef',
                color: '#666',
              }}
            >
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div
          style={{
            padding: '10px 20px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderTop: '1px solid #f5c6cb',
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          padding: '15px',
          borderTop: '1px solid #ddd',
          display: 'flex',
          gap: '10px',
        }}
      >
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '12px',
            outline: 'none',
            minHeight: '60px',
            maxHeight: '200px',
            resize: 'vertical',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !inputMessage.trim()}
          style={{
            padding: '10px 20px',
            backgroundColor: !isLoading && inputMessage.trim() ? '#007bff' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            cursor: !isLoading && inputMessage.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;

