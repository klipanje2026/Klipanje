import {captionRows,rowBaseline} from '../collection/caption-layout.mjs';
import {makeCanvas,paletteContext,outlineGlyph,splitLines} from './helpers.mjs';
export function createArtwork(options={}){
// A swarm of ceramic microtiles assembles, flexes in a travelling wave and disperses.
const W=900,H=506,canvas=makeCanvas(W,H),c=paletteContext(canvas.getContext('2d'),options.colors);
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>1-Math.pow(1-clamp(x),4);
let tiles=[];function setWords(words){const size=options.fontSize??114,lines=captionRows(words,size,'Arial',740);c.clearRect(0,0,W,H);tiles=[];c.fillStyle='white';c.textAlign='center';c.font=`bold ${Math.min(size,310/lines.length/1.4)}px Arial`;lines.forEach((line,i)=>c.fillText(line,450,rowBaseline(i,lines.length,H,size),740));
const mask=c.getImageData(0,0,W,H).data;
for(let y=50;y<400;y+=6)for(let x=50;x<850;x+=6)if(mask[(y*W+x)*4+3]>128){const i=tiles.length,a=i*2.399;tiles.push({x:x-450,y:y-260,a,r:150+(i*37)%240,z:(i*71)%430-170,i});};c.clearRect(0,0,W,H);}

function rot(x,y,z,rx,ry){const yy=y*Math.cos(rx)-z*Math.sin(rx),zz=y*Math.sin(rx)+z*Math.cos(rx);return[x*Math.cos(ry)+zz*Math.sin(ry),yy,-x*Math.sin(ry)+zz*Math.cos(ry)];}
function render(t){
 const bg=c.createRadialGradient(450,250,20,450,253,560);bg.addColorStop(0,'#24282c');bg.addColorStop(1,'#0a1015');if(options.backdrop){c.fillStyle=bg;c.fillRect(0,0,W,H);}
 const shapes=[];
 for(const q of tiles){const delay=(q.x+300)/1300,age=t-delay,p=ease((age-.1)/1.9),out=ease((t-5.25-delay*.4)/1.55),free=1-p+out;
  const pulse=Math.exp(-Math.pow((t-3.0-q.x*.0017-q.y*.001)/.28,2));
  const a=q.a+t*.18,cx=q.x*(1-free)+Math.cos(a)*q.r*free,cy=q.y*(1-free)+Math.sin(a)*q.r*.66*free,cz=q.z*free-pulse*36;
  const rx=free*(q.a%6)+pulse*1.1,ry=free*(q.a%4)+pulse*.9;
  const pts=[[-2.75,-2.75],[2.75,-2.75],[2.75,2.75],[-2.75,2.75]].map(([x,y])=>{const v=rot(x,y,0,rx,ry),k=950/(950+cz+v[2]);return[450+(cx+v[0])*k,260+(cy+v[1])*k];});
  const val=180+Math.cos(rx)*Math.cos(ry)*58;shapes.push({pts,z:cz,val,alpha:clamp(t/.4)*(1-clamp((t-6.8)/.35))});
 }
 shapes.sort((a,b)=>b.z-a.z);
 for(const s of shapes){c.globalAlpha=s.alpha;c.beginPath();s.pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();const amount=clamp((s.val-179)/59),a=options.deltas?.font1||[0,0,0],b=options.deltas?.font2||[0,0,0],d=options.deltas?.font3||[0,0,0],shade=[s.val,s.val+1,s.val-3].map((n,i)=>n+(amount<.8?a[i]+(b[i]-a[i])*amount/.8:b[i]+(d[i]-b[i])*(amount-.8)/.2));c.fillStyle='rgb('+shade.join(',')+')';c.shadowColor='#000000';c.shadowBlur=1;c.shadowOffsetX=1.2;c.shadowOffsetY=2;c.fill();}
 c.globalAlpha=1;c.shadowBlur=0;c.shadowOffsetX=0;c.shadowOffsetY=0;
}

return {canvas,aspect:W/H,span:7.2,setWords,render(t){c.clearRect(0,0,W,H);render(t);},dispose(){canvas.width=canvas.height=1;}};
}
