import { useEffect, useState } from 'react';
import { api } from './api.js';
// 1) ask the server who we are, 2) open a live stream. EventSource reconnects on its own after a drop.
export function useLiveState() {
  const [state, setState] = useState(null), [status, setStatus] = useState('loading'), [live, setLive] = useState(false);
  useEffect(() => { api.state().then(s => { setState(s); setStatus('ready'); }).catch(e => setStatus(e.status === 401 ? 'anon' : 'error')); }, []);
  useEffect(() => {
    if (status !== 'ready') return;
    const es = new EventSource('/api/events');
    es.onopen = () => setLive(true); es.onerror = () => setLive(false); es.onmessage = e => setState(JSON.parse(e.data));
    return () => es.close();
  }, [status]);
  return { state, setState, live, status,
    signedIn: s => { setState(s); setStatus('ready'); },
    signedOut: () => { setState(null); setStatus('anon'); } };
}
