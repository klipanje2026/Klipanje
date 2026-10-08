import {CutCaptionRenderer} from './cut-captions-renderer.mjs';
import {CutFontMap} from './cut-captions-config.mjs';
import {ChromaStyles} from './chroma-captions-config.mjs';
const ceFxClamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ceFxEase=v=>1-Math.pow(1-ceFxClamp(v),3);
const ceFxFont=(family,size)=>CutFontMap[family].replace('100px',`${size}px`);
const ceCard=(c,w,s,cut)=>{c.beginPath();c.moveTo(-12+cut,-5);c.lineTo(w+12,-5);c.lineTo(w+12,s*1.06-cut);c.lineTo(w+12-cut,s*1.06);c.lineTo(-12,s*1.06);c.lineTo(-12,-5+cut);c.closePath();};
const ceBacked=(kind,word)=>word.large&&(kind==='edge'&&word.band!==1||kind==='velvet'&&word.band===1||kind==='mono'||kind==='tidal'&&word.band===1||kind==='pulp'&&word.band!==1);
const ceSurface=(kind,word,p)=>kind==='mono'?(word.band===2?p.b:p.a):word.band===2?p.b:p.a;
const ceSurfaceInk=(kind,word,p)=>kind==='mono'?(word.band===2?p.onB:p.onA):word.band===2?p.onB:p.onA;
export const ChromaEffects={
 pattern(kind,p){
  const key=[kind,p.a,p.b,p.dark,p.ink].join('|');if(this.patterns.has(key))return this.patterns.get(key);
  const tile=document.createElement('canvas');tile.width=tile.height=128;const c=tile.getContext('2d');let seed=170919;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  if(kind==='microgrid'){c.strokeStyle=p.dark+'30';c.lineWidth=.7;for(let y=3;y<128;y+=8)for(let x=3;x<128;x+=8){c.beginPath();c.moveTo(x,y);c.lineTo(x+3,y-2);c.stroke();}}
  else if(kind==='contour'){c.strokeStyle=p.ink+'28';c.lineWidth=.7;for(let y=-24;y<150;y+=9){c.beginPath();c.moveTo(0,y);c.bezierCurveTo(40,y-11,84,y+14,128,y+2);c.stroke();}}
  else if(kind==='velvet'){c.strokeStyle=p.ink+'13';c.lineWidth=.5;for(let y=1;y<128;y+=3){c.beginPath();c.moveTo(0,y);c.lineTo(128,y-2);c.stroke();}for(let i=0;i<750;i++){c.fillStyle=rnd()>.5?p.dark+'45':p.ink+'38';c.fillRect(rnd()*128,rnd()*128,.8,.8);}}
  else{for(let i=0;i<(kind==='newsprint'?600:240);i++){c.fillStyle=rnd()>.55?p.dark+'46':p.ink+'45';c.fillRect(rnd()*128,rnd()*128,.65+rnd()*.9,.5+rnd());}if(kind==='newsprint'){c.strokeStyle=p.dark+'20';c.lineWidth=.6;for(let y=1;y<128;y+=7){c.beginPath();c.moveTo(0,y);c.lineTo(128,y-1);c.stroke();}}}
  this.patterns.set(key,tile);return tile;
 },
 links(){},
 backing(word,p,time){
  const c=this.ctx,kind=this.options.chroma,e=ceFxEase(this.progress(time,word)),depth=ceFxClamp(Number(this.options.depth)||0),fx=ceFxClamp(Number(this.options.effects)||0,0,1.4),detail=ceFxClamp(Number(this.options.texture)||0),{width:w,size:s,large}=word,backed=ceBacked(kind,word),fill=ceSurface(kind,word,p);
  c.save();c.globalAlpha*=e;
  if(backed){
   const path=()=>{if(kind==='edge')ceCard(c,w,s,13);else if(kind==='velvet'){c.beginPath();c.roundRect(-17,-5,w+34,s*1.1,[s*.28,s*.12,s*.28,s*.12]);}else if(kind==='tidal'){c.beginPath();c.roundRect(-13,-5,w+26,s*1.1,12);}else if(kind==='pulp'){c.beginPath();c.moveTo(-13,-4);for(let x=-13;x<w+14;x+=12)c.lineTo(x,-5+Math.sin(x*.47)*1.7);c.lineTo(w+13,s*1.07);for(let x=w+13;x>-14;x-=12)c.lineTo(x,s*1.07+Math.sin(x*.63)*1.5);c.closePath();}else{c.beginPath();c.rect(-10,-4,w+20,s*1.06);}};
   c.save();c.translate(5*depth,7*depth);path();c.fillStyle=p.dark;c.fill();c.restore();path();c.fillStyle=fill;c.fill();
   c.save();path();c.clip();c.globalAlpha*=detail*.6;c.fillStyle=c.createPattern(this.pattern(ChromaStyles[kind].texture,p),'repeat');c.fillRect(-20,-10,w+40,s*1.3);c.restore();
   if(kind==='tidal'&&fx){c.save();path();c.clip();const g=c.createLinearGradient(0,0,w,s);g.addColorStop(0,p.ink+'35');g.addColorStop(.35,p.ink+'00');g.addColorStop(1,p.dark+'32');c.globalAlpha*=Math.min(1,fx);c.fillStyle=g;c.fillRect(-20,-10,w+40,s*1.3);c.strokeStyle=p.b+'aa';c.lineWidth=1.3;c.strokeRect(-8,0,w+16,s*1.0);c.restore();}
   if(kind==='velvet'&&detail){c.save();path();c.clip();c.globalAlpha*=detail*.8;c.strokeStyle=p.b+'99';c.lineWidth=.8;for(let y=0;y<s*1.1;y+=4){c.beginPath();c.moveTo(-17,y);c.lineTo(w+17,y-3);c.stroke();}c.restore();c.save();path();c.strokeStyle=c.createPattern(this.pattern('velvet',p),'repeat');c.lineWidth=4;c.globalAlpha*=detail;c.stroke();c.restore();}
   if(kind==='velvet'&&fx){c.globalAlpha*=Math.min(1,fx);c.strokeStyle=p.b;c.lineWidth=1.3;c.beginPath();c.moveTo(3,s*1.02);c.bezierCurveTo(w*.3,s*1.065,w*.75,s*1.04,w-3,s*1.0);c.stroke();}
  }
  if(kind==='edge'&&large&&word.band===1&&depth){c.font=ceFxFont(word.family,s);c.fillStyle=p.a;c.fillText(word.label,-2.5*depth,s*.88+3.5*depth);}
  if(kind==='mono'&&!large&&word.slot%3===0){c.fillStyle=p.dark+'cc';c.fillRect(-5,-1,w+10,s*1.01);}
  if(kind==='tidal'&&large&&!backed&&fx){c.save();c.strokeStyle=p.a;c.lineWidth=1.4;for(let i=0;i<3;i++){const offset=i*3.5;c.beginPath();c.moveTo(-12-offset,s*.15);c.bezierCurveTo(-21-offset,s*.4,-11-offset,s*.7,-15-offset,s*.95);c.stroke();}c.restore();}
  c.restore();
 },
 glyph(word,p,time){
  const c=this.ctx,kind=this.options.chroma,q=this.progress(time,word),motion=this.options.reducedMotion?0:ceFxClamp(Number(this.options.motion)||0,0,1.5),settle=1-ceFxEase(q),depth=ceFxClamp(Number(this.options.depth)||0),backed=ceBacked(kind,word),active=word.index===this.activeIndex;
  const fill=backed?ceSurfaceInk(kind,word,p):word.large?(kind==='velvet'?p.b:kind==='tidal'?p.b:p.ink):p.ink;
  const row={family:word.family,size:word.size},local={...word,x:0},settings={fill,texture:ChromaStyles[kind].texture,depth:backed?0:word.large?Math.round(depth*5):0,blur:kind==='tidal'?2.5:0,stamp:kind==='pulp'};
  const draw=extra=>CutCaptionRenderer.prototype.word.call(this,local,row,p,time,{...settings,...extra});c.save();
  if(kind==='mono'&&q<1&&motion){c.beginPath();c.rect(-24,-35,(word.width+48)*ceFxEase(q),word.size*1.8);c.clip();draw({dx:-10*settle*motion});}
  else if(kind==='velvet'&&q<1&&motion){c.font=ceFxFont(word.family,word.size);const chars=[...word.label];let prefix='';for(let i=0;i<chars.length;i++){const x=c.measureText(prefix).width;prefix+=chars[i];const right=c.measureText(prefix).width,phase=ceFxClamp(q*1.65-i/Math.max(1,chars.length-1)*.65);if(!phase)continue;c.save();c.globalAlpha*=ceFxEase(phase);c.translate(0,6*(1-ceFxEase(phase))*motion);c.beginPath();c.rect(x-1,-35,right-x+2,word.size*1.8);c.clip();draw();c.restore();}}
  else if(kind==='tidal'&&q<1&&motion){c.beginPath();c.moveTo(-24,-35);c.lineTo((word.width+65)*ceFxEase(q)-24,-35);c.lineTo((word.width+65)*ceFxEase(q)-44,word.size*1.65);c.lineTo(-24,word.size*1.65);c.closePath();c.clip();draw({dx:5*settle*motion});}
  else if(kind==='edge'&&q<1&&motion){c.translate(word.width/2,word.size/2);c.scale(1+.055*settle*motion,1-.075*settle*motion);c.translate(-word.width/2,-word.size/2);draw({dx:word.slot%2?-11*settle*motion:11*settle*motion});}
  else draw();
  c.restore();
 },
 accent(word,p,time){
  const c=this.ctx,kind=this.options.chroma,e=ceFxEase(this.progress(time,word)),fx=ceFxClamp(Number(this.options.effects)||0,0,1.4),{width:w,size:s,large}=word,active=word.index===this.activeIndex;if(!fx)return;
  c.save();c.globalAlpha*=e*Math.min(1,fx);c.strokeStyle=p.b;c.lineWidth=2;c.lineCap='round';
  if(kind==='edge'&&large){c.fillStyle=word.band===2?p.a:p.b;c.fillRect(-12,s*1.12,w*e*.5,3.5);c.beginPath();c.moveTo(w+17,s*.72);c.lineTo(w+17,s*.96);c.lineTo(w+7,s*1.06);c.stroke();}
  if(kind==='velvet'&&large&&word.band!==1){c.strokeStyle=p.a;c.lineWidth=3;c.beginPath();c.moveTo(0,s*1.06);c.bezierCurveTo(w*.22,s*1.12,w*.64,s*1.04,w*e,s*1.08);c.stroke();c.fillStyle=p.b;c.beginPath();c.moveTo(w+12,s*.28);c.lineTo(w+15,s*.33);c.lineTo(w+12,s*.38);c.lineTo(w+9,s*.33);c.closePath();c.fill();}
  if(kind==='mono'&&large){c.strokeStyle=p.ink;c.lineWidth=1.4;c.beginPath();c.moveTo(-14,-8);c.lineTo(-14,s*.24);c.moveTo(w+14,s*.78);c.lineTo(w+14,s*1.09);c.stroke();c.fillStyle=p.dark;c.fillRect(2,s*1.015,w*.72*e,2.5);}
  if(kind==='tidal'&&large){c.strokeStyle=p.b;c.lineWidth=1.5;c.beginPath();c.moveTo(0,s*1.13);c.bezierCurveTo(w*.2,s*1.06,w*.7,s*1.21,w*e,s*1.12);c.stroke();c.fillStyle=p.b;c.beginPath();c.arc(w+8,s*1.09,3,0,Math.PI*2);c.fill();}
  if(kind==='pulp'&&large){c.strokeStyle=word.band===2?p.a:p.b;c.lineWidth=2;c.beginPath();c.moveTo(-20,3);c.lineTo(-20,s*.52);c.moveTo(w+20,s*.65);c.lineTo(w+20,s*1.03);c.stroke();if(word.band===1){c.lineWidth=4;c.beginPath();c.moveTo(0,s*1.08);c.lineTo(w*e,s*1.08-2);c.stroke();}}
  if(active&&!large){c.strokeStyle=kind==='mono'?p.ink:p.b;c.lineWidth=3;c.beginPath();c.moveTo(0,s*1.12);c.lineTo(w*e,s*1.12);c.stroke();}
  c.restore();
 }
};
