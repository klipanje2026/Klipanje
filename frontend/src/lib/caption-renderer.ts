import {testRenderStyle} from '../config/captions/test-styles';
import {joinOrphanRows} from './collection/caption-layout.mjs';
import {compactDisplayCaption,originalDisplayWordIndex} from './caption-display-text';
import {isPresetCaptionStyle} from '../config/captions/style-library';
import {hasCaptionAccent,animateCaptionAccent} from './caption-accent-motion';
import {isCollectionStyle} from '../config/captions/collection';
import {drawCollectionCaption,collectionCaptionRevision} from './collection-captions';
import {drawSignatureCaption,signatureCaptionRevision} from './signature-caption-styles';
import {drawInkImpact,inkImpactRevision} from './ink-impact';
import {drawPrismFold,prismFoldRevision} from './prism-fold';
import {drawNeonRiot,neonRiotRevision} from './neon-riot';
import {isNeonRiotStyle} from '../config/captions/neon-riot-variants';
import {drawCaptionFrames} from './caption-frames';
import {paintCaptionBackground} from './caption-background';
import {hasCaptionTransform,transformCaption,animateCaptionEffect,renderCaptionDepth} from './caption-transform';
import {hasCaptionLightEffects} from './caption-light-effects';
import {captionCapabilities} from './caption-capabilities';
import {normalizeCaptionFont} from './caption-font-weight';
import {captionWordRoles,captionRenderSegment,ignoresCaptionTitles,ownCaptionLayout} from './caption-word-roles';
import {drawEditorialCaption} from './editorial-caption-styles';
import {drawMetallicCompact} from './metallic-compact';
import {drawPremiumOrange} from './premium-orange';
import {drawProgressiveCaption} from './progressive-caption';
import {drawReferenceCaption} from './reference-caption-styles';
import {drawDynamicGlass} from './dynamic-glass';
import {illustratedHeaders,drawIllustratedFrame,drawIllustratedTitle} from './illustrated-caption-styles';
import {drawTextSurface,drawTextShine,captionEase,drawBorderMist,drawPresetFace,captionTextureRevision} from './text-surface';
import { captionMotion } from '../config/captions/animations';
import { captionEffects } from '../config/captions/effects';
import type { CaptionSettings, Segment, StyleKey } from "../config/captions/presets";

export type CaptionWordBounds = { index: number; text: string; x: number; y: number; width: number; height: number; rotation: number };
export type CaptionBounds = { x: number; y: number; width: number; height: number; rotation: number; segmentId: string; words: CaptionWordBounds[] };
type Word = { text: string; index: number; breakBefore?: boolean };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const includes = (style: StyleKey, values: StyleKey[]) => values.includes(style);

export function activeWordIndex(segment: Segment, time: number, count: number) {
  if (!count) return -1;
  if (segment.words?.length) {
    // A pause between words must not keep the previous word on screen in single-word mode.
    return segment.words.findIndex((word, i) => i < count && time >= word.start && time < word.end);
  }
  if (time < segment.start || time >= segment.end) return -1;
  return Math.min(count - 1, Math.floor((time - segment.start) / Math.max(.01, segment.end - segment.start) * count));
}

/** Stable frames reuse their rendered layer; only timed words/animations need repainting. */
export function captionFrameKey(segment: Segment | undefined, time: number, style: StyleKey, settings: CaptionSettings) {
  if (!segment) return "empty";
  const ownStyle=(segment.separateStyle===false?undefined:segment.detachedStyle)||segment.laneStyle;if(ownStyle){style=ownStyle.style;settings=ownStyle.settings;}
  style=testRenderStyle(style);
  if(isCollectionStyle(style))return JSON.stringify([collectionCaptionRevision(),style,segment,settings,Math.floor(time*60)]);
  if([settings,settings.secondaryStyle,settings.titleAppearance].some(s=>s&&hasCaptionAccent(s)))return JSON.stringify([captionTextureRevision(),neonRiotRevision(),prismFoldRevision(),inkImpactRevision(),signatureCaptionRevision(),style,segment,settings,Math.floor(time*60)]);
  if(style==='orbitSignal'||style==='velvetScript')return JSON.stringify([signatureCaptionRevision(),style,segment,settings,Math.floor(time*60)]);
  if(style==='inkImpact')return JSON.stringify([inkImpactRevision(),style,segment,settings,Math.floor(time*60)]);
  if(style==='prismFold')return JSON.stringify([prismFoldRevision(),style,segment,settings,Math.floor(time*60)]);
  if(isNeonRiotStyle(style))return JSON.stringify([neonRiotRevision(),style,segment,settings,Math.floor(time*60)]);
  const count = segment.text.trim().split(/\s+/).length;
  const active = activeWordIndex(segment, time, count);
  const single = settings.wordMode === "single" || style === "word";
  const timed = !!settings.displayWordCount || single || ['spoken','highlight'].includes(settings.wordMode) || (style === 'mixedFocus' && settings.emphasisWord === -1) || includes(style, captionEffects.timedWords)
    || (style.startsWith("duo") && settings.wordColorMode === "active");
  const wordStart = segment.words?.[active]?.start ?? segment.start + Math.max(0, active) * (segment.end - segment.start) / Math.max(1, count);
  const age = time - (single ? wordStart : segment.start);
  const moving = [settings,settings.secondaryStyle,settings.titleAppearance].some(s=>s&&(s.captionFrame||s.depthMode==='floating'||(!!s.depthMode&&s.depthMode!=='none'&&(s.depthMotion??0)>0)||(!!s.specialEffect&&s.specialEffect!=='none'&&s.specialEffectStrength!==0)||['fire','water','video','ocean','lava','smoke','hologram','cyberpunk','matrix','rgbSplit','digitalNoise','aiGlow','liquidGlass','holographicFoil','iridescent','oilSlick','aurora','rgbShift','glassNeon','liquidMetal'].includes(s.fillTexture||''))) || settings.glowMode==='pulsing' || settings.secondaryStyle?.glowMode==='pulsing' || settings.titleAppearance?.glowMode==='pulsing' || settings.borderMist || (settings.shineMode && settings.shineMode!=='none') || segment.role==='title' || includes(style,["scriptVerbatim","underlinedEditorial","curvyBackdrop","prismWords","trackingStack","metallicCompactV2","premiumOrangeV4","waveWords","terminalType","testSerif","captionsScript","smokeSerif","dynamicGlass","comicLetterBounce","sketchNote","lensFrame","vistaRise","popCollage","primeFrame","editorialLight","paperCut","stackedHeadlines","prism","verticalTitle","sweepTitle","readingFade","blurReading","mistWords","prismPop","newsHighlight","bigKeyword"]) || (settings.reveal && settings.reveal !== 'none') || settings.underline || settings.animation === "pulse"
    || ((settings.animation === "pop" || settings.animation === "fade" || (single && style!=="tripleGothic" && settings.animation === "none")) && age < Math.max(captionMotion.popDuration, captionMotion.fadeDuration))
    || (style === "bounce" && time - wordStart < Math.max(captionMotion.bounceFrameDuration, captionMotion.bounceDuration))
    || (style === "typewriter" && time < segment.start + (segment.end - segment.start) * captionMotion.typewriterFraction);
  return JSON.stringify([captionTextureRevision(),segment.id, segment.text, timed ? active : null,
    segment.wordStyles ? Math.floor(time * captionMotion.fps) : null,
    moving ? Math.floor(time * captionMotion.fps) : style === "typewriter" ? Math.floor(time * 2) : null]);
}

function tint(color: string, toward: string, amount: number) {
  const a = color.match(/^#([\da-f]{6})$/i)?.[1] ?? "ffffff";
  const b = toward.match(/^#([\da-f]{6})$/i)?.[1] ?? "ffffff";
  return `#${[0, 2, 4].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount).toString(16).padStart(2, "0")).join("")}`;
}

function roundedBox(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string, strokeWidth = 0) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, Math.max(0, Math.min(radius, width / 2, height / 2)));
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke && strokeWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

function wrap(ctx: CanvasRenderingContext2D, words: Word[], maxWidth: number, space: number, measure = (word: Word) => ctx.measureText(word.text).width) {
  const lines: Word[][] = [];
  let line: Word[] = [];
  let width = 0;
  for (const word of words) {
    const nextWidth = measure(word);
    if (line.length && (word.breakBefore || width + space + nextWidth > maxWidth)) {
      lines.push(line);
      line = [];
      width = 0;
    }
    width += (line.length ? space : 0) + nextWidth;
    line.push(word);
  }
  if (line.length) lines.push(line);
  return joinOrphanRows(lines,(word:Word)=>word.text);
}

/** Draws ONLY the caption. The same function is used by template cards, live preview and export. */
export function drawCaption(
  ctx: CanvasRenderingContext2D,
  segment: Segment | undefined,
  time: number,
  style: StyleKey,
  settings: CaptionSettings,
  wordPreview?: "pop" | "fade" | "pulse" | "none",
  part: "all" | "background" | "foreground" | "primary" | "secondary" = "all",
  transformed = false,
): CaptionBounds | null {
  if (!segment?.text.trim()) return null;
  const display=compactDisplayCaption(segment);
  if(display!==segment){const bounds=drawCaption(ctx,display,time,style,settings,wordPreview,part,transformed);return bounds?{...bounds,words:bounds.words.map(word=>({...word,index:originalDisplayWordIndex(display,word.index)}))}:null;}
  const ownStyle=(segment.separateStyle===false?undefined:segment.detachedStyle)||segment.laneStyle;if(ownStyle){style=ownStyle.style;settings=ownStyle.settings;}
  style=testRenderStyle(style);
  if(isPresetCaptionStyle(style)){
    settings={...settings,fontSizePx:settings.fontSizePx??100};
    // Layout uses font pixels at 100%; scale the finished caption without reflowing it.
    const zoom=Math.max(.1,Math.min(4,(settings.fontScale??100)/100));
    if(!isCollectionStyle(style)&&zoom!==1){
      const x=segment.position?.x??settings.x,y=segment.position?.y??settings.y;
      ctx.save();ctx.translate(x*ctx.canvas.width/100,y*ctx.canvas.height/100);ctx.scale(zoom,zoom);ctx.translate(-x*ctx.canvas.width/100,-y*ctx.canvas.height/100);
      let bounds:CaptionBounds|null;
      try{bounds=drawCaption(ctx,{...segment,detachedStyle:undefined,laneStyle:undefined},time,style,{...settings,fontScale:100},wordPreview,part,transformed);}finally{ctx.restore();}
      if(!bounds)return null;
      const transform=<T extends {x:number;y:number;width:number;height:number}>(box:T):T=>({...box,x:x+(box.x-x)*zoom,y:y+(box.y-y)*zoom,width:box.width*zoom,height:box.height*zoom});
      return {...transform(bounds),words:bounds.words.map(transform)};
    }
  }
  if(isPresetCaptionStyle(style))segment={...segment,role:undefined,wordStyles:undefined,keywordWord:undefined,headingWord:undefined,hiddenTitleWords:undefined,suppressSuggestions:true};
  if(segment.role==='title'&&ignoresCaptionTitles(style)){
    if(segment.suggestedTitle)return null;
    // A manually added title uses its own editable typography, independently of the authored body layout.
    return drawCaption(ctx,{...segment,role:undefined,detachedStyle:undefined,laneStyle:undefined,suppressSuggestions:true},time,'clean',settings,wordPreview,part,transformed);
  }
  if(hasCaptionAccent(settings)){const source=segment;return animateCaptionAccent(ctx,source,time,settings,layer=>drawCaption(layer,{...source,detachedStyle:undefined,laneStyle:undefined},time,style,{...settings,accentMotion:'none',accentTrails:false,accentParticles:false},wordPreview,part,transformed));}
  if(segment.wordStyles&&Object.values(segment.wordStyles).some(word=>word.linked))segment={...segment,wordStyles:Object.fromEntries(Object.entries(segment.wordStyles).filter(([,word])=>!word.linked))};
  if((settings.textDepth??0)>0&&['testSerif','captionsScript','smokeSerif','scriptVerbatim','underlinedEditorial','curvyBackdrop','prismWords','trackingStack','metallicCompactV2','premiumOrangeV4','waveWords','terminalType','dynamicGlass'].includes(style)){
    const w=ctx.canvas.width,h=ctx.canvas.height,make=()=>typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
    const face=make(),layer=face.getContext('2d') as CanvasRenderingContext2D;
    const bounds=drawCaption(layer,{...segment,detachedStyle:undefined,laneStyle:undefined},time,style,{...settings,textDepth:0},wordPreview,part,transformed);if(!bounds)return null;
    const side=make(),sideCtx=side.getContext('2d') as CanvasRenderingContext2D;sideCtx.drawImage(face,0,0);sideCtx.globalCompositeOperation='source-in';sideCtx.fillStyle=settings.textDepthColor||'#172139';sideCtx.fillRect(0,0,w,h);
    const depth=Math.min(w,h)*.02*Math.min(100,settings.textDepth??0)/100,steps=Math.min(32,Math.ceil(depth));
    for(let step=steps;step>0;step--)ctx.drawImage(side,depth*step/steps,depth*step/steps);ctx.drawImage(face,0,0);return bounds;
  }
  // Opt-in background surfaces wrap native layouts without replacing their text renderer.
  if(settings.backgroundScope&&settings.backgroundScope!=='none'&&['testSerif','captionsScript','smokeSerif','scriptVerbatim','underlinedEditorial','curvyBackdrop','prismWords','trackingStack','metallicCompactV2','premiumOrangeV4','waveWords','terminalType','dynamicGlass'].includes(style)){
    const w=ctx.canvas.width,h=ctx.canvas.height,canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
    const layer=canvas.getContext('2d') as CanvasRenderingContext2D;
    const bounds=drawCaption(layer,{...segment,detachedStyle:undefined,laneStyle:undefined},time,style,{...settings,backgroundScope:'none',backgroundOpacity:0},wordPreview,part,transformed);
    if(!bounds)return null;
    const angle=bounds.rotation*Math.PI/180,cx=bounds.x*w/100,cy=bounds.y*h/100;
    const words=bounds.words.map(word=>{const dx=word.x*w/100-cx,dy=word.y*h/100-cy;return {...word,left:dx*Math.cos(angle)+dy*Math.sin(angle)-word.width*w/200,top:-dx*Math.sin(angle)+dy*Math.cos(angle)-word.height*h/200,width:word.width*w/100,height:word.height*h/100};});
    let boxes=words.map(word=>({x:word.left,y:word.top,width:word.width,height:word.height,index:word.index}));
    if(settings.backgroundScope==='active'){const active=activeWordIndex(segment,time,segment.text.trim().split(/\s+/).length);boxes=boxes.filter(box=>box.index===active);}
    else if(settings.backgroundScope==='caption')boxes=[{x:-bounds.width*w/200,y:-bounds.height*h/200,width:bounds.width*w/100,height:bounds.height*h/100,index:0}];
    else {const rows:typeof boxes=[];for(const box of boxes){const row=rows.find(row=>Math.abs(row.y-box.y)<Math.min(row.height,box.height)*.5);if(row){const right=Math.max(row.x+row.width,box.x+box.width),bottom=Math.max(row.y+row.height,box.y+box.height);row.x=Math.min(row.x,box.x);row.y=Math.min(row.y,box.y);row.width=right-row.x;row.height=bottom-row.y;}else rows.push({...box});}boxes=rows;}
    ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);for(const box of boxes)paintCaptionBackground(ctx,box.x,box.y,box.width,box.height,words[0]?.height??h*.06,settings,time);ctx.restore();ctx.drawImage(canvas,0,0);return bounds;
  }
  if(settings.depthMode&&settings.depthMode!=='none'){const source=segment;return renderCaptionDepth(ctx,settings,time,layer=>drawCaption(layer,{...source,detachedStyle:undefined,laneStyle:undefined},time,style,{...settings,depthMode:'none'},wordPreview,part,transformed));}
  if(settings.specialEffect&&settings.specialEffect!=='none'&&settings.specialEffectStrength!==0){const source=segment;return animateCaptionEffect(ctx,settings,time,layer=>drawCaption(layer,{...source,detachedStyle:undefined,laneStyle:undefined},time,style,{...settings,specialEffect:'none'},wordPreview,part,transformed));}
  if(settings.tracking)settings={...settings,letterSpacing:(settings.letterSpacing??0)+settings.tracking,tracking:0};
  ctx.fontKerning=settings.kerning??'auto';
  if(!transformed&&hasCaptionTransform(settings)){const source=segment;return transformCaption(ctx,settings,layer=>drawCaption(layer,{...source,detachedStyle:undefined,laneStyle:undefined},time,style,{...settings,displayScale:100,displayStretch:100,displayCompress:100,displaySkew:0,displayWarp:0,displayBend:0,displayArc:0,displayDistort:0,displayPerspective:0},wordPreview,part,true));}
  const explicitWordCount=!!settings.displayWordCount;
  if(settings.displayWordCount===-1)settings={...settings,displayWordCount:undefined,wordMode:'all'};
  if(settings.displayWordCount&&segment.role!=='title'&&!segment.effectOnly){
    const tokens=segment.text.trim().split(/\s+/),count=Math.max(1,Math.min(12,Math.round(settings.displayWordCount)));
    const active=activeWordIndex(segment,time,tokens.length);
    const last=segment.words?.findLastIndex(word=>word.start<=time)??Math.floor(Math.max(0,time-segment.start)/Math.max(.01,segment.end-segment.start)*tokens.length);
    const start=Math.floor(Math.max(0,Math.min(tokens.length-1,active<0?last:active))/count)*count,end=start+count;
    const reindex=(index:number|null|undefined)=>index==null?index:index>=start&&index<end?index-start:null;
    segment={...segment,text:tokens.slice(start,end).join(' '),words:segment.words?.slice(start,end),
      ...(!segment.words?.length?{start:segment.start+(segment.end-segment.start)*start/tokens.length,end:segment.start+(segment.end-segment.start)*Math.min(end,tokens.length)/tokens.length}:{}),
      wordStyles:segment.wordStyles?Object.fromEntries(Object.entries(segment.wordStyles).filter(([index])=>Number(index)>=start&&Number(index)<end).map(([index,value])=>[Number(index)-start,value])):undefined,
      wordOffsets:segment.wordOffsets?Object.fromEntries(Object.entries(segment.wordOffsets).filter(([index])=>Number(index)>=start&&Number(index)<end).map(([index,value])=>[Number(index)-start,value])):undefined,
      keywordWord:reindex(segment.keywordWord),headingWord:reindex(segment.headingWord),hiddenTitleWords:segment.hiddenTitleWords?.filter(index=>index>=start&&index<end).map(index=>index-start)};
    // The count is an explicit override of the preset's single-word display.
    settings={...settings,displayWordCount:undefined,wordMode:'all'};
  }
  segment=captionRenderSegment(segment,style);
  // Basic presets gain an editable keyword as soon as keyword settings are used.
  // Explicit removals and existing per-word choices always remain authoritative.
  if(captionCapabilities(style).basic&&segment.role!=='title'&&(!segment.suppressSuggestions||typeof segment.keywordWord==='number')&&settings.secondaryStyle&&Object.keys(settings.secondaryStyle).length&&!Object.keys(segment.wordStyles??{}).length){
    const index=captionWordRoles(segment,settings).keyword,word=segment.text.trim().split(/\s+/)[index];
    if(index>=0&&word)segment={...segment,wordStyles:{[index]:{text:word,style,settings:{...settings,fontFamily:settings.secondaryFontFamily||settings.fontFamily,fontScale:settings.secondaryFontScale??160,textColor:settings.highlightColor,...settings.secondaryStyle}}}};
  }
  settings={...settings,allowOverflow:true,...(ownCaptionLayout(style)?{emphasisWord:undefined,secondaryStyle:undefined}:{})};
  if(settings.captionFrame&&style!=='primeFrame'&&time>=segment.start&&time<segment.end&&part!=='foreground'&&part!=='primary')drawCaptionFrames(ctx,segment,time,settings);
  if(isCollectionStyle(style))return part==='background'||part==='secondary'?null:drawCollectionCaption(ctx,segment,time,style,settings);
  if(style==='orbitSignal'||style==='velvetScript')return part==='background'||part==='secondary'?null:drawSignatureCaption(ctx,segment,time,style,settings);
  if(style==='inkImpact')return part==='background'||part==='secondary'?null:drawInkImpact(ctx,segment,time,settings);
  if(style==='prismFold')return part==='background'||part==='secondary'?null:drawPrismFold(ctx,segment,time,settings);
  if(isNeonRiotStyle(style))return part==='background'||part==='secondary'?null:drawNeonRiot(ctx,segment,time,style,settings);
  if(style==='testSerif'||style==='captionsScript'||style==='smokeSerif')return part==='background'?null:drawReferenceCaption(ctx,segment,time,style,settings);
  if(['scriptVerbatim','underlinedEditorial','curvyBackdrop','prismWords','trackingStack'].includes(style))return part==='background'&&segment.role!=='title'?null:drawEditorialCaption(ctx,segment,time,style,settings);
  if(style==='metallicCompactV2')return part==='background'?null:drawMetallicCompact(ctx,segment,time,settings);
  if(style==='premiumOrangeV4')return part==='background'?null:drawPremiumOrange(ctx,segment,time,settings);
  if(style==='waveWords'||style==='terminalType')return part==='background'?null:drawProgressiveCaption(ctx,segment,time,style,settings);
  if(style==='orbitGlow')style='clean'; // Compatibility for projects saved before this style was removed.
  if(style==='dynamicGlass')return drawDynamicGlass(ctx,segment,time,settings,part);
  if(segment.role==='title'){
    if(part==='foreground'||part==='primary')return null;
    settings={...settings,...segment.position};
    segment={...segment,position:undefined};
    const idle=settings.effectIdle||'none',phase=Math.max(0,time-(segment.frameAnimationStart??segment.start)-.85),settle=clamp(phase/.4,0,1);
    settings={...settings,rotation:settings.rotation+(['float','tilt'].includes(idle)?Math.sin(phase*1.1)*1.03*settle:0),fontScale:settings.fontScale*(1+(['float','zoom'].includes(idle)?Math.sin(phase*1.1)*.012*settle:0)),textColor:['shimmer','gradient'].includes(idle)?tint(settings.textColor,idle==='gradient'?(settings.effectIdleColor||'#ad79ff'):'#ffffff',(.18+.18*Math.sin(phase))*settle):settings.textColor};
    if(illustratedHeaders.includes(style))return drawIllustratedTitle(ctx,segment,time,style,settings);
    if(style==='stackedHeadlines'){
      settings={...settings,...segment.position};
      const count=Math.round(clamp(settings.backgroundTitles??4,1,4));
      let bounds:CaptionBounds|null=null;
      const gap=12.5;
      for(let i=0;i<count;i++){
        ctx.save();ctx.globalAlpha*=.25+i*.09;
        const offset=(i-(count-1)/2)*gap,angle=settings.rotation*Math.PI/180;
        const copy=drawCaption(ctx,{...segment,role:undefined,position:undefined,detachedStyle:undefined,laneStyle:undefined,suppressSuggestions:true},time,i%2?'outline':'clean',{...settings,allowOverflow:true,backgroundOpacity:0,x:settings.x-offset*Math.sin(angle)*ctx.canvas.height/ctx.canvas.width,y:settings.y+offset*Math.cos(angle),reveal:'none',animation:'none'},wordPreview);
        ctx.restore();
        if(copy&&!bounds)bounds={...copy,x:settings.x,y:settings.y,height:copy.height+(count-1)*gap};
      }
      return bounds;
    }
    const headerSettings={...settings};
    const titleStyle:StyleKey=style==='sweepTitle'?'box':['verticalTitle','editorialHeader','boldHeader','stackedHeadlines','primeFrame'].includes(style)?'clean':style;
    return drawCaption(ctx,{...segment,role:undefined,titleFill:style==='sweepTitle',detachedStyle:undefined,laneStyle:undefined,suppressSuggestions:true},time,titleStyle,{...headerSettings,backgroundOpacity:['boldHeader','editorialHeader','verticalTitle','primeFrame'].includes(style)?0:headerSettings.backgroundOpacity},wordPreview);
  }
  const automaticHeader=!segment.suppressSuggestions;
  if(part!=='foreground'&&part!=='secondary'){
    drawIllustratedFrame(ctx,segment,time,style,settings);
    if(automaticHeader&&illustratedHeaders.includes(style)){drawIllustratedTitle(ctx,{...segment,text:segment.text.trim().split(/\s+/)[0]},time,style,{...settings,x:50,y:style==='vistaRise'?8:style==='popCollage'?16:25,fontFamily:settings.secondaryFontFamily||settings.fontFamily,fontScale:settings.secondaryFontScale??160,textColor:style==='popCollage'?'#ffffff':settings.highlightColor,rotation:0});}
  }
  if(part!=='foreground'&&part!=='secondary'){
  if(style==='stackedHeadlines'&&automaticHeader){
    const {width:w,height:h}=ctx.canvas,age=Math.max(0,time-segment.start);
    const words=segment.text.trim().split(/\s+/),active=Math.max(0,activeWordIndex(segment,time,words.length));
    const title=words[active].toLocaleUpperCase('bs');
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    let size=w*.22*(settings.secondaryFontScale??160)/160;ctx.font=`900 ${size}px ${settings.secondaryFontFamily||settings.fontFamily}`;
    size*=Math.min(1,w*.90/Math.max(1,ctx.measureText(title).width));ctx.font=`900 ${size}px ${settings.secondaryFontFamily||settings.fontFamily}`;
    for(let i=0;i<clamp(settings.backgroundTitles??4,1,4);i++){
      const progress=clamp((age-i*.11)/.45,0,1);ctx.globalAlpha=progress*(.17+i*.045);
      const x=w/2+(1-progress)*(i%2?-1:1)*w*.45,y=h*(.23+i*.125);
      ctx.strokeStyle=settings.highlightColor;ctx.fillStyle=settings.highlightColor;ctx.lineWidth=Math.max(1,w*.002);
      if(i%2)ctx.strokeText(title,x,y);else ctx.fillText(title,x,y);
    }
    ctx.restore();
  }
  if(style==='primeFrame'&&settings.captionFrame!==false)drawCaptionFrames(ctx,segment,time,settings);
  if(automaticHeader&&(style==='verticalTitle'||style==='sweepTitle')){
    const {width:w,height:h}=ctx.canvas,title=segment.text.trim().split(/\s+/)[0],age=Math.max(0,time-segment.start);
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    const family=settings.secondaryFontFamily||settings.fontFamily;
    let size=w*.15*(settings.secondaryFontScale??160)/160;ctx.font=`${settings.fontWeight??900} ${size}px ${family}`;const max=style==='verticalTitle'?h*.70:w*.84;
    size*=Math.min(1,max/Math.max(1,ctx.measureText(title).width));ctx.font=`${settings.fontWeight??900} ${size}px ${family}`;
    if(style==='verticalTitle'){ctx.translate(w*.10,h*.16+ctx.measureText(title.toLocaleUpperCase('bs')).width/2);ctx.rotate(-Math.PI/2);ctx.fillStyle=settings.highlightColor;ctx.fillText(title.toLocaleUpperCase('bs'),0,0);}
    else{const width=ctx.measureText(title).width,p=clamp(age/.18,0,1);ctx.translate(w/2,h*.30);ctx.save();ctx.beginPath();ctx.rect(-width/2-size*.15,-size*.65,(width+size*.3)*p,size*1.3);ctx.clip();ctx.globalAlpha=settings.backgroundOpacity/100;ctx.fillStyle=settings.backgroundColor;ctx.fillRect(-width/2-size*.15,-size*.65,width+size*.3,size*1.3);ctx.restore();ctx.fillStyle=settings.highlightColor;ctx.fillText(title,0,0);}
    ctx.restore();
  }
  if(automaticHeader&&['editorialHeader','boldHeader'].includes(style)){
    const {width:w,height:h}=ctx.canvas,title=segment.text.trim().split(/\s+/)[0].toLocaleUpperCase('bs');ctx.save();ctx.textBaseline='top';ctx.textAlign='left';
    let size=w*.26*(settings.secondaryFontScale??160)/160;const family=settings.secondaryFontFamily||settings.fontFamily;ctx.font=`${settings.fontWeight??900} ${size}px ${family}`;size*=Math.min(1,w*.88/Math.max(1,ctx.measureText(title).width));ctx.font=`${settings.fontWeight??900} ${size}px ${family}`;ctx.fillStyle=settings.backgroundOpacity>0?settings.backgroundColor:settings.highlightColor;ctx.fillText(title,w*.06,h*.16);ctx.restore();
  }
  if(style==='editorialLight'){
    const {width:w,height:h}=ctx.canvas,phase=((time-segment.start)%3.6)/3.6;
    ctx.save();ctx.globalAlpha=.22*Math.pow(Math.sin(phase*Math.PI),8);
    const glow=ctx.createLinearGradient(w*(phase*2-1),0,w*(phase*2-.55),h);
    glow.addColorStop(0,'transparent');glow.addColorStop(.5,settings.highlightColor);glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);ctx.restore();
  }
  }
  if(part==='background'||segment.effectOnly)return null;
  if (segment.position) settings = { ...settings, ...segment.position };
  const { width: w, height: h } = ctx.canvas;
  const uppercase = settings.uppercase;
  const text = uppercase ? segment.text.toLocaleUpperCase("bs") : segment.text;
  const allWords = text.trim().split(/\s+/);
  const active = activeWordIndex(segment, time, allWords.length);
  const manualEmphasis=Object.keys(segment.wordStyles||{}).map(Number)[0];
  const emphasisIndex = manualEmphasis ?? (segment.keywordWord===null?-1:segment.keywordWord!==undefined?captionWordRoles(segment).keyword:segment.suppressSuggestions?-1:settings.emphasisWord === -1 ? active : clamp(settings.emphasisWord ?? 1,0,allWords.length-1));
  const single = !wordPreview && !explicitWordCount && (style === "word" || settings.wordMode === "single");
  if (single && active < 0) return null;
  let wordIndex = 0;
  const paragraphWords: Word[] = text.trim().split(/\r?\n/).flatMap((line, lineIndex) =>
    line.trim().split(/\s+/).filter(Boolean).map((word, index) => ({text:word,index:wordIndex++,breakBefore:lineIndex > 0 && index === 0})));

  if(['primeFrame','prism'].includes(style)&&paragraphWords.length>1)paragraphWords[1].breakBefore=true;
  if(style==='editorialLight'&&paragraphWords.length>1)paragraphWords[1].breakBefore=true;
  if(style==='bigKeyword')paragraphWords.forEach((word,i)=>{if(i===emphasisIndex||i===emphasisIndex+1)word.breakBefore=true;});
  let words: Word[] = single ? [{ text: allWords[active], index: active }] : automaticHeader&&['sketchNote','vistaRise','popCollage','verticalTitle','sweepTitle','editorialHeader','boldHeader'].includes(style)&&paragraphWords.length>1?paragraphWords.slice(1):paragraphWords;
  words=words.filter(word=>!segment.hiddenTitleWords?.includes(word.index));
  if (style === "typewriter" && !wordPreview) {
    const progress = clamp((time - segment.start) / Math.max(.1, (segment.end - segment.start) * captionMotion.typewriterFraction), 0, 1);
    let available = Math.max(1, Math.ceil(text.length * progress));
    words = words.flatMap((word) => {
      const part = word.text.slice(0, Math.max(0, available));
      available -= word.text.length + 1;
      return part ? [{ ...word, text: part }] : [];
    });
  }
  const neon = includes(style, captionEffects.neon);
  const duo = style.startsWith("duo");
  const soft = includes(style, captionEffects.soft);
  let fontSize = settings.fontSizePx ? settings.fontSizePx*w/1080 : Math.max(12, w * .054 * settings.fontScale / 100 * (style === "minimal" ? .86 : 1));
  const maxWidth = w * (style==='blurReading'?.9:.79);
  const face = settings.textColor;
  const accent = settings.highlightColor;
  const strokeColor = settings.outlineColor || "#080810";
  const depth = clamp(settings.effectDepth ?? 65, 0, 100) / 100;
  const glow = clamp(settings.glowIntensity ?? 120, 0, 200) / 100;
  const radius = clamp(settings.glowRadius ?? 70, 0, 100) / 100;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  const mixedFont=(word?:Word)=>word?.index===0&&['primeFrame','prism'].includes(style);
  const mixedWord = (word?: Word) => ['mixedFocus','newsHighlight','bigKeyword'].includes(style) && word?.index === emphasisIndex;
  const setFont = (word?: Word) => {
    ctx.font = `${(settings.italic??(style === "elegant" || style === "editorialLight" || (style === "readingFade" && word?.index === emphasisIndex) || style === "newsHighlight" || style === "brushTitle")) ? "italic " : ""}${settings.fontWeight??(style === "mistWords" ? 200 : ["editorialLight","readingFade"].includes(style) ? 400 : mixedWord(word) ? (style === "mixedFocus" ? 300 : 900) : soft ? 600 : 900)} ${fontSize * ((mixedFont(word)||mixedWord(word))?(settings.secondaryFontScale??160)/160:1) * (style === "prism" && word?.index !== 0 ? 2 : style === "primeFrame" && word?.index === 0 ? 1.5 : style === "editorialLight" && word?.index === 0 ? 1.6 : mixedWord(word) ? (style === "bigKeyword" ? 2.8 : 1.5) : 1)}px ${(mixedFont(word)||mixedWord(word))?(settings.secondaryFontFamily||settings.fontFamily):settings.fontFamily}`;
    ctx.font=normalizeCaptionFont(ctx.font);
    ctx.letterSpacing = `${fontSize * (settings.letterSpacing ?? 0) / 100}px`;
  };
  setFont();
  const measure = (word: Word) => { setFont(word); const width = ctx.measureText(word.text).width; setFont(); return width; };
  const outlineExtent = () => Math.max(0,...(settings.outlineLayers??[]).map(layer=>layer.width*fontSize/34),duo||style==='aeArtbrushSticker' ? (settings.outlineWidth + (settings.outerOutlineWidth ?? 1.5)) * fontSize / 34 : 0);
  const measureSpace = () => Math.max(0,Math.max(ctx.measureText(" ").width, outlineExtent() * 2 + fontSize * (style === "paperCut" ? .4 : .08))+fontSize*(settings.wordSpacing??0)/100);
  let space = measureSpace();
  const lineWords=settings.wordsPerLine&&settings.wordsPerLine>0?words.map((word,index)=>({...word,breakBefore:word.breakBefore||index%(settings.wordsPerLine as number)===0&&index>0})):words;
  let lines = wrap(ctx, lineWords, maxWidth, space, measure);
  // Shrink to fit rather than silently dropping words after line three.
  while (fontSize > 8 && lines.length * fontSize * (settings.lineHeight??1.35) > h*.9) {
    fontSize *= .94;
    setFont();
    space = measureSpace();
    lines = wrap(ctx, lineWords, maxWidth, space, measure);
  }
  if (!lines.length) { ctx.restore(); return null; }
  const lineHeight = settings.lineHeight!==undefined?fontSize*Math.max(.6,settings.lineHeight):Math.max(fontSize * (style === 'bigKeyword' ? 3.2 : style === 'newsHighlight' ? 1.8 : style === 'prism' ? 2.1 : style === 'mixedFocus' || style === 'editorialLight' || style === 'paperCut' || style === 'primeFrame' ? 1.7 : 1.27), fontSize * 1.08 + outlineExtent() * 2);
  const lineWidths = lines.map((line) => line.reduce((sum, word) => sum + measure(word), 0) + (line.length - 1) * space);
  const widest = Math.max(...lineWidths);
  const blockHeight = lines.length * lineHeight;
  const pad = Math.max(fontSize * .28, outlineExtent() + fontSize * .12);
  const templateTilt = includes(style, ["comic", "sticker"]) ? -3 : style === "marker" ? -1 : 0;
  const rotation = settings.rotation + templateTilt;
  const radians=rotation*Math.PI/180;
  const extentX=Math.abs(Math.cos(radians))*(widest/2+pad)+Math.abs(Math.sin(radians))*(blockHeight/2+pad);
  const extentY=Math.abs(Math.sin(radians))*(widest/2+pad)+Math.abs(Math.cos(radians))*(blockHeight/2+pad);
  const xCenter = settings.allowOverflow?w*settings.x/100:clamp(w*settings.x/100,Math.min(w/2,extentX),Math.max(w/2,w-extentX));
  const alignedY=settings.verticalAlignment==='top'?5:settings.verticalAlignment==='bottom'?95:settings.verticalAlignment==='middle'?50:settings.y;
  const yCenter = settings.allowOverflow?h*alignedY/100:clamp(h*(settings.verticalAlignment==='top'?5:settings.verticalAlignment==='bottom'?95:settings.verticalAlignment==='middle'?50:settings.y)/100,Math.min(h/2,extentY),Math.max(h/2,h-extentY));
  const bounds: CaptionBounds = { x: xCenter / w * 100, y: yCenter / h * 100, width: (widest + pad * 2) / w * 100, height: (blockHeight + pad) / h * 100, rotation, segmentId: segment.id, words: [] };
  ctx.translate(xCenter, yCenter);
  ctx.rotate(rotation * Math.PI / 180);
  const wordStart = segment.words?.[active]?.start ?? segment.start + Math.max(0, active) * (segment.end - segment.start) / Math.max(1, allWords.length);
  const age = Math.max(0, time - (single ? wordStart : segment.start));
  if (settings.animation === "fade") ctx.globalAlpha *= clamp(age / captionMotion.fadeDuration, 0, 1);
  if (settings.animation === "pop" || (single && style!=="tripleGothic" && settings.animation === "none")) {
    const p = clamp(age / captionMotion.popDuration, 0, 1);
    const pop = 1 + (captionMotion.popOvershoot + 1) * Math.pow(p - 1, 3) + captionMotion.popOvershoot * Math.pow(p - 1, 2);
    ctx.scale(captionMotion.popBaseScale + captionMotion.popScaleRange * pop, captionMotion.popBaseScale + captionMotion.popScaleRange * pop);
  }
  if (settings.animation === "pulse") {
    const pulse = 1 + captionMotion.pulseAmplitude * Math.sin(age * Math.PI * 2 * captionMotion.pulseFrequency);
    ctx.scale(pulse, pulse);
  }
  const bx = -widest / 2 - pad;
  const by = -blockHeight / 2 - pad / 2;
  const bw = widest + pad * 2;
  const bh = blockHeight + pad;
  if(settings.borderMist)drawBorderMist(ctx,bx,by,bw,bh,fontSize,age,settings);
  const hasCard = includes(style, captionEffects.card);
  const customBackground=!!settings.backgroundScope;
  const backgroundBox=(x:number,y:number,width:number,height:number)=>paintCaptionBackground(ctx,x,y,width,height,fontSize,settings,time);
  if(settings.backgroundScope==='caption')backgroundBox(-widest/2,-blockHeight/2,widest,blockHeight);

  if(!customBackground&&style==='popCollage'){ctx.save();ctx.fillStyle=settings.backgroundColor;ctx.strokeStyle=settings.highlightColor;ctx.lineWidth=fontSize*.055;ctx.beginPath();ctx.roundRect(bx,by,bw,bh,fontSize*.4);ctx.fill();ctx.stroke();ctx.restore();}
  if (!customBackground&&style!=='popCollage'&&(hasCard || (settings.backgroundOpacity > 0 && !["sketchNote","paperCut","sweepTitle","boldHeader","newsHighlight"].includes(style)))) {
    ctx.save();
    const background = settings.backgroundOpacity > 0
      ? settings.backgroundColor
      : includes(style, ["marker", "pastel", "urgent"]) ? accent
        : style === "bubble" ? "#ffffff" : "#0b0c18";
    ctx.globalAlpha *= settings.backgroundOpacity > 0 ? settings.backgroundOpacity / 100 : .95;
    if(segment.titleFill){ctx.beginPath();ctx.rect(bx,by,bw*clamp((time-(segment.frameAnimationStart??segment.start))/.18,0,1),bh);ctx.clip();}
    const roundness = includes(style, ["bubble", "pastel"]) ? bh / 2 : style === "marker" ? 0 : fontSize * .18;
    if (includes(style, ["pastel", "bubble", "captionCard"])) {
      ctx.shadowColor = "#00000088";
      ctx.shadowBlur = fontSize * .25;
      ctx.shadowOffsetY = fontSize * .12;
    }
    roundedBox(ctx, bx, by, bw, bh, roundness, background,
      includes(style, ["bubble", "cyber"]) ? accent : undefined, fontSize * .055);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = accent;
    if (style === "news") ctx.fillRect(bx, by + bh - fontSize * .08, bw, fontSize * .08);
    if (style === "gaming") ctx.fillRect(bx, by, fontSize * .12, bh);
    if (style === "cyber") {
      ctx.fillRect(bx - fontSize * .12, by + fontSize * .2, fontSize * .08, bh * .3);
      ctx.fillRect(bx + bw + fontSize * .04, by + bh * .6, fontSize * .08, bh * .3);
    }
    ctx.restore();
  }

  const paintWord = (word: Word, x: number, y: number, lineIndex: number) => {
    // Keep the complete layout stable while revealing spoken words in hover previews.
    const revealGroup=Math.max(1,Math.min(6,Math.round(settings.revealGroupSize??1)));
    const revealIndex=Math.floor(word.index/revealGroup)*revealGroup;
    const revealStart = settings.reveal==='slideFall' ? segment.start+word.index*Math.min(.035,(segment.end-segment.start)*.15/Math.max(1,allWords.length-1)) : segment.words?.[revealIndex]?.start ?? segment.start + revealIndex * (segment.end - segment.start) / allWords.length;
    const fullSentence=['all','highlight'].includes(settings.wordMode);
    const reveal = wordPreview === 'none'||(fullSentence&&settings.reveal!=='slideFall') ? 'none' : settings.reveal ?? 'none';
    if(reveal==='slideFall'&&time<revealStart)return;
    if(settings.wordMode==='spoken'&&time<revealStart)return;
    if ((!fullSentence&&((wordPreview && wordPreview !== 'none') || reveal !== 'none')) && time < revealStart && style !== 'blurReading') return;
    const wordWidth = measure(word);
    const secondaryWord=!!segment.wordStyles?.[word.index]||mixedFont(word)||mixedWord(word);
    if((part==='primary'&&secondaryWord)||(part==='secondary'&&!secondaryWord))return;
    const custom = segment.wordStyles?.[word.index]||(secondaryWord&&settings.secondaryStyle?{text:segment.text.trim().split(/\s+/)[word.index],linked:true,style:'clean' as StyleKey,settings:{...settings,fontFamily:settings.secondaryFontFamily||settings.fontFamily,fontScale:settings.secondaryFontScale??settings.fontScale,textColor:settings.highlightColor,...settings.secondaryStyle}}:undefined);
    if (custom && custom.text === segment.text.trim().split(/\s+/)[word.index]) {
      const matrix = ctx.getTransform();
      const offset = segment.wordOffsets?.[word.index];
      const centerX = x + wordWidth / 2;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const wordBounds = drawCaption(ctx, {
        id: segment.id, text: custom.text, start: segment.start, end: segment.end,suppressSuggestions:true,
        words: segment.words?.[word.index] ? [{ ...segment.words[word.index], text: custom.text }] : undefined,
      }, time, custom.style, { ...custom.settings,...(custom.linked?{...settings,fontFamily:style==='sketchNote'?settings.fontFamily:settings.secondaryFontFamily||custom.settings.fontFamily,fontScale:style==='sketchNote'?settings.fontScale:settings.secondaryFontScale??custom.settings.fontScale,...settings.secondaryStyle}:{}),
        x: (matrix.a * centerX + matrix.c * y + matrix.e) / w * 100 + (offset?.x ?? 0),
        y: (matrix.b * centerX + matrix.d * y + matrix.f) / h * 100 + (offset?.y ?? 0),
      });
      ctx.restore();
      if (wordBounds) bounds.words.push({ index: word.index, text: custom.text, ...wordBounds });
      return;
    }
    const isActive = word.index === active;
    const karaoke = ["karaoke","hightech","cyberTrack","brushTitle"].includes(style) && (isActive || (active >= 0 && word.index < active));
    ctx.save();
    setFont(word);
    if(reveal==='slideFall'){
      const entrance=captionEase(clamp((time-revealStart)/Math.max(.05,Math.min(settings.revealDuration??.32,(segment.end-revealStart)*.4)),0,1),settings.motionCurve);
      const window=Math.min(.65,(segment.end-segment.start)*.3);
      const exitStart=Math.max(revealStart,segment.end-window+word.index*Math.min(.035,window*.2/Math.max(1,allWords.length-1)));
      const exit=clamp((time-exitStart)/Math.max(.01,segment.end-exitStart),0,1);
      ctx.translate(-fontSize*1.8*Math.pow(1-entrance,3),fontSize*1.8*exit*exit);
      ctx.globalAlpha*=(.5+.5*entrance)*(1-.8*exit);
    }
    if(style==='stackedHeadlines'&&word.index%2===0){
      ctx.fillStyle=settings.highlightColor;ctx.strokeStyle=settings.outlineColor||'#17242b';ctx.lineWidth=fontSize*.06;
      ctx.beginPath();ctx.rect(x-fontSize*.12,y-fontSize*.59,wordWidth+fontSize*.24,fontSize*1.18);ctx.fill();ctx.stroke();
    }
    if(!customBackground&&style==='paperCut'&&(segment.wordsSeparated||settings.wordMode!=='all')){
      ctx.translate(x+wordWidth/2,y);ctx.rotate((word.index%2?3:-4)*Math.PI/180);ctx.translate(-x-wordWidth/2,-y);
      ctx.translate(0,word.index%2?fontSize*.13:-fontSize*.13);
      ctx.fillStyle=settings.backgroundColor;ctx.beginPath();
      const left=x-fontSize*.12,right=x+wordWidth+fontSize*.12,top=y-fontSize*.67,bottom=y+fontSize*.62;
      ctx.moveTo(left,top);for(let j=1;j<=12;j++)ctx.lineTo(left+(right-left)*j/12,top+(j%2?fontSize*.05:0));
      ctx.lineTo(right,bottom);for(let j=11;j>=0;j--)ctx.lineTo(left+(right-left)*j/12,bottom-(j%2?fontSize*.045:0));ctx.closePath();const alpha=ctx.globalAlpha;ctx.globalAlpha*=settings.backgroundOpacity/100;ctx.fill();ctx.globalAlpha=alpha;
      ctx.strokeStyle=settings.outlineColor;ctx.lineWidth=settings.outlineWidth*fontSize/34;if(ctx.lineWidth>0&&settings.outlineWidth>0)ctx.stroke();
    }

    if(style==='readingFade')ctx.globalAlpha*=time>=revealStart?1:.6;
    const elapsed = Math.max(0, time - revealStart);
    if(style==='mistWords'){const p=clamp(elapsed/Math.max(.05,settings.revealDuration??.24),0,1);ctx.filter=`blur(${(1-p)*fontSize*.08}px)`;ctx.globalAlpha*=p;}
    if(settings.wordMode==='highlight')ctx.globalAlpha*=word.index===active?1:.68;
    if(style==='blurReading'){const p=clamp(elapsed/.22,0,1);ctx.filter=`blur(${(1-p)*fontSize*.16}px)`;ctx.globalAlpha*=.4+.6*p;}
    if(!customBackground&&(['boldHeader','newsHighlight'].includes(style)||(style==='bigKeyword'&&mixedWord(word)))){
      const featured=mixedWord(word);ctx.save();ctx.globalAlpha*=style==='bigKeyword'?1:settings.backgroundOpacity/100;ctx.fillStyle=featured?settings.highlightColor:settings.backgroundColor;const pad=fontSize*.13,scale=style==='bigKeyword'?2.8:featured?1.5:1;ctx.fillRect(x-pad,y-fontSize*scale*(style==='boldHeader'?.72:.57),wordWidth+pad*2,fontSize*scale*(style==='boldHeader'?1.35:1.14));ctx.restore();
    }

    const progress = captionEase(clamp(elapsed / Math.max(.05, settings.revealDuration ?? .22), 0, 1),settings.motionCurve);
    if(reveal==='slideLeft'){ctx.translate(-fontSize*(1-progress),0);ctx.globalAlpha*=clamp(progress,0,1);}
    if(reveal==='zoom'){const scale=.55+.45*progress;ctx.translate(x+wordWidth/2,y);ctx.scale(scale,scale);ctx.translate(-x-wordWidth/2,-y);ctx.globalAlpha*=clamp(progress,0,1);}
    if(reveal==='softBlur'){ctx.filter=`blur(${Math.max(0,1-progress)*fontSize*.13}px)`;ctx.globalAlpha*=clamp(progress,0,1);}
    if (reveal === 'pop') {
      const scale = .65 + .35 * progress + .16 * Math.sin(progress * Math.PI);
      ctx.translate(x + wordWidth / 2, y); ctx.scale(scale, scale); ctx.translate(-x - wordWidth / 2, -y);
    }
    if (reveal === 'rise') { ctx.translate(0, fontSize * .65 * Math.pow(1 - progress, 3)); ctx.globalAlpha *= clamp(progress,0,1); }
    if (reveal === 'fade') ctx.globalAlpha *= clamp(settings.fadeFrom ?? .4, 0, 1) + (1 - clamp(settings.fadeFrom ?? .4, 0, 1)) * clamp(progress,0,1);
    if (reveal === 'letters' && !(style === 'blurReading' && time < revealStart)) {
      const wordEnd = segment.words?.[word.index]?.end ?? revealStart + (segment.end - segment.start) / allWords.length;
      const letters = Array.from(word.text);
      const count = Math.min(letters.length, Math.floor(clamp(elapsed / Math.max(.05, wordEnd - revealStart), 0, 1) * letters.length) + 1);
      // Clip the fully measured word: revealing letters never moves its neighbours.
      const visibleWidth = ctx.measureText(letters.slice(0, count).join('')).width;
      ctx.beginPath(); ctx.rect(x - fontSize * .15, y - lineHeight, visibleWidth + fontSize * .15, lineHeight * 2); ctx.clip();
    }
    const offset = segment.wordOffsets?.[word.index];
    if (offset && offset.text === segment.text.trim().split(/\s+/)[word.index]) {
      const matrix = ctx.getTransform();
      const det = matrix.a * matrix.d - matrix.b * matrix.c;
      if (Math.abs(det) > .00001) ctx.translate(
        (matrix.d * offset.x * w / 100 - matrix.c * offset.y * h / 100) / det,
        (-matrix.b * offset.x * w / 100 + matrix.a * offset.y * h / 100) / det,
      );
    }
    if (wordPreview && isActive) {
      const elapsed=Math.max(0,time-wordStart);
      const progress = Math.min(1, elapsed/.22);
      const scale=wordPreview==='pop' ? .65+.35*progress+.16*Math.sin(progress*Math.PI) : wordPreview==='pulse' ? 1+.08*Math.sin(elapsed*Math.PI*6) : 1;
      ctx.translate(x+wordWidth/2,y);ctx.scale(scale,scale);ctx.translate(-x-wordWidth/2,-y);
      if (wordPreview==='fade') ctx.globalAlpha*=Math.min(1,elapsed/.2);
    }
    const matrix = ctx.getTransform();
    const centerX = x + wordWidth / 2;
    bounds.words.push({ index: word.index, text: word.text,
      x: (matrix.a * centerX + matrix.c * y + matrix.e) / w * 100,
      y: (matrix.b * centerX + matrix.d * y + matrix.f) / h * 100,
      width: Math.hypot(matrix.a, matrix.b) * (wordWidth + fontSize * .16) / w * 100,
      height: Math.hypot(matrix.c, matrix.d) * lineHeight / h * 100, rotation });
    const activePill = includes(style, ["bounce", "social"]) && isActive;
    if (activePill) {
      const p = clamp((time - wordStart) / captionMotion.bounceDuration, 0, 1);
      const lift = style === "bounce" ? Math.sin(p * Math.PI) * fontSize * .1 : 0;
      y -= lift;
      roundedBox(ctx, x - fontSize * .12, y - fontSize * .59, wordWidth + fontSize * .24, fontSize * 1.18, fontSize * .16, accent);
    }
    const fill = style==='goldBold'&&word.index===emphasisIndex&&!Object.keys(segment.wordStyles||{}).length?accent:(style === "newsHighlight" || style === "bigKeyword") && mixedWord(word) ? "#111111" : style === "stackedHeadlines" && word.index%2===0 ? "#17242b" : activePill || style === "marker" ? "#111119"
      : style === "bubble" ? "#392363"
        : karaoke || includes(style, ["word", "focus", "comic", "retro"]) ? accent : face;
    const stroke = style === "paperCut" ? 0 : settings.outlineWidth * fontSize / 34;
      if((settings.textDepth??0)>0){
        ctx.save();ctx.shadowBlur=0;
        const extrusion=fontSize*.22*clamp(settings.textDepth??0,0,100)/100;
        ctx.fillStyle=settings.textDepthColor||'#172139';
        for(let depth=Math.ceil(extrusion);depth>0;depth--)ctx.fillText(word.text,x+depth,y+depth);
        ctx.restore();
      }
    const drawFace = (color: string | CanvasGradient) => {
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      if (stroke > 0 && !activePill && !settings.customOutline && !settings.outlineGradient && !settings.outlineLayers?.length) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = stroke * 2;
        ctx.strokeText(word.text, x, y);
      }
      drawPresetFace(ctx,word.text,x,y,fontSize,settings,color,time);
    };

    if((settings.fillTexture&&settings.fillTexture!=='none')||hasCaptionLightEffects(settings)||settings.textUnderline||settings.textStrike||settings.customOutline||settings.outlineGradient||settings.textOpacity!==undefined||settings.outlineLayers?.length||settings.textGradient||settings.faceTexture){
      drawFace(fill);
    }else if(style==='comicLetterBounce'){
      const letters=Array.from(word.text),wordEnd=segment.words?.[word.index]?.end??segment.start+(word.index+1)*(segment.end-segment.start)/allWords.length;
      let cursor=x;
      for(let i=0;i<letters.length;i++){
        const advance=ctx.measureText(letters[i]).width,delay=i/Math.max(1,letters.length)*Math.min(.24,Math.max(.06,wordEnd-revealStart)*.6),age=time-revealStart-delay;
        if(age>=0){const q=clamp(age/.28,0,1),bounce=Math.sin(q*Math.PI*2)*Math.pow(1-q,2);ctx.save();ctx.translate(cursor+advance/2,y+fontSize*(Math.pow(1-q,3)*.8-bounce*.32));ctx.rotate((i%2?1:-1)*(1-q)*.28);const scale=.68+.32*q+bounce*.16;ctx.scale(scale,scale);ctx.globalAlpha*=clamp(age/.06,0,1);ctx.shadowColor=settings.textColor;ctx.shadowBlur=fontSize*.22*clamp(settings.glowIntensity/100,0,2);ctx.strokeStyle=settings.outlineColor;ctx.lineWidth=stroke*2;ctx.strokeText(letters[i],-advance/2,0);ctx.shadowBlur=0;ctx.fillStyle=settings.textColor;ctx.fillText(letters[i],-advance/2,0);drawTextSurface(ctx,letters[i],-advance/2,0,fontSize,settings);drawTextShine(ctx,letters[i],-advance/2,0,fontSize,settings,time-segment.start);ctx.restore();}
        cursor+=advance;
      }
    }else if(style==='aeArtbrushSticker'){
      const outer=(settings.outlineWidth+(settings.outerOutlineWidth??2.1))*fontSize/34;
      ctx.strokeStyle=settings.outerOutlineColor||'#080808';ctx.lineWidth=outer*2;ctx.shadowColor='#ffffff88';ctx.shadowBlur=fontSize*.3;ctx.strokeText(word.text,x,y+fontSize*.13);ctx.shadowBlur=0;ctx.strokeText(word.text,x,y);
      ctx.strokeStyle=settings.outlineColor;ctx.lineWidth=stroke*2;ctx.strokeText(word.text,x,y);ctx.fillStyle=fill;ctx.fillText(word.text,x,y);
    } else if (duo) {
      const innerBand = Math.max(0, stroke);
      const outerBand = Math.max(0, settings.outerOutlineWidth ?? 1.5) * fontSize / 34;
      const outerColor = settings.outerOutlineColor || "#ffffff";
      // The wider outer stroke is behind the inner stroke, so both colored bands stay visible.
      const outerPathWidth = (innerBand + outerBand) * 2;
      if (settings.outlineGlow && glow > 0 && outerPathWidth > 0) {
        for (const [range, alpha] of [[1.5, .22], [.65, .4]]) {
          ctx.save();
          ctx.globalAlpha *= Math.min(1, glow * alpha);
          ctx.strokeStyle = outerColor;
          ctx.lineWidth = outerPathWidth;
          ctx.shadowColor = settings.outlineGlowColor || outerColor;
          ctx.shadowBlur = fontSize * (.15 + radius * .75) * range;
          ctx.strokeText(word.text, x, y);
          ctx.restore();
        }
      }
      if (outerBand > 0) {
        ctx.lineWidth = outerPathWidth;
        ctx.strokeStyle = outerColor;
        ctx.strokeText(word.text, x, y);
      }
      if (innerBand > 0) {
        ctx.lineWidth = innerBand * 2;
        ctx.strokeStyle = strokeColor;
        ctx.strokeText(word.text, x, y);
      }
      const secondary = settings.wordColorMode === "alternate" ? word.index % 2 === 1
        : settings.wordColorMode === "active" ? isActive
          : settings.wordColorMode === "lines" ? lineIndex % 2 === 1 : false;
      ctx.fillStyle = secondary ? accent : face;
      ctx.fillText(word.text, x, y);
    } else if (neon && glow > 0) {
      // Several real shadow passes: diffuse bloom, saturated halo, sharp light core.
      const blur = fontSize * (.22 + radius * 1.1);
      for (const [range, alpha] of [[1.45, .32], [.8, .62], [.32, .9], [.1, 1]]) {
        ctx.save();
        ctx.globalAlpha *= Math.min(1, glow * alpha);
        ctx.fillStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = blur * range;
        ctx.fillText(word.text, x, y);
        ctx.restore();
      }
      // Do not outline the neon face in black: that suppresses the light source.
      ctx.fillStyle = tint(face, "#ffffff", style === "glow" ? .92 : .82);
      ctx.fillText(word.text, x, y);
    } else if (style === "threeD" || style === "shadow" || style === "retro") {
      const extrusion = Math.max(0, Math.round(fontSize * .25 * depth));
      for (let step = extrusion; step > 0; step--) {
        ctx.fillStyle = tint(accent, "#080810", step / Math.max(1, extrusion) * .6);
        ctx.fillText(word.text, x + step, y + step * 1.15);
      }
      if (style === "retro") { ctx.fillStyle = "#ec5d86"; ctx.fillText(word.text, x + extrusion * .5, y + extrusion * .5); }
      drawFace(fill);
    } else if (style === "sticker" || style === "comic") {
      ctx.shadowColor = "#00000099";
      ctx.shadowOffsetX = fontSize * .08;
      ctx.shadowOffsetY = fontSize * .12;
      ctx.lineWidth = fontSize * (.09 + settings.outlineWidth * .028);
      ctx.strokeStyle = style === "sticker" ? "#ffffff" : "#0c0c12";
      ctx.strokeText(word.text, x, y);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = fontSize * (.035 + settings.outlineWidth * .015);
      ctx.strokeStyle = style === "sticker" ? strokeColor : "#ffffff";
      ctx.strokeText(word.text, x, y);
      ctx.fillStyle = style === "sticker" ? accent : fill;
      ctx.fillText(word.text, x, y);
    } else if (style === "gradient" || style === "chrome" || style === "fire") {
      const angle = (settings.gradientAngle ?? 90) * Math.PI / 180;
      const length = Math.abs(Math.cos(angle) * widest) + Math.abs(Math.sin(angle) * blockHeight);
      const dx = Math.cos(angle) * length / 2;
      const dy = Math.sin(angle) * length / 2;
      const gradient = ctx.createLinearGradient(-dx, -dy, dx || .001, dy || .001);
      if (style === "chrome") {
        [[0, "#ffffff"], [.32, tint(accent, "#ffffff", .65)], [.49, "#505a70"], [.52, "#ffffff"], [.68, accent], [1, "#343946"]].forEach(([position, color]) => gradient.addColorStop(Number(position), String(color)));
      } else if (style === "fire") {
        gradient.addColorStop(0, "#ffffce"); gradient.addColorStop(.33, accent); gradient.addColorStop(1, face);
      } else { gradient.addColorStop(0, accent); gradient.addColorStop(1, face); }
      drawFace(gradient);
    } else if (style === "outline") {
      ctx.lineWidth = Math.max(fontSize * .035, stroke);
      ctx.strokeStyle = accent;
      ctx.strokeText(word.text, x, y);
    } else {
      if (!hasCard && !activePill) {
        ctx.fillStyle = "#05050d";
        ctx.shadowColor = "#000000cc";
        ctx.shadowBlur = fontSize * .13;
        ctx.shadowOffsetY = fontSize * .065;
        ctx.fillText(word.text, x, y);
      }
      drawFace(fill);
    }
    ctx.save();ctx.globalAlpha*=clamp((settings.textOpacity??100)/100,0,1);
    if(style!=='comicLetterBounce')drawTextSurface(ctx,word.text,x,y,fontSize,{...settings,textColor:typeof fill==='string'?fill:settings.textColor});
    if(style!=='comicLetterBounce')drawTextShine(ctx,word.text,x,y,fontSize,settings,time-segment.start);ctx.restore();
    const underlineTarget = settings.emphasisWord ?? -1;
    if (settings.underline && (underlineTarget < 0 ? isActive : word.index === underlineTarget)) {
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.fillStyle = settings.underlineColor ?? accent;
      ctx.fillRect(x, y + fontSize * .57, wordWidth * (wordPreview === 'none' ? 1 : progress), Math.max(2, fontSize * .07));
    }
    ctx.restore();
  };
  lines.forEach((line, lineIndex) => {
    let x = (settings.alignment === "left"||settings.alignment === "justify") ? -widest / 2
      : settings.alignment === "right" ? widest / 2 - lineWidths[lineIndex] : -lineWidths[lineIndex] / 2;
    const y = -blockHeight / 2 + lineHeight * (lineIndex + .5);
    if(settings.backgroundScope==='line')backgroundBox(x,y-lineHeight/2,lineWidths[lineIndex],lineHeight);
    if(!customBackground&&style==='sketchNote'&&(settings.sketchMarker??true)){
      const start=segment.words?.[line[0]?.index]?.start??segment.start;
      if(time>=start){ctx.save();ctx.fillStyle=settings.backgroundColor;ctx.globalAlpha*=(settings.sketchMarkerOpacity??85)/100;
       const width=lineWidths[lineIndex]+fontSize*.35,seed=Math.sin(segment.start*19+lineIndex*7);
       ctx.translate(x-fontSize*.17+seed*fontSize*.06,y-fontSize*.34+seed*fontSize*.08);ctx.rotate((seed*1.8)*Math.PI/180);
       ctx.beginPath();ctx.moveTo(fontSize*.08,0);ctx.lineTo(width+fontSize*.05,fontSize*.025);ctx.lineTo(width-fontSize*.1,fontSize*.77);ctx.lineTo(-fontSize*.05,fontSize*.73);ctx.closePath();ctx.fill();ctx.restore();}
    }
    if(!customBackground&&style==='paperCut'&&!segment.wordsSeparated&&settings.wordMode==='all'){
      ctx.save();const left=x-fontSize*.12,right=x+lineWidths[lineIndex]+fontSize*.12,top=y-fontSize*.67,bottom=y+fontSize*.62;
      ctx.beginPath();ctx.moveTo(left,top);for(let j=1;j<=24;j++)ctx.lineTo(left+(right-left)*j/24,top+(j%2?fontSize*.05:0));ctx.lineTo(right,bottom);for(let j=23;j>=0;j--)ctx.lineTo(left+(right-left)*j/24,bottom-(j%2?fontSize*.045:0));ctx.closePath();ctx.globalAlpha*=settings.backgroundOpacity/100;ctx.fillStyle=settings.backgroundColor;ctx.fill();ctx.strokeStyle=settings.outlineColor;ctx.lineWidth=settings.outlineWidth*fontSize/34;if(settings.outlineWidth>0)ctx.stroke();ctx.restore();
    }
    for (const word of line) {
      if(settings.backgroundScope==='active'&&word.index===active)backgroundBox(x,y-fontSize*.58,measure(word),fontSize*1.16);
      paintWord(word, x, y, lineIndex);
      x += measure(word) + space+(settings.alignment==='justify'&&line.length>1&&lineIndex<lines.length-1?(widest-lineWidths[lineIndex])/(line.length-1):0);
    }
    if (style === "typewriter" && lineIndex === lines.length - 1 && Math.floor(time * 2) % 2 === 0) {
      ctx.fillStyle = accent;
      ctx.fillRect(x, y + fontSize * .35, fontSize * .5, fontSize * .07);
    }
  });
  ctx.restore();
  return bounds;
}
