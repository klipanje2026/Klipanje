import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function NavigationEffects() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const names: Record<string,string> = {'/administracija':'Administracija','/projekti':'Projekti','/':'Početna','/skripte':'Kreiranje skripte','/fotografije':'Generisanje fotografija','/videa':'Generisanje videa','/titlovi':'Editor titlova','/video-editor':'Video editor','/login':'Prijava','/promjena-lozinke':'Promjena lozinke'};
    const page = names[pathname] || 'Klipanje';
    document.title = page + ' — Klipanje';
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}
