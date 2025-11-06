import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Register: React.FC<{ onSwitch: (page: 'login') => void }>
  = ({ onSwitch }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);
      setError(null);
      await register(name, email, password);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <h2 style={{ marginBottom: 12, fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>Create Account</h2>
      {error && <div style={{ color: '#b00020', marginBottom: 8, padding: '8px 12px', background: '#ffebee', borderRadius: 6, fontSize: '14px' }}>{error}</div>}
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8, marginBottom: 12, fontSize: '16px', outline: 'none', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor = '#28a745'} onBlur={(e) => e.target.style.borderColor = '#ddd'} />
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8, marginBottom: 12, fontSize: '16px', outline: 'none', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor = '#28a745'} onBlur={(e) => e.target.style.borderColor = '#ddd'} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8, marginBottom: 16, fontSize: '16px', outline: 'none', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor = '#28a745'} onBlur={(e) => e.target.style.borderColor = '#ddd'} />
      <button onClick={submit} disabled={loading} style={{ width: '100%', padding: 12, background: loading ? '#ccc' : '#28a745', color: 'white', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 600, transition: 'background 0.2s' }}>Create</button>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={() => onSwitch('login')} style={{ background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '14px', padding: '4px 0' }}>Already have an account</button>
      </div>
    </div>
  );
};

export default Register;


