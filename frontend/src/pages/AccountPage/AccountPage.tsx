import {LogoMark} from '../../components/LogoMark';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { apiJson, resetCsrf } from '../../lib/api';
import { useAuth } from '../../context/auth-context';
import { StudioIcon } from '../../components/StudioIcon/StudioIcon';

export function AccountPage() {
  const { session, refresh } = useAuth();
  const location = useLocation();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const requested = typeof location.state?.from === 'string' ? location.state.from : '/';
  const target = requested === '/' || /^\/(titlovi|video-editor|skripte|fotografije|videa)([?#]|$)/.test(requested) ? requested : '/';
  if (session.user?.mustChangePassword) return <Navigate to="/promjena-lozinke" replace />;
  if (session.user) return <Navigate to={target} replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await apiJson('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      resetCsrf();
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Prijava nije uspjela.'); }
    finally { setBusy(false); }
  }

  return <main className="account-page">
    <header className="account-header"><Link className="account-logo" to="/" data-no-tooltip aria-label="Klipanje"><LogoMark size={34}/>Klipanje</Link></header>
    <div className="account-studio-art" aria-hidden="true">
      <div className="account-art-window"><div className="account-art-title"><i /><i /><i /><span>Klipanje / studio</span></div><div className="account-art-body"><div className="account-art-preview"><StudioIcon name="play" /><span>Tvoja sljedeća priča.</span></div><div className="account-art-tools"><i /><i /><i /><i /></div></div><div className="account-art-timeline"><span /><span /><span /><span /><span /><b /></div></div>
      <div className="account-art-caption"><StudioIcon name="captions" /><span>Svaka riječ na svom mjestu.</span></div>
    </div>
    <section className="account-card" aria-labelledby="account-title">
      <div className="account-welcome-icon"><StudioIcon name="video" /></div>
      <p className="account-brand">TVOJ PROSTOR ZA STVARANJE</p>
      <h1 id="account-title">Prijavi se u Klipanje.</h1>
      <p className="account-description">Tvoje skripte, fotografije i videi na jednom mjestu.</p>
      <form onSubmit={event => void submit(event)} aria-busy={busy}>
        <label>Korisničko ime<input name="username" autoComplete="username" placeholder="Tvoje korisničko ime" maxLength={150} required /></label>
        <div className="account-password-field"><label htmlFor="account-password">Lozinka</label><div><input id="account-password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Unesi lozinku" autoComplete="current-password" required /><button className="account-password-toggle" type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Sakrij' : 'Prikaži'}</button></div></div>
        {error && <p className="account-error" role="alert">{error}</p>}
        <button className="account-submit" disabled={busy} type="submit">{busy ? 'Sačekaj…' : 'Otvori Klipanje'}<StudioIcon name="arrow" /></button>
      </form>
    </section>
    <p className="account-signature">Titlovi i video. Na tvom računaru.</p>
  </main>;
}
