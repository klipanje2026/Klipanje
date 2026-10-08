import catalog from './catalog.json';
import {usesStudioTextLayout} from './text-layout.mjs';
import {loaders} from './loaders.mjs';

const constructors=new Map(),pending=new Map();
export function prepareStudioStyle(id){
 const definition=catalog[id];if(!definition)return Promise.resolve();
 const family=definition.family;
 if(!pending.has(family))pending.set(family,loaders[family]().then(Renderer=>{constructors.set(family,Renderer);}));
 return pending.get(family);
}
const number=(value,fallback,min,max)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
export function createStudioArtwork(canvas,id,settings={}){
 const definition=catalog[id],Renderer=definition&&constructors.get(definition.family);
 if(!Renderer)throw new Error('Stil iz Studio kolekcije još nije učitan.');
 const {family,mode,variant,span,aspect,crop}=definition;
 const choice=definition.palettes.find(p=>p.value===settings.collectionPalette)||definition.palettes[0];
 const palette=/^\d+$/.test(choice.value)?Number(choice.value):choice.value;
 const source=document.createElement('canvas');source.width=crop?540:736;source.height=crop?960:Math.round(736/aspect);
 const opts={palette,width:source.width,height:source.height,pixelRatio:1,overlayOnly:true};
 if(usesStudioTextLayout(id)){opts.fontSizePx=number(settings.fontSizePx,100,24,200);opts.wordsPerLine=4;}
 if(mode!=='title'&&family!=='colorDirections'&&mode!=='glass'&&family!=='meadowType')opts.style=variant;
 if(family==='colorDirections')opts.look=variant;
 if(['quietWorlds','megaCaptions','liquidImpact','luxuryThemes'].includes(family)){delete opts.style;opts.theme=variant;}
 if(mode==='flex'||mode==='glass')opts.position=.5;
 if(mode==='glass')opts.display='sentence';
 // Only override controls selected by the user: untouched styles keep source defaults.
 if(Number.isFinite(settings.collectionPower)){
  const motion=number(settings.collectionPower,1,0,1.5);opts.motion=motion;opts.power=motion;opts.wind=motion;opts.reducedMotion=motion===0;
 }
 if(Number.isFinite(settings.collectionDepth))opts.depth=number(settings.collectionDepth,1,.3,1.8);
 if(Number.isFinite(settings.collectionTexture))opts.texture=number(settings.collectionTexture,1,0,1.5);
 if(Number.isFinite(settings.collectionShine)){opts.shine=number(settings.collectionShine,1,0,1.5);opts.sheen=opts.shine;opts.reflection=opts.shine;}
 if(Number.isFinite(settings.collectionEffects)){opts.effects=number(settings.collectionEffects,1,0,1.4);opts.detail=opts.effects;opts.density=opts.effects;}
 if(Number.isFinite(settings.collectionBlur))opts.blur=number(settings.collectionBlur,30,0,60);
 if(['quanta','unwind','swerve','optic-poetry','new-world'].includes(family))opts.spokenEntry=true;
 const renderer=new Renderer(source,opts);renderer.transparentStage=true;
 const ctx=canvas.getContext('2d');let signature='',videoSource;
 const neutral=document.createElement('canvas');neutral.width=32;neutral.height=32;
 const nc=neutral.getContext('2d'),gradient=nc.createLinearGradient(0,0,32,32);gradient.addColorStop(0,'#647888');gradient.addColorStop(1,'#172331');nc.fillStyle=gradient;nc.fillRect(0,0,32,32);
 const usesSource=['crystalGlass','megaCaptions','liquidImpact'].includes(family);
 function resize(w,h){
  canvas.width=w;canvas.height=h;
  const width=Math.max(64,w),height=crop?Math.round(width*1920/1080):Math.max(64,h);
  if(typeof renderer.resize==='function')renderer.resize(width,height,1);
  else {source.width=width;source.height=height;}
 }
 return{canvas,span,aspect,
  ...(usesSource?{setSource:frame=>{videoSource=frame;}}:{}),
  resize,
  render(words,seconds,timings){
   const key=JSON.stringify([words,timings]);
   if(key!==signature){
    const text=words.join(' ');
    if(mode==='title'){renderer.setText(text);if(opts.spokenEntry)renderer.wordTimings=timings;}
    else renderer.setCues([{start:0,end:span,text,words:timings}]);
    signature=key;
   }
   if(mode==='title'||crop)renderer.render(seconds);
   else if(mode==='meadow')renderer.render(seconds,{mode:'stage',reducedMotion:opts.reducedMotion});
   else renderer.render(seconds,{mode:'overlay',source:videoSource||(mode==='glass'?neutral:undefined),reducedMotion:opts.reducedMotion});
   if(renderer.contextLost||renderer.renderer?.getContext?.().isContextLost()||renderer.gl?.isContextLost?.())throw new Error('WebGL prikaz je prekinut. Ponovo otvori editor.');
   ctx.clearRect(0,0,canvas.width,canvas.height);
   if(crop){const scale=source.width/1080;ctx.drawImage(source,crop[0]*scale,crop[1]*scale,crop[2]*scale,crop[3]*scale,0,0,canvas.width,canvas.height);}
   else ctx.drawImage(source,0,0,canvas.width,canvas.height);
  },
  dispose(){renderer.dispose();renderer.renderer?.forceContextLoss?.();videoSource=undefined;neutral.width=neutral.height=source.width=source.height=canvas.width=canvas.height=1;},
 };
}
