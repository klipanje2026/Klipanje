import {joinOrphanRows} from './collection/caption-layout.mjs';
import {captionEase, drawTextSurface, drawTextShine} from './text-surface';
import type {CaptionSettings, Segment} from '../config/captions/types';
import type {CaptionBounds, CaptionWordBounds} from './caption-renderer';

type Surface = HTMLCanvasElement | OffscreenCanvas;
type Tile = {surface:Surface; width:number; height:number; size:number; pad:number; baseline:number; font:string};
const limit = (n:number,min:number,max:number) => Math.max(min,Math.min(max,n));
const number = (n:number|undefined,fallback:number) => Number.isFinite(n) ? n! : fallback;
const ink = (value:string|undefined,fallback:string) => /^#[\da-f]{6}$/i.test(value??'') ? value! : fallback;
const surface = (width:number,height:number):Surface => typeof OffscreenCanvas!=='undefined'
  ? new OffscreenCanvas(width,height) : Object.assign(document.createElement('canvas'),{width,height});
const context = (canvas:Surface) => canvas.getContext('2d') as CanvasRenderingContext2D;
const cache = new Map<string,Tile>();
let cacheBytes=0,revision=0,scratch:Surface|undefined;
if(typeof document!=='undefined'&&document.fonts)document.fonts.addEventListener('loadingdone',()=>{cache.clear();cacheBytes=0;revision++;});
export const prismFoldRevision=()=>revision;

function glassPath(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,cut:number){
  ctx.beginPath();ctx.moveTo(x+cut,y);ctx.lineTo(x+w,y);ctx.lineTo(x+w,y+h-cut);
  ctx.lineTo(x+w-cut,y+h);ctx.lineTo(x,y+h);ctx.lineTo(x,y+cut);ctx.closePath();
}

function paintPrismTile(text:string,size:number,settings:CaptionSettings,maxWidth:number):Tile{
  const font=`${settings.italic?'italic ':''}${settings.fontWeight??800} ${size}px ${settings.fontFamily||'"Inter Variable", sans-serif'}`;
  const key=JSON.stringify([text,size,settings]);
  const existing=cache.get(key);
  const cap=Math.max(8,Math.min(4096,maxWidth));
  if(existing)return existing.width<=cap?existing:paintPrismTile(text,size*(cap-1)/existing.width,settings,cap);
  const measure=context(surface(1,1));measure.font=font;measure.letterSpacing=`${size*(settings.letterSpacing??1)/100}px`;
  const pad=Math.ceil(size*.28),width=Math.ceil(measure.measureText(text).width+pad*2),height=Math.ceil(size*1.6);
  // Fit before allocating pixels, including exceptionally long unbroken words.
  if(width>cap)return paintPrismTile(text,size*(cap-1)/width,settings,cap);
  const target=surface(width,height),ctx=context(target),baseline=size*1.08;
  ctx.font=font;ctx.letterSpacing=measure.letterSpacing;ctx.textBaseline='alphabetic';
  const cyan=ink(settings.highlightColor,'#72f5ef'),violet=ink(settings.foldColor2,'#a98aff');
  glassPath(ctx,1,1,width-2,height-2,size*.2);
  ctx.save();ctx.globalAlpha=limit(number(settings.backgroundOpacity,72),0,100)/100;
  const glass=ctx.createLinearGradient(0,0,width,height);
  glass.addColorStop(0,ink(settings.backgroundColor,'#14283b'));glass.addColorStop(.5,'#152235');glass.addColorStop(1,'#28304d');
  ctx.fillStyle=glass;ctx.fill();ctx.restore();
  if(settings.foldRim!==false){
    const rim=ctx.createLinearGradient(0,0,width,height);rim.addColorStop(0,cyan);rim.addColorStop(.5,'#ffffff28');rim.addColorStop(1,violet);
    ctx.strokeStyle=rim;ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle=cyan;ctx.fillRect(size*.26,height-4,Math.min(width*.26,size*.55),2);
  }
  ctx.shadowColor='#00000070';ctx.shadowBlur=size*.08;ctx.shadowOffsetY=size*.06;
  const face=ctx.createLinearGradient(0,baseline-size,0,baseline);
  face.addColorStop(0,ink(settings.textColor,'#fffaf2'));face.addColorStop(.4,'#ffffff');face.addColorStop(.52,cyan);face.addColorStop(.64,'#f2f2ff');face.addColorStop(1,violet);
  ctx.fillStyle=face;ctx.fillText(text,pad,baseline);ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  if((settings.outlineWidth??0)>0){ctx.strokeStyle=settings.outlineColor;ctx.lineWidth=Math.min(12,settings.outlineWidth)*size/80;ctx.strokeText(text,pad,baseline);}
  // The existing material renderer supplies editable bevel and reflection lighting.
  drawTextSurface(ctx,text,pad,baseline,size,settings);
  const tile={surface:target,width,height,size,pad,baseline,font};cache.set(key,tile);cacheBytes+=width*height*4;
  while((cache.size>64||cacheBytes>64*1024*1024)&&cache.size>1){const first=cache.keys().next().value!;const old=cache.get(first)!;cacheBytes-=old.width*old.height*4;cache.delete(first);}
  return tile;
}

function foldTile(ctx:CanvasRenderingContext2D,tile:Tile,text:string,age:number,duration:number,life:number,settings:CaptionSettings,index:number){
  if(age<0)return;
  const count=limit(Math.round(number(settings.foldSlices,4)),2,10);
  const delay=Math.min(limit(number(settings.foldStagger,.045),0,.15),life*.16/Math.max(1,count-1));
  const strength=limit(number(settings.foldStrength,100),0,150)/100;
  const exit=Math.min(.24,life*.18),leave=captionEase((age-(life-exit))/Math.max(.01,exit),'smooth');
  if(!scratch)scratch=surface(tile.width,tile.height);
  if(scratch.width!==tile.width)scratch.width=tile.width;if(scratch.height!==tile.height)scratch.height=tile.height;
  const c=context(scratch);c.clearRect(0,0,tile.width,tile.height);c.drawImage(tile.surface,0,0);
  c.font=tile.font;c.textBaseline='alphabetic';c.letterSpacing=`${tile.size*(settings.letterSpacing??1)/100}px`;
  // Reuse Edita's glyph-clipped animated shine, with the actual video timestamp.
  drawTextShine(c,text,tile.pad,tile.baseline,tile.size,settings,age);
  if(settings.foldBeam!==false){
    c.save();glassPath(c,1,1,tile.width-2,tile.height-2,tile.size*.2);c.clip();
    const phase=((age*number(settings.foldBeamSpeed,1)/1.6)%1+1)%1;
    const x=-tile.height+(tile.width+tile.height*2)*phase;
    const beam=c.createLinearGradient(x-tile.size*.25,0,x+tile.size*.25,tile.height);
    beam.addColorStop(0,'#ffffff00');beam.addColorStop(.42,ink(settings.highlightColor,'#72f5ef')+'00');beam.addColorStop(.5,'#ffffff80');beam.addColorStop(.58,ink(settings.foldColor2,'#a98aff')+'25');beam.addColorStop(1,'#ffffff00');
    c.globalAlpha=.4;c.fillStyle=beam;c.fillRect(0,0,tile.width,tile.height);c.restore();
  }
  const piece=tile.width/count;
  ctx.save();ctx.globalAlpha*=1-leave;
  if(settings.foldEcho!==false){ctx.save();ctx.globalAlpha*=.13*(1-leave);ctx.drawImage(scratch,-tile.width/2+tile.size*.1,-tile.height/2+tile.size*.12);ctx.restore();}
  for(let i=0;i<count;i++){
    const local=age-i*delay;if(local<0)continue;
    const progress=limit(captionEase(local/duration,settings.motionCurve??'softStop'),0,1);
    const open=(1-progress)*strength+leave*.7,sign=(i+index)%2?1:-1;
    ctx.save();ctx.globalAlpha*=limit(local/.055,0,1);
    ctx.translate(-tile.width/2+(i+.5)*piece,sign*open*tile.size*.5);
    ctx.transform(Math.max(.015,Math.cos(Math.min(1,open)*Math.PI*.49)),sign*Math.sin(open)*.22,0,1,0,0);
    // Isolate each slice of the complete artwork; strips join exactly at rest.
    ctx.beginPath();ctx.rect(-piece/2,-tile.height/2,piece,tile.height);ctx.clip();
    ctx.drawImage(scratch,-(i+.5)*piece,-tile.height/2);ctx.restore();
  }
  ctx.restore();
}

export function drawPrismFold(ctx:CanvasRenderingContext2D,segment:Segment,time:number,settings:CaptionSettings):CaptionBounds|null{
  if(!Number.isFinite(time)||time<segment.start||time>=segment.end||segment.effectOnly)return null;
  const matches=[...segment.text.matchAll(/\S+/gu)],tokens=matches.map(match=>match[0]);if(!tokens.length)return null;
  const w=ctx.canvas.width,h=ctx.canvas.height;if(!w||!h)return null;
  const single=false,all=settings.foldEntryOrder!=='spoken';
  const per=4;
  const starts:number[]=[];
  tokens.forEach((_,i)=>starts.push(limit(number(segment.words?.length===tokens.length?segment.words[i]?.start:undefined,segment.start+(segment.end-segment.start)*i/tokens.length),starts.at(-1)??segment.start,segment.end)));
  const active=Math.max(0,starts.findLastIndex(start=>start<=time)),from=Math.floor(active/per)*per,to=Math.min(tokens.length,from+per);
  const start=from?starts[from]:segment.start;
  let end=starts[to]??segment.end;
  if(single&&segment.words?.length===tokens.length)end=Math.min(end,number(segment.words[from]?.end,end));
  if(time>=end)return null;
  const scale=w/1080*limit(number(settings.fontScale,100),10,400)/100*(settings.fontSizePx?limit(settings.fontSizePx/100,.1,8):1);
  const maxWidth=w*.86/scale,gap=18+limit(number(settings.wordSpacing,0),-10,150);
  type Placed={tile:Tile;text:string;raw:string;index:number;settings:CaptionSettings};
  const rows:Placed[][]=[[]];
  for(let index=from;index<to;index++){
    const raw=tokens[index],override=segment.wordStyles?.[index];
    const own=override&&!override.linked&&override.text===raw?override.settings:settings;
    const text=(own.uppercase?raw.toLocaleUpperCase('bs'):raw).normalize('NFC');
    const size=100*(own===settings?1:limit(number(own.fontScale,settings.fontScale)/Math.max(1,settings.fontScale),.1,4));
    const tile=paintPrismTile(text,size,own,maxWidth);
    let row=rows.at(-1)!;
    const previous=matches[index-1],lineBreak=previous&&segment.text.slice(previous.index!+previous[0].length,matches[index].index).includes('\n');
    if(row.length&&(lineBreak||row.reduce((sum,word)=>sum+word.tile.width+gap,0)+tile.width>maxWidth)){row=[];rows.push(row);}
    row.push({tile,text,raw,index,settings:own});
  }
  joinOrphanRows(rows,word=>word.text);
  const heights=rows.map(row=>Math.max(...row.map(item=>item.tile.height)));
  const total=heights.reduce((sum,n)=>sum+n,0)+gap*(rows.length-1);
  const outputScale=scale*Math.min(1,h*.62/(total*scale));
  const x=number(segment.position?.x,number(settings.x,50))*w/100,y=number(segment.position?.y,number(settings.y,65))*h/100;
  const rotation=number(settings.rotation,0),angle=rotation*Math.PI/180;
  const boxes:CaptionWordBounds[]=[];
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(outputScale,outputScale);ctx.globalAlpha*=limit(number(settings.textOpacity,100),0,100)/100;
  let top=-total/2;
  rows.forEach((row,rowIndex)=>{
    let left=-row.reduce((sum,item)=>sum+item.tile.width,0)/2-gap*(row.length-1)/2;
    row.forEach(item=>{
      const {tile,text,index,raw}=item,at=all?start:starts[index],life=Math.max(.02,end-at),age=time-at;
      const offset=segment.wordOffsets?.[index],move=offset?.text===raw?offset:undefined;
      const cx=left+tile.width/2+(move?move.x*w/100/outputScale:0),cy=top+heights[rowIndex]/2+(move?move.y*h/100/outputScale:0);
      if(age>=0){
        ctx.save();ctx.translate(cx,cy);foldTile(ctx,tile,text,age,Math.min(limit(number(settings.revealDuration,.58),.08,1.8),life*.52),life,item.settings,index);ctx.restore();
        boxes.push({index,text:raw,x:(x+(cx*Math.cos(angle)-cy*Math.sin(angle))*outputScale)/w*100,y:(y+(cx*Math.sin(angle)+cy*Math.cos(angle))*outputScale)/h*100,width:tile.width*outputScale/w*100,height:tile.height*outputScale/h*100,rotation});
      }
      left+=tile.width+gap;
    });top+=heights[rowIndex]+gap;
  });
  ctx.restore();
  return boxes.length?{segmentId:segment.id,x:x/w*100,y:y/h*100,width:Math.max(...rows.map(row=>row.reduce((sum,item)=>sum+item.tile.width,0)+gap*(row.length-1)))*outputScale/w*100,height:total*outputScale/h*100,rotation,words:boxes}:null;
}
