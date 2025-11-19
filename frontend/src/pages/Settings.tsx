import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import './Settings.css';

interface ApiKey {
  provider: 'openai' | 'gemini' | 'claude';
  createdAt?: string;
}

interface SettingsProps {
  onBackToChat?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBackToChat }) => {
  const { plan, subscriptionStatus, trialEndsAt, currentPeriodEnd, token } = useAuth();
  const [provider, setProvider] = useState<'openai' | 'gemini' | 'claude'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeKeys, setActiveKeys] = useState<ApiKey[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [billingLoading, setBillingLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    provider: string | null;
  }>({ isOpen: false, provider: null });
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
  }>({ isOpen: false });
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    if (token) {
      loadActiveKeys();
    }
  }, [refreshTrigger, token]);

  const loadActiveKeys = async () => {
    if (!token) {
      console.warn('No token available, skipping API keys load');
      return;
    }
    try {
      const { data } = await api.get('/user/keys');
      setActiveKeys(data.keys || []);
    } catch (e: any) {
      console.error('Error loading keys:', e);
      // If 401, token might be expired - don't show error to user
      if (e?.response?.status === 401) {
        console.warn('Unauthorized - token may be expired');
      }
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
    setConfirmModal({ isOpen: true, provider: providerToRemove });
  };

  const handleConfirmRemove = async () => {
    if (!confirmModal.provider) return;
    
    setLoading(true);
    setConfirmModal({ isOpen: false, provider: null });
    try {
      await api.delete(`/user/keys/${confirmModal.provider}`);
      setRefreshTrigger(prev => prev + 1);
    } catch (e) {
      alert('Error deleting API key');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRemove = () => {
    setConfirmModal({ isOpen: false, provider: null });
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

  const startCheckout = async () => {
    try {
      setBillingLoading(true);
      const { data } = await api.post('/billing/checkout');
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert('Unable to start subscription checkout. Please try again later.');
    } finally {
      setBillingLoading(false);
    }
  };

  const openPortal = async () => {
    try {
      setBillingLoading(true);
      const { data } = await api.post('/billing/portal');
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert('Unable to open billing portal. Please try again later.');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleCancelSubscription = () => {
    setCancelModal({ isOpen: true });
  };

  const confirmCancelSubscription = async () => {
    try {
      setCancelLoading(true);
      setCancelModal({ isOpen: false });
      const { data } = await api.post('/billing/cancel');
      alert(data.message || 'Subscription cancellation scheduled successfully.');
      // Refresh user data to update subscription status
      window.location.reload();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Unable to cancel subscription. Please try again later.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCancelModalClose = () => {
    setCancelModal({ isOpen: false });
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
      </div>

      <div className="settings-content">
        <div className="settings-card subscription-card">
          <div className="card-header">
            <h2 className="card-title">Subscription</h2>
            <p className="card-description">
              {plan === 'pro' ? 'You have access to all pro features.' : 'You are currently on the trial plan.'}
            </p>
          </div>

          <div className="subscription-details">
            <div className="subscription-row">
              <span className="subscription-label">Plan</span>
              <span className={`subscription-value ${plan === 'pro' ? 'is-pro' : ''}`}>{plan === 'pro' ? 'Pro' : 'Trial'}</span>
            </div>
            {subscriptionStatus && (
              <div className="subscription-row">
                <span className="subscription-label">Status</span>
                <span className="subscription-value">{subscriptionStatus.replace(/_/g, ' ')}</span>
              </div>
            )}
            {trialEndsAt && (
              <div className="subscription-row">
                <span className="subscription-label">Trial Ends</span>
                <span className="subscription-value">{new Date(trialEndsAt).toLocaleString()}</span>
              </div>
            )}
            {currentPeriodEnd && (
              <div className="subscription-row">
                <span className="subscription-label">Current Period</span>
                <span className="subscription-value">{new Date(currentPeriodEnd).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="subscription-actions">
            {plan === 'pro' ? (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={openPortal} disabled={billingLoading}>
                  Manage subscription
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={handleCancelSubscription} 
                  disabled={billingLoading || cancelLoading}
                >
                  Cancel subscription
                </button>
              </div>
            ) : (
              <button className="btn btn-primary" onClick={startCheckout} disabled={billingLoading}>
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>

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

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Remove API Key"
        message={`Are you sure you want to remove ${confirmModal.provider ? getProviderLabel(confirmModal.provider) : ''}?`}
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleConfirmRemove}
        onCancel={handleCancelRemove}
        variant="danger"
      />

      <ConfirmModal
        isOpen={cancelModal.isOpen}
        title="Cancel Subscription"
        message="Are you sure you want to cancel your subscription? Your subscription will remain active until the end of the current billing period, after which you will lose access to Pro features."
        confirmText="Yes, cancel subscription"
        cancelText="Keep subscription"
        onConfirm={confirmCancelSubscription}
        onCancel={handleCancelModalClose}
        variant="danger"
      />
    </div>
  );
};

export default Settings;
