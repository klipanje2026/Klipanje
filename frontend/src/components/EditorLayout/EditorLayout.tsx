import {LogoMark} from '../LogoMark';
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ProjectPicker, type ProjectKind } from '../ProjectPicker';
import { StudioIcon } from '../StudioIcon/StudioIcon';
import { ThemePicker } from '../ThemePicker';
import { AppUpdateNotice } from '../AppUpdateNotice';
import { apiJson, resetCsrf } from '../../lib/api';
import { useAuth } from '../../context/auth-context';

export function EditorLayout() {
  const { session, refresh } = useAuth();
  const location = useLocation();
  const videoEditor = ['/video-editor','/videa'].includes(location.pathname);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState<ProjectKind | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.editorSkin = 'aqua';
    return () => { delete document.documentElement.dataset.editorSkin; };
  }, []);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!profileRef.current?.contains(event.target as Node)) setMenu(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, []);

  async function signOut() {
    setBusy(true);
    setError('');
    try { await apiJson('/api/auth/logout', { method: 'POST' }); resetCsrf(); await refresh(); }
    catch { setError('Odjava nije uspjela. Pokušaj ponovo.'); }
    finally { setBusy(false); }
  }

  return <div className={'editor-layout is-editing-workspace' + (!videoEditor ? ' is-subtitle-workspace' : '')}>
    <div className="workspace-header-static">
      <header className={'editor-navbar ' + (videoEditor ? 'is-video' : 'is-captions')} aria-label={videoEditor ? 'Alati video editora' : 'Alati editora titlova'}>
        <a href="/" className="editor-navbar-logo" data-no-tooltip aria-label="Klipanje početna"><LogoMark size={28}/><span>Klipanje</span></a>
        <nav className="workspace-editor-nav" aria-label="Editori">
          <a href="/projekti">Projekti</a>
          <a href={"/skripte"+location.search}>Skripte</a>
          <a href={"/fotografije"+location.search}>Fotografije</a>
          <a href={"/videa"+location.search} aria-current={videoEditor ? 'page' : undefined}>Video editor</a>
        </nav>
        <div className="editor-navbar-project" id="workspace-header-project" />
        <div className="editor-navbar-tools" id="workspace-header-tools" />
        <div className="editor-navbar-utilities">
          <div className="editor-navbar-commands" id="workspace-header-commands" />
          {!videoEditor&&<button type="button" className="editor-navbar-utility" title="Spremljeni projekti" aria-label="Otvori spremljeni projekt" onClick={() => setPicker(videoEditor ? 'video' : 'subtitles')}><StudioIcon name="menu" /></button>}
          <div className="workspace-profile" ref={profileRef}>
            <button data-no-tooltip className="workspace-profile-trigger" aria-label={'Korisnički meni: ' + session.user?.username} aria-expanded={menu} aria-controls="workspace-user-menu" onClick={() => setMenu(!menu)}>
              <span className="workspace-avatar">{session.user?.username.slice(0, 1)}</span><StudioIcon name="chevron" />
            </button>
            {menu && <div className="workspace-user-menu" id="workspace-user-menu">
              <div className="workspace-user-identity"><div><strong>{session.user?.name}</strong><small>@{session.user?.username}</small></div></div>
              <a href="/promjena-lozinke">Promijeni lozinku</a>
              {session.user?.isStaff && <a href="/administracija"><span><StudioIcon name="settings" />Administracija</span></a>}
              <details className="workspace-theme-list"><summary>Teme</summary><ThemePicker /></details>
              <button className="workspace-signout" disabled={busy} onClick={() => void signOut()}><span><StudioIcon name="back" />{busy ? 'Odjava…' : 'Odjavi se'}</span></button>
              {error && <p role="alert">{error}</p>}
            </div>}
          </div>
          <div className="workspace-theme-slot" />
          <div className="editor-navbar-action" id="workspace-header-action" />
        </div>
      </header>
    </div>
    {picker && <ProjectPicker kind={picker} onClose={() => setPicker(null)} />}
    <AppUpdateNotice />
    <div className="workspace-body"><div className="editor-outlet"><Outlet /></div></div>
  </div>;
}
