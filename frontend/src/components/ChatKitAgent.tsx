import React, { useEffect, useRef } from 'react';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { api } from '../services/api';
import './ChatKitAgent.css';

interface ChatKitAgentProps {
  workflowId: string | null;
  conversationId: string | null;
  onConversationChange: (id: string | null) => void;
}

const ChatKitAgent: React.FC<ChatKitAgentProps> = ({ 
  workflowId, 
  conversationId,
  onConversationChange: _onConversationChange 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  const { control } = useChatKit({
    api: {
      async getClientSecret(existing) {
        if (existing) {
          return existing;
        }

        if (!workflowId) {
          const errorMsg = 'Please select a workflow to use Agent mode';
          setError(errorMsg);
          throw new Error(errorMsg);
        }

        try {
          setError(null);
          const res = await api.post('/chatkit/session', {
            workflowId,
          });
          return res.data.client_secret;
        } catch (error: any) {
          console.error('Error getting ChatKit client secret:', error);
          const errorMsg = error.response?.data?.error || 
            error.response?.data?.message || 
            'Failed to create ChatKit session';
          setError(errorMsg);
          throw new Error(errorMsg);
        }
      },
    },
  });

  // Handle conversation changes if needed
  useEffect(() => {
    // ChatKit manages its own conversation state
    // We can sync with our conversationId if needed
  }, [conversationId]);

  if (!workflowId) {
    return (
      <div className="chatkit-agent-container" ref={containerRef}>
        <div className="chatkit-error">
          <div className="error-icon">⚠️</div>
          <h2>No Workflow Selected</h2>
          <p>Please select a workflow from the dropdown above to use Agent mode.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chatkit-agent-container" ref={containerRef}>
        <div className="chatkit-error">
          <div className="error-icon">⚠️</div>
          <h2>Error Loading ChatKit</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chatkit-agent-container" ref={containerRef}>
      <ChatKit 
        control={control} 
        className="chatkit-widget"
      />
    </div>
  );
};

export default ChatKitAgent;

