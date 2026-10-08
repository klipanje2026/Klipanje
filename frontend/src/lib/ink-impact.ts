import {captionEase} from './text-surface';
import type {CaptionSettings,Segment} from '../config/captions/types';
import type {CaptionBounds,CaptionWordBounds} from './caption-renderer';

type Surface=HTMLCanvasElement|OffscreenCanvas;
type Stamp={surface:Surface;width:number;height:number;size:number};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const finite=(n:number|undefined,fallback:number)=>Number.isFinite(n)?n!:fallback;
const tone=(color:string|undefined,fallback:string)=>/^#[\da-f]{6}$/i.test(color??'')?color!:/^#[\da-f]{3}$/i.test(color??'')?'#'+[...color!.slice(1)].map(c=>c+c).join(''):fallback;
const random=(seed:number)=>{const n=Math.sin(seed*12.9898+78.233)*43758.5453;return n-Math.floor(n);};
const seedFor=(text:string)=>Array.from(text).reduce((seed,letter)=>(seed*31+letter.codePointAt(0)!)>>>0,17);
const canvas=(w:number,h:number):Surface=>typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
const ink=(surface:Surface)=>surface.getContext('2d') as CanvasRenderingContext2D;
const stamps=new Map<string,Stamp>();
let bytes=0,revision=0;
if(typeof document!=='undefined'&&document.fonts)document.fonts.addEventListener('loadingdone',()=>{stamps.clear();bytes=0;revision++;});
export const inkImpactRevision=()=>revision;

/** Cache the printed letters, including static grain; no random noise changes between frames. */
function makeStamp(text:string,requestedSize:number,color:string,s:CaptionSettings,maxWidth:number,density:number):Stamp{
  let size=requestedSize;
  const measure=ink(canvas(1,1));
  let font='',width=0,height=0,pad=0;
  const cap=Math.max(16,Math.min(4096/density,maxWidth));
  // Measure before allocating the texture so long unbroken words remain bounded.
  for(let pass=0;pass<12;pass++){
    font=`${s.italic?'italic ':''}${clamp(finite(s.fontWeight,700),100,900)} ${size}px ${s.fontFamily||'"Oswald Variable", sans-serif'}`;
    measure.font=font;measure.letterSpacing=`${size*finite(s.letterSpacing,.3)/100}px`;
    pad=Math.max(2,Math.ceil(size*.2));width=Math.ceil(measure.measureText(text).width+pad*2);height=Math.ceil(size*1.5);
    if(width<=cap)break;size*=Math.max(.01,(cap-2)/width);
  }
  const grain=clamp(finite(s.inkGrain,60),0,100)/100,depth=clamp(finite(s.textDepth,0),0,100)*size*.0009;
  const outline=clamp(finite(s.outlineWidth,1),0,24)*size/100;
  const key=JSON.stringify([text,font,measure.letterSpacing,color,grain,depth,s.textDepthColor,outline,s.outlineColor,density]);
  const cached=stamps.get(key);if(cached)return cached;
  const target=canvas(Math.max(1,Math.ceil(width*density)),Math.max(1,Math.ceil(height*density))),ctx=ink(target);
  ctx.scale(density,density);ctx.font=font;ctx.letterSpacing=measure.letterSpacing;ctx.textBaseline='alphabetic';ctx.lineJoin='round';
  const baseline=pad+size*.96;
  for(let d=Math.ceil(depth);d>0;d--){ctx.fillStyle=tone(s.textDepthColor,'#24191c');ctx.fillText(text,pad+d*.65,baseline+d);}
  ctx.shadowColor='#100d1699';ctx.shadowBlur=size*.025;ctx.shadowOffsetY=size*.025;
  if(outline>0){ctx.strokeStyle=tone(s.outlineColor,'#171318');ctx.lineWidth=outline;ctx.strokeText(text,pad,baseline);}
  ctx.fillStyle=color;ctx.fillText(text,pad,baseline);ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  if(grain>0){
    const seed=seedFor(text),count=Math.min(1200,Math.ceil(width*height/240*grain));
    ctx.globalCompositeOperation='destination-out';
    for(let i=0;i<count;i++){
      const x=random(seed+i*3)*width,y=random(seed+i*3+1)*height;
      ctx.globalAlpha=(.12+random(seed+i*3+2)*.48)*grain;
      ctx.fillRect(x,y,(i%9===0?size*.075:size*.01)*(1+random(i)),Math.max(.5,size*.008));
    }
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  }
  const stamp={surface:target,width,height,size};stamps.set(key,stamp);bytes+=target.width*target.height*4;
  while((bytes>64*1024*1024||stamps.size>64)&&stamps.size>1){const first=stamps.keys().next().value!;const old=stamps.get(first)!;bytes-=old.surface.width*old.surface.height*4;stamps.delete(first);}
  return stamp;
}

/** Irregular paint silhouette with dry bristles, revealed from left to right. */
function drawBrush(ctx:CanvasRenderingContext2D,w:number,h:number,progress:number,color:string,roughness:number,seed:number){
  ctx.save();ctx.beginPath();ctx.rect(-w/2-8,-h,w*clamp(progress,0,1)+16,h*2);ctx.clip();
  ctx.fillStyle=color;ctx.beginPath();
  const steps=22,edge=h*.13*roughness;
  for(let i=0;i<=steps;i++){
    const x=-w/2+i*w/steps,y=-h/2+(random(seed+i)-.5)*edge;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  for(let i=steps;i>=0;i--)ctx.lineTo(-w/2+i*w/steps,h/2+(random(seed+100+i)-.5)*edge);
  ctx.closePath();ctx.fill();
  ctx.lineCap='butt';ctx.strokeStyle=color;
  for(let i=0;i<10;i++){
    const y=(i%2?1:-1)*(h/2+(2+random(seed+200+i)*8)*roughness);
    ctx.globalAlpha=.3+random(seed+300+i)*.5;ctx.lineWidth=1+random(seed+400+i)*2;
    ctx.beginPath();ctx.moveTo(-w/2+random(seed+500+i)*w*.2,y);ctx.lineTo(w/2-random(seed+600+i)*w*.24,y+(random(i)-.5)*5);ctx.stroke();
  }
  ctx.restore();
}

function drawInkDrops(ctx:CanvasRenderingContext2D,stamp:Stamp,age:number,life:number,color:string,s:CaptionSettings,seed:number){
  if(s.inkSplatter===false)return;
  const duration=Math.min(.6,life*.65),p=clamp((age-.035)/Math.max(.03,duration),0,1);
  if(age<.035||p>=1)return;
  const count=clamp(Math.round(finite(s.inkDrops,16)),0,40),spread=clamp(finite(s.inkSpread,100),0,180)/100;
  const fade=(1-p)**1.8,travel=captionEase(p,'softStop');
  ctx.save();ctx.globalAlpha*=fade;ctx.fillStyle=color;
  for(let i=0;i<count;i++){
    const side=i%2?-1:1,a=(random(seed+i)*1.3-.65),distance=(12+random(seed+50+i)*stamp.size*.42)*travel*spread;
    const x=side*(stamp.width*.47+Math.cos(a)*distance),y=Math.sin(a)*distance+(random(seed+100+i)-.5)*stamp.size*.75;
    const r=(1+random(seed+150+i)*3.2)*stamp.size/120;
    ctx.beginPath();ctx.ellipse(x,y,r*(1+travel),Math.max(.1,r*.5),side*a,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

function drawStamp(ctx:CanvasRenderingContext2D,stamp:Stamp,age:number,life:number,painted:boolean,color:string,s:CaptionSettings,seed:number){
  const strength=clamp(finite(s.inkImpact,100),0,180)/100;
  const duration=Math.min(clamp(finite(s.revealDuration,.24),.06,1),life*.45);
  const progress=clamp(age/Math.max(.02,duration),0,1),arrive=captionEase(progress,s.motionCurve??'softStop');
  const squish=Math.sin(progress*Math.PI)*.09*strength,zoom=1+(1-arrive)*.4*strength;
  const exit=Math.min(clamp(finite(s.inkExitDuration,.2),.04,.8),life*.22);
  const leave=captionEase((age-(life-exit))/Math.max(.01,exit),'smooth');
  const width=stamp.width+stamp.size*.25,height=stamp.height;
  ctx.save();ctx.globalAlpha*=clamp(age/.035,0,1);
  ctx.beginPath();ctx.rect(-width/2+width*leave,-height,width*(1-leave),height*2);ctx.clip();
  const shake=Math.sin(age*73)*Math.exp(-age*25)*stamp.size*.025*strength;
  ctx.translate(shake,-(1-arrive)*stamp.size*.28*strength);ctx.scale(zoom*(1+squish),zoom*(1-squish));
  const roughness=clamp(finite(s.inkRoughness,65),0,100)/100;
  if(painted){
    ctx.save();ctx.rotate(-.024);ctx.globalAlpha*=clamp(finite(s.backgroundOpacity,100),0,100)/100;
    drawBrush(ctx,stamp.width+stamp.size*.1,stamp.size*1.04,captionEase(progress*1.5,'softStop'),color,roughness,seed);ctx.restore();
  }
  ctx.drawImage(stamp.surface,-stamp.width/2,-stamp.height/2,stamp.width,stamp.height);
  if(s.inkUnderline!==false&&painted){
    const underline=captionEase((age-duration*.55)/Math.max(.04,duration),'softStop');
    ctx.save();ctx.translate(stamp.width*.03,stamp.size*.69);ctx.rotate(-.035);
    drawBrush(ctx,stamp.width*.82,stamp.size*.035,underline,color,roughness,seed+4000);ctx.restore();
  }
  ctx.restore();
  ctx.save();ctx.globalAlpha*=1-leave;drawInkDrops(ctx,stamp,age,life,color,s,seed);ctx.restore();
}

export function drawInkImpact(ctx:CanvasRenderingContext2D,segment:Segment,time:number,s:CaptionSettings):CaptionBounds|null{
  if(!Number.isFinite(time)||time<segment.start||time>=segment.end||segment.effectOnly)return null;
  const matches=[...segment.text.matchAll(/\S+/gu)],w=ctx.canvas.width,h=ctx.canvas.height;
  if(!matches.length||!w||!h)return null;
  const starts:number[]=[];
  matches.forEach((_,i)=>starts.push(clamp(finite(segment.words?.length===matches.length?segment.words[i]?.start:undefined,segment.start+i*(segment.end-segment.start)/matches.length),starts.at(-1)??segment.start,segment.end)));
  const single=false,all=true;
  const count=4;
  const active=Math.max(0,starts.findLastIndex(at=>at<=time)),from=Math.floor(active/count)*count,to=Math.min(matches.length,from+count);
  const pageStart=from?starts[from]:segment.start;
  let pageEnd=starts[to]??segment.end;
  if(single&&segment.words?.length===matches.length)pageEnd=Math.min(pageEnd,finite(segment.words[from]?.end,pageEnd));
  if(pageEnd<=pageStart||time>=pageEnd)return null;
  const scale=w/1080*clamp(finite(s.fontScale,100),10,400)/100*(s.fontSizePx?clamp(s.fontSizePx/144,.1,6):1);
  const density=clamp(scale,1,2),maxWidth=w*.78/scale;
  const items:{raw:string;index:number;stamp:Stamp;painted:boolean;color:string;settings:CaptionSettings;seed:number}[]=[];
  for(let index=from;index<to;index++){
    const raw=matches[index][0],override=segment.wordStyles?.[index];
    const own=override&&!override.linked&&override.text===raw?override.settings:s;
    const hero=index===to-1,painted=hero&&s.inkBrush!==false;
    const text=(own.uppercase?raw.toLocaleUpperCase('bs'):raw).normalize('NFC');
    const size=(hero?144:118)*(own===s?1:clamp(finite(own.fontScale,s.fontScale)/Math.max(1,s.fontScale),.1,4))
      *(own!==s&&own.fontSizePx?clamp(own.fontSizePx/Math.max(1,s.fontSizePx??144),.1,6):1);
    const face=painted?tone(own.inkBrushTextColor,'#19151a'):tone(own.textColor,'#fff1dc');
    const stamp=makeStamp(text,size,face,own,maxWidth,density);
    const color=(Math.floor(from/count)%2===0)?tone(s.highlightColor,'#ffd34e'):tone(s.inkColor2,'#ff6e49');
    items.push({raw,index,stamp,painted,color,settings:own,seed:seedFor(raw)+index*97});
  }
  const gap=clamp(finite(s.inkRowGap,5),-10,30),total=items.reduce((sum,item)=>sum+item.stamp.height*.82,0)+gap*(items.length-1);
  const outputScale=scale*Math.min(1,h*.58/(total*scale));
  const x=finite(segment.position?.x,finite(s.x,50))*w/100,y=finite(segment.position?.y,finite(s.y,65))*h/100;
  const rotation=finite(s.rotation,0),angle=rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
  const boxes:CaptionWordBounds[]=[];
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(outputScale,outputScale);ctx.globalAlpha*=clamp(finite(s.textOpacity,100),0,100)/100;
  let top=-total/2;
  items.forEach((item,i)=>{
    const {stamp,index,raw}=item,at=all?pageStart:starts[index],age=time-at,life=Math.max(.03,pageEnd-at);
    const offset=segment.wordOffsets?.[index],moved=offset?.text===raw?offset:undefined;
    const shift=(i%2?1:-1)*stamp.size*.11;
    const cx=shift+(moved?moved.x*w/100/outputScale:0),cy=top+stamp.height*.41+(moved?moved.y*h/100/outputScale:0);
    const tilt=(i%2?3:-4)*clamp(finite(s.inkTilt,100),0,200)/100;
    if(age>=0){
      ctx.save();ctx.translate(cx,cy);ctx.rotate(tilt*Math.PI/180);drawStamp(ctx,stamp,age,life,item.painted,item.color,item.settings,item.seed);ctx.restore();
      boxes.push({index,text:raw,x:(x+(cx*cos-cy*sin)*outputScale)/w*100,y:(y+(cx*sin+cy*cos)*outputScale)/h*100,width:(stamp.width+stamp.size*.12)*outputScale/w*100,height:stamp.height*outputScale/h*100,rotation:rotation+tilt});
    }
    top+=stamp.height*.82+gap;
  });ctx.restore();
  return boxes.length?{segmentId:segment.id,x:x/w*100,y:y/h*100,width:Math.max(...items.map(item=>item.stamp.width+item.stamp.size*.35))*outputScale/w*100,height:(total+30)*outputScale/h*100,rotation,words:boxes}:null;
}
