import React, { useEffect, useState, useRef } from 'react';
import { api, getProjects, deleteProject, moveConversationToProject, Project } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import SupportModal from './SupportModal';
import ProjectModal from './ProjectModal';
import ConfirmModal from './ConfirmModal';
import './ChatSidebar.css';

type Conversation = { 
  id: string; 
  title: string; 
  pinned: boolean; 
  project_id: string | null;
  created_at: string; 
  updated_at: string;
};

interface ChatSidebarProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  model: string;
  onModelChange: (model: string) => void;
  models: string[];
  onSettingsClick: () => void;
  hasConfiguredClient: boolean;
  activeProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  activeId,
  onSelect,
  model,
  onModelChange,
  models,
  onSettingsClick,
  hasConfiguredClient,
  activeProjectId,
  onProjectChange,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, plan, subscriptionStatus } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    projects: false,
    pinned: false,
    recent: false,
  });
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [moveConversationId, setMoveConversationId] = useState<string | null>(null);
  const settingsWrapperRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/conversations');
      const conversations = data.conversations || [];
      setItems(conversations);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const projectsList = await getProjects();
      setProjects(projectsList);
    } catch (error) {
      console.error('Failed to load projects', error);
    }
  };

  const load = async () => {
    await Promise.all([loadConversations(), loadProjects()]);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handleConversationCreated = () => {
      loadConversations();
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

  const createConversation = async (projectId?: string | null) => {
    if (!hasConfiguredClient) {
      return;
    }
    const payload: { projectId?: string } = {};
    if (projectId) {
      payload.projectId = projectId;
    }
    const { data } = await api.post('/conversations', payload);
    await loadConversations();
    onSelect(data.id);
  };

  const deleteConversation = async (id: string) => {
    const wasActive = activeId === id;
    await api.delete(`/conversations/${id}`);
    await loadConversations();
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

  const togglePin = async (id: string) => {
    const conversation = items.find(item => item.id === id);
    if (!conversation) return;
    
    const newPinnedState = !conversation.pinned;
    
    // Optimistically update the UI
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, pinned: newPinnedState } : item
    ));
    
    try {
      await api.patch(`/conversations/${id}`, { pinned: newPinnedState });
    } catch (error) {
      // Revert on error
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, pinned: !newPinnedState } : item
      ));
      console.error('Failed to update pin state', error);
    }
  };

  const handleMoveToProject = async (conversationId: string, projectId: string | null) => {
    try {
      await moveConversationToProject(conversationId, projectId);
      await loadConversations();
      setMoveConversationId(null);
    } catch (error) {
      console.error('Failed to move conversation', error);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject(projectToDelete.id);
      await load();
      if (activeProjectId === projectToDelete.id) {
        onProjectChange(null);
      }
      setProjectToDelete(null);
    } catch (error) {
      console.error('Failed to delete project', error);
    }
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
    await loadConversations();
  };

  // Filter conversations based on selected project
  const filteredItems = activeProjectId
    ? items.filter(item => item.project_id === activeProjectId)
    : items.filter(item => !item.project_id);

  const recentItems = filteredItems
    .filter(item => !item.pinned)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10);

  const pinnedConversations = filteredItems.filter(item => item.pinned);
  const userInitial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();
  const planLabel = plan === 'pro' ? 'Pro plan' : 'Trial plan';
  const subscriptionLabel = subscriptionStatus ? subscriptionStatus.replace(/_/g, ' ') : null;

  const handleClientPage = () => {
    setIsSettingsMenuOpen(false);
    onSettingsClick();
  };

  const handleGetHelp = () => {
    setIsSettingsMenuOpen(false);
    setIsSupportModalOpen(true);
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
  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <>
      <SupportModal 
        isOpen={isSupportModalOpen} 
        onClose={() => setIsSupportModalOpen(false)} 
      />
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false);
          setEditingProject(null);
        }}
        onSuccess={() => {
          loadProjects();
        }}
        editProject={editingProject}
      />
      <ConfirmModal
        isOpen={!!projectToDelete}
        onCancel={() => setProjectToDelete(null)}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        message={`Are you sure you want to delete "${projectToDelete?.name}"? Conversations in this project will be moved to "No Project".`}
        confirmText="Delete"
        variant="danger"
      />
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <button 
            className="btn-new-chat" 
            onClick={() => createConversation(activeProjectId)}
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
            {models.length > 0 ? (
              <select 
                value={model} 
                onChange={(e) => onModelChange(e.target.value)}
                className="model-select"
              >
                {models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <div style={{ 
                padding: '8px', 
                borderRadius: '6px', 
                border: '1px solid #ddd', 
                backgroundColor: '#f5f5f5',
                color: '#666',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                No models available
              </div>
            )}
          </div>

          {/* Projects Section */}
          <div className="sidebar-section">
            <div className="section-header-with-action">
              <button 
                className="section-toggle"
                onClick={() => toggleSection('projects')}
              >
                <span className={`icon-chevron ${collapsedSections.projects ? 'collapsed' : ''}`}>▼</span>
                <span>Projects</span>
              </button>
              <button
                className="btn-add-project"
                onClick={() => setIsProjectModalOpen(true)}
                title="Create new project"
              >
                +
              </button>
            </div>
            {!collapsedSections.projects && (
              <div className="projects-list">
                <button
                  className={`project-item ${!activeProjectId ? 'active' : ''}`}
                  onClick={() => onProjectChange(null)}
                >
                  <span className="project-icon">📁</span>
                  <span className="project-name">All Chats</span>
                  <span className="project-count">{items.filter(i => !i.project_id).length}</span>
                </button>
                {projects.map((project) => (
                  <div key={project.id} className={`project-item-wrapper ${activeProjectId === project.id ? 'active' : ''}`}>
                    <button
                      className={`project-item ${activeProjectId === project.id ? 'active' : ''}`}
                      onClick={() => onProjectChange(project.id)}
                    >
                      <span className="project-icon">📂</span>
                      <span className="project-name">{project.name}</span>
                      <span className="project-count">{items.filter(i => i.project_id === project.id).length}</span>
                    </button>
                    <div className="project-actions">
                      <button
                        className="btn-icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProject(project);
                          setIsProjectModalOpen(true);
                        }}
                        title="Edit project"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete(project);
                        }}
                        title="Delete project"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Project Header */}
          {activeProject && (
            <div className="active-project-header">
              <span className="active-project-label">Viewing:</span>
              <span className="active-project-name">{activeProject.name}</span>
            </div>
          )}

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
                      projects={projects}
                      onMoveToProject={(projectId) => handleMoveToProject(c.id, projectId)}
                      showMoveMenu={moveConversationId === c.id}
                      onToggleMoveMenu={() => setMoveConversationId(moveConversationId === c.id ? null : c.id)}
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
                  <div className="empty-state">
                    {activeProjectId ? 'No conversations in this project' : 'No conversations yet'}
                  </div>
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
                      projects={projects}
                      onMoveToProject={(projectId) => handleMoveToProject(c.id, projectId)}
                      showMoveMenu={moveConversationId === c.id}
                      onToggleMoveMenu={() => setMoveConversationId(moveConversationId === c.id ? null : c.id)}
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
    </>
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
  projects: Project[];
  onMoveToProject: (projectId: string | null) => void;
  showMoveMenu: boolean;
  onToggleMoveMenu: () => void;
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
  projects,
  onMoveToProject,
  showMoveMenu,
  onToggleMoveMenu,
}) => {
  const isActive = activeId === conversation.id;
  const isEditing = editingId === conversation.id;
  const moveMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMoveMenu) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (moveMenuRef.current && !moveMenuRef.current.contains(event.target as Node)) {
        onToggleMoveMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoveMenu, onToggleMoveMenu]);

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
            <div className="move-menu-wrapper" ref={moveMenuRef}>
              <button
                className="btn-icon"
                onClick={onToggleMoveMenu}
                title="Move to project"
              >
                📂
              </button>
              {showMoveMenu && (
                <div className="move-menu-popover">
                  <div className="move-menu-header">Move to...</div>
                  <button
                    className={`move-menu-item ${!conversation.project_id ? 'current' : ''}`}
                    onClick={() => onMoveToProject(null)}
                    disabled={!conversation.project_id}
                  >
                    <span>📁</span>
                    <span>No Project</span>
                    {!conversation.project_id && <span className="current-badge">Current</span>}
                  </button>
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      className={`move-menu-item ${conversation.project_id === project.id ? 'current' : ''}`}
                      onClick={() => onMoveToProject(project.id)}
                      disabled={conversation.project_id === project.id}
                    >
                      <span>📂</span>
                      <span>{project.name}</span>
                      {conversation.project_id === project.id && <span className="current-badge">Current</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
