import {useRef} from 'react';
export function PanelResize({selector,variable='--inspector-width'}:{selector:string;variable?:string}) {
 const drag=useRef<{x:number;width:number;host:HTMLElement}|null>(null);
 return <div className="panel-resize" role="separator" aria-label="Širina bočnog panela" aria-orientation="vertical" tabIndex={0}
 onPointerDown={e=>{const host=e.currentTarget.closest(selector) as HTMLElement|null;if(!host)return;const panel=e.currentTarget.parentElement!;drag.current={x:e.clientX,width:panel.getBoundingClientRect().width,host};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}}
 onPointerMove={e=>{const d=drag.current;if(d)d.host.style.setProperty(variable,`${Math.max(240,Math.min(window.innerWidth*.65,d.width+e.clientX-d.x))}px`);}}
 onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
 onKeyDown={e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const host=e.currentTarget.closest(selector) as HTMLElement;host.style.setProperty(variable,`${Math.max(240,Math.min(window.innerWidth*.65,e.currentTarget.parentElement!.getBoundingClientRect().width+(e.key==='ArrowRight'?20:-20)))}px`);}}/>;
}
