import {galleryIsScrolling,observeGalleryScroll,waitForGalleryRest} from '../lib/gallery-scroll';
import {isStudioStyle} from '../config/captions/studio-collection';
import {studioCardSource} from '../lib/studio-card-source';
import type {DecodedFrame} from '../lib/frame-source';
import {useEffect,useRef,useState} from 'react';
import type {CaptionTemplate} from '../config/captions/types';
import {settingsForTemplate} from '../config/captions/presets';
import {styleLibraryCategory} from '../config/captions/style-library';
import {portraitStyle} from '../config/portraits';
import {prepareCollectionStyle,drawCollectionCaption,collectionCaptionError,withCollectionBackdrop} from '../lib/collection-captions';
import {collectionDefinition} from '../config/captions/collection';
import './CollectionSample.scss';
const stills=new Map<string,HTMLCanvasElement>();
let queue=Promise.resolve();
// Serialize cold card preparation as well as drawing; skip cards that left view.
const enqueue=(draw:()=>Promise<void>,cancelled:()=>boolean)=>{queue=queue.then(()=>{if(cancelled())return;return new Promise<void>(resolve=>{const run=()=>{void draw().catch(()=>{}).finally(resolve);};if('requestIdleCallback' in window)window.requestIdleCallback(run,{timeout:500});else setTimeout(run,32);});});};
/** Render the actual preset on the same portrait card used by the style library. */
export function CollectionSample({template,playing}:{template:CaptionTemplate;playing:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null),[visible,setVisible]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const el=canvas.current;if(!el)return;const observer=new IntersectionObserver(entries=>setVisible(entries.some(e=>e.isIntersecting)),{rootMargin:'0px'});observer.observe(el);const stop=observeGalleryScroll();return()=>{observer.disconnect();stop();};},[]);
 useEffect(()=>{
  if(!visible)return;let disposed=false,frame=0,last:number|undefined,lastPaint=0,time=playing?.06:2.6;
  const key=JSON.stringify([template.key,template.preset,template.sample]);
  const cached=stills.get(key);if(!playing&&cached){canvas.current?.getContext('2d')?.drawImage(cached,0,0);return;}
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const settings={...settingsForTemplate(template),x:50,y:68,collectionBackdrop:false};
  const definition=collectionDefinition(template.key)!;let source:DecodedFrame|undefined;
  const duration=4,text=template.sample.trim().split(/\s+/).slice(0,4).join(' '),words=text.split(/\s+/),segment={id:'collection-card',text,start:0,end:duration,words:words.map((text,i)=>({text,start:duration*i/words.length,end:duration*(i+1)/words.length}))};
  const tick=(now:number)=>{if(disposed||document.hidden)return;if(playing&&galleryIsScrolling()){last=undefined;frame=requestAnimationFrame(tick);return;}if(playing&&now-lastPaint<1000/24){frame=requestAnimationFrame(tick);return;}lastPaint=now;if(last!==undefined)time=(time+Math.min(.1,(now-last)/1000))%duration;last=now;const ctx=canvas.current?.getContext('2d');if(ctx){ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);withCollectionBackdrop(ctx,source?{video:source,cropX:50,cropY:50,cameraZoom:1}:undefined,()=>drawCollectionCaption(ctx,segment,reduced?2.6:time,definition[0],settings,playing?'animated':true));const failure=collectionCaptionError(template.key);if(failure){setError(failure);return;}}if(playing&&!reduced)frame=requestAnimationFrame(tick);else if(canvas.current){const copy=document.createElement('canvas');copy.width=canvas.current.width;copy.height=canvas.current.height;copy.getContext('2d')?.drawImage(canvas.current,0,0);stills.set(key,copy);while(stills.size>64)stills.delete(stills.keys().next().value!);}};
  const prepare=async()=>{if(!await waitForGalleryRest(()=>disposed))return;try{const [,picture]=await Promise.all([prepareCollectionStyle(template.key),isStudioStyle(template.key)?studioCardSource(template.portrait??2):Promise.resolve(undefined)]);source=picture;if(await waitForGalleryRest(()=>disposed)){setError('');if(playing)frame=requestAnimationFrame(tick);else tick(performance.now());}}catch(e){if(!disposed)setError(e instanceof Error?e.message:'Stil nije učitan.');}};
  const delay=setTimeout(()=>{if(playing)void prepare();else enqueue(prepare,()=>disposed);},playing?150:120);
  return()=>{disposed=true;clearTimeout(delay);cancelAnimationFrame(frame);};
 },[template,playing,visible]);
 return <div className="subtitle-style-demo" style={portraitStyle(template.portrait??2)} aria-hidden="true"><span className="subtitle-style-demo-label">{styleLibraryCategory(template)}</span><canvas className="subtitle-template-sample" ref={canvas} width={180} height={320}/><span className="subtitle-style-demo-format">9:16 · PRIMJER STILA</span>{error&&<small className="collection-card-error">{error}</small>}</div>;
}
