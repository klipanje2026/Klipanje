export type SunlightMotion = {sunlight?:boolean;sunlightStrength?:number;sunlightSpeed?:number;sunlightDelay?:number;sunlightSide?:'left'|'right'};
const bounded=(value:number|undefined,fallback:number,min:number,max:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,value!)):fallback;
const smooth=(p:number)=>p*p*(3-2*p);
/** Continuous warm shimmer plus one broad exposure sweep, with no hard beam edges. */
export function sunlightState(options:SunlightMotion,elapsed:number){
 const t=(elapsed-bounded(options.sunlightDelay,0,0,600))*bounded(options.sunlightSpeed,1,.1,3);
 if(!options.sunlight||!Number.isFinite(t)||t<=0)return {alpha:0,flash:0,sweep:0,x:.2,y:.12};
 const strength=bounded(options.sunlightStrength,.55,0,1),phase=t*Math.PI*2/3.6;
 const pulse=Math.pow((1+Math.sin(phase-.8))/2,2);
 const sweep=t<2?.5*smooth(t/2):t<=3?.5:t<5?.5+.5*smooth((t-3)/2):1;
 const flash=t>=5?0:strength*smooth(Math.min(1,t/1.5))*smooth(Math.min(1,(5-t)/1.5));
 return {alpha:strength*(.12+.62*pulse)*Math.min(1,t/.5),flash,sweep,x:(options.sunlightSide==='right'?.82:.18)+Math.sin(phase*.47)*.07,y:.08+Math.sin(phase*.33)*.04};
}
export function drawSunlight(ctx:CanvasRenderingContext2D,options:SunlightMotion,elapsed:number,x:number,y:number,w:number,h:number){
 const light=sunlightState(options,elapsed);if(light.alpha<=0||w<=0||h<=0)return;
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 ctx.globalCompositeOperation='screen';
 const alpha=ctx.globalAlpha,span=Math.hypot(w,h);
 const cx=x+w*light.x,cy=y+h*light.y;
 const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,span*.72);
 glow.addColorStop(0,'rgba(255,242,204,1)');glow.addColorStop(.22,'rgba(255,209,130,.65)');glow.addColorStop(.65,'rgba(255,174,80,.12)');glow.addColorStop(1,'rgba(255,174,80,0)');
 ctx.globalAlpha=alpha*light.alpha;ctx.fillStyle=glow;ctx.fillRect(x,y,w,h);
 if(light.flash>0){
  // A diffuse moving pool of light, rather than a visible stripe across the image.
  const progress=options.sunlightSide==='right'?1-light.sweep:light.sweep;
  const fx=x+w*(-.6+2.2*progress),fy=y+h*(.05+.45*light.sweep);
  const flare=ctx.createRadialGradient(fx,fy,0,fx,fy,span*.95);
  flare.addColorStop(0,'rgba(255,253,239,.95)');flare.addColorStop(.3,'rgba(255,247,220,.72)');flare.addColorStop(.65,'rgba(255,233,186,.25)');flare.addColorStop(1,'rgba(255,233,186,0)');
  ctx.globalAlpha=alpha*light.flash;ctx.fillStyle=flare;ctx.fillRect(x,y,w,h);
  ctx.globalAlpha=alpha*light.flash*.2;ctx.fillStyle='#fff9e9';ctx.fillRect(x,y,w,h);
 }
 ctx.restore();
}
