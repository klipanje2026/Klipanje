import {makeCanvas,paletteContext,outlineGlyph,splitLines} from './helpers.mjs';
export function createArtwork(options={}){
// Original procedural liquid-letter studies. Node + Canvas; no video assets.
// Moving signed-distance surfaces control silhouettes, droplets and drips.
// This is art-directed fluid motion, not a Navier–Stokes physics solver.
const W=800,H=450,N=W*H,canvas=makeCanvas(W,H),c=paletteContext(canvas.getContext('2d'),options.colors);
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>1-Math.pow(1-clamp(x),3);
const mix=(a,b,t)=>a+(b-a)*t;
function noise(x,y){const h=(a,b)=>{let q=Math.imul(a,374761393)+Math.imul(b,668265263);q=Math.imul(q^(q>>>13),1274126177);return ((q^(q>>>16))>>>0)/4294967295;};const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,s=u*u*(3-2*u),r=v*v*(3-2*v);return mix(mix(h(i,j),h(i+1,j),s),mix(h(i,j+1),h(i+1,j+1),s),r);}
function dist(mask,inside){const d=new Float32Array(N);for(let k=0;k<N;k++)d[k]=(mask[k]===inside)?0:999;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=y*W+x;let a=d[k];if(x)a=Math.min(a,d[k-1]+1);if(y)a=Math.min(a,d[k-W]+1);if(x&&y)a=Math.min(a,d[k-W-1]+1.4142);if(x<W-1&&y)a=Math.min(a,d[k-W+1]+1.4142);d[k]=a;}
 for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){const k=y*W+x;let a=d[k];if(x<W-1)a=Math.min(a,d[k+1]+1);if(y<H-1)a=Math.min(a,d[k+W]+1);if(x<W-1&&y<H-1)a=Math.min(a,d[k+W+1]+1.4142);if(x&&y<H-1)a=Math.min(a,d[k+W-1]+1.4142);d[k]=a;}return d;}
function makeShape(word){c.clearRect(0,0,W,H);c.font=`bold ${options.fontSize??158}px Impact, \"Barlow Condensed\", sans-serif`;c.textAlign='center';c.fillStyle='white';c.fillText(word,400,275,700);const rgba=c.getImageData(0,0,W,H).data,mask=new Uint8Array(N);for(let k=0;k<N;k++)mask[k]=rgba[k*4+3]>127?1:0;const a=dist(mask,1),b=dist(mask,0);for(let k=0;k<N;k++)a[k]-=b[k];
 const feet=[];for(let x=50;x<750;x+=28){for(let y=310;y>130;y--)if(mask[y*W+x]){feet.push([x,y]);break;}}return{sdf:a,feet};}
function sample(data,x,y){x=Math.max(0,Math.min(W-2,x));y=Math.max(0,Math.min(H-2,y));const ix=x|0,iy=y|0,u=x-ix,v=y-iy,k=iy*W+ix;return mix(mix(data[k],data[k+1],u),mix(data[k+W],data[k+W+1],u),v);}
function smin(a,b,k){const h=clamp(.5+.5*(b-a)/k);return mix(b,a,h)-k*h*(1-h);}
const field=new Float32Array(N),tex=new Float32Array(N),fine=new Float32Array(N),background=new Uint8ClampedArray(N*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=y*W+x;tex[k]=noise(x*.034,y*.034)*.65+noise(x*.089,y*.089)*.35;fine[k]=noise(x*.32,y*.32);const r=Math.hypot((x-400)/620,(y-215)/430),v=Math.max(0,1-r);background[k*4]=8+v*9;background[k*4+1]=13+v*11;background[k*4+2]=18+v*14;background[k*4+3]=255;const a=options.deltas?.background1||[0,0,0],b=options.deltas?.background2||[0,0,0];for(let ch=0;ch<3;ch++)background[k*4+ch]+=a[ch]*(1-v)+b[ch]*v;}
function blob(cx,cy,rx,ry){const reach=9;for(let y=Math.max(1,Math.floor(cy-ry-reach));y<Math.min(H-1,cy+ry+reach);y++)for(let x=Math.max(1,Math.floor(cx-rx-reach));x<Math.min(W-1,cx+rx+reach);x++){const d=(Math.hypot((x-cx)/rx,(y-cy)/ry)-1)*Math.min(rx,ry),k=y*W+x;field[k]=smin(field[k],d,7);}}
function liquidFrame(t,style,shape){
 const lava=style==='lava',form=ease((t-.18)/(lava?2.0:1.45)),end=ease((t-5.05)/(lava?1.85:1.5)),amp=(lava?3:2)+(1-form)*(lava?13:22)+end*17;
 const dx=new Float32Array(H),dy=new Float32Array(W);
 for(let y=0;y<H;y++)dx[y]=Math.sin(y*(lava?.063:.05)-t*(lava?1.9:4.6))*amp+Math.sin(y*.12+t*2)*amp*.27;
 for(let x=0;x<W;x++)dy[x]=Math.sin(x*.041-t*(lava?1.3:3.6))*amp*.62+Math.sin(x*.1+t)*amp*.16;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const k=y*W+x;const d=sample(shape.sdf,x+dx[y],y+dy[x]-(1-form)*59-end*81);
  const erode=(1-form)*26+end*23;
  field[k]=d+erode;
 }
 const activity=(1-form)*.8+end;
 if(activity>.015){blob(400,337,185*activity+4,11*activity+1);}
 for(let i=0;i<shape.feet.length;i++){
  const [fx,fy]=shape.feet[i],cycle=(t*(lava?.34:.83)+i*.37)%1;
  const length=(lava?14:7)+activity*55+(lava?14:5)*Math.sin(t+i)**2;
  const startY=fy+(1-form)*59+end*81;
  if(form>.15&&end<.9){for(let j=0;j<4;j++)blob(fx+Math.sin(t*2+i)*amp*.2,startY+j*length/4,(lava?6:3.8)*(1-j*.16),4+length/6);}
  const r=(lava?3.6:2.8)+(1-cycle)*2.8;
  if(form>.08)blob(fx+Math.sin(i*5+t)*((lava?3:11)+activity*20),startY+length+cycle*65,r,r*(lava?1.5:1.1));
 }
 // Incoming beads merge into the surface, then peel off on the exit.
 for(let i=0;i<13;i++){const f=(t*.29+i*.173)%1,a=i*2.399;const r=(1-form)*7+end*5;if(r>1)blob(400+Math.cos(a)*(120+80*f),230+Math.sin(a)*60+(1-form)*(1-f)*95+end*f*130,r,r*(lava?1.6:1));}
 const im=c.createImageData(W,H);if(options.backdrop)im.data.set(background);const data=im.data;
 for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
  const k=y*W+x,d=field[k];if(d>1.2)continue;
  let gx=(field[k+1]-field[k-1])*.5,gy=(field[k+W]-field[k-W])*.5;const gl=Math.hypot(gx,gy)||1;gx/=gl;gy/=gl;
  const dep=Math.max(0,-d),rim=Math.exp(-dep/(lava?2.2:3.5)),slope=Math.exp(-dep/6.5),nz=Math.sqrt(Math.max(.015,1-slope*slope)),nx=gx*slope,ny=gy*slope;
  let rr,gg,bb;
  if(!lava){
   const spec=Math.pow(Math.max(0,nx*-.39+ny*-.58+nz*.71),28),spec2=Math.pow(Math.max(0,nx*.71+ny*.33+nz*.62),38);
   const refr=Math.sin((x+gx*dep*2)*.057+t*2.2)+Math.sin((y+gy*dep*2)*.087-t*2.5),caustic=Math.pow(Math.max(0,refr*.5),5);
   rr=13+rim*88+spec*200+spec2*95+caustic*43;gg=59+rim*112+spec*190+spec2*114+caustic*65;bb=83+rim*118+spec*166+spec2*126+caustic*70;
   const dc=options.deltas||{},baseTint=dc.surface||[0,0,0],rimTint=dc.rim||[0,0,0],shineTint=dc.specular||[0,0,0];rr+=baseTint[0]*(1-rim)+rimTint[0]*rim+shineTint[0]*(spec+spec2);gg+=baseTint[1]*(1-rim)+rimTint[1]*rim+shineTint[1]*(spec+spec2);bb+=baseTint[2]*(1-rim)+rimTint[2]*rim+shineTint[2]*(spec+spec2);const subtle=(tex[k]-.5)*16;rr+=subtle;gg+=subtle;bb+=subtle;
  }else{
   const crust=sample(tex,x+t*2.5,y-t*3.5),crack=Math.abs(Math.sin(x*.028+y*.018+crust*15+t*.27));
   const hot=clamp((.20-crack)*7)+clamp((.38-crust)*7)*.75;
   const cool=form*(1-end*.4),melt=clamp((1-cool)*.62+hot+rim*.58);
   const fl=noise(x*.085+t*.04,y*.085-t*.08),shade=.55+.45*Math.max(0,-gx*.45-gy*.65);
   const base=(19+fine[k]*25)*shade;
   rr=mix(base,255,melt);gg=mix(base*.8,38+150*melt*melt,melt);bb=mix(base*.75,3+39*Math.pow(melt,5),melt);
   rr+=fl*10;gg+=fl*3;const dc=options.deltas||{},crustTint=dc.crust||[0,0,0],hotTint=dc.hot||[0,0,0],hottestTint=dc.hottest||[0,0,0],heat=melt**3;rr+=crustTint[0]*(1-melt)+hotTint[0]*melt*(1-heat)+hottestTint[0]*heat;gg+=crustTint[1]*(1-melt)+hotTint[1]*melt*(1-heat)+hottestTint[1]*heat;bb+=crustTint[2]*(1-melt)+hotTint[2]*melt*(1-heat)+hottestTint[2]*heat;
  }
  const alpha=clamp(1.2-d),p=k*4;if(options.backdrop){data[p]=mix(data[p],rr,alpha);data[p+1]=mix(data[p+1],gg,alpha);data[p+2]=mix(data[p+2],bb,alpha);}else{data[p]=rr;data[p+1]=gg;data[p+2]=bb;data[p+3]=255*alpha;}
 }
 c.putImageData(im,0,0);
 // Ripples/heat glow are consequences of drops beneath the letter surface.
 c.save();c.globalCompositeOperation='screen';
 if(lava){const g=c.createRadialGradient(400,306,5,400,306,180);g.addColorStop(0,`rgba(190,37,0,${.15*form})`);g.addColorStop(1,'#a7200000');c.fillStyle=g;c.fillRect(180,100,440,320);}
 else for(let i=0;i<4;i++){const p=(t*.7+i*.25)%1;c.strokeStyle=`rgba(132,203,217,${(1-p)*.15*form})`;c.lineWidth=1;c.beginPath();c.ellipse(277+i*80,350+(i%2)*5,5+p*42,1+p*8,0,0,Math.PI*2);c.stroke();}
 c.restore();
}

let shape;function setWords(words){shape=makeShape(words.join(' ').toLocaleUpperCase('bs'));}
function render(t){liquidFrame(t,options.element||'water',shape);}
return {canvas,aspect:W/H,span:7.2,setWords,render(t){c.clearRect(0,0,W,H);render(t);},dispose(){canvas.width=canvas.height=1;}};
}
