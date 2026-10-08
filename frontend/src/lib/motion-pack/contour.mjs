import {makeCanvas,paletteContext,outlineGlyph,splitLines} from './helpers.mjs';
export function createArtwork(options={}){
// CONTOUR / RECOIL: matte glyphs with independently moving contour shells.
// Node.js + Canvas 2D. Geometry is projected from 3D points; no HTML or CSS.
const W=960,H=540,canvas=makeCanvas(W,H),c=paletteContext(canvas.getContext('2d'),options.colors);
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>1-Math.pow(1-clamp(x),4);
const spring=x=>x<=0?0:x>=1?1:1-Math.exp(-7*x)*Math.cos(11*x);
function glyph(ch,size){return outlineGlyph(ch,size,'Arial, sans-serif',.35);}
function row(word,size,y){const gs=[...word].map(ch=>glyph(ch,size));const width=gs.reduce((s,g)=>s+g.width+9,0)-9;let x=-width/2;return gs.map((g,i)=>{const item={g,i,x:x+g.width/2,y};x+=g.width+9;return item;});}
let scenes=[];
function setWords(words){const lines=splitLines(words),fit=(word,size)=>{const width=[...word].reduce((s,ch)=>s+glyph(ch,size).width+9,0);return size*Math.min(1,740/Math.max(1,width));};scenes=[[...row(lines[0],fit(lines[0],options.fontSize??106),-69),...row(lines[1],fit(lines[1],options.fontSize??153),64).map(v=>({...v,i:v.i+lines[0].length}))]];}

function rotate(x,y,z,rx,ry,rz){let a=y*Math.cos(rx)-z*Math.sin(rx),b=y*Math.sin(rx)+z*Math.cos(rx);y=a;z=b;a=x*Math.cos(ry)+z*Math.sin(ry);b=-x*Math.sin(ry)+z*Math.cos(ry);x=a;z=b;return[x*Math.cos(rz)-y*Math.sin(rz),x*Math.sin(rz)+y*Math.cos(rz),z];}
function project(p){const s=1200/(1200+p[2]);return [480+p[0]*s,264+p[1]*s,p[2]];}
function path(rings){c.beginPath();for(const points of rings){points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();}}
function solid(g,tx){
 const front=g.rings.map(r=>r.map(([x,y])=>tx(x,y,0))),back=g.rings.map(r=>r.map(([x,y])=>tx(x,y,23)));
 const faces=[];
 for(let r=0;r<front.length;r++)for(let i=0;i<front[r].length;i++){
  const j=(i+1)%front[r].length,points=[front[r][i],front[r][j],back[r][j],back[r][i]];
  const dx=g.rings[r][j][0]-g.rings[r][i][0],dy=g.rings[r][j][1]-g.rings[r][i][1],light=Math.max(0,(-dy*.5-dx*.7)/(Math.hypot(dx,dy)||1));
  faces.push({points,depth:points.reduce((s,p)=>s+p[2],0),value:52+light*56});
 }
 faces.sort((a,b)=>b.depth-a.depth);
 for(const f of faces){path([f.points]);c.fillStyle=`rgb(${f.value},${f.value+2},${f.value+3})`;c.fill();}
 path(front);const grad=c.createLinearGradient(0,110,0,420);grad.addColorStop(0,'#f5f4ef');grad.addColorStop(1,'#c5c7c5');c.fillStyle=grad;c.fill('evenodd');c.strokeStyle='#ffffff90';c.lineWidth=.7;c.stroke();
}
function render(t){
 const local=t%3.8,scene=scenes[0],out=ease((local-3.27)/.48);
 const bg=c.createRadialGradient(480,245,40,480,260,620);bg.addColorStop(0,'#26292b');bg.addColorStop(.6,'#16191b');bg.addColorStop(1,'#0d1012');if(options.backdrop){c.fillStyle=bg;c.fillRect(0,0,W,H);}
 // Grounding shadow stays soft; all colour comes from one neutral material.
 c.save();c.translate(490,400);c.scale(1,.12);const sh=c.createRadialGradient(0,0,15,0,0,290);sh.addColorStop(0,'#00000090');sh.addColorStop(1,'#00000000');c.fillStyle=sh;c.fillRect(-320,-320,640,640);c.restore();
 const jobs=[];
 for(const letter of scene){
  const {g,i,x,y}=letter,age=local-.08-Math.min(i*.029,.7);if(age<0)continue;
  const p=spring(age/.85),reveal=ease(age/.2);
  const pulse=Math.pow(Math.max(0,Math.sin(clamp((age-1.18)/1.15)*Math.PI)),2);
  const peel=(1-ease((age-.18)/.85))*.85+pulse*.7+out*1.2;
  const ry=-.23+(1-p)*.5+Math.sin(local*1.4)*.025,rx=-.12+(1-p)*-.2,rz=(1-p)*(i%2?-.1:.1);
  function tx(px,py,pz,layer=0){
   const d=layer*peel,rotation=rz-d*.025;
   const v=rotate(px,py,pz,rx+d*.035,ry-d*.07,rotation);
   return project([v[0]+x+(1-p)*(i%2?24:-24)+d*15,v[1]+y+(1-p)*61-d*12-out*22,v[2]+(1-p)*100+out*90-layer*peel*17]);
  }
  jobs.push({g,i,tx,reveal,peel});
 }
 // The detached shells exist independently of the solid faces.
 for(const job of jobs){const {g,tx,reveal,peel}=job;
  for(let shell=3;shell>=1;shell--){c.save();c.globalAlpha=reveal*(1-out)*(.2+.5*peel)/(shell*.65+1);path(g.rings.map(r=>r.map(([x,y])=>tx(x,y,0,shell))));c.strokeStyle='#e5e8e6';c.lineJoin='round';c.lineWidth=shell===1?1.7:.85;c.stroke();c.restore();}
 }
 for(const {g,tx,reveal} of jobs){c.save();c.globalAlpha=reveal*(1-out);solid(g,tx);c.restore();}
 // A partial contour runs along the foremost floating shell, like a seam opening.
 for(const {g,tx,reveal,peel,i} of jobs){if(peel<.015)continue;c.save();c.globalAlpha=reveal*(1-out)*Math.min(.9,peel);path(g.rings.map(r=>r.map(([x,y])=>tx(x,y,0,1.5))));c.strokeStyle='#f7f8f3';c.lineWidth=1.25;c.setLineDash([24,110]);c.lineDashOffset=-(local*110+i*24);c.stroke();c.restore();}
}

return {canvas,aspect:W/H,span:3.8,setWords,render(t){c.clearRect(0,0,W,H);render(t);},dispose(){canvas.width=canvas.height=1;}};
}
