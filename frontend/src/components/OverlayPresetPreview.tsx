import {loadOverlayFonts} from '../lib/text-fonts';
import {useEffect,useRef} from 'react';
import {createOverlay,drawOverlays,type OverlayPreset} from '../lib/video-overlays';
export function OverlayPresetPreview({preset}:{preset:OverlayPreset}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const el=ref.current;if(!el)return;
  let active=true,visible=false,frame=0,began=0;
  const item={...createOverlay(preset,0,10),text:preset.symbol,x:50,y:50,width:90,height:75,fontSize:230};
  el.width=360;el.height=220;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw=(now:number)=>{if(!active||!visible)return;const ctx=el.getContext('2d')!;ctx.clearRect(0,0,el.width,el.height);drawOverlays(ctx,[item],reduced?2:((now-began)/1000)%2.6);if(!reduced)frame=requestAnimationFrame(draw);};
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;cancelAnimationFrame(frame);if(visible){began=performance.now();frame=requestAnimationFrame(draw);}});
  observer.observe(el);
  void loadOverlayFonts([item]).then(()=>{if(active&&visible&&reduced)draw(performance.now());}).catch(()=>{});
  return()=>{active=false;observer.disconnect();cancelAnimationFrame(frame);};
 },[preset]);
 return <canvas ref={ref} className="overlay-preset-preview" aria-hidden="true"/>;
}
