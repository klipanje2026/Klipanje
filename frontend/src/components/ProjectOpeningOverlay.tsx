import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
export function ProjectOpeningOverlay({kind}:{kind:'subtitles'|'video'}){
 const [target,setTarget]=useState<Element|null>(null);
 useEffect(()=>{let previous:Element|null=null;const update=()=>{const next=document.querySelector(kind==='video'?'.video-studio-main':'.subtitle-preview-panel')||document.querySelector('.workspace-upload .studio-player');if(previous!==next){previous?.classList.remove('project-opening-target');next?.classList.add('project-opening-target');previous=next;setTarget(next);}};update();const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true});return()=>{observer.disconnect();previous?.classList.remove('project-opening-target');};},[kind]);
 const content=<div className={'project-opening-overlay'+(!target?' is-fallback':'')} role="status" aria-live="polite"><span className="workspace-loading-spinner" aria-hidden="true"/><strong>Otvaranje projekta…</strong><small>Učitavamo video i tvoje spremljene izmjene.</small></div>;
 return createPortal(content,target||document.body);
}
