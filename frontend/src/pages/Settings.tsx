import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

const KeyEditor: React.FC<{
  label: string;
  provider: 'openai' | 'gemini' | 'claude';
}> = ({ label, provider }) => {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/user/keys');
        const key = data.keys?.find((k: any) => k.provider === provider);
        if (key) setSaved(true);
      } catch (_) {}
    };
    load();
  }, [provider]);

  const save = async () => {
    setLoading(true);
    try {
      await api.put('/user/keys', { provider, apiKey: value.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert('Error saving');
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    setLoading(true);
    try {
      await api.delete(`/user/keys/${provider}`);
      setValue('');
      setSaved(false);
    } catch (e) {
      alert('Error deleting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>
        {label}
        {saved && <span style={{ color: '#28a745', marginLeft: 8 }}>✓ Saved</span>}
      </label>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="sk-..."
        disabled={loading}
        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
      />
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          onClick={save}
          disabled={loading || !value.trim()}
          style={{ padding: '8px 12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Save
        </button>
        <button
          onClick={remove}
          disabled={loading}
          style={{ padding: '8px 12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

const Settings: React.FC = () => {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ marginBottom: '16px' }}>API Key Settings</h2>
      <KeyEditor label="OpenAI API Key" provider="openai" />
      <KeyEditor label="Gemini API Key" provider="gemini" />
      <KeyEditor label="Claude API Key" provider="claude" />
    </div>
  );
};

export default Settings;


