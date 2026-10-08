import {captionRows,rowBaseline,rowFontSize,captionGlyphStarts} from './caption-layout.mjs';
import {PrismPalettes,prismColors} from './prism-palettes.mjs';
import {paletteContext} from '../motion-pack/helpers.mjs';
/** prism-bloom: original painting functions; UI, demo clock and host messaging removed. */
export function createArtwork(canvas,options={}){
 const colors=prismColors(options.palette),tinted=c=>paletteContext(c.getContext('2d'),colors);
 const ctx=tinted(canvas),reduced={matches:false};
 const settings={...{refraction:1,crystals:true,speed:1},...options};
 const width=736,height=480,glyphs=new Map();
 let time=0,active=0,chunkIndex=0,segments=[],chunks=[],signature='',timingRows=[];
 const font="italic 144px \"DM Serif Display\", Georgia";
 const pointer={x:0,y:0};
const base=144;
const pad=46;
const baseline=169;
const measuring=document.createElement('canvas').getContext('2d');
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const mix=(a,b,p)=>a+(b-a)*p;
const optical=surface(320,238);
const opt=optical.getContext('2d');
 function surface(w,h){const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;}
function random(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function gradient(c,stops,x,y,x2,y2){const g=c.createLinearGradient(x,y,x2,y2);stops.forEach(([p,color])=>g.addColorStop(p,color));return g;}
function polygon(c,points){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
function makeGlyph(char){
    measuring.font=font;const advance=measuring.measureText(char).width;
    const sprite=surface(advance+pad*2+22,238),c=tinted(sprite);
    c.font=font;c.lineJoin='round';
    // Translucent glass volume: purple shadows on one edge, cyan on the other.
    c.shadowColor='#577f9438';c.shadowBlur=12;c.shadowOffsetY=12;
    c.fillStyle='#7379a33b';c.fillText(char,pad+5,baseline+9);c.shadowBlur=0;c.shadowOffsetY=0;
    for(let z=14;z>0;z--){
      c.fillStyle=gradient(c,[[0,'#bec5ec36'],[.30,'#89d8de70'],[.58,'#9893cf67'],[1,'#d3b4e36b']],0,45,0,195);
      c.strokeStyle=z%4===0?'#aaa0cb80':'#c8dae454';c.lineWidth=1.2;
      c.strokeText(char,pad+z*.42,baseline+z*.51);c.fillText(char,pad+z*.42,baseline+z*.51);
    }
    c.lineWidth=4.6;c.strokeStyle=gradient(c,[[0,'#b6c8ea'],[.25,'#476989'],[.55,'#8971b2'],[.78,'#71b9c5'],[1,'#f9e1ff']],0,40,7,185);
    c.strokeText(char,pad,baseline);
    c.lineWidth=2.6;c.strokeStyle='#ffffffd9';c.strokeText(char,pad-.6,baseline-.6);
    const face=surface(sprite.width,sprite.height),f=tinted(face);
    f.font=font;
    f.fillStyle=gradient(f,[[0,'#f6f7ff'],[.16,'#e2c8ec'],[.30,'#ace0e4'],[.43,'#def9f2'],[.51,'#798fc1'],[.61,'#ccb1e0'],[.76,'#effcff'],[.86,'#83ced6'],[1,'#aeacdc']],pad,41,pad+advance*.7,181);
    f.fillText(char,pad,baseline);
    const mask=surface(sprite.width,sprite.height),m=mask.getContext('2d');m.font=font;m.fillStyle='#fff';m.fillText(char,pad,baseline);
    f.globalCompositeOperation='source-atop';
    const rnd=random(char.codePointAt(0)*237+11);
    // Triangulated optical planes are clipped to each character; no bitmap texture.
    const points=[];
    for(let row=0;row<4;row++){
      const line=[];
      for(let col=0;col<4;col++)line.push([pad-6+col*(advance+12)/3+(col===0||col===3?0:(rnd()-.5)*16),30+row*52+(row===0||row===3?0:(rnd()-.5)*18)]);
      points.push(line);
    }
    for(let row=0;row<3;row++)for(let col=0;col<3;col++){
      const a=points[row][col],b=points[row][col+1],d=points[row+1][col],e=points[row+1][col+1];
      for(const triangle of [[a,b,d],[b,e,d]]){
        polygon(f,triangle);
        const hue=[192,212,251,282,314][Math.floor(rnd()*5)]+(PrismPalettes[options.palette]||PrismPalettes.amber).hue;
        f.fillStyle=`hsla(${hue},${35+rnd()*25}%,${45+rnd()*45}%,${.13+rnd()*.26})`;f.fill();
        f.strokeStyle='#ffffff6b';f.lineWidth=.65;f.stroke();
      }
    }
    // Slender internal refractions and highlights give curved stems volume.
    for(let i=0;i<5;i++){
      const x=pad+rnd()*advance;
      f.strokeStyle=i%2?'#ffffffb8':'#537ab760';f.lineWidth=.7+rnd();f.beginPath();
      f.moveTo(x,35);f.bezierCurveTo(x-8,72,x+13,129,x-2,186);f.stroke();
    }
    f.globalCompositeOperation='source-over';c.drawImage(face,0,0);
    c.lineWidth=.7;c.strokeStyle='#ffffffec';c.strokeText(char,pad-.65,baseline-.8);
    return{sprite,mask,advance};
  }
function backdrop(t){
    ctx.fillStyle='#edf2f5';ctx.fillRect(0,0,width,height);
    const colors=[['#d5c7ed80',.22,.4],['#b1e7e280',.78,.6],['#ffe6da70',.86,.12]];
    colors.forEach(([color,x,y],i)=>{
      const gx=width*(x+Math.sin(t*.13+i)*.06),gy=height*y;
      const g=ctx.createRadialGradient(gx,gy,0,gx,gy,width*.65);g.addColorStop(0,color);g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
    });
    // An opalescent silk ribbon crosses the scene, with moving caustic filaments.
    ctx.save();ctx.translate(width*.5,height*.58);ctx.rotate(-.43);
    for(let i=0;i<21;i++){
      const phase=t*.33+i*.09;
      ctx.beginPath();ctx.moveTo(-width*.67,-22+i*2.7);
      ctx.bezierCurveTo(-width*.12,-132+Math.sin(phase)*12,width*.11,127+Math.cos(phase)*14,width*.67,-32+i*2.7);
      ctx.strokeStyle=gradient(ctx,[[0,'#99e4de00'],[.18,'#95cbc21c'],[.43,i%4===0?'#ffffffbc':'#bbadce28'],[.7,'#9bded438'],[1,'#cbb7e400']],-width*.5,0,width*.5,0);
      ctx.lineWidth=i%4===0?1.2:3;ctx.stroke();
    }
    ctx.restore();
    // Soft ground shadow sits below the word rather than acting as a text outline.
    const floor=ctx.createRadialGradient(width*.5,height*.79,0,width*.5,height*.79,width*.3);
    floor.addColorStop(0,'#95a8bf21');floor.addColorStop(1,'#95a8bf00');ctx.save();ctx.translate(0,height*.79);ctx.scale(1,.16);ctx.translate(0,-height*.79);ctx.fillStyle=floor;ctx.fillRect(0,0,width,height*4);ctx.restore();
  }
function litGlyph(g,x,y,scale,rotation,alpha,phase){
    ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(scale,scale);ctx.globalAlpha*=alpha;
    ctx.drawImage(g.sprite,-pad,-baseline);
    opt.clearRect(0,0,optical.width,optical.height);opt.drawImage(g.mask,0,0);opt.globalCompositeOperation='source-in';
    const offset=pad+g.advance*(.5+.5*Math.sin(phase)) +pointer.x*12;
    opt.fillStyle=gradient(opt,[[0,'#ffffff00'],[.25,'#80dbe930'],[.45,'#faffffbd'],[.51,'#faffffe8'],[.58,'#ddadf176'],[.8,'#ffffff00']],offset-42,0,offset+42,43);
    opt.fillRect(0,0,optical.width,optical.height);opt.globalCompositeOperation='source-over';
    ctx.globalCompositeOperation='screen';ctx.globalAlpha*=.56*settings.refraction;ctx.drawImage(optical,-pad,-baseline);ctx.restore();
  }
function fragmentedGlyph(g,x,y,scale,age,index,exit){
 if(age<0)return;
 const p=clamp(age/(.20/(settings.entrySpeed||1)),0,1),ease=1-Math.pow(1-p,3),power=settings.power??1;
 litGlyph(g,x,y+(1-ease)*8*scale*power,scale,0,ease*(1-exit),time*1.5+index*.6);
 }
function renderWord(word,line,local,exit){
    const list=[...word].map(char=>glyphs.get(char)),spacing=-2.4;
    const total=list.reduce((sum,g)=>sum+g.advance+spacing,0)-spacing;
    const two=segments[active].words.length>1;
    const desired=rowFontSize(options.fontSize*(two&&line===0?.65:1),segments[active].words.length,height);
    const scale=Math.min(desired/base,(width-70)/(total+18));
    const whole=total*scale;
    const y=rowBaseline(line,segments[active].words.length,height,options.fontSize);
    // Editorial offset gives the two words separate visual rhythms.
    const start=(width-whole)*.5+(line===0&&two?-width*.055:width*.025);
    let x=start;
    list.forEach((g,i)=>{
      fragmentedGlyph(g,x,y,scale,local-(timingRows[line]?.[i]??0),i,exit);
      x+=(g.advance+spacing)*scale;
    });
    return{x:start,y,whole,scale};
  }
function glint(x,y,amount,size){
    if(amount<=0)return;ctx.save();ctx.translate(x,y);ctx.globalAlpha=amount;
    ctx.strokeStyle='#ffffff';ctx.lineWidth=1;ctx.shadowColor='#fff';ctx.shadowBlur=9;
    ctx.beginPath();ctx.moveTo(-size,0);ctx.lineTo(size,0);ctx.moveTo(0,-size);ctx.lineTo(0,size);ctx.stroke();ctx.shadowBlur=0;
    ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(0,0,1.4,0,Math.PI*2);ctx.fill();ctx.restore();
  }
 
 return {canvas,aspect:width/height,span:2.7,
  resize(w,h){canvas.width=Math.max(1,Math.round(w));canvas.height=Math.max(1,Math.round(h));},
  render(words,seconds,timings,groupIndex=0){
   active=chunkIndex=groupIndex;
   words=captionRows(words.map(w=>w),options.fontSize,font);
   timingRows=captionGlyphStarts(words,timings);
   const key=JSON.stringify([words,groupIndex]);if(key!==signature){signature=key;segments=chunks=[];segments[groupIndex]={words,cue:0};glyphs.clear();
    for(const char of new Set(words.join('')))glyphs.set(char,makeGlyph(char));
   }
   time=seconds+groupIndex*2.7;ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);ctx.clearRect(0,0,width,height);
   {const local=seconds,exit=reduced.matches?0:0;
    if(options.backdrop)backdrop(time);
    const words=segments[active].words;
    const rendered=words.map((word,i)=>renderWord(word,i,local,exit));
    const main=rendered[rendered.length-1];
    if(!reduced.matches){
      const flash=clamp(1-Math.abs(local-1.65)*5,0,1)*(1-exit);
      glint(main.x+main.whole*.73,main.y-main.scale*base*.47,flash,12);
      glint(main.x+main.whole*.24,main.y-main.scale*base*.20,flash*.45,7);
    }
    }
  },dispose(){glyphs.clear();canvas.width=canvas.height=1;}
 };
}
