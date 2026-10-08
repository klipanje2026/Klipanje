import {PortraitStyles,PortraitFontMap} from './portrait-config.mjs';
import {loadPortraitFonts} from './portrait-fonts.mjs';

const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const ease=v=>1-Math.pow(1-clamp(v),3);
const spring=v=>v>=1?1:1-Math.exp(-7*clamp(v))*Math.cos(10*clamp(v));
const split=text=>String(text||'').trim().split(/\s+/u).filter(Boolean);
const font=(key,size)=>PortraitFontMap[key].replace('100px',`${size}px`);
const rounded=(ctx,x,y,w,h,r)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);};

export class PortraitCaptionRenderer{
 constructor(canvas,options={}){
  if(!canvas?.getContext)throw new TypeError('Potreban je canvas.');
  this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});
  this.options={style:'slash',palette:0,scale:1,position:58,motion:1,reducedMotion:false,...options};
  this.cues=[];this.cache=new Map();this.disposed=false;this.detachVideo=null;
  this.fontReady=loadPortraitFonts().then(()=>{this.cache.clear();return this;});
 }
 ready(){return this.fontReady;}
 setOptions(options){
  if(options.style&&!PortraitStyles[options.style])throw new RangeError('Nepoznat stil.');
  this.options={...this.options,...options};return this;
 }
 setCues(cues){
  if(!Array.isArray(cues))throw new TypeError('Titlovi moraju biti niz.');
  let previousEnd=-Infinity;
  const checked=cues.map(cue=>{
   const start=Number(cue.start),end=Number(cue.end);
   if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||start<previousEnd)throw new RangeError('Vremena titlova moraju biti uredna i bez preklapanja.');
   const tokens=Array.isArray(cue.words)?cue.words.map(word=>String(word.text||'').trim()):split(cue.text);
   if(tokens.length<1||tokens.some(word=>!word||split(word).length!==1))throw new RangeError('Titl mora sadržavati tekst.');
   let previousStart=start;
   const words=tokens.map((text,i)=>{
    const given=cue.words?.[i];
    const wordStart=given?Number(given.start):start+(end-start)/tokens.length*i;
    const wordEnd=given?Number(given.end):Math.min(end,wordStart+(end-start)/tokens.length);
    if(!Number.isFinite(wordStart)||!Number.isFinite(wordEnd)||wordStart<start||wordStart<previousStart||wordEnd<=wordStart||wordEnd>end)throw new RangeError('Vrijeme svake riječi mora biti unutar njenog titla.');
    previousStart=wordStart;return{text,start:wordStart,end:wordEnd};
   });
   previousEnd=end;return{start,end,text:tokens.join(' '),words};
  });
  this.cues=checked;this.cache.clear();return this;
 }
 layout(cue){
  const key=cue.text+'|'+this.options.style+'|'+this.options.scale;
  if(this.cache.has(key))return this.cache.get(key);
  const style=PortraitStyles[this.options.style],ctx=this.ctx,rows=[];let index=0,total=0;
  for(let r=0;r<style.rows.length;r++){if(index>=cue.words.length)break;
   const count=style.rows[r],family=style.fonts[r],upper=['slash','afterimage'].includes(this.options.style)&&family!=='text';
   const selected=cue.words.slice(index,index+count).map((word,i)=>({...word,index:index+i,label:upper?word.text.toLocaleUpperCase('bs'):word.text}));
   let size=style.sizes[r]*clamp(Number(this.options.scale)||1,.75,1.2),space=size*(family==='hand'?.18:.24);
   const maxWidth=this.options.style==='switch'?752:866;
   ctx.font=font(family,size);let widths=selected.map(word=>ctx.measureText(word.label).width),width=widths.reduce((a,b)=>a+b,0)+space*(selected.length-1);
   if(width>maxWidth){const ratio=maxWidth/width;size*=ratio;space*=ratio;ctx.font=font(family,size);widths=selected.map(word=>ctx.measureText(word.label).width);width=widths.reduce((a,b)=>a+b,0)+space*(selected.length-1);}
   const height=size*(family==='hand'?1.2:1.05),extra=this.options.style==='switch'?66:0;
   let cursor=0;selected.forEach((word,i)=>{word.x=cursor;word.width=widths[i];cursor+=widths[i]+space;});
   rows.push({words:selected,size,width,height:height+extra,family,align:style.align[r],y:total,row:r});
   total+=height+extra+style.gap;index+=count;
  }
  total-=style.gap;
  const layout={rows,total};this.cache.set(key,layout);return layout;
 }
 render(time,{background=null}={}){
  if(this.disposed)return;this.time=time;
  const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);c.save();c.scale(w/1080,h/1920);
  if(background)background(c,1080,1920,time);
  const cue=this.cues.find(cue=>time>=cue.start&&time<cue.end);this.pose={seconds:time,words:cue?.words.length||0,style:this.options.style};
  if(!cue){c.restore();return;}
  const style=PortraitStyles[this.options.style],p=style.palettes[clamp(Math.round(this.options.palette)||0,0,style.palettes.length-1)],layout=this.layout(cue);
  const position=clamp(Number(this.options.position)||58,35,70)/100;
  const y0=clamp(1920*position-layout.total/2,230,1580-layout.total);
  const fade=this.options.reducedMotion?1:clamp((cue.end-time)/.2);
  c.globalAlpha=fade;
  for(const row of layout.rows){
   const x=row.align===-1?104:row.align===1?976-row.width:(1080-row.width)/2;
   c.save();c.translate(x,y0+row.y);
   const entrance=this.progress(time,row.words[0]);
   if(this.options.style==='switch')this.drawSwitch(row,p,time,entrance);
   else if(this.options.style==='slash')this.drawSlash(row,p,time,entrance);
   else if(this.options.style==='bloom')this.drawBloom(row,p,time,entrance);
   else if(this.options.style==='afterimage')this.drawAfter(row,p,time,entrance);
   else this.drawScribble(row,p,time,entrance);
   c.restore();
  }
  c.restore();
 }
 progress(time,word){
  if(time<word.start)return 0;
  if(this.options.reducedMotion||this.options.motion===0)return 1;
  return clamp((time-word.start)/(.38+Number(this.options.motion)*.1));
 }
 text(word,row,p,time,{fill=p.ink,outline=false,depth=false,blur=false}={}){
  const c=this.ctx,q=this.progress(time,word);if(q<=0)return;
  const strength=clamp(Number(this.options.motion)||0,0,1.5),offset=(1-spring(q))*row.size*.2*strength;
  c.save();c.translate(word.x,row.size*.84+offset);c.globalAlpha*=ease(q);c.font=font(row.family,row.size);c.textBaseline='alphabetic';c.lineJoin='round';
  if(row.family==='hand'&&q<1){c.beginPath();c.rect(-12,-row.size*1.15,(word.width+24)*ease(q),row.size*1.65);c.clip();}
  if(blur&&q<.9)c.filter=`blur(${(1-q)*3*strength*this.canvas.width/1080}px)`;
  if(depth){c.fillStyle=p.dark;c.fillText(word.label,7,8);}
  c.shadowColor='#00000070';c.shadowBlur=10*this.canvas.width/1080;c.shadowOffsetY=3*this.canvas.width/1080;
  if(outline){c.lineWidth=Math.max(3,row.size*.03);c.strokeStyle=fill;c.strokeText(word.label,0,0);}
  else{if(fill!==p.dark){c.strokeStyle=p.dark+'cc';c.lineWidth=Math.max(1.5,row.size*.02);c.strokeText(word.label,0,0);}c.fillStyle=fill;c.fillText(word.label,0,0);}
  c.restore();
 }
 line(word,row,p,time,color=p.a,double=false){
  const c=this.ctx,q=ease(this.progress(time,word));if(!q)return;
  c.save();c.globalAlpha*=q;c.strokeStyle=color;c.lineWidth=5;c.lineCap='round';
  const y=row.size*.99;c.beginPath();c.moveTo(word.x,y);c.bezierCurveTo(word.x+word.width*.25,y+4,word.x+word.width*.6,y-3,word.x+word.width*q,y+1);c.stroke();
  if(double){c.lineWidth=2;c.beginPath();c.moveTo(word.x+8,y+9);c.lineTo(word.x+(word.width-8)*q,y+9);c.stroke();}c.restore();
 }
 drawSlash(row,p,time,q){
  const c=this.ctx,tilt=(row.row%2?1:-1)*.019;c.rotate(tilt);
  c.save();c.beginPath();c.rect(-32,-20,(row.width+64)*ease(q),row.height+40);c.clip();
  if(row.row===1){c.fillStyle=p.a;c.transform(1,0,-.09,1,0,0);c.fillRect(-22,-12,row.width+44,row.height+8);}
  if(row.row===3&&q>0){c.fillStyle=p.b;c.globalAlpha*=ease(q);c.fillRect(-27,5,7,row.height-8);}
  for(const word of row.words)this.text(word,row,p,time,{fill:row.row===1?p.dark:row.row===3?p.b:p.ink,depth:row.row!==1});
  c.restore();
  if(row.row===4)this.line(row.words.at(-1),row,p,time,p.a,true);
 }
 drawBloom(row,p,time,q){
  const c=this.ctx,hero=row.family==='serif';
  if(hero&&q>0){c.save();c.globalAlpha*=ease(q)*.95;c.fillStyle=row.row===1?p.b:p.a;
   c.translate(row.width/2,row.size*.58);c.rotate(row.row===1?-.025:.018);c.scale(ease(q),1);c.beginPath();c.ellipse(0,0,row.width/2+29,row.size*.55,0,0,Math.PI*2);c.fill();
   c.globalAlpha*=.14;c.strokeStyle=p.dark;c.lineWidth=1.2;for(let y=-row.size*.4;y<row.size*.4;y+=7){c.beginPath();c.moveTo(-row.width*.38,y);c.lineTo(row.width*.38,y-5);c.stroke();}c.restore();
  }
  for(const word of row.words)this.text(word,row,p,time,{fill:hero?p.dark:row.row===4?p.a:p.ink,blur:!hero});
  if(row.row===2)this.line(row.words.at(-1),row,p,time,p.b);
  if(row.row===4&&q>0){c.save();c.globalAlpha*=ease(q);c.strokeStyle=p.a;c.lineWidth=2.3;
   c.beginPath();c.moveTo(-19,row.size*.34);c.bezierCurveTo(-59,-8,-64,42,-23,48);c.bezierCurveTo(-61,78,-38,97,-18,62);c.stroke();
   c.beginPath();c.moveTo(row.width+19,row.size*.38);c.bezierCurveTo(row.width+58,0,row.width+61,56,row.width+21,49);c.bezierCurveTo(row.width+62,74,row.width+38,105,row.width+20,66);c.stroke();c.restore();}
 }
 drawSwitch(row,p,time,q){
  if(!q)return;const c=this.ctx,phase=ease(q),width=row.width+84,height=row.height;
  c.translate(-42+(row.row%2?22:-22),0);c.rotate((row.row%2?1:-1)*.018*(1+(.8*(1-phase))));
  c.save();c.translate(0,(1-phase)*50);c.scale(1,.7+.3*phase);c.globalAlpha*=phase;
  const fill=row.row%2===0?p.a:p.dark,ink=row.row%2===0?p.dark:p.ink;
  c.fillStyle='#00000045';rounded(c,7,12,width,height,22);c.fill();
  c.shadowColor='#00000060';c.shadowBlur=28*this.canvas.width/1080;c.shadowOffsetY=10*this.canvas.width/1080;c.fillStyle=fill;rounded(c,0,0,width,height,22);c.fill();c.shadowBlur=0;c.shadowOffsetY=0;
  c.strokeStyle=row.row%2===0?'#ffffff55':'#ffffff24';c.lineWidth=2;rounded(c,2,2,width-4,height-4,20);c.stroke();
  c.translate(42,29);for(const word of row.words){
   if(word.index===4||word.index===10){const a=ease(this.progress(time,word));c.save();c.globalAlpha*=a;c.fillStyle=p.b;rounded(c,word.x-7,-5,word.width+14,row.size*1.02,9);c.fill();c.restore();}
   this.text(word,row,p,time,{fill:word.index===4||word.index===10?p.dark:ink});
  }
  if(row.row===3)this.line(row.words.at(-1),row,p,time,p.b);
  c.restore();
 }
 drawAfter(row,p,time,q){
  const c=this.ctx,hero=row.family==='slash';
  if(hero&&q){c.save();c.globalAlpha*=ease(q)*.52;c.font=font(row.family,row.size);c.lineWidth=2;c.strokeStyle=p.a;
   for(const word of row.words){const a=ease(this.progress(time,word));c.globalAlpha=a*.52;c.strokeText(word.label,word.x+14,row.size*.84+13);}
   c.restore();}
  if(row.row===3&&q){c.save();c.globalAlpha*=ease(q);c.strokeStyle=p.b;c.lineWidth=3;
   const corners=[[-16,-7,1,1],[row.width+16,-7,-1,1],[-16,row.height+4,1,-1],[row.width+16,row.height+4,-1,-1]];
   for(const [x,y,dx,dy]of corners){c.beginPath();c.moveTo(x,y+dy*17);c.lineTo(x,y);c.lineTo(x+dx*17,y);c.stroke();}c.restore();}
  for(const word of row.words){const accented=word.index===4||word.index===10;this.text(word,row,p,time,{fill:accented?p.b:p.ink,outline:hero&&word.index===3,blur:row.family==='text'});}
  if(row.row===0)this.line(row.words.at(-1),row,p,time,p.a);
  if(hero&&q){c.save();c.globalAlpha*=ease(q)*.55;c.fillStyle=p.a;const sweep=clamp((time-row.words[0].start)/1.25);c.fillRect(-18+row.width*sweep,row.height+5,25,3);c.restore();}
 }
 drawScribble(row,p,time,q){
  const c=this.ctx,hand=row.family==='hand';c.rotate(hand?-.027:row.row===2?-.018:0);
  if(row.row===2&&q){c.save();c.globalAlpha*=ease(q);c.fillStyle=p.a;
   c.beginPath();c.moveTo(-25,4);c.lineTo(row.width+28,-5);c.lineTo(row.width+25,row.height+10);c.lineTo(-30,row.height+5);c.closePath();
   c.shadowColor='#00000045';c.shadowOffsetX=5*this.canvas.width/1080;c.shadowOffsetY=7*this.canvas.width/1080;c.shadowBlur=10*this.canvas.width/1080;c.fill();c.restore();
  }
  for(const word of row.words)this.text(word,row,p,time,{fill:row.row===2?p.dark:hand?p.b:p.ink,blur:!hand});
  if(hand)this.line(row.words.at(-1),row,p,time,p.b,true);
  if(row.row===4){const word=row.words.at(-1),a=ease(this.progress(time,word));if(a){c.save();c.globalAlpha*=a;c.strokeStyle=p.a;c.lineWidth=4;c.lineCap='round';
   c.beginPath();c.ellipse(word.x+word.width/2,row.size*.51,word.width*.57,row.size*.62,-.04,-.5,-.5+Math.PI*2*a);c.stroke();c.restore();}}
 }
 attachVideo(video,{background=false,onFrame=null}={}){
  this.detachVideo?.();let active=true,id=null,raf=null;
  const render=t=>{if(!active)return;this.render(t,{background:background?(ctx,w,h)=>drawPortraitVideo(ctx,video,w,h):null});onFrame?.(t);};
  const tick=(_,metadata)=>{render(metadata.mediaTime);if(active)id=video.requestVideoFrameCallback(tick);};
  const fallback=()=>{if(!active)return;render(video.currentTime);raf=requestAnimationFrame(fallback);};
  const sync=()=>render(video.currentTime);
  for(const event of ['seeked','pause','loadeddata','timeupdate'])video.addEventListener(event,sync);
  if(video.requestVideoFrameCallback)id=video.requestVideoFrameCallback(tick);else raf=requestAnimationFrame(fallback);
  this.detachVideo=()=>{active=false;if(id!==null)video.cancelVideoFrameCallback(id);if(raf!==null)cancelAnimationFrame(raf);for(const event of ['seeked','pause','loadeddata','timeupdate'])video.removeEventListener(event,sync);};
  sync();return this.detachVideo;
 }
 dispose(){this.detachVideo?.();this.disposed=true;this.cache.clear();}
}
export function drawPortraitVideo(ctx,video,width=1080,height=1920){
 if(video.readyState<2||!video.videoWidth)return;
 const factor=Math.max(width/video.videoWidth,height/video.videoHeight),w=video.videoWidth*factor,h=video.videoHeight*factor;
 ctx.drawImage(video,(width-w)/2,(height-h)/2,w,h);
}
export function drawPortraitBackdrop(ctx,width=1080,height=1920,time=0){
 const g=ctx.createLinearGradient(0,0,width,height);g.addColorStop(0,'#263332');g.addColorStop(.48,'#141b20');g.addColorStop(1,'#222124');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
 ctx.save();ctx.filter=`blur(${58*ctx.canvas.width/width}px)`;ctx.globalAlpha=.38;
 const light=ctx.createLinearGradient(0,0,width,0);light.addColorStop(0,'#dda673');light.addColorStop(1,'#778b99');ctx.fillStyle=light;
 ctx.translate(Math.sin(time*.12)*8,0);ctx.fillRect(118,-110,150,725);ctx.fillRect(708,-130,115,480);ctx.globalAlpha=.17;ctx.fillStyle='#bfdacb';ctx.fillRect(250,1530,690,350);ctx.restore();
 ctx.save();ctx.strokeStyle='#ffffff09';ctx.lineWidth=2;for(const x of [113,307,724,864]){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,490);ctx.stroke();}ctx.restore();
}
