import {makeCanvas,paletteContext,outlineGlyph,splitLines} from './helpers.mjs';
export function createArtwork(options={}){
const W=960,H=540,canvas=makeCanvas(W,H),c=paletteContext(canvas.getContext('2d'),options.colors);
const clamp=x=>Math.min(1,Math.max(0,x)),ease=x=>1-Math.pow(1-clamp(x),4);
const spring=x=>x<=0?0:x>=1?1:1-Math.exp(-6.3*x)*Math.cos(x*10);
function glyph(ch,size){return outlineGlyph(ch,size,'Impact, Barlow Condensed, sans-serif',.395);}
let scenes=[];
function setWords(words){const word=(words.at(-1)||'').toLocaleUpperCase('bs'),top=words.slice(0,-1).join(' ').toLocaleUpperCase('bs');let size=options.fontSize??169,gs=[...word].map(ch=>glyph(ch,size));const width=gs.reduce((s,g)=>s+g.width+11,0);if(width>740){size*=740/width;gs=[...word].map(ch=>glyph(ch,size));}scenes=[{word,top,size,glyphs:gs}];}

function rot(x,y,z,rx,ry,rz){let a=y*Math.cos(rx)-z*Math.sin(rx),b=y*Math.sin(rx)+z*Math.cos(rx);y=a;z=b;a=x*Math.cos(ry)+z*Math.sin(ry);b=-x*Math.sin(ry)+z*Math.cos(ry);x=a;z=b;return [x*Math.cos(rz)-y*Math.sin(rz),x*Math.sin(rz)+y*Math.cos(rz),z];}
function proj(p){const k=1100/(1100+p[2]);return [480+p[0]*k,277+p[1]*k,p[2]];}
function polygon(points){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();}
function face(rings){c.beginPath();for(const points of rings){points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();}}
function slab(g,transform,z,depth,t,index,layer){
 const front=g.rings.map(r=>r.map(([x,y])=>transform(x,y,z))),back=g.rings.map(r=>r.map(([x,y])=>transform(x,y,z+depth)));
 const sides=[];
 for(let r=0;r<front.length;r++)for(let i=0;i<front[r].length;i++){const j=(i+1)%front[r].length,p=[front[r][i],front[r][j],back[r][j],back[r][i]],dx=g.rings[r][j][0]-g.rings[r][i][0],dy=g.rings[r][j][1]-g.rings[r][i][1],len=Math.hypot(dx,dy)||1;const light=.3+.7*Math.max(0,(-dy*.6+dx*-.8)/len);sides.push({p,z:p.reduce((s,p)=>s+p[2],0)/4,light});}
 sides.sort((a,b)=>b.z-a.z);
 for(const s of sides){polygon(s.p);const v=s.light; c.fillStyle=layer%2===0?`rgb(${32+v*48},${40+v*50},${48+v*55})`:`rgb(${90+v*125},${43+v*93},${25+v*52})`;c.fill();}
 face(front);
 if(layer===0){
  const phase=Math.sin(t*1.5+index*.28)*30,grad=c.createLinearGradient(0,173+phase,0,362+phase);
  [[0,'#c2d1dc'],[.16,'#fbfbf1'],[.37,'#b6c6d0'],[.49,'#6a8497'],[.52,'#e7edf0'],[.7,'#fbf8e9'],[1,'#819bac']].forEach(([p,col])=>grad.addColorStop(p,col));c.fillStyle=grad;
 }else c.fillStyle=layer%2?'#b57e55':'#536877';
 c.fill('evenodd');c.strokeStyle=layer===0?'#f1f6f2bb':layer%2?'#f0bb8055':'#a9c0d366';c.lineWidth=layer===0?1.25:.7;c.stroke();
 if(layer===0){c.save();face(front);c.clip('evenodd');const sweep=(t*.75)%1.7,px=-300+sweep*1250;const sh=c.createLinearGradient(px-38,0,px+38,0);sh.addColorStop(0,'#ffffff00');sh.addColorStop(.5,'#ffffff99');sh.addColorStop(1,'#ffffff00');c.fillStyle=sh;c.transform(1,0,-.4,1,0,0);c.fillRect(px-40,50,80,470);c.restore();}
}
function render(t){
 const local=t%3.6,scene=scenes[0],exit=ease((local-3.04)/.5);
 const bg=c.createRadialGradient(480,261,20,480,260,640);bg.addColorStop(0,'#1e2a34');bg.addColorStop(.55,'#101820');bg.addColorStop(1,'#080e14');if(options.backdrop){c.fillStyle=bg;c.fillRect(0,0,W,H);}
 // Contact light and deliberately quiet atmosphere around the sculpture.
 c.save();c.translate(490,369);c.scale(1,.14);const shadow=c.createRadialGradient(0,0,10,0,0,310);shadow.addColorStop(0,'#000000ba');shadow.addColorStop(1,'#00000000');c.fillStyle=shadow;c.fillRect(-360,-360,720,720);c.restore();
 c.save();c.globalAlpha=(1-exit)*.55;const ring=ease((local-.28)/1.1);c.strokeStyle='#b7844d';c.lineWidth=.7;c.beginPath();c.ellipse(480,289,280+60*ring,70+10*ring,-.13,Math.PI*(.1+ring*.2),Math.PI*(1.5+ring*.2));c.stroke();c.restore();
 c.save();c.globalAlpha=(1-exit)*ease((local-.2)/.5);c.font='700 20px Arial';c.textAlign='center';c.fillStyle='#c3d0d8';const tagline=scene.top.split('').join(' ');c.fillText(tagline,480,143+(1-ease(local/.8))*20,760);c.restore();
 const total=scene.glyphs.reduce((s,g)=>s+g.width+11,0)-11;
 let x=-total/2;
 const letters=scene.glyphs.map((g,i)=>{const center=x+g.width/2;x+=g.width+11;return {g,i,center};});
 letters.reverse();
 for(const {g,i,center} of letters){
  const age=local-.13-i*.055;if(age<=0)continue;
  const en=spring(age/1.03),assembly=1-ease((age-.1)/1.28),out=exit*(1+i*.045);
  c.save();c.globalAlpha=ease(age/.22)*(1-exit);
  const ry=-.38+Math.sin(local*1.3+i*.3)*.085+(1-en)*.86+out*.4,rx=-.2+Math.sin(local*1.7)*.055+(1-en)*-.45,rz=-.025+(1-en)*Math.sin(i*2)*.28;
  const transform=(px,py,pz)=>{const p=rot(px,py,pz,rx,ry,rz);return proj([p[0]+center+(1-en)*Math.sin(i*3)*38,p[1]+(1-en)*93-out*44+Math.sin(local*2+i*.4)*2,p[2]+(1-en)*170+out*100]);};
  for(let layer=4;layer>=0;layer--){const z=layer*(11+assembly*16),off=assembly*Math.sin(i+layer)*12;slab(g,(px,py,pz)=>transform(px+off,py+assembly*layer*5,pz),z,9.8,t,i,layer);}
  c.restore();
 }
 // Machining flecks move outwards on assembly, then disappear.
 for(let i=0;i<18;i++){const age=local-.25-(i%6)*.07;if(age<0||age>1.4)continue;const p=age/1.4,angle=i*2.399,x=480+Math.cos(angle)*(210+80*p),y=278+Math.sin(angle)*(60+70*p);c.save();c.globalAlpha=Math.sin(Math.PI*p)*.48*(1-exit);c.translate(x,y);c.rotate(angle+p);c.fillStyle=i%3?'#a6bbc8':'#ddaa75';c.fillRect(-2,-.7,4+3*p,1.4);c.restore();}
}

return {canvas,aspect:W/H,span:3.6,setWords,render(t){c.clearRect(0,0,W,H);render(t);},dispose(){canvas.width=canvas.height=1;}};
}
