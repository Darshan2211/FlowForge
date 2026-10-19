import { useRef, useState } from 'react';
import api from '../api/client';
import { PRIORITIES } from '../ui';

export default function CreateItemModal({ teams, onClose, onCreated }) {

  const keyRef = useRef(crypto.randomUUID());
  const [form, setForm] = useState({
    title: '', description: '', teamId: teams[0]?.teamId || '', priority: 'medium',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    if (saving) return;
    if (!form.title.trim() || !form.description.trim() || !form.teamId) {
      setError('Add a title, a reason, and pick a team.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.post('/items', form, { headers: { 'Idempotency-Key': keyRef.current } });
      keyRef.current = crypto.randomUUID(); 
      onCreated();
    } catch (e) {
      setError(errMsg(e)); 
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0 }}>New work item</h3>
        <input placeholder="Title" value={form.title} onChange={set('title')} />
        <textarea placeholder="Why does this exist?" rows={4} value={form.description} onChange={set('description')} />
        <select value={form.teamId} onChange={set('teamId')}>
          {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.teamName}</option>)}
        </select>
        <select value={form.priority} onChange={set('priority')}>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {error && <p className="error">{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button disabled={saving} onClick={submit}>{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}