import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const BillingSuccess: React.FC = () => {
  const { refreshUser } = useAuth();

  useEffect(() => {
    // Refresh user data to get updated subscription info
    refreshUser().catch(console.error);
    
    // Redirect to settings after 3 seconds
    const timer = setTimeout(() => {
      window.location.href = '/';
    }, 3000);

    return () => clearTimeout(timer);
  }, [refreshUser]);

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
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
        <h2 style={{ marginBottom: '12px', color: '#059669' }}>Pagamento Bem-Sucedido!</h2>
        <p style={{ marginBottom: '20px', color: '#666' }}>
          A sua subscrição foi ativada com sucesso. A redirecionar...
        </p>
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
          Ir para a aplicação
        </button>
      </div>
    </div>
  );
};

export default BillingSuccess;

