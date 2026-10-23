import type {Overlay,OverlayPreset} from './video-overlays';
export const flagCountries=[['ba','BiH'],['hr','Hrvatska'],['rs','Srbija']] as const;
export const flagPresets:OverlayPreset[]=flagCountries.map(([country,name])=>({id:`flag-${country}`,category:'Specijalne animacije',name:`Zastava · ${name}`,symbol:'⚑',value:{kind:'flag',text:`Zastava · ${name}`,flagCountry:country,flagSpeed:1,flagStrength:45,flagPole:true,flagShape:'rectangle',flagArrival:'left',animationDuration:1.2,animation:'none',width:32,height:30,x:50,y:50}}));
const images=new Map<string,CanvasImageSource>();
const pending=new Map<string,Promise<void>>();
export function flagCountry(o:Overlay){return flagCountries.some(([code])=>code===o.flagCountry)?o.flagCountry!:'ba';}
export async function loadFlagImages(items:Overlay[]){
 await Promise.all([...new Set(items.filter(o=>o.kind==='flag').map(flagCountry))].map(country=>{
  if(images.has(country))return Promise.resolve();
  let task=pending.get(country);
  if(!task){task=new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>{images.set(country,image);resolve();};image.onerror=()=>{pending.delete(country);reject(new Error('Zastava se nije mogla učitati.'));};image.src=`/flags/${country}.svg`;});pending.set(country,task);}
  return task;
 }));
}
/** Allow a decoded canvas image to be supplied by non-browser render tests. */
export function registerFlagImage(country:string,image:CanvasImageSource){images.set(country,image);}
export function drawFlag(ctx:CanvasRenderingContext2D,o:Overlay,time:number,w:number,h:number){
 const image=images.get(flagCountry(o));if(!image)return;
 const pole=o.flagPole!==false;
 const fw=w*.84,fh=Math.min(h*(pole?.60:.78),fw*.75),left=-w*.42,top=-h*.38;
 const speed=Number.isFinite(o.flagSpeed)?Math.max(0,Math.min(3,o.flagSpeed!)):1;
 const strength=Number.isFinite(o.flagStrength)?Math.max(0,Math.min(100,o.flagStrength!))/100:.45;
 const phase=(time-o.start)*speed*Math.PI*2;
 if(pole){const gradient=ctx.createLinearGradient(left-3,0,left+3,0);gradient.addColorStop(0,'#666b75');gradient.addColorStop(.5,'#f0e5ca');gradient.addColorStop(1,'#837760');ctx.fillStyle=gradient;ctx.fillRect(left-w*.012,top-h*.025,w*.024,h*.83);ctx.fillStyle='#e0bf7b';ctx.beginPath();ctx.arc(left,top-h*.03,w*.025,0,Math.PI*2);ctx.fill();}
 // Narrow strips deform the actual flag, including its coat of arms, together.
 const source=image as HTMLImageElement;const sw=source.naturalWidth||source.width,sh=source.naturalHeight||source.height;
 const strips=96;
 for(let i=0;i<strips;i++){
  const u=i/strips,dx=fw/strips+.6;
  const wave=Math.sin(u*Math.PI*3-phase)*fh*.105*strength*u;
  const taper=o.flagShape==='pennant'?1-u:1;
  const height=fh*taper,dy=top+(fh-height)/2+wave;
  if(height<=0)continue;
  ctx.drawImage(image,u*sw,0,sw/strips,sh,left+u*fw,dy,dx,height);
  const shade=Math.sin(u*Math.PI*3-phase+Math.PI/2)*strength*.17;
  ctx.fillStyle=shade>0?`rgba(255,255,255,${shade})`:`rgba(0,0,0,${-shade})`;ctx.fillRect(left+u*fw,dy,dx,height);
 }
}
