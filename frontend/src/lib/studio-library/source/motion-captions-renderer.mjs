import {AmplifyCaptionRenderer} from './amplify-captions-renderer.mjs';
import {MotionEffects} from './motion-captions-effects.mjs';
import {CutFontMap} from './cut-captions-config.mjs';
import {MotionStyles} from './motion-captions-config.mjs';

const maClamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const maEase=v=>1-Math.pow(1-maClamp(v),3);
const maFont=(family,size)=>CutFontMap[family].replace('100px',`${size}px`);
const maConnectors=new Set(['a','i','u','je','još','mi','da','se','na','za','do','iz','s','taj','uz','koje','pa','ali','bi','to']);

export class MotionCaptionRenderer extends AmplifyCaptionRenderer{
 constructor(canvas,{style='pass',...options}={}){
  if(!MotionStyles[style])throw new RangeError('Nepoznat stil.');
  super(canvas,{style:'punch',atlas:style,dynamics:1,...options});
 }
 setOptions({style,atlas,...options}){
  atlas=style||atlas||this.options.atlas;if(!MotionStyles[atlas])throw new RangeError('Nepoznat stil.');
  return super.setOptions({...options,amplify:'punch',atlas});
 }
 layout(cue){
  const style=MotionStyles[this.options.atlas],scale=maClamp(Number(this.options.scale)||1,.8,1.12),dynamics=maClamp(Number(this.options.dynamics)||0,.4,1.4),windowSize=Number(this.options.window)===6?6:8;
  const key=[cue.text,cue.words.map(w=>w.start+':'+w.end).join(','),this.options.atlas,windowSize,scale,dynamics].join('|');if(this.cache.has(key))return this.cache.get(key);
  const groupCount=Math.ceil(cue.words.length/windowSize),minimum=Math.floor(cue.words.length/groupCount),extra=cue.words.length%groupCount,groups=[];let cursor=0;
  for(let g=0;g<groupCount;g++){
   const count=minimum+(g<extra?1:0),entries=cue.words.slice(cursor,cursor+count).map((word,i)=>({...word,index:cursor+i,slot:i,family:style.fonts[i],weight:style.weights[i],x:0,y:0}));
   let at=0,y=0;const bands=[];
   for(const [bandIndex,bandCount]of style.bands.entries()){
    const words=entries.slice(at,at+bandCount);if(!words.length)break;at+=words.length;
    const clean=w=>w.text.toLocaleLowerCase('bs').replace(/[^\p{L}]/gu,''),major=words.reduce((a,b)=>a.weight>b.weight?a:b),meaningful=words.filter(w=>!maConnectors.has(clean(w))),candidate=meaningful.reduce((a,b)=>clean(a).length>clean(b).length?a:b,meaningful[0]||major);
    if(candidate!==major&&(maConnectors.has(clean(major))||clean(candidate).length>=clean(major).length*1.6)){[major.weight,candidate.weight]=[candidate.weight,major.weight];[major.family,candidate.family]=[candidate.family,major.family];}
    for(const word of words){if(maConnectors.has(clean(word)))word.weight=Math.min(.85,word.weight);if(words.length===1&&!maConnectors.has(clean(word)))word.weight=Math.max(1.3,word.weight);word.size=76*scale*(1+(word.weight-1)*dynamics);word.label=['text','hand'].includes(word.family)?word.text:word.text.toLocaleUpperCase('bs');this.ctx.font=maFont(word.family,word.size);const metrics=this.ctx.measureText(word.label);word.width=metrics.width;word.originOffset=Math.max(0,metrics.actualBoundingBoxAscent-word.size*.88)+3;word.height=Math.max(word.size*1.02,word.originOffset+word.size*.88+metrics.actualBoundingBoxDescent+5);word.large=word.weight>1.25;}
    const rightStack=style.stackRight.includes(bandIndex)&&words.length===3&&words[2].large,stacked=style.stack.includes(bandIndex)&&words.length===3&&words[0].large;
    let width,height;
    if(stacked){const [big,upper,lower]=words,rightWidth=Math.max(upper.width,lower.width);height=Math.max(big.height,upper.height+lower.height+8);big.x=0;big.y=(height-big.height)/2;upper.x=lower.x=big.width+22;upper.y=0;lower.y=upper.height+8;width=big.width+22+rightWidth;}
    else if(rightStack){const [upper,lower,big]=words,leftWidth=Math.max(upper.width,lower.width);height=Math.max(big.height,upper.height+lower.height+8);upper.x=lower.x=0;upper.y=0;lower.y=upper.height+8;big.x=leftWidth+22;big.y=(height-big.height)/2;width=leftWidth+22+big.width;}
    else{height=Math.max(...words.map(w=>w.height));let x=0;for(const word of words){word.x=x;word.y=height-word.height;const drift=this.options.atlas==='sun'?[0,-8,7][word.slot%3]:this.options.atlas==='pass'&&word.large?-5:0;word.y+=drift;x+=word.width+20;}width=x-20;}
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
  const cue=this.cues.find(cue=>time>=cue.start&&time<cue.end);this.pose={seconds:time,style:this.options.atlas,words:cue?.words.length||0,visibleWords:0,group:0};if(!cue){c.restore();return;}
  const group=this.layout(cue).groups.find(g=>time>=g.start&&time<g.end);if(!group){c.restore();return;}
  const style=MotionStyles[this.options.atlas],p=style.palettes[maClamp(Math.round(this.options.palette)||0,0,3)],position=maClamp(Number(this.options.position)||82,74,85),x=(1080-group.width)/2,y=maClamp(1920*position/100-group.total/2,1244,1750-group.total),visible=group.entries.filter(word=>this.progress(time,word)>0),active=group.entries.filter(word=>word.start<=time).at(-1);
  this.activeIndex=active?.index;this.pose={...this.pose,visibleWords:visible.length,displayText:visible.map(word=>word.text).join(' '),activeWord:active?.text,activeIndex:active?.index,group:group.index+1,groups:this.layout(cue).groups.length,bounds:{x:x-35,y:y-25,width:group.width+70,height:group.total+55}};
  c.beginPath();c.rect(66,1190,948,600);c.clip();c.globalAlpha=this.options.reducedMotion?1:maClamp((group.end-time)/.1);c.translate(x,y);
  this.links(group,p,time);
  // Draw only revealed words and their decorations. Later positions stay empty.
  for(const word of visible){c.save();c.translate(word.x,word.y);this.backing(word,p,time);c.restore();}
  for(const word of visible){c.save();c.translate(word.x,word.y);this.glyph(word,p,time);this.accent(word,p,time);c.restore();}
  c.restore();
 }
 pattern(kind,p){return MotionEffects.pattern.call(this,kind,p);}
 links(group,p,time){return MotionEffects.links.call(this,group,p,time);}
 backing(word,p,time){return MotionEffects.backing.call(this,word,p,time);}
 glyph(word,p,time){return MotionEffects.glyph.call(this,word,p,time);}
 accent(word,p,time){return MotionEffects.accent.call(this,word,p,time);}
}
