import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Login: React.FC<{ onSwitch: (page: 'register' | 'recover') => void }>
  = ({ onSwitch }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);
      setError(null);
      await login(email, password);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) {
      submit();
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <h2 style={{ marginBottom: 12, fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>Login</h2>
      {error && <div style={{ color: '#b00020', marginBottom: 8, padding: '8px 12px', background: '#ffebee', borderRadius: 6, fontSize: '14px' }}>{error}</div>}
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown} style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8, marginBottom: 12, fontSize: '16px', outline: 'none', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor = '#007bff'} onBlur={(e) => e.target.style.borderColor = '#ddd'} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8, marginBottom: 16, fontSize: '16px', outline: 'none', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor = '#007bff'} onBlur={(e) => e.target.style.borderColor = '#ddd'} />
      <button onClick={submit} disabled={loading} style={{ width: '100%', padding: 12, background: loading ? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 600, transition: 'background 0.2s' }}>Login</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <button onClick={() => onSwitch('recover')} style={{ background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '14px', padding: '4px 0' }}>Recover password</button>
        <button onClick={() => onSwitch('register')} style={{ background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '14px', padding: '4px 0' }}>Create account</button>
      </div>
    </div>
  );
};

export default Login;


