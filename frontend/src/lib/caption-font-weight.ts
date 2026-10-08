type Layer=HTMLCanvasElement|OffscreenCanvas;
const make=(w:number,h:number):Layer=>typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
const ink=(layer:Layer)=>layer.getContext('2d') as CanvasRenderingContext2D;
const staticScript=(family:string)=>/ArtBrush|Pinyon Script/.test(family.split(',')[0]);
export const normalizeCaptionFont=(font:string)=>staticScript(font)?font.replace(/^(?:(italic|oblique)\s+)?(?:[1-9]00|bold|normal)\s+/,(_match,slant:string|undefined)=>(slant?slant+' ':'')+'400 '):font;
export const canvasFontWeight=(family:string,weight:number)=>staticScript(family)?400:weight;
const masks=new Map<string,{layer:Layer;x:number;y:number}>();
let paint:Layer|undefined;
/** Approximate intermediate weights for the bundled single-face script fonts. */
export function fillCaptionGlyphs(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,weight?:number){
 if(!weight||weight===400||!staticScript(ctx.font)){ctx.fillText(text,x,y);return;}
 const key=JSON.stringify([text,ctx.font,ctx.letterSpacing,ctx.textBaseline,ctx.textAlign,weight]);
 let mask=masks.get(key);
 if(!mask){
  const m=ctx.measureText(text),pad=Math.ceil(size*.12+2),w=Math.max(1,Math.ceil(m.actualBoundingBoxLeft+m.actualBoundingBoxRight+pad*2)),h=Math.max(1,Math.ceil(m.actualBoundingBoxAscent+m.actualBoundingBoxDescent+pad*2));
  if(w>8192||h>4096){ctx.fillText(text,x,y);return;}
  const layer=make(w,h),c=ink(layer),ox=pad+m.actualBoundingBoxLeft,oy=pad+m.actualBoundingBoxAscent;
  c.font=ctx.font;c.letterSpacing=ctx.letterSpacing;c.textBaseline=ctx.textBaseline;c.textAlign=ctx.textAlign;c.fillStyle='#fff';c.fillText(text,ox,oy);
  if(weight>400){c.strokeStyle='#fff';c.lineJoin='round';c.lineWidth=size*.009*(weight-400)/100;c.strokeText(text,ox,oy);}
  else {const source=make(w,h);ink(source).drawImage(layer,0,0);const inset=size*.006*(400-weight)/100;c.globalCompositeOperation='destination-in';for(const [dx,dy] of [[inset,0],[-inset,0],[0,inset],[0,-inset]])c.drawImage(source,dx,dy);}
  mask={layer,x:ox,y:oy};masks.set(key,mask);if(masks.size>64)masks.delete(masks.keys().next().value!);
 }
 paint??=make(1,1);paint.width=mask.layer.width;paint.height=mask.layer.height;
 const c=ink(paint);c.drawImage(mask.layer,0,0);c.globalCompositeOperation='source-in';c.translate(mask.x-x,mask.y-y);c.fillStyle=ctx.fillStyle;c.fillRect(x-mask.x,y-mask.y,paint.width,paint.height);
 ctx.drawImage(paint,x-mask.x,y-mask.y);
}
