import {useEffect} from 'react';

export function useDismissHeaderMenus(){
 useEffect(()=>{
  const selector='.production-themes[open],.klipanje-account[open],.workspace-theme-list[open]';
  const close=(event:PointerEvent)=>{
   document.querySelectorAll<HTMLDetailsElement>(selector).forEach(menu=>{
    if(!menu.contains(event.target as Node))menu.open=false;
   });
  };
  const escape=(event:KeyboardEvent)=>{
   if(event.key==='Escape')document.querySelectorAll<HTMLDetailsElement>(selector).forEach(menu=>{menu.open=false;});
  };
  document.addEventListener('pointerdown',close,true);
  document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',close,true);document.removeEventListener('keydown',escape);};
 },[]);
}
