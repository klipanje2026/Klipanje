import type {CaptionSettings} from '../config/captions/types';
import {fillCaptionGlyphs} from './caption-font-weight';

export function captionShadowColor(textColor:string){
 const hex=textColor.replace('#','');
 const full=hex.length===3?hex.split('').map(c=>c+c).join(''):hex;
 if(!/^[0-9a-f]{6}$/i.test(full))return '#252525';
 return '#'+[0,2,4].map(i=>Math.round(parseInt(full.slice(i,i+2),16)*.23).toString(16).padStart(2,'0')).join('');
}
type Surface=OffscreenCanvas|HTMLCanvasElement;
const surface=(w:number,h:number):Surface=>typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
const ink=(layer:Surface)=>layer.getContext('2d') as CanvasRenderingContext2D;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const masks=new Map<string,{layer:Surface;ox:number;oy:number}>();
export const hasCaptionLightEffects=(s:CaptionSettings)=>!!(s.shadowMode&&s.shadowMode!=='none'||s.glowMode&&s.glowMode!=='none'||s.textBlur);

/** Glyph-only effects: never blur or shadow the video, caption background or layout. */
export function paintCaptionLightEffects(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,s:CaptionSettings,time:number,face:()=>void){
 if(!hasCaptionLightEffects(s)){face();return;}
 const unit=size/100,dx=clamp(s.shadowX??8,-100,100)*unit,dy=clamp(s.shadowY??12,-100,100)*unit;
 const blur=clamp(s.shadowBlur??12,0,80)*unit,glowBlur=clamp(s.glowBlur??20,0,80)*unit;
 const length=clamp(s.shadowLength??40,0,200)*unit;
 const pad=Math.ceil(Math.max(Math.abs(dx)*(s.shadowMode==='multiple'&&s.shadowDirection==='same'?3:1),Math.abs(dy)*(s.shadowMode==='multiple'&&s.shadowDirection==='same'?3:1),length)+Math.max(blur,glowBlur)*3+size*.15+4);
 const key=JSON.stringify([text,ctx.font,ctx.textAlign,ctx.textBaseline,ctx.letterSpacing,s.fontWeight,pad]);
 let mask=masks.get(key);
 if(!mask){
  const m=ctx.measureText(text),w=Math.ceil(m.actualBoundingBoxLeft+m.actualBoundingBoxRight+pad*2),h=Math.ceil(m.actualBoundingBoxAscent+m.actualBoundingBoxDescent+pad*2);
  if(w<=0||h<=0||w>8192||h>4096){face();return;}
  const layer=surface(w,h),c=ink(layer),ox=m.actualBoundingBoxLeft+pad,oy=m.actualBoundingBoxAscent+pad;
  c.font=ctx.font;c.textAlign=ctx.textAlign;c.textBaseline=ctx.textBaseline;c.letterSpacing=ctx.letterSpacing;c.fillStyle='#fff';
  fillCaptionGlyphs(c,text,ox,oy,size,s.fontWeight);mask={layer,ox,oy};masks.set(key,mask);
  let pixels=0;for(const cached of masks.values())pixels+=cached.layer.width*cached.layer.height;
  while((masks.size>24||pixels>8_000_000)&&masks.size>1){const first=masks.keys().next().value!,cached=masks.get(first)!;pixels-=cached.layer.width*cached.layer.height;masks.delete(first);}
 }
 const {layer,ox,oy}=mask;
 const colored=(color:string)=>{const result=surface(layer.width,layer.height),c=ink(result);c.drawImage(layer,0,0);c.globalCompositeOperation='source-in';c.fillStyle=color;c.fillRect(0,0,result.width,result.height);return result;};
 const draw=(source:Surface,sx:number,sy:number,radius:number,opacity:number)=>{ctx.save();ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;ctx.globalAlpha*=opacity*clamp(s.textOpacity??100,0,100)/100;ctx.filter=radius>0?`blur(${radius}px)`:'none';ctx.drawImage(source,x-ox+sx,y-oy+sy);ctx.restore();};
 const shadowOpacity=clamp(s.shadowOpacity??65,0,100)/100,glowOpacity=clamp(s.glowOpacity??75,0,100)/100;
 const shadowColor=s.shadowColor??captionShadowColor(s.textColor),glowColor=s.glowColor??s.textColor;
 const shadow=s.shadowMode??'none',glow=s.glowMode??'none';
 if(shadow!=='none'&&shadow!=='inner'){
  const tint=colored(shadowColor);
  if(shadow==='long'){
   const distance=Math.hypot(dx,dy)||1,steps=Math.max(1,Math.min(48,Math.ceil(length)));
   // Composite an opaque extrusion once; opacity must not accumulate per step.
   const extrusion=surface(layer.width,layer.height),c=ink(extrusion);
   for(let i=steps;i>=1;i--)c.drawImage(tint,(distance===1&&dx===0&&dy===0?.707:dx/distance)*length*i/steps,(distance===1&&dx===0&&dy===0?.707:dy/distance)*length*i/steps);
   draw(extrusion,0,0,blur,shadowOpacity);
  }else if(shadow==='multiple'){
   if(s.shadowDirection==='same'){draw(tint,dx*3,dy*3,blur,shadowOpacity*.65);draw(colored(s.shadowSecondColor??'#7b61ff'),dx*2,dy*2,blur,shadowOpacity);draw(tint,dx,dy,blur,shadowOpacity);}
   else {draw(tint,dx,dy,blur,shadowOpacity);draw(colored(s.shadowSecondColor??'#7b61ff'),-dx,dy,blur,shadowOpacity);draw(tint,dx,-dy,blur,shadowOpacity*.65);}
  }else draw(tint,dx,dy,blur,shadowOpacity);
 }
 if(glow!=='none'&&glow!=='inner'){
  if(glow==='rgb'){
   for(const [color,gx,gy] of [['#ff3155',-size*.06,0],['#39ff88',size*.06,0],['#387bff',0,size*.06]] as const)draw(colored(color),gx,gy,glowBlur,glowOpacity*.7);
  }else{
   const opacity=glowOpacity*(glow==='pulsing'?.12+.88*(.5+.5*Math.sin(time*Math.PI*2*clamp(s.glowSpeed??1, .2,4))):1);
   const tint=colored(glowColor);draw(tint,0,0,glowBlur,opacity);
   if(glow==='neon')draw(tint,0,0,glowBlur*.25,opacity);
  }
 }
 const inner=(color:string,sx:number,sy:number,radius:number,opacity:number)=>{
  const result=surface(layer.width,layer.height),c=ink(result);c.fillStyle=color;c.fillRect(0,0,result.width,result.height);
  c.globalCompositeOperation='destination-out';c.filter=radius>0?`blur(${radius}px)`:'none';c.drawImage(layer,sx,sy);
  c.filter='none';c.globalCompositeOperation='destination-in';c.drawImage(layer,0,0);draw(result,0,0,0,opacity);
 };
 ctx.save();const textBlur=clamp(s.textBlur??0,0,10)*unit;if(textBlur>0)ctx.filter=`blur(${textBlur}px)`;
 face();
 if(shadow==='inner')inner(shadowColor,dx,dy,blur,shadowOpacity);
 if(glow==='inner')inner(glowColor,0,0,glowBlur,glowOpacity);
 ctx.restore();
}
