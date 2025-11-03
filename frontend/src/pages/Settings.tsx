import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface ApiKey {
  provider: 'openai' | 'gemini' | 'claude';
  createdAt?: string;
}

const Settings: React.FC = () => {
  const [provider, setProvider] = useState<'openai' | 'gemini' | 'claude'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeKeys, setActiveKeys] = useState<ApiKey[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    loadActiveKeys();
  }, [refreshTrigger]);

  const loadActiveKeys = async () => {
    try {
      const { data } = await api.get('/user/keys');
      setActiveKeys(data.keys || []);
    } catch (e) {
      console.error('Error loading keys:', e);
    }
  };

  const addClient = async () => {
    if (!apiKey.trim()) return;
    
    setLoading(true);
    try {
      await api.put('/user/keys', { provider, apiKey: apiKey.trim() });
      setApiKey('');
      setRefreshTrigger(prev => prev + 1);
    } catch (e) {
      alert('Error saving API key');
    } finally {
      setLoading(false);
    }
  };

  const removeClient = async (providerToRemove: string) => {
    setLoading(true);
    try {
      await api.delete(`/user/keys/${providerToRemove}`);
      setRefreshTrigger(prev => prev + 1);
    } catch (e) {
      alert('Error deleting API key');
    } finally {
      setLoading(false);
    }
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'openai': return 'OpenAI';
      case 'gemini': return 'Gemini';
      case 'claude': return 'Claude';
      default: return provider;
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      gap: '20px', 
      height: '100%',
      maxWidth: '1000px',
      margin: '0 auto'
    }}>
      <div style={{
        width: '300px',
        background: 'white',
        border: '3px solid #000',
        borderRadius: '8px',
        padding: '20px',
        height: 'fit-content'
      }}>
        <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 'bold' }}>add Client</h3>
        
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as 'openai' | 'gemini' | 'claude')}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            marginBottom: '12px',
            border: '2px solid #000',
            borderRadius: '4px',
            fontSize: '14px',
            background: 'white'
          }}
        >
          <option value="openai">OpenAI</option>
          <option value="gemini">Gemini</option>
          <option value="claude">Claude</option>
        </select>

        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API Key"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            marginBottom: '20px',
            border: '2px solid #000',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />

        <button
          onClick={addClient}
          disabled={loading || !apiKey.trim()}
          style={{
            width: '100%',
            padding: '12px',
            background: '#000',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: loading || !apiKey.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !apiKey.trim() ? 0.5 : 1
          }}
        >
          {loading ? 'Adding...' : 'Add Client'}
        </button>
      </div>

      <div style={{
        flex: 1,
        background: 'white',
        border: '3px solid #000',
        borderRadius: '8px',
        padding: '20px',
        height: 'fit-content',
        minHeight: '300px'
      }}>
        <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 'bold' }}>client list ative</h3>
        
        {activeKeys.length === 0 ? (
          <p style={{ color: '#666', textAlign: 'center', marginTop: '40px' }}>No active clients</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeKeys.map((key) => (
              <div
                key={key.provider}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  border: '2px solid #000',
                  borderRadius: '4px',
                  background: 'white'
                }}
              >
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                  {getProviderLabel(key.provider)}
                </span>
                <button
                  onClick={() => removeClient(key.provider)}
                  disabled={loading}
                  style={{
                    padding: '6px 12px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.5 : 1
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;


