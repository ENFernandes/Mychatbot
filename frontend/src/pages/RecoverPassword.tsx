import React, { useState } from 'react';
import { api } from '../services/api';

const RecoverPassword: React.FC<{ onSwitch: (page: 'login') => void }>
  = ({ onSwitch }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await api.post('/auth/recover', { name, email });
      setSuccess(response.data.message || 'If the data matches, we\'ll email reset instructions shortly.');
      setName('');
      setEmail('');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Something went wrong. Please try again or contact support.');
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
      <h2 style={{ marginBottom: 12, fontSize: '24px', fontWeight: 700, color: 'var(--color-text)' }}>Recover Password</h2>
      <p style={{ marginBottom: 16, fontSize: '14px', color: 'var(--color-text-secondary)' }}>
        Enter your name and email to receive a reset link.
      </p>
      {error && (
        <div style={{ 
          color: '#b00020', 
          marginBottom: 12, 
          padding: '8px 12px', 
          background: '#ffebee', 
          borderRadius: 6, 
          fontSize: '14px' 
        }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ 
          color: '#2e7d32', 
          marginBottom: 12, 
          padding: '8px 12px', 
          background: '#e8f5e9', 
          borderRadius: 6, 
          fontSize: '14px' 
        }}>
          {success}
        </div>
      )}
      <input 
        placeholder="Name" 
        value={name} 
        onChange={(e) => setName(e.target.value)} 
        onKeyDown={handleKeyDown}
        style={{ 
          width: '100%', 
          padding: 12, 
          border: '1px solid #ddd', 
          borderRadius: 8, 
          marginBottom: 12, 
          fontSize: '16px', 
          outline: 'none', 
          transition: 'border-color 0.2s' 
        }} 
        onFocus={(e) => e.target.style.borderColor = '#007bff'} 
        onBlur={(e) => e.target.style.borderColor = '#ddd'} 
      />
      <input 
        placeholder="Email" 
        type="email"
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
        onKeyDown={handleKeyDown}
        style={{ 
          width: '100%', 
          padding: 12, 
          border: '1px solid #ddd', 
          borderRadius: 8, 
          marginBottom: 16, 
          fontSize: '16px', 
          outline: 'none', 
          transition: 'border-color 0.2s' 
        }} 
        onFocus={(e) => e.target.style.borderColor = '#007bff'} 
        onBlur={(e) => e.target.style.borderColor = '#ddd'} 
      />
      <button 
        onClick={submit} 
        disabled={loading} 
        style={{ 
          width: '100%', 
          padding: 12, 
          background: loading ? '#ccc' : '#059669', 
          color: 'white', 
          border: 'none', 
          borderRadius: 8, 
          cursor: loading ? 'not-allowed' : 'pointer', 
          fontSize: '16px', 
          fontWeight: 600, 
          transition: 'background 0.2s' 
        }}
      >
        {loading ? 'Sending...' : 'Send reset link'}
      </button>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button 
          onClick={() => onSwitch('login')} 
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: '#007bff', 
            cursor: 'pointer', 
            fontSize: '14px', 
            padding: '4px 0' 
          }}
        >
          Back to login
        </button>
      </div>
    </div>
  );
};

export default RecoverPassword;


