import {LogoMark} from './LogoMark';
import '@fontsource-variable/manrope';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { apiJson, resetCsrf } from '../lib/api';
import './MainLayout.scss';
import { ThemePicker } from './ThemePicker';
import { Icon } from './ProductionWorkspace';
import {useLocation} from 'react-router-dom';

export function MainLayout() {
  const {search}=useLocation();
  const {session, refresh} = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    setBusy(true); setError('');
    try { await apiJson('/api/auth/logout', {method:'POST'}); resetCsrf(); await refresh(); }
    catch { setError('Odjava nije uspjela. Pokušaj ponovo.'); }
    finally { setBusy(false); }
  }
  return <div className="klipanje-shell">
    <header className="klipanje-header">
      <Link to="/" className="klipanje-brand"><LogoMark size={34}/>Klipanje</Link>
      <nav aria-label="Glavna navigacija">
        <NavLink to={"/projekti"+search}>Projekti</NavLink><NavLink to={"/skripte"+search}>Skripte</NavLink><NavLink to={"/fotografije"+search}>Fotografije</NavLink><NavLink to={"/videa"+search}>Video</NavLink>
      </nav>
      <div className="workspace-theme-slot"/><details className="production-themes"><summary>Teme <Icon name="chevron"/></summary><ThemePicker/></details>
      <details className="klipanje-account">
        <summary><span className="klipanje-user-avatar">{session.user?.name.slice(0,1)}</span><span className="klipanje-user-name">{session.user?.name}</span><Icon name="chevron"/></summary>
        <div><strong>@{session.user?.username}</strong>{session.user?.isStaff&&<Link to="/administracija">Administracija</Link>}<Link to="/promjena-lozinke">Promijeni lozinku</Link><button onClick={()=>void signOut()} disabled={busy}>{busy?'Odjava…':'Odjavi se'}</button>{error&&<p role="alert">{error}</p>}</div>
      </details>
    </header>
    <main className="klipanje-main"><Outlet/></main>
    <footer className="klipanje-footer"><span>Klipanje</span><span>Oktobar 2026</span></footer>
  </div>;
}
