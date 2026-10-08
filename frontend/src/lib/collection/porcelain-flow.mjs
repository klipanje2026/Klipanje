import {captionRows,rowBaseline,rowFontSize} from './caption-layout.mjs';
/** porcelain-flow: original painting functions; UI, demo clock and host messaging removed. */
export function createArtwork(canvas,options={}){
 const ctx=canvas.getContext('2d'),reduced={matches:false};
 const settings={...{glaze:1,crackle:true,speed:1},...options};
 const width=736,height=485,glyphs=new Map();
 let time=0,active=0,chunkIndex=0,segments=[],chunks=[],signature='';
 const font="160px Rakkas, Georgia";
 const base=160;
const pad=43;
const baseline=190;
const measure=document.createElement('canvas').getContext('2d');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const polish=surface(300,268);
const pctx=polish.getContext('2d');
 function random(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function surface(w,h){const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;}
function rgb(hex){return[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
function gradient(c,stops,x,y,x2,y2){const g=c.createLinearGradient(x,y,x2,y2);stops.forEach(([p,color])=>g.addColorStop(p,color));return g;}
function makeGlyph(char,hero){
    measure.font=font;const advance=measure.measureText(char).width;
    const mask=surface(advance+pad*2+30,268),m=mask.getContext('2d',{willReadFrequently:true});m.font=font;m.fillStyle='#fff';m.fillText(char,pad,baseline);
    const raw=m.getImageData(0,0,mask.width,mask.height),pixels=raw.data,w=mask.width,h=mask.height;
    const distance=new Float32Array(w*h);
    for(let i=0;i<distance.length;i++)distance[i]=pixels[i*4+3]>127?9999:0;
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x;if(distance[i])distance[i]=Math.min(distance[i],distance[i-1]+1,distance[i-w]+1,distance[i-w-1]+1.4142,distance[i-w+1]+1.4142);
    }
    for(let y=h-2;y>0;y--)for(let x=w-2;x>0;x--){
      const i=y*w+x;if(distance[i])distance[i]=Math.min(distance[i],distance[i+1]+1,distance[i+w]+1,distance[i+w+1]+1.4142,distance[i+w-1]+1.4142);
    }
    const smooth=new Float32Array(distance.length),kernel=[1,4,6,4,1];
    for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
      const i=y*w+x;if(!distance[i])continue;let sum=0;
      for(let yy=-2;yy<=2;yy++)for(let xx=-2;xx<=2;xx++)sum+=distance[i+yy*w+xx]*kernel[yy+2]*kernel[xx+2];smooth[i]=sum/256;
    }
    const dye=rgb(hero?'#6eaba6':'#c8d4bb'),rnd=random(char.codePointAt(0)*377+(hero?199:817));
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x,k=i*4;if(!pixels[k+3])continue;
      const d=smooth[i],gx=(smooth[i+1]-smooth[i-1])*.5,gy=(smooth[i+w]-smooth[i-w])*.5;
      const slope=2.5*Math.cos(clamp(d/12,0,1)*Math.PI/2);
      const nx=-gx*slope,ny=-gy*slope,nz=1,length=Math.hypot(nx,ny,nz);
      const normal=[nx/length,ny/length,1/length];
      const diffuse=Math.max(0,normal[0]*-.40+normal[1]*-.58+normal[2]*.71);
      const spec=Math.pow(Math.max(0,normal[0]*-.23+normal[1]*-.35+normal[2]*.908),27)*.86;
      const glaze=.38+.61*diffuse,pores=(rnd()-.5)*2.5;
      for(let c=0;c<3;c++)pixels[k+c]=clamp(dye[c]*glaze+spec*(255-dye[c]*.2)+pores,0,255);
    }
    const face=surface(w,h),f=face.getContext('2d');f.putImageData(raw,0,0);f.globalCompositeOperation='source-atop';
    if(settings.crackle){
      for(let branch=0;branch<4;branch++){
        let x=pad+rnd()*advance,y=40+rnd()*40;const points=[[x,y]];
        for(let i=0;i<7;i++){x+=rnd()*20-10;y+=12+rnd()*15;points.push([x,y]);}
        f.beginPath();points.forEach(([xx,yy],i)=>i?f.lineTo(xx,yy):f.moveTo(xx,yy));
        f.lineJoin='round';f.strokeStyle='#244f4b80';f.lineWidth=1.9;f.stroke();f.strokeStyle='#d1ac6cd9';f.lineWidth=.55;f.stroke();
        for(let i=2;i<points.length;i+=2){
          const p=points[i],dx=(rnd()-.5)*20;f.beginPath();f.moveTo(p[0],p[1]);f.lineTo(p[0]+dx,p[1]-7);f.lineTo(p[0]+dx*1.7,p[1]-15);f.strokeStyle='#deb677af';f.lineWidth=.45;f.stroke();
        }
      }
    }
    // Sparse glaze imperfections remain tiny, unlike a rough or fibrous material.
    for(let n=0;n<75;n++){
      const x=pad+rnd()*advance,y=43+rnd()*152;f.fillStyle=n%3?'#174a4031':'#ffffff42';f.beginPath();f.arc(x,y,.2+rnd()*.4,0,Math.PI*2);f.fill();
    }
    f.globalCompositeOperation='source-over';
    const sprite=surface(w,h),c=sprite.getContext('2d');c.font=font;c.lineJoin='round';
    c.shadowColor='#35554d45';c.shadowBlur=11;c.shadowOffsetY=10;c.fillStyle='#436e63';c.fillText(char,pad+6,baseline+11);c.shadowBlur=0;c.shadowOffsetY=0;
    for(let z=9;z>0;z--){c.fillStyle=gradient(c,[[0,hero?'#5a8d7f':'#9bada0'],[1,hero?'#2e6057':'#6e9180']],0,35,0,220);c.fillText(char,pad+z*.42,baseline+z*.72);}
    c.drawImage(face,0,0);return{sprite,mask,advance};
  }
function backdrop(t){
    ctx.fillStyle=gradient(ctx,[[0,'#e1d8c8'],[.62,'#d4d0bd'],[1,'#b9c3b6']],0,0,width,height);ctx.fillRect(0,0,width,height);
    const light=ctx.createRadialGradient(width*.20,height*.2,0,width*.2,height*.2,width*.7);light.addColorStop(0,'#fff7df63');light.addColorStop(1,'#fff7df00');ctx.fillStyle=light;ctx.fillRect(0,0,width,height);
    // A broad architectural shadow gives the ceramic a sunlit studio setting.
    ctx.save();ctx.translate(width*.96,-height*.08);ctx.rotate(-.16);ctx.beginPath();ctx.ellipse(0,0,width*.27,height*.51,0,0,Math.PI*2);ctx.fillStyle='#617b6630';ctx.shadowColor='#5f776f1f';ctx.shadowBlur=22;ctx.fill();ctx.restore();
    const floor=height*.84;
    ctx.save();ctx.translate(width*.5,floor);ctx.scale(1,.18);const r=width*.37,g=ctx.createRadialGradient(0,0,0,0,0,r);
    g.addColorStop(0,'#628f8a80');g.addColorStop(.65,'#89b0a76b');g.addColorStop(1,'#aac4b700');ctx.fillStyle=g;ctx.fillRect(-r,-r,r*2,r*2);ctx.restore();
    for(let i=0;i<4;i++){
      ctx.beginPath();ctx.ellipse(width*.5,floor,width*(.23+i*.032)+Math.sin(t*.5+i)*2,5+i*3,0,0,Math.PI*2);ctx.strokeStyle=i%2?'#f0efcd26':'#426c6b22';ctx.lineWidth=.7;ctx.stroke();
    }
  }
function drawGlyph(g,x,y,scale,rotation,alpha,phase){
    ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(scale,scale);ctx.globalAlpha=alpha;ctx.drawImage(g.sprite,-pad,-baseline);
    pctx.clearRect(0,0,polish.width,polish.height);pctx.drawImage(g.mask,0,0);pctx.globalCompositeOperation='source-in';
    const pos=pad+g.advance*(.5+Math.sin(phase)*.45);
    pctx.fillStyle=gradient(pctx,[[0,'#fff8dd00'],[.35,'#f5fff52b'],[.52,'#f5fff585'],[.67,'#fff8dd1f'],[1,'#fff8dd00']],pos-25,0,pos+25,23);pctx.fillRect(0,0,polish.width,polish.height);pctx.globalCompositeOperation='source-over';
    ctx.globalCompositeOperation='screen';ctx.globalAlpha=alpha*.42*settings.glaze;ctx.drawImage(polish,-pad,-baseline);ctx.restore();
  }
function ripple(x,age){
    if(reduced.matches||age<0||age>1.9)return;ctx.save();ctx.globalAlpha=clamp(age*5,0,1)*(1-age/1.9)*.4;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(x,height*.84,12+age*30+i*7,2.3+age*3+i*.7,0,0,Math.PI*2);ctx.strokeStyle=i%2?'#f3f6dd':'#416e67';ctx.lineWidth=.75;ctx.stroke();}ctx.restore();
  }
function droplets(x,age,seed){
    if(reduced.matches||age<.3||age>1.3)return;const rnd=random(seed);ctx.save();
    for(let i=0;i<4;i++){
      const p=(age-.3),xx=x+(rnd()-.5)*24,yy=height*.84-Math.sin(p/1.05*Math.PI)*(15+rnd()*18);
      ctx.globalAlpha=(1-p)*.65;ctx.fillStyle=gradient(ctx,[[0,'#deebda'],[.55,'#92b6a8'],[1,'#507a74']],xx-2,yy-4,xx+2,yy+3);ctx.beginPath();ctx.ellipse(xx,yy,1.5+rnd(),2.4+rnd()*1.2,0,0,Math.PI*2);ctx.fill();
    }ctx.restore();
  }
function renderWord(word,line,local,exit){
    const two=segments[active].words.length>1,hero=!two||line===segments[active].words.length-1,list=[...word].map(char=>glyphs.get(char+':'+(hero?'1':'0'))),spacing=2;
    const total=list.reduce((sum,g)=>sum+g.advance+spacing,0)-spacing,scale=Math.min(rowFontSize(options.fontSize*(hero?1:.65),segments[active].words.length,height)/base,(width-68)/(total+27));
    const whole=total*scale,targetY=rowBaseline(line,segments[active].words.length,height,options.fontSize),floor=height*.84;let x=(width-whole)*.5-3*scale;
    list.forEach((g,i)=>{
      const age=local-Math.min(i*.075,.55)-(hero?.18:0),p=reduced.matches?1:clamp(age/1.0,0,1),ease=1-(1-p)**3;
      const y=(floor+46)*(1-ease)+targetY*ease+exit*height*.32;
      const alpha=reduced.matches?1:clamp(age/.14,0,1)*(1-exit);
      ripple(x+g.advance*scale*.5,age);droplets(x+g.advance*scale*.5,age,word.codePointAt(0)*383+i*419);
      ctx.save();ctx.beginPath();ctx.rect(0,0,width,floor+3);ctx.clip();
      const rotation=reduced.matches?0:(1-ease)*-.25+Math.sin(time*.6+i*.2)*.007;
      drawGlyph(g,x,y,scale,rotation,alpha,time*.7+i*.43);ctx.restore();x+=(g.advance+spacing)*scale;
    });
  }
 
 return {canvas,aspect:width/height,span:3.2,
  resize(w,h){canvas.width=Math.max(1,Math.round(w));canvas.height=Math.max(1,Math.round(h));},
  render(words,seconds,_timings,groupIndex=0){
   active=chunkIndex=groupIndex;
   words=captionRows(words.map(w=>w),options.fontSize,font);
   const key=JSON.stringify([words,groupIndex]);if(key!==signature){signature=key;segments=chunks=[];segments[groupIndex]={words,cue:0};glyphs.clear();
    words.forEach((word,line)=>{const hero=words.length===1||line===words.length-1;for(const char of word)glyphs.set(char+':'+(hero?'1':'0'),makeGlyph(char,hero));});
   }
   time=seconds+groupIndex*3.2;ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);ctx.clearRect(0,0,width,height);
   {const local=seconds,exit=reduced.matches?0:clamp((local-2.83)/.37,0,1);if(options.backdrop)backdrop(time);segments[active].words.forEach((word,i)=>renderWord(word,i,local,exit));
    }
  },dispose(){glyphs.clear();canvas.width=canvas.height=1;}
 };
}
