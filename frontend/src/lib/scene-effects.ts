export type SceneFilter = {id:string;start:number;end:number;strength:number};
export type SceneTransition = {id:string;duration:number};
export type SceneEffects = {filter?:SceneFilter;transition?:SceneTransition};
export const sceneFilters = [
 {id:'warm',name:'Toplo',category:'Film',values:[1.04,1.12,1.15,.22,0,0]},
 {id:'cinema',name:'Kino',category:'Film',values:[.95,1.3,.75,.12,0,0]},
 {id:'vintage',name:'Vintage',category:'Film',values:[1.08,.88,.7,.45,0,0]},
 {id:'mono',name:'Crno-bijelo',category:'Film',values:[1,1.18,1,0,1,0]},
 {id:'vivid',name:'Žive boje',category:'Priroda',values:[1.05,1.12,1.65,0,0,0]},
 {id:'cool',name:'Hladno',category:'Priroda',values:[1.03,1.08,1.1,0,0,15]},
 {id:'sunset',name:'Zalazak',category:'Priroda',values:[1.06,1.08,1.35,.3,0,-12]},
 {id:'forest',name:'Šuma',category:'Priroda',values:[.97,1.15,1.25,0,0,20]},
 {id:'soft',name:'Meko',category:'Portret',values:[1.1,.9,.9,.08,0,0]},
 {id:'bright',name:'Svijetlo',category:'Portret',values:[1.18,1.02,1.04,0,0,0]},
 {id:'rose',name:'Ružičasto',category:'Portret',values:[1.08,.97,1.15,.12,0,-18]},
 {id:'dramatic',name:'Dramatično',category:'Portret',values:[.9,1.5,.75,0,0,0]},
];
export const sceneTransitions = [
 {id:'fade',name:'Iz tame',category:'Klasični'},
 {id:'wipe-left',name:'Otkrivanje desno',category:'Klasični'},
 {id:'wipe-up',name:'Otkrivanje gore',category:'Klasični'},
 {id:'zoom',name:'Približavanje',category:'Pokret'},
 {id:'slide',name:'Ulazak sa strane',category:'Pokret'},
 {id:'iris',name:'Krug',category:'Pokret'},
];
export function filterCss(filter:SceneFilter|undefined,sourceTime:number){
 if(!filter||sourceTime<filter.start||sourceTime>=filter.end)return 'none';
 const preset=sceneFilters.find(p=>p.id===filter.id);if(!preset)return 'none';
 const t=Math.max(0,Math.min(1,filter.strength/100));const v=preset.values;
 return `brightness(${1+(v[0]-1)*t}) contrast(${1+(v[1]-1)*t}) saturate(${1+(v[2]-1)*t}) sepia(${v[3]*t}) grayscale(${v[4]*t}) hue-rotate(${v[5]*t}deg)`;
}
export function transitionState(transition:SceneTransition|undefined,elapsed:number,length:number){
 const duration=Math.max(.05,Math.min(length,transition?.duration||.6));
 const p=Math.max(0,Math.min(1,elapsed/duration));const ease=1-(1-p)**3;
 const id=transition?.id;
 return {opacity:id==='fade'||id==='zoom'?p:1,scale:id==='zoom'?.7+.3*ease:1,x:id==='slide'?1-ease:0,
  clip:id==='wipe-left'?`inset(0 ${(1-p)*100}% 0 0)`:id==='wipe-up'?`inset(${(1-p)*100}% 0 0 0)`:id==='iris'?`circle(${p*71}% at 50% 50%)`:'none',progress:p,id};
}
export function sceneEffectStyle(effects:SceneEffects,sourceTime:number,elapsed:number,length:number){const t=transitionState(effects.transition,elapsed,length);return {filter:filterCss(effects.filter,sourceTime),opacity:t.opacity,clipPath:t.clip,transform:`translateX(${t.x*100}%) scale(${t.scale})`};}
export function drawSceneEffects(ctx:CanvasRenderingContext2D,effects:SceneEffects,sourceTime:number,elapsed:number,length:number,x:number,y:number,w:number,h:number,draw:()=>void){
 const t=transitionState(effects.transition,elapsed,length);ctx.save();ctx.filter=filterCss(effects.filter,sourceTime);ctx.globalAlpha*=t.opacity;
 ctx.translate(x+w/2+t.x*w,y+h/2);ctx.scale(t.scale,t.scale);ctx.translate(-x-w/2,-y-h/2);
 if(t.progress<1&&['wipe-left','wipe-up','iris'].includes(t.id||'')){ctx.beginPath();if(t.id==='iris')ctx.arc(x+w/2,y+h/2,Math.hypot(w,h)/2*t.progress,0,Math.PI*2);else if(t.id==='wipe-up')ctx.rect(x,y+h*(1-t.progress),w,h*t.progress);else ctx.rect(x,y,w*t.progress,h);ctx.clip();}
 draw();ctx.restore();
}
