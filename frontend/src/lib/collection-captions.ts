import {usesStudioTextLayout} from './studio-library/text-layout.mjs';
import {compactDisplayCaption} from './caption-display-text';
import {aiPaletteFilter} from '../config/captions/ai-palettes';
import {collectionDefinition,isCollectionStyle,type CollectionStyleKey} from '../config/captions/collection';
import type {CaptionSettings,Segment} from '../config/captions/types';
import type {CaptionBounds} from './caption-renderer';
import type {CollectionArtwork} from './collection/runtime.mjs';
import type {FrameSource} from './frame-source';
import {cropRect} from './video-crop';

const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const finite=(n:number|undefined,value:number)=>Number.isFinite(n)?n!:value;
let revision=0,strictExports=0;
let runtime:typeof import('./collection/runtime.mjs')|undefined;
let runtimePromise:Promise<typeof import('./collection/runtime.mjs')>|undefined;
let fontSheet:Promise<void>|undefined;
const preparation=new Map<string,Promise<void>>(),ready=new Set<string>(),errors=new Map<string,string>();
const failedOptions=new Map<string,string>();
const showcaseInstances=new Map<string,CollectionArtwork>();
const playbackInstances=new Map<string,CollectionArtwork>(),previewInstances=new Map<string,CollectionArtwork>(),animatedPreviewInstances=new Map<string,CollectionArtwork>();
type Backdrop={video:FrameSource;cropX:number;cropY:number;destination?:{x:number;y:number;width:number;height:number};cameraZoom:number};
const backdrops=new WeakMap<CanvasRenderingContext2D,Backdrop>(),backdropCanvases=new WeakMap<CanvasRenderingContext2D,HTMLCanvasElement>();
const sourceViews=new WeakMap<CanvasRenderingContext2D,HTMLCanvasElement>();
function collectionSourceView(ctx:CanvasRenderingContext2D,x:number,y:number,dw:number,dh:number,rotation:number,rw:number,rh:number){
 const source=backdrops.get(ctx);if(!source||source.video.readyState<2)return undefined;
 const {video,destination,cropX,cropY,cameraZoom}=source,w=ctx.canvas.width,h=ctx.canvas.height;
 let full=backdropCanvases.get(ctx);if(!full){full=document.createElement('canvas');backdropCanvases.set(ctx,full);}
 if(full.width!==w||full.height!==h){full.width=w;full.height=h;}
 const c=full.getContext('2d')!;c.clearRect(0,0,w,h);c.save();
 if(destination)c.drawImage(video,destination.x*w/100,destination.y*h/100,destination.width*w/100,destination.height*h/100);
 else{const crop=cropRect(video.videoWidth,video.videoHeight,w/h,cropX,cropY);c.translate(w/2,h/2);c.scale(cameraZoom,cameraZoom);c.translate(-w/2,-h/2);c.drawImage(video,crop.x,crop.y,crop.width,crop.height,0,0,w,h);}c.restore();
 let view=sourceViews.get(ctx);if(!view){view=document.createElement('canvas');sourceViews.set(ctx,view);}if(view.width!==rw||view.height!==rh){view.width=rw;view.height=rh;}
 const v=view.getContext('2d')!;v.clearRect(0,0,rw,rh);v.save();v.scale(rw/dw,rh/dh);v.translate(dw/2,dh/2);v.rotate(-rotation*Math.PI/180);v.drawImage(full,-x,-y);v.restore();return view;
}
export function withCollectionBackdrop<T>(ctx:CanvasRenderingContext2D,source:Backdrop|undefined,draw:()=>T){
 const previous=backdrops.get(ctx);if(source)backdrops.set(ctx,source);
 try{return draw();}finally{if(previous)backdrops.set(ctx,previous);else backdrops.delete(ctx);}
}
function drawBackdrop(ctx:CanvasRenderingContext2D,plate:NonNullable<ReturnType<NonNullable<CollectionArtwork['getBackdrop']>>>,dw:number,dh:number,base:DOMMatrix){
 const source=backdrops.get(ctx);if(!source||source.video.readyState<2)return;
 const {video,destination,cropX,cropY,cameraZoom}=source,w=ctx.canvas.width,h=ctx.canvas.height;
 let canvas=backdropCanvases.get(ctx);if(!canvas){canvas=document.createElement('canvas');backdropCanvases.set(ctx,canvas);}
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}const c=canvas.getContext('2d')!;c.clearRect(0,0,w,h);c.save();
 if(destination)c.drawImage(video,destination.x*w/100,destination.y*h/100,destination.width*w/100,destination.height*h/100);
 else{const crop=cropRect(video.videoWidth,video.videoHeight,w/h,cropX,cropY);c.translate(w/2,h/2);c.scale(cameraZoom,cameraZoom);c.translate(-w/2,-h/2);c.drawImage(video,crop.x,crop.y,crop.width,crop.height,0,0,w,h);}c.restore();
 const scale=dw/plate.logicalWidth;ctx.save();ctx.beginPath();ctx.roundRect(-dw/2+plate.x*scale,-dh/2+plate.y*scale,plate.width*scale,plate.height*scale,plate.radius*scale);ctx.clip();ctx.setTransform(base);ctx.filter=`blur(${plate.blur*scale}px)`;ctx.drawImage(canvas,0,0);ctx.restore();
}
export const collectionCaptionRevision=()=>revision;
export const collectionCaptionError=(style:string)=>errors.get(style);

function loadFontSheet(){
 if(!fontSheet)fontSheet=new Promise<void>((resolve,reject)=>{
  const link=document.createElement('link');link.rel='stylesheet';link.href='/caption-collection/fonts.css';
  const timeout=setTimeout(()=>reject(new Error('Fontovi kolekcije nisu učitani.')),20000);
  link.onload=()=>{clearTimeout(timeout);resolve();};link.onerror=()=>{clearTimeout(timeout);reject(new Error('Fontovi kolekcije nisu učitani.'));};document.head.appendChild(link);
 });return fontSheet;
}
export function prepareCollectionStyle(style:string):Promise<void>{
 const definition=collectionDefinition(style);if(!definition)return Promise.resolve();
 let task=preparation.get(style);if(task)return task;
 task=(async()=>{
  if(typeof document==='undefined')throw new Error('Ova kolekcija zahtijeva preglednik s Canvas/WebGL podrškom.');
  const [module]=await Promise.all([runtimePromise??=import('./collection/runtime.mjs'),definition[1].startsWith('studio-')?Promise.resolve():loadFontSheet()]);runtime=module;
  const font=definition[3],characters='ABCDEFGHIJKLMNOPQRSTUVWXYZČĆĐŠŽabcdefghijklmnopqrstuvwxyzčćđšž';await document.fonts.load(font,characters);
  if(definition[1].startsWith('handoff-'))await Promise.all(['Barlow Condensed','Archivo Black','Nunito Variable','Inter Variable','Playfair Display Variable','Caveat Variable','Barlow Condensed','Space Grotesk'].map(font=>document.fonts.load(`100px \"${font}\"`,characters)));
  if(style==='collectionCinema')await Promise.all([document.fonts.load('italic 600 41px "Playfair Display"',characters),document.fonts.load('400 9px "DM Sans"',characters)]);
  if(!document.fonts.check(font,'ČĆĐŠŽ'))throw new Error('Originalni font stila nije dostupan.');
  await module.prepareCollectionArtwork(definition[1]);
  ready.add(style);errors.delete(style);revision++;
 })().catch(error=>{errors.set(style,error instanceof Error?error.message:'Stil nije moguće pripremiti.');revision++;throw error;});
 preparation.set(style,task);return task;
}
/** Export calls this before frame zero, including detached captions and saved presets. */
export async function prepareCollectionResources(value:unknown){
 const found=new Set<CollectionStyleKey>(),seen=new WeakSet<object>();
 function visit(item:unknown){if(typeof item==='string'){if(isCollectionStyle(item))found.add(item);}else if(item&&typeof item==='object'&&!seen.has(item)){seen.add(item);Object.values(item).forEach(visit);}}
 visit(value);await Promise.all([...found].map(prepareCollectionStyle));
}
export function beginCollectionExport(){strictExports++;return()=>{strictExports=Math.max(0,strictExports-1);};}
function optionsFor(s:CaptionSettings){return Object.fromEntries(Object.entries(s).filter(([key])=>key.startsWith('collection')||key==='highlightColor'||key==='fontSizePx'));}
function artwork(style:CollectionStyleKey,s:CaptionSettings,preview:boolean|'animated'|'showcase'=false){
 const instances=preview==='showcase'?showcaseInstances:preview==='animated'?animatedPreviewInstances:preview?previewInstances:playbackInstances;
 const options=optionsFor(s),key=JSON.stringify([style,options]);let item=instances.get(key);
 if(failedOptions.has(key))throw new Error(failedOptions.get(key));
 if(item){instances.delete(key);instances.set(key,item);return item;}
 // Separate bounded pools keep gallery churn from evicting the playing caption.
 while(instances.size>=(preview==='showcase'?8:preview?1:4)){const first=instances.keys().next().value!;instances.get(first)!.dispose();instances.delete(first);}
 try{item=runtime!.createCollectionArtwork(collectionDefinition(style)![1],options);}catch(error){failedOptions.set(key,error instanceof Error?error.message:'WebGL nije dostupan.');throw error;}
 instances.set(key,item);return item;
}
export function resetFailedCollectionResources(){
 disposeCollectionArtworks();failedOptions.clear();
 for(const key of errors.keys()){preparation.delete(key);ready.delete(key);}
 errors.clear();if(!runtime)runtimePromise=undefined;
}
export function disposeShowcaseArtworks(){for(const item of showcaseInstances.values())item.dispose();showcaseInstances.clear();}
export function disposeCollectionArtworks(){for(const pool of [playbackInstances,previewInstances,animatedPreviewInstances,showcaseInstances]){for(const item of pool.values())item.dispose();pool.clear();}revision++;}
if(typeof window!=='undefined')window.addEventListener('pagehide',disposeCollectionArtworks);


// Small alpha masks measure the painted caption, not the empty renderer stage.
// Reuse buffers and throttle readback so selection does not burden playback.
const inkBounds=new WeakMap<HTMLCanvasElement,{probe:HTMLCanvasElement;stamp:number;key:string;box:{x:number;y:number;width:number;height:number}|null}>();
function collectionInkBounds(canvas:HTMLCanvasElement,key:string){
 let state=inkBounds.get(canvas);
 if(!state){state={probe:document.createElement('canvas'),stamp:-Infinity,key:'',box:null};inkBounds.set(canvas,state);}
 const now=performance.now();if(state.key===key&&now-state.stamp<120)return state.box;
 state.key=key;state.stamp=now;
 const w=128,h=Math.max(1,Math.round(128*canvas.height/canvas.width));
 if(state.probe.width!==w||state.probe.height!==h){state.probe.width=w;state.probe.height=h;}
 const c=state.probe.getContext('2d',{willReadFrequently:true})!;
 c.clearRect(0,0,w,h);c.drawImage(canvas,0,0,w,h);
 const pixels=c.getImageData(0,0,w,h).data;let left=w,top=h,right=-1,bottom=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>24){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(right<left){state.box=null;return null;}
 left=Math.max(0,left-1);top=Math.max(0,top-1);right=Math.min(w,right+2);bottom=Math.min(h,bottom+2);
 return state.box={x:(left+right)/2/w-.5,y:(top+bottom)/2/h-.5,width:(right-left)/w,height:(bottom-top)/h};
}

export function drawCollectionCaption(ctx:CanvasRenderingContext2D,segment:Segment,time:number,style:CollectionStyleKey,s:CaptionSettings,preview:boolean|'animated'|'showcase'=false):CaptionBounds|null{
 if(!Number.isFinite(time)||time<segment.start||time>=segment.end||segment.effectOnly)return null;
 if(!ready.has(style)){
  if(strictExports)throw new Error(errors.get(style)||'Stil kolekcije nije pripremljen za izvoz.');
  void prepareCollectionStyle(style).catch(()=>{});return null;
 }
 const definition=collectionDefinition(style)!;
 segment=compactDisplayCaption(segment);
 const tokens=segment.text.trim().split(/\s+/).filter(Boolean);if(!tokens.length)return null;
 const studio=definition[1].startsWith('studio-');
 const single=segment.wordsSeparated||s.wordMode==='single';
 const count=single?1:studio&&!usesStudioTextLayout(definition[1])?definition[4]:4;
 const timed=segment.words?.length===tokens.length;
 let lastStart=segment.start;
 const starts=tokens.map((_,index)=>lastStart=clamp(finite(timed?segment.words?.[index]?.start:undefined,segment.start+(segment.end-segment.start)*index/tokens.length),lastStart,segment.end));
 const active=Math.max(0,starts.findLastIndex(start=>start<=time)),from=Math.floor(active/count)*count,to=Math.min(tokens.length,from+count);
 const start=single?starts[from]:from?starts[from]:segment.start,end=single&&timed?Math.min(starts[to]??segment.end,segment.words![from].end):to<tokens.length?starts[to]:segment.end;
 if(time<start||time>=end)return null;
 if(end<=start)return null;
 try{
  const item=artwork(style,s,preview),progress=clamp((time-start)/(end-start),0,1),speed=clamp(finite(s.collectionSpeed,1),.5,1.5);
  const clock=(1-(1-progress)**speed)*item.span;
  const w=ctx.canvas.width,h=ctx.canvas.height,scale=studio&&!usesStudioTextLayout(definition[1])?clamp(finite(s.fontSizePx,100)/100,.24,2.4):1;
  const width=Math.max(64,w*.92*scale),height=width/item.aspect;
  const zoom=clamp(finite(s.fontScale,100)/100,.1,4);
  const fit=Math.min(1,h*.85/height),dw=width*fit*zoom,dh=height*fit*zoom;
  const x=finite(segment.position?.x,finite(s.x,50))*w/100,y=finite(segment.position?.y,finite(s.y,65))*h/100;
  const rw=Math.max(64,Math.round(dw/zoom)),rh=Math.max(64,Math.round(dh/zoom));
  if(item.canvas.width!==rw||item.canvas.height!==rh)item.resize(rw,rh);
  const timing=tokens.slice(from,to).map((text,i)=>{
   const a=clamp((starts[from+i]-start)/(end-start),0,.999),b=clamp((starts[from+i+1]??end)-start,0,end-start)/(end-start);
   return {text,start:(1-(1-a)**speed)*item.span,end:Math.min(item.span,Math.max((1-(1-a)**speed)*item.span+.0001,(1-(1-b)**speed)*item.span))};
  });
  if(item.setSource)item.setSource(collectionSourceView(ctx,x,y,dw,dh,finite(s.rotation,0),rw,rh));
  item.render(tokens.slice(from,to),Math.min(item.span-.00001,clock),timing,Math.floor(from/count));
  if(item.webgl&&item.canvas.getContext('webgl2')?.isContextLost())throw new Error('WebGL prikaz je prekinut. Ponovo otvori editor.');
  errors.delete(style);
  const base=ctx.getTransform();ctx.save();ctx.translate(x,y);ctx.rotate(finite(s.rotation,0)*Math.PI/180);ctx.globalAlpha*=clamp(finite(s.textOpacity,100),0,100)/100;
  const plate=item.getBackdrop?.();if(plate&&!s.collectionBackdrop)drawBackdrop(ctx,plate,dw,dh,base);
  ctx.filter=aiPaletteFilter(style,s.collectionPalette);ctx.drawImage(item.canvas,-dw/2,-dh/2,dw,dh);ctx.restore();
  const ink=preview||strictExports?{x:0,y:0,width:1,height:1}:collectionInkBounds(item.canvas,segment.id+':'+from);
  if(!ink)return null;
  const angle=finite(s.rotation,0)*Math.PI/180,dx=ink.x*dw,dy=ink.y*dh;
  return{segmentId:segment.id,x:(x+dx*Math.cos(angle)-dy*Math.sin(angle))/w*100,y:(y+dx*Math.sin(angle)+dy*Math.cos(angle))/h*100,width:ink.width*dw/w*100,height:ink.height*dh/h*100,rotation:finite(s.rotation,0),words:[]};
 }catch(error){
  const message=error instanceof Error?error.message:'Stil nije moguće nacrtati.';errors.set(style,message);
  if(strictExports)throw new Error(`Izvoz stila ${definition[2]} nije uspio: ${message}`);
  return null;
 }
}
