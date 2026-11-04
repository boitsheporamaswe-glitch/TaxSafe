import { useEffect, useState } from 'react';
import { api, snapshot, subscribe, reload } from './api.js';
// Demo version: no server and no login. Everything lives in this browser; other tabs stay in sync.
export function useLiveState() {
  const [state, setState] = useState(snapshot());
  useEffect(() => {
    const off = subscribe(setState), onStorage = e => { if (e.key === api.KEY) reload(); };
    window.addEventListener('storage', onStorage);
    return () => { off(); window.removeEventListener('storage', onStorage); };
  }, []);
  return { state, setState, live: true, status: 'ready', signedIn: () => {}, signedOut: () => {} };
}
