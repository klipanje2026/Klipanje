import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader } from '../SiteHeader/SiteHeader';
export function PublicFooter() {
  return <footer className="home-footer"><Link className="home-logo" data-no-tooltip to="/" aria-label="edita.ba početna"><img className="edita-brand-mark" src="/edita-logo.svg" width="40" height="40" alt="" aria-hidden="true"/>edita<span className="home-logo-dot">.ba</span></Link><span>Ti kreiraš. Edita uređuje.</span><nav aria-label="Korisne informacije"><Link to="/privatnost">Politika privatnosti</Link><Link to="/faq">Česta pitanja</Link></nav><small>© {new Date().getFullYear()} edita.ba</small></footer>;
}
export function PublicLayout({children}:{children:ReactNode}) {
  return <div className="home-page public-page"><SiteHeader />{children}<PublicFooter /></div>;
}
