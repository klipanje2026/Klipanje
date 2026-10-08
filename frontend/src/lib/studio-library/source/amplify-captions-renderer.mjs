import {CutCaptionRenderer} from './cut-captions-renderer.mjs';
import {CutFontMap} from './cut-captions-config.mjs';
import {AmplifyStyles} from './amplify-captions-config.mjs';

const ampClamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const ampEase=v=>1-Math.pow(1-ampClamp(v),3);
const ampFont=(family,size)=>CutFontMap[family].replace('100px',`${size}px`);
const ampTokens=text=>String(text||'').trim().split(/\s+/u).filter(Boolean);
const ampStop=new Set(['a','i','u','je','još','mi','da','se','na','za','do','iz','s','sve','taj','kad','kada','uz','koje']);

export class AmplifyCaptionRenderer extends CutCaptionRenderer{
 constructor(canvas,{style='punch',...options}={}){
  if(!AmplifyStyles[style])throw new RangeError('Nepoznat stil.');
  super(canvas,{style:'ripline',amplify:style,window:8,position:82,scale:1,texture:.85,motion:1,effects:1,depth:.85,...options});
 }
 setOptions({style,amplify,...options}){
  amplify=style||amplify||this.options.amplify;if(!AmplifyStyles[amplify])throw new RangeError('Nepoznat stil.');
  return super.setOptions({...options,style:'ripline',amplify});
 }
 setCues(cues){
  if(!Array.isArray(cues))throw new TypeError('Titlovi moraju biti niz.');let previousEnd=-Infinity;
  this.cues=cues.map(cue=>{
   const start=Number(cue.start),end=Number(cue.end);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||start<previousEnd)throw new RangeError('Vremena titlova moraju biti uredna i bez preklapanja.');
   const supplied=Array.isArray(cue.words),tokens=supplied?cue.words.map(w=>String(w.text||'').trim()):ampTokens(cue.text);
   if(tokens.length<1||tokens.some(w=>!w||ampTokens(w).length!==1))throw new RangeError('Titl mora sadržavati tekst.');
   let previousStart=start;
   const words=tokens.map((text,i)=>{const s=supplied?Number(cue.words[i].start):start+(end-start)*i/tokens.length,e=supplied?Number(cue.words[i].end):start+(end-start)*(i+1)/tokens.length;
    if(!Number.isFinite(s)||!Number.isFinite(e)||s<start||s<previousStart||e<=s||e>end)throw new RangeError('Vrijeme svake riječi mora biti unutar bloka.');previousStart=s;return{text,start:s,end:e};});
   previousEnd=end;return{start,end,words,text:tokens.join(' ')};
  });this.cache.clear();this.faces.clear();return this;
 }
 progress(time,word){
  if(time<word.start)return 0;if(this.options.reducedMotion||this.options.motion===0)return 1;
  return ampClamp((time-word.start)/(.17+.07*ampClamp(Number(this.options.motion)||0,0,1.5)));
 }
 word(word,row,p,time,settings={}){
  const q=this.progress(time,word);if(!q)return;
  const c=this.ctx,active=word.index===this.activeIndex,motion=this.options.reducedMotion?0:ampClamp(Number(this.options.motion)||0,0,1.5),kind=this.options.amplify,settle=1-ampEase(q);
  const pulse=active?Math.sin(ampClamp((time-word.start)/.45)*Math.PI):0;
  c.save();
  if(kind==='flex'){const stretch=1+Math.sin(q*Math.PI*1.5)*(1-q)*.23*motion;c.translate(word.x+word.width/2,row.size/2);c.scale(stretch,1/stretch);c.translate(-word.x-word.width/2,-row.size/2);}
  if(kind==='fold'){c.beginPath();c.moveTo(word.x-25,-25);c.lineTo(word.x-25+(word.width+75)*ampEase(q),-25);c.lineTo(word.x-60+(word.width+75)*ampEase(q),row.size*1.6);c.lineTo(word.x-60,row.size*1.6);c.closePath();c.clip();}
  const dx=kind==='riso'?(row.row%2?-1:1)*18*settle*motion:kind==='drive'?-24*settle*motion:0;
  super.word(word,row,p,time,{...settings,fill:active&&settings.fill===p.ink?p.b:settings.fill,dx:(settings.dx||0)+dx,dy:(settings.dy||0)-pulse*4*motion});c.restore();
 }
 layout(cue){
  const style=AmplifyStyles[this.options.amplify],scale=ampClamp(Number(this.options.scale)||1,.8,1.12),windowSize=Number(this.options.window)===6?6:8;
  const key=[cue.text,cue.words.map(w=>w.start+':'+w.end).join(','),this.options.amplify,windowSize,scale].join('|');if(this.cache.has(key))return this.cache.get(key);
  const groupCount=Math.ceil(cue.words.length/windowSize),minimum=Math.floor(cue.words.length/groupCount),extra=cue.words.length%groupCount,groups=[];let cursor=0;
  for(let g=0;g<groupCount;g++){
   const count=minimum+(g<extra?1:0),selected=cue.words.slice(cursor,cursor+count).map((w,i)=>({...w,index:cursor+i}));
   const first=Math.ceil(count/3),middle=Math.floor(count/3),counts=count>=6?[first,middle,count-first-middle]:[Math.floor(count/2),Math.ceil(count/2)];
   const rows=[];let index=0,total=0;
   for(let r=0;r<counts.length;r++){if(!counts[r])continue;
    const family=style.fonts[counts.length===2&&r===1?2:r],words=selected.slice(index,index+counts[r]).map(w=>({...w,label:['text','hand'].includes(family)?w.text:w.text.toLocaleUpperCase('bs')}));
    let size=style.sizes[counts.length===2&&r===1?2:r]*scale,space=size*(family==='hand'?.18:.22);this.ctx.font=ampFont(family,size);
    let widths=words.map(w=>this.ctx.measureText(w.label).width),width=widths.reduce((a,b)=>a+b,0)+space*(words.length-1);
    if(width>826){const ratio=826/width;size*=ratio;space*=ratio;this.ctx.font=ampFont(family,size);widths=words.map(w=>this.ctx.measureText(w.label).width);width=widths.reduce((a,b)=>a+b,0)+space*(words.length-1);}
    let x=0;words.forEach((w,i)=>{w.x=x;w.width=widths[i];x+=w.width+space;});
    const hero=words.reduce((best,w)=>{const clean=w.text.toLocaleLowerCase('bs').replace(/[^\p{L}]/gu,'');const score=clean.length-(ampStop.has(clean)?12:0);return score>best.score?{index:w.index,score}:best;},{index:words[0].index,score:-Infinity}).index;
    const height=size*(family==='hand'?1.18:1.08)+9;rows.push({words,family,size,width,height,y:total,row:r,hero});index+=words.length;total+=height+style.gap;
   }
   total-=style.gap;
   if(total>366){const k=366/total;for(const row of rows){row.size*=k;row.width*=k;row.height*=k;row.y*=k;for(const word of row.words){word.x*=k;word.width*=k;}}total=366;}
   const width=Math.max(...rows.map(row=>row.width));for(const row of rows)row.offset=style.align[row.row]===-1?0:style.align[row.row]===1?width-row.width:(width-row.width)/2;
   groups.push({rows,total,width,count,index:g,start:selected[0].start,end:cue.words[cursor+count]?.start??cue.end});cursor+=count;
  }
  const result={groups};this.cache.set(key,result);if(this.cache.size>80)this.cache.delete(this.cache.keys().next().value);return result;
 }
 render(time,{background=null}={}){
  if(this.disposed)return;this.time=time;const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);c.save();c.scale(w/1080,h/1920);
  if(background&&!this.options.overlayOnly)background(c,1080,1920,time);
  if(this.options.amplify==='glass'&&background&&!this.options.overlayOnly){this.glassBackdrop??=document.createElement('canvas');if(this.glassBackdrop.width!==w)this.glassBackdrop.width=w;if(this.glassBackdrop.height!==h)this.glassBackdrop.height=h;this.glassBackdrop.getContext('2d').drawImage(this.canvas,0,0);}else this.glassBackdrop=null;
  const cue=this.cues.find(cue=>time>=cue.start&&time<cue.end);this.pose={seconds:time,style:this.options.amplify,words:cue?.words.length||0,visibleWords:0,group:0};if(!cue){c.restore();return;}
  const layout=this.layout(cue),group=layout.groups.find(g=>time>=g.start&&time<g.end);if(!group){c.restore();return;}
  const style=AmplifyStyles[this.options.amplify],p=style.palettes[ampClamp(Math.round(this.options.palette)||0,0,style.palettes.length-1)],position=ampClamp(Number(this.options.position)||82,74,85),x=(1080-group.width)/2,y=ampClamp(1920*position/100-group.total/2,1244,1750-group.total);
  this.groupStart=group.start;this.groupEnter=this.progress(time,{start:group.start});
  const visible=group.rows.flatMap(row=>row.words).filter(word=>this.progress(time,word)>0),active=group.rows.flatMap(row=>row.words).filter(word=>word.start<=time).at(-1);this.activeIndex=active?.index;
  this.pose={...this.pose,visibleWords:visible.length,displayText:visible.map(word=>word.text).join(' '),activeWord:active?.text,activeIndex:active?.index,group:group.index+1,groups:layout.groups.length,bounds:{x:x-40,y:y-30,width:group.width+80,height:group.total+70}};
  c.beginPath();c.rect(66,1190,948,600);c.clip();c.globalAlpha=this.options.reducedMotion?1:ampClamp((group.end-time)/.1);
  for(const row of group.rows){row.renderX=x+row.offset;row.renderY=y+row.y;c.save();c.translate(row.renderX,row.renderY);this.drawAmplified(row,p,time,group,active);c.restore();}c.restore();
 }
 plate(x,y,w,h,p,q,{color=p.a,torn=false,slant=0,angle=0,layer=true}={}){
  if(!q)return;const c=this.ctx,phase=ampEase(q),depth=ampClamp(Number(this.options.depth)||0),detail=ampClamp(Number(this.options.texture)||0),fx=ampClamp(Number(this.options.effects)||0,0,1.4);
  c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha*=phase;
  c.beginPath();c.rect(-16,-18,(w+32)*phase,h+46);c.clip();
  const path=()=>{c.beginPath();if(torn){c.moveTo(-8,0);for(let j=-8;j<w+9;j+=13)c.lineTo(j,-4+Math.sin(j*.27)*3);c.lineTo(w+9,h);for(let j=w+9;j>-8;j-=15)c.lineTo(j,h+3+Math.sin(j*.37)*3);}else{c.moveTo(-8+slant,0);c.lineTo(w+8,0);c.lineTo(w+8-slant,h);c.lineTo(-8,h);}c.closePath();};
  if(layer&&depth){c.save();c.translate(4*depth,7*depth);path();c.fillStyle=p.dark;c.fill();c.translate(-6*depth,0);c.fillStyle=p.b;c.globalAlpha*=.75;c.fill();c.restore();}
  path();c.fillStyle=color;c.shadowColor='#00000040';c.shadowBlur=12*depth*this.canvas.width/1080;c.shadowOffsetY=5*depth*this.canvas.width/1080;c.fill();c.shadowBlur=0;c.shadowOffsetY=0;
  c.save();path();c.clip();c.globalAlpha*=detail*.7;c.fillStyle=c.createPattern(this.pattern(torn?'paper':'grid',p),'repeat');c.fillRect(-16,-12,w+32,h+24);c.restore();
  if(fx&&this.options.amplify==='relay'){c.save();c.globalAlpha*=.46*fx;c.strokeStyle=p.ink;c.lineWidth=2;c.beginPath();c.moveTo(2,5);c.lineTo(w-4,5);c.stroke();c.restore();}c.restore();
 }
 inkCurve(row,p,time,{double=false,circle=false,color=p.a}={}){
  const c=this.ctx,fx=ampClamp(Number(this.options.effects)||0,0,1.4),last=row.words.at(-1),phase=ampEase(this.progress(time,last));if(!phase||!fx)return;
  c.save();c.globalAlpha*=phase*Math.min(1,fx);c.strokeStyle=color;c.lineWidth=(circle?3.5:6)*Math.max(.5,fx);c.lineCap='round';c.lineJoin='round';
  if(circle){const hero=row.words.find(w=>w.index===row.hero);c.beginPath();c.ellipse(hero.x+hero.width/2,row.size*.5,hero.width/2+16,row.size*.62,-.02,Math.PI*.2,Math.PI*.2+Math.PI*2*phase);c.stroke();}
  else{const y=row.size*1.08;c.beginPath();c.moveTo(0,y);c.bezierCurveTo(row.width*.3,y-6,row.width*.7,y+8,row.width*phase,y-2);c.stroke();if(double){c.lineWidth=2;c.beginPath();c.moveTo(10,y+9);c.lineTo(row.width*phase-8,y+7);c.stroke();}}
  c.restore();
 }
 drawAmplified(row,p,time,group,active){
  const c=this.ctx,kind=this.options.amplify,fx=ampClamp(Number(this.options.effects)||0,0,1.4),depth=ampClamp(Number(this.options.depth)||0),entrance=this.progress(time,row.words[0]),texture=AmplifyStyles[kind].texture;
  if(['flex','riso','fold','glass','drive'].includes(kind)){this.drawFlow(row,p,time,group,active);return;}
  // Backings and trails precede all glyphs, preserving neighbouring letters.
  const shown=row.words.filter(word=>this.progress(time,word)>0),last=shown.at(-1),width=last?last.x+last.width*ampEase(this.progress(time,last)):0;
  if(kind==='punch'&&row.row===1)this.plate(0,-3,width,row.size*1.08,p,entrance,{torn:true,slant:13,color:p.a});
  if(kind==='relay'&&row.row===1)this.plate(0,-5,width,row.size*1.1,p,entrance,{slant:12,color:p.a,angle:-.007});
  if(kind==='trace'&&row.row===2)this.plate(0,-5,width,row.size*1.12,p,entrance,{slant:10,color:p.a});
  for(const word of row.words){
   const q=this.progress(time,word);if(!q)continue;const hero=word.index===row.hero,phase=ampEase(q);
   if(kind==='punch'&&hero&&row.row===2)this.plate(word.x,-2,word.width,row.size*1.08,p,q,{torn:true,color:p.b,layer:false});
   if(kind==='relay'&&hero&&row.row===2)this.plate(word.x,-4,word.width,row.size*1.13,p,q,{color:p.b,slant:5,angle:.014});
   if(kind==='double'&&(hero||row.row===1)&&depth){
    c.save();c.globalAlpha*=phase*.85;c.font=ampFont(row.family,row.size);c.fillStyle=p.b;c.fillText(word.label,word.x+7*depth,row.size*.88+7*depth);c.fillStyle=p.a;c.fillText(word.label,word.x-5*depth,row.size*.88-2*depth);c.restore();
   }
   if(kind==='wild'&&hero&&row.row===1)this.plate(word.x,-3,word.width,row.size*1.11,p,q,{torn:true,color:p.a,angle:-.009});
   if(kind==='trace'&&word.index===active?.index&&row.row!==2&&fx){
    c.save();c.globalAlpha*=phase*Math.min(1,fx);c.strokeStyle=p.b;c.lineWidth=3;const x=word.x-13,y=-5,w=word.width+26,h=row.size*1.15;for(const [cx,cy,sx,sy]of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){c.beginPath();c.moveTo(cx+sx*12,cy);c.lineTo(cx,cy);c.lineTo(cx,cy+sy*12);c.stroke();}c.restore();
   }
  }
  for(const word of row.words){
   if(!this.progress(time,word))continue;const hero=word.index===row.hero;
   const backed=kind==='punch'&&(row.row===1||row.row===2&&hero)||kind==='relay'&&(row.row===1||row.row===2&&hero)||kind==='trace'&&row.row===2||kind==='wild'&&row.row===1&&hero;
   const fill=backed?p.dark:kind==='double'&&(hero||row.row===1)?p.a:kind==='wild'&&row.row===0?p.b:kind==='relay'&&row.row===0&&hero?p.b:p.ink;
   this.word(word,row,p,time,{fill,texture:kind==='double'?hero?'halftone':null:kind==='trace'&&backed?'stripe':texture,depth:!backed&&hero?Math.round((kind==='double'?2:kind==='punch'?9:5)*depth):0,write:kind==='punch'||kind==='wild',stamp:kind==='relay',blur:kind==='double'?6:kind==='trace'?3:0,rotate:kind==='wild'&&row.row===0?-.008:0});
   if(kind==='double'&&hero&&row.row===0)this.underline(word,row,p,time,{color:p.b,weight:5,hook:true});
  }
  if(kind==='punch'&&row.row===0&&entrance&&fx){c.save();c.globalAlpha*=ampEase(entrance)*Math.min(1,fx);c.strokeStyle=p.b;c.lineWidth=4;c.beginPath();c.moveTo(-20,3);c.lineTo(-20,row.size);c.lineTo(10,row.size);c.stroke();c.restore();}
  if(kind==='punch'&&row.row===2)this.inkCurve(row,p,time,{color:p.a});
  if(kind==='relay'&&row.row===0)this.inkCurve(row,p,time,{color:p.a,double:true});
  if(kind==='double'&&row.row===2)this.inkCurve(row,p,time,{color:p.b,double:true});
  if(kind==='wild'&&row.row===0)this.inkCurve(row,p,time,{color:p.a,circle:true});
  if(kind==='wild'&&row.row===2)this.inkCurve(row,p,time,{color:p.b,double:true});
  if(kind==='trace'&&row.row===1&&entrance&&fx){
   c.save();c.globalAlpha*=ampEase(entrance)*Math.min(1,fx);c.strokeStyle=p.a;c.lineWidth=2;c.beginPath();c.moveTo(-25,3);c.lineTo(-25,row.height+5);c.lineTo(width+25,row.height+5);c.lineTo(width+25,row.height-16);c.stroke();
   const moving=!this.options.reducedMotion&&this.options.motion!==0,phase=moving?((time-group.start)*.35)%1:.5;c.fillStyle=p.b;c.fillRect(-25+(width+50)*phase-9,row.height+2,18,6);c.restore();
  }
 }
 dispose(){super.dispose();this.glassBackdrop=null;}
 drawFlow(row,p,time,group,active){
  const c=this.ctx,kind=this.options.amplify,fx=ampClamp(Number(this.options.effects)||0,0,1.4),depth=ampClamp(Number(this.options.depth)||0),detail=ampClamp(Number(this.options.texture)||0),words=row.words.filter(w=>this.progress(time,w)>0),hero=row.words.find(w=>w.index===row.hero);
  if(!words.length)return;
  const rounded=(x,y,w,h,r)=>{c.beginPath();c.roundRect(x,y,w,h,r);};
  // Each decoration arrives with its own word, including the glass and folds.
  for(const word of words){const q=this.progress(time,word),e=ampEase(q),isHero=word===hero,isActive=word.index===active?.index;
   if(kind==='flex'&&row.row===1){c.save();c.globalAlpha*=e;const x=word.x-10,y=-4,w=word.width+20,h=row.size*1.1;c.shadowColor=p.dark+'bb';c.shadowBlur=9*depth*this.canvas.width/1080;c.shadowOffsetY=5*depth*this.canvas.width/1080;rounded(x,y,w,h,9);c.fillStyle=isHero?p.b:p.a;c.fill();c.shadowBlur=0;c.shadowOffsetY=0;c.strokeStyle=p.ink+'77';c.lineWidth=1.5;c.beginPath();c.moveTo(x+10,y+6);c.lineTo(x+w-10,y+6);c.stroke();c.restore();}
   if(kind==='riso'&&(row.row===1||isHero)){c.save();c.globalAlpha*=e*.85;c.font=ampFont(row.family,row.size);c.fillStyle=p.b;c.fillText(word.label,word.x+5*depth,row.size*.88+6*depth);c.fillStyle=p.a;c.fillText(word.label,word.x-4*depth,row.size*.88-2*depth);c.restore();}
   if(kind==='riso'&&row.row===2&&isHero)this.plate(word.x,-5,word.width,row.size*1.12,p,q,{torn:true,angle:.011,color:p.b});
   if(kind==='fold'&&(isHero||row.row===2)){this.plate(word.x,-3,word.width,row.size*1.1,p,q,{color:row.row===2?p.b:p.a,slant:11});if(fx){c.save();c.globalAlpha*=e*Math.min(1,fx);const x=word.x+word.width+6;c.beginPath();c.moveTo(x-18,-3);c.lineTo(x,15);c.lineTo(x-18,15);c.closePath();c.fillStyle=p.ink+'a0';c.fill();c.strokeStyle=p.dark+'70';c.lineWidth=1;c.beginPath();c.moveTo(x-18,-3);c.lineTo(x-18,15);c.lineTo(x,15);c.stroke();c.restore();}}
   if(kind==='glass'&&(row.row===1||isHero)){c.save();const x=word.x-12,y=-7,w=word.width+24,h=row.size*1.16;c.globalAlpha*=e;rounded(x,y,w,h,13);c.clip();
    if(this.glassBackdrop){c.save();c.filter=`blur(${9*this.canvas.width/1080}px)`;c.drawImage(this.glassBackdrop,-row.renderX,-row.renderY,1080,1920);c.restore();}
    const gradient=c.createLinearGradient(x,y,x+w,y+h);gradient.addColorStop(0,p.a+'3d');gradient.addColorStop(.45,p.dark+'b0');gradient.addColorStop(1,p.b+'35');c.fillStyle=gradient;c.fillRect(x,y,w,h);c.save();c.globalAlpha*=detail*.5;c.fillStyle=c.createPattern(this.pattern('frost',p),'repeat');c.fillRect(x,y,w,h);c.restore();c.restore();
    c.save();c.globalAlpha*=e;rounded(x,y+4*depth,w,h,13);c.strokeStyle=p.dark+'aa';c.lineWidth=4*depth;c.stroke();rounded(x,y,w,h,13);c.strokeStyle=isActive?p.b:p.a+'a0';c.lineWidth=2;c.stroke();c.strokeStyle=p.ink+'ad';c.lineWidth=1;c.beginPath();c.moveTo(x+13,y+4);c.lineTo(x+w-13,y+4);c.stroke();if(fx){const bright=x+12+(w-36)*e;c.strokeStyle=p.ink;c.lineWidth=2;c.beginPath();c.moveTo(bright,y);c.lineTo(bright+12,y);c.stroke();}c.restore();
   }
   if(kind==='drive'&&row.row===2&&isHero)this.plate(word.x,-3,word.width,row.size*1.1,p,q,{color:p.a,slant:15,layer:false});
  }
  for(const word of words){const isHero=word===hero;
   const backed=kind==='flex'&&row.row===1||kind==='riso'&&row.row===2&&isHero||kind==='fold'&&(isHero||row.row===2)||kind==='drive'&&row.row===2&&isHero;
   const fill=backed?p.dark:kind==='riso'&&row.row===0?p.a:kind==='flex'&&row.row===2?p.b:kind==='glass'&&isHero&&row.row!==1?p.a:kind==='drive'&&row.row===0?p.a:p.ink;
   this.word(word,row,p,time,{fill,texture:kind==='glass'?'satin':AmplifyStyles[kind].texture,outline:kind==='drive'&&row.row===0,depth:!backed&&isHero?Math.round((kind==='fold'?7:5)*depth):0,stamp:kind==='riso',write:kind==='drive',blur:kind==='glass'?5:kind==='flex'?2:0});
   if(fx&&word.index===active?.index){this.underline(word,row,p,time,{color:kind==='flex'?p.a:p.b,weight:kind==='riso'?5:3,hook:kind==='drive',offset:kind==='glass'?5:0});}
  }
  if(kind==='flex'&&row.row===0)this.inkCurve(row,p,time,{color:p.a,double:true});
  if(kind==='riso'&&row.row===0)this.inkCurve(row,p,time,{color:p.b,double:true});
  if(kind==='fold'&&row.row===1)this.inkCurve(row,p,time,{color:p.a});
  if(kind==='glass'&&row.row===2)this.inkCurve(row,p,time,{color:p.b,double:true});
  if(kind==='drive'&&row.row===1)this.inkCurve(row,p,time,{color:p.a,double:true});
  if(fx&&this.progress(time,hero)>0&&(kind==='riso'||kind==='drive')){c.save();c.globalAlpha*=ampEase(this.progress(time,hero))*Math.min(1,fx);c.strokeStyle=p.a;c.lineWidth=kind==='riso'?3:2;const x=hero.x-17;for(let i=0;i<3;i++){c.beginPath();c.moveTo(x-i*4,2+i*8);c.lineTo(x+7-i*4,7+i*8);c.stroke();}c.restore();}
 }
}
