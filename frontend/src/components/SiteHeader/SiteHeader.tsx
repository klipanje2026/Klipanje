import {TokenBalance} from '../AccountTools';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { StudioIcon } from '../StudioIcon/StudioIcon';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
  return <header className="home-header">
    <Link to="/" className="home-logo" data-no-tooltip aria-label="edita.ba — početna"><img className="edita-brand-mark" src="/edita-logo.svg" width="40" height="40" alt="" aria-hidden="true"/>edita<span className="home-logo-dot">.ba</span></Link>
    <button className="home-menu-toggle" aria-label={open ? 'Zatvori meni' : 'Otvori meni'} aria-expanded={open} aria-controls="home-navigation" onClick={() => setOpen(!open)}><StudioIcon name={open ? 'close' : 'menu'} /></button>
    <nav id="home-navigation" className={`home-navigation${open ? ' is-open' : ''}`} aria-label="Glavni meni" onClick={() => setOpen(false)}>
      <a href="/#alati">Alati</a><a href="/#stilovi">Stilovi titlova</a><Link to="/pretplate">Pretplate</Link><Link to="/faq">FAQ</Link>{session.user?.affiliateLink&&<Link to="/affiliate">Moj affiliate</Link>}{session.user?.isStaff && <Link to="/studio">Administracija</Link>}
    </nav>
    <div className="home-header-actions"><TokenBalance/>
      {!session.user && <Link className="home-login" to="/login">Prijavi se</Link>}
      <Link className="home-button home-button--accent" to={'/titlovi'}>{session.user ? 'Moj studio' : 'Kreni stvarati'}<StudioIcon name="arrow" /></Link>
    </div>
  </header>;
}
