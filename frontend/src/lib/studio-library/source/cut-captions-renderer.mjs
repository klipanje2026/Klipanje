import {PortraitCaptionRenderer} from './portrait-renderer.mjs';
import {CutStyles,CutFontMap} from './cut-captions-config.mjs';
import {loadCutFonts} from './cut-captions-fonts.mjs';

const cutClamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const cutEase=v=>1-Math.pow(1-cutClamp(v),3);
const cutSpring=v=>v>=1?1:1-Math.exp(-8*cutClamp(v))*Math.cos(10*cutClamp(v));
const cutFont=(family,size)=>CutFontMap[family].replace('100px',`${size}px`);
const cutRound=(c,x,y,w,h,r=8)=>{c.beginPath();c.roundRect(x,y,w,h,r);};

export class CutCaptionRenderer extends PortraitCaptionRenderer{
 constructor(canvas,options={}){
  super(canvas,{style:'ripline',texture:.8,...options});this.faces=new Map();this.patterns=new Map();this.background=null;
  this.fontReady=Promise.all([this.fontReady,loadCutFonts()]).then(()=>{this.cache.clear();this.faces.clear();return this;});
 }
 setOptions(options){
  if(options.style&&!CutStyles[options.style])throw new RangeError('Nepoznat stil.');
  this.options={...this.options,...options};return this;
 }
 setCues(cues){super.setCues(cues);this.faces?.clear();return this;}
 layout(cue){
  const key=cue.text+'|'+cue.words.map(word=>word.start+':'+word.end).join(',')+'|'+this.options.style+'|'+this.options.scale;
  if(this.cache.has(key))return this.cache.get(key);
  const style=CutStyles[this.options.style],c=this.ctx,rows=[];let index=0,total=0;
  for(let r=0;r<style.rows.length;r++){if(index>=cue.words.length)break;
   const family=style.fonts[r],count=style.rows[r],words=cue.words.slice(index,index+count).map((word,i)=>({...word,index:index+i,label:['text','hand'].includes(family)?word.text:word.text.toLocaleUpperCase('bs')}));
   let size=style.sizes[r]*cutClamp(Number(this.options.scale)||1,.75,1.2),space=size*(family==='hand'?.19:.2);
   c.font=cutFont(family,size);let widths=words.map(word=>c.measureText(word.label).width),width=widths.reduce((a,b)=>a+b,0)+space*(words.length-1);
   if(width>832){const ratio=832/width;size*=ratio;space*=ratio;c.font=cutFont(family,size);widths=words.map(word=>c.measureText(word.label).width);width=widths.reduce((a,b)=>a+b,0)+space*(words.length-1);}
   let cursor=0;words.forEach((word,i)=>{word.x=cursor;word.width=widths[i];cursor+=widths[i]+space;});
   const extra=['ripline','stacktrace','glasswire'].includes(this.options.style)?14:0,height=size*(family==='hand'?1.22:1.04)+extra;
   rows.push({words,family,size,width,height,row:r,align:style.align[r],y:total});index+=count;total+=height+style.gap;
  }
  total-=style.gap;
  if(total>850){const k=850/total;for(const row of rows){row.size*=k;row.width*=k;row.height*=k;row.y*=k;for(const word of row.words){word.x*=k;word.width*=k;}}total=850;}
  const result={rows,total};this.cache.set(key,result);return result;
 }
 render(time,{background=null}={}){
  if(this.disposed)return;this.time=time;
  const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);c.save();c.scale(w/1080,h/1920);
  if(background)background(c,1080,1920,time);
  if(this.options.style==='glasswire'&&background){
   if(!this.background)this.background=document.createElement('canvas');if(this.background.width!==w||this.background.height!==h){this.background.width=w;this.background.height=h;}
   const b=this.background.getContext('2d');b.clearRect(0,0,w,h);b.drawImage(this.canvas,0,0);
  }else this.background=null;
  if(this.options.overlayOnly)c.clearRect(0,0,1080,1920);
  const cue=this.cues.find(cue=>time>=cue.start&&time<cue.end);this.pose={seconds:time,words:cue?.words.length||0,style:this.options.style};
  if(!cue){c.restore();return;}
  const style=CutStyles[this.options.style],p=style.palettes[cutClamp(Math.round(this.options.palette)||0,0,style.palettes.length-1)],layout=this.layout(cue);
  const y0=cutClamp(1920*cutClamp(Number(this.options.position)||58,35,70)/100-layout.total/2,260,1580-layout.total);
  c.globalAlpha=this.options.reducedMotion?1:cutClamp((cue.end-time)/.2);
  for(const row of layout.rows){
   const x=row.align===-1?112:row.align===1?968-row.width:(1080-row.width)/2;
   row.renderX=x;row.renderY=y0+row.y;c.save();c.translate(x,row.renderY);
   const q=this.progress(time,row.words[0]);
   this[style.draw||'draw'+this.options.style[0].toUpperCase()+this.options.style.slice(1)](row,p,time,q);
   c.restore();
  }
  c.restore();
 }
 pattern(kind,p){
  const key=kind+'|'+p.dark+'|'+p.ink;if(this.patterns.has(key))return this.patterns.get(key);
  const tile=document.createElement('canvas');tile.width=tile.height=128;const c=tile.getContext('2d');let seed=314159;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  if(kind==='halftone'){c.fillStyle=p.dark+'70';for(let y=0;y<128;y+=8)for(let x=0;x<128;x+=8){c.beginPath();c.arc(x+(y%16?4:0),y,1.35,0,Math.PI*2);c.fill();}}
  else if(kind==='stripe'||kind==='grid'){c.strokeStyle=p.dark+'66';c.lineWidth=kind==='grid'?.7:1.2;for(let x=-128;x<256;x+=kind==='grid'?12:9){c.beginPath();c.moveTo(x,0);c.lineTo(x+(kind==='grid'?0:128),128);c.stroke();}if(kind==='grid')for(let y=0;y<128;y+=12){c.beginPath();c.moveTo(0,y);c.lineTo(128,y);c.stroke();}}
  else if(kind==='satin'){const g=c.createLinearGradient(0,0,128,128);g.addColorStop(0,'#ffffff20');g.addColorStop(.5,'#ffffff00');g.addColorStop(1,p.dark+'20');c.fillStyle=g;c.fillRect(0,0,128,128);}
  else{
   const count=kind==='rubber'?450:kind==='frost'?650:300;
   for(let i=0;i<count;i++){c.fillStyle=random()>.35?p.dark+(kind==='rubber'?'75':'35'):'#ffffff55';const x=random()*128,y=random()*128;c.fillRect(x,y,kind==='paint'?5:.7+random()*1.6,kind==='paint'?.9:.7+random()*1.5);}
   if(kind==='paper'){c.strokeStyle=p.dark+'28';c.lineWidth=.6;for(let y=1;y<128;y+=6){c.beginPath();c.moveTo(0,y);c.lineTo(128,y-2);c.stroke();}}
  }
  this.patterns.set(key,tile);return tile;
 }
 face(word,row,p,fill,kind){
  const detail=cutClamp(Number(this.options.texture)||0),key=[word.label,row.family,row.size.toFixed(3),fill,kind,p.dark,detail].join('|');
  if(this.faces.has(key))return this.faces.get(key);
  const image=document.createElement('canvas'),pad=24;image.width=Math.ceil(word.width+pad*2);image.height=Math.ceil(row.size*1.6+pad*2);
  const c=image.getContext('2d');c.font=cutFont(row.family,row.size);c.lineJoin='round';c.textBaseline='alphabetic';
  c.fillStyle=fill;c.fillText(word.label,pad,pad+row.size*.88);
  if(kind&&detail){c.globalCompositeOperation='source-atop';c.globalAlpha=detail;c.fillStyle=c.createPattern(this.pattern(kind,p),'repeat');c.fillRect(0,0,image.width,image.height);}
  c.globalCompositeOperation='source-over';this.faces.set(key,{image,pad});
  if(this.faces.size>380)this.faces.delete(this.faces.keys().next().value);
  return{image,pad};
 }
 word(word,row,p,time,{fill=p.ink,texture=CutStyles[this.options.style].texture,outline=false,depth=0,dx=0,dy=0,rotate=0,blur=0,stamp=false,write=false}={}){
  const c=this.ctx,q=this.progress(time,word);if(!q)return;
  const motion=cutClamp(Number(this.options.motion)||0,0,1.5),unit=this.canvas.width/1080;
  const springOffset=(1-cutSpring(q))*row.size*.17*motion;
  c.save();c.translate(word.x+dx,dy+springOffset);c.rotate(rotate);c.globalAlpha*=cutEase(q);c.font=cutFont(row.family,row.size);c.textBaseline='alphabetic';c.lineJoin='round';
  if(stamp&&q<1){const squeeze=1+Math.sin(q*Math.PI*2)*(1-q)*.065*motion;c.translate(word.width/2,row.size/2);c.scale(1/squeeze,squeeze);c.translate(-word.width/2,-row.size/2);}
  if(write&&q<1){c.beginPath();c.rect(-20,-30,(word.width+40)*cutEase(q),row.size*1.55);c.clip();}
  if(depth){c.fillStyle=p.dark;c.strokeStyle=p.dark;c.lineWidth=2;for(let d=Math.ceil(depth);d>0;d-=2){c.strokeText(word.label,d,row.size*.88+d);c.fillText(word.label,d,row.size*.88+d);}c.fillStyle=p.b+'99';c.fillText(word.label,depth*.72,row.size*.88+depth*.72);}
  if(blur&&q<1)c.filter=`blur(${blur*(1-q)*motion*unit}px)`;
  c.shadowColor='#00000065';c.shadowBlur=6*unit;c.shadowOffsetY=2*unit;
  c.lineWidth=Math.max(1.8,row.size*.018);c.strokeStyle=fill===p.dark?'#00000000':p.dark+'d0';
  if(outline){c.lineWidth=Math.max(3.3,row.size*.029);c.strokeStyle=fill;c.strokeText(word.label,0,row.size*.88);}
  else{c.strokeText(word.label,0,row.size*.88);const face=this.face(word,row,p,fill,texture);c.drawImage(face.image,-face.pad,-face.pad);}
  c.restore();
 }
 strip(row,p,q,{fill=p.a,torn=false,slant=0,stroke=false}={}){
  if(!q)return;const c=this.ctx,phase=cutEase(q);c.save();c.globalAlpha*=phase;
  c.beginPath();c.rect(-38,-30,(row.width+76)*phase,row.height+65);c.clip();
  c.fillStyle=fill;c.strokeStyle=fill;c.lineWidth=3;
  if(torn){c.beginPath();c.moveTo(-28,3);for(let x=-28;x<row.width+30;x+=17)c.lineTo(x,-8+Math.sin(x*.3)*4);c.lineTo(row.width+28,row.height+4);for(let x=row.width+28;x>-28;x-=19)c.lineTo(x,row.height+7+Math.sin(x*.44)*5);c.closePath();}
  else{c.beginPath();c.moveTo(-25+slant,0);c.lineTo(row.width+26,0);c.lineTo(row.width+26-slant,row.height+9);c.lineTo(-25,row.height+9);c.closePath();}
  c.shadowColor='#00000035';c.shadowBlur=10*this.canvas.width/1080;c.shadowOffsetY=5*this.canvas.width/1080;
  if(stroke)c.stroke();else c.fill();c.restore();
 }
 underline(word,row,p,time,{color=p.a,weight=7,hook=false,offset=0}={}){
  const c=this.ctx,q=cutEase(this.progress(time,word));if(!q)return;
  c.save();c.globalAlpha*=q;c.lineWidth=weight;c.strokeStyle=color;c.lineCap='round';c.lineJoin='round';
  const y=row.size*1.06+offset;c.beginPath();c.moveTo(word.x-2,y);c.lineTo(word.x+word.width*q,y-3);c.stroke();
  if(hook&&q>.7){c.beginPath();c.moveTo(word.x+word.width-13,y-13);c.lineTo(word.x+word.width+3,y-3);c.lineTo(word.x+word.width-12,y+8);c.stroke();}c.restore();
 }
 drawRipline(row,p,time,q){
  const c=this.ctx;c.rotate([-.014,.006,.014,-.009,.004][row.row]);
  if(row.row===1||row.row===4)this.strip(row,p,q,{fill:row.row===1?p.a:p.b,torn:true});
  for(const word of row.words)this.word(word,row,p,time,{fill:row.row===1||row.row===4?p.dark:p.ink,write:true,depth:row.row===2?6:0});
  if(row.row===0&&q){c.save();c.globalAlpha*=cutEase(q);c.strokeStyle=p.a;c.lineWidth=2;c.beginPath();c.moveTo(-19,4);c.lineTo(-19,row.height-8);c.lineTo(-4,row.height-8);c.stroke();c.restore();}
  if(row.row===3)this.underline(row.words.at(-1),row,p,time,{color:p.b,weight:4});
 }
 drawUpshift(row,p,time,q){
  for(const word of row.words)this.word(word,row,p,time,{fill:row.row===1?p.a:row.row===2?p.b:p.ink,depth:row.row===1?15:8,blur:4});
  if(row.row===1&&q){const c=this.ctx;c.save();c.globalAlpha*=cutEase(q);c.strokeStyle=p.b;c.lineWidth=4;c.beginPath();c.moveTo(-25,row.height-3);c.lineTo(-25,-4);c.lineTo(25,-4);c.stroke();c.restore();}
  if(row.row===3)this.underline(row.words.at(-1),row,p,time,{weight:5,hook:true,color:p.a});
 }
 drawCarbon(row,p,time,q){
  const c=this.ctx,hero=row.row===2||row.row===4;
  if(row.row===1&&q){c.save();c.globalAlpha*=cutEase(q);c.strokeStyle=p.a;c.lineWidth=2.5;c.strokeRect(-17,-4,row.width+34,row.height+9);c.restore();}
  for(const word of row.words){
   if(hero&&this.progress(time,word)){c.save();c.font=cutFont(row.family,row.size);c.globalAlpha*=.65*cutEase(this.progress(time,word));c.fillStyle=p.a;c.fillText(word.label,word.x+4,row.size*.88+3);c.restore();}
   this.word(word,row,p,time,{fill:row.row===3?p.a:p.ink,texture:hero?'halftone':null,stamp:true});
  }
  if(row.row===0||row.row===3)this.underline(row.words.at(-1),row,p,time,{color:row.row===0?p.a:p.b,weight:3});
 }
 drawReel(row,p,time,q){
  const c=this.ctx,marked=row.row===1||row.row===3;
  if(marked&&q){c.save();c.globalAlpha*=cutEase(q)*.94;c.strokeStyle=row.row===1?p.a:p.b;c.lineWidth=row.size*.81;c.lineCap='round';c.beginPath();c.moveTo(5,row.size*.5);c.lineTo(row.width*cutEase(q)-3,row.size*.56);c.stroke();c.globalAlpha*=.25;c.lineWidth=3;c.strokeStyle=p.dark;for(let y=0;y<5;y++){c.beginPath();c.moveTo(-7,row.size*.18+y*5);c.lineTo(row.width,row.size*.26+y*5);c.stroke();}c.restore();}
  for(const word of row.words)this.word(word,row,p,time,{fill:marked?p.dark:row.row===4?p.a:p.ink,texture:'paint',write:true});
  if(row.row===2)this.underline(row.words.at(-1),row,p,time,{color:p.b,weight:4});
 }
 drawStacktrace(row,p,time,q){
  const c=this.ctx;
  if(row.row===1||row.row===4){const word=row.words[0],a=cutEase(this.progress(time,word));if(a){c.save();c.globalAlpha*=a;c.fillStyle=p.dark;c.fillRect(word.x-14+8,0+9,word.width+28,row.size*1.08);c.fillStyle=row.row===1?p.a:p.b;c.fillRect(word.x-14,-6,word.width+28,row.size*1.08);c.restore();}}
  if(q){c.save();c.globalAlpha*=cutEase(q);c.fillStyle=row.row%2?p.b:p.a;c.fillRect(row.align===-1?-23:row.width+18,9,5,row.height-8);c.restore();}
  for(const word of row.words)this.word(word,row,p,time,{fill:(row.row===1||row.row===4)&&word===row.words[0]?p.dark:row.row%2?p.a:p.ink,depth:row.family==='block'?5:0,write:true});
 }
 drawSidewinder(row,p,time,q){
  const c=this.ctx;
  if((row.row===1||row.row===3)&&q){c.save();c.globalAlpha*=cutEase(q);c.strokeStyle=row.row===1?p.a:p.b;c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(-34,row.height*.45);c.bezierCurveTo(-87,row.height*1.2,row.width*.8,row.height*1.34,row.width+27,row.height*.9);c.bezierCurveTo(row.width+63,row.height*.54,row.width+26,7,row.width-19,6);c.stroke();c.restore();}
  for(const [i,word]of row.words.entries())this.word(word,row,p,time,{fill:row.row===1?p.a:row.row===4?p.b:p.ink,dy:Math.sin(i*1.7+row.row)*5,rotate:(i%2?1:-1)*.012,depth:row.family==='slash'?5:0,write:row.family==='text'});
 }
 drawStamp(row,p,time,q){
  const c=this.ctx;c.rotate(row.row===3?.018:row.row===1?-.012:0);
  if(row.row===3&&q){c.save();c.globalAlpha*=cutEase(q);c.strokeStyle=p.a;c.lineWidth=5;c.strokeRect(-24,-12,row.width+48,row.height+21);c.lineWidth=1.3;c.strokeRect(-15,-4,row.width+30,row.height+5);c.restore();}
  for(const word of row.words)this.word(word,row,p,time,{fill:row.row===3?p.a:row.row===1?p.b:p.ink,texture:'rubber',stamp:true});
  if(row.row===4)this.underline(row.words.at(-1),row,p,time,{color:p.a,weight:5});
 }
 drawGlasswire(row,p,time,q){
  const c=this.ctx,glass=row.row===1;
  if(glass&&q){c.save();c.globalAlpha*=cutEase(q);cutRound(c,-27,-10,row.width+54,row.height+22,12);c.clip();
   if(this.background){c.save();c.filter=`blur(${11*this.canvas.width/1080}px)`;c.translate(-row.renderX,-row.renderY);c.drawImage(this.background,0,0,1080,1920);c.restore();}
   const g=c.createLinearGradient(0,0,row.width,row.height);g.addColorStop(0,p.a+'38');g.addColorStop(.55,p.dark+'4d');g.addColorStop(1,p.ink+'23');c.fillStyle=g;c.fillRect(-30,-15,row.width+60,row.height+32);
   c.globalAlpha*=cutClamp(Number(this.options.texture)||0)*.48;c.fillStyle=c.createPattern(this.pattern('frost',p),'repeat');c.fillRect(-30,-15,row.width+60,row.height+32);c.restore();
   c.save();c.globalAlpha*=cutEase(q);c.strokeStyle=p.a+'be';c.lineWidth=2.5;cutRound(c,-27,-10,row.width+54,row.height+22,12);c.stroke();c.strokeStyle=p.ink+'90';c.lineWidth=1;cutRound(c,-22,-5,row.width+44,row.height+12,9);c.stroke();
   if(!this.options.reducedMotion){const phase=cutClamp((time-row.words[0].start)/1.4);c.strokeStyle=p.ink;c.lineWidth=3;c.beginPath();c.moveTo(-24+row.width*phase,-10);c.lineTo(-24+row.width*phase+45,-10);c.stroke();}c.restore();}
  for(const word of row.words)this.word(word,row,p,time,{fill:glass?p.a:row.row===3&&word.index===10?p.b:p.ink,texture:glass?null:'satin',blur:9});
  if(row.row===2)this.underline(row.words.at(-1),row,p,time,{color:p.b,weight:3});
 }
 drawSpeednote(row,p,time,q){
  const c=this.ctx;
  if(row.row===1&&q){c.save();c.globalAlpha*=cutEase(q);c.strokeStyle=p.b;c.lineCap='round';for(let i=0;i<3;i++){c.lineWidth=4-i;c.beginPath();c.moveTo(-50-i*7,row.size*.25+i*19);c.lineTo(-20,row.size*.25+i*19-6);c.stroke();}c.restore();}
  for(const word of row.words)this.word(word,row,p,time,{fill:row.family==='hand'?p.b:row.row===1||row.row===4?p.a:p.ink,texture:row.family==='hand'?null:'paint',depth:row.row===1?7:0,write:true});
  if(row.row===2||row.row===4)this.underline(row.words.at(-1),row,p,time,{color:row.row===2?p.b:p.a,weight:4,hook:row.row===4});
 }
 drawPinstripe(row,p,time,q){
  const c=this.ctx;
  if(row.row===1&&q){c.save();c.globalAlpha*=cutEase(q);c.strokeStyle=p.b;c.lineWidth=2;for(let i=0;i<3;i++){c.beginPath();c.moveTo(-24-i*6,-8);c.lineTo(-24-i*6,row.height+4);c.lineTo(row.width+12,row.height+4);c.stroke();}c.restore();}
  for(const word of row.words)this.word(word,row,p,time,{fill:row.row===2?p.a:row.row===4?p.b:p.ink,texture:row.row===2||row.row===4?'stripe':null,depth:row.row===2?8:0,blur:3,outline:row.row===0&&word===row.words.at(-1)});
  if(row.row===3){const word=row.words.at(-1);this.underline(word,row,p,time,{color:p.a,weight:8});}
 }
 dispose(){super.dispose();this.faces.clear();this.patterns.clear();this.background=null;}
}
