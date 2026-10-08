import {captionRows,nativeFontSize} from '../collection/caption-layout.mjs';
import {renderCaption} from './captions.mjs';
import {createArtwork as strata} from './strata.mjs';
import {createArtwork as contour} from './contour.mjs';
import {createArtwork as mosaic} from './mosaic.mjs';
import {createArtwork as elements} from './elements.mjs';
import {TitleEffect} from './title-effects.mjs';
import {FontLoader} from './vendor/examples/jsm/loaders/FontLoader.js';
import fontData from './font.json';
import palettes from './palettes.json';
import {makeCanvas,paletteContext,splitLines} from './helpers.mjs';

const font=new FontLoader().parse(fontData);
const flatten=palette=>Object.fromEntries(Object.entries(palette).flatMap(([key,value])=>Array.isArray(value)?value.map((color,i)=>[`${key}${i+1}`,color]):[[key,value]]));
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export function createMotionArtwork(canvas,id,settings={}){
 const style=id.replace('motion-',''),entry=palettes.styles.find(p=>p.id===style);
 if(!entry)throw new Error('Nepoznat stil kolekcije 02.');
 const defaults=flatten(entry.palette||entry.colors),values={...defaults};
 try{const saved=JSON.parse(settings.collectionColors||'{}');for(const key of Object.keys(defaults))if(typeof saved[key]==='string'&&/^#[\da-f]{6}$/i.test(saved[key]))values[key]=saved[key];}catch{/* An older project can omit the palette. */}
 const colors={};for(const [key,color]of Object.entries(defaults))colors[color.toLowerCase()]=values[key];
 const backdrop=settings.collectionBackdrop===true,fontSize=nativeFontSize(settings.fontSizePx)*960/736;
 if(style==='silk'||style==='crystal'){
  const effect=new TitleEffect(canvas,{style,lines:[''],background:backdrop,colors:values,font,width:960,height:540});effect.requestedFontSize=fontSize;
  let signature='';
  return{canvas,aspect:16/9,span:7.2,webgl:true,
   resize:(w,h)=>effect.resize(w,h),
   render(words,seconds){const lines=captionRows(words,fontSize,'Arial',740),key=JSON.stringify(lines);if(key!==signature){effect.setLines(lines);signature=key;}effect.renderAt(seconds);},
   dispose(){effect.dispose();effect.renderer.forceContextLoss();},
  };
 }
 let art;
 if(style==='impact'||style==='fold'){
  const source=makeCanvas(900,506),ctx=paletteContext(source.getContext('2d'),colors);let lines=['',''];
  art={canvas:source,aspect:900/506,span:3.2,setWords:words=>{lines=splitLines(words);},render:t=>renderCaption(ctx,t,style,900,506,lines,backdrop),dispose(){source.width=source.height=1;}};
 }else{
  const deltas=Object.fromEntries(Object.keys(defaults).map(key=>[key,rgb(values[key]).map((n,i)=>n-rgb(defaults[key])[i])]));
  art=({strata,contour,mosaic,water:elements,lava:elements})[style]({backdrop,colors,element:style,deltas,fontSize});
 }
 let signature='';const ctx=canvas.getContext('2d');
 return{canvas,aspect:art.aspect,span:art.span,
  resize(w,h){canvas.width=w;canvas.height=h;},
  render(words,seconds){const key=JSON.stringify(words);if(key!==signature){art.setWords(words);signature=key;}art.render(seconds);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(art.canvas,0,0,canvas.width,canvas.height);},
  dispose(){art.dispose();canvas.width=canvas.height=1;},
 };
}
