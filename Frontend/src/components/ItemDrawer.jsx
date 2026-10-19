import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import api, {errMsg} from '../api/client';
import { PRIORITIES, label, priorityClass, statusClass, eventColor, initials } from '../ui';

const describe = (ev) => {
  switch (ev.type) {
    case 'created': return 'created this item';
    case 'claimed': return 'claimed this item';
    case 'status_changed': return `changed status: ${label(ev.from)} → ${label(ev.to)}`;
    case 'priority_changed': return `changed priority: ${ev.from} → ${ev.to}`;
    case 'reassigned': return 'reassigned this item';
    case 'updated': return 'edited this item';
    default: return ev.type;
  }
};

export default function ItemDrawer() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, onChanged } = useOutletContext(); 

  const [item, setItem] = useState(null);
  const [events, setEvents] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');

  const loadItem = useCallback(async () => {
    const { data } = await api.get(`/items/${id}`);
    setItem(data);
  }, [id]);

  const loadTimeline = useCallback(async (cursor) => {
    const { data } = await api.get(`/items/${id}/timeline`, { params: cursor ? { cursor } : {} });
    setEvents((prev) => (cursor ? [...prev, ...data.items] : data.items));
    setNextCursor(data.nextCursor);
  }, [id]);

  useEffect(() => {
    setItem(null); setEvents([]); setError(''); setBanner('');
    loadItem().catch((e) => setError(e.response?.status === 404 ? 'Item not found.' : errMsg(e)));
    loadTimeline().catch(() => {});
  }, [id, loadItem, loadTimeline]);

  
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && nav('/');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav]);

  const reload = async () => {
    await Promise.all([loadItem(), loadTimeline()]).catch(() => {});
    onChanged(); 
  };

 
  const explain = (e) =>
    e.response?.status === 409
      ? (e.response.data?.error || 'This item was changed by someone else. Showing the latest version.')
      : errMsg(e);

  const act = async (fn) => {
    setBanner('');
    setBusy(true);
    try { await fn(); } catch (e) { setBanner(explain(e)); }
    await reload();
    setBusy(false);
  };

  
  const claim = async () => {
    const before = item;
    setItem({ ...item, owner: { id: user?.id, name: user?.name }, canClaim: false });
    setBanner('');
    setBusy(true);
    try {
      await api.post(`/items/${id}/claim`);
    } catch (e) {
      setItem(before);        
      setBanner(explain(e));
    }
    await reload();
    setBusy(false);
  };

  const changeStatus = (status) =>
    act(() => api.post(`/items/${id}/status`, { status, version: item.version }));

  const changePriority = (priority) =>
    act(() => api.post(`/items/${id}/priority`, { priority, version: item.version }));

  const addComment = () =>
    act(async () => {
      await api.post(`/items/${id}/activiy`, { text: comment });
      setComment('');
    });

  const btnClass = (s) => (s === 'approved' ? 'ok' : s === 'rejected' ? 'bad' : '');
  const btnText = (s) => (s === 'approved' ? 'Approve' : s === 'rejected' ? 'Reject' : `Move to ${label(s)}`);
  const hasApprovalRole = ['approver', 'admin'].includes(item?.myRole);
  const isItemOwner = Boolean(item?.owner?.id && user?.id &&
    String(item.owner.id) === String(user.id));
  const canApprove = item?.canApprove ?? (hasApprovalRole && !isItemOwner);
  const approvalBlocked = !user?.id || isItemOwner || !canApprove;
  const showApprovalActions = item?.status === 'pending_approval';

  return (
    <>
      <div className="scrim" onClick={() => nav('/')} />
      <aside className="drawer">
        <button className="secondary close" onClick={() => nav('/')}>Close</button>

        {!item && !error && <p className="muted">Loading…</p>}
        {error && <p className="error">{error}</p>}

        {item && (
          <>
            {banner && (
              <div className="banner t-yellow">
                <span>{banner}</span>
                <button className="secondary" onClick={reload}>Reload</button>
              </div>
            )}

            <h2 style={{ margin: '4px 0' }}>{item.title}</h2>
            <p style={{ color: '#4b5365' }}>{item.description}</p>

            <div className="meta">
              <span className={`badge ${priorityClass(item.priority)}`}>{item.priority}</span>
              <span className={`badge ${statusClass(item.status)}`}>{label(item.status)}</span>
              {item.status === 'pending_approval' && (
                <span className="badge t-violet">Pending approval</span>
              )}
              {item.owner
                ? <span><span className="avatar t-violet">{initials(item.owner.name)}</span><strong>{item.owner.name}</strong></span>
                : <span className="badge t-orange">Unclaimed</span>}
              <span className="badge t-green">Your role: {item.myRole}</span>
            </div>

            <div className="next t-blue"><strong>Next:</strong> {item.nextAction}</div>

            <div className="actions">
              {item.canClaim && <button disabled={busy} onClick={claim}>Claim</button>}
              {showApprovalActions && (
                <>
                  <button className="ok" disabled={busy || approvalBlocked} onClick={() => changeStatus('approved')}>
                    Approve
                  </button>
                  <button className="bad" disabled={busy || approvalBlocked} onClick={() => changeStatus('rejected')}>
                    Reject
                  </button>
                  {isItemOwner && <span className="muted">
                    You can’t approve your own item.</span>}
                  {!user?.id && <span className="muted">Checking your account…</span>}
                  {!isItemOwner && user?.id && !canApprove && (
                    <span className="muted">Your team role doesn’t have approval permission.</span>
                  )}
                </>
              )}
              {item.nextStatuses?.filter((s) => s !== 'approved' && s !== 'rejected').map((s) => (
                <button key={s} className={btnClass(s)} disabled={busy} onClick={() => changeStatus(s)}>
                  {btnText(s)}
                </button>
              ))}
              {item.canSetPriority && (
                <select value={item.priority} disabled={busy} onChange={(e) => changePriority(e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
            </div>

            <h3>History</h3>
            <div className="timeline">
              {events.length === 0 && <p className="muted">No history yet.</p>}
              {events.map((ev) => (
                <div key={`${ev.kind}-${ev._id}`} className={`event c-${eventColor(ev)}`}>
                  <div className="muted">
                    <strong>{
                    ev.actorName || ev.authorName}</strong> · {new Date(ev.createdAt).toLocaleString()}
                  </div>
                  {ev.kind === 'comment'
                    ? <div className="text t-blue">{ev.text}</div>
                    : <div>{describe(ev)}</div>}
                </div>
              ))}
              {nextCursor && (
                <button className="secondary" onClick={() => loadTimeline(nextCursor)}>Load older</button>
              )}
            </div>

            {item.canComment && (
              <div className="comment-box">
                <textarea rows={3} placeholder="Add a comment…" value={comment}
                          onChange={(e) => setComment(e.target.value)} />
                <button disabled={busy || !comment.trim()} onClick={addComment}>Comment</button>
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}