import {AmplifyCaptionRenderer} from './amplify-captions-renderer.mjs';
import {FormStyles,FormFontMap} from './form-captions-config.mjs';
import {FormEffects} from './form-captions-effects.mjs';
const fsClamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const fsFont=(family,size)=>FormFontMap[family].replace('100px',`${size}px`);
const fsStop=new Set(['a','i','u','je','još','mi','da','se','na','za','do','iz','s','taj','uz','koje','pa','ali','bi','to']);
const fsClean=w=>w.text.toLocaleLowerCase('bs').replace(/[^\p{L}]/gu,'');
export class FormCaptionRenderer extends AmplifyCaptionRenderer{
 constructor(canvas,{style='halo',...options}={}){if(!FormStyles[style])throw new RangeError('Nepoznat stil.');super(canvas,{style:'punch',form:style,dynamics:1,...options});}
 setOptions({style,form,...options}){form=style||form||this.options.form;if(!FormStyles[form])throw new RangeError('Nepoznat stil.');return super.setOptions({...options,amplify:'punch',form});}
 measure(word,size,family){
  word.family=family;word.size=size;word.label=['text','hand','serif','serifItalic'].includes(family)?word.text:word.text.toLocaleUpperCase('bs');word.angle=word.angle||0;
  this.ctx.font=fsFont(family,size);const m=this.ctx.measureText(word.label);word.width=m.width;word.originOffset=Math.max(0,m.actualBoundingBoxAscent-size*.88)+4;word.height=Math.max(size*1.04,word.originOffset+size*.88+m.actualBoundingBoxDescent+5);return word;
 }
 sizes(words,base,family,major=1.5){
  const dynamics=fsClamp(Number(this.options.dynamics)||0,.4,1.4),scale=fsClamp(Number(this.options.scale)||1,.8,1.12),meaningful=words.filter(w=>!fsStop.has(fsClean(w))),hero=(meaningful.length?meaningful:words).reduce((a,b)=>fsClean(a).length>fsClean(b).length?a:b);
  for(const word of words){word.large=word===hero;const weight=word.large?major:fsStop.has(fsClean(word))?.72:.95;word.weight=weight;this.measure(word,base*scale*(1+(weight-1)*dynamics),typeof family==='function'?family(word):family);}
 }
 shrink(words,k){for(const w of words){w.size*=k;w.width*=k;w.height*=k;w.originOffset*=k;}}
 row(words,maxWidth=780,gap=22){let width=words.reduce((n,w)=>n+w.width,0)+gap*(words.length-1);if(width>maxWidth){const k=maxWidth/width;this.shrink(words,k);gap*=k;width=maxWidth;}const height=Math.max(...words.map(w=>w.height));let x=0;for(const w of words){w.x=x;w.y=height-w.height+w.originOffset;x+=w.width+gap;}return{words,width,height};}
 layout(cue){
  const kind=this.options.form,windowSize=Number(this.options.window)===6?6:8,key=[cue.text,cue.words.map(w=>w.start+':'+w.end).join(','),kind,windowSize,this.options.scale,this.options.dynamics].join('|');if(this.cache.has(key))return this.cache.get(key);
  const count=Math.ceil(cue.words.length/windowSize),minimum=Math.floor(cue.words.length/count),extra=cue.words.length%count,groups=[];let cursor=0;
  for(let g=0;g<count;g++){
   const n=minimum+(g<extra?1:0),entries=cue.words.slice(cursor,cursor+n).map((w,i)=>({...w,index:cursor+i,slot:i,x:0,y:0,angle:0}));
   const group={entries,rows:[],count:n,index:g,start:entries[0].start,end:cue.words[cursor+n]?.start??cue.end};
   this['layout'+kind[0].toUpperCase()+kind.slice(1)](group);this.normalize(group);groups.push(group);cursor+=n;
  }
  const result={groups};this.cache.set(key,result);if(this.cache.size>80)this.cache.delete(this.cache.keys().next().value);return result;
 }
 layoutHalo(group){
  const first=Math.ceil(group.count/2),parts=[group.entries.slice(0,first),group.entries.slice(first)];let y=0;
  for(const [i,words]of parts.entries()){if(!words.length)continue;
   this.sizes(words,78,w=>w.large?'text':'text',1.42);const row=this.row(words,810,24);
   for(const w of words){const t=(w.x+w.width/2)/row.width-.5;w.y+=y+46*t*t*(i?-1:1)+(i?6:0);w.angle=t*(i?-.17:.17);w.band=i;}
   row.y=y;row.index=i;group.rows.push(row);y+=row.height+32;
  }
  group.arc=true;
 }
 layoutTalk(group){
  const counts=group.count===8?[3,2,3]:group.count===7?[2,2,3]:[2,2,2];let at=0,y=0;
  for(const [i,n]of counts.entries()){
   const words=group.entries.slice(at,at+n);if(!words.length)break;at+=words.length;this.sizes(words,70,'text',i===1?1.45:1.25);const row=this.row(words,690,24),offset=[0,96,32][i];
   for(const w of words){w.x+=offset+25;w.y+=y+13;w.band=i;}
   Object.assign(row,{x:offset,y,width:row.width+50,height:row.height+32,index:i});group.rows.push(row);y+=row.height+24;
  }
 }
 layoutFold(group){
  const split=Math.ceil(group.count/2),parts=[group.entries.slice(0,split),group.entries.slice(split)];
  for(const [col,words]of parts.entries()){if(!words.length)continue;
   this.sizes(words,col?82:69,w=>col?(w.large?'tall':'text'):(w.large?'serifItalic':'serif'),col?1.75:1.38);let y=0;
   for(const word of words){if(word.width>346)this.shrink([word],346/word.width);word.x=col?444:22;word.y=y+word.originOffset+12;word.band=col;y+=word.height+15;}
   group.rows.push({words,x:col?422:0,y:0,width:392,height:y+5,index:col});
  }
  group.columns=true;
 }
 layoutChain(group){
  let y=0;for(let i=0;i<Math.ceil(group.count/2);i++){
   const words=group.entries.slice(i*2,i*2+2);this.sizes(words,64,w=>w.large?'saira':'text',1.66);const row=this.row(words,620,27),offset=[65,170,30,125][i];
   for(const w of words){w.x+=offset;w.y+=y+4;w.band=i;}
   Object.assign(row,{x:offset,y,width:row.width,height:row.height+10,index:i});group.rows.push(row);y+=row.height+19;
  }
 }
 layoutSketch(group){
  const counts=group.count===8?[3,3,2]:group.count===7?[2,3,2]:[2,2,2];let at=0,y=0;
  for(const [i,n]of counts.entries()){
   const words=group.entries.slice(at,at+n);if(!words.length)break;at+=words.length;this.sizes(words,92,'hand',1.47);const row=this.row(words,725,38),offset=[0,70,27][i];
   for(const [j,w]of words.entries()){w.x+=offset;w.y+=y;w.angle=[-.045,.03,-.025][(j+i)%3];w.band=i;}
   Object.assign(row,{x:offset,y,index:i});group.rows.push(row);y+=row.height+30;
  }
 }
 wordBounds(word){
  const c=Math.cos(word.angle),s=Math.sin(word.angle),cx=word.width/2,cy=word.size*.5;
  const points=[[-4,-word.originOffset],[word.width+4,-word.originOffset],[word.width+4,word.height-word.originOffset],[-4,word.height-word.originOffset]].map(([x,y])=>({x:word.x+cx+(x-cx)*c-(y-cy)*s,y:word.y+cy+(x-cx)*s+(y-cy)*c}));
  const left=Math.min(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y));return{x:left,y:top,w:Math.max(...points.map(p=>p.x))-left,h:Math.max(...points.map(p=>p.y))-top};
 }
 normalize(group){
  const boxes=group.entries.map(w=>this.wordBounds(w)),minX=Math.min(0,...boxes.map(b=>b.x)),minY=Math.min(0,...boxes.map(b=>b.y)),maxX=Math.max(...boxes.map(b=>b.x+b.w),...group.rows.map(r=>(r.x||0)+r.width)),maxY=Math.max(...boxes.map(b=>b.y+b.h),...group.rows.map(r=>r.y+r.height)),width=maxX-minX,total=maxY-minY,k=Math.min(1,832/width,406/total);
  for(const word of group.entries){word.x=(word.x-minX)*k;word.y=(word.y-minY)*k;this.shrink([word],k);}
  for(const row of group.rows){row.x=((row.x||0)-minX)*k;row.y=(row.y-minY)*k;row.width*=k;row.height*=k;}
  group.width=width*k;group.total=total*k;group.factor=k;
 }
 render(time,{background=null}={}){
  if(this.disposed)return;this.time=time;const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);c.save();c.scale(w/1080,h/1920);if(background&&!this.options.overlayOnly)background(c,1080,1920,time);
  const cue=this.cues.find(cue=>time>=cue.start&&time<cue.end);this.pose={seconds:time,style:this.options.form,words:cue?.words.length||0,visibleWords:0,group:0};if(!cue){c.restore();return;}
  const group=this.layout(cue).groups.find(g=>time>=g.start&&time<g.end);if(!group){c.restore();return;}
  const config=FormStyles[this.options.form],p=config.palettes[fsClamp(Math.round(this.options.palette)||0,0,config.palettes.length-1)],position=fsClamp(Number(this.options.position)||82,74,85),x=(1080-group.width)/2,y=fsClamp(1920*position/100-group.total/2,1246,1750-group.total),visible=group.entries.filter(w=>this.progress(time,w)>0),active=group.entries.filter(w=>w.start<=time).at(-1);
  this.activeIndex=active?.index;this.pose={...this.pose,concept:config.concept,visibleWords:visible.length,displayText:visible.map(w=>w.text).join(' '),activeWord:active?.text,activeIndex:active?.index,group:group.index+1,groups:this.layout(cue).groups.length,bounds:{x:x-40,y:y-36,width:group.width+80,height:group.total+74}};
  c.beginPath();c.rect(66,1190,948,600);c.clip();c.globalAlpha=this.options.reducedMotion?1:fsClamp((group.end-time)/.1);c.translate(x,y);FormEffects.scene.call(this,group,p,time);
  for(const word of visible){c.save();c.translate(word.x+word.width/2,word.y+word.size*.5);c.rotate(word.angle);c.translate(-word.width/2,-word.size*.5);FormEffects.backing.call(this,word,p,time);FormEffects.glyph.call(this,word,p,time);FormEffects.accent.call(this,word,p,time);c.restore();}c.restore();
 }
 pattern(kind,p){return super.pattern(kind,p);}
 formFace(word,p,fill,texture){
  const detail=fsClamp(Number(this.options.texture)||0),key=[word.label,word.family,word.size.toFixed(3),fill,texture,p.a,p.b,p.dark,p.ink,detail].join('|');if(this.faces.has(key))return this.faces.get(key);
  const image=document.createElement('canvas'),pad=30;image.width=Math.ceil(word.width+pad*2);image.height=Math.ceil(word.size*1.6+pad*2);const c=image.getContext('2d');c.font=fsFont(word.family,word.size);c.fillStyle=fill;c.fillText(word.label,pad,pad+word.size*.88);
  if(texture&&detail){c.globalCompositeOperation='source-atop';c.globalAlpha=detail*.7;c.fillStyle=c.createPattern(this.pattern(texture,p),'repeat');c.fillRect(0,0,image.width,image.height);}const face={image,pad};this.faces.set(key,face);if(this.faces.size>380)this.faces.delete(this.faces.keys().next().value);return face;
 }
}
