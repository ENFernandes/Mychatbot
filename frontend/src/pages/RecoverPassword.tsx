import React, { useState } from 'react';
import { api } from '../services/api';

const RecoverPassword: React.FC<{ onSwitch: (page: 'login') => void }>
  = ({ onSwitch }) => {
  const [email, setEmail] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);
      setInfo(null);
      // Backend placeholder: podemos implementar envio real depois
      await api.post('/auth/recover', { email }).catch(() => Promise.resolve());
      setInfo('If the email exists, we will send instructions to recover your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '40px auto', background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginBottom: 12 }}>Recover Password</h2>
      {info && <div style={{ color: '#0d6efd', marginBottom: 8 }}>{info}</div>}
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, marginBottom: 12 }} />
      <button onClick={submit} disabled={loading} style={{ width: '100%', padding: 10, background: '#007bff', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Send</button>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button onClick={() => onSwitch('login')} style={{ background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer' }}>Back</button>
      </div>
    </div>
  );
};

export default RecoverPassword;


