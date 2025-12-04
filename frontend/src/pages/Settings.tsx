import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import './Settings.css';

interface ApiKey {
  provider: 'openai' | 'gemini' | 'claude';
  createdAt?: string;
}

interface Workflow {
  id: string;
  name: string;
  maskedWorkflowId?: string;
  instructions?: string;
  isDefault: boolean;
  createdAt: string;
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

  // Workflow states
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [workflowInstructions, setWorkflowInstructions] = useState('');
  const [workflowIsDefault, setWorkflowIsDefault] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<string | null>(null);
  const [workflowConfirmModal, setWorkflowConfirmModal] = useState<{
    isOpen: boolean;
    workflowId: string | null;
    workflowName: string | null;
  }>({ isOpen: false, workflowId: null, workflowName: null });

  useEffect(() => {
    if (token) {
      loadActiveKeys();
      loadWorkflows();
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
      if (e?.response?.status === 401) {
        console.warn('Unauthorized - token may be expired');
      }
    }
  };

  const loadWorkflows = async () => {
    if (!token) return;
    try {
      const { data } = await api.get('/workflows');
      setWorkflows(data.workflows || []);
    } catch (e: any) {
      console.error('Error loading workflows:', e);
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

  // Workflow handlers
  const addWorkflow = async () => {
    if (!workflowName.trim() || !workflowId.trim()) return;
    
    setWorkflowLoading(true);
    try {
      if (editingWorkflow) {
        await api.put(`/workflows/${editingWorkflow}`, {
          name: workflowName.trim(),
          workflowId: workflowId.trim(),
          instructions: workflowInstructions.trim() || null,
          isDefault: workflowIsDefault,
        });
      } else {
        await api.post('/workflows', {
          name: workflowName.trim(),
          workflowId: workflowId.trim(),
          instructions: workflowInstructions.trim() || null,
          isDefault: workflowIsDefault,
        });
      }
      resetWorkflowForm();
      setRefreshTrigger(prev => prev + 1);
    } catch (e) {
      alert('Error saving workflow');
    } finally {
      setWorkflowLoading(false);
    }
  };

  const editWorkflow = (workflow: Workflow) => {
    setEditingWorkflow(workflow.id);
    setWorkflowName(workflow.name);
    setWorkflowId(''); // Cannot retrieve encrypted ID
    setWorkflowInstructions(workflow.instructions || '');
    setWorkflowIsDefault(workflow.isDefault);
  };

  const resetWorkflowForm = () => {
    setEditingWorkflow(null);
    setWorkflowName('');
    setWorkflowId('');
    setWorkflowInstructions('');
    setWorkflowIsDefault(false);
  };

  const removeWorkflow = async (id: string, name: string) => {
    setWorkflowConfirmModal({ isOpen: true, workflowId: id, workflowName: name });
  };

  const handleConfirmWorkflowRemove = async () => {
    if (!workflowConfirmModal.workflowId) return;
    
    setWorkflowLoading(true);
    setWorkflowConfirmModal({ isOpen: false, workflowId: null, workflowName: null });
    try {
      await api.delete(`/workflows/${workflowConfirmModal.workflowId}`);
      setRefreshTrigger(prev => prev + 1);
    } catch (e) {
      alert('Error deleting workflow');
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleCancelWorkflowRemove = () => {
    setWorkflowConfirmModal({ isOpen: false, workflowId: null, workflowName: null });
  };

  const setDefaultWorkflow = async (id: string) => {
    setWorkflowLoading(true);
    try {
      await api.put(`/workflows/${id}`, { isDefault: true });
      setRefreshTrigger(prev => prev + 1);
    } catch (e) {
      alert('Error setting default workflow');
    } finally {
      setWorkflowLoading(false);
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

  const hasOpenAIKey = activeKeys.some(k => k.provider === 'openai');

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
              <button className="btn btn-secondary" onClick={openPortal} disabled={billingLoading}>
                Manage subscription
              </button>
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

        {/* Agent Workflows Card */}
        <div className="settings-card workflows-card">
          <div className="card-header">
            <h2 className="card-title">🚀 Agent Workflows</h2>
            <p className="card-description">
              {!hasOpenAIKey 
                ? 'Add an OpenAI API key to use Agent workflows'
                : 'Configure your OpenAI Agent workflows for advanced AI interactions'
              }
            </p>
          </div>

          {hasOpenAIKey && (
            <>
              <div className="form-group">
                <label htmlFor="workflow-name" className="form-label">Workflow Name</label>
                <input
                  id="workflow-name"
                  type="text"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder="e.g., Project Manager Agent"
                  disabled={workflowLoading}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="workflow-id" className="form-label">
                  Workflow ID {editingWorkflow && <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(leave empty to keep current)</span>}
                </label>
                <input
                  id="workflow-id"
                  type="password"
                  value={workflowId}
                  onChange={(e) => setWorkflowId(e.target.value)}
                  placeholder="wf_xxxxxxxxxxxxxxxxxxxx"
                  disabled={workflowLoading}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="workflow-instructions" className="form-label">Instructions (optional)</label>
                <textarea
                  id="workflow-instructions"
                  value={workflowInstructions}
                  onChange={(e) => setWorkflowInstructions(e.target.value)}
                  placeholder="You are a helpful AI assistant..."
                  disabled={workflowLoading}
                  className="form-input"
                  rows={3}
                  style={{ resize: 'vertical', minHeight: '80px' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  id="workflow-default"
                  type="checkbox"
                  checked={workflowIsDefault}
                  onChange={(e) => setWorkflowIsDefault(e.target.checked)}
                  disabled={workflowLoading}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="workflow-default" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>
                  Set as default workflow
                </label>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={addWorkflow}
                  disabled={workflowLoading || !workflowName.trim() || (!workflowId.trim() && !editingWorkflow)}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  {workflowLoading ? (
                    <>
                      <span className="spinner"></span>
                      {editingWorkflow ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    <>
                      <span>{editingWorkflow ? '✓' : '+'}</span>
                      {editingWorkflow ? 'Update Workflow' : 'Add Workflow'}
                    </>
                  )}
                </button>
                {editingWorkflow && (
                  <button
                    onClick={resetWorkflowForm}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Active Workflows Card */}
        {hasOpenAIKey && (
          <div className="settings-card active-clients-card">
            <div className="card-header">
              <h2 className="card-title">Active Workflows</h2>
              <p className="card-description">
                {workflows.length === 0 
                  ? 'No workflows configured. Add one above to get started.'
                  : `${workflows.length} workflow${workflows.length > 1 ? 's' : ''} configured`
                }
              </p>
            </div>
            
            {workflows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🚀</div>
                <p className="empty-text">No workflows yet</p>
                <p className="empty-subtext">Add your first Agent workflow to enhance your AI experience</p>
              </div>
            ) : (
              <div className="keys-list">
                {workflows.map((workflow) => (
                  <div key={workflow.id} className="key-item" style={{ flexWrap: 'wrap' }}>
                    <div className="key-info" style={{ flex: 1, minWidth: '200px' }}>
                      <div className="key-icon">🚀</div>
                      <div className="key-details">
                        <span className="key-provider" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {workflow.name}
                          {workflow.isDefault && (
                            <span style={{ 
                              fontSize: '10px', 
                              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', 
                              color: 'white', 
                              padding: '2px 8px', 
                              borderRadius: '12px',
                              fontWeight: 600 
                            }}>
                              DEFAULT
                            </span>
                          )}
                        </span>
                        <span className="key-date">
                          {workflow.maskedWorkflowId || 'wf_****'} • Added {new Date(workflow.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {!workflow.isDefault && (
                        <button
                          onClick={() => setDefaultWorkflow(workflow.id)}
                          disabled={workflowLoading}
                          className="btn btn-secondary btn-sm"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() => editWorkflow(workflow)}
                        disabled={workflowLoading}
                        className="btn btn-secondary btn-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeWorkflow(workflow.id, workflow.name)}
                        disabled={workflowLoading}
                        className="btn btn-danger btn-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
        isOpen={workflowConfirmModal.isOpen}
        title="Remove Workflow"
        message={`Are you sure you want to remove "${workflowConfirmModal.workflowName}"?`}
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleConfirmWorkflowRemove}
        onCancel={handleCancelWorkflowRemove}
        variant="danger"
      />
    </div>
  );
};

export default Settings;
