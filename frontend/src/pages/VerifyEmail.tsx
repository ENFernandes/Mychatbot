import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const VerifyEmail: React.FC = () => {
  const { login } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState<string>('A verificar o seu email...');
  
  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Token de verificação não encontrado.');
        return;
      }

      try {
        const response = await api.post('/auth/verify-email', { token });
        
        if (response.data?.token && response.data?.user) {
          // Store the token
          localStorage.setItem('access_token', response.data.token);
          
          // Reload page to update auth context
          window.location.reload();
          
          setStatus('success');
          setMessage('Email verificado com sucesso! A redirecionar...');
          
          // Redirect to home after 2 seconds
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        } else {
          setStatus('error');
          setMessage('Resposta inválida do servidor.');
        }
      } catch (error: any) {
        setStatus('error');
        const errorMessage = error?.response?.data?.error || 'Erro ao verificar o email.';
        setMessage(errorMessage);
      }
    };

    verifyEmail();
  }, [token, login]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'var(--color-background, #f5f5f5)',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center'
      }}>
        {status === 'verifying' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
            <h2 style={{ marginBottom: '12px' }}>A verificar...</h2>
            <p>{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
            <h2 style={{ marginBottom: '12px', color: '#059669' }}>Email Verificado!</h2>
            <p>{message}</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
            <h2 style={{ marginBottom: '12px', color: '#dc2626' }}>Erro na Verificação</h2>
            <p style={{ marginBottom: '20px', color: '#666' }}>{message}</p>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '10px 20px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Ir para a página inicial
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;

