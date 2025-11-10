import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import './ChatSidebar.css';

type Conversation = { id: string; title: string; created_at: string; updated_at: string };

interface ChatSidebarProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  model: string;
  onModelChange: (model: string) => void;
  models: string[];
  onSettingsClick: () => void;
  hasConfiguredClient: boolean;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  activeId,
  onSelect,
  model,
  onModelChange,
  models,
  onSettingsClick,
  hasConfiguredClient
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, plan, subscriptionStatus } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [pinnedItems, setPinnedItems] = useState<string[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    pinned: false,
    recent: false,
  });
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const settingsWrapperRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/conversations');
      const conversations = data.conversations || [];
      setItems(conversations);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handleConversationCreated = () => {
      load();
    };
    window.addEventListener('conversation-created', handleConversationCreated);
    return () => {
      window.removeEventListener('conversation-created', handleConversationCreated);
    };
  }, []);

  useEffect(() => {
    if (!isSettingsMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsWrapperRef.current &&
        !settingsWrapperRef.current.contains(event.target as Node)
      ) {
        setIsSettingsMenuOpen(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSettingsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isSettingsMenuOpen]);

  const createConversation = async () => {
    if (!hasConfiguredClient) {
      return;
    }
    const { data } = await api.post('/conversations', {});
    await load();
    onSelect(data.id);
  };

  const deleteConversation = async (id: string) => {
    const wasActive = activeId === id;
    await api.delete(`/conversations/${id}`);
    await load();
    if (wasActive) {
      const { data } = await api.get('/conversations');
      const updatedItems = data.conversations || [];
      if (updatedItems.length > 0) {
        onSelect(updatedItems[0].id);
      } else {
        onSelect(null as any);
      }
    }
  };

  const togglePin = (id: string) => {
    setPinnedItems(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const startEdit = (conv: Conversation) => {
    setEditingId(conv.id);
    setTitleDraft(conv.title);
  };

  const saveTitle = async (id: string) => {
    await api.patch(`/conversations/${id}`, { title: titleDraft || 'New conversation' });
    setEditingId(null);
    await load();
  };

  const recentItems = items
    .filter(item => !pinnedItems.includes(item.id))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10);

  const pinnedConversations = items.filter(item => pinnedItems.includes(item.id));
  const userInitial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();
  const planLabel = plan === 'pro' ? 'Pro plan' : 'Trial plan';
  const subscriptionLabel = subscriptionStatus ? subscriptionStatus.replace(/_/g, ' ') : null;

  const handleClientPage = () => {
    setIsSettingsMenuOpen(false);
    onSettingsClick();
  };

  const handleGetHelp = () => {
    setIsSettingsMenuOpen(false);
    window.open('mailto:support@mychatbots.com', '_blank');
  };

  const handleUpgrade = async () => {
    setIsSettingsMenuOpen(false);
    try {
      setBillingLoading(true);
      const { data } = await api.post('/billing/checkout');
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert('Unable to start subscription checkout. Please try again later.');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleManage = async () => {
    setIsSettingsMenuOpen(false);
    try {
      setBillingLoading(true);
      const { data } = await api.post('/billing/portal');
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert('Unable to open billing portal. Please try again later.');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleLogout = () => {
    setIsSettingsMenuOpen(false);
    logout();
  };

  const isTrialPlan = plan === 'trial';

  return (
    <aside className="chat-sidebar">
      <div className="sidebar-header">
        <button 
          className="btn-new-chat" 
          onClick={createConversation}
          disabled={!hasConfiguredClient}
          title={hasConfiguredClient ? 'Start a new conversation' : 'Add an API key in Settings to start chatting'}
        >
          <span className="icon-plus">+</span>
          <span>New Chat</span>
        </button>
      </div>

      <div className="sidebar-content">
        {/* Model Selection */}
        <div className="sidebar-section">
          <div>
            <span>Model</span>
          </div>
          <select 
            value={model} 
            onChange={(e) => onModelChange(e.target.value)}
            className="model-select"
          >
            {models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Pinned Chats */}
        {pinnedConversations.length > 0 && (
          <div className="sidebar-section">
            <button 
              className="section-toggle"
              onClick={() => toggleSection('pinned')}
            >
              <span className={`icon-chevron ${collapsedSections.pinned ? 'collapsed' : ''}`}>▼</span>
              <span>Pinned</span>
            </button>
            {!collapsedSections.pinned && (
              <div className="conversation-list">
                {pinnedConversations.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conversation={c}
                    activeId={activeId}
                    editingId={editingId}
                    titleDraft={titleDraft}
                    onSelect={onSelect}
                    onEdit={startEdit}
                    onSave={saveTitle}
                    onCancel={() => setEditingId(null)}
                    onDelete={deleteConversation}
                    onTitleChange={setTitleDraft}
                    onPin={() => togglePin(c.id)}
                    isPinned={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent Chats */}
        <div className="sidebar-section">
          <button 
            className="section-toggle"
            onClick={() => toggleSection('recent')}
          >
            <span className={`icon-chevron ${collapsedSections.recent ? 'collapsed' : ''}`}>▼</span>
            <span>Recent</span>
          </button>
          {!collapsedSections.recent && (
            <div className="conversation-list">
              {loading ? (
                <div className="loading-state">Loading...</div>
              ) : recentItems.length === 0 ? (
                <div className="empty-state">No conversations yet</div>
              ) : (
                recentItems.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conversation={c}
                    activeId={activeId}
                    editingId={editingId}
                    titleDraft={titleDraft}
                    onSelect={onSelect}
                    onEdit={startEdit}
                    onSave={saveTitle}
                    onCancel={() => setEditingId(null)}
                    onDelete={deleteConversation}
                    onTitleChange={setTitleDraft}
                    onPin={() => togglePin(c.id)}
                    isPinned={false}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">
            {userInitial}
          </div>
          <div className="user-info">
            <div className="user-name">{user?.name || user?.email || 'User'}</div>
            <div className="user-workspace">{planLabel}</div>
          </div>
        </div>
        <div className="sidebar-actions">
          <div className="settings-menu-wrapper" ref={settingsWrapperRef}>
            <button 
              className={`icon-btn ${isSettingsMenuOpen ? 'active' : ''}`} 
              onClick={() => setIsSettingsMenuOpen(prev => !prev)}
              aria-label="Settings"
              title="Settings"
            >
              ⚙️
            </button>
            {isSettingsMenuOpen && (
              <div className="settings-menu-popover">
                <div className="settings-menu-header">
                  <div className="settings-menu-email">{user?.email || 'Anonymous user'}</div>
                  <div className={`settings-menu-plan ${plan === 'pro' ? 'is-pro' : ''}`}>
                    {planLabel}
                    {subscriptionLabel ? <span className="settings-menu-plan-status">{subscriptionLabel}</span> : null}
                  </div>
                </div>
                <div className="settings-menu-section">
                  <span className="settings-menu-label">Settings</span>
                  <button className="settings-menu-item" onClick={handleClientPage}>
                    <div className="item-leading">
                      <span className="item-icon">🧾</span>
                      <div className="item-text">
                        <span className="item-title">Client Page</span>
                        <span className="item-subtitle">Manage API keys and preferences</span>
                      </div>
                    </div>
                    <span className="item-arrow">→</span>
                  </button>
                  <button className="settings-menu-item" onClick={handleGetHelp}>
                    <div className="item-leading">
                      <span className="item-icon">💬</span>
                      <div className="item-text">
                        <span className="item-title">Get help</span>
                        <span className="item-subtitle">Reach our support team</span>
                      </div>
                    </div>
                    <span className="item-arrow">↗</span>
                  </button>
                  {isTrialPlan ? (
                    <button className="settings-menu-item" onClick={handleUpgrade} disabled={billingLoading}>
                      <div className="item-leading">
                        <span className="item-icon">🚀</span>
                        <div className="item-text">
                          <span className="item-title">Upgrade plan</span>
                          <span className="item-subtitle">Unlock all pro features</span>
                        </div>
                      </div>
                      <span className="item-arrow">↗</span>
                    </button>
                  ) : (
                    <button className="settings-menu-item" onClick={handleManage} disabled={billingLoading}>
                      <div className="item-leading">
                        <span className="item-icon">🧾</span>
                        <div className="item-text">
                          <span className="item-title">Manage plan</span>
                          <span className="item-subtitle">Update subscription or billing</span>
                        </div>
                      </div>
                      <span className="item-arrow">↗</span>
                    </button>
                  )}
                  <button className="settings-menu-item danger" onClick={handleLogout}>
                    <div className="item-leading">
                      <span className="item-icon">⏏️</span>
                      <div className="item-text">
                        <span className="item-title">Log out</span>
                        <span className="item-subtitle">Sign out of your workspace</span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
          <button 
            className="icon-btn" 
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </aside>
  );
};

interface ConversationItemProps {
  conversation: Conversation;
  activeId: string | null;
  editingId: string | null;
  titleDraft: string;
  onSelect: (id: string) => void;
  onEdit: (conv: Conversation) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  onTitleChange: (title: string) => void;
  onPin: () => void;
  isPinned: boolean;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  activeId,
  editingId,
  titleDraft,
  onSelect,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onTitleChange,
  onPin,
  isPinned,
}) => {
  const isActive = activeId === conversation.id;
  const isEditing = editingId === conversation.id;

  return (
    <div className={`conversation-item ${isActive ? 'active' : ''}`}>
      {isEditing ? (
        <div className="conversation-edit">
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => onTitleChange(e.target.value)}
            className="edit-input"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave(conversation.id);
              if (e.key === 'Escape') onCancel();
            }}
          />
          <div className="edit-actions">
            <button className="btn-icon" onClick={() => onSave(conversation.id)} title="Save">
              ✓
            </button>
            <button className="btn-icon" onClick={onCancel} title="Cancel">
              ✕
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            className="conversation-button"
            onClick={() => onSelect(conversation.id)}
          >
            <span className="conversation-title">{conversation.title}</span>
          </button>
          <div className="conversation-actions">
            <button
              className="btn-icon"
              onClick={onPin}
              title={isPinned ? 'Unpin' : 'Pin'}
            >
              {isPinned ? '📌' : '📍'}
            </button>
            <button
              className="btn-icon"
              onClick={() => onEdit(conversation)}
              title="Edit"
            >
              ✏️
            </button>
            <button
              className="btn-icon"
              onClick={() => onDelete(conversation.id)}
              title="Delete"
            >
              🗑️
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatSidebar;

