import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

type Conversation = { id: string; title: string; created_at: string; updated_at: string };

const ConversationSidebar: React.FC<{
  activeId: string | null;
  onSelect: (id: string) => void;
}> = ({ activeId, onSelect }) => {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/conversations');
      setItems(data.conversations || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handleConversationCreated = () => {
      load();
    };
    window.addEventListener('conversation-created', handleConversationCreated);
    return () => {
      window.removeEventListener('conversation-created', handleConversationCreated);
    };
  }, []);

  const createConversation = async () => {
    const { data } = await api.post('/conversations', {});
    await load();
    onSelect(data.id);
  };

  const deleteConversation = async (id: string) => {
    const wasActive = activeId === id;
    await api.delete(`/conversations/${id}`);
    const { data } = await api.get('/conversations');
    const updatedItems = data.conversations || [];
    setItems(updatedItems);
    // After deletion, if the deleted conversation was active, select first available or null
    if (wasActive) {
      if (updatedItems.length > 0) {
        onSelect(updatedItems[0].id);
      } else {
        onSelect(null as any);
      }
    }
  };

  const startEdit = (conv: Conversation) => {
    setEditingId(conv.id);
    setTitleDraft(conv.title);
  };

  const saveTitle = async (id: string) => {
    await api.patch(`/conversations/${id}`, { title: titleDraft || 'New conversation' });
    setEditingId(null);
    await load();
  };

  return (
    <aside style={{ width: 300, borderLeft: '1px solid #eee', padding: 12, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong>Conversations</strong>
        <button onClick={createConversation} style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, background: '#f8f9fa', cursor: 'pointer' }}>New</button>
      </div>
      {loading && <div>Loading...</div>}
      {items.map((c) => (
        <div key={c.id} style={{ padding: 8, borderRadius: 6, background: activeId === c.id ? '#e7f1ff' : 'transparent', marginBottom: 6 }}>
          {editingId === c.id ? (
            <div>
              <input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} style={{ width: '100%', padding: 6, border: '1px solid #ddd', borderRadius: 6, marginBottom: 6 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => saveTitle(c.id)} style={{ padding: '6px 10px', background: '#28a745', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Save</button>
                <button onClick={() => setEditingId(null)} style={{ padding: '6px 10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => onSelect(c.id)} style={{ background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', color: '#333', fontWeight: 600, flex: 1 }}>
                {c.title}
              </button>
              <button onClick={() => startEdit(c)} style={{ background: 'transparent', border: 'none', color: '#0d6efd', cursor: 'pointer', marginRight: 6 }}>Edit</button>
              <button onClick={() => deleteConversation(c.id)} style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer' }}>Delete</button>
            </div>
          )}
        </div>
      ))}
    </aside>
  );
};

export default ConversationSidebar;


