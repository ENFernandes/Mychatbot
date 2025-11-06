import React, { useState, useEffect } from 'react';

interface ApiKeyConfigProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

const ApiKeyConfig: React.FC<ApiKeyConfigProps> = ({ apiKey, onApiKeyChange }) => {
  const [localKey, setLocalKey] = useState(apiKey);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setLocalKey(apiKey);
  }, [apiKey]);

  const handleSave = () => {
    if (localKey.trim()) {
      localStorage.setItem('openai_api_key', localKey.trim());
      onApiKeyChange(localKey.trim());
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    localStorage.removeItem('openai_api_key');
    setLocalKey('');
    onApiKeyChange('');
    setIsOpen(false);
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        {apiKey ? 'Change API Key' : 'Configure API Key'}
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: '10px',
            padding: '15px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            OpenAI API Key:
          </label>
          <input
            type="password"
            value={localKey}
            onChange={(e) => setLocalKey(e.target.value)}
            placeholder="sk-..."
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              marginBottom: '10px',
            }}
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Save
            </button>
            {apiKey && (
              <button
                onClick={handleClear}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
          {apiKey && (
            <p style={{ marginTop: '10px', fontSize: '12px', color: '#28a745' }}>
              API Key configured ✓
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ApiKeyConfig;

