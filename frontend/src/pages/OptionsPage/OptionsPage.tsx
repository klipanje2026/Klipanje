import {ProfileSettings} from '../../components/ProfileSettings';
import {AnalyticsPreference} from '../../components/ProductAnalytics';
import {SocialLogin} from '../../components/SocialLogin';
import {useAuth} from '../../context/auth-context';
import { ThemePicker } from '../../components/ThemePicker';
import { StudioIcon } from '../../components/StudioIcon/StudioIcon';
export function OptionsPage() {
  const {session}=useAuth();
  return <main className="options-page">
    <header className="options-heading">
      <div><span className="options-eyebrow">TVOJ PROSTOR</span><h1>Profil i postavke</h1><p>Uredi svoj profil i prilagodi Editu sebi.</p></div>
      <a className="options-back" href="/studio"><StudioIcon name="back"/>Nazad u studio</a>
    </header>
    <div className="options-grid">
      <ProfileSettings/>
      <section className="options-card options-appearance" aria-labelledby="appearance-heading">
        <header><h2 id="appearance-heading">Izgled aplikacije</h2><p>Odaberi temu. Izbor se pamti na ovom uređaju.</p></header>
        <ThemePicker/>
      </section>
      <AnalyticsPreference/>
      <section className="options-card options-connections" aria-labelledby="connections-heading">
        <header><h2 id="connections-heading">Povezivanje prijave</h2><p>Koristi svoj postojeći račun za brži ulazak u Editu.</p></header>
        <SocialLogin context="connect"/>
      </section>
      {session.user?.affiliateLink&&<section className="options-card options-affiliate"><header><h2>Tvoj affiliate link</h2><p>Podijeli svoj link i prati rezultate.</p></header><input aria-label="Affiliate link" readOnly value={window.location.origin+session.user.affiliateLink} onFocus={event=>event.target.select()}/><a href="/affiliate">Link i statistika <StudioIcon name="arrow"/></a></section>}
    </div>
  </main>;
}
