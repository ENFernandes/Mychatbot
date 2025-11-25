import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import './ResetPassword.css';

const ResetPassword: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    
    if (!resetToken) {
      setError('Reset token not found.');
      setValidating(false);
      return;
    }
    
    setToken(resetToken);
    
    // Validate token
    const validateToken = async () => {
      try {
        await api.get('/auth/reset/validate', { params: { token: resetToken } });
        setTokenValid(true);
      } catch (e: any) {
        setError(e?.response?.data?.error || 'The reset link is invalid or has expired.');
        setTokenValid(false);
      } finally {
        setValidating(false);
      }
    };
    
    validateToken();
  }, []);

  const validatePasswordRequirements = (pwd: string) => {
    const requirements = {
      length: pwd.length >= 10,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      symbol: /[!@#$%^&*(),.?":{}|<>\[\];'`~\\/_+=-]/.test(pwd),
    };
    return requirements;
  };

  const requirements = validatePasswordRequirements(password);
  const allRequirementsMet = Object.values(requirements).every(Boolean);

  const submit = async () => {
    if (!allRequirementsMet) {
      setError('Password does not meet all requirements.');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await api.post('/auth/reset', { token, password });
      setSuccess(response.data.message || 'Password updated successfully!');
      setPassword('');
      setConfirmPassword('');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Unable to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading && allRequirementsMet && password === confirmPassword) {
      submit();
    }
  };

  if (validating) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'var(--color-background)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: 40, 
            height: 40, 
            border: '4px solid #f3f3f3', 
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: 'var(--color-text)' }}>Validating token...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'var(--color-background)',
        padding: '20px'
      }}>
        <div style={{ 
          maxWidth: 480, 
          width: '100%',
          background: 'var(--color-surface)', 
          padding: 40, 
          borderRadius: 12, 
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ 
            width: 64, 
            height: 64, 
            background: '#ffebee', 
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: '32px'
          }}>
            ❌
          </div>
          <h2 style={{ 
            marginBottom: 12, 
            fontSize: '24px', 
            fontWeight: 700, 
            color: 'var(--color-text)' 
          }}>
            Invalid token
          </h2>
          <p style={{ 
            marginBottom: 24, 
            fontSize: '16px', 
            color: 'var(--color-text-secondary)' 
          }}>
            {error || 'The reset link is invalid or has expired.'}
          </p>
          <button 
            onClick={() => window.location.href = '/'} 
            style={{ 
              padding: '12px 24px', 
              background: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: 8, 
              cursor: 'pointer', 
              fontSize: '16px', 
              fontWeight: 600 
            }}
          >
            Return to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-page">
      <div className="reset-password-card">
        <h2 style={{ 
          marginBottom: 12, 
          fontSize: '24px', 
          fontWeight: 700, 
          color: 'var(--color-text)' 
        }}>
          Reset your password
        </h2>
        <p style={{ 
          marginBottom: 24, 
          fontSize: '14px', 
          color: 'var(--color-text-secondary)' 
        }}>
          Enter and confirm your new password to continue.
        </p>
        
        {error && (
          <div style={{ 
            color: '#b00020', 
            marginBottom: 16, 
            padding: '12px 16px', 
            background: '#ffebee', 
            borderRadius: 8, 
            fontSize: '14px' 
          }}>
            {error}
          </div>
        )}
        
        {success && (
          <div style={{ 
            color: '#2e7d32', 
            marginBottom: 16, 
            padding: '12px 16px', 
            background: '#e8f5e9', 
            borderRadius: 8, 
            fontSize: '14px' 
          }}>
            {success}
          </div>
        )}
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ 
            display: 'block', 
            marginBottom: 8, 
            fontSize: '14px', 
            fontWeight: 600,
            color: 'var(--color-text)' 
          }}>
            New password
          </label>
          <div style={{ position: 'relative' }}>
            <input 
              className="reset-input"
              placeholder="New password" 
              type={showPassword ? 'text' : 'password'} 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              onKeyDown={handleKeyDown}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="reset-toggle"
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
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ 
            display: 'block', 
            marginBottom: 8, 
            fontSize: '14px', 
            fontWeight: 600,
            color: 'var(--color-text)' 
          }}>
            Confirm password
          </label>
          <div style={{ position: 'relative' }}>
            <input 
              className="reset-input"
              placeholder="Confirm password" 
              type={showConfirmPassword ? 'text' : 'password'} 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              onKeyDown={handleKeyDown}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="reset-toggle"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? (
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
        </div>
        
        <div className="reset-requirements">
          <p style={{ 
            marginBottom: 8, 
            fontWeight: 600, 
            color: 'var(--color-text)' 
          }}>
            Password requirements:
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--color-text-secondary)' }}>
            <li style={{ color: requirements.length ? '#2e7d32' : '#666' }}>
              {requirements.length ? '✓' : '○'} At least 10 characters
            </li>
            <li style={{ color: requirements.uppercase ? '#2e7d32' : '#666' }}>
              {requirements.uppercase ? '✓' : '○'} One uppercase letter
            </li>
            <li style={{ color: requirements.lowercase ? '#2e7d32' : '#666' }}>
              {requirements.lowercase ? '✓' : '○'} One lowercase letter
            </li>
            <li style={{ color: requirements.number ? '#2e7d32' : '#666' }}>
              {requirements.number ? '✓' : '○'} One number
            </li>
            <li style={{ color: requirements.symbol ? '#2e7d32' : '#666' }}>
              {requirements.symbol ? '✓' : '○'} One symbol (!@#$%^&*...)
            </li>
          </ul>
        </div>
        
        <button 
          onClick={submit} 
          disabled={loading || !allRequirementsMet || password !== confirmPassword} 
          style={{ 
            width: '100%', 
            padding: 14, 
            background: (loading || !allRequirementsMet || password !== confirmPassword) ? '#ccc' : '#059669', 
            color: 'white', 
            border: 'none', 
            borderRadius: 8, 
            cursor: (loading || !allRequirementsMet || password !== confirmPassword) ? 'not-allowed' : 'pointer', 
            fontSize: '16px', 
            fontWeight: 600, 
            transition: 'background 0.2s' 
          }}
        >
          {loading ? 'Updating...' : 'Reset password'}
        </button>
        
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a 
            href="/" 
            className="reset-home-link"
          >
            Return to home
          </a>
        </div>
      </div>
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ResetPassword;

