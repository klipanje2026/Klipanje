import {joinOrphanRows} from './collection/caption-layout.mjs';
import {captionEase,drawTextShine} from './text-surface';
import {drawScriptStroke} from './caption-script-stroke';
import type {CaptionSettings,Segment} from '../config/captions/types';
import type {CaptionBounds,CaptionWordBounds} from './caption-renderer';

type SignatureStyle='orbitSignal'|'velvetScript';
type Word={raw:string;text:string;index:number;at:number;end:number;size:number;width:number;font:string;x:number;y:number;settings:CaptionSettings};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const finite=(n:number|undefined,fallback:number)=>Number.isFinite(n)?n!:fallback;
const color=(value:string|undefined,fallback:string)=>/^#[\da-f]{6}$/i.test(value??'')?value!:/^#[\da-f]{3}$/i.test(value??'')?'#'+[...value!.slice(1)].map(c=>c+c).join(''):fallback;
let revision=0;
if(typeof document!=='undefined'&&document.fonts)document.fonts.addEventListener('loadingdone',()=>{revision++;});
export const signatureCaptionRevision=()=>revision;

function arrangeWords(ctx:CanvasRenderingContext2D,segment:Segment,time:number,style:SignatureStyle,s:CaptionSettings){
  const tokens=[...segment.text.matchAll(/\S+/gu)];
  if(!tokens.length)return null;
  const starts=tokens.map((_,i)=>finite(segment.words?.length===tokens.length?segment.words[i]?.start:undefined,segment.start+(segment.end-segment.start)*i/tokens.length));
  const active=Math.max(0,starts.findLastIndex(at=>at<=time)),from=Math.floor(active/4)*4,to=Math.min(tokens.length,from+4),start=from?starts[from]:segment.start,end=starts[to]??segment.end;
  if(time>=end||end<=start)return null;
  const scale=ctx.canvas.width/1080*clamp(finite(s.fontScale,100),10,400)/100;
  const maxWidth=ctx.canvas.width*.82/scale,gap=(style==='velvetScript'?38:28)+clamp(finite(s.wordSpacing,0),-20,100);
  const rows:Word[][]=[[]];
  for(let index=from;index<to;index++){
    const raw=tokens[index][0],override=segment.wordStyles?.[index];
    const own=override&&!override.linked&&override.text===raw?override.settings:s;
    const text=(own.uppercase?raw.toLocaleUpperCase('bs'):raw).normalize('NFC');
    let size=clamp(finite(own.fontSizePx,style==='velvetScript'?142:104),12,480)*(own===s?1:clamp(finite(own.fontScale,s.fontScale)/Math.max(1,s.fontScale),.1,4));
    let font='',width=0;
    for(let fit=0;fit<4;fit++){
      font=`${own.italic?'italic ':''}${clamp(finite(own.fontWeight,style==='velvetScript'?400:800),100,900)} ${size}px ${own.fontFamily||(style==='velvetScript'?'"Pinyon Script", cursive':'"Inter Variable", sans-serif')}`;
      ctx.font=font;ctx.letterSpacing=`${size*finite(own.letterSpacing,0)/100}px`;
      width=ctx.measureText(text).width;
      if(width+size*.3<=maxWidth)break;
      size*=maxWidth/(width+size*.35);
    }
    let row=rows.at(-1)!;
    const previous=tokens[index-1],newLine=previous&&segment.text.slice(previous.index!+previous[0].length,tokens[index].index).includes('\n');
    if(row.length&&(newLine||row.reduce((sum,word)=>sum+word.width+gap,0)+width>maxWidth)){row=[];rows.push(row);}
    const spoken=style==='velvetScript';
    row.push({raw,text,index,at:spoken?Math.max(start,starts[index]):start,end,size,width,font,x:0,y:0,settings:own});
  }
  joinOrphanRows(rows,word=>word.text);
  const heights=rows.map(row=>Math.max(...row.map(word=>word.size))*1.55);
  const height=heights.reduce((sum,n)=>sum+n,0),width=Math.max(...rows.map(row=>row.reduce((sum,word)=>sum+word.width,0)+gap*(row.length-1)));
  const outputScale=scale*Math.min(1,ctx.canvas.height*.52/Math.max(1,height*scale));
  let top=-height/2;
  rows.forEach((row,i)=>{
    const rowWidth=row.reduce((sum,word)=>sum+word.width,0)+gap*(row.length-1);
    let left=s.alignment==='left'?-width/2:s.alignment==='right'?width/2-rowWidth:-rowWidth/2;
    row.forEach(word=>{
      const offset=segment.wordOffsets?.[word.index],move=offset?.text===word.raw?offset:undefined;
      word.x=left+(move?move.x*ctx.canvas.width/100/outputScale:0);
      word.y=top+heights[i]*.64+(move?move.y*ctx.canvas.height/100/outputScale:0);
      left+=word.width+gap;
    });top+=heights[i];
  });
  return {rows,words:rows.flat(),width,height,scale:outputScale,start,end};
}

function paintOrbit(ctx:CanvasRenderingContext2D,word:Word,age:number,s:CaptionSettings,decoration=false){
  const life=Math.max(.03,word.end-word.at),duration=Math.min(clamp(finite(s.revealDuration,.5),.08,1.5),life*.48);
  const enter=captionEase(age/Math.max(.03,duration),s.motionCurve??'softStop');
  const fade=1-captionEase((age-(life-Math.min(.25,life*.2)))/Math.max(.015,Math.min(.25,life*.2)),'smooth');
  const strength=clamp(finite(s.orbitEntry,100),0,180)/100,theta=(1-enter)*-.95*strength;
  const dx=Math.sin(theta)*word.size*.7,dy=(1-Math.cos(theta))*word.size*.7-(1-enter)*word.size*.15;
  ctx.save();ctx.translate(word.x+word.width/2+dx,word.y-word.size*.38+dy);ctx.rotate(theta*.2);ctx.scale(1-(1-enter)*.16,1-(1-enter)*.16);
  ctx.globalAlpha*=clamp(age/.045,0,1)*fade;
  const accent=color(s.highlightColor,'#4ee1c6'),second=color(s.orbitColor2,'#ffb573');
  if(decoration){
  const radius=clamp(finite(s.orbitRadius,100),60,150)/100;
  const rx=(word.width/2+word.size*.42)*radius,ry=word.size*.67*radius;
  const phase=Math.max(0,age-duration)*clamp(finite(s.orbitSpeed,1),0,3)*.9;
  if(s.orbitRings!==false){
    ctx.save();ctx.rotate(-.18);ctx.lineWidth=1.2;ctx.strokeStyle=accent;ctx.globalAlpha*=.36;
    if(s.orbitDashes!==false)ctx.setLineDash([word.size*.07,word.size*.045]);
    ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,phase,phase+Math.PI*1.45);ctx.stroke();ctx.setLineDash([]);
    ctx.globalAlpha*=.75;ctx.strokeStyle=second;ctx.beginPath();ctx.ellipse(0,0,rx*1.07,ry*.8,0,-phase,-phase+Math.PI*.56);ctx.stroke();ctx.restore();
  }
  const dots=clamp(Math.round(finite(s.orbitSatellites,2)),0,5);
  for(let i=0;i<dots;i++){
    const a=phase+i*Math.PI*2/Math.max(1,dots),px=Math.cos(a)*rx,py=Math.sin(a)*ry;
    ctx.save();ctx.rotate(-.18);ctx.fillStyle=i%2?second:accent;ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=clamp(finite(s.orbitGlow,50),0,100)*.15;
    ctx.beginPath();ctx.arc(px,py,word.size*(i?.022:.035),0,Math.PI*2);ctx.fill();ctx.restore();
  }
  ctx.restore();return;
  }
  ctx.font=word.font;ctx.letterSpacing=`${word.size*finite(s.letterSpacing,0)/100}px`;ctx.textBaseline='alphabetic';ctx.textAlign='left';
  const baseline=word.size*.38;
  ctx.shadowColor='#051922';ctx.shadowBlur=word.size*.055;ctx.shadowOffsetY=2;
  if((s.outlineWidth??0)>0){ctx.strokeStyle=s.outlineColor;ctx.lineWidth=Math.min(24,s.outlineWidth)*word.size/100;ctx.strokeText(word.text,-word.width/2,baseline);}
  const face=ctx.createLinearGradient(0,-word.size*.5,0,baseline);
  face.addColorStop(0,color(s.textColor,'#f2fbff'));face.addColorStop(.68,color(s.textColor,'#f2fbff'));face.addColorStop(1,accent);
  ctx.fillStyle=face;ctx.fillText(word.text,-word.width/2,baseline);
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.restore();
}

function paintVelvet(ctx:CanvasRenderingContext2D,word:Word,age:number,s:CaptionSettings){
  const life=Math.max(.03,word.end-word.at),duration=Math.min(clamp(finite(s.revealDuration,.7)*.4,.06,.28),life*.45);
  const progress=s.velvetWrite===false?1:captionEase(age/Math.max(.03,duration),'smooth');
  const fade=1-captionEase((age-(life-Math.min(.32,life*.22)))/Math.max(.02,Math.min(.32,life*.22)),'smooth');
  const rise=(1-captionEase(age/Math.max(.04,duration),'softStop'))*word.size*.1;
  ctx.save();ctx.translate(word.x,word.y+rise);ctx.globalAlpha*=clamp(age/.09,0,1)*fade;
  ctx.font=word.font;ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.letterSpacing=`${word.size*finite(s.letterSpacing,0)/100}px`;
  const gold=color(s.highlightColor,'#e8be7a'),ivory=color(s.textColor,'#fff5e5');
  const edge=word.width*progress,pad=word.size*.2;
  ctx.save();ctx.beginPath();ctx.rect(-pad,-word.size*1.1,edge+pad+(progress>=1?pad:0),word.size*1.6);ctx.clip();
  ctx.shadowColor=color(s.velvetShadowColor,'#342034');ctx.shadowBlur=word.size*.075;ctx.shadowOffsetY=word.size*.025;
  if((s.outlineWidth??0)>0){ctx.strokeStyle=s.outlineColor;ctx.lineWidth=Math.min(12,s.outlineWidth)*word.size/100;ctx.strokeText(word.text,0,0);}
  const fill=ctx.createLinearGradient(0,-word.size*.8,word.width,word.size*.1);fill.addColorStop(0,ivory);fill.addColorStop(.45,ivory);fill.addColorStop(1,gold);ctx.fillStyle=fill;ctx.fillText(word.text,0,0);
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  drawTextShine(ctx,word.text,0,0,word.size,s,age);ctx.restore();
  if(s.velvetPenGlow!==false&&progress>0&&progress<.99){
    // A soft nib highlight follows the reveal; the font outline itself remains intact.
    ctx.save();ctx.globalAlpha*=Math.sin(progress*Math.PI)*.7;ctx.fillStyle=gold;ctx.shadowColor=gold;ctx.shadowBlur=word.size*.12;
    ctx.beginPath();ctx.arc(edge,-word.size*.18+Math.sin(progress*Math.PI*2)*word.size*.08,word.size*.019,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  ctx.restore();
}

/** Two distinct authored looks, connected to the common preview and export entry point. */
export function drawSignatureCaption(ctx:CanvasRenderingContext2D,segment:Segment,time:number,style:SignatureStyle,s:CaptionSettings):CaptionBounds|null{
  if(!Number.isFinite(time)||time<segment.start||time>=segment.end||segment.effectOnly)return null;
  const w=ctx.canvas.width,h=ctx.canvas.height;if(!w||!h)return null;
  ctx.save();
  try{
    const layout=arrangeWords(ctx,segment,time,style,s);if(!layout)return null;
    const x=finite(segment.position?.x,finite(s.x,50))*w/100,y=finite(segment.position?.y,finite(s.y,65))*h/100;
    const rotation=finite(s.rotation,0),angle=rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    ctx.translate(x,y);ctx.rotate(angle);ctx.scale(layout.scale,layout.scale);ctx.globalAlpha*=clamp(finite(s.textOpacity,100),0,100)/100;
    const age=time-layout.start,life=layout.end-layout.start;
    if(style==='orbitSignal'){
      const first=layout.words[0];
      const top=Math.min(...layout.words.map(word=>word.y-word.size));
      const bottom=Math.max(...layout.words.map(word=>word.y));
      const left=Math.min(...layout.words.map(word=>word.x));
      const right=Math.max(...layout.words.map(word=>word.x+word.width));
      const size=Math.max(first.size,(bottom-top)/1.34);
      paintOrbit(ctx,{...first,x:left,y:(top+bottom)/2+size*.38,width:right-left,size,index:0},age,s,true);
    }
    const words:CaptionWordBounds[]=[];
    for(const word of layout.words){
      const age=time-word.at;if(age<0)continue;
      if(style==='orbitSignal')paintOrbit(ctx,word,age,word.settings);else paintVelvet(ctx,word,age,word.settings);
      const cx=word.x+word.width/2,cy=word.y-word.size*.34;
      words.push({index:word.index,text:word.raw,x:(x+(cx*cos-cy*sin)*layout.scale)/w*100,y:(y+(cx*sin+cy*cos)*layout.scale)/h*100,width:(word.width+word.size*.3)*layout.scale/w*100,height:word.size*1.35*layout.scale/h*100,rotation});
    }
    // Decorations belong to a row, never to each individual word.
    for(const row of layout.rows){
      const first=row[0],left=Math.min(...row.map(word=>word.x)),right=Math.max(...row.map(word=>word.x+word.width));
      const baseline=Math.max(...row.map(word=>word.y)),size=Math.max(...row.map(word=>word.size));
      const fade=1-captionEase((age-(life-Math.min(.25,life*.2)))/Math.max(.015,Math.min(.25,life*.2)),'smooth');
      ctx.save();ctx.globalAlpha*=clamp(age/.09,0,1)*fade;
      if(style==='velvetScript'&&s.velvetFlourish!==false){
        const duration=Math.min(clamp(finite(s.revealDuration,.7)*.4,.06,.28),life*.45);
        ctx.translate((left+right)/2,baseline-size*.45);
        drawScriptStroke(ctx,right-left,size*.55,Math.max(0,age-duration*.55),{...s,highlightColor:color(s.highlightColor,'#e8be7a'),scriptWidth:clamp(finite(s.velvetFlourishWidth,105),50,160),scriptDrawDuration:Math.min(clamp(finite(s.scriptDrawDuration,.65)*.4,.08,.4),life*.35)});
      }else if(style==='orbitSignal'&&s.orbitLeader!==false){
        const enter=captionEase(age/Math.max(.03,Math.min(finite(s.revealDuration,.5),life*.48)),'softStop');
        const length=(right-left)*.28*clamp(enter,0,1);
        ctx.strokeStyle=color(first.settings.highlightColor,'#4ee1c6');ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(left,baseline+size*.16);ctx.lineTo(left+length,baseline+size*.16);ctx.lineTo(left+length+size*.07,baseline+size*.09);ctx.stroke();
      }
      ctx.restore();
    }
    return words.length?{segmentId:segment.id,x:x/w*100,y:y/h*100,width:Math.min(98,(layout.width+60)*layout.scale/w*100),height:(layout.height+30)*layout.scale/h*100,rotation,words}:null;
  }finally{ctx.restore();}
}
