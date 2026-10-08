import {createCaptionPreset,getPresetData} from './src/index.mjs';
import {captionRows,nativeFontSize} from '../collection/caption-layout.mjs';
const fonts={impact:'Barlow Condensed',black:'Archivo Black',rounded:'Nunito Variable',sans:'Inter Variable',serif:'Playfair Display Variable',hand:'Caveat Variable',condensed:'Barlow Condensed',mono:'Space Grotesk'};
const native={createCanvas(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));return c;}};
const corporate=new Set(['axis','signature','momentum','ledger','signal']);
export function createHandoffArtwork(canvas,id,options={}){
 const samples=getPresetData(id),span=3.2,ctx=canvas.getContext('2d');let signature='',renderers=[];
 const fontSize=options.fontSizePx??100;
 const make=(cue)=>createCaptionPreset({id,native,cues:[cue],fontFamilies:fonts,theme:{anchor:.5,fontSize}});
 return {canvas,aspect:736/920,span,
 resize(w,h){canvas.width=w;canvas.height=h;},
 render(words,seconds,_timings,group=0){
  const key=JSON.stringify([words,group,fontSize]);
  if(key!==signature){
   signature=key;renderers.forEach(r=>r.clearCache());renderers=[];
   const sample=structuredClone(samples.cues[group%samples.cues.length]);
   if(corporate.has(id)){
    const lead=words.length>2?words[0]:'',tail=words.length>3?words.at(-1):'';
    const main=words.slice(lead?1:0,tail?-1:undefined);
    const headline=main.map((text,i)=>({text:text+(i<main.length-1?' ':''),font:sample.headline[i%sample.headline.length].font}));
    renderers=[make({...sample,start:0,end:span,lead,tail,headline})];
   }else if(id==='duet'){
    const lines=captionRows(words,nativeFontSize(fontSize),'Arial',580);
    const rows=lines.map((text,i)=>({...sample.rows[i%sample.rows.length],y:(i-(lines.length-1)/2)*fontSize*1.5,at:Math.min(i*.12,.3),until:span,runs:[{text,font:sample.rows[i%sample.rows.length].runs[0].font}]}));
    renderers=[make({...sample,start:0,end:span,rows})];
   }else{
    const lines=captionRows(words,nativeFontSize(fontSize),id==='pressure'?'Nunito Variable':'Archivo Black',540);
    renderers=lines.map(text=>make({...sample,start:0,end:span,text}));
   }
  }
  ctx.clearRect(0,0,canvas.width,canvas.height);
  renderers.forEach((renderer,i)=>{ctx.save();ctx.translate(0,(i-(renderers.length-1)/2)*Math.min(fontSize*canvas.width/1080*1.7,canvas.height*.65/renderers.length));renderer.draw(ctx,seconds);ctx.restore();});
 },dispose(){renderers.forEach(r=>r.clearCache());renderers=[];canvas.width=canvas.height=1;}}
}
