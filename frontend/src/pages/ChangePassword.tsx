import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { apiJson, resetCsrf } from '../lib/api';

export function ChangePassword() {
  const {session, refresh} = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await apiJson('/api/auth/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      resetCsrf(); await refresh(); navigate('/',{replace:true});
    } catch(cause) {setError(cause instanceof Error?cause.message:'Promjena lozinke nije uspjela.');}
    finally {setBusy(false);}
  }
  return <main className="account-page klipanje-password-page"><header className="account-header"><Link to="/" className="account-logo"><img src="/klipanje-logo.svg" alt="" width="28" height="28"/>Klipanje</Link></header><section className="account-card"><p className="account-brand">{session.user?.username}</p><h1>{session.user?.mustChangePassword?'Postavi svoju lozinku.':'Promijeni lozinku.'}</h1><p className="account-description">{session.user?.mustChangePassword?'Ovo je tvoj prvi ulazak. Zamijeni privremenu lozinku prije nego počneš raditi.':'Nova lozinka vrijedi za račun na ovom računaru.'}</p><form onSubmit={event=>void submit(event)} aria-busy={busy}>
    <label>Trenutna lozinka<input name="currentPassword" type="password" autoComplete="current-password" required disabled={busy}/></label>
    <label>Nova lozinka<input name="newPassword" type="password" autoComplete="new-password" minLength={8} required disabled={busy}/></label>
    <label>Ponovi novu lozinku<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required disabled={busy}/></label>
    {error&&<p className="account-error" role="alert">{error}</p>}<button className="account-submit" disabled={busy}>{busy?'Spremanje…':'Spremi lozinku i nastavi'}</button>
  </form></section></main>;
}
