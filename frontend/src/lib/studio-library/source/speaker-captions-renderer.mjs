import {CutCaptionRenderer} from './cut-captions-renderer.mjs';
import {CutFontMap} from './cut-captions-config.mjs';
import {SpeakerStyles} from './speaker-captions-config.mjs';

const scClamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const scEase=v=>1-Math.pow(1-scClamp(v),3);
const scFont=(family,size)=>CutFontMap[family].replace('100px',`${size}px`);
const scStop=new Set(['a','i','u','je','još','mi','da','se','na','za','do','iz','s','sve','svoju','taj','kad','kada']);

export class SpeakerCaptionRenderer extends CutCaptionRenderer{
 constructor(canvas,{style='cutline',...options}={}){
  if(!SpeakerStyles[style])throw new RangeError('Nepoznat stil.');
  super(canvas,{style:'ripline',compact:style,position:83,scale:1,texture:.65,motion:1,...options});
 }
 setOptions({style,compact,...options}){
  compact=style||compact||this.options.compact;if(!SpeakerStyles[compact])throw new RangeError('Nepoznat stil.');
  return super.setOptions({...options,style:'ripline',compact});
 }
 setCues(cues){
  // Demo timing spans the whole block; supplied ASR word times stay unchanged.
  if(!Array.isArray(cues))throw new TypeError('Titlovi moraju biti niz.');
  const timed=cues.map(cue=>cue.words?cue:{...cue,words:String(cue.text||'').trim().split(/\s+/u).filter(Boolean).map((text,i)=>({text,start:Number(cue.start)+(Number(cue.end)-Number(cue.start))*i/12,end:Number(cue.start)+(Number(cue.end)-Number(cue.start))*(i+1)/12}))});
  return super.setCues(timed);
 }
 progress(time,word){
  if(time<word.start)return 0;if(this.options.reducedMotion||this.options.motion===0)return 1;
  return scClamp((time-word.start)/(.14+.04*scClamp(Number(this.options.motion)||0,0,1.5)));
 }
 layout(cue){
  const style=SpeakerStyles[this.options.compact],scale=scClamp(Number(this.options.scale)||1,.8,1.15),key=[cue.text,cue.words.map(w=>w.start+':'+w.end).join(','),this.options.compact,scale].join('|');
  if(this.cache.has(key))return this.cache.get(key);
  const groups=[];let cursor=0;
  for(const [groupIndex,count] of style.groups.entries()){if(cursor>=cue.words.length)break;
   const chosen=cue.words.slice(cursor,cursor+count).map((w,i)=>({...w,index:cursor+i}));
   const hero=chosen.reduce((best,w)=>{const clean=w.text.toLocaleLowerCase('bs').replace(/[^\p{L}]/gu,'');const score=(scStop.has(clean)?-8:0)+clean.length;return score>best.score?{index:w.index,score}:best;},{index:chosen[0].index,score:-Infinity}).index;
   const rows=[];let index=0,total=0;
   for(const [r,n] of style.rows.entries()){if(index>=chosen.length)break;
    const family=style.fonts[r],words=chosen.slice(index,index+n).map(w=>({...w,label:['text','hand'].includes(family)?w.text:w.text.toLocaleUpperCase('bs')}));
    let size=style.sizes[r]*scale,space=size*(family==='hand'?.2:.22);this.ctx.font=scFont(family,size);
    let widths=words.map(w=>this.ctx.measureText(w.label).width),width=widths.reduce((a,b)=>a+b,0)+space*(words.length-1);
    if(width>816){const ratio=816/width;size*=ratio;space*=ratio;this.ctx.font=scFont(family,size);widths=words.map(w=>this.ctx.measureText(w.label).width);width=widths.reduce((a,b)=>a+b,0)+space*(words.length-1);}
    let x=0;words.forEach((w,i)=>{w.x=x;w.width=widths[i];x+=w.width+space;});
    const height=size*(family==='hand'?1.2:1.06)+10;
    rows.push({words,family,size,width,height,row:r,y:total});total+=height+style.gap;index+=n;
   }
   total-=style.gap;const width=Math.max(...rows.map(r=>r.width));
   for(const row of rows)row.offset=this.options.compact==='cutline'?(row.row?width-row.width:0):(width-row.width)/2;
   groups.push({rows,total,width,index:groupIndex,start:chosen[0].start,end:cue.words[cursor+count]?.start??cue.end,hero,count});cursor+=count;
  }
  const layout={groups};this.cache.set(key,layout);if(this.cache.size>80)this.cache.delete(this.cache.keys().next().value);return layout;
 }
 render(time,{background=null}={}){
  if(this.disposed)return;this.time=time;
  const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);c.save();c.scale(w/1080,h/1920);
  if(background&&!this.options.overlayOnly)background(c,1080,1920,time);
  const cue=this.cues.find(cue=>time>=cue.start&&time<cue.end),style=SpeakerStyles[this.options.compact];
  this.pose={seconds:time,words:cue?.words.length||0,style:this.options.compact,visibleWords:0,group:0,groups:style.groups.length};
  if(!cue){c.restore();return;}
  const group=this.layout(cue).groups.find(g=>time>=g.start&&time<g.end);if(!group){c.restore();return;}
  const p=style.palettes[scClamp(Math.round(this.options.palette)||0,0,3)],position=scClamp(Number(this.options.position)||83,70,85),x=(1080-group.width)/2,y=scClamp(1920*position/100-group.total/2,1298,1690-group.total);
  const visible=group.rows.flatMap(r=>r.words).filter(word=>this.progress(time,word)>0),active=group.rows.flatMap(r=>r.words).filter(word=>word.start<=time).at(-1);
  this.pose={...this.pose,visibleWords:visible.length,displayText:visible.map(word=>word.text).join(' '),group:group.index+1,bounds:{x:x-36,y:y-26,width:group.width+72,height:group.total+60}};
  // Keep even the animated edges and shadows inside the lower caption area.
  c.beginPath();c.rect(64,1250,952,480);c.clip();
  c.globalAlpha=this.options.reducedMotion?1:scClamp((group.end-time)/.09);
  for(const row of group.rows){
   c.save();c.translate(x+row.offset,y+row.y);this.drawCompact(row,p,time,group,active);c.restore();
  }
  c.restore();
 }
 drawCompact(row,p,time,group,active){
  const c=this.ctx,kind=this.options.compact;
  for(const word of row.words){
   const q=this.progress(time,word),phase=scEase(q);if(!q)continue;
   const hero=word.index===group.hero,spoken=word.index===active?.index;
   if(kind==='cutline'&&hero){
    c.save();c.translate(word.x,-3);c.beginPath();c.rect(-10,-12,word.width+20,row.size*1.2+20);c.clip();this.strip({...row,width:word.width,height:row.size*1.09},p,q,{fill:group.index%2?p.b:p.a,torn:true});c.restore();
   }
   if(kind==='echo'){
    c.save();c.globalAlpha*=phase*.65;c.font=scFont(row.family,row.size);c.fillStyle=hero?p.a:p.b;c.fillText(word.label,word.x+4,row.size*.88+4);c.restore();
   }
   if(kind==='marker'&&hero){
    c.save();c.globalAlpha*=phase;c.beginPath();c.rect(word.x-12,-10,(word.width+24)*phase,row.size*1.3);c.clip();c.fillStyle=group.index%2?p.b:p.a;c.beginPath();c.roundRect(word.x-12,row.size*.06,word.width+24,row.size*.96,11);c.fill();
    c.globalAlpha*=.32*scClamp(Number(this.options.texture)||0);c.strokeStyle=p.dark;c.lineWidth=1.5;for(let i=0;i<4;i++){c.beginPath();c.moveTo(word.x-5,row.size*.25+i*9);c.lineTo(word.x+word.width,row.size*.3+i*9);c.stroke();}c.restore();
   }
   if(kind==='frame'&&spoken){
    c.save();c.globalAlpha*=phase;c.strokeStyle=p.a;c.lineWidth=3;c.strokeRect(word.x-12,-5,word.width+24,row.size*1.1+10);c.restore();
   }
  }
  // Paint every backing before the text, so a marker never erases its neighbour.
  for(const word of row.words){
   if(!this.progress(time,word))continue;const hero=word.index===group.hero,spoken=word.index===active?.index;
   const fill=kind==='cutline'&&hero||kind==='marker'&&hero?p.dark:kind==='sidenote'&&row.family==='hand'?p.a:kind==='frame'&&hero?p.a:p.ink;
   this.word(word,row,p,time,{fill,texture:kind==='echo'?'halftone':kind==='frame'&&hero?'stripe':SpeakerStyles[kind].texture,depth:kind==='frame'&&hero?4:0,stamp:kind==='echo',write:kind==='cutline'||kind==='sidenote',rotate:kind==='marker'?(hero?-.01:.004):0,blur:kind==='echo'?2:0});
   if(kind==='sidenote'&&hero)this.underline(word,row,p,time,{color:p.b,weight:5,hook:true});
   if(kind==='cutline'&&!hero&&spoken&&row.row===0)this.underline(word,row,p,time,{color:p.b,weight:3});
  }
  const entrance=scEase(this.progress(time,row.words[0]));
  if(kind==='echo'&&row.row===0&&entrance){c.save();c.globalAlpha*=entrance;c.strokeStyle=p.a;c.lineWidth=3;c.beginPath();c.moveTo(-22,6);c.lineTo(-22,row.height-4);c.lineTo(-8,row.height-4);c.stroke();c.restore();}
  if(kind==='sidenote'&&row.row===0&&entrance){c.save();c.globalAlpha*=entrance;c.strokeStyle=p.b;c.lineWidth=3;for(let i=0;i<2;i++){c.beginPath();c.moveTo(-28-i*10,row.size*.62);c.lineTo(-18-i*10,row.size*.35);c.stroke();}c.restore();}
  if(kind==='frame'&&row.row===1){const last=row.words.at(-1);this.underline(last,row,p,time,{color:p.b,weight:3});}
 }
}
