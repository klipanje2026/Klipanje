import {LogoMark} from './LogoMark';
import {useDismissHeaderMenus} from '../lib/use-dismiss-header-menus';
import '@fontsource-variable/manrope';
import {AccountMenu} from './AccountMenu';
import { Link, NavLink, Outlet } from 'react-router-dom';
import './MainLayout.scss';
import { ThemePicker } from './ThemePicker';
import { Icon } from './ProductionWorkspace';
import {useLocation} from 'react-router-dom';

export function MainLayout() {
  useDismissHeaderMenus();
  const {search}=useLocation();
  return <div className="klipanje-shell">
    <header className="klipanje-header">
      <Link to="/" className="klipanje-brand"><LogoMark size={34}/>Klipanje</Link>
      <nav aria-label="Glavna navigacija">
        <NavLink to={"/projekti"+search}>Projekti</NavLink><NavLink to={"/skripte"+search}>Skripte</NavLink><NavLink to={"/fotografije"+search}>Fotografije</NavLink><NavLink to={"/videa"+search}>Video</NavLink><NavLink to="/video-alati">Video alati</NavLink>
      </nav>
      <div className="workspace-theme-slot"/><details className="production-themes"><summary>Teme <Icon name="chevron"/></summary><ThemePicker/></details>
      <AccountMenu/>
    </header>
    <main className="klipanje-main"><Outlet/></main>
    <footer className="klipanje-footer"><span>Klipanje</span><span>Oktobar 2026</span></footer>
  </div>;
}
