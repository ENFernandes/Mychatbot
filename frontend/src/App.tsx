import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Chat from './components/Chat';
import ChatKitAgent from './components/ChatKitAgent';
import ProviderSelector from './components/ProviderSelector';
import Settings from './pages/Settings';
import ChatSidebar from './components/ChatSidebar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Landing from './pages/Landing';
import LoginModal from './components/LoginModal';
import RegisterModal from './components/RegisterModal';
import RecoverPasswordModal from './components/RecoverPasswordModal';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';
import BillingSuccess from './pages/BillingSuccess';
import BillingCancel from './pages/BillingCancel';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import TrialCountdown from './components/TrialCountdown';
import UpdatePlan from './pages/UpdatePlan';
import ErrorBoundary from './components/ErrorBoundary';
import { api } from './services/api';
import BrandIcon from '@frontend/icon/icon.png';
import './App.css';

interface Workflow {
  id: string;
  name: string;
  isDefault: boolean;
}

const AuthenticatedLayout: React.FC = () => {
  const { token, plan, trialEndsAt, isBillingLocked, logout } = useAuth();
  const [view, setView] = useState<'chat' | 'settings' | 'update-plan'>('chat');
  const [provider, setProvider] = useState<'openai' | 'gemini' | 'claude'>('openai');
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState<string>('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<('openai' | 'gemini' | 'claude')[]>([]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isRecoverModalOpen, setIsRecoverModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const handleOpenUpdatePlan = useCallback(() => setView('update-plan'), []);
  const handleAgentModeToggle = useCallback(() => setIsAgentMode(prev => !prev), []);
  const handleWorkflowChange = useCallback((workflowId: string | null) => setSelectedWorkflowId(workflowId), []);
  const hasOpenAIKey = availableProviders.includes('openai');

  const handleCheckout = useCallback(async () => {
    try {
      const { data } = await api.post('/billing/checkout');
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      throw new Error('Não conseguimos iniciar o checkout.');
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Não conseguimos iniciar o checkout.';
      throw new Error(message);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isBillingLocked) setView('update-plan');
  }, [isBillingLocked]);

  useEffect(() => {
    if (token) {
      setIsLoginModalOpen(false);
      setIsRegisterModalOpen(false);
      setIsRecoverModalOpen(false);
    }
  }, [token]);

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    if (token) {
      body.style.overflow = 'hidden';
      body.style.height = '100vh';
      html.style.overflow = 'hidden';
      html.style.height = '100vh';
    } else {
      body.style.overflow = 'auto';
      body.style.height = 'auto';
      html.style.overflow = 'auto';
      html.style.height = 'auto';
    }
    return () => {
      body.style.overflow = '';
      body.style.height = '';
      html.style.overflow = '';
      html.style.height = '';
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      setModels([]);
      setModel('');
      setAvailableProviders([]);
      return;
    }
    const fetchAvailableProviders = async () => {
      try {
        const { data } = await api.get('/user/keys');
        const providers = (data.keys || []).map((k: any) => k.provider) as ('openai' | 'gemini' | 'claude')[];
        setAvailableProviders(providers);
        setProvider((currentProvider) => {
          if (providers.length > 0 && !providers.includes(currentProvider)) return providers[0];
          return currentProvider;
        });
      } catch (e) {
        console.error('Error fetching available providers:', e);
        setAvailableProviders([]);
      }
    };
    fetchAvailableProviders();
  }, [token]);

  useEffect(() => {
    if (token && view === 'chat') {
      const fetchAvailableProviders = async () => {
        try {
          const { data } = await api.get('/user/keys');
          const providers = (data.keys || []).map((k: any) => k.provider) as ('openai' | 'gemini' | 'claude')[];
          setAvailableProviders(providers);
          setProvider((currentProvider) => {
            if (providers.length > 0 && !providers.includes(currentProvider)) return providers[0];
            return currentProvider;
          });
        } catch (e) {
          console.error('Error fetching available providers:', e);
          setAvailableProviders([]);
        }
      };
      const fetchWorkflows = async () => {
        try {
          const { data } = await api.get('/workflows');
          const wfs = data.workflows || [];
          setWorkflows(wfs);
          if (!selectedWorkflowId && wfs.length > 0) {
            const defaultWf = wfs.find((w: Workflow) => w.isDefault);
            if (defaultWf) setSelectedWorkflowId(defaultWf.id);
          }
        } catch (e) {
          console.error('Error fetching workflows:', e);
          setWorkflows([]);
        }
      };
      fetchAvailableProviders();
      fetchWorkflows();
    }
  }, [view, token, selectedWorkflowId]);

  useEffect(() => {
    if (!token || !provider || availableProviders.length === 0) {
      setModels([]);
      setModel('');
      return;
    }
    const fetchModels = async () => {
      try {
        const { data: modelResp } = await api.get('/models', { params: { provider } });
        const modelList = modelResp.models || [];
        setModels(modelList);
        setModel(modelList[0] || '');
      } catch (e: any) {
        setModels([]);
        setModel('');
      }
    };
    fetchModels();
  }, [provider, token, availableProviders]);

  const modals = (
    <>
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSwitch={(page) => {
          if (page === 'register') { setIsLoginModalOpen(false); setIsRegisterModalOpen(true); }
          else if (page === 'recover') { setIsLoginModalOpen(false); setIsRecoverModalOpen(true); }
        }}
      />
      <RegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSwitch={(page) => {
          if (page === 'login') { setIsRegisterModalOpen(false); setIsLoginModalOpen(true); }
        }}
      />
      <RecoverPasswordModal
        isOpen={isRecoverModalOpen}
        onClose={() => setIsRecoverModalOpen(false)}
        onSwitch={(page) => {
          if (page === 'login') { setIsRecoverModalOpen(false); setIsLoginModalOpen(true); }
        }}
      />
    </>
  );

  const showTrialCountdown = plan === 'trial' && !!trialEndsAt && !isBillingLocked && new Date(trialEndsAt).getTime() > Date.now();

  if (!token) {
    return (
      <>
        <Landing
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onOpenRegister={() => setIsRegisterModalOpen(true)}
        />
        {modals}
      </>
    );
  }

  if (isBillingLocked || view === 'update-plan') {
    return (
      <>
        <UpdatePlan
          trialEndsAt={trialEndsAt}
          isLocked={isBillingLocked}
          onUpgrade={handleCheckout}
          onBack={isBillingLocked ? undefined : () => setView('chat')}
          onGoHome={() => { setView('chat'); logout(); }}
        />
        {modals}
      </>
    );
  }

  const containerClassName = `app-container-authenticated${view === 'settings' ? ' settings-view' : ''}`;
  const mainClassName = `main-authenticated${view === 'settings' ? ' settings-view' : ''}`;

  return (
    <div className={containerClassName}>
      {showTrialCountdown && trialEndsAt && (
        <TrialCountdown trialEndsAt={trialEndsAt} onManagePlan={handleOpenUpdatePlan} />
      )}
      <header className="app-header">
        <nav className="header-nav">
          <div className="header-brand" onClick={() => { window.location.href = '/'; }} role="button" tabIndex={0} onKeyPress={() => { window.location.href = '/'; }}>
            <img src={BrandIcon} alt="MultiProviderAI logo" className="header-logo" />
            <span className="header-name">MultiProviderAI</span>
          </div>
          <div className="header-legal-links">
            <a href="/terms">Terms of Use</a>
            <a href="/privacy">Privacy Policy</a>
          </div>
        </nav>
      </header>

      <main className={mainClassName}>
        {view === 'chat' ? (
          <div style={{ display: 'flex', height: '100%', gap: 0, flexDirection: isMobile ? 'column' : 'row', overflow: 'visible', minHeight: 0 }}>
            <ChatSidebar
              activeId={activeConversationId}
              onSelect={setActiveConversationId}
              model={model}
              onModelChange={setModel}
              models={models}
              onSettingsClick={() => setView('settings')}
              hasConfiguredClient={availableProviders.length > 0}
              activeProjectId={activeProjectId}
              onProjectChange={setActiveProjectId}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              {availableProviders.length > 0 && (
                <div style={{
                  padding: isMobile ? '10px 16px' : '12px 20px',
                  borderBottom: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexShrink: 0,
                  position: 'relative',
                  zIndex: 10
                }}>
                  <ProviderSelector
                    provider={provider}
                    onChange={(p) => setProvider(p)}
                    availableProviders={availableProviders}
                    isAgentMode={isAgentMode}
                    onAgentModeToggle={handleAgentModeToggle}
                    hasOpenAIKey={hasOpenAIKey}
                    workflows={workflows}
                    selectedWorkflowId={selectedWorkflowId}
                    onWorkflowChange={handleWorkflowChange}
                  />
                </div>
              )}
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {isAgentMode && selectedWorkflowId ? (
                  <ChatKitAgent
                    workflowId={selectedWorkflowId}
                    conversationId={activeConversationId}
                    onConversationChange={setActiveConversationId}
                  />
                ) : (
                  <Chat
                    provider={provider}
                    model={model}
                    conversationId={activeConversationId}
                    onConversationChange={setActiveConversationId}
                    isAgentMode={false}
                    selectedWorkflowId={null}
                    activeProjectId={activeProjectId}
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <Settings onBackToChat={() => setView('chat')} />
        )}
      </main>
      {modals}
    </div>
  );
};

const PublicRoutes: React.FC = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isRecoverModalOpen, setIsRecoverModalOpen] = useState(false);

  return (
    <>
      <Routes>
        <Route path="/" element={
          <Landing
            onOpenLogin={() => setIsLoginModalOpen(true)}
            onOpenRegister={() => setIsRegisterModalOpen(true)}
          />
        } />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/billing-success" element={<BillingSuccess />} />
        <Route path="/billing-cancel" element={<BillingCancel />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
      </Routes>
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSwitch={(page) => {
          if (page === 'register') { setIsLoginModalOpen(false); setIsRegisterModalOpen(true); }
          else if (page === 'recover') { setIsLoginModalOpen(false); setIsRecoverModalOpen(true); }
        }}
      />
      <RegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSwitch={(page) => {
          if (page === 'login') { setIsRegisterModalOpen(false); setIsLoginModalOpen(true); }
        }}
      />
      <RecoverPasswordModal
        isOpen={isRecoverModalOpen}
        onClose={() => setIsRecoverModalOpen(false)}
        onSwitch={(page) => {
          if (page === 'login') { setIsRecoverModalOpen(false); setIsLoginModalOpen(true); }
        }}
      />
    </>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/*" element={<PublicRoutes />} />
            <Route path="/app/*" element={<AuthenticatedLayout />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/billing-success" element={<BillingSuccess />} />
            <Route path="/billing-cancel" element={<BillingCancel />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;

