import{useEffect,useRef}from'react';
export function useCaptionShortcuts(actions:{split:()=>void;scope:()=>void;lane?:()=>void;undo?:()=>void;redo?:()=>void;remove?:()=>void;enabled:boolean}){
 const latest=useRef(actions);useEffect(()=>{latest.current=actions;});
 useEffect(()=>{const handler=(event:KeyboardEvent)=>{
 if(event.defaultPrevented||!latest.current.enabled||document.querySelector('dialog[open]'))return;
 const target=event.target instanceof HTMLElement?event.target:null;
 const typing=target?.closest('textarea,input:not([type=range]):not([type=number]):not([type=color]),[contenteditable=true]');
 const captionText=target?.closest('[data-caption-id],.caption-timing-text');
 if((event.ctrlKey||event.metaKey)&&!event.altKey&&(event.key.toLowerCase()==='z'||event.code==='KeyZ')&&latest.current.undo&&(!typing||captionText)){
  event.preventDefault();event.stopPropagation();(event.shiftKey?latest.current.redo:latest.current.undo)?.();return;
 }
 if((event.ctrlKey||event.metaKey)&&!event.altKey&&(event.key.toLowerCase()==='y'||event.code==='KeyY')&&latest.current.redo&&(!typing||captionText)){event.preventDefault();event.stopPropagation();latest.current.redo();return;}
 if(typing)return;
 if(['Delete','Backspace'].includes(event.key)&&!event.repeat&&latest.current.remove){event.preventDefault();latest.current.remove();return;}
 if(!event.ctrlKey||!event.altKey||event.repeat)return;const action=event.code==='KeyW'?'split':event.code==='KeyA'?'scope':event.code==='KeyN'?'lane':null;if(action){event.preventDefault();event.stopPropagation();latest.current[action]?.();}};
 window.addEventListener('keydown',handler,true);return()=>window.removeEventListener('keydown',handler,true);},[]);
}
