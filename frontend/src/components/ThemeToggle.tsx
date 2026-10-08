import {applyTheme,currentTheme,lastDarkTheme} from '../lib/theme';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(!['light','cream'].includes(currentTheme()));
  useEffect(()=>{const sync=()=>setDark(!['light','cream'].includes(currentTheme()));window.addEventListener('edita-theme-changed',sync);return()=>window.removeEventListener('edita-theme-changed',sync);},[]);
  const [target,setTarget]=useState<Element|null>(null);
  useEffect(()=>{const update=()=>setTarget(document.querySelector('.workspace-theme-slot'));update();const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();},[]);
  const button=<button className="theme-toggle" title={dark ? 'Svijetla tema' : 'Tamna tema'} aria-label={dark ? 'Uključi svijetlu temu' : 'Uključi tamnu temu'} aria-pressed={dark} onClick={() => {
    applyTheme(dark?'light':lastDarkTheme());
  }}>{dark ? '☀' : '☾'}</button>;
  return target?createPortal(button,target):button;
}
