import {studioFontPixels} from '../text-layout.mjs';
import { BusinessStyles } from './business-stack-config.mjs';
import { loadBusinessFonts } from './business-stack-font.mjs';
import { BusinessEffects, BusinessSignatures, businessMotion } from './business-stack-effects.mjs';
const bsClamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const bsSmooth=(a,b,n)=>{const t=bsClamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};
const bsKeywordRoles=[[/^(biznis|rezultat|kvalitet|tim)/i,'bold'],[/^(strategij|dosljed)/i,'accent'],[/^(odluk|detalj)/i,'underline'],[/^(povjeren|vrijednost|cilj)/i,'mark']];
const bsConnectors=/^(i|a|u|s|sa|iz|za|na|od|do|se|su|je|kroz|koji|koja|koje|da|kao|ali|ili|prema|kada|što)[,.;:!?]?$/i;
const bsWordScale=[.96,1.04,.99,1.07,.97,1.02];
const bsTint=(from,to,progress)=>{if(progress>=1)return to;const a=parseInt(from.slice(1),16),b=parseInt(to.slice(1),16);return `rgb(${[16,8,0].map(shift=>Math.round(((a>>shift)&255)*(1-progress)+((b>>shift)&255)*progress)).join(',')})`;};
export class BusinessStackRenderer{
 constructor(canvas,options={}){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');if(!this.ctx)throw new Error('Canvas 2D nije dostupan.');
  this.options={style:'boardroom',palette:'navy',maxWords:32,speed:1,blur:1,motion:1,effect:'signature',textSize:1,position:.74,density:'balanced',emphasis:'auto',...options};
  this.cues=[];this.pages=[];this.layoutCache=new Map();this.disposed=false;this.pose=null;this.detach=null;this.maskLayer=document.createElement('canvas');this.maskContext=this.maskLayer.getContext('2d');
  this.setOptions(this.options);this.fontReady=loadBusinessFonts().then(()=>{this.layoutCache.clear();return this;});this.resize(options.width,options.height);
 }
 ready(){return this.fontReady;}
 resize(width,height){
  const bounds=this.canvas.getBoundingClientRect(),ratio=Math.min(globalThis.devicePixelRatio||1,2),w=Math.max(1,Math.round(width||bounds.width*ratio||960)),h=Math.max(1,Math.round(height||bounds.height*ratio||w*10/16));
  if(this.canvas.width===w&&this.canvas.height===h)return;this.canvas.width=w;this.canvas.height=h;this.layoutCache.clear();
 }
 setOptions(options){
  const old=this.options;this.options={...old,...options};if(!Object.hasOwn(BusinessStyles,this.options.style))this.options.style='boardroom';const config=BusinessStyles[this.options.style];if(!Object.hasOwn(config.palettes,this.options.palette))this.options.palette=Object.keys(config.palettes)[0];
  for(const [key,a,b]of [['maxWords',16,48],['speed',.6,1.6],['blur',0,1.6],['motion',0,1.4],['textSize',.75,1.3],['position',.25,.9]]){const n=Number(this.options[key]);this.options[key]=Number.isFinite(n)?bsClamp(n,a,b):old[key];}this.options.maxWords=Math.round(this.options.maxWords);
  if(!['balanced','compact','airy'].includes(this.options.density))this.options.density='balanced';if(!['auto','color','none'].includes(this.options.emphasis))this.options.emphasis='auto';
  if(this.options.effect!=='signature'&&!Object.hasOwn(BusinessEffects,this.options.effect))this.options.effect='signature';
  this.layoutCache.clear();if(old.maxWords!==this.options.maxWords||old.speed!==this.options.speed)this.buildPages();
 }
 setCues(cues){
  const clean=cues.map(c=>({start:Number(c.start),end:Number(c.end),text:String(c.text??'').trim(),words:c.words?.map(w=>({...w,start:Number(w.start),end:Number(w.end),text:String(w.text??'')}))})).sort((a,b)=>a.start-b.start);
  clean.forEach((c,i)=>{if(!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end<=c.start)throw new Error('Titl mora imati početak i kraj u sekundama.');if(i&&c.start<clean[i-1].end)throw new Error('Titlovi se ne smiju preklapati.');let previous=c.start;if(c.words)for(const w of c.words){if(!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<previous||w.end<=w.start||w.end>c.end)throw new Error('Vremena riječi moraju biti poredana i unutar titla.');previous=w.end;}});
  this.cues=clean;this.buildPages();this.layoutCache.clear();
 }
 buildPages(){
  this.pages=[];const max=Math.round(this.options.maxWords);
  this.cues.forEach((cue,cueIndex)=>{
   let words=cue.words;
   if(!words){const texts=cue.text.split(/\s+/).filter(Boolean),weights=texts.map(t=>Math.pow(t.length,.25)),sum=weights.reduce((a,b)=>a+b,0);const window=Math.min((cue.end-cue.start)*.90,(cue.end-cue.start)*.72/this.options.speed);let cursor=cue.start;
    words=texts.map((text,i)=>{const start=cursor;cursor+=weights[i]/sum*window;return {text,start,end:i===texts.length-1?cue.end:cursor};});
   }
   for(let i=0;i<words.length;i+=max){const block=words.slice(i,i+max);this.pages.push({cueIndex,pageIndex:Math.floor(i/max),start:i?block[0].start:cue.start,end:words[i+max]?.start??cue.end,words:block,text:block.map(w=>w.text).join(' '),globalIndex:i});}
  });this.layoutCache.clear();
 }
 locate(seconds){const index=this.pages.findIndex(p=>seconds>=p.start&&seconds<p.end);return index<0?null:{...this.pages[index],index};}
 appearance(word,index,row,config){
  let role=word.kind||config.roles[index%config.roles.length];
  if(!word.kind){if(bsConnectors.test(word.text))role='regular';else for(const [pattern,emphasis]of bsKeywordRoles)if(pattern.test(word.text)){role=emphasis;break;}}
  if(!['regular','bold','accent','underline','mark'].includes(role))role='regular';
  if(this.options.emphasis==='none')role='regular';else if(this.options.emphasis==='color'&&role!=='regular')role='accent';
  let family='BusinessSans',weight=role==='bold'?800:config.weight;
  if(this.options.style==='editorial'&&['bold','accent'].includes(role)){family='BusinessSerif';weight=400;}
  if(this.options.style==='ledger'&&index===0&&this.options.emphasis==='auto'){role='bold';weight=800;}
  const scale=Number.isFinite(word.scale)?bsClamp(word.scale,.8,1.25):bsWordScale[index%bsWordScale.length]*(role==='bold'?1.08:role==='accent'?1.04:1);
  return {role,family,weight,scale};
 }
 layout(page){
  const key=page.index;if(this.layoutCache.has(key))return this.layoutCache.get(key);const {width:w,height:h}=this.canvas,ctx=this.ctx,config=BusinessStyles[this.options.style];
  const maxWidth=w*.84,density=this.options.density==='compact'?.88:this.options.density==='airy'?1.07:1;
  let base=studioFontPixels(this.options,w)*this.options.textSize*density;
  let rows=[];
  for(let attempt=0;attempt<8;attempt++){
   rows=[];let row={words:[],width:0,ascent:0,descent:0,index:0};
   const next=()=>{if(row.words.length)rows.push(row);row={words:[],width:0,ascent:0,descent:0,index:rows.length};};
   page.words.forEach((word,index)=>{
    let rowIndex=row.index,style=this.appearance(word,index,rowIndex,config),size=base*config.scales[rowIndex%config.scales.length]*style.scale;
    ctx.font=`${style.weight} ${size}px ${style.family}`;let metrics=ctx.measureText(word.text),padding=style.role==='mark'?size*.19:0,width=metrics.width+padding*2,space=size*.25,limit=maxWidth*config.widths[rowIndex%config.widths.length];
    if(row.words.length&&(row.words.length>=4||row.width+space+width>limit)){next();rowIndex=row.index;style=this.appearance(word,index,rowIndex,config);size=base*config.scales[rowIndex%config.scales.length]*style.scale;ctx.font=`${style.weight} ${size}px ${style.family}`;metrics=ctx.measureText(word.text);padding=style.role==='mark'?size*.19:0;width=metrics.width+padding*2;space=size*.25;limit=maxWidth*config.widths[rowIndex%config.widths.length];}
    if(width>limit){size*=limit/width;ctx.font=`${style.weight} ${size}px ${style.family}`;metrics=ctx.measureText(word.text);padding=style.role==='mark'?size*.19:0;width=metrics.width+padding*2;}
    const x=row.width+(row.words.length?space:0),ascent=metrics.actualBoundingBoxAscent||size*.77,descent=metrics.actualBoundingBoxDescent||size*.2;
    row.words.push({...word,...style,size,width,padding,x,index});row.width=x+width;row.ascent=Math.max(row.ascent,ascent+size*.16);row.descent=Math.max(row.descent,descent+size*.22);
   });next();
   // Keep the last line a phrase instead of leaving one isolated word.
   const rebuildRow=(items,rowIndex)=>{const r={words:[],width:0,ascent:0,descent:0,index:rowIndex};for(const item of items){const style=this.appearance(item,item.index,rowIndex,config),size=base*config.scales[rowIndex%config.scales.length]*style.scale;ctx.font=`${style.weight} ${size}px ${style.family}`;const metrics=ctx.measureText(item.text),padding=style.role==='mark'?size*.19:0,width=metrics.width+padding*2,x=r.width+(r.words.length?size*.25:0);r.words.push({...item,...style,size,width,padding,x});r.width=x+width;r.ascent=Math.max(r.ascent,(metrics.actualBoundingBoxAscent||size*.77)+size*.16);r.descent=Math.max(r.descent,(metrics.actualBoundingBoxDescent||size*.2)+size*.22);}return r;};
   if(rows.length>1&&page.words.length>12){const last=rows.at(-1),previous=rows.at(-2),take=3-last.words.length;if(take>0&&previous.words.length-take>=2){const tail=rebuildRow([...previous.words.slice(-take),...last.words],last.index),head=rebuildRow(previous.words.slice(0,-take),previous.index);if(tail.width<=maxWidth*config.widths[last.index%config.widths.length]){rows[rows.length-2]=head;rows[rows.length-1]=tail;}}}
   const height=rows.reduce((sum,r)=>sum+r.ascent+r.descent,0)+Math.max(0,rows.length-1)*base*config.gap;
   const tooWide=rows.some(r=>r.width+Math.abs(config.indents[r.index%config.indents.length])*maxWidth>maxWidth);
   if(height<=h*.75&&!tooWide)break;base*=Math.min(.94,h*.73/height);
  }
  const height=rows.reduce((sum,r)=>sum+r.ascent+r.descent,0)+Math.max(0,rows.length-1)*base*config.gap;
  const centerX=w/2,left=w*.08,top=-height/2;let y=top;const words=[];
  rows.forEach(row=>{const indent=config.indents[row.index%config.indents.length]*maxWidth,rx=config.align==='center'?centerX-row.width/2+indent:left+indent;const baseline=y+row.ascent;row.x=rx;row.y=baseline;row.height=row.ascent+row.descent;row.words.forEach(word=>words.push({...word,x:rx+word.x,baseline,row:row.index}));y+=row.height+base*config.gap;});
  const result={words,rows,height,width:maxWidth,base,minFont:Math.min(...words.map(w=>w.size))};this.layoutCache.set(key,result);return result;
 }
 stage(palette){const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;ctx.fillStyle=palette.bg;ctx.fillRect(0,0,w,h);const grad=ctx.createRadialGradient(w*.78,h*.18,0,w*.65,h*.24,w*.75);grad.addColorStop(0,palette.accent+'0d');grad.addColorStop(1,palette.accent+'00');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);}
 drawSource(source){const sw=source?.videoWidth||source?.naturalWidth||source?.displayWidth||source?.width,sh=source?.videoHeight||source?.naturalHeight||source?.displayHeight||source?.height;if(!sw||!sh)throw new Error('Za kompozit je potreban dekodiran video kadar.');const w=this.canvas.width,h=this.canvas.height,s=Math.max(w/sw,h/sh);this.ctx.drawImage(source,(w-sw*s)/2,(h-sh*s)/2,sw*s,sh*s);}
 drawAnimatedText(word,motion,color){
  const ctx=this.ctx,glyphs=Array.from(word.text),expanded=Math.max(0,glyphs.length-1)*motion.tracking;
  if(motion.settled){ctx.font=`${word.weight} ${word.size}px ${word.family}`;if('letterSpacing' in ctx)ctx.letterSpacing='0px';ctx.fillStyle=color;ctx.fillText(word.text,word.padding,0);return;}
  const pad=Math.ceil(word.size*.60+expanded/2),lw=Math.ceil(word.width+expanded+pad*2),lh=Math.ceil(word.size*1.7+pad*2),layer=this.maskLayer,lc=this.maskContext;
  if(layer.width<lw)layer.width=lw;if(layer.height<lh)layer.height=lh;lc.resetTransform();lc.clearRect(0,0,layer.width,layer.height);lc.globalAlpha=1;lc.globalCompositeOperation='source-over';lc.filter=motion.blur>.03?`blur(${motion.blur.toFixed(3)}px)`:'none';lc.font=`${motion.weight} ${word.size}px ${word.family}`;lc.textBaseline='alphabetic';lc.fillStyle=color;
  const finalWidth=word.width-word.padding*2,currentWidth=lc.measureText(word.text).width,weightScale=currentWidth>0?finalWidth/currentWidth:1,baseline=pad+word.size,textX=pad+word.padding-expanded/2;
  lc.save();lc.translate(textX,baseline);lc.scale(weightScale,1);
  if('letterSpacing' in lc){lc.letterSpacing=`${motion.tracking/weightScale}px`;lc.fillText(word.text,0,0);lc.letterSpacing='0px';}
  else{let prefix='';for(let i=0;i<glyphs.length;i++){lc.fillText(glyphs[i],lc.measureText(prefix).width+i*motion.tracking/weightScale,0);prefix+=glyphs[i];}}
  lc.restore();lc.filter='none';lc.globalCompositeOperation='destination-in';
  // Feathered masks are applied to an isolated RGBA text layer, never to the video.
  if(motion.reveal<1&&motion.mask!=='none'){
   const horizontal=motion.mask==='left',feather=word.size*.14,edge=horizontal?pad-expanded/2-feather*2+(word.width+expanded+feather*4)*motion.reveal:baseline+word.size*.42-word.size*1.70*motion.reveal;
   const gradient=horizontal?lc.createLinearGradient(edge-feather,0,edge+feather,0):lc.createLinearGradient(0,edge-feather,0,edge+feather);gradient.addColorStop(0,`rgba(255,255,255,${horizontal?1:0})`);gradient.addColorStop(1,`rgba(255,255,255,${horizontal?0:1})`);lc.fillStyle=gradient;lc.fillRect(0,0,layer.width,layer.height);
  }
  if(motion.stagger>0){
   const left=pad+word.padding-expanded/2,span=Math.max(1,finalWidth+expanded),gradient=lc.createLinearGradient(left,0,left+span,0);for(let i=0;i<Math.max(2,glyphs.length);i++){const p=i/(Math.max(2,glyphs.length)-1),alpha=bsSmooth(motion.stagger*p,motion.stagger*p+motion.duration*.55,motion.age);gradient.addColorStop(p,`rgba(255,255,255,${alpha})`);}lc.fillStyle=gradient;lc.fillRect(0,0,layer.width,layer.height);
  }
  lc.globalCompositeOperation='source-over';ctx.drawImage(layer,0,0,lw,lh,-pad,-baseline,lw,lh);
 }
 render(seconds,{mode='stage',source,reducedMotion=false}={}){
  if(this.disposed)throw new Error('Renderer je zatvoren.');if(!Number.isFinite(seconds))throw new Error('Vrijeme mora biti konačan broj u sekundama.');
  const ctx=this.ctx,{width:w,height:h}=this.canvas,config=BusinessStyles[this.options.style],palette=config.palettes[this.options.palette]||Object.values(config.palettes)[0];
  ctx.resetTransform();ctx.globalAlpha=1;ctx.filter='none';ctx.clearRect(0,0,w,h);if(mode==='stage')this.stage(palette);else if(mode==='composite')this.drawSource(source);
  const page=this.locate(seconds);if(!page){this.pose={seconds,page:null,visible:0,words:[],mode};return this.pose;}
  const layout=this.layout(page),centerY=mode==='stage'?h*.50:bsClamp(h*this.options.position,layout.height/2+h*.04,h-layout.height/2-h*.05),animated=!reducedMotion&&this.options.motion>0,out=animated?bsSmooth(0,.30,page.end-seconds):1,effect=this.options.effect==='signature'?BusinessSignatures[this.options.style]:this.options.effect;
  const poses=[];let visible=0;
  if(config.align==='ledger'){
   ctx.save();ctx.translate(0,centerY);ctx.lineWidth=Math.max(w/960,.7);ctx.strokeStyle=palette.muted;
   layout.rows.forEach(row=>{const age=seconds-(row.words[0]?.start??page.start);if(age<0)return;const progress=animated?bsSmooth(0,.72,age):1;ctx.globalAlpha=.14*out*progress;ctx.beginPath();ctx.moveTo(row.x,row.y+row.descent+layout.base*.08);ctx.lineTo(row.x+layout.width*progress,row.y+row.descent+layout.base*.08);ctx.stroke();});ctx.restore();
  }
  for(const word of layout.words){
   if(seconds<word.start){poses.push({...word,alpha:0,blur:0,y:centerY+word.baseline});continue;}
   const age=seconds-word.start,motion=businessMotion(age,word,effect,this.options.motion,reducedMotion),alpha=motion.alpha*out;motion.blur*=this.options.blur;if(alpha<=0){poses.push({...word,...motion,alpha,blur:0,y:centerY+word.baseline});continue;}visible++;
   const x=word.x+motion.dx,y=centerY+word.baseline+motion.dy;ctx.save();ctx.globalAlpha=alpha;ctx.filter='none';ctx.textAlign='left';ctx.textBaseline='alphabetic';
   ctx.translate(x+word.width/2,y-word.size*.35);ctx.transform(motion.scale,0,motion.skew,motion.scale,0,0);ctx.translate(-word.width/2,word.size*.35);
   const depth=motion.effect==='depth'?(1-motion.progress)*.12*this.options.motion:0;if(mode!=='stage'||depth){ctx.shadowColor=`rgba(0,0,0,${(mode!=='stage'?.20:0)+depth})`;ctx.shadowBlur=word.size*(.055+depth*.15);ctx.shadowOffsetY=word.size*(.025+depth*.45);}
   let color;
   if(word.role==='mark'){
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.fillStyle=palette.mark;const markY=-word.size*.84,markH=word.size*1.12,markW=word.width*motion.markProgress,markX=motion.marker==='center'?(word.width-markW)/2:0;ctx.beginPath();ctx.roundRect(markX,markY,markW,markH,word.size*(this.options.style==='pivot'?.13:.07));ctx.fill();
    if(motion.marker==='sweep'&&motion.markProgress<1&&markW>0){ctx.save();ctx.globalAlpha*=.20*(1-motion.markProgress);ctx.fillStyle=palette.markText;ctx.fillRect(Math.max(0,markW-word.size*.06),markY,Math.min(markW,word.size*.06),markH);ctx.restore();}color=palette.markText;
   }else color=word.role==='accent'||word.role==='underline'?bsTint(palette.text,palette.accent,motion.progress):palette.text;
   this.drawAnimatedText(word,motion,color);
   if(word.role==='underline'){ctx.shadowBlur=0;ctx.strokeStyle=palette.accent;ctx.lineWidth=word.size*(this.options.style==='editorial'?.04:.055);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,word.size*.16);ctx.lineTo(word.width*motion.lineProgress,word.size*.16);ctx.stroke();}
   ctx.restore();poses.push({...word,...motion,alpha,x,y});
  }
  this.pose={seconds,page,visible,total:layout.words.length,words:poses,rows:layout.rows,height:layout.height,minFont:layout.minFont,centerY,mode,effect};return this.pose;
 }
 attachVideo(video,{mode='overlay',reducedMotion=false,onFrame=()=>{}}={}){
  this.detachVideo();let stopped=false,handle=0;const hasRVFC=typeof video.requestVideoFrameCallback==='function';const draw=seconds=>{if(stopped||video.readyState<2)return;onFrame(this.render(seconds,{mode,source:video,reducedMotion}));};
  const schedule=()=>{if(stopped||handle)return;handle=hasRVFC?video.requestVideoFrameCallback(loop):requestAnimationFrame(loop);};const loop=(now,metadata)=>{handle=0;if(stopped)return;draw(metadata?.mediaTime??video.currentTime);if(!video.paused&&!video.ended)schedule();};
  const refresh=()=>draw(video.currentTime),play=()=>schedule(),pause=()=>{if(handle){hasRVFC?video.cancelVideoFrameCallback(handle):cancelAnimationFrame(handle);handle=0;}refresh();};
  for(const event of ['loadeddata','seeked','timeupdate'])video.addEventListener(event,refresh);video.addEventListener('play',play);video.addEventListener('pause',pause);video.addEventListener('ended',pause);
  this.detach=()=>{stopped=true;if(handle)hasRVFC?video.cancelVideoFrameCallback(handle):cancelAnimationFrame(handle);for(const event of ['loadeddata','seeked','timeupdate'])video.removeEventListener(event,refresh);video.removeEventListener('play',play);video.removeEventListener('pause',pause);video.removeEventListener('ended',pause);};refresh();if(!video.paused)schedule();return ()=>this.detachVideo();
 }
 detachVideo(){this.detach?.();this.detach=null;}
 dispose(){this.detachVideo();this.layoutCache.clear();this.maskLayer.width=1;this.maskLayer.height=1;this.disposed=true;}
}
