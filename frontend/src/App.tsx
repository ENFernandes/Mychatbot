import React, { useCallback, useEffect, useState } from 'react';
import Chat from './components/Chat';
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
import { api } from './services/api';
import TrialCountdown from './components/TrialCountdown';
import UpdatePlan from './pages/UpdatePlan';
import './App.css';
import BrandIcon from '@frontend/icon/icon.png';

interface Workflow {
  id: string;
  name: string;
  model: string;
  isDefault: boolean;
}

const AppShell: React.FC = () => {
  const { token, plan, trialEndsAt, isBillingLocked, logout } = useAuth();
  const [view, setView] = useState<'chat' | 'settings' | 'update-plan'>('chat');
  const [provider, setProvider] = useState<'openai' | 'gemini' | 'claude'>('openai');
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState<string>('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<('openai' | 'gemini' | 'claude')[]>([]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isRecoverModalOpen, setIsRecoverModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const handleOpenUpdatePlan = useCallback(() => setView('update-plan'), []);
  
  const handleAgentModeToggle = useCallback(() => {
    setIsAgentMode(prev => !prev);
  }, []);

  const handleWorkflowChange = useCallback((workflowId: string | null) => {
    setSelectedWorkflowId(workflowId);
  }, []);

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
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isBillingLocked) {
      setView('update-plan');
    }
  }, [isBillingLocked]);

  // Close modals when user successfully authenticates
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
        
        // If current provider is not available, switch to the first available one
        setProvider((currentProvider) => {
          if (providers.length > 0 && !providers.includes(currentProvider)) {
            return providers[0];
          }
          return currentProvider;
        });
      } catch (e) {
        console.error('Error fetching available providers:', e);
        setAvailableProviders([]);
      }
    };
    fetchAvailableProviders();
  }, [token]);

  // Reload providers and workflows when returning to chat (after possible change in Settings)
  useEffect(() => {
    if (token && view === 'chat') {
      const fetchAvailableProviders = async () => {
        try {
          const { data } = await api.get('/user/keys');
          const providers = (data.keys || []).map((k: any) => k.provider) as ('openai' | 'gemini' | 'claude')[];
          setAvailableProviders(providers);
          
          setProvider((currentProvider) => {
            if (providers.length > 0 && !providers.includes(currentProvider)) {
              return providers[0];
            }
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
          
          // Auto-select default workflow if none selected
          if (!selectedWorkflowId && wfs.length > 0) {
            const defaultWf = wfs.find((w: Workflow) => w.isDefault);
            if (defaultWf) {
              setSelectedWorkflowId(defaultWf.id);
            }
          }
        } catch (e) {
          console.error('Error fetching workflows:', e);
          setWorkflows([]);
        }
      };
      
      fetchAvailableProviders();
      fetchWorkflows();
    }
  }, [view, token]);

  useEffect(() => {
    if (!token || !provider || availableProviders.length === 0) {
      setModels([]);
      setModel('');
      return;
    }
    const fetchModels = async () => {
      try {
        const { data: modelResp } = await api.get('/models', {
          params: { provider },
        });
        const modelList = modelResp.models || [];
        if (modelList.length === 0) {
          setModels([]);
          setModel('');
          console.warn('No models available from provider');
          return;
        }
        setModels(modelList);
        setModel(modelList[0] || '');
      } catch (e: any) {
        // Handle different error cases
        const status = e?.response?.status;
        const errorData = e?.response?.data;
        
        setModels([]);
        setModel('');
        
        if (status === 404) {
          // API key not configured
          console.info(`API key for ${provider} not configured. User needs to add it in Settings.`);
        } else if (status === 401) {
          // Invalid API key
          console.warn(`Invalid API key for ${provider}:`, errorData?.message || e?.message);
        } else if (status === 503) {
          // Provider API error
          console.warn(`Provider API error for ${provider}:`, errorData?.message || e?.message);
        } else {
          // Other errors
          console.error('Error fetching models:', status, errorData?.error || errorData?.message || e?.message);
        }
      }
    };
    fetchModels();
  }, [provider, token, availableProviders]);

  const modals = (
    <>
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setIsLoginModalOpen(false);
        }}
        onSwitch={(page) => {
          if (page === 'register') {
            setIsLoginModalOpen(false);
            setIsRegisterModalOpen(true);
          } else if (page === 'recover') {
            setIsLoginModalOpen(false);
            setIsRecoverModalOpen(true);
          }
        }}
      />
      <RegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => {
          setIsRegisterModalOpen(false);
        }}
        onSwitch={(page) => {
          if (page === 'login') {
            setIsRegisterModalOpen(false);
            setIsLoginModalOpen(true);
          }
        }}
      />
      <RecoverPasswordModal
        isOpen={isRecoverModalOpen}
        onClose={() => {
          setIsRecoverModalOpen(false);
        }}
        onSwitch={(page) => {
          if (page === 'login') {
            setIsRecoverModalOpen(false);
            setIsLoginModalOpen(true);
          }
        }}
      />
    </>
  );

  const showTrialCountdown =
    plan === 'trial' &&
    !!trialEndsAt &&
    !isBillingLocked &&
    new Date(trialEndsAt).getTime() > Date.now();

  // Check if we're on special pages
  const determineSpecialPage = () => {
    const pathname = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const verifyToken = urlParams.get('token');

    if (pathname === '/terms') return 'terms';
    if (pathname === '/privacy') return 'privacy';
    if (pathname === '/billing-success') return 'billing-success';
    if (pathname === '/billing-cancel') return 'billing-cancel';
    if (pathname === '/verify-email' || (pathname === '/' && verifyToken)) return 'verify-email';
    if (pathname === '/reset-password') return 'reset-password';
    return null;
  };

  const [showSpecialPage, setShowSpecialPage] = useState<string | null>(() => determineSpecialPage());
  
  useEffect(() => {
    setShowSpecialPage(determineSpecialPage());

    const handlePopState = () => {
      setShowSpecialPage(determineSpecialPage());
    };

    // Also listen for pushstate events (when navigating programmatically)
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setShowSpecialPage(determineSpecialPage());
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      history.pushState = originalPushState;
    };
  }, []);

  if (showSpecialPage === 'verify-email') {
    return <VerifyEmail />;
  }

  if (showSpecialPage === 'reset-password') {
    return <ResetPassword />;
  }

  if (showSpecialPage === 'billing-success') {
    return <BillingSuccess />;
  }

  if (showSpecialPage === 'billing-cancel') {
    return <BillingCancel />;
  }

  if (showSpecialPage === 'terms') {
    return <Terms />;
  }

  if (showSpecialPage === 'privacy') {
    return <Privacy />;
  }

  if (!token) {
    return (
      <>
        <Landing
          onOpenLogin={() => {
            setIsLoginModalOpen(true);
          }}
          onOpenRegister={() => {
            setIsRegisterModalOpen(true);
          }}
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
          onGoHome={() => {
            setView('chat');
            logout();
          }}
        />
        {modals}
      </>
    );
  }

  const isSettingsView = view === 'settings';
  const containerClassName = `app-container-authenticated${isSettingsView ? ' settings-view' : ''}`;
  const mainClassName = `main-authenticated${isSettingsView ? ' settings-view' : ''}`;

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
                <Chat provider={provider} model={model} conversationId={activeConversationId} onConversationChange={setActiveConversationId} isAgentMode={isAgentMode} selectedWorkflowId={selectedWorkflowId} />
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

const App: React.FC = () => (
  <ThemeProvider>
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  </ThemeProvider>
);

export default App;

