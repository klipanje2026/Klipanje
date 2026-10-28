import {LocalToolLinks} from '../LocalToolLinks';
import {LogoMark} from '../LogoMark';
import {useDismissHeaderMenus} from '../../lib/use-dismiss-header-menus';
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ProjectPicker, type ProjectKind } from '../ProjectPicker';
import { StudioIcon } from '../StudioIcon/StudioIcon';
import { ThemePicker } from '../ThemePicker';
import { AppUpdateNotice } from '../AppUpdateNotice';
import {AccountMenu} from '../AccountMenu';
import '../MainLayout.scss';


export function EditorLayout() {
  useDismissHeaderMenus();
  const location = useLocation();
  const videoEditor = ['/video-editor','/videa'].includes(location.pathname);
  const [picker, setPicker] = useState<ProjectKind | null>(null);

  useEffect(() => {
    document.documentElement.dataset.editorSkin = 'aqua';
    return () => { delete document.documentElement.dataset.editorSkin; };
  }, []);
  return <div className={'editor-layout is-editing-workspace' + (!videoEditor ? ' is-subtitle-workspace' : '')}>
    <div className="workspace-header-static">
      <header className={'editor-navbar ' + (videoEditor ? 'is-video' : 'is-captions')} aria-label={videoEditor ? 'Alati video editora' : 'Alati editora titlova'}>
        <a href="/" className="editor-navbar-logo" data-no-tooltip aria-label="Klipanje početna"><LogoMark size={28}/><span>Klipanje</span></a>
        <nav className="workspace-editor-nav" aria-label="Editori">
          <a href="/projekti">Projekti</a>
          <a href={"/skripte"+location.search}>Skripte</a>
          <a href={"/fotografije"+location.search}>Fotografije</a>
          <a href={"/preeditor"+location.search}>Preeditor</a>
          <a href={"/videa"+location.search} aria-current={videoEditor ? 'page' : undefined}>Video editor</a>
          <a href="/prilagodi-video">Prilagodi video</a>
          <LocalToolLinks/>
        </nav>
        <div className="editor-navbar-project" id="workspace-header-project" />
        <div className="editor-navbar-tools" id="workspace-header-tools" />
        <div className="editor-navbar-utilities">
          <div className="editor-navbar-commands" id="workspace-header-commands" />
          {!videoEditor&&<button type="button" className="editor-navbar-utility" title="Spremljeni projekti" aria-label="Otvori spremljeni projekt" onClick={() => setPicker(videoEditor ? 'video' : 'subtitles')}><StudioIcon name="menu" /></button>}
          <details className="production-themes"><summary>Teme <StudioIcon name="chevron"/></summary><ThemePicker/></details>
          <AccountMenu/>
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
