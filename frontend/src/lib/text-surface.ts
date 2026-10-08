import {drawScriptStroke} from './caption-script-stroke';
import {captionTextureFill,textureFillRevision} from './caption-texture-fill';
import {paintCaptionLightEffects} from './caption-light-effects';
import {fillCaptionGlyphs} from './caption-font-weight';
import type {CaptionSettings} from '../config/captions/presets';
const cache=new Map<string,OffscreenCanvas|HTMLCanvasElement>();
const gradientTiles=new Map<string,OffscreenCanvas|HTMLCanvasElement>();
/** One continuous gradient over an intact word, never restarted on individual letters. */
export function captionFill(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,settings:CaptionSettings,fallback:string|CanvasGradient,time=0):string|CanvasGradient|CanvasPattern{
 const originalGold=settings.fillTexture==='goldReference'?goldReferenceFill(ctx,size,settings):undefined;if(originalGold)return originalGold;
 const texture=captionTextureFill(ctx,text,x,y,size,settings,time);if(texture)return texture;
 if(!settings.textGradient)return fallback;
 const a=settings.textGradientStart??settings.textColor,b=settings.textGradientEnd??settings.highlightColor;
 const m=ctx.measureText(text),width=Math.max(1,m.width),height=Math.max(1,m.actualBoundingBoxAscent+m.actualBoundingBoxDescent||size),top=y-m.actualBoundingBoxAscent;
 x-=ctx.textAlign==='center'?width/2:ctx.textAlign==='right'||ctx.textAlign==='end'?width:0;
 const angle=(settings.gradientAngle??90)*Math.PI/180,cx=x+width/2,cy=top+height/2;
 if(settings.textGradientMode==='wave'){
  const key=JSON.stringify([a,b,settings.textGradientMiddle,angle]);let tile=gradientTiles.get(key);
  if(!tile){tile=canvas(192,96)??undefined;if(tile){
   const c=tile.getContext('2d') as CanvasRenderingContext2D;c.fillStyle=a;c.fillRect(0,0,1,1);c.fillStyle=b;c.fillRect(1,0,1,1);c.fillStyle=settings.textGradientMiddle??a;c.fillRect(2,0,1,1);
   const colors=c.getImageData(0,0,3,1).data,pixels=c.createImageData(192,96),extent=Math.max(.001,Math.abs(Math.cos(angle))+Math.abs(Math.sin(angle)));
   for(let j=0;j<96;j++)for(let i=0;i<192;i++){
    const nx=i/191,ny=j/95,t=Math.max(0,Math.min(1,.5+((nx-.5)*Math.cos(angle)+(ny-.5)*Math.sin(angle))/extent+.2*Math.sin(nx*Math.PI*2))),index=(j*192+i)*4;
    const from=settings.textGradientMiddle&&t>=.5?8:0,to=settings.textGradientMiddle&&t<.5?8:4,mix=settings.textGradientMiddle?(t<.5?t*2:(t-.5)*2):t;
    for(let k=0;k<4;k++)pixels.data[index+k]=Math.round(colors[from+k]*(1-mix)+colors[to+k]*mix);
   }
   c.putImageData(pixels,0,0);gradientTiles.set(key,tile);if(gradientTiles.size>24)gradientTiles.delete(gradientTiles.keys().next().value!);
  }}
  if(tile){const pattern=ctx.createPattern(tile,'no-repeat');if(pattern){pattern.setTransform(new DOMMatrix().translate(x,top).scale(width/192,height/96));return pattern;}}
 }
 const extent=Math.max(1,(Math.abs(Math.cos(angle))*width+Math.abs(Math.sin(angle))*height)/2);
 const gradient=settings.textGradientMode==='radial'?ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(width,height)/2):ctx.createLinearGradient(cx-Math.cos(angle)*extent,cy-Math.sin(angle)*extent,cx+Math.cos(angle)*extent,cy+Math.sin(angle)*extent);
 if(settings.textGradientMode==='rainbow'){['#ff375f','#ff9f0a','#ffe45c','#32d475','#27bfff','#5964ff','#c957ff'].forEach((color,index)=>gradient.addColorStop(index/6,color));return gradient;}
 gradient.addColorStop(0,a);if(settings.textGradientMiddle)gradient.addColorStop(.5,settings.textGradientMiddle);gradient.addColorStop(1,b);return gradient;
}
function canvas(w:number,h:number){if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(w,h);if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}return null;}
let featheredFace:OffscreenCanvas|HTMLCanvasElement|null=null;
/** Feather only the painted glyphs, leaving the surrounding ice untouched. */
export function drawFeatheredFace(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,paint:(face:CanvasRenderingContext2D)=>void){
 const metrics=ctx.measureText(text),pad=Math.ceil(size*.5),left=Math.max(0,metrics.actualBoundingBoxLeft),ascent=metrics.actualBoundingBoxAscent,descent=metrics.actualBoundingBoxDescent;
 const w=Math.max(1,Math.ceil(Math.max(metrics.width,left+metrics.actualBoundingBoxRight)+pad*2)),h=Math.max(1,Math.ceil(ascent+descent+pad*2));
 featheredFace??=canvas(w,h);if(!featheredFace){paint(ctx);return;}
 featheredFace.width=w;featheredFace.height=h;
 const face=featheredFace.getContext('2d') as CanvasRenderingContext2D;
 face.font=ctx.font;face.letterSpacing=ctx.letterSpacing;face.textAlign=ctx.textAlign;face.textBaseline=ctx.textBaseline;
 face.translate(pad+left-x,pad+ascent-y);paint(face);face.setTransform(1,0,0,1,0,0);
 const fade=face.createLinearGradient(0,pad,0,pad+Math.max(1,ascent+descent));
 fade.addColorStop(0,'#ffffff55');fade.addColorStop(.22,'#fff');fade.addColorStop(.75,'#fff');fade.addColorStop(1,'#ffffff55');
 face.globalCompositeOperation='destination-in';face.fillStyle=fade;face.fillRect(0,0,w,h);
 ctx.drawImage(featheredFace,x-pad-left,y-pad-ascent);
}
/** Luminance and bevel masks shade the actual glyph face; transparent space stays untouched. */
export function drawTextSurface(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,settings:CaptionSettings){
 const strength=(settings.surfaceStrength??0)/100;if(!strength)return;
 const material=settings.textMaterial??'matte',angle=(settings.surfaceLightAngle??-45)*Math.PI/180,bevel=Math.max(0,size*(settings.surfaceBevel??35)/100*.07);
 const pad=Math.ceil(size*.3),w=Math.ceil(ctx.measureText(text).width+pad*2),h=Math.ceil(size*1.8);
 if(w>4096||h>2048)return;
 const key=JSON.stringify([text,ctx.font,ctx.textBaseline,ctx.letterSpacing,size,material,strength,angle,bevel,settings.textColor,settings.surfaceOpacity,settings.surfaceHighlight,settings.surfaceShadow,settings.surfaceColor]);
 let face=cache.get(key);
 if(!face){
  const target=canvas(w,h),edge=canvas(w,h);if(!target||!edge)return;
  const c=target.getContext('2d') as CanvasRenderingContext2D|null,e=edge.getContext('2d') as CanvasRenderingContext2D|null;if(!c||!e)return;
  for(const layer of [c,e]){layer.font=ctx.font;layer.textBaseline=ctx.textBaseline;layer.textAlign='left';layer.letterSpacing=ctx.letterSpacing;}
  const baseline=h/2;
  c.fillStyle='#fff';c.fillText(text,pad,baseline);c.globalCompositeOperation='source-in';
  const tint=settings.surfaceColor??'#ffffff';e.fillStyle=tint;e.fillRect(0,0,1,1);const rgb=e.getImageData(0,0,1,1).data;e.clearRect(0,0,1,1);const highlight=(alpha:number)=>`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  const light=c.createLinearGradient(w/2-Math.cos(angle)*size,h/2-Math.sin(angle)*size,w/2+Math.cos(angle)*size,h/2+Math.sin(angle)*size);
  light.addColorStop(0,highlight(strength*.45));light.addColorStop(material==='metal'?.42:.5,highlight(strength*.08));
  if(material==='metal'){light.addColorStop(.48,highlight(strength*.7));light.addColorStop(.52,`rgba(0,0,0,${strength*.45})`);}
  light.addColorStop(1,`rgba(0,0,0,${strength*.45})`);c.fillStyle=light;c.fillRect(0,0,w,h);c.globalCompositeOperation='source-over';
  for(const sign of [1,-1]){e.clearRect(0,0,w,h);e.globalCompositeOperation='source-over';e.fillStyle=sign===1?`rgba(255,255,255,${strength*(settings.surfaceHighlight??90)/100})`:`rgba(0,0,0,${strength*(settings.surfaceShadow??80)/100})`;e.fillText(text,pad,baseline);e.globalCompositeOperation='destination-out';e.fillStyle='#000';e.fillText(text,pad+Math.cos(angle)*bevel*sign,baseline+Math.sin(angle)*bevel*sign);c.drawImage(edge,0,0);}
  // A separate glyph mask clips both tint and material detail to the letter face.
  e.globalCompositeOperation='source-over';e.clearRect(0,0,w,h);e.fillStyle='#fff';e.fillText(text,pad,baseline);e.globalCompositeOperation='source-in';
  e.fillStyle=settings.textColor;e.globalAlpha=Math.min(.8,Math.max(0,(settings.surfaceOpacity??25)/100))*strength;e.fillRect(0,0,w,h);e.globalAlpha=1;
  e.globalCompositeOperation='source-atop';
  if(material==='brushed'||material==='satin')for(let row=0;row<h;row+=material==='brushed'?2:1){const wave=material==='brushed'?Math.sin(row*13.37):Math.sin(row/size*32);e.fillStyle=wave>0?'#fff':'#000';e.globalAlpha=Math.abs(wave)*strength*(material==='brushed'?.24:.18);e.fillRect(0,row,w,1);}
  if(material==='stone')for(let row=0;row<h;row+=2)for(let col=0;col<w;col+=2){const grain=Math.sin(col*12.9898+row*78.233)*43758.5453%1;e.fillStyle=grain>0?'#fff':'#000';e.globalAlpha=Math.abs(grain)*strength*.35;e.fillRect(col,row,1,1);}
  e.globalAlpha=1;c.drawImage(edge,0,0);
  face=target;if(cache.size>=96)cache.delete(cache.keys().next().value!);cache.set(key,face);
 }
 ctx.save();ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.drawImage(face,x-pad,y-h/2);ctx.restore();
}

export function captionEase(progress:number,curve:CaptionSettings['motionCurve']){
 const p=Math.max(0,Math.min(1,progress));
 if(curve==='linear'||!curve)return p;
 if(curve==='smooth')return p*p*p*(p*(p*6-15)+10);
 if(curve==='softStop')return 1-Math.pow(1-p,4);
 return 1-Math.pow(1-p,3)*Math.cos(p*Math.PI*3);
}
let shineLayer:OffscreenCanvas|HTMLCanvasElement|null=null;
/** Light is clipped to glyph alpha, not the surrounding word rectangle. */
export function drawTextShine(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,settings:CaptionSettings,time:number){
 const mode=settings.shineMode??'none';if(mode==='none')return;
 const pad=Math.ceil(size*.3),w=Math.ceil(ctx.measureText(text).width+pad*2),h=Math.ceil(size*1.8);
 if(w<1||w>4096||h>2048)return;
 if(!shineLayer)shineLayer=canvas(w,h);if(!shineLayer)return;
 if(shineLayer.width!==w)shineLayer.width=w;if(shineLayer.height!==h)shineLayer.height=h;
 const c=shineLayer.getContext('2d') as CanvasRenderingContext2D|null;if(!c)return;
 c.clearRect(0,0,w,h);c.globalCompositeOperation='source-over';c.globalAlpha=1;
 c.font=ctx.font;c.textAlign='left';c.textBaseline=ctx.textBaseline;c.letterSpacing=ctx.letterSpacing;c.fillStyle='#fff';c.fillText(text,pad,h/2);
 c.globalCompositeOperation='source-in';
 const speed=Math.max(.1,settings.shineSpeed??1),phase=((time*speed/2.4)%1+1)%1;
 const width=size*(.15+Math.max(0,Math.min(100,settings.shineWidth??40))/100*1.4),center=-width+(w+width*2)*phase;
 const g=c.createLinearGradient(center-width,mode==='diagonal'?0:h/2,center+width,mode==='diagonal'?h:h/2);
 g.addColorStop(0,'#ffffff00');g.addColorStop(mode==='double'?.25:.5,'#ffffff');
 if(mode==='double'){g.addColorStop(.5,'#ffffff00');g.addColorStop(.75,'#ffffff');}g.addColorStop(1,'#ffffff00');
 c.fillStyle=g;c.fillRect(0,0,w,h);
 if(mode==='ripple'){
  c.globalCompositeOperation='source-atop';c.globalAlpha=.65;
  for(let row=0;row<h;row+=2){c.fillStyle=`rgba(255,255,255,${.5+.5*Math.sin(row/size*24-time*speed*5)})`;c.fillRect(0,row,w,2);}
 }
 ctx.save();ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.globalAlpha*=Math.max(0,Math.min(1,(settings.shineStrength??55)/100));ctx.drawImage(shineLayer,x-pad,y-h/2);ctx.restore();
}

/** Irregular frost blooms behind the whole text, growing in patches and gently dissipating. */
export function drawBorderMist(ctx:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,size:number,age:number,settings:CaptionSettings){
 const duration=Math.max(.3,settings.smokeDuration??1.2),life=Math.max(0,age)/duration;
 const spread=Math.max(0,Math.min(1,(settings.smokeSpread??65)/100));
 if(life>2.3)return;
 const fade=1-Math.max(0,Math.min(1,(life-1)/1.3));
 ctx.save();const cx=x+width/2,cy=y+height/2;
 ctx.translate(cx,cy);ctx.scale(Math.max(.5,Math.min(3,(settings.frostWidth??100)/100)),Math.max(.5,Math.min(4,(settings.frostHeight??100)/100)));ctx.translate(-cx,-cy);
 const alpha=ctx.globalAlpha;ctx.fillStyle=settings.highlightColor;ctx.strokeStyle=settings.highlightColor;
 for(let j=0;j<38;j++){
  const random=(n:number)=>{const v=Math.sin(n*127.1+31.7)*43758.5453;return v-Math.floor(v);};
  const growth=Math.max(0,Math.min(1,(life-random(j+81)*.3)/.65));if(!growth)continue;
  const px=x+width*random(j+1),py=y+height*(.1+.8*random(j+43));
  const radius=size*(.15+random(j+117)*.35)*(1+spread*.8)*growth;
  const glow=ctx.createRadialGradient(px,py,0,px,py,radius);glow.addColorStop(0,settings.highlightColor);glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.globalAlpha=alpha*fade*(.1+.16*random(j+22));ctx.fillRect(px-radius,py-radius,radius*2,radius*2);
  ctx.globalAlpha=alpha*fade*.23*growth;ctx.lineWidth=Math.max(.4,size*.006);ctx.beginPath();
  for(let branch=0;branch<5;branch++){const angle=branch*Math.PI*2/5+random(j)*3,dx=Math.cos(angle),dy=Math.sin(angle),r=radius*(.5+random(j+branch)*.5);ctx.moveTo(px,py);ctx.lineTo(px+dx*r,py+dy*r);for(const sign of [-1,1]){ctx.moveTo(px+dx*r*.55,py+dy*r*.55);ctx.lineTo(px+dx*r*.3-dy*r*.23*sign,py+dy*r*.3+dx*r*.23*sign);}}
  ctx.stroke();
 }
 ctx.restore();
}

let serifTextures:{face:HTMLImageElement;smoke:HTMLImageElement}|undefined;
let serifLoading:Promise<void>|undefined;
export function prepareSerifTextures(){
 if(serifLoading)return serifLoading;
 if(typeof Image==='undefined')return Promise.resolve();
 const load=(name:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Teksture za Testni Serif nisu dostupne.'));img.src=`/caption-textures/test-serif/${name}.png`;});
 serifLoading=Promise.all([load('face'),load('smoke')]).then(([face,smoke])=>{serifTextures={face,smoke};}).catch(error=>{serifLoading=undefined;throw error;});return serifLoading;
}
let serifLayer:OffscreenCanvas|HTMLCanvasElement|null=null;
/** Fixed phrase background; glyph smoke is composited separately. */
export function drawSerifTextures(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,age:number,settings:CaptionSettings,displayWidth?:number){
 if(settings.textureBackground===false)return;
 if(!serifTextures){void prepareSerifTextures().catch(()=>{});return;}
 const measured=displayWidth??ctx.measureText(text).width,w=Math.ceil(Math.max(ctx.canvas.width*.55,measured+size*.3)),h=Math.ceil(size*2.7);
 if(w>4096||h>2048||w<1)return;
 serifLayer??=canvas(w,h);if(!serifLayer)return;if(serifLayer.width!==w)serifLayer.width=w;if(serifLayer.height!==h)serifLayer.height=h;
 const c=serifLayer.getContext('2d') as CanvasRenderingContext2D|null;if(!c)return;


 for(let pass=0;pass<2;pass++){
  c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.clearRect(0,0,w,h);
  const tw=w,th=h;
  const texture=pass?serifTextures.smoke:serifTextures.face;
  c.drawImage(texture,texture.naturalWidth*.1,0,texture.naturalWidth*.8,texture.naturalHeight,(w-tw)/2,(h-th)/2,tw,th);
  c.globalCompositeOperation='source-atop';c.globalAlpha=.18;c.fillStyle=settings.highlightColor;c.fillRect(0,0,w,h);c.globalAlpha=1;
  // Feather the perimeter of the whole background, preserving the PNG's irregular interior.
  c.globalCompositeOperation='destination-in';c.save();c.translate(w/2,h/2);c.scale(w/2,h/2);
  const edge=c.createRadialGradient(0,0,.35,0,0,1.1);edge.addColorStop(0,'#fff');edge.addColorStop(.6,'#ffffffcc');edge.addColorStop(1,'#ffffff00');c.fillStyle=edge;c.fillRect(-1,-1,2,2);c.restore();

  ctx.save();ctx.shadowBlur=0;const progress=Math.max(0,Math.min(1,age/Math.max(.02,settings.smokeDuration??2.1)));ctx.globalAlpha*=pass?.18*progress*progress*(3-2*progress):Math.max(0,Math.min(1,(settings.textureOpacity??100)/100));
  const sx=Math.max(.5,Math.min(3,(settings.frostWidth??100)/100)),sy=Math.max(.5,Math.min(4,(settings.frostHeight??100)/100));ctx.translate(x+measured/2,y);ctx.scale(sx,sy);
  // Reveal the stationary PNG through a growing, feathered irregular mask.
  c.globalCompositeOperation='destination-in';c.globalAlpha=1;
  const radius=.24+.9*(1-Math.pow(1-progress,3));c.save();c.translate(w/2,h/2);c.scale(w/2,h/2);
  const revealMask=c.createRadialGradient(0,0,radius*.22,0,0,radius);revealMask.addColorStop(0,'#fff');revealMask.addColorStop(.65,'#ffffffdd');revealMask.addColorStop(1,'#ffffff00');c.fillStyle=revealMask;c.fillRect(-1,-1,2,2);c.restore();
  ctx.globalAlpha*=.35+.65*progress;ctx.drawImage(serifLayer,-w/2,-h/2);ctx.restore();
 }
}

/** Outline layers share the same word-wide gradient geometry as the fill. */
export function drawCaptionOutlines(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,settings:CaptionSettings,includePrimary=true){
 ctx.save();ctx.lineJoin='round';ctx.miterLimit=2;
 const layers=[...(settings.outlineLayers??[]).slice(0,2)];
 if(includePrimary)layers.push({color:settings.outlineColor,width:settings.outlineWidth,gradient:settings.outlineGradient,endColor:settings.outlineGradientEnd,style:settings.outlineStyle});
 for(const layer of layers.sort((a,b)=>b.width-a.width)){
  if(layer.width<=0)continue;
  ctx.save();ctx.strokeStyle=layer.color;
  const width=layer.width*size/17;ctx.lineWidth=width;
  if(layer.style==='dashed')ctx.setLineDash([width*2,width*1.5]);
  if(layer.style==='dotted'){ctx.lineCap='round';ctx.setLineDash([width*.15,width*1.6]);}
  if(layer.style==='neon'||layer.style==='glow'){ctx.shadowColor=layer.color;ctx.shadowBlur=width*(layer.style==='neon'?2:4);ctx.strokeText(text,x,y);}
  if(layer.style==='double'){
    const m=ctx.measureText(text),pad=Math.ceil(width*2+2),w=Math.ceil(m.actualBoundingBoxLeft+m.actualBoundingBoxRight+pad*2),h=Math.ceil(m.actualBoundingBoxAscent+m.actualBoundingBoxDescent+pad*2);
    const buffer=canvas(w,h),ink=buffer?.getContext('2d') as CanvasRenderingContext2D|null;
    if(buffer&&ink){
      const ox=m.actualBoundingBoxLeft+pad,oy=m.actualBoundingBoxAscent+pad;
      ink.font=ctx.font;ink.textAlign=ctx.textAlign;ink.textBaseline=ctx.textBaseline;ink.letterSpacing=ctx.letterSpacing;ink.lineJoin='round';ink.strokeStyle=layer.color;
      ink.lineWidth=width;ink.strokeText(text,ox,oy);ink.globalCompositeOperation='destination-out';ink.lineWidth=width*.65;ink.strokeText(text,ox,oy);
      ink.globalCompositeOperation='source-over';ink.lineWidth=width*.3;ink.strokeText(text,ox,oy);ctx.drawImage(buffer,x-ox,y-oy);
    }
  }else{
    ctx.strokeText(text,x,y);
    if(layer.style==='neon'){ctx.shadowBlur=0;ctx.strokeStyle='#ffffff';ctx.lineWidth=Math.max(.5,width*.22);ctx.strokeText(text,x,y);}
  }
  ctx.restore();
 }
 ctx.restore();
}
/** Font-relative decoration geometry is identical at every output resolution. */
export function drawTextUnderline(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,settings:CaptionSettings,time=1){
 const m=ctx.measureText(text),left=x-(ctx.textAlign==='center'?m.width/2:ctx.textAlign==='right'||ctx.textAlign==='end'?m.width:0);
 for(const strike of [false,true]){
  if(strike?!settings.textStrike:!settings.textUnderline)continue;
  const width=Math.max(1,size*((strike?settings.textStrikeWidth:settings.textUnderlineWidth)??4.5)/100);
  const offset=((strike?settings.textStrikeOffset:settings.textUnderlineOffset)??(strike?0:6))*size/100;
  const top=strike?y+(m.actualBoundingBoxDescent-m.actualBoundingBoxAscent)/2+offset:y+m.actualBoundingBoxDescent+offset+width/2;
  const kind=(strike?settings.textStrikeStyle:settings.textUnderlineStyle)??'solid';
  ctx.save();ctx.strokeStyle=(strike?settings.textStrikeColor:settings.textUnderlineColor)||ctx.fillStyle;ctx.lineWidth=width;
  ctx.setLineDash(kind==='dashed'?[width*3,width*2]:kind==='dotted'?[width,width*2]:[]);
  const angle=Math.max(-20,Math.min(20,(strike?settings.textStrikeSkew:settings.textUnderlineSkew)??0))*Math.PI/180;
  ctx.translate(left+m.width/2,top);ctx.rotate(angle);ctx.translate(-left-m.width/2,-top);

  if(kind==='script'){ctx.translate(left+m.width/2,top-size*.67);drawScriptStroke(ctx,m.width,size,time,{...settings,highlightColor:(strike?settings.textStrikeColor:settings.textUnderlineColor)||settings.textColor});}
  else if(kind==='marker'){
   ctx.fillStyle=ctx.strokeStyle;ctx.globalAlpha*=.8;
   // Stable text-based variation: no flicker between preview/export frames.
   let seed=2166136261;for(const char of text)seed=Math.imul(seed^char.charCodeAt(0),16777619);
   const random=(salt:number)=>{const n=Math.sin((seed>>>0)+salt*127.1)*43758.5453;return n-Math.floor(n);};
   const reach=Math.min(size*.24,m.width*.2),start=left+(random(1)*2-1)*reach,end=left+m.width+(random(2)*2-1)*reach,phase=random(3)*Math.PI*2;
   const edge=(t:number)=>Math.sin(t*8+phase)*width*.24+Math.sin(t*31+phase)*width*.09;
   ctx.beginPath();for(let i=0;i<=24;i++){const t=i/24,px=start+(end-start)*t+width*.7,py=top+edge(t)-width;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
   for(let i=24;i>=0;i--){const t=i/24;ctx.lineTo(start+(end-start)*t-width*.7,top+edge(t)+width);}
   ctx.closePath();ctx.fill();
  }else if(kind==='pencil'){
   ctx.lineCap='round';ctx.lineJoin='round';
   const passes=3;
   for(let pass=0;pass<passes;pass++){
    ctx.save();ctx.globalAlpha*=.65;ctx.lineWidth=Math.max(.5,width*.24);
    ctx.beginPath();for(let i=0;i<=24;i++){
     const t=i/24,px=left+m.width*t,py=top+Math.sin(t*8+pass)*width*.24+Math.sin(t*31+pass*3)*width*.09+(pass-1)*width*.3;
     if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    }ctx.stroke();ctx.restore();
   }
  }else{
   ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left+m.width,top);
   if(kind==='double'){ctx.moveTo(left,top+width*2);ctx.lineTo(left+m.width,top+width*2);}
   ctx.stroke();
  }
  ctx.restore();
 }
}
/** Reusable preset face: outermost stroke first, then a solid or gradient fill. */
export function drawPresetFace(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,settings:CaptionSettings,fallback:string|CanvasGradient,time=0){
 paintCaptionLightEffects(ctx,text,x,y,size,settings,time,()=>{
 ctx.save();ctx.lineJoin='round';ctx.miterLimit=2;
 drawCaptionOutlines(ctx,text,x,y,size,settings,!!settings.customOutline||!!settings.outlineGradient||!!settings.outlineLayers?.length);
 ctx.fillStyle=captionFill(ctx,text,x,y,size,settings,fallback,time);
 ctx.globalAlpha*=Math.max(0,Math.min(1,(settings.textOpacity??100)/100));
 fillCaptionGlyphs(ctx,text,x,y,size,settings.fontWeight);
 if(settings.fillTexture&&['matte','metal','brushed','stone','satin'].includes(settings.fillTexture))drawTextSurface(ctx,text,x,y,size,{...settings,textMaterial:settings.fillTexture as CaptionSettings['textMaterial'],surfaceStrength:settings.surfaceStrength||60,surfaceBevel:settings.surfaceBevel??35});
 if(settings.textUnderline||settings.textStrike)drawTextUnderline(ctx,text,x,y,size,settings,time);if(settings.fillTexture==='goldReference'||settings.faceTexture==='goldMesh'&&(!settings.fillTexture||settings.fillTexture==='none'))drawGoldTexture(ctx,text,x,y,size,settings.fillTexture==='goldReference'?{...settings,textColor:settings.fillTextureColor??'#ffbc38',highlightColor:settings.fillTextureColor2??'#ffdd54'}:settings);ctx.restore();
 });
}

const serifGlyphCache=new Map<string,OffscreenCanvas|HTMLCanvasElement>();
/** Texture clipped to expanded glyph alpha, animated around each word center. */
export function drawSerifGlyphSmoke(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,age:number,settings:CaptionSettings){
 if(settings.textureBackground===false||!serifTextures)return;
 const width=ctx.measureText(text).width,pad=Math.ceil(size*.5),w=Math.ceil(width+pad*2),h=Math.ceil(size*2);
 if(w>4096||h>2048)return;
 const key=JSON.stringify([text,ctx.font,ctx.letterSpacing,size]);
 let layer=serifGlyphCache.get(key);
 if(!layer){
  layer=canvas(w,h)??undefined;if(!layer)return;
  const c=layer.getContext('2d') as CanvasRenderingContext2D|null;if(!c)return;
  c.font=ctx.font;c.textAlign='left';c.textBaseline='middle';c.letterSpacing=ctx.letterSpacing;
  c.fillStyle='#fff';c.strokeStyle='#fff';c.lineJoin='round';c.lineWidth=size*.10;c.filter=`blur(${size*.035}px)`;
  c.strokeText(text,pad,h/2);c.fillText(text,pad,h/2);c.filter='none';
  c.globalCompositeOperation='source-in';c.drawImage(serifTextures.smoke,0,0,w,h);
  if(serifGlyphCache.size>=64)serifGlyphCache.delete(serifGlyphCache.keys().next().value!);serifGlyphCache.set(key,layer);
 }
 const p=Math.max(0,Math.min(1,age/Math.max(.02,(settings.smokeDuration??2.1)*.45))),ease=1-Math.pow(1-p,3);
 const scale=1+((settings.glyphSmokeScale??115)/100-1)*ease;
 ctx.save();ctx.shadowBlur=0;ctx.globalAlpha*=.22*ease;
 ctx.translate(x+width/2,y);ctx.scale(scale,scale);ctx.drawImage(layer,-w/2,-h/2);ctx.restore();
}
let goldTextures:{face:HTMLImageElement;edge:HTMLImageElement}|undefined;
let goldLoading:Promise<void>|undefined;
export function prepareGoldTextures(){
 if(goldLoading)return goldLoading;if(typeof Image==='undefined')return Promise.resolve();
 const load=(file:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Zlatna tekstura nije učitana.'));i.src=`/caption-textures/gold-mesh/${file}.jpg`;});
 goldLoading=Promise.all([load('face'),load('edge')]).then(([face,edge])=>{goldTextures={face,edge};}).catch(error=>{goldLoading=undefined;throw error;});return goldLoading;
}
const goldFaces=new Map<string,OffscreenCanvas|HTMLCanvasElement>();
export function drawGoldTexture(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,settings:CaptionSettings){
 if(!goldTextures){void prepareGoldTextures().catch(()=>{});return;}
 const width=ctx.measureText(text).width,pad=Math.ceil(size*(.25+(settings.outlineWidth+(settings.outerOutlineWidth??1.19))/17)),w=Math.ceil(width+pad*2),h=Math.ceil(size*1.7);
 if(w>4096||h>2048)return;
 const key=JSON.stringify([text,ctx.font,ctx.letterSpacing,size,settings.textColor,settings.highlightColor,settings.outlineColor,settings.outlineWidth,settings.outerOutlineWidth,settings.textureOpacity,settings.fillTextureScale,settings.fillTexture,settings.textGradient,settings.textGradientStart,settings.textGradientEnd,settings.textGradientMode,settings.textGradientMiddle,settings.gradientAngle]);let layer=goldFaces.get(key);
 if(!layer){
  layer=canvas(w,h)??undefined;if(!layer)return;const c=layer.getContext('2d') as CanvasRenderingContext2D|null;if(!c)return;
  c.font=ctx.font;c.letterSpacing=ctx.letterSpacing;c.textBaseline='middle';c.textAlign='left';c.lineJoin='round';
  c.strokeStyle='#fff';c.lineWidth=(settings.outlineWidth+(settings.outerOutlineWidth??1.19))*size/17;if(c.lineWidth>0&&settings.outlineWidth+(settings.outerOutlineWidth??1.19)>0)c.strokeText(text,pad,h/2);c.globalCompositeOperation='source-in';
  const edge=c.createPattern(tintedGold(goldTextures.edge,settings.highlightColor,'#ffdd54'),'repeat');if(edge){edge.setTransform(new DOMMatrix().scale(size*.18/goldTextures.edge.height));c.fillStyle=edge;c.fillRect(0,0,w,h);}
  c.globalCompositeOperation='source-over';c.strokeStyle=settings.outlineColor;c.lineWidth=settings.outlineWidth*size/17;if(settings.outlineWidth>0)c.strokeText(text,pad,h/2);
  const mask=canvas(w,h),m=mask?.getContext('2d') as CanvasRenderingContext2D|null;if(!mask||!m)return;
  m.font=ctx.font;m.letterSpacing=ctx.letterSpacing;m.textBaseline='middle';m.fillStyle='#fff';m.fillText(text,pad,h/2);m.globalCompositeOperation='source-in';
  const face=m.createPattern(tintedGold(goldTextures.face,settings.textColor,'#ffbc38'),'repeat');if(face){face.setTransform(new DOMMatrix().scale(size*1.506/goldTextures.face.height*(settings.fillTexture==='goldReference'?(settings.fillTextureScale??100)/100:1)));m.fillStyle=face;m.fillRect(0,0,w,h);}
  if(settings.textGradient){m.globalCompositeOperation='source-atop';m.globalAlpha=.75;m.fillStyle=captionFill(m,text,pad,h/2,size,settings,settings.textColor);m.fillRect(0,0,w,h);m.globalAlpha=1;}
  c.drawImage(mask,0,0);if(goldFaces.size>=64)goldFaces.delete(goldFaces.keys().next().value!);goldFaces.set(key,layer);
 }
 ctx.save();ctx.shadowBlur=0;ctx.globalAlpha*=Math.max(0,Math.min(1,(settings.fillTexture==='goldReference'?settings.textureAmount??100:settings.textureOpacity??100)/100));ctx.drawImage(layer,x-pad,y-h/2);ctx.restore();
}

const goldTints=new Map<string,CanvasImageSource>();
function tintedGold(source:HTMLImageElement,color:string,original:string):CanvasImageSource{
 if(color.toLowerCase()===original)return source;
 const key=source.src+color;const cached=goldTints.get(key);if(cached)return cached;
 const result=canvas(source.naturalWidth,source.naturalHeight);if(!result)return source;
 const c=result.getContext('2d') as CanvasRenderingContext2D|null;if(!c)return source;
 c.filter='grayscale(1)';c.drawImage(source,0,0);c.filter='none';c.globalCompositeOperation='multiply';c.fillStyle=color;c.fillRect(0,0,result.width,result.height);
 if(goldTints.size>=24)goldTints.delete(goldTints.keys().next().value!);goldTints.set(key,result);return result;
}

export function serifTexturesReady(){if(!serifTextures)void prepareSerifTextures().catch(()=>{});return !!serifTextures;}
export function captionTextureRevision(){return (serifTextures?1:0)+(goldTextures?2:0)+textureFillRevision()*4;}
if(typeof Image!=='undefined')void prepareSerifTextures().catch(()=>{});

/** Same photographic face tile and scale used by Golden Texture, also for native renderers. */
function goldReferenceFill(ctx:CanvasRenderingContext2D,size:number,settings:CaptionSettings){
 if(!goldTextures){void prepareGoldTextures().catch(()=>{});return;}
 const source=tintedGold(goldTextures.face,settings.fillTextureColor??'#ffbc38','#ffbc38');
 const amount=Math.max(0,Math.min(1,(settings.textureAmount??100)/100));
 const key=JSON.stringify(['gold-blend',settings.textColor,settings.fillTextureColor,amount]);let tile=cache.get(key);
 if(!tile){tile=canvas(goldTextures.face.width,goldTextures.face.height)??undefined;if(!tile)return;const c=tile.getContext('2d') as CanvasRenderingContext2D;c.fillStyle=settings.textColor;c.fillRect(0,0,tile.width,tile.height);c.globalAlpha=amount;c.drawImage(source,0,0);if(cache.size>64)cache.clear();cache.set(key,tile);}
 const pattern=ctx.createPattern(tile,'repeat');
 if(pattern)pattern.setTransform(new DOMMatrix().scale(size*1.506/goldTextures.face.height*(settings.fillTexture==='goldReference'?(settings.fillTextureScale??100)/100:1)));return pattern??undefined;
}
