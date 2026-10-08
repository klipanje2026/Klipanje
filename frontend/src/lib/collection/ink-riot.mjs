import {captionRows,rowBaseline,rowFontSize} from './caption-layout.mjs';
/** ink-riot: original painting functions; UI, demo clock and host messaging removed. */
export function createArtwork(canvas,options={}){
 const ctx=canvas.getContext('2d'),reduced={matches:false};
 const settings={...{splatters:true,speed:1},...options};
 const width=736,height=480,glyphs=new Map();
 let time=0,active=0,chunkIndex=0,segments=[],chunks=[],signature='';
 const font="160px Knewave, Impact";
 let paper=null;
const base=160;
const pad=36;
const baseline=187;
const measure=document.createElement('canvas').getContext('2d');
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function rnd(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function surface(w,h){const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;}
function gradient(c,stops,x,y,x2,y2){const g=c.createLinearGradient(x,y,x2,y2);stops.forEach(([p,color])=>g.addColorStop(p,color));return g;}
function polygon(c,points){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
function makePaper(){
    const p=surface(width,height),c=p.getContext('2d'),random=rnd(990);
    c.fillStyle='#e9e1cb';c.fillRect(0,0,width,height);
    const g=gradient(c,[[0,'#fff9e34d'],[.6,'#e3d5b11a'],[1,'#bba88c26']],0,0,width,height);c.fillStyle=g;c.fillRect(0,0,width,height);
    for(let i=0;i<8500;i++){
      const x=random()*width,y=random()*height;
      c.fillStyle=i%3===0?'#ffffff46':'#77685415';c.fillRect(x,y,.3+random()*1.8,.2+random()*.9);
    }
    for(let i=0;i<320;i++){
      const x=random()*width,y=random()*height;c.beginPath();c.moveTo(x,y);c.lineTo(x+2+random()*5,y+random()*2);c.strokeStyle='#9f947d13';c.lineWidth=.5;c.stroke();
    }
    // Old paper folds have a bright lip and a soft recessed edge.
    c.beginPath();c.moveTo(width*.77,-10);c.lineTo(width*.71,height);c.strokeStyle='#ad9d8530';c.lineWidth=2;c.stroke();
    c.beginPath();c.moveTo(width*.77+2,-10);c.lineTo(width*.71+2,height);c.strokeStyle='#fffce54d';c.lineWidth=1;c.stroke();
    return p;
  }
function makeGlyph(char,hero){
    const accent=char==='Č'?'caron':char==='Ć'?'acute':null;
    if(accent)char='C';
    measure.font=font;const advance=measure.measureText(char).width;
    const sprite=surface(advance+pad*2+25,258),c=sprite.getContext('2d');c.font=font;c.lineJoin='round';
    if(hero){
      // Two separate print plates and the hard ink shadow give the paint a relief.
      c.strokeStyle='#26283e';c.fillStyle='#26283e';c.lineWidth=6;c.strokeText(char,pad+6,baseline+9);c.fillText(char,pad+6,baseline+9);
      c.strokeStyle='#40a6a6';c.fillStyle='#40a6a6';c.lineWidth=5;c.strokeText(char,pad-4,baseline+2);c.fillText(char,pad-4,baseline+2);
      c.strokeStyle='#27293b';c.lineWidth=3.5;c.strokeText(char,pad,baseline);
    }
    const face=surface(sprite.width,sprite.height),f=face.getContext('2d');f.font=font;
    f.fillStyle=hero?gradient(f,[[0,'#ff9761'],[.30,'#f96260'],[.65,'#ee3969'],[1,'#c72d60']],0,60,12,204):'#fff0cc';
    f.fillText(char,pad,baseline);f.globalCompositeOperation='source-atop';
    const random=rnd(char.codePointAt(0)*733+(hero?331:15));
    for(let i=0;i<1150;i++){
      const x=pad-3+random()*(advance+8),y=45+random()*155;
      f.fillStyle=hero?(i%3?'#43243430':'#ffe6b154'):(i%3?'#8d807735':'#ffffff58');
      f.fillRect(x,y,.25+random()*1.6,.2+random()*1.2);
    }
    // Visible dry-brush ridges, with an occasional exposed paper fibre.
    for(let i=0;i<65;i++){
      const x=pad+random()*advance,y=48+random()*145;
      f.beginPath();f.moveTo(x,y);f.lineTo(x+random()*10+2,y-random()*16-4);
      f.strokeStyle=hero?(i%4?'#64273d26':'#ffe8c469'):'#75656b45';f.lineWidth=random()*1.2+.25;f.stroke();
    }
    // A coarse silkscreen dot pattern lives only in the lower part of the face.
    if(hero){
      for(let y=129;y<202;y+=5)for(let x=pad-3;x<pad+advance+3;x+=5){
        f.beginPath();f.arc(x+(y%10?2:0),y,.35+(y-129)/105,0,Math.PI*2);f.fillStyle='#4c274444';f.fill();
      }
    }
    f.globalCompositeOperation='destination-out';
    for(let i=0;i<32;i++){
      const x=pad+random()*advance,y=51+random()*145;f.fillStyle='#0000008a';f.fillRect(x,y,random()*2+.3,random()*4+.5);
    }
    f.globalCompositeOperation='source-over';c.drawImage(face,0,0);
    if(hero){c.strokeStyle='#ffb69583';c.lineWidth=.65;c.strokeText(char,pad-.8,baseline-1);}
    if(accent){
      const center=pad+advance*.52,y=baseline-base*.92;
      c.save();c.strokeStyle=hero?'#f96260':'#fff0cc';c.lineWidth=base*.05;c.lineCap='round';c.lineJoin='round';c.beginPath();
      if(accent==='caron'){c.moveTo(center-base*.11,y-base*.13);c.lineTo(center,y-base*.06);c.lineTo(center+base*.11,y-base*.13);}
      else{c.moveTo(center-base*.04,y-base*.06);c.lineTo(center+base*.08,y-base*.16);}
      c.stroke();c.restore();
    }
    return{sprite,advance};
  }
function brush(c,x,y,w,h,color,progress,seed=1){
    if(progress<=0)return;const random=rnd(seed);
    c.save();c.translate(x,y);const originalAlpha=c.globalAlpha;
    for(let i=0;i<34;i++){
      const yy=(i/34-.5)*h,length=w*(.82+random()*.18)*progress;
      c.beginPath();c.moveTo(-w*.5+random()*6,yy);c.bezierCurveTo(-w*.1,yy+Math.sin(i)*1.5,length*.25,yy-2,-w*.5+length,yy+random()*2);
      c.strokeStyle=color;c.globalAlpha=originalAlpha*(.5+random()*.4);c.lineWidth=h/34*(.8+random());c.stroke();
    }
    c.restore();
  }
function backdrop(){
    if(paper)ctx.drawImage(paper,0,0);else{ctx.fillStyle='#e9e1cb';ctx.fillRect(0,0,width,height);}
    // Collage washes stay behind the type and stop at the edge of the poster.
    ctx.save();ctx.translate(width*.09,height*.73);ctx.rotate(-.32);brush(ctx,0,0,width*.25,48,'#4eaaa049',1,421);ctx.restore();
    ctx.save();ctx.translate(width*.92,height*.22);ctx.rotate(-.6);brush(ctx,0,0,width*.23,58,'#f4736833',1,174);ctx.restore();
    const random=rnd(177);
    ctx.fillStyle='#4c495910';
    for(let i=0;i<120;i++){
      const x=random()*width,y=random()*height;if(x>width*.2&&x<width*.8&&y>height*.18&&y<height*.8)continue;
      ctx.beginPath();ctx.arc(x,y,random()*1.1+.3,0,Math.PI*2);ctx.fill();
    }
    ctx.save();ctx.translate(width*.87,height*.84);ctx.rotate(-.13);ctx.strokeStyle='#5754484a';ctx.lineWidth=.75;
    for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(-18+i*8,-13);ctx.lineTo(-8+i*8,12);ctx.stroke();}ctx.restore();
  }
function tornStrip(w,h){
    const random=rnd(123);const points=[];
    for(let i=0;i<=20;i++)points.push([-w*.5+i*w/20,-h*.5+(random()-.5)*5]);
    for(let i=20;i>=0;i--)points.push([-w*.5+i*w/20,h*.5+(random()-.5)*6]);
    polygon(ctx,points);ctx.shadowColor='#2a24332b';ctx.shadowBlur=9;ctx.shadowOffsetY=6;ctx.fillStyle='#292b3c';ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.strokeStyle='#f7e8c4';ctx.lineWidth=.8;ctx.globalAlpha*=.65;ctx.stroke();ctx.globalAlpha=1;
    const r=rnd(131);ctx.fillStyle='#fff6df12';
    for(let i=0;i<150;i++)ctx.fillRect((r()-.5)*w,(r()-.5)*h,r()*1.5+.3,.5);
  }
function inkSplash(age,x,y,seed){
    if(!settings.splatters||reduced.matches||age<0||age>1.7)return;
    const random=rnd(seed);ctx.save();
    for(let i=0;i<21;i++){
      const angle=random()*Math.PI*2,speed=18+random()*65;
      const travel=1-Math.exp(-age*6),xx=x+Math.cos(angle)*speed*travel,yy=y+Math.sin(angle)*speed*travel+age*7;
      ctx.globalAlpha=Math.min(1,age*13)*clamp((1.7-age)/.35,0,1)*(.5+random()*.35);
      ctx.fillStyle=i%3===0?'#29898e':i%3===1?'#e64b6d':'#323344';
      ctx.beginPath();ctx.ellipse(xx,yy,random()*2.3+.6,random()*1.4+.4,angle,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
function renderWord(word,line,local,exit){
    const two=segments[active].words.length>1,hero=!two||line===segments[active].words.length-1;
    const list=[...word].map(char=>glyphs.get(char+':'+(hero?'1':'0'))),spacing=-2;
    const total=list.reduce((sum,g)=>sum+g.advance+spacing,0)-spacing;
    const scale=Math.min(rowFontSize(options.fontSize*(hero?1:.65),segments[active].words.length,height)/base,(width-66)/(total+33));
    const full=total*scale,centerX=width*.5+(hero?width*.02:-width*.06);
    const y=rowBaseline(line,segments[active].words.length,height,options.fontSize);
    const age=local-(hero?.35:.02);
    const p=reduced.matches?1:clamp(age/.52,0,1);
    const spring=reduced.matches?0:Math.exp(-7*p)*Math.cos(12*p)*(p<1?1:0)*(settings.power??1);
    const angle=(hero?.025:-.09)+(reduced.matches?0:spring*(hero?-.14:.24))+exit*.5;
    const alpha=reduced.matches?1:clamp(age/.09,0,1)*(1-exit);
    ctx.save();ctx.translate(centerX+exit*width*.18,y-spring*(hero?24:80)-exit*34);ctx.rotate(angle);
    ctx.scale(1+spring*.12,1-spring*.25);ctx.globalAlpha=alpha;
    if(!hero){
      ctx.save();ctx.translate(0,-46*scale);tornStrip(full+26,95*scale+15);ctx.restore();
    }
    let x=-full*.5;
    list.forEach((g,i)=>{
      const letterAge=age-Math.min(i*.035,.55);
      const reveal=reduced.matches?1:clamp((letterAge+.1)/.36,0,1);
      const settle=reduced.matches?0:Math.exp(-Math.max(0,letterAge)*10)*Math.sin(Math.max(0,letterAge)*20)*3;
      ctx.save();ctx.translate(x,-settle);ctx.scale(scale,scale);ctx.rotate((i%3-1)*.012);
      if(hero&&reveal<1){
        // Uneven bristle edges expose the painted letter progressively.
        ctx.beginPath();ctx.moveTo(-pad,-baseline);
        for(let row=0;row<=12;row++)ctx.lineTo(-pad+(g.sprite.width)*reveal+(row%3-1)*4,-baseline+row*g.sprite.height/12);
        ctx.lineTo(-pad,g.sprite.height-baseline);ctx.closePath();ctx.clip();
      }
      ctx.drawImage(g.sprite,-pad,-baseline);ctx.restore();x+=(g.advance+spacing)*scale;
    });
    if(hero){
      const stroke=reduced.matches?1:clamp((age-.36)/.48,0,1);
      brush(ctx,0,20*scale+13,full*.91,11*scale+3,'#282b3b',stroke,831);
      brush(ctx,full*.13,26*scale+17,full*.55,3*scale+1,'#2d9299',stroke,163);
    }
    ctx.restore();
    if(hero){inkSplash(age-.16,centerX-full*.33,y-base*scale*.3,word.codePointAt(0)*237);inkSplash(age-.29,centerX+full*.36,y-base*scale*.58,word.codePointAt(0)*723);}
  }
 paper=makePaper();
 return {canvas,aspect:width/height,span:3,
  resize(w,h){canvas.width=Math.max(1,Math.round(w));canvas.height=Math.max(1,Math.round(h));},
  render(words,seconds,_timings,groupIndex=0){
   active=chunkIndex=groupIndex;
   words=captionRows(words.map(w=>w.toLocaleUpperCase('hr')),options.fontSize,font);
   const key=JSON.stringify([words,groupIndex]);if(key!==signature){signature=key;segments=chunks=[];segments[groupIndex]={words,cue:0};glyphs.clear();
    words.forEach((word,line)=>{const hero=words.length===1||line===words.length-1;for(const char of word)glyphs.set(char+':'+(hero?'1':'0'),makeGlyph(char,hero));});
   }
   time=seconds+groupIndex*3;ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);ctx.clearRect(0,0,width,height);
   {const local=seconds,exit=reduced.matches?0:clamp((local-2.66)/.34,0,1);
    if(options.backdrop)backdrop();
    const camera=reduced.matches?0:Math.exp(-Math.max(0,local-.36)*17)*Math.sin(Math.max(0,local-.36)*60)*1.6;
    ctx.save();ctx.translate(camera,-camera*.5);segments[active].words.forEach((word,i)=>renderWord(word,i,local,exit));ctx.restore();
    }
  },dispose(){glyphs.clear();canvas.width=canvas.height=1;}
 };
}
