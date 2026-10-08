import {drawTextShine,drawTextUnderline,drawTextSurface,captionFill} from './text-surface';
import type {CaptionSettings,Segment,StyleKey} from '../config/captions/types';
import type {CaptionBounds} from './caption-renderer';

type Material='thin'|'silver'|'red'|'orange';
type Layer=HTMLCanvasElement|OffscreenCanvas;
const layer=():Layer=>typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(1,1):document.createElement('canvas');
const ink=(c:Layer)=>c.getContext('2d') as CanvasRenderingContext2D;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const stops=[0,.30,.44,.49,.57,.80,1];
const palettes={silver:['#9db7d1','#eaf5ff','#f8f9f5','#607ca0','#a9c3dc','#f5f7fb','#7d91a9'],red:['#850926','#ae0c2c','#79081e','#570318','#960722','#72031b','#5d0217'],orange:['#ff9515','#ff7105','#ff9e28','#e95204','#ff7708','#ff8512','#f55b04']};
type Word={text:string;index:number;start:number};
type Block={words:Word[];start:number;end:number;bottom:boolean;material:Exclude<Material,'thin'>;accent:number[]};
function blocksFor(segment:Segment,settings:CaptionSettings):Block[]{
 const text=segment.text.trim().split(/\s+/).filter(Boolean),count=text.length;
 const words=text.map((text,index)=>({text:settings.uppercase?text.toLocaleUpperCase('bs'):text,index,start:Math.max(segment.start,Math.min(segment.end,segment.words?.[index]?.start??segment.start+index/Math.max(1,count)*(segment.end-segment.start)))}));
 const size=segment.wordsSeparated||settings.wordMode==='single'?1:Math.max(2,Math.min(6,Math.round(settings.metallicPhraseWords??3)));
 const seed=Array.from(segment.id).reduce((sum,c)=>sum+c.charCodeAt(0),0),blocks:Block[]=[];
 for(let i=0;i<count;i+=size){
  const group=words.slice(i,i+size),index=blocks.length;
  const material=settings.metallicMaterial&&settings.metallicMaterial!=='auto'?settings.metallicMaterial:(['silver','red','silver','orange'] as const)[(seed+index)%4];
  blocks.push({words:group,start:group[0].start,end:segment.end,bottom:settings.metallicZone==='bottom'||(settings.metallicZone!=='top'&&(seed+index)%3===2),material,accent:group.slice(-Math.min(2,Math.max(1,group.length-2))).map(w=>w.index)});
 }
 // Face avoidance can move either authored zone to the same safe position.
 // Replace the previous phrase instead of leaving a second phrase underneath it.
 blocks.forEach((block,i)=>{block.end=blocks[i+1]?.start??segment.end;});
 return blocks;
}
type Mask={face:Layer;rim:Layer;edge:Layer;width:number;height:number;pad:number};
const masks=new Map<string,Mask>();
function maskFor(text:string,font:string,spacing:number,unit:number):Mask{
 const canvas=layer(),ctx=ink(canvas);ctx.font=font;ctx.letterSpacing=`${spacing}px`;
 const m=ctx.measureText(text),key=JSON.stringify([text,font,spacing,unit,m.width,m.actualBoundingBoxAscent]);
 const old=masks.get(key);if(old)return old;
 const pad=Math.ceil(24*unit),height=Math.max(1,m.actualBoundingBoxAscent+m.actualBoundingBoxDescent),width=m.width;
 canvas.width=Math.ceil(Math.max(width,m.actualBoundingBoxLeft+m.actualBoundingBoxRight)+pad*2);canvas.height=Math.ceil(height+pad*2);
 ctx.font=font;ctx.letterSpacing=`${spacing}px`;ctx.fillStyle='#fff';ctx.fillText(text,pad+Math.max(0,m.actualBoundingBoxLeft),pad+m.actualBoundingBoxAscent);
 const rim=layer(),edge=layer();for(const c of [rim,edge]){c.width=canvas.width;c.height=canvas.height;}
 const depth=ink(rim);depth.drawImage(canvas,unit,2*unit);depth.globalCompositeOperation='destination-out';depth.drawImage(canvas,0,0);depth.globalCompositeOperation='source-in';depth.fillStyle='#1c1419';depth.fillRect(0,0,rim.width,rim.height);
 const light=ink(edge);light.drawImage(canvas,0,0);light.globalCompositeOperation='destination-out';light.drawImage(canvas,0,unit);light.globalCompositeOperation='source-in';light.fillStyle='#fff9ef';light.fillRect(0,0,edge.width,edge.height);
 const result={face:canvas,rim,edge,width,height,pad};masks.set(key,result);if(masks.size>100)masks.delete(masks.keys().next().value!);return result;
}
let surface:Layer|undefined;
function sprite(mask:Mask,material:Material,age:number,settings:CaptionSettings,text:string,font:string,size:number){
 surface??=layer();surface.width=mask.face.width;surface.height=mask.face.height;const ctx=ink(surface),w=surface.width,h=surface.height;
 const palette=material==='thin'?[settings.textColor,'#f0f0f0']:palettes[material];
 // Narrow gradient strips retain the reference's gently curved metallic bands.
 for(let x=0;x<w;x+=8){
  const phase=material==='thin'?0:.035*Math.sin(age*2+x*.004),gradient=ctx.createLinearGradient(0,mask.pad-phase*mask.height,0,mask.pad+(1-phase)*mask.height);
  palette.forEach((color,i)=>gradient.addColorStop(material==='thin'?i:stops[i],color));ctx.fillStyle=gradient;ctx.fillRect(x,0,8,h);
 }
 if(settings.textGradient){ctx.font=font;ctx.letterSpacing=`${size*(settings.letterSpacing??0)/100}px`;const m=ctx.measureText(text);ctx.fillStyle=captionFill(ctx,text,mask.pad+Math.max(0,m.actualBoundingBoxLeft),mask.pad+m.actualBoundingBoxAscent,size,settings,settings.textColor);ctx.fillRect(0,0,w,h);}
 if(material!=='thin'&&!settings.textGradient){
  const base=material==='orange'?settings.highlightColor:material==='red'?(settings.metallicRed??'#850926'):(settings.metallicSilver??'#9db7d1');
  if(base!==palettes[material][0]){ctx.globalCompositeOperation='color';ctx.fillStyle=base;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over';}
  const center=(age*1.05)%2-.35,strength=(material==='red'?.88:material==='silver'?.64:.20)*Math.max(0,Math.min(1.5,(settings.metallicShine??100)/100));
  // A diagonal Gaussian white reflection, clipped together with the face to the glyph mask.
  const nx=1/w,ny=.16/h,norm=nx*nx+ny*ny;
  const g=ctx.createLinearGradient((center-.51)*nx/norm,(center-.51)*ny/norm,(center+.51)*nx/norm,(center+.51)*ny/norm);
  for(let i=0;i<=24;i++){const u=i/24;g.addColorStop(u,`rgba(255,255,255,${Math.min(1,Math.exp(-(((u-.5)*6)**2))*strength)})`);}
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 }
 ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask.face,0,0);ctx.globalCompositeOperation='source-over';ctx.font=font;ctx.letterSpacing=`${size*(settings.letterSpacing??0)/100}px`;const metrics=ctx.measureText(text);const tx=mask.pad+Math.max(0,metrics.actualBoundingBoxLeft),ty=mask.pad+metrics.actualBoundingBoxAscent;drawTextSurface(ctx,text,tx,ty,size,settings);drawTextShine(ctx,text,tx,ty,size,settings,age);if(settings.underline)drawTextUnderline(ctx,text,tx,ty,size,{...settings,textUnderline:true},age);return surface;
}

export function drawMetallicCompact(ctx:CanvasRenderingContext2D,segment:Segment,time:number,settings:CaptionSettings,headBottom?:number):CaptionBounds|null{
 if(segment.effectOnly||time<segment.start||time>=segment.end)return null;
 const blocks=blocksFor(segment,settings),w=ctx.canvas.width,h=ctx.canvas.height,unit=Math.min(w/1080,h/1400),scale=settings.fontSizePx?settings.fontSizePx*w/1080/(77*unit):Math.max(.2,Math.min(6,settings.fontScale/100));
 const cx=(segment.position?.x??settings.x)/100*w,anchor=(segment.position?.y??settings.y)/100*h,angle=settings.rotation*Math.PI/180;
 const bounds:CaptionBounds['words']=[];let minY=Infinity,maxY=-Infinity,maxWidth=0;
 ctx.save();ctx.translate(cx,anchor);ctx.rotate(angle);
 for(const block of blocks){
  if(time<block.start||time>=block.end)continue;
  // Preserve word order, separating thin connector rows and emphasized rows.
  const rows:{words:Word[];accent:boolean}[]=[];
  for(const word of block.words){const accent=block.accent.includes(word.index),previous=rows.at(-1);if(previous&&previous.accent===accent)previous.words.push(word);else rows.push({words:[word],accent});}
  let top=(block.bottom?-.19:-.53)*h;
  if(headBottom!==undefined)top=Math.max(top,Math.min((headBottom+.035)*h-anchor,h*.72-anchor));
  for(const row of rows){
   const text=row.words.filter(word=>!segment.hiddenTitleWords?.includes(word.index)).map(word=>word.text).join(' ');if(!text)continue;
   let size=(row.accent?160:77)*unit*scale;
   const family=row.accent?settings.fontFamily:(settings.secondaryFontFamily||'Arial, sans-serif'),weight=row.accent?(settings.fontWeight||900):400;
   ctx.font=`${weight} ${size}px ${family}`;size*=Math.min(1,w*.907*Math.max(1,settings.fontScale/250)/Math.max(1,ctx.measureText(text).width));
   const font=`${weight} ${size}px ${family}`,spacing=size*(settings.letterSpacing??0)/100,mask=maskFor(text,font,spacing,unit),start=row.words[0].start,age=time-start;
   const x=settings.alignment==='left'?-w*.4535:settings.alignment==='right'?w*.4535-mask.width:-mask.width/2;
   if(age>=0){
    const duration=Math.min(row.accent?.22:.17,Math.max(.025,(block.end-start)*.4)),p=clamp(age/duration),remaining=block.end-time;
    const fade=Math.min(.12,(block.end-start)*.2),q=settings.metallicHoldEnd&&block.end===segment.end?0:1-clamp(remaining/Math.max(.01,fade));
    const dy=((1-p)**4*(row.accent?105:58)-65*q*q)*unit,alpha=clamp(age/Math.min(.065,duration))*(1-q),blur=Math.max((1-p)**2*8,q*5)*unit;
    const mat=row.accent?block.material:'thin',opacity=mat==='thin'?.96:mat==='red'?.97:.94;
    ctx.save();ctx.filter=blur>.15?`blur(${blur}px)`:'none';ctx.globalAlpha*=alpha*.45;ctx.drawImage(mask.rim,x-mask.pad,top-mask.pad+dy);ctx.globalAlpha=alpha*opacity;ctx.drawImage(sprite(mask,mat,age,settings,text,font,size),x-mask.pad,top-mask.pad+dy);ctx.globalAlpha=alpha*.48;ctx.drawImage(mask.edge,x-mask.pad,top-mask.pad+dy);ctx.restore();
    ctx.font=font;ctx.letterSpacing=`${spacing}px`;let left=x;
    for(const word of row.words){if(segment.hiddenTitleWords?.includes(word.index))continue;const width=ctx.measureText(word.text).width,bx=left+width/2,by=top+mask.height/2;
     bounds.push({index:word.index,text:word.text,x:(cx+bx*Math.cos(angle)-by*Math.sin(angle))/w*100,y:(anchor+bx*Math.sin(angle)+by*Math.cos(angle))/h*100,width:width/w*100,height:mask.height/h*100,rotation:settings.rotation});left+=width+ctx.measureText(' ').width;}
   }
   minY=Math.min(minY,top);maxY=Math.max(maxY,top+mask.height);maxWidth=Math.max(maxWidth,mask.width);top+=mask.height+5*unit;
  }
 }
 ctx.restore();if(!Number.isFinite(minY))return null;
 const middle=(minY+maxY)/2;
 return {x:(cx-middle*Math.sin(angle))/w*100,y:(anchor+middle*Math.cos(angle))/h*100,width:maxWidth/w*100,height:(maxY-minY)/h*100,rotation:settings.rotation,segmentId:segment.id,words:bounds};
}

function metallicCameraRaw(segments:Segment[],style:StyleKey,settings:CaptionSettings,time:number){
 const identity={scale:1,dx:0,dy:0};
 const entries=segments.filter(s=>!s.effectOnly&&s.role!=='title'&&s.text.trim()).map(segment=>{const own=(segment.separateStyle===false?undefined:segment.detachedStyle)||segment.laneStyle;return {segment,style:own?.style??style,settings:own?.settings??settings};});
 const active=entries.find(e=>time>=e.segment.start&&time<e.segment.end);if(!active||active.style!=='metallicCompactV2'||active.settings.glassCamera===false)return identity;
 const events=entries.filter(e=>e.style==='metallicCompactV2'&&e.settings.glassCamera!==false).flatMap(e=>blocksFor(e.segment,e.settings).map(b=>b.start)).sort((a,b)=>a-b).filter((t,i,a)=>!i||t-a[i-1]>=.18);
 const index=events.findLastIndex(t=>t<=time);if(index<0)return identity;
 const targets=[1.16,1.34,1.02,1.30,1.04,1.28,1.05,1.34,1.13],target=targets[index%targets.length],previous=targets[Math.max(0,index-1)%targets.length],age=time-events[index];
 const intensity=Math.max(0,Math.min(1.5,(active.settings.glassIntensity??100)/100*.8)),zoom=previous+(target-previous)*(1-(1-clamp(age/.18))**3)+Math.min(.06,.025*Math.max(0,age-.18));
 const scale=1+(zoom-1)*intensity,envelope=Math.sin(Math.PI*clamp(age/.65))**2,dx=(-.0015*Math.sin(time*2)+.00065*Math.sin(age*23)*envelope)*intensity;
 return {scale,dx:Math.max(-(scale-1)/2,Math.min((scale-1)/2,dx)),dy:.0004*Math.sin(age*19)*envelope*intensity};
}

/** Symmetric frame-time smoothing preserves seeking/export determinism and softens cuts. */
export function metallicCamera(segments:Segment[],style:StyleKey,settings:CaptionSettings,time:number){
 const current=segments.find(s=>s.role!=='title'&&time>=s.start&&time<s.end);
 const own=current&&((current.separateStyle===false?undefined:current.detachedStyle)||current.laneStyle);
 if((own?.settings??settings).glassCamera===false)return {scale:1,dx:0,dy:0};
 let scale=0,dx=0,dy=0,total=0;
 for(let i=-4;i<=4;i++){const weight=5-Math.abs(i),state=metallicCameraRaw(segments,style,settings,time+i/4*0.14);scale+=state.scale*weight;dx+=state.dx*weight;dy+=state.dy*weight;total+=weight;}
 return {scale:scale/total,dx:dx/total,dy:dy/total};
}
