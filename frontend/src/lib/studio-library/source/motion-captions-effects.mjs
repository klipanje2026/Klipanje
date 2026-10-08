import {CutCaptionRenderer} from './cut-captions-renderer.mjs';
import {CutFontMap} from './cut-captions-config.mjs';
import {MotionStyles} from './motion-captions-config.mjs';
const meClamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const meEase=v=>1-Math.pow(1-meClamp(v),3);
const meFont=(family,size)=>CutFontMap[family].replace('100px',`${size}px`);
export const MotionEffects={
 pattern(kind,p){
  if(kind!=='woven')return CutCaptionRenderer.prototype.pattern.call(this,kind,p);
  const key=['woven',p.a,p.b,p.dark].join('|');if(this.patterns.has(key))return this.patterns.get(key);
  const tile=document.createElement('canvas');tile.width=tile.height=128;const c=tile.getContext('2d');
  c.lineWidth=1.2;c.strokeStyle=p.dark+'48';for(let x=2;x<128;x+=5){c.beginPath();c.moveTo(x,0);c.lineTo(x,128);c.stroke();}
  c.strokeStyle=p.b+'77';for(let y=2;y<128;y+=5){c.beginPath();c.moveTo(0,y);c.lineTo(128,y);c.stroke();}
  c.fillStyle=p.ink+'60';for(let y=0;y<128;y+=10)for(let x=(y/10)%2?5:0;x<128;x+=10)c.fillRect(x,y,3,2);
  this.patterns.set(key,tile);return tile;
 },
 links(group,p,time){
  if(this.options.atlas!=='bridge')return;const c=this.ctx,fx=meClamp(Number(this.options.effects)||0,0,1.4);if(!fx)return;
  const visible=group.entries.filter(word=>this.progress(time,word)>0);c.save();c.globalAlpha*=.65*Math.min(1,fx);c.strokeStyle=p.b;c.lineWidth=2;
  for(let i=1;i<visible.length;i++){const a=visible[i-1],b=visible[i],q=meEase(this.progress(time,b)),x1=a.x+a.width,y1=a.y+a.size*1.1,x2=b.x,y2=b.y+b.size*1.1;c.save();c.globalAlpha*=q;c.beginPath();c.moveTo(x1,y1);if(a.band===b.band)c.lineTo(x2,y2);else{c.lineTo(x1+12,y1+8);c.lineTo(x2-12,y2+8);c.lineTo(x2,y2);}c.stroke();c.fillStyle=p.a;c.beginPath();c.arc(x2,y2,3,0,Math.PI*2);c.fill();c.restore();}c.restore();
 },
 backing(word,p,time){
  const c=this.ctx,kind=this.options.atlas,q=this.progress(time,word),e=meEase(q),depth=meClamp(Number(this.options.depth)||0),fx=meClamp(Number(this.options.effects)||0,0,1.4),detail=meClamp(Number(this.options.texture)||0),{width:w,size:s,large}=word;
  c.save();c.globalAlpha*=e;
  if(kind==='pass'&&large&&depth){c.font=meFont(word.family,s);c.fillStyle=p.b;c.globalAlpha*=.65;c.fillText(word.label,4*depth,s*.88+5*depth);}
  if(kind==='sun'&&large&&fx){const radius=Math.min(s*.75,w*.27),x=w*.86,y=s*.44,g=c.createRadialGradient(x,y,1,x,y,radius);g.addColorStop(0,p.a+'ad');g.addColorStop(.68,p.a+'68');g.addColorStop(1,p.a+'00');c.globalAlpha*=Math.min(1,fx);c.fillStyle=g;c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.fill();c.strokeStyle=p.b;c.lineWidth=2;c.beginPath();c.arc(x,y,radius*.8,-.4,-.4+Math.PI*1.35*e);c.stroke();}
  if(kind==='woven'&&large&&word.band===1){c.shadowColor=p.dark+'80';c.shadowBlur=10*depth*this.canvas.width/1080;c.shadowOffsetY=6*depth*this.canvas.width/1080;c.fillStyle=p.a;c.fillRect(-13,-6,w+26,s*1.14);c.shadowBlur=0;c.shadowOffsetY=0;c.save();c.beginPath();c.rect(-13,-6,w+26,s*1.14);c.clip();c.globalAlpha*=detail*.7;c.fillStyle=c.createPattern(this.pattern('woven',p),'repeat');c.fillRect(-13,-6,w+26,s*1.14);c.restore();if(fx){c.strokeStyle=p.dark+'9f';c.lineWidth=1.6;c.setLineDash([4,4]);c.strokeRect(-7,0,w+14,s*1.03);c.setLineDash([]);}}
  if(kind==='bridge'&&!large&&word.slot%3===0){c.fillStyle=p.dark+'b8';c.fillRect(-6,-2,w+12,s*1.02);c.fillStyle=p.a;c.fillRect(-10,-2,3,s*1.02);}
  if(kind==='ticket'&&large&&word.band===2){const path=()=>{c.beginPath();c.roundRect(-14,-7,w+28,s*1.16,5);for(const x of [-14,w+14]){c.moveTo(x+5,s*.54);c.arc(x,s*.54,5,0,Math.PI*2);} };c.save();c.translate(4*depth,6*depth);path();c.fillStyle=p.dark;c.fill('evenodd');c.restore();path();c.fillStyle=p.a;c.fill('evenodd');c.save();path();c.clip('evenodd');c.globalAlpha*=detail*.8;c.fillStyle=c.createPattern(this.pattern('paper',p),'repeat');c.fillRect(-14,-7,w+28,s*1.16);c.restore();if(fx){c.strokeStyle=p.dark+'88';c.lineWidth=1.3;c.setLineDash([2,4]);c.beginPath();c.moveTo(0,s*1.05);c.lineTo(w,s*1.05);c.stroke();c.setLineDash([]);}}
  c.restore();
 },
 glyph(word,p,time){
  const c=this.ctx,kind=this.options.atlas,q=this.progress(time,word),motion=this.options.reducedMotion?0:meClamp(Number(this.options.motion)||0,0,1.5),depth=meClamp(Number(this.options.depth)||0),settle=1-meEase(q),active=word.index===this.activeIndex,row={family:word.family,size:word.size},local={...word,x:0};
  const backed=kind==='woven'&&word.large&&word.band===1||kind==='ticket'&&word.large&&word.band===2,fill=backed?p.dark:kind==='sun'&&word.large&&word.band===1?p.a:word.large?p.ink:active?p.a:p.b;
  const settings={fill,texture:MotionStyles[kind].texture,depth:word.large&&!backed?Math.round((kind==='sun'?4:7)*depth):0,blur:kind==='sun'?3:0,write:kind==='woven',stamp:kind==='ticket'};
  const draw=extra=>CutCaptionRenderer.prototype.word.call(this,local,row,p,time,{...settings,...extra});c.save();
  if(kind==='woven')c.transform(1,0,.06*settle*motion,1,0,0);
  if(kind==='ticket'){c.translate(word.width/2,0);c.scale(1-.27*settle*motion,1);c.translate(-word.width/2,0);}
  if(kind==='pass'&&word.large&&q<1&&motion){for(const half of [0,1]){c.save();c.beginPath();c.rect(-25,half?word.size*.55:-30,word.width+50,half?word.size*1.2:word.size*.55+30);c.clip();draw({dx:(half?1:-1)*18*settle*motion});c.restore();}}
  else if(kind==='sun'&&q<1&&motion){const chars=[...word.label];c.font=meFont(word.family,word.size);let prefix='';for(let i=0;i<chars.length;i++){const left=c.measureText(prefix).width;prefix+=chars[i];const right=c.measureText(prefix).width,phase=meClamp(q*1.6-i/Math.max(1,chars.length-1)*.6);if(!phase)continue;c.save();c.globalAlpha*=meEase(phase);c.translate(0,8*(1-meEase(phase))*motion);c.beginPath();c.rect(left-1,-35,right-left+2,word.size*1.8);c.clip();draw();c.restore();}}
  else draw();
  if(kind==='bridge'&&word.large){c.save();c.beginPath();c.rect(-20,word.size*.59,word.width+40,word.size);c.clip();draw({fill:p.a,depth:0});c.restore();}
  c.restore();
 },
 accent(word,p,time){
  const c=this.ctx,kind=this.options.atlas,q=this.progress(time,word),e=meEase(q),fx=meClamp(Number(this.options.effects)||0,0,1.4),{width:w,size:s,large}=word,active=word.index===this.activeIndex;if(!fx)return;
  c.save();c.globalAlpha*=e*Math.min(1,fx);c.lineCap='round';c.strokeStyle=p.a;c.lineWidth=2.5;
  if(kind==='pass'&&large){c.beginPath();c.moveTo(-15,3);c.lineTo(-15,s*.3);c.moveTo(w+15,s*.7);c.lineTo(w+15,s);c.stroke();c.fillStyle=p.a;c.fillRect(0,s*1.08,w*e,3);}
  if(kind==='sun'&&large){c.strokeStyle=p.b;c.lineWidth=2;c.beginPath();c.moveTo(0,s*1.03);c.bezierCurveTo(w*.3,s*1.12,w*.7,s*.98,w*e,s*1.06);c.stroke();}
  if(kind==='woven'&&large&&word.band!==1){c.strokeStyle=p.a;c.setLineDash([3,4]);c.lineWidth=2;c.beginPath();c.moveTo(0,s*1.1);c.lineTo(w*e,s*1.1);c.stroke();c.setLineDash([]);}
  if(kind==='bridge'&&large){c.strokeStyle=p.b;c.lineWidth=2;c.beginPath();c.moveTo(0,s*1.08);c.lineTo(w*e,s*1.08);c.moveTo(w,s*1.08);c.lineTo(w,s*.92);c.stroke();}
  if(kind==='ticket'&&large&&word.band!==2){c.strokeStyle=p.b;c.lineWidth=2;c.beginPath();c.moveTo(-9,0);c.lineTo(-9,s);c.moveTo(w+9,0);c.lineTo(w+9,s);c.stroke();}
  if(active){c.strokeStyle=p.b;c.lineWidth=large?4:2.5;c.beginPath();c.moveTo(0,s*1.15);c.lineTo(w*e,s*1.15);c.stroke();if(kind==='sun'){c.fillStyle=p.a;c.beginPath();c.arc(w+9,s*1.13,3.5,0,Math.PI*2);c.fill();}if(kind==='ticket'){c.fillStyle=p.b;c.fillRect(w+10,s*.25,3,s*.35);}}
  c.restore();
 }
};
