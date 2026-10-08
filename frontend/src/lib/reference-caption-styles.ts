import {drawScriptStroke} from './caption-script-stroke';
import {drawTextUnderline,drawTextSurface,drawTextShine,captionEase,drawBorderMist,drawSerifTextures,serifTexturesReady,drawSerifGlyphSmoke,drawPresetFace,drawFeatheredFace} from './text-surface';
import type {CaptionSettings,Segment,StyleKey} from '../config/captions/types';
import type {CaptionBounds} from './caption-renderer';
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
/** Independent reconstruction from the supplied preview, never runs cached CapCut scripts. */
export function drawReferenceCaption(ctx:CanvasRenderingContext2D,segment:Segment,time:number,style:StyleKey,settings:CaptionSettings):CaptionBounds|null{
 if(segment.effectOnly||time<segment.start||time>=segment.end)return null;
 if(style==='testSerif'&&settings.textureBackground!==false&&!serifTexturesReady())return null;
 const text=segment.text.trim().split(/\s+/);if(!text[0])return null;
 const count=settings.wordMode==='all'?text.length:Math.max(1,Math.min(6,Math.round(settings.revealGroupSize??2)));
 ctx.save();
 ctx.letterSpacing=`${Math.min(ctx.canvas.width,ctx.canvas.height)*.085*settings.fontScale/100*(settings.letterSpacing??0)/100}px`;
 const wordTimes=text.map((_,i)=>segment.words?.[i]?.start??segment.start+i/text.length*(segment.end-segment.start));
 const current=Math.max(0,wordTimes.reduce((last,start,i)=>start<=time?i:last,-1));
 const start=Math.floor(current/count)*count,chosen=text.slice(start,start+count);
 const age=time-wordTimes[start],duration=Math.min(settings.revealDuration??.2,Math.max(.04,(segment.end-wordTimes[start])*.3));
 const reveal=clamp(age/duration),w=ctx.canvas.width,h=ctx.canvas.height;
 const x=(segment.position?.x??settings.x)/100*w,y=(segment.position?.y??settings.y)/100*h;
 let size=settings.fontSizePx?settings.fontSizePx*w/1080:Math.min(w*.1,h*.085)*settings.fontScale/100;
 const script=style==='captionsScript';
 const family=settings.fontFamily;
 const words=chosen.map((t,i)=>({text:settings.uppercase?t.toLocaleUpperCase():t,index:start+i}));
 const setFont=(i:number)=>{const secondary=script&&i===words.length-1?settings.secondaryStyle:undefined;ctx.letterSpacing=`${size*(settings.letterSpacing??0)/100}px`;ctx.font=`${(script&&i===words.length-1?secondary?.fontWeight??700:settings.fontWeight??800)} ${size*(script&&i===words.length-1?(settings.secondaryFontScale??160)/160:1)}px ${script&&i===words.length-1?(settings.secondaryFontFamily||'"Caveat Variable", cursive'):family}`;};
 const measure=()=>words.map((word,i)=>{setFont(i);return ctx.measureText(word.text).width;});
 let widths=measure(),gap=size*(.24+(settings.wordSpacing??0)/100),total=widths.reduce((a,b)=>a+b,0)+gap*(words.length-1);
 const maxTextWidth=w*.86;
 if(total>maxTextWidth){size*=maxTextWidth/total;widths=measure();gap=size*(.24+(settings.wordSpacing??0)/100);total=widths.reduce((a,b)=>a+b,0)+gap*(words.length-1);}
 ctx.translate(x,y);ctx.rotate(settings.rotation*Math.PI/180);ctx.globalAlpha=style==='testSerif'||style==='smokeSerif'?1:reveal;
 const eased=captionEase(reveal,settings.motionCurve??'softStop');
 if(style!=='testSerif'&&style!=='smokeSerif')ctx.scale(.96+.04*eased,.96+.04*eased);
 if(settings.reveal==='rise')ctx.translate(0,size*.65*(1-eased));
 if(settings.reveal==='slideLeft'||settings.reveal==='slideFall')ctx.translate(-size*(1-eased),0);
 if(settings.reveal==='zoom'||settings.reveal==='pop'){const scale=.65+.35*eased;ctx.scale(scale,scale);}
 if(settings.reveal==='softBlur'&&style!=='testSerif')ctx.filter=`blur(${Math.max(0,1-eased)*size*.13}px)`;
 if(settings.reveal==='letters'){ctx.beginPath();ctx.rect(-total/2-size*.1,-size*2,(total+size*.2)*reveal,size*4);ctx.clip();}
 ctx.textBaseline='middle';ctx.textAlign='left';let cursor=settings.alignment==='left'?-w*.43:settings.alignment==='right'?w*.43-total:-total/2;
 const bounds:CaptionBounds['words']=[];
 if(settings.borderMist??!script){ctx.save();if(style==='smokeSerif')ctx.filter=`blur(${size*.024}px)`;if(style==='smokeSerif'){drawBorderMist(ctx,-total/2-size*.12,-size*.57,total+size*.24,size*1.14,size,(settings.smokeDuration??1.2)*.8,{...settings,smokeDuration:(settings.smokeDuration??1.2)*.8});ctx.globalAlpha*=.3;}drawBorderMist(ctx,-total/2-size*.12,-size*.57,total+size*.24,size*1.14,size,age,style==='smokeSerif'?{...settings,smokeDuration:(settings.smokeDuration??1.2)*.8}:settings);ctx.restore();}
 if(style==='testSerif'){setFont(0);const groupDuration=Math.max(.04,(wordTimes[start+count]??segment.end)-wordTimes[start]);ctx.save();ctx.filter=`blur(${size*.025}px)`;drawSerifTextures(ctx,words.map(word=>word.text).join(' '),-total/2,0,size,Math.max(0,age),{...settings,smokeDuration:Math.min(settings.smokeDuration??2.1,groupDuration*.85)},total);ctx.restore();}
 words.forEach((word,i)=>{
  setFont(i);
  if(style==='testSerif'){const groupDuration=Math.max(.04,(wordTimes[start+count]??segment.end)-wordTimes[start]);drawSerifGlyphSmoke(ctx,word.text,cursor,0,size,Math.max(0,age),{...settings,smokeDuration:Math.min(settings.smokeDuration??2.1,groupDuration*.85)});}

  const paintFace=(ctx:CanvasRenderingContext2D)=>{
  if(settings.fillTexture&&settings.fillTexture!=='none'||settings.outlineLayers?.length||settings.textGradient){drawPresetFace(ctx,word.text,cursor,0,size,settings,settings.textColor);}
  else if(script){if(settings.outlineWidth>0){ctx.strokeStyle=settings.outlineColor;ctx.lineWidth=settings.outlineWidth*size/17;ctx.strokeText(word.text,cursor,0);}ctx.fillStyle=i===words.length-1?settings.highlightColor:settings.textColor;ctx.shadowColor=settings.highlightColor;ctx.shadowBlur=i===words.length-1?size*.22*(settings.glowIntensity/120):0;ctx.fillText(word.text,cursor,0);}
  else if(style==='testSerif'){
   ctx.save();ctx.filter='none';ctx.fillStyle=settings.textColor;ctx.strokeStyle='#fff';ctx.shadowBlur=0;ctx.lineWidth=Math.max(.4,size*.014)+settings.outlineWidth*size/34;ctx.strokeText(word.text,cursor,0);ctx.fillText(word.text,cursor,0);ctx.restore();
  }
  else{
   ctx.save();ctx.shadowColor=settings.highlightColor;ctx.shadowBlur=size*.13;ctx.lineWidth=size*.035;ctx.strokeStyle=settings.highlightColor;ctx.globalAlpha*=.25;ctx.strokeText(word.text,cursor,0);ctx.restore();
   const gradient=ctx.createLinearGradient(0,-size*.5,0,size*.5);gradient.addColorStop(0,settings.textColor);gradient.addColorStop(.5,'#a6aab1');gradient.addColorStop(1,'#414650');
   ctx.fillStyle=gradient;ctx.strokeStyle=settings.highlightColor;ctx.lineWidth=Math.max(.6,size*.022)+settings.outlineWidth*size/34;ctx.strokeText(word.text,cursor,0);ctx.fillText(word.text,cursor,0);
  }

  if(settings.underline||settings.textUnderline)drawTextUnderline(ctx,word.text,cursor,0,size,{...settings,textUnderline:true,textUnderlineColor:settings.textUnderlineColor??settings.underlineColor??settings.textColor},age);
  drawTextSurface(ctx,word.text,cursor,0,size,settings);
  drawTextShine(ctx,word.text,cursor,0,size,settings,time-segment.start);
  };
  if(style==='smokeSerif')drawFeatheredFace(ctx,word.text,cursor,0,size,paintFace);else paintFace(ctx);
  bounds.push({index:word.index,text:word.text,x:(x+cursor+widths[i]/2)/w*100,y:y/h*100,width:widths[i]/w*100,height:size/h*120,rotation:settings.rotation});cursor+=widths[i]+gap;
 });
 if(script){
  drawScriptStroke(ctx,total,size,age,settings);
 }
 ctx.restore();return {x:x/w*100,y:y/h*100,width:total/w*100,height:size/h*(script?320:150),rotation:settings.rotation,segmentId:segment.id,words:bounds};
}
