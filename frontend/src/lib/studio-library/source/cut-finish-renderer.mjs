import {CutCaptionRenderer} from './cut-captions-renderer.mjs';
import {CutStyles,CutFontMap} from './cut-captions-config.mjs';

export const CutFinishes={
 lacquer:{name:'Lak · duboki gradijent',stops:[[0,.61],[.12,.82],[.24,.65],[.42,.60],[.46,.81],[.54,.67],[.83,.51],[1,.66]],saturation:.92,shift:4},
 satin:{name:'Saten · mekano svjetlo',stops:[[0,.71],[.25,.81],[.52,.70],[.78,.58],[1,.68]],saturation:.71,shift:8},
 alloy:{name:'Metal · studijski odsjaj',stops:[[0,.82],[.16,.69],[.27,.57],[.38,.87],[.46,.81],[.50,.53],[.56,.48],[.69,.70],[.83,.85],[1,.61]],saturation:.68,shift:3},
 prism:{name:'Prizma · prelijevanje boje',stops:[[0,.71],[.18,.82],[.35,.66],[.48,.84],[.58,.65],[.81,.57],[1,.76]],saturation:.88,shift:29}
};
const finishClamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function finishHsl(hex){
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(...rgb),min=Math.min(...rgb),d=max-min,l=(max+min)/2;
 let h=0;if(d){h=max===rgb[0]?(rgb[1]-rgb[2])/d+(rgb[1]<rgb[2]?6:0):max===rgb[1]?(rgb[2]-rgb[0])/d+2:(rgb[0]-rgb[1])/d+4;h*=60;}
 return{h,s:d?d/(1-Math.abs(2*l-1)):0,l,rgb};
}
export function finishRgb(h,s,l){
 const chroma=(1-Math.abs(2*l-1))*s,x=chroma*(1-Math.abs(((h%360+360)%360)/60%2-1)),m=l-chroma/2,sector=((h%360+360)%360)/60;
 const rgb=sector<1?[chroma,x,0]:sector<2?[x,chroma,0]:sector<3?[0,chroma,x]:sector<4?[0,x,chroma]:sector<5?[x,0,chroma]:[chroma,0,x];return rgb.map(n=>n+m);
}

// A paint layer over the original Cut renderer. Paths, fonts, texture masks,
// row geometry, word clocks and animation functions remain in the base class.
export class CutFinishRenderer extends CutCaptionRenderer{
 constructor(canvas,options={}){super(canvas,{finish:'lacquer',sheen:1,original:false,...options});this.finishFaces=new Map();}
 setOptions(options){
  if(options.finish&&!CutFinishes[options.finish])throw new RangeError('Nepoznata završna obrada boje.');
  const before=[this.options.finish,this.options.sheen,this.options.palette,this.options.style].join('|');
  super.setOptions(options);
  if(before!==[this.options.finish,this.options.sheen,this.options.palette,this.options.style].join('|'))this.finishFaces?.clear();return this;
 }
 setCues(cues){super.setCues(cues);this.finishFaces?.clear();return this;}
 get finished(){return!this.options.original&&finishClamp(Number(this.options.sheen)||0)>0;}
 paint(c,color,x,y,w,h){
  if(!this.finished||typeof color!=='string'||!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color))return color;
  const material=CutFinishes[this.options.finish]||CutFinishes.lacquer,base=finishHsl(color),alpha=color.length===9?parseInt(color.slice(7),16)/255:1,amount=finishClamp(Number(this.options.sheen)||0);
  const g=c.createLinearGradient(x,y,x+w*.008,y+h);
  for(const [at,light]of material.stops){
   // Keep the palette's hue. Reflected light has a warmer top and cooler foot.
   const hue=base.h+material.shift*(at-.5)*2,sat=finishClamp(base.s*.48+material.saturation*.52,.3,.97),l=finishClamp(light+(base.l-.7)*.3,.46,.9);
   const lit=finishRgb(hue,sat,l),rgb=lit.map((n,i)=>Math.round(255*(base.rgb[i]*(1-amount)+n*amount)));
   g.addColorStop(at,`rgba(${rgb.join(',')},${alpha})`);
  }
  return g;
 }
 face(word,row,p,fill,kind){
  if(!this.finished||![p.a,p.b].includes(fill))return super.face(word,row,p,fill,kind);
  const detail=finishClamp(Number(this.options.texture)||0),key=[word.label,row.family,row.size.toFixed(3),row.width.toFixed(3),word.x.toFixed(3),fill,kind,p.dark,p.ink,detail,this.options.finish,this.options.sheen].join('|');
  if(this.finishFaces.has(key))return this.finishFaces.get(key);
  const image=document.createElement('canvas'),pad=24;image.width=Math.ceil(word.width+pad*2);image.height=Math.ceil(row.size*1.6+pad*2);const c=image.getContext('2d');
  c.font=CutFontMap[row.family].replace('100px',`${row.size}px`);c.textBaseline='alphabetic';c.lineJoin='round';
  // One continuous lighting field across a row, rather than a new stripe per word.
  c.fillStyle=this.paint(c,fill,pad-word.x,pad+row.size*.13,row.width,row.size*.77);c.fillText(word.label,pad,pad+row.size*.88);
  if(kind&&detail){c.globalCompositeOperation='source-atop';c.globalAlpha=detail;c.fillStyle=c.createPattern(this.pattern(kind,p),'repeat');c.fillRect(0,0,image.width,image.height);}
  c.globalCompositeOperation='source-over';const face={image,pad};this.finishFaces.set(key,face);
  if(this.finishFaces.size>380)this.finishFaces.delete(this.finishFaces.keys().next().value);return face;
 }
 drawFinishedRow(method,row,p,time,q){
  if(!this.finished)return CutCaptionRenderer.prototype[method].call(this,row,p,time,q);
  const original=this.ctx,paint=this.paint.bind(this),paints=new Map(),bound=new Map();
  // Intercept only accent paint assignments. Native paths, clipping, alpha,
  // shadows, glass background sampling and text motion run unmodified.
  const painted=new Proxy(original,{
   get(target,key){const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;if(!bound.has(key))bound.set(key,value.bind(target));return bound.get(key);},
   set(target,key,value){
    if((key==='fillStyle'||key==='strokeStyle')&&typeof value==='string'&&[p.a,p.b].some(color=>value.slice(0,7).toLowerCase()===color.toLowerCase())){
     if(!paints.has(value))paints.set(value,paint(original,value,0,-8,row.width,row.height+16));value=paints.get(value);
    }
    return Reflect.set(target,key,value,target);
   }
  });
  this.ctx=painted;try{CutCaptionRenderer.prototype[method].call(this,row,p,time,q);}finally{this.ctx=original;}
 }
 dispose(){super.dispose();this.finishFaces.clear();}
}
for(const style of Object.keys(CutStyles)){
 const method='draw'+style[0].toUpperCase()+style.slice(1);
 CutFinishRenderer.prototype[method]=function(row,p,time,q){return this.drawFinishedRow(method,row,p,time,q);};
}
