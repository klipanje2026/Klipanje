import {useRef,type ReactNode} from 'react';
export function PhotoStrip({children}:{children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null);
 return <div className="photo-strip"><div className="photo-strip-controls"><button aria-label="Prethodne fotografije" onClick={()=>ref.current?.scrollBy({left:-ref.current.clientWidth*.8,behavior:'smooth'})}>←</button><button aria-label="Sljedeće fotografije" onClick={()=>ref.current?.scrollBy({left:ref.current.clientWidth*.8,behavior:'smooth'})}>→</button></div><div ref={ref} className="photo-strip-scroll">{children}</div></div>;
}
