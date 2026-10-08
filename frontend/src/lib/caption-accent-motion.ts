import {createNeonRiotPainter,riotGlyphPose} from './neon-riot-core.mjs';
import type {CaptionSettings,Segment} from '../config/captions/types';
import type {CaptionBounds,CaptionWordBounds} from './caption-renderer';

type Layer=HTMLCanvasElement|OffscreenCanvas;
const make=(w:number,h:number):Layer=>typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
const painter=createNeonRiotPainter(make);
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const valid=(n:number|undefined,fallback:number)=>Number.isFinite(n)?n!:fallback;
const color=(value:string|undefined,fallback:string)=>/^#[\da-f]{6}$/i.test(value??'')?value!:fallback;
const pool:{face:Layer;tint:Layer}[]=[];
let depth=0;
export const hasCaptionAccent=(s:Partial<CaptionSettings>)=>!!s.accentMotion&&s.accentMotion!=='none'||!!s.accentTrails||!!s.accentParticles;

/** Optional whole-caption motion. Existing style artwork and its own animation stay intact. */
export function animateCaptionAccent(ctx:CanvasRenderingContext2D,segment:Segment,time:number,s:CaptionSettings,draw:(layer:CanvasRenderingContext2D)=>CaptionBounds|null):CaptionBounds|null{
  const w=ctx.canvas.width,h=ctx.canvas.height;
  if(time<segment.start||time>=segment.end||!Number.isFinite(time))return null;
  const level=depth++;let slot=pool[level];
  if(!slot||slot.face.width!==w||slot.face.height!==h){slot={face:make(w,h),tint:make(w,h)};pool[level]=slot;}
  const c=slot.face.getContext('2d') as CanvasRenderingContext2D;
  c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.clearRect(0,0,w,h);c.save();
  try{
    const bounds=draw(c);if(!bounds)return null;
    const age=time-segment.start,duration=Math.min(clamp(valid(s.accentDuration,.56),.08,2),Math.max(.04,(segment.end-segment.start)*.6));
    const mode=s.accentMotion&&s.accentMotion!=='none'?s.accentMotion:undefined;
    const strength=clamp(valid(s.accentStrength,100),0,200)/100;
    const pose=mode?riotGlyphPose(age,duration,mode,strength):{x:0,y:0,rotation:0,scaleX:1,scaleY:1,trail:Math.max(0,1-age/duration)};
    const unit=Math.min(w,h)/720,cx=bounds.x*w/100,cy=bounds.y*h/100;
    const first=color(s.accentColor,'#40edff'),second=color(s.accentColor2,'#ff4fc8');
    ctx.save();ctx.translate(cx+pose.x*unit,cy+pose.y*unit);ctx.rotate(pose.rotation);ctx.scale(pose.scaleX,pose.scaleY);
    if(s.accentTrails&&pose.trail>.01){
      const tint=slot.tint.getContext('2d') as CanvasRenderingContext2D;
      const distance=clamp(valid(s.accentTrailDistance,17),0,60)*unit*pose.trail;
      for(const [side,tone] of [[-1,first],[1,second]] as const){
        tint.clearRect(0,0,w,h);tint.globalCompositeOperation='source-over';tint.drawImage(slot.face,0,0);
        tint.globalCompositeOperation='source-in';tint.fillStyle=tone;tint.fillRect(0,0,w,h);tint.globalCompositeOperation='source-over';
        ctx.save();ctx.globalAlpha*=pose.trail*.55;ctx.drawImage(slot.tint,-cx+side*distance,-cy-distance*.3);ctx.restore();
      }
    }
    ctx.drawImage(slot.face,-cx,-cy);ctx.restore();
    if(s.accentParticles){
      ctx.save();ctx.translate(cx,cy);ctx.scale(unit,unit);ctx.globalAlpha*=clamp(valid(s.textOpacity,100),0,100)/100;
      const count=clamp(valid(s.accentParticleCount,18),0,60);
      painter.drawBurst(ctx,-bounds.width*w/100/unit*.4,0,age-.04,[first,second,'#ffffff'],strength*.6,count);
      painter.drawBurst(ctx,bounds.width*w/100/unit*.4,0,age-.12,[second,first,'#ffffff'],strength*.6,count);ctx.restore();
    }
    const map=<T extends CaptionWordBounds|CaptionBounds>(box:T):T=>{
      const x=(box.x*w/100-cx)*pose.scaleX,y=(box.y*h/100-cy)*pose.scaleY;
      return {...box,x:(cx+pose.x*unit+x*Math.cos(pose.rotation)-y*Math.sin(pose.rotation))/w*100,
        y:(cy+pose.y*unit+x*Math.sin(pose.rotation)+y*Math.cos(pose.rotation))/h*100,
        width:box.width*pose.scaleX,height:box.height*pose.scaleY,rotation:box.rotation+pose.rotation*180/Math.PI};
    };
    return {...map(bounds),words:bounds.words.map(word=>map(word))};
  }finally{c.restore();depth--;if(level>=3)pool.splice(3);}
}
