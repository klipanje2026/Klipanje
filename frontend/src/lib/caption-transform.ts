import type {CaptionSettings} from '../config/captions/types';
import type {CaptionBounds} from './caption-renderer';
const fields=['displayScale','displaySkew','displayWarp','displayBend','displayArc','displayDistort','displayPerspective','displayStretch','displayCompress'] as const;
export function hasCaptionTransform(s:CaptionSettings){return fields.some(k=>(s[k]??(k==='displayScale'||k==='displayStretch'||k==='displayCompress'?100:0))!==(k==='displayScale'||k==='displayStretch'||k==='displayCompress'?100:0));}
type Point={x:number;y:number};
/** Tessellate the rendered caption only, preserving the preset's own drawing and motion. */
export function transformCaption(ctx:CanvasRenderingContext2D,s:CaptionSettings,draw:(ctx:CanvasRenderingContext2D)=>CaptionBounds|null):CaptionBounds|null{
 const w=ctx.canvas.width,h=ctx.canvas.height;
 const layer=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
 const c=layer.getContext('2d') as CanvasRenderingContext2D;c.fontKerning=s.kerning??'auto';
 const bounds=draw(c);if(!bounds)return null;
 const cx=bounds.x*w/100,cy=bounds.y*h/100,bw=Math.max(1,bounds.width*w/100),bh=Math.max(1,bounds.height*h/100);
 const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
 const scale=clamp(s.displayScale??100,25,250)/100,sx=scale*clamp(s.displayStretch??100,100,250)/100*clamp(s.displayCompress??100,25,100)/100;
 const map=({x,y}:Point):Point=>{
  const u=(x-cx)/bw,v=(y-cy)/bh;
  const arc=clamp(s.displayArc??0,-100,100)/100,angle=u*arc*1.4;
  let dx=x-cx,dy=y-cy;
  if(Math.abs(arc)>.001){const radius=bw/(arc*1.4);dx=Math.sin(angle)*(radius+dy);dy=Math.cos(angle)*(radius+dy)-radius;}
  dx+=Math.tan(clamp(s.displaySkew??0,-45,45)*Math.PI/180)*dy;
  dx*=1+v*clamp(s.displayPerspective??0,-80,80)/100;
  dx+=Math.sin(v*Math.PI*2)*bw*.08*(s.displayDistort??0)/100;
  dy+=Math.sin(u*Math.PI*2)*bh*.5*(s.displayWarp??0)/100+u*u*bh*2*(s.displayBend??0)/100;
  return {x:cx+dx*sx,y:cy+dy*scale};
 };
 function triangle(a:Point,b:Point,d:Point){
  const p=map(a),q=map(b),r=map(d),det=(b.x-a.x)*(d.y-a.y)-(d.x-a.x)*(b.y-a.y);if(!det)return;
  const A=((q.x-p.x)*(d.y-a.y)-(r.x-p.x)*(b.y-a.y))/det,B=((q.y-p.y)*(d.y-a.y)-(r.y-p.y)*(b.y-a.y))/det;
  const C=((r.x-p.x)*(b.x-a.x)-(q.x-p.x)*(d.x-a.x))/det,D=((r.y-p.y)*(b.x-a.x)-(q.y-p.y)*(d.x-a.x))/det;
  ctx.save();ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.lineTo(r.x,r.y);ctx.closePath();ctx.clip();ctx.transform(A,B,C,D,p.x-A*a.x-C*a.y,p.y-B*a.x-D*a.y);ctx.drawImage(layer,0,0);ctx.restore();
 }
 // Include the complete layer, including preset decorations and extended shadows.
 if(!s.displayWarp&&!s.displayBend&&!s.displayArc&&!s.displayDistort&&!s.displayPerspective){
  ctx.save();ctx.translate(cx,cy);ctx.transform(sx,0,Math.tan(clamp(s.displaySkew??0,-45,45)*Math.PI/180)*sx,scale,0,0);ctx.drawImage(layer,-cx,-cy);ctx.restore();
 }else{
  const cols=32,rows=12;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a={x:i*w/cols,y:j*h/rows},b={x:(i+1)*w/cols,y:j*h/rows},d={x:i*w/cols,y:(j+1)*h/rows},e={x:b.x,y:d.y};triangle(a,b,d);triangle(b,e,d);}
 }
 function box<T extends {x:number;y:number;width:number;height:number;rotation:number}>(b:T):T{
  const points=Array.from({length:17},(_,i)=>i/16).flatMap(t=>[{x:(b.x-b.width/2+b.width*t)*w/100,y:(b.y-b.height/2)*h/100},{x:(b.x-b.width/2+b.width*t)*w/100,y:(b.y+b.height/2)*h/100}]).map(map);
  const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));
  return {...b,x:(left+right)/2/w*100,y:(top+bottom)/2/h*100,width:(right-left)/w*100,height:(bottom-top)/h*100};
 }
 return {...box(bounds),words:bounds.words.map(box)};
}

export const captionSpecialEffects=[['glitch','Glitch'],['distortion','Distortion'],['melt','Melt'],['liquid','Liquid'],['ink','Ink'],['paint','Paint'],['spray','Spray Paint'],['graffiti','Graffiti'],['explosion','Explosion'],['lightning','Lightning'],['plasma','Plasma'],['energy','Energy']] as const;
/** Deterministic media-time animation of the caption layer, shared by cards, editors and export. */
export function animateCaptionEffect(ctx:CanvasRenderingContext2D,s:CaptionSettings,time:number,draw:(ctx:CanvasRenderingContext2D)=>CaptionBounds|null):CaptionBounds|null{
 const mode=s.specialEffect;if(!mode||mode==='none'||s.specialEffectStrength===0)return draw(ctx);
 const w=ctx.canvas.width,h=ctx.canvas.height,layer=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
 const c=layer.getContext('2d') as CanvasRenderingContext2D,bounds=draw(c);if(!bounds)return null;
 const amount=Math.max(0,Math.min(100,s.specialEffectStrength??50))/100,t=Math.max(0,time)*Math.max(.2,Math.min(3,s.specialEffectSpeed??1));
 const bw=Math.max(1,bounds.width*w/100),bh=Math.max(1,bounds.height*h/100),cx=bounds.x*w/100,cy=bounds.y*h/100;
 const pad=Math.max(8,bh*.5),left=Math.max(0,cx-bw/2-pad),top=Math.max(0,cy-bh/2-pad),right=Math.min(w,cx+bw/2+pad),bottom=Math.min(h,cy+bh/2+pad),rw=right-left,rh=bottom-top;
 if(rw<=0||rh<=0){ctx.drawImage(layer,0,0);return bounds;}
 const color=s.specialEffectColor||s.highlightColor,amplitude=bh*.18*amount,phase=t*Math.PI*2;
 const hash=(n:number)=>{const v=Math.sin(n*127.1+43.7)*43758.5453;return v-Math.floor(v);};
 const tint=(shade:string)=>{const out=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});const ink=out.getContext('2d') as CanvasRenderingContext2D;ink.drawImage(layer,0,0);ink.globalCompositeOperation='source-in';ink.fillStyle=shade;ink.fillRect(0,0,w,h);return out;};
 ctx.save();
 if(mode==='glitch'){
  ctx.globalAlpha*=.45*amount;ctx.drawImage(tint('#ff386e'),amplitude*Math.sin(phase*3),0);ctx.drawImage(tint('#38eeff'),-amplitude*Math.sin(phase*3),0);ctx.restore();ctx.save();
  const strips=18;for(let i=0;i<strips;i++){const y=top+rh*i/strips,sh=rh/strips,shift=hash(i+Math.floor(t*12)*37)>.76?(hash(i*3+Math.floor(t*12))*2-1)*amplitude*2:0;ctx.drawImage(layer,left,y,rw,sh,left+shift,y,rw,sh);}
 }else if(mode==='distortion'||mode==='liquid'){
  const strips=48;for(let i=0;i<strips;i++){const y=top+rh*i/strips,sh=rh/strips;const shift=mode==='distortion'?Math.sin(i*.65+phase*2)*amplitude:Math.sin(i*.15+phase)*amplitude*.6+Math.cos(i*.33-phase*.7)*amplitude*.35;ctx.drawImage(layer,left,y,rw,sh,left+shift,y,rw,sh+.5);}
 }else if(mode==='melt'){
  const cols=56;for(let i=0;i<cols;i++){const x=left+rw*i/cols,sw=rw/cols,drip=Math.pow(Math.max(0,Math.sin(i*.53+phase*.3)),6)*amplitude*3;ctx.drawImage(layer,x,top,sw,rh,x,top,sw+.5,rh+drip);}
 }else if(mode==='explosion'){
  const spread=(.5-.5*Math.cos(phase*.5))*amount,cols=10,rows=5;for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const x=left+rw*i/cols,y=top+rh*j/rows,sw=rw/cols,sh=rh/rows;ctx.save();ctx.globalAlpha*=1-spread*.45;ctx.translate(x+sw/2+(x+sw/2-cx)*spread*.45,y+sh/2+(y+sh/2-cy)*spread*.9);ctx.rotate((hash(i+j*cols)-.5)*spread*.55);ctx.drawImage(layer,x,y,sw,sh,-sw/2,-sh/2,sw,sh);ctx.restore();}
 }else if(mode==='ink'||mode==='paint'){
  ctx.drawImage(layer,0,0);ctx.save();ctx.globalAlpha*=Math.min(1,amount*1.5);const colored=tint(color);ctx.beginPath();
  if(mode==='ink'){
   // A connected pool expands from the centre, then fades before restarting.
   const cycle=(t/3.6)%1,growth=1-Math.pow(1-Math.min(1,cycle/.82),2),fade=cycle>.82?(1-cycle)/.18:1;
   ctx.globalAlpha*=fade;
   for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,lobe=1+.1*Math.sin(a*5)+.07*Math.sin(a*9+.7)+.04*Math.cos(a*13),x=cx+Math.cos(a)*bw*.68*growth*lobe,y=cy+Math.sin(a)*bh*.8*growth*lobe;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}
   ctx.closePath();
  }
  else {for(let i=0;i<5;i++){const y=top+rh*i/5;ctx.rect(left+Math.sin(phase+i)*rw*.12,y,rw*(.65+.2*Math.sin(phase*.5+i)),rh/7);}}
  ctx.clip();ctx.drawImage(colored,0,0);ctx.restore();
 }else if(mode==='spray'||mode==='graffiti'){
  if(mode==='graffiti'){ctx.shadowColor=color;ctx.shadowBlur=bh*.06*amount;ctx.drawImage(tint(color),amplitude*.3,amplitude*.4);ctx.shadowBlur=0;}
  ctx.drawImage(layer,0,0);ctx.fillStyle=color;ctx.globalAlpha*=amount*.7;
  // Sample the glyph mask: paint particles originate on the text, never the video.
  const mask=c.getImageData(Math.floor(left),Math.floor(top),Math.max(1,Math.ceil(rw)),Math.max(1,Math.ceil(rh)));
  for(let i=0;i<160;i++){const x=Math.floor(hash(i+1)*mask.width),y=Math.floor(hash(i+91)*mask.height);if(mask.data[(y*mask.width+x)*4+3]<30)continue;const drift=(t*.4+hash(i+9))%1;ctx.beginPath();ctx.arc(left+x+(hash(i+8)-.5)*amplitude*drift,top+y+drift*amplitude*(mode==='graffiti'?3:1),Math.max(.6,bh*.012*hash(i+7)),0,Math.PI*2);ctx.fill();}
 }else {
  const pulse=.45+.55*(.5+.5*Math.sin(phase));ctx.shadowColor=color;ctx.shadowBlur=bh*(mode==='plasma'?.2:.1)*amount*pulse;ctx.drawImage(tint(color),0,0);ctx.shadowBlur=0;ctx.drawImage(layer,0,0);
  ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,bh*.018*amount);ctx.globalAlpha*=amount;
  if(mode==='lightning'){
   const flicker=Math.floor(t*7),visible=hash(flicker)> .25;ctx.globalAlpha*=visible?.8:.12;ctx.shadowColor=color;ctx.shadowBlur=bh*.07;
   for(let branch=0;branch<3;branch++){const originX=cx+(hash(branch+flicker*3)-.5)*bw*.8,originY=cy-bh*.45;ctx.beginPath();ctx.moveTo(originX,originY);for(let step=1;step<7;step++)ctx.lineTo(originX+(hash(step+branch*31+flicker*7)-.5)*bh*.22,originY+step/7*bh*.7);ctx.stroke();ctx.beginPath();ctx.moveTo(originX,originY+bh*.25);ctx.lineTo(originX+bh*.1,originY+bh*.35);ctx.lineTo(originX+bh*.23,originY+bh*.31);ctx.stroke();}ctx.shadowBlur=0;
  }
  else if(mode==='plasma'){for(let j=0;j<2;j++){ctx.beginPath();for(let i=0;i<=40;i++){const x=left+rw*i/40,y=cy+Math.sin(i*.22+phase+j*Math.PI)*bh*.3;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.stroke();}}
  else {for(let i=0;i<16;i++){const a=i/16*Math.PI*2+phase*.25,r=1+Math.sin(phase+i)*.12;const x=cx+Math.cos(a)*bw*.6*r,y=cy+Math.sin(a)*bh*.65*r;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x-Math.sin(a)*amplitude,y+Math.cos(a)*amplitude,x+Math.cos(a)*amplitude*.4,y+Math.sin(a)*amplitude*.4);ctx.stroke();}}
 }
 ctx.restore();
 const grow=mode==='explosion'?amount*.5:mode==='melt'?amount*.4:amount*.15;
 return {...bounds,width:bounds.width*(1+grow),height:bounds.height*(1+grow),words:bounds.words};
}

export const depthMaterials=[['plastic','Plastic'],['glossyPlastic','Glossy Plastic'],['mattePlastic','Matte Plastic'],['rubber','Rubber'],['ceramic','Ceramic'],['glass','Glass 3D'],['metal','Metal 3D'],['gold','Gold 3D'],['chrome','Chrome 3D']] as const;
export const depthEffects=[['extrude','Extrude'],['bevel','Bevel'],['emboss','Emboss'],['isometric','Isometric Text'],['perspective','Perspective Text'],['floating','Floating Text'],['metallic','Metallic 3D'],['glass','Glass 3D']] as const;
/** Defaults follow the material; explicit colors never overwrite the base text settings. */
export function captionDepthPalette(s:CaptionSettings){
 const material=s.depthMode==='glass'?'glass':s.depthMode==='metallic'?'metal':s.depthMaterial||'plastic';
 const colors:Record<string,[string,string,string]>={plastic:[s.textColor,'#253441','#ffffff'],glossyPlastic:[s.textColor,'#273747','#ffffff'],mattePlastic:[s.textColor,'#38434d','#e4e9ef'],rubber:['#272c32','#14191e','#a1abb6'],ceramic:['#e9e4da','#898477','#ffffff'],glass:['#78aec8','#35687d','#efffff'],metal:['#65798c','#233443','#f4fbff'],gold:['#c69b38','#705022','#fff0a0'],chrome:['#61778e','#172d46','#ffffff']};
 const [base,side,light]=colors[material]||colors.plastic;
 return {material,base:s.depthFaceColor||base,side:s.depthSideColor||side,light:s.depthLightColor||light};
}
/** Simulated caption-space lighting and extrusion, shared by preview and export. */
export function renderCaptionDepth(ctx:CanvasRenderingContext2D,s:CaptionSettings,time:number,draw:(ctx:CanvasRenderingContext2D)=>CaptionBounds|null):CaptionBounds|null{
 if(!s.depthMode||s.depthMode==='none')return draw(ctx);
 const clamp=(v:number,min=0,max=100)=>Math.max(min,Math.min(max,v));
 const w=ctx.canvas.width,h=ctx.canvas.height,make=()=>typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
 const layer=make(),face=layer.getContext('2d') as CanvasRenderingContext2D,bounds=draw(face);if(!bounds)return null;
 const bh=Math.max(1,bounds.height*h/100),cx=bounds.x*w/100,cy=bounds.y*h/100,mode=s.depthMode;
 const {material,base,side,light}=captionDepthPalette(s);
 const depth=bh*clamp(s.depthSize??12,0,40)/100,angle=(s.depthAngle??135)*Math.PI/180,dx=Math.cos(angle)*depth,dy=Math.sin(angle)*depth;
 const lightAngle=(s.depthLightAngle??-45)*Math.PI/180,lx=Math.cos(lightAngle),ly=Math.sin(lightAngle),illumination=clamp(s.depthLightStrength??85,0,150)/100;
 const reflection=clamp(s.depthReflection??65)/100,roughness=clamp(s.depthRoughness??25)/100;
 const tint=(paint:string|CanvasGradient)=>{const out=make(),c=out.getContext('2d') as CanvasRenderingContext2D;c.drawImage(layer,0,0);c.globalCompositeOperation='source-in';c.fillStyle=paint;c.fillRect(0,0,w,h);return out;};
 const result=make(),r=result.getContext('2d') as CanvasRenderingContext2D;
 // Cast shadow is independent of the solid extrusion and its color.
 const shadow=clamp(s.depthShadow??25)/100;
 if(shadow){r.save();r.globalAlpha=shadow;r.filter=`blur(${bh*clamp(s.depthShadowSoftness??40)/100*.12}px)`;r.drawImage(tint('#000000'),dx-lx*bh*.18,dy-ly*bh*.18);r.restore();}
 const sideGradient=r.createLinearGradient(cx-lx*bh,cy-ly*bh,cx+lx*bh,cy+ly*bh);sideGradient.addColorStop(0,'#080d16');sideGradient.addColorStop(.5,side);sideGradient.addColorStop(1,light);
 const wall=tint(sideGradient),steps=Math.min(48,Math.ceil(depth));
 if(mode!=='emboss')for(let i=steps;i>=1;i--)r.drawImage(wall,dx*i/steps,dy*i/steps);
 // Material face remains separate from extrusion. Glass lets the video show through.
 r.save();if(material==='glass')r.globalAlpha=.56;r.drawImage(tint(base),0,0);r.restore();
 const gradient=r.createLinearGradient(cx-lx*bh*.65,cy-ly*bh*.65,cx+lx*bh*.65,cy+ly*bh*.65);
 const shiny=['gold','metal','chrome','glass','glossyPlastic','ceramic'].includes(material);
 gradient.addColorStop(0,side);gradient.addColorStop(.3,base);gradient.addColorStop(shiny?.46:.78,light);gradient.addColorStop(shiny?.54:.9,base);gradient.addColorStop(1,light);
 r.save();r.globalAlpha=Math.min(1,illumination*(shiny?.85:.42));r.drawImage(tint(gradient),0,0);r.restore();
 // A clipped specular band gets broader and softer with surface roughness.
 if(reflection&&illumination){
  const spec=r.createLinearGradient(cx-lx*bh*.65,cy-ly*bh*.65,cx+lx*bh*.65,cy+ly*bh*.65),spread=.035+roughness*.18;
  spec.addColorStop(0,'transparent');spec.addColorStop(.58-spread,'transparent');spec.addColorStop(.58,light);spec.addColorStop(.58+spread,'transparent');spec.addColorStop(1,'transparent');
  r.save();r.globalAlpha=Math.min(1,reflection*illumination*(1-roughness*.7)*(shiny?1:.3));r.drawImage(tint(spec),0,0);r.restore();
 }
 // Paired edge masks provide a bevel that is visible on both light and dark faces.
 const bevel=bh*clamp(s.surfaceBevel??35)/100*(mode==='bevel'?.14:.085);
 if(bevel>0){for(const sign of [-1,1]){
  const edge=tint(sign===1?light:side),e=edge.getContext('2d') as CanvasRenderingContext2D;
  e.globalCompositeOperation='destination-out';e.drawImage(layer,-lx*bevel*sign,-ly*bevel*sign);
  r.save();r.globalAlpha=Math.min(1,sign===1?illumination:.9);r.drawImage(edge,0,0);r.restore();
 }}
 if(mode==='emboss'&&depth>0){for(const sign of [-1,1]){const edge=tint(sign===1?light:side),e=edge.getContext('2d') as CanvasRenderingContext2D;e.globalCompositeOperation='destination-out';e.drawImage(layer,-lx*depth*.35*sign,-ly*depth*.35*sign);r.save();r.globalAlpha=.85;r.drawImage(edge,0,0);r.restore();}}
 // Deterministic grain is clipped to the glyphs and stable when seeking/exporting.
 if(roughness>0){const grain=make(),g=grain.getContext('2d') as CanvasRenderingContext2D;g.drawImage(layer,0,0);g.globalCompositeOperation='source-in';g.fillStyle=base;g.fillRect(0,0,w,h);g.globalCompositeOperation='source-atop';const pixel=Math.max(1,bh*.008);for(let i=0;i<700;i++){const x=cx+(Math.sin(i*127.1)*43758.5453%1)*bounds.width*w/200,y=cy+(Math.sin(i*311.7)*9758.5453%1)*bh*.6;g.fillStyle=i%2?light:side;g.fillRect(x,y,pixel,pixel);}r.save();r.globalAlpha=roughness*.16;r.drawImage(grain,0,0);r.restore();}
 const motion=clamp(s.depthMotion??0)/100,rx=((s.depthTiltX??0)+Math.sin(time*1.3)*motion*7)*Math.PI/180,ry=((s.depthTiltY??0)+Math.cos(time*1.1)*motion*9)*Math.PI/180;
 ctx.save();ctx.translate(cx,cy);
 if(mode==='isometric')ctx.transform(1,.24,-.35,.85,0,0);
 if(mode==='perspective')ctx.transform(.9,-.15,.2,1,0,0);
 ctx.transform(Math.cos(ry),Math.sin(ry)*.22,-Math.sin(rx)*.3,Math.cos(rx),0,0);
 if(mode==='floating'||motion)ctx.translate(Math.sin(time*1.1)*bh*motion*.04,Math.sin(time*2)*bh*(mode==='floating'?.09:motion*.04));
 ctx.translate(-cx,-cy);const focus=clamp(s.depthFocus??0,0,10);if(focus)ctx.filter=`blur(${bh*focus/100}px)`;ctx.drawImage(result,0,0);ctx.restore();
 return {...bounds,width:bounds.width+Math.abs(dx)/w*100,height:bounds.height+Math.abs(dy)/h*100};
}
