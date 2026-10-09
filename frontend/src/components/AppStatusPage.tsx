import {LogoMark} from './LogoMark';
import {StudioIcon} from './StudioIcon/StudioIcon';

type Props = {kind:'unavailable'|'not-found'|'loading'; message?:string; onRetry?:()=>void; onDiagnostics?:()=>void};

/** Standalone: also renders when account data or the router is unavailable. */
export function AppStatusPage({kind,message,onRetry,onDiagnostics}:Props) {
  const missing=kind==='not-found',loading=kind==='loading';
  return <main className={`app-status-page is-${kind}`}>
    <header className="app-status-header"><a href="/" className="app-status-logo" aria-label="Klipanje" data-no-tooltip><LogoMark size={34}/>Klipanje</a><span>Tvoj prostor za stvaranje</span></header>
    <section className="app-status-card" aria-labelledby="app-status-title">
      <div className="app-status-illustration" aria-hidden="true">{missing?<span className="app-status-code">404</span>:loading?<span className="app-status-spinner"/>:<svg viewBox="0 0 120 84" fill="none"><rect x="8" y="10" width="74" height="52" rx="10"/><path d="M22 25h27M22 34h18M22 47h35"/><rect x="69" y="36" width="42" height="36" rx="9"/><path d="m85 47 10 14m0-14-10 14"/></svg>}</div>
      <p className="app-status-eyebrow">{missing?'POGREŠNA ADRESA':loading?'KLIPANJE STUDIO':'UČITAVANJE NIJE USPJELO'}</p>
      <h1 id="app-status-title">{missing?'Ova stranica nije tu.':loading?'Pripremamo tvoj prostor.':'Klipanje se trenutno ne može učitati.'}</h1>
      <p className="app-status-description" role={loading?'status':missing?undefined:'alert'}>{message||(missing?'Link je možda promijenjen ili stranica više nije dostupna. Vrati se na početnu i nastavi odatle.':loading?'Učitavamo Klipanje. Još samo trenutak.':'Trenutno ne možemo učitati Klipanje. Pokušaj ponovo za nekoliko trenutaka.')}</p>
      {!loading&&<div className="app-status-actions">{onRetry&&<button className="status-primary" type="button" onClick={onRetry}><StudioIcon name="undo"/>Pokušaj ponovo</button>}<a className={missing?'status-primary':'status-secondary'} href="/">Na početnu<StudioIcon name="arrow"/></a></div>}
      {onDiagnostics&&<div className="app-status-support"><span>Ako se problem ponavlja</span><button type="button" onClick={onDiagnostics}><StudioIcon name="download"/>Preuzmi izvještaj za podršku</button></div>}
    </section>
    <footer className="app-status-footer">Ti kreiraš. <span>Klipanje uređuje.</span></footer>
  </main>;
}
