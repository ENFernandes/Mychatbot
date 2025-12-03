import React from 'react';

interface Workflow {
  id: string;
  name: string;
  model: string;
  isDefault: boolean;
}

interface ProviderSelectorProps {
  provider: 'openai' | 'gemini' | 'claude';
  onChange: (p: 'openai' | 'gemini' | 'claude') => void;
  availableProviders?: ('openai' | 'gemini' | 'claude')[];
  isAgentMode?: boolean;
  onAgentModeToggle?: () => void;
  hasOpenAIKey?: boolean;
  workflows?: Workflow[];
  selectedWorkflowId?: string | null;
  onWorkflowChange?: (workflowId: string | null) => void;
}

// Emojis como ícones simples e confiáveis
const ProviderIcons: Record<string, string> = {
  openai: '🤖',
  gemini: '✨',
  claude: '🧠',
};

const ProviderNames: Record<string, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  claude: 'Claude',
};

const ProviderSelector: React.FC<ProviderSelectorProps> = ({ 
  provider, 
  onChange, 
  availableProviders = ['openai', 'gemini', 'claude'],
  isAgentMode = false,
  onAgentModeToggle,
  hasOpenAIKey = false,
  workflows = [],
  selectedWorkflowId,
  onWorkflowChange,
}) => {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
      {availableProviders.map((p) => {
        const icon = ProviderIcons[p];
        const name = ProviderNames[p];
        const isSelected = provider === p && !isAgentMode;
        return (
          <button
            key={p}
            onClick={() => {
              if (isAgentMode && onAgentModeToggle) {
                onAgentModeToggle();
              }
              onChange(p);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: `2px solid ${isSelected ? '#007bff' : '#ddd'}`,
              background: isSelected ? '#007bff' : 'white',
              color: isSelected ? 'white' : '#333',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: '18px' }}>{icon}</span>
            <span>{name}</span>
          </button>
        );
      })}
      
      {/* Divider - only show if we have OpenAI key */}
      {hasOpenAIKey && onAgentModeToggle && (
        <div style={{ 
          width: '1px', 
          height: '32px', 
          background: '#ddd', 
          margin: '0 4px' 
        }} />
      )}
      
      {/* Agent Mode Button */}
      {hasOpenAIKey && onAgentModeToggle && (
        <button
          onClick={onAgentModeToggle}
          title="Agent Mode - Uses OpenAI Agents SDK for advanced AI workflows"
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: `2px solid ${isAgentMode ? '#8b5cf6' : '#ddd'}`,
            background: isAgentMode ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' : 'white',
            color: isAgentMode ? 'white' : '#333',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 600,
            transition: 'all 0.2s',
            boxShadow: isAgentMode ? '0 2px 8px rgba(139, 92, 246, 0.3)' : 'none',
          }}
        >
          <span style={{ fontSize: '18px' }}>🚀</span>
          <span>Agent</span>
        </button>
      )}

      {/* Workflow Selector - only show when Agent mode is active */}
      {isAgentMode && workflows.length > 0 && onWorkflowChange && (
        <select
          value={selectedWorkflowId || ''}
          onChange={(e) => onWorkflowChange(e.target.value || null)}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '2px solid #8b5cf6',
            background: 'white',
            color: '#333',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            minWidth: '160px',
            outline: 'none',
          }}
        >
          <option value="">Select Workflow...</option>
          {workflows.map((wf) => (
            <option key={wf.id} value={wf.id}>
              {wf.name} {wf.isDefault ? '★' : ''} ({wf.model})
            </option>
          ))}
        </select>
      )}

      {/* No workflows message */}
      {isAgentMode && workflows.length === 0 && (
        <span style={{ 
          fontSize: '12px', 
          color: '#8b5cf6', 
          padding: '8px 12px',
          background: 'rgba(139, 92, 246, 0.1)',
          borderRadius: '8px',
        }}>
          No workflows configured. Add one in Settings.
        </span>
      )}
    </div>
  );
};

export default ProviderSelector;
