import {drawTextSurface,drawTextShine,drawGoldTexture} from './text-surface';
import {paintCaptionLightEffects} from './caption-light-effects';
import {drawTextUnderline} from './text-surface';
import {canvasFontWeight,fillCaptionGlyphs} from './caption-font-weight';
import {captionFill,drawCaptionOutlines} from './text-surface';
import type {CaptionSettings,Segment,StyleKey} from '../config/captions/types';
import type {CaptionBounds} from './caption-renderer';
import {captionWordRoles} from './caption-word-roles';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
/** Shared, speech-timed typography. No reference text or frame-dependent state. */
export function drawEditorialCaption(ctx:CanvasRenderingContext2D,segment:Segment,time:number,style:StyleKey,settings:CaptionSettings):CaptionBounds|null{
 if(time<segment.start||time>=segment.end||segment.effectOnly)return null;
 const tokens=segment.text.trim().split(/\s+/).filter(Boolean);if(!tokens.length)return null;
 const w=ctx.canvas.width,h=ctx.canvas.height,u=Math.min(w,h*.8),widthScale=1;
 const x=(segment.position?.x??settings.x)/100*w,y=(segment.position?.y??settings.y)/100*h,rotation=settings.rotation*Math.PI/180;
 const words=tokens.map((text,index)=>({text:settings.uppercase?text.toLocaleUpperCase('bs'):text,index,start:segment.words?.[index]?.start??segment.start+index/tokens.length*(segment.end-segment.start)}));
 const current=Math.max(0,words.findLastIndex(word=>word.start<=time));
 const manual=Object.keys(segment.wordStyles??{}).map(Number),emphasis=manual[0]??(segment.keywordWord!==undefined?captionWordRoles(segment).keyword:settings.emphasisWord!==undefined&&settings.emphasisWord>=0?settings.emphasisWord:captionWordRoles(segment).keyword);
 const base=style==='prismWords'?.25:style==='curvyBackdrop'?.15:style==='trackingStack'?.115:style==='scriptVerbatim'?.085:segment.role==='title'?.20:.05;
 const scale=settings.fontSizePx?settings.fontSizePx*w/1080/(u*base):Math.max(.25,Math.min(6,settings.fontScale/100)),bounds:CaptionBounds['words']=[];
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.lineJoin='round';
 const draw=(text:string,index:number,left:number,top:number,size:number,family:string,weight:number,color:string,spacing=0,visible=text)=>{
  const wordSettings=style==='scriptVerbatim'&&(index===emphasis||manual.includes(index))?{...settings,...settings.secondaryStyle}:settings;
  weight=(style==='scriptVerbatim'&&(index===emphasis||manual.includes(index))?settings.secondaryStyle?.fontWeight:wordSettings.fontWeight)??weight;
  spacing+=size*(wordSettings.letterSpacing??0)/100;
  ctx.font=`${wordSettings.italic?'italic ':''}${canvasFontWeight(family,weight)} ${size}px ${family}`;ctx.letterSpacing=`${spacing}px`;ctx.wordSpacing=`${size*(wordSettings.wordSpacing??0)/100}px`;
  const fit=Math.min(1,w*.88*widthScale/Math.max(1,ctx.measureText(text).width));size*=fit;spacing*=fit;
  ctx.font=`${canvasFontWeight(family,weight)} ${size}px ${family}`;ctx.letterSpacing=`${spacing}px`;ctx.wordSpacing=`${size*(wordSettings.wordSpacing??0)/100}px`;
  const m=ctx.measureText(text),height=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent,baseline=top+m.actualBoundingBoxAscent;
  drawCaptionOutlines(ctx,visible,left,baseline,size,wordSettings);
  const faceSettings=wordSettings;
  paintCaptionLightEffects(ctx,visible,left,baseline,size,wordSettings,time,()=>{ctx.save();ctx.globalAlpha*=Math.max(0,Math.min(1,(wordSettings.textOpacity??100)/100));ctx.fillStyle=captionFill(ctx,text,left,baseline,size,faceSettings,color,time);fillCaptionGlyphs(ctx,visible,left,baseline,size,weight);if(wordSettings.fillTexture==='goldReference')drawGoldTexture(ctx,visible,left,baseline,size,{...wordSettings,textColor:wordSettings.fillTextureColor??'#ffbc38',highlightColor:wordSettings.fillTextureColor2??'#ffdd54'});drawTextSurface(ctx,visible,left,baseline,size,wordSettings);drawTextShine(ctx,visible,left,baseline,size,wordSettings,time-segment.start);if(wordSettings.underline||wordSettings.textUnderline||wordSettings.textStrike)drawTextUnderline(ctx,visible,left,baseline,size,{...wordSettings,textUnderline:wordSettings.textUnderline||wordSettings.underline,textUnderlineColor:wordSettings.textUnderlineColor??wordSettings.underlineColor??wordSettings.textColor},time-segment.start);ctx.restore();});
  const bx=left+m.width/2,by=top+height/2;
  bounds.push({index,text,x:(x+bx*Math.cos(rotation)-by*Math.sin(rotation))/w*100,y:(y+bx*Math.sin(rotation)+by*Math.cos(rotation))/h*100,width:m.width/w*100,height:height/h*100,rotation:settings.rotation});
  minX=Math.min(minX,left);maxX=Math.max(maxX,left+m.width);minY=Math.min(minY,top);maxY=Math.max(maxY,top+height);
  return {width:m.width,height,size};
 };
 if(style==='prismWords'){
  const word=words[current],size=u*.25*scale;
  ctx.font=`${settings.fontWeight||900} ${size}px ${settings.fontFamily}`;
  const width=Math.min(w*.9*widthScale,ctx.measureText(word.text).width);
  draw(word.text,word.index,-width/2,-size*.4,size,settings.fontFamily,settings.fontWeight||900,settings.textColor);
 }else if(style==='underlinedEditorial'&&segment.role==='title'){
  const text=words.map(word=>word.text).join(' '),size=u*.20*scale;
  ctx.font=`400 ${size}px ${settings.secondaryFontFamily||'Georgia, serif'}`;const width=Math.min(w*.92*widthScale,ctx.measureText(text).width);
  const row=draw(text,0,-width/2,-size*.5,size,settings.secondaryFontFamily||'Georgia, serif',settings.fontWeight??400,settings.textColor);
  ctx.strokeStyle=settings.underlineColor||settings.textColor;ctx.lineWidth=Math.max(2,u*.007);ctx.beginPath();ctx.moveTo(-w*.60,-size*.5+row.height+u*.025);ctx.lineTo(w*.60,-size*.5+row.height+u*.025);ctx.stroke();
 }else if(style==='curvyBackdrop'){
  const size=u*.15*scale,normal=words.filter(word=>word.index!==emphasis&&!segment.hiddenTitleWords?.includes(word.index)),key=words[Math.min(words.length-1,emphasis)];
  ctx.font=`${settings.fontWeight||900} ${size*1.85}px ${settings.fontFamily}`;const blockWidth=key?Math.min(w*.88*widthScale,ctx.measureText(key.text.toLocaleUpperCase('bs')).width):w*.8;
  if(normal.length){const text=normal.map(word=>word.text).join(' '),visible=normal.filter(word=>time>=word.start).map(word=>word.text).join(' ');ctx.font=`400 ${size*.65}px ${settings.secondaryFontFamily||'"Pinyon Script", cursive'}`;draw(text,normal[0].index,-blockWidth/2,-size*.52,size*.65,settings.secondaryFontFamily||'"Pinyon Script", cursive',400,settings.textColor,0,visible);}
  if(key&&time>=key.start&&!segment.hiddenTitleWords?.includes(key.index)){const text=key.text.toLocaleUpperCase('bs'),large=size*1.85;ctx.font=`900 ${large}px ${settings.fontFamily}`;const width=Math.min(w*.88*widthScale,ctx.measureText(text).width);draw(text,key.index,-width/2,0,large,settings.fontFamily,settings.fontWeight||900,settings.highlightColor);}
 }else if(style==='trackingStack'){
  const page=Math.floor(current/6),group=words.slice(page*6,page*6+6),size=u*.115*scale;
  group.forEach((word,row)=>{if(time<word.start||segment.hiddenTitleWords?.includes(word.index))return;const p=clamp((time-word.start)/.32),weight=settings.fontWeight||800;
   ctx.font=`${weight} ${size}px ${settings.fontFamily}`;ctx.letterSpacing='0px';const measured=ctx.measureText(word.text).width,fs=size*Math.min(1,w*.83/Math.max(1,measured));
   const available=Math.max(0,(w*.87-measured*fs/size)/Math.max(1,Array.from(word.text).length));
   const spacing=Math.min(available,fs*.38*(1-p)**3+(-.055*fs));
   ctx.save();ctx.globalAlpha*=clamp((time-word.start)/.09);draw(word.text,word.index,0,(row-group.length/2)*size*.86,fs,settings.fontFamily,weight,settings.textColor,spacing);ctx.restore();});
 }else if(style==='scriptVerbatim'){
  // One word per row, with reserved geometry so later words never shift earlier rows.
  const page=Math.floor(current/6),group=words.slice(page*6,page*6+6),size=u*.085*scale;
  const rows=group.map(word=>{const special=word.index===emphasis||manual.includes(word.index);return {word,special,fs:special&&settings.secondaryStyle?.fontSizePx?settings.secondaryStyle.fontSizePx*w/1080:size*(special?3.1*(settings.secondaryFontScale??160)/160:1),height:special&&settings.secondaryStyle?.fontSizePx?settings.secondaryStyle.fontSizePx*w/1080*.8:size*(special?2.2*(settings.secondaryFontScale??160)/160:1.05)};});
  let top=-rows.reduce((sum,row)=>sum+row.height,0)/2;
  for(const {word,special,fs,height} of rows){
   const family=special?(settings.secondaryFontFamily||'"Pinyon Script", cursive'):settings.fontFamily;
   const letters=Array.from(word.text),age=time-word.start,duration=special?.22:.36;
   if(age>=0&&!segment.hiddenTitleWords?.includes(word.index)){
    const next=words[word.index+1]?.start??segment.end;
    const p=clamp(age/Math.min(duration,Math.max(.06,(next-word.start)*.85)));
    const visible=letters.slice(0,Math.min(letters.length,Math.ceil(p*letters.length))).join('');
    draw(word.text,word.index,0,top,fs,family,special?(settings.secondaryStyle?.fontWeight||400):settings.fontWeight||600,special?settings.highlightColor:settings.textColor,0,visible);
   }
   top+=height;
  }
 }else{
  const size=u*.05*scale,text=words.filter(word=>word.start<=time&&!segment.hiddenTitleWords?.includes(word.index)).map(word=>word.text).join(' ');
  if(text){ctx.font=`600 ${size}px ${settings.fontFamily}`;const width=Math.min(w*.85*widthScale,ctx.measureText(text).width);draw(text,0,-width/2,0,size,settings.fontFamily,settings.fontWeight||600,settings.textColor);}
 }
 ctx.restore();if(!Number.isFinite(minX))return null;
 const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
 return {x:(x+cx*Math.cos(rotation)-cy*Math.sin(rotation))/w*100,y:(y+cx*Math.sin(rotation)+cy*Math.cos(rotation))/h*100,width:(maxX-minX)/w*100,height:(maxY-minY)/h*100,rotation:settings.rotation,segmentId:segment.id,words:bounds};
}
