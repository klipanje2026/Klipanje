import {createStudioArtwork as createLibraryArtwork,prepareStudioStyle} from '../studio-library/runtime.mjs';
export const prepareCollectionArtwork=prepareStudioStyle;
import {createHandoffArtwork} from '../handoff13/runtime.mjs';
import {createMotionArtwork} from '../motion-pack/runtime.mjs';
import {HyperPopRenderer} from './hyper-renderer.mjs';
import {HyperMarksRenderer} from './hyper-marks-renderer.mjs';
import {JuiceJamRenderer} from './juice-renderer.mjs';
import {NoirCaptionRenderer} from './noir-renderer.mjs';
import {RealityRiftRenderer} from './rift-renderer.mjs';
import {TitaniumCaptionRenderer} from './titanium-renderer.mjs';
import {PaperSculptRenderer} from './paper-renderer.mjs';
import {FusionCaptionRenderer} from './fusion-renderer.mjs';
import {createArtwork as forged} from './forged.mjs';
import {createArtwork as prism} from './prism-bloom.mjs';
import {createArtwork as ink} from './ink-riot.mjs';
import {createArtwork as porcelain} from './porcelain-flow.mjs';
import {createArtwork as laser} from './laser-trace.mjs';
import {createArtwork as velvet} from './velvet-pulse.mjs';
import {createArtwork as magma} from './magma-core.mjs';
import {createArtwork as abyssal} from './abyssal-pearl.mjs';
import {createStudioArtwork} from './studio-canvas.mjs';
import {PrismPalettes} from './prism-palettes.mjs';
import {captionRows,nativeFontSize} from './caption-layout.mjs';
import {HyperPalettes} from './hyper-palettes.mjs';

const limit=(value,min,max,fallback)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
const pick=(value,keys,fallback)=>keys.includes(value)?value:fallback;

export function createCollectionArtwork(id,options={}){
 const canvas=document.createElement('canvas');
 if(id.startsWith('studio-'))return createLibraryArtwork(canvas,id,options);
 if(id==='hyper-pop'&&options.collectionPalette==='juice'){id='juice-jam';options={...options,collectionFont:'bubble'};}
 else if(id==='juice-jam'&&options.collectionPalette&& !['juice','mango'].includes(options.collectionPalette)){id='hyper-pop';options={...options,collectionFont:'comic'};}
 if(id.startsWith('handoff-'))return createHandoffArtwork(canvas,id.slice(8),options);
 if(id.startsWith('motion-'))return createMotionArtwork(canvas,id,options);
 const common={entrySpeed:limit(options.collectionSpeed,.5,1.5,1),fontSize:nativeFontSize(options.fontSizePx),backdrop:!!options.collectionBackdrop,depth:id==='forged'?limit(options.collectionDepth,12,38,28):limit(options.collectionDepth,.5,1.8,1),power:limit(options.collectionPower,.45,1.7,1),
  pixelRatio:1,reducedMotion:false,palette:id==='prism-bloom'?pick(options.collectionPalette,Object.keys(PrismPalettes),'amber'):pick(options.collectionPalette,Object.keys(HyperPalettes),'candy'),font:pick(options.collectionFont,['comic','bubble','block'],'comic'),effect:pick(options.collectionMark,['auto','underline','frame','marker','orbit','brackets','burst'],'auto')};
 const detail=limit(options.collectionDetail,.3,1.6,1);
 const demos={forged, 'prism-bloom':prism,'ink-riot':ink,'porcelain-flow':porcelain,'laser-trace':laser,'velvet-pulse':velvet,'magma-core':magma,'abyssal-pearl':abyssal};
 if(demos[id])return {...demos[id](canvas,{...common,material:pick(options.collectionMaterial,['gold','silver','ice','violet','ruby','emerald','copper','pink'],'ice'),refraction:detail,glaze:detail,elasticity:detail,glow:detail,heat:detail,shine:detail,
  sparks:options.collectionDecorations!==false,crystals:options.collectionDecorations!==false,splatters:options.collectionDecorations!==false,crackle:options.collectionDecorations!==false,fibres:options.collectionDecorations!==false,arcs:options.collectionDecorations!==false,particles:options.collectionDecorations!==false,bubbles:options.collectionDecorations!==false}),webgl:id==='magma-core'||id==='abyssal-pearl'};
 const constructors={'hyper-pop':HyperPopRenderer,'hyper-marks':HyperMarksRenderer,'juice-jam':JuiceJamRenderer,'atelier-noir':NoirCaptionRenderer,'reality-rift':RealityRiftRenderer,'titanium-edge':TitaniumCaptionRenderer,'paper-sculpt':PaperSculptRenderer};
 if(constructors[id]){
  const instance=new constructors[id](canvas,common);instance.transparentStage=!common.backdrop;
  const build=instance.buildWords.bind(instance);
  instance.buildWords=(info,mode)=>{
   build(info,mode);
   const lines=info.words.length,requested=common.fontSize/736*instance.viewWidth;
   for(let line=0;line<lines;line++){
    const letters=instance.letters.filter(letter=>letter.line===line);if(!letters.length)continue;
    const oldScale=letters[0].scale||1,desired=Math.min(requested*(letters[0].hero?1:.65),instance.viewHeight*.65/lines/1.5);
    const extent=Math.max(...letters.map(l=>Math.abs(l.x)+l.scale));
    const factor=Math.min(desired/oldScale,instance.viewWidth*.43/Math.max(.01,extent));
    for(const letter of letters){letter.x*=factor;letter.scale*=factor;letter.y=((lines-1)/2-line)*Math.min(requested*1.7,instance.viewHeight*.65/lines);}
   }
  };
  const aspect=736/(['atelier-noir','paper-sculpt'].includes(id)?500:560),span=id==='paper-sculpt'?2.3:3.2;
  let signature='',groupOffset=0;
  const locate=instance.locate.bind(instance);instance.locate=time=>{const info=locate(time);if(info)info.chunk+=groupOffset;return info;};
  return{canvas,aspect,span,webgl:true,
   resize(w,h){instance.resize(w,h,1);},
   render(words,seconds,_timings,groupIndex=0){groupOffset=groupIndex;const start=groupIndex*span,key=JSON.stringify([words,groupIndex]);if(key!==signature){signature=key;instance.setCues([{start,end:start+span,text:words.join(' ')}]);
     instance.cues[0].groups=[captionRows(words.map(w=>w.toLocaleUpperCase('bs')),common.fontSize,'Arial',610)];}
    instance.render(start+seconds,{mode:'stage',reducedMotion:false});},
   dispose(){instance.dispose();instance.renderer.forceContextLoss();},
  };
 }
 if(id==='fusion-caps'){
  const instance=new FusionCaptionRenderer(canvas,{width:1280,height:720,intensity:common.power,fontFamily:'Archivo Black'});
  let signature='';
  return{canvas,aspect:16/9,span:3.2,resize:(w,h)=>instance.setSize(Math.max(64,w),Math.max(64,h)),
   render(words,seconds,timings){const key=JSON.stringify([words,timings]);if(key!==signature){signature=key;instance.setCues([{start:0,end:3.2,text:words.join(' '),words:timings}]);}instance.render(seconds);},dispose(){instance.destroy();canvas.width=canvas.height=1;}};
 }
 return createStudioArtwork(canvas,id,options);
}
