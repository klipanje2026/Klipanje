import {CutCaptionRenderer} from './cut-captions-renderer.mjs';
import {ColorDirections} from './color-directions-config.mjs';

const colorClamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const colorEase=v=>1-Math.pow(1-colorClamp(v),3);
const colorCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;};

export class ColorDirectionRenderer extends CutCaptionRenderer{
 constructor(canvas,{style='pigment',look=style,...options}={}){
  if(!ColorDirections[look])throw new RangeError('Nepoznat smjer boje.');
  super(canvas,{...options,style:'ripline',look,flow:.6,texture:.5,motion:1,...options});this.panels=new Map();this.colorBackground=null;
  this.fontReady=this.fontReady.then(()=>{this.panels.clear();return this;});
 }
 setOptions({style,look,...options}){
  look=look||style||this.options.look;if(!ColorDirections[look])throw new RangeError('Nepoznat smjer boje.');
  const before=[this.options.look,this.options.palette,this.options.texture].join('|');super.setOptions({...options,style:'ripline',look});
  if(before!==[this.options.look,this.options.palette,this.options.texture].join('|'))this.panels?.clear();return this;
 }
 setCues(cues){super.setCues(cues);this.panels?.clear();return this;}
 render(time,{background=null}={}){
  if(this.options.look==='luma'&&background){
   if(!this.colorBackground)this.colorBackground=colorCanvas(this.canvas.width,this.canvas.height);
   if(this.colorBackground.width!==this.canvas.width||this.colorBackground.height!==this.canvas.height){this.colorBackground.width=this.canvas.width;this.colorBackground.height=this.canvas.height;}
   const b=this.colorBackground.getContext('2d');b.setTransform(1,0,0,1,0,0);b.clearRect(0,0,this.colorBackground.width,this.colorBackground.height);b.save();b.scale(this.canvas.width/1080,this.canvas.height/1920);background(b,1080,1920,time);b.restore();
  }else this.colorBackground=null;
  super.render(time,{background});this.pose.look=this.options.look;
 }
 palette(){const dir=ColorDirections[this.options.look];return dir.palettes[colorClamp(Math.round(this.options.palette)||0,0,3)];}
 drawRipline(row,ignored,time,q){
  const colors=this.palette(),p={...colors,a:colors.a[1],b:colors.b[1]};CutCaptionRenderer.prototype.drawRipline.call(this,row,p,time,q);
 }
 word(word,row,p,time,settings={}){
  // Preserve the typography and word entrances; printed colour has a soft
  // contact shadow rather than reflective letter edges or stacked extrusion.
  return super.word(word,row,p,time,{...settings,depth:0});
 }
 panel(row,colors){
  const detail=colorClamp(Number(this.options.texture)||0),look=this.options.look,key=[look,row.width.toFixed(3),row.height.toFixed(3),colors.join(','),detail].join('|');if(this.panels.has(key))return this.panels.get(key);
  const pad=40,base=colorCanvas(row.width+pad*2,row.height+pad*2),c=base.getContext('2d'),w=base.width,h=base.height;
  const g=c.createLinearGradient(0,h*.2,w,h*.83);g.addColorStop(0,colors[0]);g.addColorStop(look==='duotone'?.55:.48,colors[1]);g.addColorStop(1,colors[2]);c.fillStyle=g;c.fillRect(0,0,w,h);
  if(look==='pigment'){
   const pool=c.createRadialGradient(w*.29,h*.91,0,w*.29,h*.91,w*.49);pool.addColorStop(0,colors[2]+'ed');pool.addColorStop(.4,colors[2]+'88');pool.addColorStop(1,colors[2]+'00');c.fillStyle=pool;c.fillRect(0,0,w,h);
   const glow=c.createRadialGradient(w*.68,-h*.13,0,w*.68,-h*.13,w*.38);glow.addColorStop(0,colors[1]+'ed');glow.addColorStop(.35,colors[1]+'88');glow.addColorStop(1,colors[1]+'00');c.fillStyle=glow;c.fillRect(0,0,w,h);
  }
  if(look==='duotone'){
   c.save();c.globalAlpha=.38;c.fillStyle=colors[2];c.beginPath();c.moveTo(0,h*.62);c.lineTo(w*.52,h*.05);c.lineTo(w*.64,h);c.lineTo(0,h);c.closePath();c.fill();c.restore();
  }
  if(look==='duotone'&&detail){
   c.save();c.globalAlpha=detail*.4;c.fillStyle=this.palette().dark;const cell=18;for(let y=0;y<h;y+=cell)for(let x=0;x<w;x+=cell){const u=x/w,r=1+Math.pow(1-u,1.5)*3.2;c.beginPath();c.arc(x+(y%36?9:0),y,r,0,Math.PI*2);c.fill();}c.restore();
  }
  if(detail){
   const image=c.getImageData(0,0,w,h),pixels=image.data;let seed=328979;
   for(let i=0;i<pixels.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const fine=(seed/4294967296-.5)*detail*(look==='duotone'?12:look==='pigment'?9:3);for(let k=0;k<3;k++)pixels[i+k]+=fine;}c.putImageData(image,0,0);
  }
  const panel={base,image:colorCanvas(w,h),pad};this.panels.set(key,panel);if(this.panels.size>16)this.panels.delete(this.panels.keys().next().value);return panel;
 }
 strip(row,p,q,{fill=p.a,torn=false,slant=0,stroke=false}={}){
  if(!q)return;const c=this.ctx,phase=colorEase(q),look=this.options.look,palette=this.palette(),colors=fill===p.a?palette.a:palette.b,panel=this.panel(row,colors),d=panel.image.getContext('2d');
  d.clearRect(0,0,panel.image.width,panel.image.height);d.drawImage(panel.base,0,0);
  if(look==='luma'){
   const moving=!this.options.reducedMotion&&this.options.motion!==0,flow=moving?colorClamp(Number(this.options.flow)||0):0,drift=Math.sin(this.time*.53+row.row*.7)*flow;
   const x=panel.image.width*(.38+drift*.19),y=panel.image.height*(.1+drift*.2),pool=d.createRadialGradient(x,y,0,x,y,panel.image.width*.53);pool.addColorStop(0,colors[1]+'e0');pool.addColorStop(.6,colors[2]+'33');pool.addColorStop(1,colors[2]+'00');d.fillStyle=pool;d.fillRect(0,0,panel.image.width,panel.image.height);
  }
  const path=()=>{c.beginPath();if(look==='luma'){c.roundRect(-28,-5,row.width+56,row.height+16,22);}else if(look==='duotone'){c.moveTo(-18,-4);c.lineTo(row.width+30,0);c.lineTo(row.width+20,row.height+12);c.lineTo(-28,row.height+8);}else if(torn){c.moveTo(-28,3);for(let x=-28;x<row.width+30;x+=17)c.lineTo(x,-8+Math.sin(x*.3)*4);c.lineTo(row.width+28,row.height+4);for(let x=row.width+28;x>-28;x-=19)c.lineTo(x,row.height+7+Math.sin(x*.44)*5);}else{c.moveTo(-25+slant,0);c.lineTo(row.width+26,0);c.lineTo(row.width+26-slant,row.height+9);c.lineTo(-25,row.height+9);}c.closePath();};
  c.save();c.globalAlpha*=phase;c.beginPath();c.rect(-38,-30,(row.width+76)*phase,row.height+65);c.clip();
  if(look==='duotone'){
   c.save();c.translate(-9,9);path();c.fillStyle=colors[0];c.globalAlpha*=.88;c.fill();c.restore();
  }else{
   path();c.fillStyle=colors[1];c.shadowColor='#00000038';c.shadowBlur=(look==='luma'?19:9)*this.canvas.width/1080;c.shadowOffsetY=4*this.canvas.width/1080;c.fill();c.shadowBlur=0;c.shadowOffsetY=0;
  }
  path();c.clip();
  if(look==='luma'&&this.colorBackground){c.save();c.filter=`blur(${10*this.canvas.width/1080}px)`;c.setTransform(1,0,0,1,0,0);c.drawImage(this.colorBackground,0,0);c.restore();}
  if(look==='luma')c.globalAlpha*=this.colorBackground?.83:.96;c.drawImage(panel.image,-panel.pad,-panel.pad);
  if(look==='luma'){path();c.lineWidth=3;c.strokeStyle='#ffffff25';c.stroke();}c.restore();
 }
 dispose(){super.dispose();this.panels.clear();this.colorBackground=null;}
}
