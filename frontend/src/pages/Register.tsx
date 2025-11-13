import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Register: React.FC<{ onSwitch: (page: 'login') => void; onSuccess?: () => void }>
  = ({ onSwitch, onSuccess }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <input 
          placeholder="Password" 
          type={showPassword ? 'text' : 'password'} 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          style={{ width: '100%', padding: 12, paddingRight: 40, border: '1px solid #ddd', borderRadius: 8, fontSize: '16px', outline: 'none', transition: 'border-color 0.2s' }} 
          onFocus={(e) => e.target.style.borderColor = '#28a745'} 
          onBlur={(e) => e.target.style.borderColor = '#ddd'} 
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666'
          }}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          )}
        </button>
      </div>
      <button onClick={submit} disabled={loading} style={{ width: '100%', padding: 12, background: loading ? '#ccc' : '#28a745', color: 'white', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 600, transition: 'background 0.2s' }}>{loading ? 'Sending...' : 'Create'}</button>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={() => onSwitch('login')} style={{ background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '14px', padding: '4px 0' }}>Already have an account</button>
      </div>
    </div>
  );
};

export default Register;


