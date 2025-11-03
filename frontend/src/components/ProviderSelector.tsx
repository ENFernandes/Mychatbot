import React from 'react';

interface ProviderSelectorProps {
  provider: 'openai' | 'gemini' | 'claude';
  onChange: (p: 'openai' | 'gemini' | 'claude') => void;
  availableProviders?: ('openai' | 'gemini' | 'claude')[];
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

const ProviderSelector: React.FC<ProviderSelectorProps> = ({ provider, onChange, availableProviders = ['openai', 'gemini', 'claude'] }) => {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', justifyContent: 'center' }}>
      {availableProviders.map((p) => {
        const icon = ProviderIcons[p];
        const name = ProviderNames[p];
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: `2px solid ${provider === p ? '#007bff' : '#ddd'}`,
              background: provider === p ? '#007bff' : 'white',
              color: provider === p ? 'white' : '#333',
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
    </div>
  );
};

export default ProviderSelector;


