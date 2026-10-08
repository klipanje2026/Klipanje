import {captionRows,rowBaseline,rowFontSize} from './caption-layout.mjs';
/** forged: original painting functions; UI, demo clock and host messaging removed. */
export function createArtwork(canvas,options={}){
 const ctx=canvas.getContext('2d'),reduced={matches:false};
 const settings={...{ depth:28, sparks:true, speed:1, material:'ice' },...options};
 const width=736,height=460,glyphs=new Map();
 let time=0,active=0,chunkIndex=0,segments=[],chunks=[],signature='';
 const fontFamily="Bungee, Impact, sans-serif";
 const materials = {
    gold:{name:'Zlatna',hex:'#e7b465'}, silver:{name:'Srebrna',hex:'#aebdd0'},
    ice:{name:'Ledena',hex:'#36cbef'}, violet:{name:'Ljubičasta',hex:'#ad5cff'},
    ruby:{name:'Crvena',hex:'#f44f71'}, emerald:{name:'Zelena',hex:'#42d990'},
    copper:{name:'Bakrena',hex:'#f38359'}, pink:{name:'Ružičasta',hex:'#ff7bd1'}
  };
const baseSize = 112;
const measureCanvas = document.createElement('canvas');
const measure = measureCanvas.getContext('2d');
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const shine=surface(280,224);
const shineCtx=shine.getContext('2d');
 function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function surface(w,h) { const c=document.createElement('canvas'); c.width=Math.ceil(w); c.height=Math.ceil(h); return c; }
function gradient(c, stops, x1,y1,x2,y2) { const g=c.createLinearGradient(x1,y1,x2,y2); stops.forEach(([s,color])=>g.addColorStop(s,color)); return g; }
function metalRGB(luminance) {
    const hex=materials[settings.material].hex;
    const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
    return channels.map(channel=>Math.round(luminance<=.64 ? channel*luminance/.64 : channel+(255-channel)*(luminance-.64)/.36));
  }
function tone(luminance,alpha=1) { return `rgba(${metalRGB(luminance).join(',')},${alpha})`; }
function tintMetal(c) {
    if(settings.material==='gold') return; // Preserve the approved original material exactly.
    const image=c.getImageData(0,0,c.canvas.width,c.canvas.height), pixels=image.data;
    const ramp=Array.from({length:256},(_,i)=>metalRGB(i/255));
    for(let i=0;i<pixels.length;i+=4) {
      if(!pixels[i+3]) continue;
      const lum=Math.round(pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722);
      const rgb=ramp[lum]; pixels[i]=rgb[0];pixels[i+1]=rgb[1];pixels[i+2]=rgb[2];
    }
    c.putImageData(image,0,0);
  }
function createGlyph(char) {
    measure.font = `${baseSize}px ${fontFamily}`;
    const advance = measure.measureText(char).width;
    const pad = 48, baseline = 134;
    const sprite = surface(advance + 2*pad + 40, 224);
    const c = sprite.getContext('2d');
    c.font = measure.font; c.lineJoin='round'; c.textBaseline='alphabetic';
    c.shadowColor='#000'; c.shadowBlur=12; c.shadowOffsetY=16;
    c.fillStyle='#010608'; c.fillText(char,pad+17,baseline+28); c.shadowBlur=0; c.shadowOffsetY=0;
    for (let z=settings.depth; z>0; z--) {
      const edge = z%6===0;
      const brightness = Math.round(31+(1-z/settings.depth)*22);
      c.fillStyle=edge?`rgb(${brightness+19},${brightness+8},${brightness-3})`:`rgb(${brightness},${brightness-7},${brightness-12})`;
      c.strokeStyle=edge?'#9b673a':'#17150f'; c.lineWidth=2.8;
      c.strokeText(char,pad+z*.56,baseline+z*.78);
      c.fillText(char,pad+z*.56,baseline+z*.78);
    }
    c.lineWidth=9; c.strokeStyle='#02161a'; c.strokeText(char,pad,baseline);
    c.lineWidth=6.5; c.strokeStyle='#71c6d9'; c.strokeText(char,pad-1,baseline-1);
    c.lineWidth=5.5;
    c.strokeStyle=gradient(c,[[0,'#d8fbff'],[.38,'#6a7779'],[.55,'#241c12'],[.8,'#edb16b'],[1,'#ffedc9']],0,20,0,145);
    c.strokeText(char,pad,baseline);
    const face = surface(sprite.width,sprite.height), f=face.getContext('2d');
    f.font=measure.font; f.textBaseline='alphabetic'; f.lineJoin='round';
    f.fillStyle=gradient(f,[[0,'#ffedb8'],[.18,'#f7ce8b'],[.27,'#b57b47'],[.40,'#fff7db'],[.48,'#f6e5b8'],[.51,'#3d3c31'],[.57,'#161d20'],[.66,'#b18e58'],[.80,'#ffe7a4'],[.88,'#fff7df'],[1,'#9e7949']],0,29,12,145);
    f.fillText(char,pad,baseline);
    const mask=surface(sprite.width,sprite.height), m=mask.getContext('2d');
    m.font=measure.font; m.fillStyle='#fff'; m.fillText(char,pad,baseline);
    f.globalCompositeOperation='source-atop';
    const random=rng(char.codePointAt(0)*91+137);
    for(let i=0;i<200;i++) {
      const x=pad-3+random()*(advance+6), y=24+random()*120;
      f.fillStyle=i%3===0?'#fff4c346':'#11191252';
      f.fillRect(x,y,random()*2.5+.3,random()*2+.3);
    }
    // Fine, irregular machining scratches, clipped to the letter's face.
    for(let i=0;i<42;i++) {
      const x=pad-5+random()*(advance+10), y=24+random()*117;
      f.strokeStyle=i%4===0?'#fff3ca8a':'#4f482a73'; f.lineWidth=random()*.8+.25;
      f.beginPath(); f.moveTo(x,y); f.lineTo(x+3+random()*19,y+random()*2); f.stroke();
    }
    // Fractures with a warm emissive core make the surface visibly material.
    for(let i=0;i<3;i++) {
      let x=pad+random()*advance, y=30+random()*50;
      f.beginPath(); f.moveTo(x,y);
      for(let j=0;j<5;j++) { x+=random()*14-7; y+=8+random()*9; f.lineTo(x,y); }
      f.strokeStyle='#352818'; f.lineWidth=2.7; f.stroke();
      f.strokeStyle='#ffe0a7'; f.lineWidth=.6; f.shadowColor='#ff9f42'; f.shadowBlur=3; f.stroke(); f.shadowBlur=0;
    }
    f.globalCompositeOperation='source-over';
    c.drawImage(face,0,0);
    // A narrow cut edge: cyan top light, hot gold bottom light.
    c.strokeStyle='#fff8d57d'; c.lineWidth=.8; c.strokeText(char,pad-.5,baseline-.8);
    tintMetal(c);
    return { sprite,mask,advance,pad,baseline };
  }
function background(t) {
    ctx.fillStyle='#060d14'; ctx.fillRect(0,0,width,height);
    const haze=ctx.createRadialGradient(width*.25,height*.33,0,width*.25,height*.33,width*.76);
    haze.addColorStop(0,'#143a48'); haze.addColorStop(.45,'#0b1d29'); haze.addColorStop(1,'#060b12');
    ctx.fillStyle=haze; ctx.fillRect(0,0,width,height);
    const glow=ctx.createRadialGradient(width*.82,height*.68,0,width*.82,height*.68,width*.5);
    glow.addColorStop(0,tone(.4,.20)); glow.addColorStop(1,tone(.08,0));
    ctx.fillStyle=glow; ctx.fillRect(0,0,width,height);
    ctx.save(); ctx.translate(width*.5,height*.51); ctx.scale(1,.62); ctx.rotate(-.26);
    for(let i=0;i<5;i++) {
      ctx.beginPath(); ctx.ellipse(0,0,width*(.25+i*.065),width*(.25+i*.065),0,0,Math.PI*2);
      ctx.strokeStyle=i===0?'#69d0ec19':'#8eacb810'; ctx.lineWidth=.7; ctx.stroke();
    }
    ctx.restore();
    // Moving volumetric slivers remain behind the typography.
    ctx.save(); ctx.globalCompositeOperation='screen'; ctx.translate(width*.08,height*.04); ctx.rotate(-.33+Math.sin(t*.16)*.025);
    const ray=ctx.createLinearGradient(0,0,width*.42,0); ray.addColorStop(0,'#6ad2f700'); ray.addColorStop(.5,'#7dd8ef12'); ray.addColorStop(1,'#6ad2f700');
    ctx.fillStyle=ray; ctx.fillRect(0,-20,width*.42,height*1.5); ctx.restore();
    const random=rng(72);
    for(let i=0;i<38;i++) {
      const x=random()*width, y=(random()*height-t*(3+random()*6)+height*20)%height;
      ctx.fillStyle=i%4===0?tone(.7,.5):'#66b6d64d'; ctx.fillRect(x,y,i%5===0?1.6:.7,i%5===0?1.6:.7);
    }
    const vignette=ctx.createRadialGradient(width*.5,height*.48,width*.1,width*.5,height*.5,width*.7);
    vignette.addColorStop(0,'#00000000'); vignette.addColorStop(1,'#0000008c'); ctx.fillStyle=vignette; ctx.fillRect(0,0,width,height);
  }
function drawGlyph(g,x,y,scale,rotation,alpha,shinePhase) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(rotation); ctx.scale(scale,scale); ctx.globalAlpha*=alpha;
    ctx.drawImage(g.sprite,-g.pad,-g.baseline);
    if(shinePhase>-.7&&shinePhase<1.7) {
      shineCtx.clearRect(0,0,shine.width,shine.height);
      shineCtx.drawImage(g.mask,0,0);
      shineCtx.globalCompositeOperation='source-in';
      const pos=g.pad+shinePhase*g.advance;
      const beam=shineCtx.createLinearGradient(pos-20,0,pos+24,8);
      beam.addColorStop(0,tone(.9,0)); beam.addColorStop(.45,tone(.9,.13)); beam.addColorStop(.5,tone(.99,.9)); beam.addColorStop(.58,tone(.9,.4)); beam.addColorStop(1,tone(.9,0));
      shineCtx.fillStyle=beam; shineCtx.fillRect(0,0,shine.width,shine.height);
      shineCtx.globalCompositeOperation='source-over';
      ctx.globalCompositeOperation='screen'; ctx.drawImage(shine,-g.pad,-g.baseline); ctx.globalCompositeOperation='source-over';
    }
    ctx.restore();
  }
function sparkBurst(t,centerX,centerY,seed) {
    if(!settings.sparks||reduced.matches||t<0||t>1.1) return;
    const random=rng(seed);
    ctx.save(); ctx.globalCompositeOperation='screen';
    for(let i=0;i<22;i++) {
      const angle=random()*Math.PI*2, speed=20+random()*95;
      const x=centerX+Math.cos(angle)*speed*t, y=centerY+Math.sin(angle)*speed*t+50*t*t;
      const tail=.04+random()*.045;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-Math.cos(angle)*speed*tail,y-Math.sin(angle)*speed*tail);
      ctx.globalAlpha=(1-t/1.1)*(.4+random()*.6); ctx.strokeStyle=i%5===0?tone(.98):tone(.82); ctx.lineWidth=i%3===0?1.5:.65; ctx.stroke();
    }
    ctx.restore();
  }
function drawWord(word,line,local,exit) {
    const letters=[...word], list=letters.map(c=>glyphs.get(c));
    const total=list.reduce((sum,g)=>sum+g.advance+1.5,0)-1.5;
    const desired=rowFontSize(options.fontSize,chunks[chunkIndex].words.length,height);
    const scale=Math.min(desired/baseSize,(width-64)/(total+27));
    const fullWidth=total*scale;
    const baseline=rowBaseline(line,chunks[chunkIndex].words.length,height,options.fontSize);
    const camera=reduced.matches?0:Math.sin(time*.85)*.015;
    const xStart=(width-fullWidth)*.5-6*scale;
    let cursor=xStart;
    list.forEach((g,index)=> {
      const age=local-Math.min(index*.055,.55)-line*.12;
      const enter=reduced.matches?1:clamp(age/.58,0,1);
      const settle=enter>=1?0:Math.exp(-7*enter)*Math.cos(12*enter);
      const alpha=reduced.matches?1:clamp(age/.13,0,1)*(1-exit);
      const y=baseline-settle*(55+index%3*15)+exit*30;
      const x=cursor+settle*(index%2?24:-24);
      const rotation=(reduced.matches?0:settle*(index%2?.3:-.3))+camera;
      const size=scale*(1+.3*settle-exit*.15);
      // A brief luminous echo follows individual letters while they fly in.
      if(enter<.7&&alpha>0) {
        ctx.save(); ctx.globalCompositeOperation='screen';
        drawGlyph(g,x-settle*14,y-settle*9,size,rotation,alpha*.12,-2);
        ctx.restore();
      }
      drawGlyph(g,x,y,size,rotation,alpha,(local-.72)*2.4-index*.21);
      sparkBurst(age-.28,x+g.advance*scale*.45,baseline-28*scale,word.codePointAt(0)*81+index*41+line*213);
      cursor+=(g.advance+1.5)*scale;
    });
    return { baseline,scale,x:xStart,width:fullWidth };
  }
 
 return {canvas,aspect:width/height,span:2.3,
  resize(w,h){canvas.width=Math.max(1,Math.round(w));canvas.height=Math.max(1,Math.round(h));},
  render(words,seconds,_timings,groupIndex=0){
   active=chunkIndex=groupIndex;
   words=captionRows(words.map(w=>w.toLocaleUpperCase('hr')),options.fontSize,'Bungee');
   const key=JSON.stringify([words,groupIndex]);if(key!==signature){signature=key;segments=chunks=[];segments[groupIndex]={words,cue:0};glyphs.clear();
    for(const char of new Set(words.join('')))glyphs.set(char,createGlyph(char));
   }
   time=seconds+groupIndex*2.3;ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);ctx.clearRect(0,0,width,height);
   {const local=seconds;
    const exit=reduced.matches?0:clamp((local-2.04)/.26,0,1);
    if(options.backdrop)background(time);
    const words=chunks[chunkIndex].words;
    const rendered=words.map((word,index)=>drawWord(word,index,local,exit));
    const lastWord=rendered[rendered.length-1];
    // A bright underline draws itself under the dominant word.
    const stroke=clamp((local-.6)/.55,0,1);
    const underlineY=lastWord.baseline+28*lastWord.scale+8;
    ctx.save(); ctx.globalAlpha=(1-exit)*.8;
    ctx.fillStyle=gradient(ctx,[[0,tone(.65,0)],[.18,tone(.9)],[.6,tone(.82)],[1,tone(.5,0)]],lastWord.x,0,lastWord.x+lastWord.width,0);
    ctx.shadowColor=tone(.85); ctx.shadowBlur=14;
    ctx.fillRect(lastWord.x,underlineY,lastWord.width*stroke,1.3); ctx.restore();
    // Reflected letter silhouettes, broken into horizontal water-like bands.
    if(width>420) {
      ctx.save(); ctx.globalAlpha=.065*(1-exit); ctx.translate(0,height*.85); ctx.scale(1,-.3);
      words[words.length-1].split('').reduce((x,char)=> { const g=glyphs.get(char); drawGlyph(g,x,0,lastWord.scale,0,.6,-2); return x+(g.advance+1.5)*lastWord.scale; },lastWord.x);
      ctx.restore();
    }
    // Small lens glint tracks the face highlight instead of obscuring the words.
    const flare=clamp(1-Math.abs(local-1.25)*5,0,1)*(1-exit);
    if(flare&&!reduced.matches) {
      const x=lastWord.x+lastWord.width*.75,y=lastWord.baseline-baseSize*lastWord.scale*.62;
      ctx.save(); ctx.globalCompositeOperation='screen'; ctx.globalAlpha=flare*.8;
      const f=ctx.createRadialGradient(x,y,0,x,y,30); f.addColorStop(0,tone(.99)); f.addColorStop(.07,tone(.99)); f.addColorStop(.15,tone(.8,.5)); f.addColorStop(1,tone(.65,0)); ctx.fillStyle=f; ctx.fillRect(x-30,y-30,60,60);
      ctx.fillStyle=gradient(ctx,[[0,tone(.9,0)],[.5,tone(.98)],[1,tone(.9,0)]],x-60,0,x+60,0); ctx.fillRect(x-60,y-.5,120,1); ctx.restore();
    }
    }
  },dispose(){glyphs.clear();canvas.width=canvas.height=1;}
 };
}
