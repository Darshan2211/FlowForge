import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import api, { errMsg } from '../api/client';

export default function RequireAuth() {
  const location = useLocation();
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    api.get('/auth/me')
      .then(() => {
        if (active) setStatus('authenticated');
      })
      .catch((err) => {
        if (!active) return;
        if (err.response?.status === 401) {
          setStatus('unauthenticated');
          return;
        }
        setError(errMsg(err));
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [retry]);

  if (status === 'checking') return <p className="muted">Checking your session…</p>;
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (status === 'error') {
    return (
      <div className="login-page">
        <div className="login-card">
          <p className="error">{error}</p>
          <button className="full" onClick={() => {
            setError('');
            setStatus('checking');
            setRetry((count) => count + 1);
          }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
