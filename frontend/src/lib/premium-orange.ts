import {drawTextShine,drawTextUnderline,drawTextSurface,captionFill} from './text-surface';
import type {CaptionSettings, Segment, StyleKey} from '../config/captions/types';
import type {CaptionBounds} from './caption-renderer';

// Premium Orange V4: absolute-time motion from the supplied handoff, in 1080×1920 units.
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const u=clamp(x);return u*u*(3-2*u);};
type Word={text:string;index:number;start:number;accent:boolean;breakBefore:boolean};
type Page={words:Word[];start:number;end:number;index:number;italic:boolean};
function pagesFor(segment:Segment,settings:CaptionSettings):Page[]{
 let index=0;
 const tokens=segment.text.trim().split(/\r?\n/).flatMap((line,row)=>line.trim().split(/\s+/).filter(Boolean).map((text,i)=>({text,index:index++,breakBefore:row>0&&i===0})));
 const single=segment.wordsSeparated||settings.wordMode==='single';
 const size=single?1:Math.max(2,Math.min(6,Math.round(settings.premiumPhraseWords??6)));
 const explicit=Object.keys(segment.wordStyles||{}).map(Number);
 const seed=Array.from(segment.id).reduce((sum,c)=>sum+c.charCodeAt(0),0);
 const words=tokens.map(word=>({...word,text:settings.uppercase?word.text.toLocaleUpperCase('bs'):word.text,
  start:Math.max(segment.start,Math.min(segment.end,segment.words?.[word.index]?.start??segment.start+word.index/Math.max(1,tokens.length)*(segment.end-segment.start))),accent:false}));
 const pages:Page[]=[];
 for(let i=0;i<words.length;i+=size){
  const group=words.slice(i,i+size),pageIndex=pages.length;
  const automatic=!segment.suppressSuggestions&&!explicit.length&&settings.emphasisWord===undefined;
  for(const word of group)word.accent=explicit.includes(word.index)||(settings.emphasisWord!==undefined&&settings.emphasisWord===word.index)||(automatic&&word.index>=i+Math.max(0,group.length-2));
  const italic=settings.premiumEntrance==='italic'||(settings.premiumEntrance!=='upright'&&(seed+pageIndex)%4===3);
  pages.push({words:group,start:group[0].start,end:words[i+size]?.start??segment.end,index:seed+pageIndex,italic});
 }
 return pages;
}

function tint(color:string,target:string,amount:number){
 const a=/^#[0-9a-f]{6}$/i.test(color)?color:'#ffffff';
 return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-amount)+parseInt(target.slice(i,i+2),16)*amount).toString(16).padStart(2,'0')).join('');
}
type Layer=HTMLCanvasElement|OffscreenCanvas;
const newLayer=():Layer=>typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(1,1):document.createElement('canvas');
type Art={canvas:Layer;width:number;height:number;pad:number};
const artworkCache=new Map<string,Art>();
/** Shadows, extrusion and a mask-difference top highlight are baked per intact word. */
function artwork(text:string,font:string,size:number,accent:boolean,settings:CaptionSettings):Art{
 const face=accent?settings.highlightColor:settings.textColor;
 const originalOrange=accent&&face.toLowerCase()==='#ffb929';
 const key=JSON.stringify([text,font,size,accent,face,settings.textGradient,settings.textGradientMode,settings.textGradientStart,settings.textGradientEnd,settings.textGradientMiddle,settings.gradientAngle,settings.textMaterial,settings.surfaceStrength,settings.surfaceOpacity,settings.surfaceBevel,settings.surfaceLightAngle,settings.surfaceHighlight,settings.surfaceShadow,settings.surfaceColor,settings.effectDepth,settings.outlineWidth,settings.outlineColor,settings.letterSpacing,typeof document!=='undefined'&&typeof document.fonts!=='undefined'?document.fonts.status:'loaded']);
 const cached=artworkCache.get(key);if(cached)return cached;
 const canvas=newLayer(),ctx=canvas.getContext('2d') as CanvasRenderingContext2D;
 ctx.font=font;ctx.letterSpacing=`${size*(settings.letterSpacing??0)/100}px`;
 const m=ctx.measureText(text),height=Math.max(1,m.actualBoundingBoxAscent+m.actualBoundingBoxDescent),unit=size/(accent?135:77),pad=Math.ceil(unit*30);
 canvas.width=Math.ceil(Math.max(m.width,m.actualBoundingBoxLeft+m.actualBoundingBoxRight)+pad*2);canvas.height=Math.ceil(height+pad*2);
 ctx.font=font;ctx.letterSpacing=`${size*(settings.letterSpacing??0)/100}px`;ctx.textBaseline='alphabetic';
 const x=pad+Math.max(0,m.actualBoundingBoxLeft),y=pad+m.actualBoundingBoxAscent;
 ctx.shadowColor='rgba(0,0,0,.61)';ctx.shadowBlur=5*unit;ctx.shadowOffsetX=2*unit;ctx.shadowOffsetY=6*unit;
 ctx.fillStyle=face;ctx.fillText(text,x,y);ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
 const depth=Math.max(0,Math.min(2,(settings.effectDepth??100)/100));
 ctx.fillStyle=accent?(face.toLowerCase()==='#ffb929'?'rgba(151,52,6,.824)':tint(face,'#000000',.65)):'rgba(95,91,87,.67)';
 for(let offset=4;offset>0;offset--)ctx.fillText(text,x+unit*depth,y+offset*unit*depth);
 if(settings.outlineWidth>0){ctx.strokeStyle=settings.outlineColor;ctx.lineWidth=settings.outlineWidth*unit;ctx.lineJoin='round';ctx.strokeText(text,x,y);}
 const gradient=ctx.createLinearGradient(0,pad,0,pad+height);
 gradient.addColorStop(0,accent?tint(face,originalOrange?'#ffeab5':'#ffffff',.28):face);
 gradient.addColorStop(1,accent?tint(face,originalOrange?'#d93600':'#000000',.36):tint(face,'#a0a5b2',.49));
 // The default palette matches artwork() in the reference renderer exactly.
 if(accent&&face.toLowerCase()==='#ffb929'){gradient.addColorStop(0,'#ffb929');gradient.addColorStop(1,'#f15b03');}
 if(!accent&&face.toLowerCase()==='#ffffff')gradient.addColorStop(1,'#d0d2d7');
 ctx.fillStyle=captionFill(ctx,text,x,y,size,settings,gradient);ctx.fillText(text,x,y);
 const edge=newLayer();edge.width=canvas.width;edge.height=canvas.height;
 const ink=edge.getContext('2d') as CanvasRenderingContext2D;ink.font=font;ink.letterSpacing=ctx.letterSpacing;ink.fillStyle=originalOrange?'#fff4cd':tint(face,'#ffffff',.8);ink.fillText(text,x,y);
 ink.globalCompositeOperation='destination-out';ink.fillText(text,x,y+unit);
 ctx.globalAlpha=.55;ctx.drawImage(edge,0,0);ctx.globalAlpha=1;
 // Fine brushed grain is clipped to the letter faces, independent of the word shadow.
 ink.globalCompositeOperation='source-over';ink.clearRect(0,0,edge.width,edge.height);
 for(let row=0;row<edge.height;row+=Math.max(1,unit)){const grain=Math.sin(row*12.9898)*43758.5453,light=grain-Math.floor(grain);ink.fillStyle=light>.5?'#ffffff':originalOrange?'#20140b':tint(face,'#000000',.85);ink.globalAlpha=.04+light*.08;ink.fillRect(0,row,edge.width,Math.max(1,unit));}
 ink.globalAlpha=1;ink.globalCompositeOperation='destination-in';ink.fillStyle='#fff';ink.fillText(text,x,y);ctx.drawImage(edge,0,0);
 drawTextSurface(ctx,text,x,y,size,settings);
 const result={canvas,width:m.width,height,pad};artworkCache.set(key,result);
 if(artworkCache.size>180)artworkCache.delete(artworkCache.keys().next().value!);
 return result;
}
let scratch:Layer|undefined;
export function drawPremiumOrange(ctx:CanvasRenderingContext2D,segment:Segment,time:number,settings:CaptionSettings,headBottom?:number):CaptionBounds|null{
 if(segment.effectOnly||time<segment.start||time>=segment.end)return null;
 const page=pagesFor(segment,settings).find(p=>time>=p.start&&time<p.end);if(!page)return null;
 const w=ctx.canvas.width,h=ctx.canvas.height,unit=Math.min(w/1080,h/1400),maxWidth=w*.875*Math.max(1,settings.fontScale/250);
 const cx=(segment.position?.x??settings.x)/100*w,cy=(segment.position?.y??settings.y)/100*h;
 const fontScale=settings.fontSizePx?settings.fontSizePx*w/1080/(77*unit):Math.max(.2,Math.min(6,settings.fontScale/100));
 type Row={words:Word[];accent:boolean;size:number;font:string;width:number;height:number;space:number};
 const rows:Row[]=[];
 const font=(size:number)=>`${page.italic?'italic ':''}${settings.fontWeight||700} ${size}px ${settings.fontFamily}`;
 ctx.save();ctx.letterSpacing=`${settings.letterSpacing??0}px`;
 for(const word of page.words){
  const size=(word.accent?135:77)*unit*fontScale;
  ctx.font=font(size);ctx.letterSpacing=`${size*(settings.letterSpacing??0)/100}px`;const width=ctx.measureText(word.text).width,space=ctx.measureText(' ').width;
  let row=rows.at(-1);
  if(!row||row.accent!==word.accent||word.breakBefore||(row.words.length>=Math.ceil(page.words.length/3)&&rows.length<3&&word.accent===row.accent)){row={words:[],accent:word.accent,size,font:font(size),width:0,height:0,space};rows.push(row);}
  row.width+=(row.words.length?space:0)+width;row.words.push(word);
 }
 // Long phrases shrink as one compact block instead of spilling beyond the frame.
 for(const row of rows){
  row.size*=Math.min(1,maxWidth/Math.max(1,row.width),3/Math.max(3,rows.length));row.font=font(row.size);ctx.font=row.font;
  ctx.letterSpacing=`${row.size*(settings.letterSpacing??0)/100}px`;
  const m=ctx.measureText(row.words.map(word=>word.text).join(' '));row.width=m.width;row.height=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;row.space=ctx.measureText(' ').width;
 }
 const gap=(page.italic?-10:-7)*unit*fontScale,total=rows.reduce((sum,row)=>sum+row.height,0)+gap*(rows.length-1);
 let top=headBottom===undefined?-total/2:Math.max(-total/2,Math.min((headBottom+.035)*h-cy,h*.97-cy-total));const bounds:CaptionBounds['words']=[];
 ctx.translate(cx,cy);ctx.rotate(settings.rotation*Math.PI/180);
 for(const [ri,row] of rows.entries()){
  let left=settings.alignment==='left'?-maxWidth/2:settings.alignment==='right'?maxWidth/2-row.width:-row.width/2;
  left+=(rows.length===3?[0,-20,16][ri]:(ri%2?8:0))*unit;
  for(const word of row.words){
   ctx.font=row.font;ctx.letterSpacing=`${row.size*(settings.letterSpacing??0)/100}px`;const width=ctx.measureText(word.text).width,age=time-word.start;
   if(age>=0&&!segment.hiddenTitleWords?.includes(word.index)){
    const own=segment.wordStyles?.[word.index]?.settings;
    const art=artwork(word.text,row.font,row.size,row.accent,own?{...settings,...own}:settings);
    // Compress only short entrances, leaving time for the last word to become readable.
    const speed=Math.min(1,Math.max(.12,(page.end-word.start)/.60)),clock=age/speed;
    const duration=page.italic?.46:.48,p=clamp(clock/duration),rest=(1-p)**3;
    const fade=Math.min(page.index%3===0?.12:.18,(page.end-word.start)*.2),exit=clamp((page.end-time)/Math.max(.01,fade));
    const dx=(page.italic?(ri%2===0?12:-12):row.accent?-16:ri===1?-14:10)*rest*unit;
    const dy=((page.italic?76+ri*9:row.accent?55:74+ri*8)*rest-(1-exit)*9)*unit;
    const alpha=page.italic?smooth(clock/.32):row.accent?1:smooth(clock/(Array.from(word.text).length<=3?.20:.28));
    const blur=(page.italic?1.8:row.accent?1.4:1.5)*(1-p)**2*unit;
    let image=art.canvas;
    if(row.accent&&!page.italic&&clock<.4){
     scratch??=newLayer();scratch.width=image.width;scratch.height=image.height;const ink=scratch.getContext('2d') as CanvasRenderingContext2D;ink.drawImage(image,0,0);ink.globalCompositeOperation='destination-in';
     const mask=ink.createLinearGradient(0,0,image.width,0);
     for(let i=0;i<=32;i++)mask.addColorStop(i/32,`rgba(255,255,255,${smooth((clock-i/32*.13)/.27)})`);
     ink.fillStyle=mask;ink.fillRect(0,0,image.width,image.height);image=scratch;
    }
    const ox=(segment.wordOffsets?.[word.index]?.x??0)/100*w,oy=(segment.wordOffsets?.[word.index]?.y??0)/100*h;
    ctx.save();ctx.globalAlpha*=alpha*exit;ctx.filter=blur>.15?`blur(${blur}px)`:'none';ctx.drawImage(image,left-art.pad+dx+ox,top-art.pad+dy+oy);ctx.textBaseline='alphabetic';const baseline=top+dy+oy+ctx.measureText(word.text).actualBoundingBoxAscent;drawTextShine(ctx,word.text,left+dx+ox,baseline,row.size,settings,age);if(settings.underline)drawTextUnderline(ctx,word.text,left+dx+ox,baseline,row.size,{...settings,textUnderline:true},age);ctx.restore();
    const angle=settings.rotation*Math.PI/180,bx=left+width/2+ox,by=top+art.height/2+oy;
    bounds.push({index:word.index,text:word.text,x:(cx+bx*Math.cos(angle)-by*Math.sin(angle))/w*100,y:(cy+bx*Math.sin(angle)+by*Math.cos(angle))/h*100,width:width/w*100,height:art.height/h*100,rotation:settings.rotation});
   }
   left+=width+row.space;
  }
  top+=row.height+gap;
 }
 ctx.restore();return {x:cx/w*100,y:cy/h*100,width:Math.max(...rows.map(r=>r.width))/w*100,height:total/h*100,rotation:settings.rotation,segmentId:segment.id,words:bounds};
}

function premiumCameraRaw(segments:Segment[],style:StyleKey,settings:CaptionSettings,time:number){
 const identity={scale:1,dx:0,dy:0};
 const configured=segments.filter(s=>s.role!=='title'&&!s.effectOnly&&s.text.trim()).map(segment=>{const own=(segment.separateStyle===false?undefined:segment.detachedStyle)||segment.laneStyle;return {segment,style:own?.style??style,settings:own?.settings??settings};});
 const active=configured.find(c=>time>=c.segment.start&&time<c.segment.end);
 if(active&&(active.style!=='premiumOrangeV4'||active.settings.glassCamera===false))return identity;
 const relevant=configured.filter(c=>c.style==='premiumOrangeV4'&&c.settings.glassCamera!==false);
 if(!relevant.length||time<Math.min(...relevant.map(c=>c.segment.start))||time>=Math.max(...relevant.map(c=>c.segment.end)))return identity;
 const intensity=Math.max(0,Math.min(1.5,(active?.settings.glassIntensity??settings.glassIntensity??100)/100));
 let zoom=0,dx=0,dy=0;
 for(const c of relevant){for(const page of pagesFor(c.segment,c.settings)){
  const first=page.words.find(word=>word.accent);if(!first)continue;const age=time-first.start;
  if(age>=0&&age<1.15)zoom=Math.max(zoom,.035*(age<.30?smooth(age/.30):1-smooth((age-.30)/.85)));
  if(age>=0&&age<.48){const envelope=Math.sin(Math.PI*age/.48)**2,shake=page.italic?.004:.0025;
   dx+=shake*Math.sin(2*Math.PI*3.5*age)*envelope;dy+=shake*.55*Math.sin(2*Math.PI*3.5*age+.5)*envelope;}
 }}
 const scale=1+(.025+zoom)*intensity;
 // Center-based adapters include the reference's 46% vertical anchor as translation.
 return {scale,dx:Math.max(-.005,Math.min(.005,dx))*intensity,dy:(.5-.46)*(scale-1)+Math.max(-.003,Math.min(.003,dy))*intensity};
}

/** Symmetric frame-time smoothing preserves seeking/export determinism and softens cuts. */
export function premiumCamera(segments:Segment[],style:StyleKey,settings:CaptionSettings,time:number){
 const current=segments.find(s=>s.role!=='title'&&time>=s.start&&time<s.end);
 const own=current&&((current.separateStyle===false?undefined:current.detachedStyle)||current.laneStyle);
 if((own?.settings??settings).glassCamera===false)return {scale:1,dx:0,dy:0};
 let scale=0,dx=0,dy=0,total=0;
 for(let i=-4;i<=4;i++){const weight=5-Math.abs(i),state=premiumCameraRaw(segments,style,settings,time+i/4*0.1);scale+=state.scale*weight;dx+=state.dx*weight;dy+=state.dy*weight;total+=weight;}
 return {scale:scale/total,dx:dx/total,dy:dy/total};
}
