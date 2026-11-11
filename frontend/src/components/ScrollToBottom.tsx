import {useRef} from 'react';
export function ScrollToBottom(){
 const ref=useRef<HTMLButtonElement>(null);
 function scroll(){let node=ref.current?.parentElement;while(node){const style=getComputedStyle(node);if(/auto|scroll/.test(style.overflowY)&&node.scrollHeight>node.clientHeight+2){node.scrollTo({top:node.scrollHeight,behavior:'smooth'});return;}node=node.parentElement;}window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'});}
 return <button ref={ref} type="button" className="workflow-scroll-bottom" aria-label="Idi na dno" title="Idi na dno" onClick={scroll}>↓</button>;
}
