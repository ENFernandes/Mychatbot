import React, { useEffect, useState } from 'react';
import Chat from './components/Chat';
import ProviderSelector from './components/ProviderSelector';
import ModelSelect from './components/ModelSelect';
import Settings from './pages/Settings';
import ConversationSidebar from './components/ConversationSidebar';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import RecoverPassword from './pages/RecoverPassword';
import { api } from './services/api';

const AppShell: React.FC = () => {
  const { token } = useAuth();
  const [view, setView] = useState<'chat' | 'settings'>('chat');
  const [provider, setProvider] = useState<'openai' | 'gemini' | 'claude'>('openai');
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState<string>('');
  const [authView, setAuthView] = useState<'login' | 'register' | 'recover'>('login');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<('openai' | 'gemini' | 'claude')[]>([]);

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

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      <header
        style={{
          marginBottom: '20px',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h1 style={{ color: '#333', margin: 0 }}>MyChatBots</h1>
          {token && <LogoutButton />}
        </div>
        {token && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
            <button onClick={() => setView('chat')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: view==='chat'?'#007bff':'#fff', color: view==='chat'?'#fff':'#333' }}>Chat</button>
            <button onClick={() => setView('settings')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: view==='settings'?'#007bff':'#fff', color: view==='settings'?'#fff':'#333' }}>Settings</button>
          </div>
        )}
        {view === 'chat' && availableProviders.length > 0 && (
          <>
            <ProviderSelector 
              provider={provider} 
              onChange={(p) => setProvider(p)}
              availableProviders={availableProviders}
            />
            <ModelSelect models={models} value={model} onChange={setModel} />
          </>
        )}
      </header>

      <main style={{ flex: 1, minHeight: 0 }}>
        <AuthGate
          fallback={
            authView === 'login' ? (
              <Login onSwitch={(p) => setAuthView(p)} />
            ) : authView === 'register' ? (
              <Register onSwitch={() => setAuthView('login')} />
            ) : (
              <RecoverPassword onSwitch={() => setAuthView('login')} />
            )
          }
        >
          {view === 'chat' ? (
            <div style={{ display: 'flex', height: '100%', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Chat provider={provider} model={model} conversationId={activeConversationId} onConversationChange={setActiveConversationId} />
              </div>
              <ConversationSidebar activeId={activeConversationId} onSelect={setActiveConversationId} />
            </div>
          ) : (
            <Settings />
          )}
        </AuthGate>
      </main>
    </div>
  );
};

const LogoutButton: React.FC = () => {
  const { logout } = useAuth();
  return (
    <button onClick={logout} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', color: '#dc3545', cursor: 'pointer' }}>
      Logout
    </button>
  );
};

const AuthGate: React.FC<{ children: React.ReactNode; fallback: React.ReactNode }> = ({ children, fallback }) => {
  const { token } = useAuth();
  if (!token) return <>{fallback}</>;
  return <>{children}</>;
};

const App: React.FC = () => (
  <AuthProvider>
    <AppShell />
  </AuthProvider>
);

export default App;

