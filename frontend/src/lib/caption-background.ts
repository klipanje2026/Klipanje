import type {CaptionSettings} from '../config/captions/types';
import {captionTextureFill} from './caption-texture-fill';
/** Caption surfaces only: glass is a translucent highlight, not video refraction. */
export function paintCaptionBackground(ctx:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,size:number,s:CaptionSettings,time=0){
 if(!s.backgroundOpacity||s.backgroundScope==='none')return;
 const clamp=(n:number,max=100)=>Math.max(0,Math.min(max,n));
 const px=size*clamp(s.backgroundPaddingX??18,80)/100,py=size*clamp(s.backgroundPaddingY??10,60)/100;
 x-=px;y-=py;width+=px*2;height+=py*2;
 const radius=Math.min(width/2,height/2,size*clamp(s.backgroundRadius??18)/100),look=s.backgroundLook??'solid';
 const path=(dx=0,dy=0)=>{ctx.beginPath();if(look==='marker'){
  const reach=size*.1;ctx.moveTo(x+dx-reach,y+dy);for(let i=1;i<=24;i++)ctx.lineTo(x+dx+width*i/24,y+dy+Math.sin(i*2.7)*size*.018);
  ctx.lineTo(x+dx+width+reach,y+dy+height);for(let i=24;i>=0;i--)ctx.lineTo(x+dx+width*i/24,y+dy+height+Math.sin(i*3.3)*size*.018);ctx.closePath();
 }else if(look==='sketch'){
  ctx.moveTo(x+dx+size*.08,y+dy);ctx.lineTo(x+dx+width+size*.05,y+dy+size*.025);ctx.lineTo(x+dx+width-size*.1,y+dy+height);ctx.lineTo(x+dx-size*.05,y+dy+height-size*.04);ctx.closePath();
 }else if(look==='paperCut'){
  ctx.moveTo(x+dx,y+dy);for(let i=1;i<=12;i++)ctx.lineTo(x+dx+width*i/12,y+dy+(i%2?size*.045:0));ctx.lineTo(x+dx+width,y+dy+height);for(let i=11;i>=0;i--)ctx.lineTo(x+dx+width*i/12,y+dy+height-(i%2?size*.045:0));ctx.closePath();
 }else if(s.backgroundBorderWave){
  const amplitude=size*Math.max(0,Math.min(20,s.backgroundBorderWave))/100;
  for(let i=0;i<=48;i++){const t=i/48,a=t*Math.PI*2,cx=x+dx+width/2,cy=y+dy+height/2,r=1+Math.sin(a*12)*amplitude/Math.max(1,Math.min(width,height)/2),xx=cx+Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.35)*width/2*r,yy=cy+Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.35)*height/2*r;if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);}ctx.closePath();
 }else ctx.roundRect(x+dx,y+dy,width,height,radius);};
 ctx.save();ctx.globalAlpha*=clamp(s.backgroundOpacity)/100;
 const depth=size*clamp(s.backgroundDepth??(look==='raised'?12:0),40)/100;
 if(depth){ctx.fillStyle=s.backgroundDepthColor??'#18242c';for(let i=Math.ceil(depth);i>0;i--){path(i*.7,i);ctx.fill();}}
 path();
 if(s.backgroundShadow){ctx.save();ctx.shadowColor=`rgba(0,0,0,${clamp(s.backgroundShadow)/100})`;ctx.shadowBlur=size*clamp(s.backgroundShadowBlur??25)/100;ctx.shadowOffsetY=size*.1;ctx.fillStyle=s.backgroundColor;if(look==='outline'){ctx.strokeStyle=s.backgroundBorderColor??s.backgroundColor;ctx.lineWidth=size*(s.backgroundBorderWidth??3)/100;ctx.stroke();}else{if(look==='glass')ctx.globalAlpha*=.25;ctx.fill();}ctx.restore();}
 if(s.backgroundGlow){ctx.save();ctx.shadowColor=s.backgroundGlowColor??s.backgroundColor2??s.highlightColor;ctx.shadowBlur=size*clamp(s.backgroundGlow)/100;ctx.fillStyle=ctx.shadowColor;ctx.globalAlpha*=look==='glass'?.15:.65;if(look==='outline'){ctx.strokeStyle=ctx.shadowColor;ctx.lineWidth=size*(s.backgroundBorderWidth??3)/100;ctx.stroke();}else ctx.fill();ctx.restore();}
 let fill:string|CanvasGradient=s.backgroundColor;
 if(look==='gradient'||look==='glass'||look==='raised'){
  const a=(s.backgroundAngle??90)*Math.PI/180,r=Math.max(width,height)/2,cx=x+width/2,cy=y+height/2;
  const gradient=ctx.createLinearGradient(cx-Math.cos(a)*r,cy-Math.sin(a)*r,cx+Math.cos(a)*r,cy+Math.sin(a)*r);
  gradient.addColorStop(0,s.backgroundColor);gradient.addColorStop(1,s.backgroundColor2??'#ffffff');fill=gradient;
 }
 if(look!=='outline'){ctx.save();if(look==='glass')ctx.globalAlpha*=.5;ctx.fillStyle=fill;ctx.fill();ctx.restore();}
 if(s.backgroundTexture&&s.backgroundTexture!=='none'&&look!=='outline'){
  ctx.save();ctx.clip();ctx.globalAlpha*=clamp(s.backgroundTextureAmount??70)/100;
  const texture=captionTextureFill(ctx,'Background',x,y+height,size,{...s,fillTexture:s.backgroundTexture,fillTextureColor:s.backgroundColor,fillTextureColor2:s.backgroundColor2,fillTextureScale:s.backgroundTextureScale},time);
  if(texture){ctx.fillStyle=texture;ctx.fillRect(x-size,y-size,width+size*2,height+size*2);}ctx.restore();
 }
 const border=size*clamp(s.backgroundBorderWidth??(look==='outline'?3:look==='glass'?1:0),12)/100;
 if(border){path();ctx.strokeStyle=s.backgroundBorderColor??s.backgroundColor2??'#ffffff';ctx.lineWidth=border;ctx.stroke();if(s.backgroundBorderStyle==='double'){ctx.save();ctx.translate(x+width/2,y+height/2);ctx.scale(Math.max(.1,1-size*.12/width),Math.max(.1,1-size*.12/height));ctx.translate(-x-width/2,-y-height/2);path();ctx.stroke();ctx.restore();}if(s.backgroundBorderStyle==='triple'){for(const shift of [-1,1]){path(size*.09*shift,size*.07*shift);ctx.stroke();}}}
 if(look==='glass'||look==='raised'){ctx.save();path();ctx.clip();const shine=ctx.createLinearGradient(0,y,0,y+height);shine.addColorStop(0,'#ffffff77');shine.addColorStop(.4,'#ffffff00');shine.addColorStop(1,'#00000022');ctx.fillStyle=shine;ctx.fillRect(x,y,width,height);ctx.restore();}
 ctx.restore();
}
