import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Register: React.FC<{ onSwitch: (page: 'login') => void; onSuccess?: () => void }>
  = ({ onSwitch, onSuccess }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const trimmedName = name.trim();
      const trimmedEmail = email.trim();

      if (trimmedName.length < 3) {
        throw new Error('Name must be at least 3 characters long');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        throw new Error('Please enter a valid email address');
      }

      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSymbol = /[!@#$%^&*(),.?":{}|<>\[\];'`~\\/_+=-]/.test(password);

      if (password.length < 10 || !hasUpper || !hasLower || !hasNumber || !hasSymbol) {
        throw new Error('Password must be at least 10 characters long and include upper, lower, number, and symbol.');
      }

      const message = await register(trimmedName, trimmedEmail.toLowerCase(), password);
      setSuccess(message);
      setName('');
      setEmail('');
      setPassword('');
      window.alert(message);
      if (onSuccess) {
        onSuccess();
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <h2 style={{ marginBottom: 12, fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>Create Account</h2>
      {error && <div style={{ color: '#b00020', marginBottom: 8, padding: '8px 12px', background: '#ffebee', borderRadius: 6, fontSize: '14px' }}>{error}</div>}
      {success && <div style={{ color: '#1b5e20', marginBottom: 8, padding: '8px 12px', background: '#e8f5e9', borderRadius: 6, fontSize: '14px' }}>{success}</div>}
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8, marginBottom: 12, fontSize: '16px', outline: 'none', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor = '#28a745'} onBlur={(e) => e.target.style.borderColor = '#ddd'} />
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8, marginBottom: 12, fontSize: '16px', outline: 'none', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor = '#28a745'} onBlur={(e) => e.target.style.borderColor = '#ddd'} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 8, marginBottom: 16, fontSize: '16px', outline: 'none', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor = '#28a745'} onBlur={(e) => e.target.style.borderColor = '#ddd'} />
      <button onClick={submit} disabled={loading} style={{ width: '100%', padding: 12, background: loading ? '#ccc' : '#28a745', color: 'white', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 600, transition: 'background 0.2s' }}>{loading ? 'Sending...' : 'Create'}</button>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={() => onSwitch('login')} style={{ background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '14px', padding: '4px 0' }}>Already have an account</button>
      </div>
    </div>
  );
};

export default Register;


