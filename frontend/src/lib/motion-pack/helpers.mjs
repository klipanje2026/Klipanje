export function makeCanvas(width,height){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;}
export function splitLines(words){
 const upper=words.map(word=>word.toLocaleUpperCase('bs'));
 if(upper.length<2)return ['',upper[0]||''];
 let best=1,delta=Infinity;
 for(let i=1;i<upper.length;i++){const d=Math.abs(upper.slice(0,i).join(' ').length-upper.slice(i).join(' ').length);if(d<delta){delta=d;best=i;}}
 return [upper.slice(0,best).join(' '),upper.slice(best).join(' ')];
}
/** Substitute semantic palette stops without flattening source gradients/lighting. */
export function paletteContext(ctx,colors={}){
 const color=value=>{
  if(typeof value!=='string')return value;
  const rgba=value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if(rgba){const base='#'+rgba.slice(1,4).map(n=>Number(n).toString(16).padStart(2,'0')).join(''),replacement=colors[base];if(replacement)return `rgba(${[1,3,5].map(i=>parseInt(replacement.slice(i,i+2),16)).join(',')},${rgba[4]??1})`;}
  const hex=value.toLowerCase(),base=hex.slice(0,7),replacement=colors[base];
  return replacement&&/^#[a-f\d]{6}$/i.test(replacement)?replacement+hex.slice(7):value;
 };
 return new Proxy(ctx,{
  get(target,key){
   if(key==='createLinearGradient'||key==='createRadialGradient')return(...args)=>{const gradient=target[key](...args),add=gradient.addColorStop.bind(gradient);gradient.addColorStop=(offset,value)=>add(offset,color(value));return gradient;};
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  },
  set(target,key,value){target[key]=['fillStyle','strokeStyle','shadowColor'].includes(key)?color(value):value;return true;},
 });
}

const outlines=new Map();
function simplify(points,tolerance){
 if(points.length<4)return points;
 const end=points.length-1,keep=new Uint8Array(points.length);keep[0]=keep[end]=1;const stack=[[0,end]],sq=tolerance*tolerance;
 while(stack.length){const [a,b]=stack.pop(),p=points[a],q=points[b],dx=q[0]-p[0],dy=q[1]-p[1],den=dx*dx+dy*dy;let far=-1,max=sq;
  for(let i=a+1;i<b;i++){const v=points[i],t=den?Math.max(0,Math.min(1,((v[0]-p[0])*dx+(v[1]-p[1])*dy)/den)):0,d=(v[0]-p[0]-t*dx)**2+(v[1]-p[1]-t*dy)**2;if(d>max){max=d;far=i;}}
  if(far>=0){keep[far]=1;stack.push([a,far],[far,b]);}
 }return points.filter((_,i)=>keep[i]);
}
/** Browser counterpart of Node's text-to-path: outline the actual loaded font.
 * Keeps holes and independent contour shells; no server or uploaded text required.
 */
export function outlineGlyph(char,size,family,baselineOffset){
 const key=JSON.stringify([char,size,family,baselineOffset]);if(outlines.has(key))return outlines.get(key);
 const scale=2,pad=8,canvas=makeCanvas(Math.ceil(size*3+pad*2),Math.ceil(size*3+pad*2)),ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.font=`${family.startsWith('Arial')?'700 ':''}${size*scale}px ${family}`;
 if(!char.trim())return {rings:[],width:ctx.measureText(' ').width/scale};
 const baseline=Math.ceil(size*scale*1.15)+pad;ctx.fillStyle='#fff';ctx.fillText(char,pad,baseline);
 const {width:w,height:h}=canvas,data=ctx.getImageData(0,0,w,h).data,edges=new Map(),stride=w+1;
 const filled=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&data[(y*w+x)*4+3]>=128;
 const edge=(x,y,xx,yy)=>{const id=y*stride+x,list=edges.get(id)||[];list.push(yy*stride+xx);edges.set(id,list);};
 let min=w,max=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(filled(x,y)){
  min=Math.min(min,x);max=Math.max(max,x+1);
  if(!filled(x,y-1))edge(x,y,x+1,y);if(!filled(x+1,y))edge(x+1,y,x+1,y+1);
  if(!filled(x,y+1))edge(x+1,y+1,x,y+1);if(!filled(x-1,y))edge(x,y+1,x,y);
 }
 const rings=[];
 while(edges.size){const start=edges.keys().next().value;let current=start;const points=[];
  do{points.push([current%stride,Math.floor(current/stride)]);const next=edges.get(current);if(!next)break;const id=next.pop();if(!next.length)edges.delete(current);current=id;}while(current!==start);
  if(points.length>3){points.push(points[0]);const ring=simplify(points,.65);ring.pop();rings.push(ring.map(([x,y])=>[(x-(min+max)/2)/scale,(y-baseline)/scale+size*baselineOffset]));}
 }
 const result={rings,width:rings.length?(max-min)/scale:ctx.measureText(char).width/scale};
 if(outlines.size>=256)outlines.delete(outlines.keys().next().value);outlines.set(key,result);return result;
}
