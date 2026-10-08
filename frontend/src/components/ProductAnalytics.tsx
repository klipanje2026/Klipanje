import {PresenceTracker} from './PresenceTracker';
import {useEffect,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {useAuth} from '../context/auth-context';
import {analyticsChoice,setAnalyticsChoice,setAnalyticsExcluded,trackProduct,flushAnalytics} from '../lib/product-analytics';
import './ProductAnalytics.scss';
export function AnalyticsPreference(){
 const [choice,setChoice]=useState(analyticsChoice);
 useEffect(()=>{const update=()=>setChoice(analyticsChoice());window.addEventListener('edita-analytics-choice',update);return()=>window.removeEventListener('edita-analytics-choice',update);},[]);
 return <section className="options-card options-analytics" aria-labelledby="analytics-heading">
  <header><h2 id="analytics-heading">Privatnost i analitika</h2><p>Pomozi nam poboljšati funkcije i stilove koje koristiš.</p></header>
  <div className="options-switch-row"><div><strong id="analytics-label">Analitika korištenja</strong><span>{choice==='yes'?'Uključena':'Isključena'}</span></div><button className="options-switch" type="button" role="switch" aria-checked={choice==='yes'} aria-labelledby="analytics-label" onClick={()=>setAnalyticsChoice(choice==='yes'?'no':'yes')}><span/></button></div>
  <p className="options-note">Sadržaj videa, tekst titlova i nazivi datoteka se ne šalju.</p>
 </section>;
}
export function ProductAnalytics(){
 const {session}=useAuth(),location=useLocation(),[choice,setChoice]=useState(analyticsChoice);
 useEffect(()=>{const update=()=>{const next=analyticsChoice();if(next!=='yes')setAnalyticsExcluded(true);else setAnalyticsExcluded(!!session.user?.isStaff);setChoice(next);};setAnalyticsExcluded(!!session.user?.isStaff);window.addEventListener('edita-analytics-choice',update);window.addEventListener('storage',update);return()=>{setAnalyticsExcluded(true);window.removeEventListener('edita-analytics-choice',update);window.removeEventListener('storage',update);};},[session.user?.id,session.user?.isStaff]);
 useEffect(()=>{trackProduct('page_view',{},'page:'+location.key+':'+choice);},[location.key,choice]);
 useEffect(()=>{const flush=()=>{if(document.visibilityState==='hidden')void flushAnalytics();};document.addEventListener('visibilitychange',flush);return()=>document.removeEventListener('visibilitychange',flush);},[]);
 if(choice||session.user?.isStaff)return <PresenceTracker/>;
 return <><PresenceTracker/><aside className="analytics-choice" aria-label="Izbor analitike"><p>Smijemo li pratiti funkcije, stilove i trenutnu aktivnost stranice da poboljšamo Editu? Bez sadržaja videa i titlova. Izbor možeš promijeniti u Opcijama.</p><div><button onClick={()=>setAnalyticsChoice('yes')}>Dozvoli</button><button onClick={()=>setAnalyticsChoice('no')}>Ne sada</button></div></aside></>;
}
