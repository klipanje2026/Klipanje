import {captionPlaybackTime} from './caption-clock';
import {metallicCamera} from './metallic-compact';
import {premiumCamera} from './premium-orange';
import {captionFill,drawTextUnderline,drawTextSurface,drawTextShine,captionEase,drawBorderMist} from './text-surface';
import type {CaptionSettings,Segment,StyleKey} from '../config/captions/types';
import type {CaptionBounds} from './caption-renderer';

const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=(v:number)=>1-Math.pow(1-clamp(v),3);
/** Speech timestamps drive rows; no reference text, footage or masks are stored here. */
function rowsFor(segment:Segment,settings:CaptionSettings){
 const words=segment.text.trim().split(/\s+/).filter(Boolean);
 const size=segment.wordsSeparated||settings.wordMode==='single'?1:Math.round(clamp(settings.revealGroupSize??2,1,4));
 const duration=Math.max(.01,segment.end-segment.start);
 return Array.from({length:Math.ceil(words.length/size)},(_,row)=>{
  const index=row*size, end=Math.min(words.length,index+size);
  const start=clamp(segment.words?.[index]?.start??segment.start+index/words.length*duration,segment.start,segment.end);
  return {text:words.slice(index,end).join(' '),index,start};
 });
}
export function glassZoom(segment:Segment,time:number,settings:CaptionSettings){
 if(!segment.text.trim()||settings.glassCamera===false||time<segment.start||time>=segment.end)return 1;
 // One continuous camera path: in, slight retreat, out, slight return.
 // Quintic interpolation has zero speed and acceleration at every turnaround.
 const smooth=(v:number)=>{const x=clamp(v);return x*x*x*(x*(x*6-15)+10);};
 const amount=clamp((settings.glassIntensity??100)/100,0,1.5);
 const elapsed=time-segment.start,duration=segment.end-segment.start;
 const points=[0,.085,.068,.015,.03,0],phase=(elapsed%8)/8*5;
 const index=Math.min(4,Math.floor(phase));
 const zoom=points[index]+(points[index+1]-points[index])*smooth(phase-index);
 const envelope=smooth(elapsed/1.2)*smooth((duration-elapsed)/1.2);
 return 1+zoom*amount*envelope;
}
export function dynamicGlassZoom(segments:Segment[],style:StyleKey,settings:CaptionSettings,time:number){
 const configFor=(s:Segment)=>{const own=(s.separateStyle===false?undefined:s.detachedStyle)||s.laneStyle;return {style:own?.style||style,settings:own?.settings||settings};};
 const ordered=segments.filter(s=>s.role!=='title'&&!s.effectOnly&&s.text.trim()).sort((a,b)=>a.start-b.start);
 const index=ordered.findIndex(s=>time>=s.start&&time<s.end);
 // Bridge short pauses within a continuous run instead of resetting on each caption.
 const runs:{start:number;end:number;settings:CaptionSettings}[]=[];
 let interrupted=false;
 for(const segment of ordered){
  const config=configFor(segment);
  if(config.style!=='dynamicGlass'||config.settings.glassCamera===false){interrupted=true;continue;}
  const previous=runs.at(-1);
  if(previous&&!interrupted&&segment.start-previous.end<=.35&&(previous.settings.glassIntensity??100)===(config.settings.glassIntensity??100))previous.end=Math.max(previous.end,segment.end);
  else runs.push({start:segment.start,end:segment.end,settings:config.settings});
  interrupted=false;
 }
 if(index>=0){const active=configFor(ordered[index]);if(active.style!=='dynamicGlass'||active.settings.glassCamera===false)return 1;}
 const run=runs.find(r=>time>=r.start&&time<r.end);
 return run?glassZoom({id:'camera-run',text:'camera',start:run.start,end:run.end},time,run.settings):1;
}

export function captionCamera(segments:Segment[],style:StyleKey,settings:CaptionSettings,time:number){
 const premium=premiumCamera(segments,style,settings,time),metallic=metallicCamera(segments,style,settings,time);
 return {scale:premium.scale*metallic.scale*dynamicGlassZoom(segments,style,settings,time),dx:premium.dx+metallic.dx,dy:premium.dy+metallic.dy};
}

export function glassVideoTransform<T extends {scale?:number;x?:number;y?:number}>(transform:T,doc:{segments:Segment[];activeStyle:StyleKey;captionSettings:CaptionSettings}|undefined,time:number):T{
 if(!doc)return transform;
 const camera=captionCamera(doc.segments,doc.activeStyle,doc.captionSettings,captionPlaybackTime(time));
 return {...transform,scale:(transform.scale??1)*camera.scale,x:(transform.x??50)+camera.dx*100,y:(transform.y??50)+camera.dy*100};
}
function mix(hex:string,other:string,t:number){
 const a=/^#[0-9a-f]{6}$/i.test(hex)?hex:'#477aff';
 return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(other.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
}
export function drawDynamicGlass(ctx:CanvasRenderingContext2D,segment:Segment,time:number,settings:CaptionSettings,part='all',headBottom?:number):CaptionBounds|null{
 if(segment.effectOnly||time<segment.start||time>=segment.end)return null;
 const rows=rowsFor(segment,settings);if(!rows.length)return null;
 const current=Math.max(0,rows.reduce((last,row,index)=>row.start<=time?index:last,-1)),page=Math.floor(current/3),visible=rows.slice(page*3,page*3+3);
 const w=ctx.canvas.width,h=ctx.canvas.height,unit=Math.min(w,h*.8),intensity=clamp((settings.glassIntensity??100)/100,0,1.5);
 const centerX=(segment.position?.x??settings.x)/100*w;
 // The group anchor remains the editable main-text position, including the 75% preset anchor.
 const anchorY=(segment.position?.y??settings.y)/100*h;
 const gap=Math.min(h*.105,unit*.19),top=segment.role==='title'?anchorY:anchorY-h*.47;
 const lastStart=visible[2]?.start??segment.end,shift=ease((time-lastStart)/.24)*gap*.42;
 const words:CaptionBounds['words']=[];
 ctx.save();ctx.translate(centerX,anchorY);ctx.rotate(settings.rotation*Math.PI/180);ctx.translate(-centerX,-anchorY);
 visible.forEach((row,i)=>{
  if(time<row.start)return;
  const front=i===2||segment.role==='title';if(part==='background'&&front||part==='foreground'&&!front)return;
  const age=time-row.start,entrance=Math.min(settings.revealDuration??.18,Math.max(.04,(segment.end-row.start)*.3)),p=clamp(age/entrance),e=settings.motionCurve?captionEase(p,settings.motionCurve):ease(p);
  const out=ease((time-(segment.end-.1))/.1),colored=i>0;
  const text=settings.uppercase?row.text.toLocaleUpperCase():row.text;
  let font=settings.fontSizePx?settings.fontSizePx*w/1080*(colored?.17/.105:1):unit*(colored?.17:.105)*clamp(settings.fontScale/100,.4,6);
  ctx.font=`${settings.fontWeight??900} ${font}px ${settings.fontFamily}`;
  font*=Math.min(1,w*.88*Math.max(1,settings.fontScale/250)/Math.max(1,ctx.measureText(text).width));ctx.font=`${settings.fontWeight??900} ${font}px ${settings.fontFamily}`;
  let y=top+i*gap-shift+(front&&segment.role!=='title'?gap*.45:0)+(segment.wordOffsets?.[row.index]?.y??0)/100*h;
  if(i===2&&segment.role!=='title'&&headBottom!==undefined){
   const floor=(headBottom+.035)*h;
   const available=h*.95-floor;
   if(available<h*.025)return;
   font=Math.min(font,available/1.8);ctx.font=`${settings.fontWeight??900} ${font}px ${settings.fontFamily}`;
   y=Math.max(y,floor+font*.85);y=Math.min(y,h*.95-font*.65);
  }
  ctx.letterSpacing=`${font*(settings.letterSpacing??0)/100}px`;ctx.wordSpacing=`${font*(settings.wordSpacing??0)/100}px`;
  const width=ctx.measureText(text).width;
  const offsetX=(segment.wordOffsets?.[row.index]?.x??0)/100*w;
  const dx=((colored?1:-1)*w*.3*(1-e)+w*.3*out)*intensity,dy=h*.09*(1-e)*intensity;
  const scale=1+(-.52*(1-e)+.16*Math.sin(p*Math.PI))*intensity;
  ctx.save();ctx.translate(centerX+dx+offsetX,y+dy);ctx.rotate((colored?12:-11)*(1-e)*intensity*Math.PI/180);ctx.scale(scale,scale);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=clamp(age/.075)*(1-out)*(colored?.83:.96);
  const phase=colored?Math.sin(age*2.7)*font*.105:0;
  const gradient=ctx.createLinearGradient(0,-font*.5+phase,0,font*.5+phase);
  if(colored){
   const base=i===1?settings.highlightColor:(settings.glassAccentColor||'#ff880c');
   const colors=[mix(base,'#ffffff',.25),base,mix(base,'#ffffff',.55),mix(base,'#000000',.28),mix(base,'#ffffff',.3),base];
   [0,.24,.43,.51,.66,1].forEach((stop,j)=>gradient.addColorStop(stop,colors[j]));
  }else{gradient.addColorStop(0,settings.textColor);gradient.addColorStop(1,mix(settings.textColor,'#c6d5eb',.15));}
  // Edge-only depth keeps footage visible through the glass face.
  ctx.lineWidth=Math.max(.6,font*.012);ctx.strokeStyle='rgba(10,18,45,.4)';ctx.strokeText(text,1,2);
  ctx.fillStyle=captionFill(ctx,text,0,0,font,settings,gradient);
  if(p<.8&&intensity>0){ctx.save();ctx.globalAlpha*=.14*(1-p);ctx.fillText(text,-font*.12*(1-p),font*.06*(1-p));ctx.fillText(text,-font*.24*(1-p),font*.1*(1-p));ctx.restore();}
  if(settings.borderMist)drawBorderMist(ctx,-width/2-font*.1,-font*.6,width+font*.2,font*1.2,font,age,settings);
  ctx.fillText(text,0,0);
  if(colored && settings.shineMode===undefined){
   const sweep=(age*.7%1.7)-.35,x=-width*.5+sweep*width;
   const shine=ctx.createLinearGradient(x-font*.2,-font*.5,x+font*.5,font*.5);
   shine.addColorStop(0,'#ffffff00');shine.addColorStop(.5,'#ffffff88');shine.addColorStop(1,'#ffffff00');ctx.fillStyle=shine;ctx.fillText(text,0,0);
   ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=Math.max(.4,font*.006);ctx.strokeText(text,0,-.7);
  }
  ctx.textAlign='left';
  drawTextSurface(ctx,text,-width/2,0,font,{...settings,textColor:colored?(i===1?settings.highlightColor:(settings.glassAccentColor||'#ff880c')):settings.textColor});
  drawTextShine(ctx,text,-width/2,0,font,settings,age);
  if(settings.underline||settings.textUnderline)drawTextUnderline(ctx,text,-width/2,0,font,{...settings,textUnderline:true,textUnderlineColor:settings.textUnderlineColor??settings.underlineColor??settings.textColor},age);
  const tokens=text.split(/\s+/),space=ctx.measureText(' ').width,tokenWidths=tokens.map(token=>ctx.measureText(token).width),total=tokenWidths.reduce((sum,value)=>sum+value,0)+space*(tokens.length-1),fit=width/Math.max(1,total);
  let cursor=-width/2;
  tokens.forEach((token,index)=>{const tokenWidth=tokenWidths[index]*fit;words.push({index:row.index+index,text:token,x:(centerX+cursor+tokenWidth/2)/w*100,y:y/h*100,width:tokenWidth/w*100,height:font/h*110,rotation:settings.rotation});cursor+=tokenWidth+space*fit;});
  ctx.restore();
 });
 ctx.restore();
 return {x:centerX/w*100,y:anchorY/h*100,width:90,height:Math.min(65,(gap*3+h*.15)/h*100),rotation:settings.rotation,segmentId:segment.id,words};
}
