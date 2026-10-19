import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useMatch, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import CreateItemModal from '../components/CreateItemModal';
import { STATUSES, PRIORITIES, label, priorityClass, statusClass, initials } from '../ui';

const EMPTY = { status: '', priority: '', owner: '', teamId: '' };

export default function Dashboard() {
  const nav = useNavigate();
  const openId = useMatch('/items/:id')?.params.id;

  const [user, setUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);

  const [filters, setFilters] = useState(EMPTY);
  const [search, setSearch] = useState('');   
  const [q, setQ] = useState('');             
  const [refreshKey, setRefreshKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const latest = useRef(0); 

 
  useEffect(() => {
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => {});
    api.get('/teams').then((r) => setTeams(r.data.teams)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);


  const buildParams = useCallback((cursor) => {
    const params = { limit: 20 };
    Object.entries({ ...filters, q }).forEach(([k, v]) => { if (v) params[k] = v; });
    if (cursor) params.cursor = cursor;
    return params;
  }, [filters, q]);


  useEffect(() => {
    const id = ++latest.current;
    setLoading(true);
    setError('');
    api.get('/items', { params: buildParams() })
      .then((r) => {
        if (id !== latest.current) return;
        setItems(r.data.items);
        setNextCursor(r.data.nextCursor);
      })
      .catch((e) => id === latest.current && setError(errMsg(e)))
      .finally(() => id === latest.current && setLoading(false));
  }, [buildParams, refreshKey]);

  useEffect(() => {
    api.get('/items/summary').then((r) => setSummary(r.data)).catch(() => {});
  }, [refreshKey]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const { data } = await api.get('/items', { params: buildParams(nextCursor) });
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const clear = () => { setSearch(''); setQ(''); setFilters(EMPTY); };
  const applyCard = (f) => () => { setSearch(''); setQ(''); setFilters({ ...EMPTY, ...f }); };
  const refresh = () => setRefreshKey((k) => k + 1);

  const logout = async () => {
    try { await api.post('/auth/logout'); } finally { nav('/login'); }
  };

  const canApprove = teams.some((team) => team.role !== 'member');
  const cards = [
    ['Assigned to me', summary?.assignedToMe, 't-blue', { owner: 'me' }],
    ['Urgent', summary?.urgent, 't-red', { priority: 'urgent' }],
    ['Unclaimed', summary?.unclaimed, 't-orange', { owner: 'unassigned' }],
    ...(canApprove ? [['Awaiting approval', summary?.awaitingMyApproval, 't-violet', { status: 'pending_approval' }]] : []),
  ];

  return (
    <div className="layout">
      <header>
        <div className="brand"><i>O</i>Operations Hub</div>
        <div className="who">
          <strong>{user?.username}</strong>
          {teams.map((team) => (
            <span key={team.teamId} className={`badge ${team.role === 'member' ? 't-gray' : 't-green'}`}>
              {team.teamName}: {team.role}
            </span>
          ))}
        </div>
        <button className="secondary" onClick={logout}>Logout</button>
      </header>

      <section className="cards">
        {cards.map(([name, n, color, f]) => (
          <button key={name} className={`card ${color}`} onClick={applyCard(f)}>
            <div className="num">{n ?? '–'}</div>{name}
          </button>
        ))}
      </section>

      <section className="filters">
        <input placeholder="Search title or description…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={filters.teamId} onChange={setFilter('teamId')}>
          <option value="">All my teams</option>
          {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.teamName}</option>)}
        </select>
        <select value={filters.status} onChange={setFilter('status')}>
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select value={filters.priority} onChange={setFilter('priority')}>
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filters.owner} onChange={setFilter('owner')}>
          <option value="">Any owner</option>
          <option value="me">Me</option>
          <option value="unassigned">Unassigned</option>
        </select>
        <button className="secondary" onClick={clear}>Clear</button>
        <button onClick={() => setCreating(true)}>+ New item</button>
      </section>

      <main className="list">
        {loading && <p className="muted">Loading…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && items.length === 0 && <p className="muted">No items match these filters.</p>}

        {items.map((it) => (
          <div key={it._id}
               className={`row stripe-${it.priority} ${openId === String(it._id) ? 'active' : ''}`}
               onClick={() => nav(`/items/${it._id}`)}>
            <span className={`badge ${priorityClass(it.priority)}`}>{it.priority}</span>
            <span className="title">{it.title}</span>
            <span className={`badge ${statusClass(it.status)}`}>{label(it.status)}</span>
            <span className="muted">
              {it.ownerName
                ? <><span className="avatar t-violet">{initials(it.ownerName)}</span>{it.ownerName}</>
                : 'Unclaimed'}
            </span>
            <span className="muted">{new Date(it.updatedAt).toLocaleString()}</span>
          </div>
        ))}

        {nextCursor && (
          <button className="secondary" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </main>

     
      <Outlet context={{ user, onChanged: refresh }} />

      {creating && (
        <CreateItemModal
          teams={teams}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); refresh(); }}
        />
      )}
    </div>
  );
}