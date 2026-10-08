import {FormStyles,FormFontMap} from './form-captions-config.mjs';
const fsFxClamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const fsFxEase=v=>1-Math.pow(1-fsFxClamp(v),3);
const fsFxFont=(family,size)=>FormFontMap[family].replace('100px',`${size}px`);
const fsBubble=(c,x,y,w,h,r,tail)=>{c.beginPath();c.roundRect(x,y,w,h,r);if(tail){c.moveTo(x+23,y+h-2);c.quadraticCurveTo(x+18,y+h+14,x+8,y+h+14);c.lineTo(x+11,y+h-8);} };
export const FormEffects={
 scene(group,p,time){
  const c=this.ctx,kind=this.options.form,fx=fsFxClamp(Number(this.options.effects)||0,0,1.4),depth=fsFxClamp(Number(this.options.depth)||0),detail=fsFxClamp(Number(this.options.texture)||0),visible=group.entries.filter(w=>this.progress(time,w)>0);if(!visible.length)return;
  c.save();
  if(kind==='halo'&&fx){
   const fraction=(visible.length-1+fsFxEase(this.progress(time,visible.at(-1))))/group.count,rx=group.width/2+15,ry=group.total/2+22,cx=group.width/2,cy=group.total/2;
   c.globalAlpha*=Math.min(1,fx)*.72;c.strokeStyle=p.b;c.lineWidth=2.3;c.beginPath();c.ellipse(cx,cy,rx,ry,-.025,-Math.PI*.94,-Math.PI*.94+Math.PI*1.88*fraction);c.stroke();
   c.strokeStyle=p.a;c.lineWidth=5;c.beginPath();c.ellipse(cx,cy,rx+7,ry+7,-.025,.13,.13+Math.PI*.17*fraction);c.stroke();
   const t=-Math.PI*.94+Math.PI*1.88*fraction;c.fillStyle=p.b;c.beginPath();c.arc(cx+rx*Math.cos(t),cy+ry*Math.sin(t),6,0,Math.PI*2);c.fill();
  }
  if(kind==='talk')for(const row of group.rows){
   const words=row.words.filter(w=>this.progress(time,w)>0);if(!words.length)continue;const last=words.at(-1),first=words[0],q=fsFxEase(this.progress(time,first)),grow=fsFxEase(this.progress(time,last)),left=row.x,top=row.y-4,width=Math.max(52,last.x+last.width*grow-left+25),height=row.height,fill=row.index===1?p.a:row.index===2?p.b:p.dark;
   c.save();c.globalAlpha*=q;const settle=1-q;fsBubble(c,left+4*depth,top+6*depth,width,height,23,true);c.fillStyle=p.dark;c.fill();fsBubble(c,left,top,width,height,23,true);c.fillStyle=fill;c.fill();
   c.save();fsBubble(c,left,top,width,height,23,true);c.clip();c.globalAlpha*=detail*.12;c.fillStyle=c.createPattern(this.pattern('frost',p),'repeat');c.fillRect(left,top,width,height);c.restore();
   if(fx){c.strokeStyle=row.index===0?p.a:row.index===1?p.onA+'44':p.onB+'44';c.lineWidth=1.7;fsBubble(c,left+4,top+4,width-8,height-8,19,false);c.stroke();}c.restore();
  }
  if(kind==='fold'){
   const row=group.rows[0],shown=row.words.filter(w=>this.progress(time,w)>0);if(shown.length){const last=shown.at(-1),height=Math.min(row.height,last.y+last.height-last.originOffset+14),left=row.x,w=row.width;
    c.save();c.globalAlpha*=fsFxEase(this.progress(time,shown[0]));c.fillStyle=p.dark;c.fillRect(left+5*depth,4*depth,w,height+7*depth);c.fillStyle=p.ink;c.fillRect(left,0,w,height);
    c.save();c.beginPath();c.rect(left,0,w,height);c.clip();c.globalAlpha*=detail*.7;c.fillStyle=c.createPattern(this.pattern('paper',p),'repeat');c.fillRect(left,0,w,height);c.restore();
    if(fx){c.fillStyle=p.a;c.fillRect(left,0,6,height);c.fillStyle=p.dark+'25';c.beginPath();c.moveTo(left+w-23,0);c.lineTo(left+w,0);c.lineTo(left+w,23);c.closePath();c.fill();c.strokeStyle=p.a;c.lineWidth=1.5;c.beginPath();c.moveTo(left+19,height-5);c.lineTo(left+w-16,height-5);c.stroke();}c.restore();
   }
   if(fx&&group.rows[1].words.some(w=>this.progress(time,w)>0)){c.strokeStyle=p.b;c.lineWidth=2;c.beginPath();c.moveTo(group.rows[1].x-12,3);c.lineTo(group.rows[1].x-12,group.rows[1].height-5);c.stroke();}
  }
  if(kind==='chain'&&fx){
   const rows=group.rows.filter(row=>row.words.some(w=>this.progress(time,w)>0));c.strokeStyle=p.a;c.lineWidth=2.5;c.lineCap='round';
   for(let i=0;i<rows.length;i++){const row=rows[i],x=row.x-26,y=row.y+row.height*.5,e=fsFxEase(this.progress(time,row.words[0]));c.save();c.globalAlpha*=e*Math.min(1,fx);if(i){const previous=rows[i-1],px=previous.x-26,py=previous.y+previous.height*.5;c.beginPath();c.moveTo(px,py+7);c.bezierCurveTo(px,py+row.height*.6,x,y-row.height*.6,x,y-7);c.stroke();}c.fillStyle=p.dark;c.beginPath();c.arc(x,y,7,0,Math.PI*2);c.fill();c.strokeStyle=p.b;c.stroke();c.restore();}
  }
  c.restore();
 },
 backing(word,p,time){
  const c=this.ctx,kind=this.options.form,e=fsFxEase(this.progress(time,word)),depth=fsFxClamp(Number(this.options.depth)||0),fx=fsFxClamp(Number(this.options.effects)||0,0,1.4),detail=fsFxClamp(Number(this.options.texture)||0),{width:w,size:s,large}=word;c.save();c.globalAlpha*=e;
  if(kind==='halo'&&large&&fx){c.strokeStyle=p.a+'88';c.lineWidth=1.4;c.beginPath();c.arc(w*.5,s*.52,Math.min(s*.6,w*.4),-.7,.7+Math.PI);c.stroke();}
  if(kind==='chain'&&large){c.save();c.translate(4*depth,5*depth);c.fillStyle=p.a+'55';c.beginPath();c.roundRect(-11,-5,w+22,s*1.13,17);c.fill();c.restore();c.fillStyle=p.dark+'d9';c.beginPath();c.roundRect(-11,-5,w+22,s*1.13,17);c.fill();c.strokeStyle=p.a;c.lineWidth=fx?2.5:0;if(fx)c.stroke();if(detail){c.save();c.clip();c.globalAlpha*=detail*.2;c.fillStyle=c.createPattern(this.pattern('grid',p),'repeat');c.fillRect(-11,-5,w+22,s*1.13);c.restore();}}
  if(kind==='sketch'&&large){
   const path=()=>{c.beginPath();c.moveTo(-11,s*.63);c.bezierCurveTo(w*.22,s*.51,w*.68,s*.62,w+10,s*.55);c.lineTo(w+6,s*.99);c.bezierCurveTo(w*.64,s*1.08,w*.21,s*.98,-10,s*1.03);c.closePath();};
   c.save();c.translate(3*depth,4*depth);path();c.fillStyle=p.dark+'80';c.fill();c.restore();path();c.fillStyle=word.band===1?p.b:p.a;c.globalAlpha*=.85;c.fill();c.save();path();c.clip();c.globalAlpha*=detail*.65;c.fillStyle=c.createPattern(this.pattern('paint',p),'repeat');c.fillRect(-16,s*.5,w+32,s*.65);c.restore();
  }
  c.restore();
 },
 glyph(word,p,time){
  const c=this.ctx,kind=this.options.form,q=this.progress(time,word),e=fsFxEase(q),motion=this.options.reducedMotion?0:fsFxClamp(Number(this.options.motion)||0,0,1.5),depth=fsFxClamp(Number(this.options.depth)||0),settle=(1-e)*motion;
  const fill=kind==='talk'?(word.band===1?p.onA:word.band===2?p.onB:p.ink):kind==='fold'&&word.band===0?p.dark:kind==='halo'&&word.large?p.b:kind==='chain'&&word.large?p.ink:p.ink;
  const draw=()=>{c.font=fsFxFont(word.family,word.size);c.lineJoin='round';c.textBaseline='alphabetic';c.strokeStyle=kind==='fold'&&word.band===0?p.dark+'00':p.dark+'df';c.lineWidth=kind==='sketch'?2:Math.max(1.6,word.size*.017);
   if(depth&&word.large&&kind!=='talk'&&!(kind==='fold'&&word.band===0)){c.fillStyle=p.dark;for(let d=Math.ceil(depth*5);d>0;d-=2)c.fillText(word.label,d,word.size*.88+d);c.fillStyle=p.a+'88';c.fillText(word.label,depth*2,word.size*.88+depth*2);}
   c.shadowColor=p.dark+'55';c.shadowBlur=3*this.canvas.width/1080;c.shadowOffsetY=1.5*this.canvas.width/1080;c.strokeText(word.label,0,word.size*.88);const face=this.formFace(word,p,fill,FormStyles[kind].texture);c.drawImage(face.image,-face.pad,-face.pad);
  };c.save();c.globalAlpha*=e;
  if(kind==='halo'){c.translate(0,-12*settle);if(q<1&&motion)c.filter=`blur(${2.3*settle*this.canvas.width/1080}px)`;}
  if(kind==='talk'){c.translate(word.width/2,word.size*.5);c.scale(1-.13*settle,1-.13*settle);c.translate(-word.width/2,-word.size*.5);}
  if(kind==='fold'&&q<1&&motion){c.translate(0,6*settle);c.scale(Math.max(.1,1-.7*settle),1);}
  if(kind==='chain'&&q<1&&motion){c.save();c.globalAlpha*=.2*settle;c.translate(-20*settle,0);draw();c.restore();c.translate(-12*settle,0);}
  if(kind==='sketch'&&q<1&&motion){const chars=[...word.label];c.font=fsFxFont(word.family,word.size);let prefix='';for(let i=0;i<chars.length;i++){const left=c.measureText(prefix).width;prefix+=chars[i];const right=c.measureText(prefix).width,phase=fsFxClamp(q*1.65-i/Math.max(1,chars.length-1)*.65);if(!phase)continue;c.save();c.globalAlpha*=fsFxEase(phase);c.beginPath();c.rect(left-2,-35,right-left+4,word.size*1.8);c.clip();draw();c.restore();}}
  else draw();c.restore();
 },
 accent(word,p,time){
  const c=this.ctx,kind=this.options.form,e=fsFxEase(this.progress(time,word)),fx=fsFxClamp(Number(this.options.effects)||0,0,1.4),{width:w,size:s,large}=word,active=word.index===this.activeIndex;if(!fx)return;c.save();c.globalAlpha*=e*Math.min(1,fx);c.strokeStyle=p.a;c.lineWidth=2;c.lineCap='round';
  if(kind==='halo'&&active){c.fillStyle=p.a;c.beginPath();c.arc(w*.5,s*1.15,3.5,0,Math.PI*2);c.fill();}
  if(kind==='talk'&&active){c.strokeStyle=word.band===1?p.onA:word.band===2?p.onB:p.b;c.lineWidth=2;c.beginPath();c.moveTo(0,s*1.06);c.lineTo(w*e,s*1.06);c.stroke();}
  if(kind==='fold'&&large){c.strokeStyle=word.band===0?p.a:p.b;c.lineWidth=3;c.beginPath();c.moveTo(0,s*1.04);c.lineTo(w*e,s*1.04);c.stroke();}
  if(kind==='chain'&&active){c.strokeStyle=p.b;c.lineWidth=3;c.beginPath();c.moveTo(w+12,s*.2);c.lineTo(w+19,s*.4);c.lineTo(w+12,s*.62);c.stroke();}
  if(kind==='sketch'&&large){
   c.strokeStyle=word.band===1?p.a:p.b;c.lineWidth=2.6;c.beginPath();c.moveTo(-2,s*1.08);c.bezierCurveTo(w*.27,s*1.15,w*.6,s*1.03,w*e,s*1.09);c.stroke();
   if(word.band===1){c.strokeStyle=p.b;c.lineWidth=1.8;c.beginPath();c.ellipse(w*.5,s*.57,w*.5+15,s*.59,-.035,-1.8,-1.8+Math.PI*2*e);c.stroke();}
   if(word.band===2){c.strokeStyle=p.a;c.beginPath();c.moveTo(w+7,s*.27);c.quadraticCurveTo(w+25,s*.11,w+28,s*.38);c.moveTo(w+23,s*.33);c.lineTo(w+28,s*.4);c.lineTo(w+33,s*.32);c.stroke();}
  }
  c.restore();
 }
};
