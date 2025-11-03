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

  return (
    <div style={{ maxWidth: 360, margin: '40px auto', background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginBottom: 12 }}>Login</h2>
      {error && <div style={{ color: '#b00020', marginBottom: 8 }}>{error}</div>}
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, marginBottom: 8 }} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, marginBottom: 12 }} />
      <button onClick={submit} disabled={loading} style={{ width: '100%', padding: 10, background: '#007bff', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Login</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <button onClick={() => onSwitch('recover')} style={{ background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer' }}>Recover password</button>
        <button onClick={() => onSwitch('register')} style={{ background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer' }}>Create account</button>
      </div>
    </div>
  );
};

export default Login;


