import {drawTextSurface,drawTextShine,drawBorderMist} from './text-surface';
import type {CaptionSettings,Segment,StyleKey} from '../config/captions/presets';
export const illustratedHeaders:StyleKey[]=['sketchNote','vistaRise','popCollage'];
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
function star(c:CanvasRenderingContext2D,x:number,y:number,r:number,points=5){c.beginPath();for(let i=0;i<points*2;i++){const a=i*Math.PI/points-Math.PI/2,d=i%2?r*.42:r;c.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d);}c.closePath();c.fill();c.stroke();}

// Deliberately uneven sticker clusters, keeping the speaker's face clear.
const popStickers:[number,number,number,string,string,number][]=[
 [.04,.25,.058,'star','#efb5d5',-.2],[.95,.32,.082,'flower','#efb5d5',.1],[.01,.46,.085,'flower','#efb5d5',-.2],
 [.95,.55,.1,'bolt','#ffdf28',.25],[.14,.63,.06,'star','#ffe433',-.2],[.13,.7,.03,'star','#ffe433',.2],
 [.3,.78,.07,'arrow','#19b18a',.5],[.84,.8,.08,'burst','#ef5147',-.15],[.52,.84,.049,'flower','#c691be',.2],
 [.18,.93,.052,'flower','#b889b2',.5],[.59,.96,.072,'bolt','#efb5d5',.8],[.76,.28,.024,'dot','#ef5147',0],
 [.09,.77,.024,'dot','#ef5147',0],[.88,.17,.016,'dot','#25b495',0],[.97,.68,.017,'dot','#eee1d6',0],
 [.84,.94,.018,'dot','#d7d0ba',0],[.77,.37,.024,'dot','#3c71c9',0],[.46,.025,.037,'dot','#ffdf28',0],
 [.13,.04,.015,'dot','#3c71c9',0],[.72,.12,.04,'dash','#2ab692',-.7],[.38,.93,.036,'dash','#3c71c9',1.1]];
function sticker(c:CanvasRenderingContext2D,kind:string,r:number){
 if(kind==='star'||kind==='burst'){star(c,0,0,r,kind==='star'?4:10);return;}
 c.beginPath();
 if(kind==='flower'){for(let j=0;j<=128;j++){const a=j/128*Math.PI*2,d=r*(.72+.28*Math.cos(a*8));c.lineTo(Math.cos(a)*d,Math.sin(a)*d);}}
 else if(kind==='dot')c.arc(0,0,r,0,Math.PI*2);
 else if(kind==='dash')c.roundRect(-r*.3,-r,r*.6,r*2,r*.3);
 else {const points=kind==='arrow'?[[-.35,1],[.35,1],[.35,0],[.8,0],[0,-1],[-.8,0],[-.35,0]]:[[.35,-1],[-.8,.25],[-.15,.15],[-.4,1],[.85,-.3],[.15,-.2]];for(const [x,y] of points)c.lineTo(x*r,y*r);}
 c.closePath();c.fill();c.stroke();
}

export function drawIllustratedFrame(c:CanvasRenderingContext2D,s:Segment,t:number,style:StyleKey,settings:CaptionSettings){
 const w=c.canvas.width,h=c.canvas.height,age=Math.max(0,t-(s.frameAnimationStart??s.start)),duration=Math.max(.1,(s.frameAnimationEnd??s.end)-(s.frameAnimationStart??s.start)),p=clamp(age/duration);
 c.save();
 if(style==='lensFrame'){
  // Only the outer matte leaves. The viewfinder stays fixed for the whole run.
  if(age<.36){const zoom=1+1.1*clamp(age/.3);c.save();c.translate(w/2,h/2);c.scale(zoom,zoom);c.translate(-w/2,-h/2);c.fillStyle=settings.backgroundColor;c.beginPath();c.rect(-w,-h,w*3,h*3);c.roundRect(w*.12,h*.095,w*.76,h*.81,w*.045);c.fill('evenodd');c.restore();}
  c.strokeStyle=settings.highlightColor;c.lineWidth=w*.004;c.lineCap='round';const breath=Math.sin(age*1.7)*w*.003*(settings.lensMotion??60)/100;const inset=w*.075+breath,r=w*.025,len=w*.12;
  for(const [x,y,sx,sy] of [[inset,h*.055,1,1],[w-inset,h*.055,-1,1],[inset,h*.945,1,-1],[w-inset,h*.945,-1,-1]]){c.beginPath();c.moveTo(x+sx*len,y);c.lineTo(x+sx*r,y);c.quadraticCurveTo(x,y,x,y+sy*r);c.lineTo(x,y+sy*len);c.stroke();}
  const shot=age%Math.max(1,settings.lensShotInterval??4.5);if(age>=Math.max(1,settings.lensShotInterval??4.5)&&shot<.11){c.globalAlpha=(1-shot/.11)*.45;c.fillStyle='#ffffff';c.fillRect(0,0,w,h);}
 }else if(style==='vistaRise'){
  const facets=clamp((age-1.25)/.45);
  const heights=[.18,.21,.12,.35,.3,.24,.2,.32],riseTime=Math.min(2.2,duration*.65),fall=1-clamp((p-.82)/.18);
  for(let i=0;i<heights.length;i++){
    const target=h*heights[i],speed=.7+heights[i]/.35*.3,q=clamp(age/(riseTime*speed));
    const rise=q<.22?q/.22*.5:q<.55?.5+(q-.22)/.33*.3:.8+(q-.55)/.45*.2;
    c.fillStyle=settings.highlightColor;c.globalAlpha=.14*(1-facets);c.fillRect(i*w/8,h-target,w/8+1,target);
    c.globalAlpha=(.52+(i%3)*.13)*(1-facets);const bh=target*rise*fall;c.fillRect(i*w/8,h-bh,w/8+1,bh);
  }
  if(facets>0){const cell=w/5;for(let row=0;row<4;row++)for(let col=0;col<5;col++){const x=col*cell,y=h-(4-row)*cell;c.globalAlpha=facets*(.08+.16*((row+col)%3)/2);c.fillStyle=settings.highlightColor;c.beginPath();c.moveTo(x,y);c.lineTo(x+cell,y+cell);c.lineTo(x,y+cell);c.closePath();c.fill();}}
 }else if(style==='popCollage'){
  const cycle=age%5.2,arch=cycle>=2.6,local=cycle%2.6;
  const enter=clamp(local/.25),exit=1-clamp((local-2.25)/.25),presence=Math.min(enter,exit);
  const x=w*(arch?.1:.035),y=h*(arch?.3:.025),bottom=h*(arch?.08:.025),r=w*(arch?.4:.055);
  const shape=()=>{c.beginPath();c.roundRect(x,y,w-2*x,h-y-bottom,[r,r,w*.055,w*.055]);};
  c.strokeStyle='#18151e';c.lineWidth=w*.006;
  for(let layer=3;layer>=0;layer--){const q=Math.min(clamp((local-layer*.025)/.22),exit),ease=1-Math.pow(1-q,3);c.save();c.translate(w/2+(1-ease)*w*(layer%2?-.55:.55),h/2+(1-ease)*h*(layer<2?-.65:.65));c.rotate((1-ease)*(layer%2?-.24:.24));c.scale(1+layer*.027,1+layer*.022);c.translate(-w/2,-h/2);c.globalAlpha=q*(layer===0?1:.3);c.strokeStyle=layer===0?'#18151e':settings.highlightColor;
   if(layer===0){c.fillStyle=settings.highlightColor;c.beginPath();c.rect(-w,-h,w*3,h*3);c.roundRect(x,y,w-2*x,h-y-bottom,[r,r,w*.055,w*.055]);c.fill('evenodd');}shape();c.stroke();c.restore();}
  c.globalAlpha=presence*.16;c.fillStyle='#18151e';for(let xx=w*.015;xx<w;xx+=w*.025)for(let yy=h*.01;yy<h;yy+=w*.025)if(xx<x||xx>w-x||yy<y||yy>h-y){c.beginPath();c.arc(xx,yy,w*.0018,0,7);c.fill();}
  c.globalAlpha=presence;
  const stickers=arch?popStickers.filter((_,i)=>[0,1,4,6,9,11,13,19,20].includes(i)):popStickers;
  for(let i=0;i<stickers.length;i++){const [px,py,radius,kind,color,angle]=stickers[i];c.save();c.translate(w*(.5+(px-.5)*(1-(settings.popInset??12)/100))+Math.sin(age*2.7+i*1.8)*w*.004,h*py+Math.cos(age*3.1+i)*h*.003);c.rotate(angle+(kind==='flower'||kind==='burst'?age*.32:Math.sin(age*2.5+i)*.065));c.fillStyle=color;c.strokeStyle='#211d24';c.lineWidth=w*.005;sticker(c,kind,w*radius*(settings.popSize??125)/100);c.restore();}


 }
 c.restore();
}
export function drawIllustratedTitle(c:CanvasRenderingContext2D,s:Segment,t:number,style:StyleKey,settings:CaptionSettings){
 const w=c.canvas.width,h=c.canvas.height,x=w*settings.x/100,y=h*settings.y/100;const text=settings.uppercase?s.text.toLocaleUpperCase('bs'):s.text;
 let size=w*.235*settings.fontScale/160;const family=settings.fontFamily;c.save();c.font=`${settings.fontWeight??900} ${size}px ${family}`;size*=Math.min(1,w*.84/Math.max(1,c.measureText(text).width));c.font=`${settings.fontWeight??900} ${size}px ${family}`;const width=style==='vistaRise'?w:c.measureText(text).width+size*.4,height=style==='vistaRise'?Math.max(h*.2,size*1.4):size*1.25;
 c.translate(x,y);c.rotate(settings.rotation*Math.PI/180);c.textAlign='center';c.textBaseline='middle';c.globalAlpha=clamp((t-s.start)/.2);c.lineWidth=w*.005;
 if(style==='sketchNote'){
  c.globalAlpha*=1-clamp(((t-(s.frameAnimationStart??s.start))%5.2-2.35)/.3);
  c.strokeStyle=settings.textColor;c.lineWidth=w*.009;c.lineCap='round';c.lineJoin='round';
  for(let i=0;i<3;i++){
   const end=clamp((t-s.start-i*.055)/.28)*Math.PI*2;
   for(let j=1;j<=120;j++){const a=(j-1)/120*end,b=j/120*end;
    const point=(v:number)=>{const rx=width/2*(settings.sketchEllipseWidth??125)/100+size*i*.045,ry=height*.43+size*i*.035,wobble=1+.016*Math.sin(v*7+i*2);return [Math.cos(v)*rx*wobble,Math.sin(v)*ry*wobble];};
    const from=point(a),to=point(b);c.lineWidth=w*.012*(settings.sketchPen??100)/100*(.7+.3*Math.sin(b*3+i));c.beginPath();c.moveTo(from[0],from[1]);c.lineTo(to[0],to[1]);c.stroke();
   }
  }c.fillStyle=settings.textColor;c.fillText(text,0,0);
 }else if(style==='vistaRise'){
  const layer=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(Math.ceil(width+4),Math.ceil(height+size*1.05)):typeof document!=='undefined'?document.createElement('canvas'):null;
  if(layer){layer.width=Math.ceil(width+4);layer.height=Math.ceil(height+size*1.05);const ink=layer.getContext('2d') as CanvasRenderingContext2D|null;if(ink){ink.fillStyle='#ffffff';ink.beginPath();ink.moveTo(0,0);ink.lineTo(layer.width,0);ink.lineTo(layer.width,height);for(let i=3;i>=0;i--){ink.lineTo((i+1)*layer.width/4,height+size*.95);ink.lineTo(i*layer.width/4,height);}ink.closePath();ink.fill();ink.globalCompositeOperation='destination-out';ink.font=c.font;ink.textAlign='center';ink.textBaseline='middle';ink.fillText(text,layer.width/2,height/2);c.globalAlpha*=.7;c.drawImage(layer,-layer.width/2,-height/2);}}
 }else{
  c.rotate(-.045);c.fillStyle='#17151d';c.fillRect(-width/2+size*.08,-height/2+size*.12,width,height);c.fillStyle=settings.highlightColor;c.strokeStyle='#17151d';c.fillRect(-width/2,-height/2,width,height);c.strokeRect(-width/2,-height/2,width,height);c.fillStyle=settings.textColor;c.fillText(text,0,0);
 }
 if(style!=='vistaRise'){
  c.textAlign='left';const left=-c.measureText(text).width/2;
  if(settings.borderMist)drawBorderMist(c,left-size*.1,-size*.6,-left*2+size*.2,size*1.2,size,t-s.start,settings);
  drawTextSurface(c,text,left,0,size,settings);drawTextShine(c,text,left,0,size,settings,t-s.start);
 }
 c.restore();return {x:settings.x,y:settings.y,width:width/w*100,height:height/h*100,rotation:settings.rotation,segmentId:s.id,words:[]};
}
