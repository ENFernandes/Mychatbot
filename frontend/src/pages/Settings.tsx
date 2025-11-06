import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import './Settings.css';

interface ApiKey {
  provider: 'openai' | 'gemini' | 'claude';
  createdAt?: string;
}

interface SettingsProps {
  onBackToChat?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBackToChat }) => {
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
    if (!confirm(`Are you sure you want to remove ${getProviderLabel(providerToRemove)}?`)) {
      return;
    }
    
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

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'openai': return '🤖';
      case 'gemini': return '💎';
      case 'claude': return '🧠';
      default: return '🔑';
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          {onBackToChat && (
            <button 
              onClick={onBackToChat}
              className="btn-back"
              aria-label="Back to chat"
            >
              ←
            </button>
          )}
          <h1 className="settings-title">Settings</h1>
        </div>
        <p className="settings-subtitle">Manage your API keys and preferences</p>
      </div>

      <div className="settings-content">
        {/* Add Client Card */}
        <div className="settings-card add-client-card">
          <div className="card-header">
            <h2 className="card-title">Add API Key</h2>
            <p className="card-description">Add a new API key for your preferred AI provider</p>
          </div>
          
          <div className="form-group">
            <label htmlFor="provider-select" className="form-label">Provider</label>
            <select
              id="provider-select"
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'openai' | 'gemini' | 'claude')}
              disabled={loading}
              className="form-select"
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
              <option value="claude">Claude</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="api-key-input" className="form-label">API Key</label>
            <input
              id="api-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              disabled={loading}
              className="form-input"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && apiKey.trim() && !loading) {
                  addClient();
                }
              }}
            />
          </div>

          <button
            onClick={addClient}
            disabled={loading || !apiKey.trim()}
            className="btn btn-primary btn-full"
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Adding...
              </>
            ) : (
              <>
                <span>+</span>
                Add Client
              </>
            )}
          </button>
        </div>

        {/* Active Clients Card */}
        <div className="settings-card active-clients-card">
          <div className="card-header">
            <h2 className="card-title">Active API Keys</h2>
            <p className="card-description">
              {activeKeys.length === 0 
                ? 'No active API keys. Add one to get started.'
                : `${activeKeys.length} active key${activeKeys.length > 1 ? 's' : ''}`
              }
            </p>
          </div>
          
          {activeKeys.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔑</div>
              <p className="empty-text">No active clients</p>
              <p className="empty-subtext">Add your first API key to start using the platform</p>
            </div>
          ) : (
            <div className="keys-list">
              {activeKeys.map((key) => (
                <div key={key.provider} className="key-item">
                  <div className="key-info">
                    <div className="key-icon">{getProviderIcon(key.provider)}</div>
                    <div className="key-details">
                      <span className="key-provider">{getProviderLabel(key.provider)}</span>
                      {key.createdAt && (
                        <span className="key-date">
                          Added {new Date(key.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeClient(key.provider)}
                    disabled={loading}
                    className="btn btn-danger btn-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
