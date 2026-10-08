import { useEffect, useState } from 'react';

// Never replace a running editor automatically: uploads and unsaved edits stay intact.
export function AppUpdateNotice() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (import.meta.env.DEV) return;
    const loaded = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src');
    if (!loaded) return;
    const controller = new AbortController();
    let checking = false;
    const check = async () => {
      if (checking || document.hidden) return;
      checking = true;
      try {
        const response = await fetch('/', { cache: 'no-store', signal: controller.signal });
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return;
        const page = new DOMParser().parseFromString(await response.text(), 'text/html');
        const latest = page.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src');
        if (latest && latest !== loaded) setAvailable(true);
      } catch { /* Offline editing must remain available. */ }
      finally { checking = false; }
    };
    void check();
    const timer = window.setInterval(() => void check(), 60000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', check);document.removeEventListener('visibilitychange', check); };
  }, []);
  if (!available) return null;
  return <div className="app-update-notice" role="status">
    <span>Nova verzija Edite je spremna. Sačekaj završetak uploada i spremi projekat prije osvježavanja.</span>
    <button onClick={() => {
      const next = new URL(window.location.href);
      next.searchParams.set('_edita_reload', String(Date.now()));
      window.location.replace(next.href);
    }}>Osvježi aplikaciju</button>
  </div>;
}
