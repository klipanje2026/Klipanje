import {useEffect,useState,type ReactNode} from 'react';

const wideScreen = '(width > 1200px)';

export function DesktopOnly({children}:{children:ReactNode}) {
 const [allowed,setAllowed]=useState(()=>window.matchMedia(wideScreen).matches);
 const [opened,setOpened]=useState(allowed);
 useEffect(()=>{
  const query=window.matchMedia(wideScreen);
  const update=()=>{setAllowed(query.matches);if(query.matches)setOpened(true);};
  query.addEventListener('change',update);update();
  return()=>query.removeEventListener('change',update);
 },[]);
 return <>
  {opened&&<div className="desktop-only-content" hidden={!allowed} inert={!allowed}>{children}</div>}
  {!allowed&&<main className="desktop-only-notice"><section role="status">
   <span className="desktop-only-brand">edita<span>.ba</span></span>
   <svg width="56" height="56" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="5" y="7" width="38" height="26" rx="4"/><path d="M17 41h14M24 33v8M15 20h18m-15-4-4 4 4 4m12-8 4 4-4 4"/></svg>
   <h1>Za Editu je potreban širi ekran</h1>
   <p>Otvori Editu na računaru i proširi prozor preglednika na više od 1200 px.</p>
   <small>Stranica će se automatski otvoriti kada bude dovoljno prostora.</small>
  </section></main>}
 </>;
}
