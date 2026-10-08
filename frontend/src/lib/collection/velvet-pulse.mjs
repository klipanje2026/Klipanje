import {captionRows,rowBaseline,rowFontSize} from './caption-layout.mjs';
/** velvet-pulse: original painting functions; UI, demo clock and host messaging removed. */
export function createArtwork(canvas,options={}){
 const ctx=canvas.getContext('2d'),reduced={matches:false};
 const settings={...{elasticity:1,fibres:true,speed:1},...options};
 const width=736,height=480,glyphs=new Map();
 let time=0,active=0,chunkIndex=0,segments=[],chunks=[],signature='';
 const font="160px \"Lilita One\", sans-serif";
 const base=160;
const pad=45;
const baseline=184;
const measure=document.createElement('canvas').getContext('2d');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function random(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function surface(w,h){const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;}
function rgba(rgb,alpha=1){return `rgba(${rgb.map(v=>Math.round(clamp(v,0,255))).join(',')},${alpha})`;}
function color(hex){return[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
function makeGlyph(char,hero){
    measure.font=font;const advance=measure.measureText(char).width;
    const mask=surface(advance+pad*2+24,260),m=mask.getContext('2d',{willReadFrequently:true});
    m.font=font;m.fillStyle='#fff';m.fillText(char,pad,baseline);
    const raw=m.getImageData(0,0,mask.width,mask.height),pixels=raw.data,w=mask.width,h=mask.height;
    // Two chamfer passes estimate the distance to the nearest contour, including holes.
    const distance=new Float32Array(w*h);
    for(let i=0;i<distance.length;i++)distance[i]=pixels[i*4+3]>127?9999:0;
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x;if(!distance[i])continue;
      distance[i]=Math.min(distance[i],distance[i-1]+1,distance[i-w]+1,distance[i-w-1]+1.4142,distance[i-w+1]+1.4142);
    }
    for(let y=h-2;y>0;y--)for(let x=w-2;x>0;x--){
      const i=y*w+x;if(!distance[i])continue;
      distance[i]=Math.min(distance[i],distance[i+1]+1,distance[i+w]+1,distance[i+w+1]+1.4142,distance[i+w-1]+1.4142);
    }
    // Smooth the distance field so the lighting rolls across the surface gently.
    const smooth=new Float32Array(distance.length),kernel=[1,4,6,4,1];
    for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
      const i=y*w+x;if(!distance[i])continue;let sum=0;
      for(let yy=-2;yy<=2;yy++)for(let xx=-2;xx<=2;xx++)sum+=distance[i+yy*w+xx]*kernel[yy+2]*kernel[xx+2];
      smooth[i]=sum/256;
    }
    const dye=color(hero?'#e6abc6':'#edddc7');
    const normals=new Float32Array(w*h*2),rnd=random(char.codePointAt(0)*173+(hero?752:13));
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x,k=i*4;if(!pixels[k+3])continue;
      const d=smooth[i],gx=(smooth[i+1]-smooth[i-1])*.5,gy=(smooth[i+w]-smooth[i-w])*.5;
      normals[i*2]=gx;normals[i*2+1]=gy;
      // Rounded cross-section: steep contour walls ease into a plush central face.
      const slope=1.9*Math.cos(clamp(d/11,0,1)*Math.PI/2);
      const nx=-gx*slope,ny=-gy*slope,nz=1,length=Math.hypot(nx,ny,nz);
      const light=Math.max(0,(-.42*nx-.61*ny+.67*nz)/length);
      const cavity=.85+.15*clamp(d/7,0,1),nap=(rnd()-.5)*.05;
      const diffuse=(.50+.57*light)*cavity+nap;
      for(let c=0;c<3;c++)pixels[k+c]=clamp(dye[c]*diffuse+21*light,0,255);
    }
    const face=surface(w,h),f=face.getContext('2d');f.putImageData(raw,0,0);
    if(settings.fibres){
      f.globalCompositeOperation='source-atop';f.lineCap='round';
      // Short strands follow a coherent nap with slight local variation.
      for(let n=0;n<4200;n++){
        const x=Math.floor(pad-6+rnd()*(advance+12)),y=Math.floor(43+rnd()*148),i=y*w+x;
        if(pixels[i*4+3]<160)continue;
        const angle=-.7+Math.sin(x*.033+y*.047)*.32+(rnd()-.5)*.9;
        const length=1.3+rnd()*3.9;
        const light=n%3===0;
        f.strokeStyle=rgba(dye.map(v=>v*(light?1.01:.64)+(light?10:0)),light?.28:.22);
        f.lineWidth=.23+rnd()*.37;f.beginPath();f.moveTo(x,y);
        f.quadraticCurveTo(x+Math.cos(angle)*length*.45,y+Math.sin(angle)*length*.6,x+Math.cos(angle)*length,y+Math.sin(angle)*length);f.stroke();
      }
      f.globalCompositeOperation='source-over';
    }
    const sprite=surface(w,h),c=sprite.getContext('2d');
    // Soft loft beneath the surface adds depth without a hard outline.
    c.font=font;c.fillStyle=rgba(dye.map(v=>v*.55));c.shadowColor='#020811aa';c.shadowBlur=9;c.shadowOffsetY=9;
    c.fillText(char,pad+3,baseline+6);c.shadowBlur=0;c.shadowOffsetY=0;
    c.drawImage(face,0,0);
    if(settings.fibres){
      c.lineCap='round';
      for(let y=45;y<200;y++)for(let x=pad-8;x<pad+advance+8;x++){
        const i=y*w+x;if(distance[i]>.9&&distance[i]<2.1&&rnd()<.26){
          const gx=normals[i*2],gy=normals[i*2+1],length=Math.hypot(gx,gy);if(length<.1)continue;
          const strand=1.1+rnd()*3.9;
          c.strokeStyle=rgba(dye.map(v=>v*(.64+rnd()*.3)),.58);c.lineWidth=.28+rnd()*.3;
          c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-gx/length*strand*.6,y-gy/length*strand*.6,x-gx/length*strand+(rnd()-.5)*1.5,y-gy/length*strand);c.stroke();
        }
      }
    }
    return{sprite,advance};
  }
function backdrop(t){
    ctx.fillStyle='#17232d';ctx.fillRect(0,0,width,height);
    const glow=ctx.createRadialGradient(width*.45,height*.42,0,width*.45,height*.42,width*.7);
    glow.addColorStop(0,'#68536350');glow.addColorStop(.6,'#39475430');glow.addColorStop(1,'#0c182300');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    // Slow fabric folds provide a tactile, softly lit studio backdrop.
    for(let i=0;i<10;i++){
      const x=(i/9)*width,widthOfFold=width*.11;
      const g=ctx.createLinearGradient(x-widthOfFold/2,0,x+widthOfFold/2,0);g.addColorStop(0,'#00000000');g.addColorStop(.4,'#cadce709');g.addColorStop(.62,'#080f1d14');g.addColorStop(1,'#00000000');
      ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-widthOfFold,height*.1);ctx.bezierCurveTo(x-12,height*.32,x+8,height*.66,x-widthOfFold,height);
      ctx.lineTo(x+widthOfFold,height);ctx.bezierCurveTo(x+22,height*.61,x-7,height*.28,x+widthOfFold,height*.1);ctx.fill();
    }
    const rnd=random(921);
    for(let i=0;i<16;i++){
      const x=width*(.06+rnd()*.88)+Math.sin(t*.25+i)*2,y=(rnd()*height-t*(1+rnd()*2)+height*20)%height;
      ctx.fillStyle=i%2?'#d5c0ce22':'#dce9df1b';ctx.beginPath();ctx.arc(x,y,.6+rnd()*.8,0,Math.PI*2);ctx.fill();
    }
    const vignette=ctx.createRadialGradient(width*.5,height*.4,width*.2,width*.5,height*.5,width*.8);
    vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#02061065');ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
  }
function contactShadow(x,y,scale,advance,lift,alpha){
    ctx.save();ctx.translate(x+advance*scale*.5,y+13*scale);ctx.scale(1,.18);
    const radius=Math.max(10,advance*scale*.57),g=ctx.createRadialGradient(0,0,0,0,0,radius);
    g.addColorStop(0,`rgba(0,4,10,${.25*alpha/(1+lift*.025)})`);g.addColorStop(1,'#00040a00');ctx.fillStyle=g;ctx.fillRect(-radius,-radius,radius*2,radius*2);ctx.restore();
  }
function renderWord(word,line,local,exit){
    const two=segments[active].words.length>1,hero=!two||line===segments[active].words.length-1;
    const list=[...word].map(char=>glyphs.get(char+':'+(hero?'1':'0'))),spacing=3;
    const total=list.reduce((sum,g)=>sum+g.advance+spacing,0)-spacing;
    const scale=Math.min(rowFontSize(options.fontSize*(hero?1:.65),segments[active].words.length,height)/base,(width-65)/(total+22));
    const whole=total*scale,baseY=rowBaseline(line,segments[active].words.length,height,options.fontSize);
    let x=(width-whole)*.5-3*scale;
    list.forEach((g,i)=>{
      const age=local-Math.min(i*.075,.55)-(hero?.20:0),p=reduced.matches?1:clamp(age/.96,0,1);
      const alpha=reduced.matches?1:clamp(age/.13,0,1)*(1-exit);
      let lift=0,compression=0;
      if(!reduced.matches){
        if(p<.45)lift=75*(1-(p/.45)**2);
        else if(p<.76)lift=24*Math.sin((p-.45)/.31*Math.PI);
        compression=(Math.exp(-Math.abs(p-.45)*28)*.20+Math.exp(-Math.abs(p-.77)*28)*.065)*settings.elasticity;
      }
      const breathing=reduced.matches?0:Math.sin(time*2.3+i*.43)*.012;
      const wave=reduced.matches?0:Math.sin(local*6-i*.5)*Math.exp(-Math.max(0,local-1.4)*3)*.008;
      const sx=1+compression+breathing,sy=1-compression-breathing+wave;
      contactShadow(x,baseY,scale,g.advance,lift,alpha);
      ctx.save();ctx.translate(x,baseY-lift*scale-exit*45);ctx.rotate(reduced.matches?0:Math.sin(time*.7+i*.5)*.012+exit*(i%2?.15:-.15));
      ctx.scale(scale*sx*(1-exit*.12),scale*sy*(1-exit*.12));ctx.globalAlpha=alpha;
      ctx.drawImage(g.sprite,-pad,-baseline);ctx.restore();x+=(g.advance+spacing)*scale;
    });
  }
 
 return {canvas,aspect:width/height,span:3,
  resize(w,h){canvas.width=Math.max(1,Math.round(w));canvas.height=Math.max(1,Math.round(h));},
  render(words,seconds,_timings,groupIndex=0){
   active=chunkIndex=groupIndex;
   words=captionRows(words.map(w=>w),options.fontSize,font);
   const key=JSON.stringify([words,groupIndex]);if(key!==signature){signature=key;segments=chunks=[];segments[groupIndex]={words,cue:0};glyphs.clear();
    words.forEach((word,line)=>{const hero=words.length===1||line===words.length-1;for(const char of word)glyphs.set(char+':'+(hero?'1':'0'),makeGlyph(char,hero));});
   }
   time=seconds+groupIndex*3;ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);ctx.clearRect(0,0,width,height);
   {const local=seconds,exit=reduced.matches?0:clamp((local-2.67)/.33,0,1);
    if(options.backdrop)backdrop(time);segments[active].words.forEach((word,i)=>renderWord(word,i,local,exit));
    }
  },dispose(){glyphs.clear();canvas.width=canvas.height=1;}
 };
}
