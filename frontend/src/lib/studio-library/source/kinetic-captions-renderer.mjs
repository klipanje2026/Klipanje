import {AmplifyCaptionRenderer} from './amplify-captions-renderer.mjs';
import {CutCaptionRenderer} from './cut-captions-renderer.mjs';
import {CutFontMap} from './cut-captions-config.mjs';
import {KineticStyles} from './kinetic-captions-config.mjs';

const klClamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const klEase=v=>1-Math.pow(1-klClamp(v),3);
const klFont=(family,size)=>CutFontMap[family].replace('100px',`${size}px`);
const klConnectors=new Set(['a','i','u','je','još','mi','da','se','na','za','do','iz','s','taj','uz','koje','pa','ali','bi','to']);

export class KineticCaptionRenderer extends AmplifyCaptionRenderer{
 constructor(canvas,{style='anchor',...options}={}){
  if(!KineticStyles[style])throw new RangeError('Nepoznat stil.');
  super(canvas,{style:'punch',kinetic:style,dynamics:1,...options});
 }
 setOptions({style,kinetic,...options}){
  kinetic=style||kinetic||this.options.kinetic;if(!KineticStyles[kinetic])throw new RangeError('Nepoznat stil.');
  return super.setOptions({...options,amplify:'punch',kinetic});
 }
 layout(cue){
  const style=KineticStyles[this.options.kinetic],scale=klClamp(Number(this.options.scale)||1,.8,1.12),dynamics=klClamp(Number(this.options.dynamics)||0,.4,1.4),windowSize=Number(this.options.window)===6?6:8;
  const key=[cue.text,cue.words.map(w=>w.start+':'+w.end).join(','),this.options.kinetic,windowSize,scale,dynamics].join('|');if(this.cache.has(key))return this.cache.get(key);
  const groupCount=Math.ceil(cue.words.length/windowSize),minimum=Math.floor(cue.words.length/groupCount),extra=cue.words.length%groupCount,groups=[];let cursor=0;
  for(let g=0;g<groupCount;g++){
   const count=minimum+(g<extra?1:0),entries=cue.words.slice(cursor,cursor+count).map((word,i)=>({...word,index:cursor+i,slot:i,family:style.fonts[i],weight:style.weights[i],x:0,y:0}));
   let at=0,y=0;const bands=[];
   for(const [bandIndex,bandCount]of style.bands.entries()){
    const words=entries.slice(at,at+bandCount);if(!words.length)break;at+=words.length;
    const clean=w=>w.text.toLocaleLowerCase('bs').replace(/[^\p{L}]/gu,''),major=words.reduce((a,b)=>a.weight>b.weight?a:b),meaningful=words.filter(w=>!klConnectors.has(clean(w))),candidate=meaningful.reduce((a,b)=>clean(a).length>clean(b).length?a:b,meaningful[0]||major);
    if(candidate!==major&&(klConnectors.has(clean(major))||clean(candidate).length>=clean(major).length*1.6)){[major.weight,candidate.weight]=[candidate.weight,major.weight];[major.family,candidate.family]=[candidate.family,major.family];}
    for(const word of words){if(klConnectors.has(clean(word)))word.weight=Math.min(.85,word.weight);if(words.length===1&&!klConnectors.has(clean(word)))word.weight=Math.max(1.3,word.weight);word.size=76*scale*(1+(word.weight-1)*dynamics);word.label=['text','hand'].includes(word.family)?word.text:word.text.toLocaleUpperCase('bs');this.ctx.font=klFont(word.family,word.size);const metrics=this.ctx.measureText(word.label);word.width=metrics.width;word.originOffset=Math.max(0,metrics.actualBoundingBoxAscent-word.size*.88)+3;word.height=Math.max(word.size*1.02,word.originOffset+word.size*.88+metrics.actualBoundingBoxDescent+5);word.large=word.weight>1.25;}
    const stacked=style.stack.includes(bandIndex)&&words.length===3&&words[0].large;
    let width,height;
    if(stacked){const [big,upper,lower]=words,rightWidth=Math.max(upper.width,lower.width);height=Math.max(big.height,upper.height+lower.height+8);big.x=0;big.y=(height-big.height)/2;upper.x=lower.x=big.width+22;upper.y=0;lower.y=upper.height+8;width=big.width+22+rightWidth;}
    else{height=Math.max(...words.map(w=>w.height));let x=0;for(const word of words){word.x=x;word.y=height-word.height;const drift=this.options.kinetic==='orbit'?[0,-8,7][word.slot%3]:this.options.kinetic==='offset'&&word.large?-5:0;word.y+=drift;x+=word.width+20;}width=x-20;}
    if(width>808){const k=808/width;for(const word of words){word.x*=k;word.y*=k;word.size*=k;word.width*=k;word.height*=k;word.originOffset*=k;}width*=k;height*=k;}
    for(const word of words){word.y+=y;word.band=bandIndex;}
    bands.push({words,width,height,y,index:bandIndex});y+=height+14;
   }
   let total=y-14;const width=Math.max(...bands.map(b=>b.width));
   for(const band of bands){const align=style.align[band.index],offset=align===-1?0:align===1?width-band.width:(width-band.width)/2;for(const word of band.words)word.x+=offset;}
   if(total>410){const k=410/total;for(const word of entries){word.x*=k;word.y*=k;word.size*=k;word.width*=k;word.height*=k;word.originOffset*=k;}for(const band of bands){band.width*=k;band.y*=k;band.height*=k;}total=410;}
   for(const word of entries)word.y+=word.originOffset;
   const finalWidth=Math.max(...entries.map(w=>w.x+w.width));
   groups.push({entries,bands,total,width:finalWidth,count,index:g,start:entries[0].start,end:cue.words[cursor+count]?.start??cue.end});cursor+=count;
  }
  const result={groups};this.cache.set(key,result);if(this.cache.size>80)this.cache.delete(this.cache.keys().next().value);return result;
 }
 render(time,{background=null}={}){
  if(this.disposed)return;this.time=time;const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);c.save();c.scale(w/1080,h/1920);
  if(background&&!this.options.overlayOnly)background(c,1080,1920,time);
  const cue=this.cues.find(cue=>time>=cue.start&&time<cue.end);this.pose={seconds:time,style:this.options.kinetic,words:cue?.words.length||0,visibleWords:0,group:0};if(!cue){c.restore();return;}
  const group=this.layout(cue).groups.find(g=>time>=g.start&&time<g.end);if(!group){c.restore();return;}
  const style=KineticStyles[this.options.kinetic],p=style.palettes[klClamp(Math.round(this.options.palette)||0,0,3)],position=klClamp(Number(this.options.position)||82,74,85),x=(1080-group.width)/2,y=klClamp(1920*position/100-group.total/2,1244,1750-group.total),visible=group.entries.filter(word=>this.progress(time,word)>0),active=group.entries.filter(word=>word.start<=time).at(-1);
  this.activeIndex=active?.index;this.pose={...this.pose,visibleWords:visible.length,displayText:visible.map(word=>word.text).join(' '),activeWord:active?.text,activeIndex:active?.index,group:group.index+1,groups:this.layout(cue).groups.length,bounds:{x:x-35,y:y-25,width:group.width+70,height:group.total+55}};
  c.beginPath();c.rect(66,1190,948,600);c.clip();c.globalAlpha=this.options.reducedMotion?1:klClamp((group.end-time)/.1);c.translate(x,y);
  // Draw only revealed words and their decorations. Later positions stay empty.
  for(const word of visible){c.save();c.translate(word.x,word.y);this.backing(word,p,time);c.restore();}
  for(const word of visible){c.save();c.translate(word.x,word.y);this.glyph(word,p,time);this.accent(word,p,time);c.restore();}
  c.restore();
 }
 backing(word,p,time){
  const c=this.ctx,kind=this.options.kinetic,q=this.progress(time,word),e=klEase(q),depth=klClamp(Number(this.options.depth)||0),fx=klClamp(Number(this.options.effects)||0,0,1.4),detail=klClamp(Number(this.options.texture)||0),{width:w,size:s,large}=word;
  c.save();c.globalAlpha*=e;
  if(kind==='anchor'&&large&&word.band===2){c.fillStyle=p.dark;c.fillRect(-9+4*depth,-3+7*depth,w+18,s*1.06);c.fillStyle=p.a;c.fillRect(-9,-3,w+18,s*1.06);}
  if(kind==='offset'&&large&&word.band!==1){c.rotate(-.012);this.plate(0,-3,w,s*1.05,p,q,{color:word.band===2?p.b:p.a,slant:16,layer:true});}
  if(kind==='orbit'&&large){c.beginPath();c.roundRect(-12,-5,w+24,s*1.1,s*.5);c.shadowColor=p.dark+'a0';c.shadowBlur=16*depth*this.canvas.width/1080;c.shadowOffsetY=7*depth*this.canvas.width/1080;const gradient=c.createLinearGradient(0,-5,0,s);gradient.addColorStop(0,p.a+'de');gradient.addColorStop(.5,p.a+'c9');gradient.addColorStop(1,p.b+'de');c.fillStyle=gradient;c.fill();c.shadowBlur=0;c.shadowOffsetY=0;c.save();c.clip();c.globalAlpha*=detail*.6;c.fillStyle=c.createPattern(this.pattern('satin',p),'repeat');c.fillRect(-14,-10,w+28,s*1.3);c.restore();if(fx){c.strokeStyle=p.ink+'9a';c.lineWidth=1.5;c.beginPath();c.moveTo(10,1);c.bezierCurveTo(w*.25,-2,w*.6,-2,w-10,1);c.stroke();}}
  if(kind==='step'&&large&&word.slot!==0){c.fillStyle=p.dark;c.fillRect(-10+6*depth,-4+7*depth,w+20,s*1.08);c.fillStyle=word.slot===3?p.a:p.b;c.fillRect(-10,-4,w+20,s*1.08);c.save();c.beginPath();c.rect(-10,-4,w+20,s*1.08);c.clip();c.globalAlpha*=detail*.6;c.fillStyle=c.createPattern(this.pattern('grid',p),'repeat');c.fillRect(-10,-4,w+20,s*1.08);c.restore();}
  if(kind==='ink'&&large&&word.band===2)this.plate(0,-2,w,s*1.05,p,q,{torn:true,color:p.b,angle:.008});
  if(kind==='ink'&&large&&word.family==='hand'){c.strokeStyle=p.a;c.lineWidth=s*.19;c.lineCap='round';c.beginPath();c.moveTo(0,s*.87);c.bezierCurveTo(w*.3,s*.95,w*.7,s*.87,w*e,s*.92);c.stroke();}
  c.restore();
 }
 glyph(word,p,time){
  const c=this.ctx,kind=this.options.kinetic,q=this.progress(time,word),motion=this.options.reducedMotion?0:klClamp(Number(this.options.motion)||0,0,1.5),depth=klClamp(Number(this.options.depth)||0),settle=1-klEase(q),active=word.index===this.activeIndex;
  const row={family:word.family,size:word.size},local={...word,x:0},backed=kind==='anchor'&&word.large&&word.band===2||kind==='offset'&&word.large&&word.band!==1||kind==='orbit'&&word.large||kind==='step'&&word.large&&word.slot!==0||kind==='ink'&&word.large&&word.band===2;
  const fill=backed?p.dark:kind==='ink'&&word.family==='hand'?p.b:word.large?p.ink:active?p.a:p.b;
  c.save();
  if(kind==='anchor'&&word.large){const pulse=1+Math.sin(q*Math.PI)*(1-q)*.13*motion;c.translate(word.width/2,word.size/2);c.scale(pulse,pulse);c.translate(-word.width/2,-word.size/2);}
  if(kind==='orbit'){c.translate(0,-12*settle*motion);c.rotate((word.slot%2?1:-1)*.055*settle*motion);}
  if(kind==='step'){const squash=1-.18*settle*motion;c.translate(0,word.size);c.scale(1,squash);c.translate(0,-word.size);}
  CutCaptionRenderer.prototype.word.call(this,local,row,p,time,{fill,texture:KineticStyles[kind].texture,depth:word.large&&!backed?Math.round(8*depth):0,outline:kind==='offset'&&word.large&&word.band===1||kind==='step'&&word.slot===0,dx:kind==='offset'?(word.band%2?-1:1)*22*settle*motion:kind==='ink'?9*settle*motion:0,blur:kind==='orbit'?5:kind==='anchor'&&!word.large?3:0,stamp:kind==='step',write:kind==='ink',rotate:kind==='ink'&&word.family==='hand'?-.008:0});c.restore();
 }
 accent(word,p,time){
  const c=this.ctx,kind=this.options.kinetic,q=this.progress(time,word),e=klEase(q),fx=klClamp(Number(this.options.effects)||0,0,1.4),active=word.index===this.activeIndex,{width:w,size:s}=word;if(!fx)return;
  c.save();c.globalAlpha*=e*Math.min(1,fx);c.strokeStyle=p.a;c.lineWidth=3;c.lineCap='round';
  if(kind==='anchor'&&word.large&&word.band!==2){c.beginPath();c.moveTo(-17,4);c.lineTo(-17,s*.88);c.lineTo(-2,s*.88);c.stroke();}
  if(kind==='offset'&&word.large){c.strokeStyle=p.b;c.lineWidth=2;c.beginPath();c.moveTo(0,s*1.02);c.lineTo(w*e,s*1.02);c.moveTo(8,s*1.02+7);c.lineTo(w*e-8,s*1.02+7);c.stroke();}
  if(kind==='orbit'&&word.large&&word.band===1){c.strokeStyle=p.b;c.lineWidth=2;c.beginPath();c.ellipse(w*.5,s*.47,w*.5+19,s*.63,-.035,-.5,-.5+Math.PI*1.7*e);c.stroke();}
  if(kind==='step'&&word.large){c.strokeStyle=word.slot===0?p.a:p.dark;c.lineWidth=2.5;c.beginPath();c.moveTo(-20,5);c.lineTo(-20,-10);c.lineTo(7,-10);c.moveTo(w-6,s+10);c.lineTo(w+20,s+10);c.lineTo(w+20,s-5);c.stroke();}
  if(kind==='ink'&&word.family==='hand'){c.strokeStyle=p.a;c.lineWidth=2.5;c.beginPath();c.moveTo(0,s*1.05);c.bezierCurveTo(w*.3,s*1.13,w*.75,s*.96,w*e,s*1.06);c.stroke();}
  if(active){c.strokeStyle=kind==='orbit'?p.ink:p.a;c.lineWidth=word.large?4:2.5;c.beginPath();c.moveTo(0,s*1.13);c.lineTo(w*e,s*1.13);c.stroke();if(kind==='offset'||kind==='step'){c.fillStyle=p.b;c.fillRect(w*e+6,s*1.13-3,7,7);}if(kind==='ink'){c.beginPath();c.moveTo(w+9,s*.6);c.lineTo(w+18,s*.5);c.moveTo(w+9,s*.76);c.lineTo(w+19,s*.76);c.stroke();}}
  c.restore();
 }
}
