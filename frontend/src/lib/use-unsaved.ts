import {useEffect} from 'react';
export function useUnsaved(dirty:boolean){
 useEffect(()=>{if(!dirty)return;const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};const click=(e:MouseEvent)=>{if(e.button!==0||e.ctrlKey||e.metaKey)return;const link=(e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement|null;if(link&&link.target!=='_blank'&&!link.download&&!confirm('Imaš nespremljene izmjene. Napustiti stranicu?')){e.preventDefault();e.stopPropagation();}};window.addEventListener('beforeunload',unload);document.addEventListener('click',click,true);return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',click,true);};},[dirty]);
 return ()=>!dirty||confirm('Odbaciti nespremljene izmjene?');
}
