import {captionPaletteVariants} from '../../lib/caption-palette-variants';
import {portraitStyle} from '../../config/portraits';
import '../../config/captions/fonts';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import type {HomeExample} from '../../config/home';
import {settingsForTemplate,templates} from '../../config/captions/presets';
import {prepareCollectionStyle,drawCollectionCaption,withCollectionBackdrop} from '../../lib/collection-captions';
import {isCollectionStyle} from '../../config/captions/collection';
import {studioCardSource} from '../../lib/studio-card-source';
import type {DecodedFrame} from '../../lib/frame-source';
import {drawPersonCaption} from '../../lib/person-mask';
import {StudioIcon} from '../StudioIcon/StudioIcon';

// Prepare/render cold cards one at a time between browser input frames.
let preparationQueue=Promise.resolve();
const idleFrame=()=>new Promise<void>(resolve=>{
 if('requestIdleCallback' in window)window.requestIdleCallback(()=>resolve(),{timeout:600});
 else setTimeout(resolve,32);
});
export function CaptionShowcaseCard({example,autoActive=false,onHover,suspended=false,onReady}:{example:HomeExample;autoActive?:boolean;onHover?:(hover:boolean)=>void;suspended?:boolean;onReady?:(id:string)=>void}){
 const canvasRef=useRef<HTMLCanvasElement>(null),elapsed=useRef(0),hasPlayed=useRef(false);
 const [hovered,setHovered]=useState(false);
 const [playback,setPlayback]=useState<{activation:boolean;value:boolean}|null>(null);
 const playing=playback?.activation===autoActive?playback.value:hovered||autoActive;
 const suspendedRef=useRef(suspended),readyCallback=useRef(onReady);
 readyCallback.current=onReady;
 const playingRef=useRef(playing),refresh=useRef<()=>void>(()=>{});
 useEffect(()=>{playingRef.current=playing;suspendedRef.current=suspended;refresh.current();},[playing,suspended]);
 useEffect(()=>{if(autoActive){elapsed.current=0;refresh.current();}},[autoActive]);
 const settings=useMemo(()=>{const base=settingsForTemplate(templates.find(t=>t.key===example.style)!);const palette=example.palette?captionPaletteVariants(example.style).find(p=>p.id===example.palette):undefined;return {...base,...palette?.patch};},[example.style,example.palette]);
 useEffect(()=>{
  const canvas=canvasRef.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let source:DecodedFrame|undefined;
  let disposed=false,ready=false,visible=false,raf=0,previous=0,lastPaint=0,scrollUntil=0;
  const phrases=[example.text,...example.phrases];
  // Natural demo speech timestamps, not a four-second stretch for every short phrase.
  // Each preset still decides grouping, word/phrase entry and its own animation duration.
  let cursor=0;
  const segments=phrases.map((text,index)=>{
   const start=cursor;
   const words=text.split(/\s+/).map(text=>{
    const start=cursor;
    cursor+=example.wordInterval??Math.max(.24,Math.min(.44,.19+text.replace(/[^\p{L}\p{N}]/gu,'').length*.025));
    const end=cursor;if(/[,.!?;:]$/.test(text))cursor+=.1;
    return {text,start,end};
   });
   cursor+=.42;
   return {id:`${example.id}-${index}`,text,start,end:cursor,words};
  });
  const duration=cursor,stillTime=segments[0].words.at(-1)!.start+.25;
  if(playingRef.current&&!hasPlayed.current){elapsed.current=0;hasPlayed.current=true;}
  const paint=()=>{
   const time=reduced.matches||!hasPlayed.current?stillTime:elapsed.current%duration;
   const segment=segments.find(segment=>time>=segment.start&&time<segment.end)??segments[0];
   ctx.clearRect(0,0,canvas.width,canvas.height);
   if(isCollectionStyle(example.style))withCollectionBackdrop(ctx,source?{video:source,cropX:50,cropY:50,cameraZoom:1}:undefined,()=>drawCollectionCaption(ctx,segment,time,example.style as Parameters<typeof drawCollectionCaption>[3],settings,'showcase'));
   else drawPersonCaption(ctx,segment,time,example.style,settings);
  };
  const tick=(now:number)=>{
   if(disposed||!visible||document.hidden||!ready||suspendedRef.current)return;
   if(now<scrollUntil){previous=0;raf=requestAnimationFrame(tick);return;}
   if(previous)elapsed.current+=(now-previous)/1000;previous=now;
   if(now-lastPaint>=1000/24){lastPaint=now;paint();}
   raf=requestAnimationFrame(tick);
  };
  const update=()=>{
   cancelAnimationFrame(raf);previous=0;
   if(disposed||!ready||!visible||document.hidden||suspendedRef.current)return;
   if(playingRef.current&&!hasPlayed.current){hasPlayed.current=true;elapsed.current=0;}
   if(playingRef.current)paint();if(playingRef.current&&!reduced.matches)raf=requestAnimationFrame(tick);
  };
  const resize=()=>{
   const width=Math.max(180,Math.min(320,Math.round(canvas.clientWidth*Math.min(devicePixelRatio||1,1.5))));
   const height=Math.round(width*16/9);
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;if(ready&&!suspendedRef.current)paint();update();}
  };
  const sizeObserver=new ResizeObserver(resize);sizeObserver.observe(canvas);resize();
  const observer=new IntersectionObserver(([entry])=>{const next=entry.isIntersecting;if(next===visible)return;visible=next;update();},{threshold:.05});observer.observe(canvas);
  document.addEventListener('visibilitychange',update);reduced.addEventListener('change',update);
  const fonts=[settings.fontFamily,settings.secondaryFontFamily].filter((font):font is string=>!!font);
  // Start all downloads now, even for offscreen cards. Only cold rendering is queued.
  const resources=Promise.all([
   ...fonts.map(font=>document.fonts.load(`${settings.fontWeight||900} 32px ${font}`,phrases.join(' '))),
   ...(isCollectionStyle(example.style)?[prepareCollectionStyle(example.style),studioCardSource(example.portrait).then(picture=>{source=picture;})]:[])
  ]);
  // Attach failure handling immediately while earlier cards are still warming.
  const loaded=resources.then(()=>true,()=>false);
  preparationQueue=preparationQueue.catch(()=>{}).then(async()=>{
   if(!await loaded||disposed)return;
   await idleFrame();if(disposed)return;
   const savedTime=elapsed.current,savedPlayed=hasPlayed.current;
   elapsed.current=stillTime;hasPlayed.current=false;paint();
   elapsed.current=savedTime;hasPlayed.current=savedPlayed;
   ready=true;canvas.dataset.prepared='true';readyCallback.current?.(example.id);update();
  }).catch(()=>{canvas.dataset.prepared='error';});
  const scrolling=()=>{scrollUntil=performance.now()+160;};
  window.addEventListener('scroll',scrolling,{passive:true,capture:true});
  refresh.current=update;
  return()=>{disposed=true;refresh.current=()=>{};window.removeEventListener('scroll',scrolling,true);cancelAnimationFrame(raf);observer.disconnect();sizeObserver.disconnect();document.removeEventListener('visibilitychange',update);reduced.removeEventListener('change',update);};
 },[example,settings]);
 return <article className="caption-showcase-card" onPointerEnter={()=>{setHovered(true);onHover?.(true);setPlayback(null);}} onPointerLeave={()=>{setHovered(false);onHover?.(false);}} onFocusCapture={()=>{setHovered(true);onHover?.(true);}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setHovered(false);onHover?.(false);}}}>
  <div className="caption-showcase-scene" style={portraitStyle(example.portrait)}>
   <span className="caption-showcase-label">{example.label}</span>
   <button className="caption-showcase-play" onClick={()=>setPlayback({activation:autoActive,value:!playing})} aria-label={`${playing?'Zaustavi':'Pokreni'} primjer: ${example.label}`} aria-pressed={playing}><StudioIcon name={playing?'pause':'play'}/></button>
   <canvas ref={canvasRef} width={600} height={1067} className="caption-showcase-caption" aria-label={example.text} role="img"/>
  </div>
  <Link className="caption-showcase-link" to={`/titlovi?style=${example.style}`}><span><strong>{example.title}</strong><small>{example.description}</small></span><StudioIcon name="arrow"/></Link>
 </article>;
}
