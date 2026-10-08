import { useEffect, useState, type ReactNode } from 'react';
import { apiJson } from '../../lib/api';
import { downloadDiagnostics } from '../../lib/diagnostics';
import { AuthContext, type Session } from '../../context/auth-context';
import { AppStatusPage } from '../AppStatusPage';
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ user: null, workspaces: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function refresh() { setSession(await apiJson<Session>('/api/auth/me')); }
  useEffect(() => { refresh().catch(() => setError('Trenutno ne možemo učitati Klipanje. Pokušaj ponovo za nekoliko trenutaka.')).finally(() => setLoading(false)); }, []);
  if (loading) return <AppStatusPage kind="loading"/>;
  if (error) return <AppStatusPage kind="unavailable" message={error} onRetry={()=>window.location.reload()} onDiagnostics={downloadDiagnostics}/>;
  return <AuthContext.Provider value={{ session, refresh }}>{children}</AuthContext.Provider>;
}
