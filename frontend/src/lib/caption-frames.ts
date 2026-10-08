import type {CaptionSettings,Segment} from '../config/captions/types';
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
function tint(color:string,toward:string,amount:number){const a=color.match(/^#([\da-f]{6})$/i)?.[1]??'ffffff',b=toward.match(/^#([\da-f]{6})$/i)?.[1]??'ffffff';return '#'+[0,2,4].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-amount)+parseInt(b.slice(i,i+2),16)*amount).toString(16).padStart(2,'0')).join('');}
/** The original Borders frame renderer, shared with the optional frame controls. */
export function drawCaptionFrames(ctx:CanvasRenderingContext2D,segment:Segment,time:number,settings:CaptionSettings){
    const {width:w,height:h}=ctx.canvas;
    const start=segment.frameAnimationStart??segment.start,end=segment.frameAnimationEnd??segment.end,age=Math.max(0,time-start);
    const idle=settings.effectIdle||'float',phase=Math.max(0,age-.85),settle=clamp(phase/.4,0,1);
    for(let i=Math.max(1,Math.min(3,settings.frameCount??3))-1;i>=0;i--){
      const entrance=clamp((age-i*.09)/.65,0,1),out=clamp((end-time-i*.035)/.65,0,1),p=Math.min(entrance,out),ease=1-Math.pow(1-p,3);
      ctx.save();ctx.globalAlpha=p*(i===0?1:.22);ctx.translate(w/2,h/2+(1-ease)*h*.55);
      const rotation=i===0?(1-ease)*.1:(-60-(i-1)*10)*Math.PI/180*(1-clamp((p-.5)*2,0,1));
      const sway=['float','tilt'].includes(idle)?Math.sin(phase*1.1)*.018*settle*p:0;
      ctx.rotate(rotation+sway);
      const breathe=['float','zoom'].includes(idle)?Math.sin(phase*1.1)*.012*settle*p:0;ctx.scale(1+breathe,1+breathe);
      const shimmer=['shimmer','float','gradient'].includes(idle)?(.5+.5*Math.sin(phase*1.7+i*.6))*.22*settle:0;
      const borderColor=tint((settings.frameColor??settings.highlightColor),idle==='gradient'?(settings.effectIdleColor||'#ad79ff'):'#ffffff',shimmer);
      const gradient=ctx.createLinearGradient(-w/2,-h/2,w/2,h/2);gradient.addColorStop(0,borderColor);gradient.addColorStop(.5,tint((settings.frameColor??settings.highlightColor),settings.effectIdleColor||'#ad79ff',(.35+.25*Math.sin(phase))*settle));gradient.addColorStop(1,(settings.frameColor??settings.highlightColor));
      ctx.strokeStyle=idle==='gradient'?gradient:borderColor;ctx.shadowColor=borderColor;ctx.shadowBlur=w*(.014+shimmer*.025);ctx.lineWidth=Math.max(1,w*(settings.frameWidth??.3)/100);
      const inset=i===0?0:1,extra=(settings.frameInset??0)/100,fw=w*(.88-inset*.08-extra*2),fh=h*(.84-inset*.05-extra*2);
      if(settings.frameWave){ctx.beginPath();const wave=w*Math.min(10,settings.frameWave)/100;for(let j=0;j<=96;j++){const a=j/96*Math.PI*2,r=1+Math.sin(a*12)*wave/Math.max(1,Math.min(fw,fh)),x=Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.25)*fw/2*r,y=Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.25)*fh/2*r;if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.stroke();}else ctx.strokeRect(-fw/2,-fh/2,fw,fh);ctx.restore();
    }
}
