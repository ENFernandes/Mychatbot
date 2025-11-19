import React from 'react';

const BillingCancel: React.FC = () => {
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
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>ℹ️</div>
        <h2 style={{ marginBottom: '12px', color: '#2563eb' }}>Pagamento Cancelado</h2>
        <p style={{ marginBottom: '20px', color: '#666' }}>
          O pagamento foi cancelado. Pode tentar novamente quando quiser.
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
          Voltar à aplicação
        </button>
      </div>
    </div>
  );
};

export default BillingCancel;

