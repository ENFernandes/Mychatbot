import React, { useEffect, useState } from 'react';
import Chat from './components/Chat';
import ProviderSelector from './components/ProviderSelector';
import Settings from './pages/Settings';
import ChatSidebar from './components/ChatSidebar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Landing from './pages/Landing';
import LoginModal from './components/LoginModal';
import RegisterModal from './components/RegisterModal';
import { api } from './services/api';
import './App.css';

const AppShell: React.FC = () => {
  const { token } = useAuth();
  const [view, setView] = useState<'chat' | 'settings'>('chat');
  const [provider, setProvider] = useState<'openai' | 'gemini' | 'claude'>('openai');
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState<string>('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<('openai' | 'gemini' | 'claude')[]>([]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close modals when user successfully authenticates
  useEffect(() => {
    if (token) {
      setIsLoginModalOpen(false);
      setIsRegisterModalOpen(false);
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

  // Reload providers when returning to chat (after possible change in Settings)
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
      fetchAvailableProviders();
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
        const keyResp = await api.get(`/user/keys/${provider}/temp`);
        const keyData = keyResp.data;
        const modelResp = await fetch(`/api/models?provider=${provider}&apiKey=${encodeURIComponent(keyData.apiKey)}`, {
          headers: { 'x-api-key': keyData.apiKey },
        });
        const modelData = await modelResp.json();
        setModels(modelData.models || []);
        setModel((modelData.models || [])[0] || '');
      } catch (e) {
        const defaults = provider === 'openai'
          ? ['gpt-5', 'gpt-4o', 'gpt-4.1']
          : provider === 'gemini'
          ? ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro']
          : ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-latest'];
        setModels(defaults);
        setModel(defaults[0]);
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
    </>
  );

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

  const isSettingsView = view === 'settings';
  const containerClassName = `app-container-authenticated${isSettingsView ? ' settings-view' : ''}`;
  const mainClassName = `main-authenticated${isSettingsView ? ' settings-view' : ''}`;

  return (
    <div className={containerClassName}>
      <header className="app-header">
        <nav className="header-nav">
          <div className="header-brand">
            <span className="header-logo">💬</span>
            <span className="header-name">MyChatBots</span>
          </div>
        </nav>
      </header>

      <main className={mainClassName}>
        {view === 'chat' ? (
          <div style={{ display: 'flex', height: '100%', gap: 0, flexDirection: isMobile ? 'column' : 'row', overflow: 'visible', minHeight: 0 }}>
            <ChatSidebar 
              activeId={activeConversationId} 
              onSelect={setActiveConversationId}
              provider={provider}
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
                  />
                </div>
              )}
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Chat provider={provider} model={model} conversationId={activeConversationId} onConversationChange={setActiveConversationId} />
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

