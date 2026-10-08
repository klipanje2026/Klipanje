import {captionRows,rowBaseline,rowFontSize,captionGlyphStarts} from './caption-layout.mjs';
/** laser-trace: original painting functions; UI, demo clock and host messaging removed. */
export function createArtwork(canvas,options={}){
 const ctx=canvas.getContext('2d'),reduced={matches:false};
 const settings={...{glow:1,arcs:true,speed:1},...options};
 const width=736,height=470,glyphs=new Map();
 let time=0,active=0,chunkIndex=0,segments=[],chunks=[],signature='',timingRows=[];
 const font="700 110px Orbitron, sans-serif";
 const base=110;
const pad=14;
const baseline=125;
const measure=document.createElement('canvas').getContext('2d');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const plasma=surface(240,157);
const pctx=plasma.getContext('2d');
 function random(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function surface(w,h){const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;}
function extractContours(data,w,h){
    const cases={1:[[2,3]],2:[[1,2]],3:[[1,3]],4:[[0,1]],5:[[0,1],[2,3]],6:[[0,2]],7:[[0,3]],8:[[0,3]],9:[[0,2]],10:[[0,3],[1,2]],11:[[0,1]],12:[[1,3]],13:[[1,2]],14:[[2,3]]};
    const edges=[],nodes=new Map();
    function add(a,b){const i=edges.length;edges.push({a,b,used:false});for(const p of[a,b]){const key=p.join(',');if(!nodes.has(key))nodes.set(key,[]);nodes.get(key).push(i);}}
    for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){
      const tl=data[(y*w+x)*4+3]>127,tr=data[(y*w+x+1)*4+3]>127,br=data[((y+1)*w+x+1)*4+3]>127,bl=data[((y+1)*w+x)*4+3]>127;
      const key=(tl?8:0)+(tr?4:0)+(br?2:0)+(bl?1:0);if(!cases[key])continue;
      const p=[[x*2+1,y*2],[x*2+2,y*2+1],[x*2+1,y*2+2],[x*2,y*2+1]];
      for(const[a,b]of cases[key])add(p[a],p[b]);
    }
    const paths=[];
    for(const first of edges){
      if(first.used)continue;first.used=true;const points=[first.a,first.b];let current=first.b;
      for(let guard=0;guard<edges.length;guard++){
        const candidates=nodes.get(current.join(','))||[],next=candidates.find(i=>!edges[i].used);if(next===undefined)break;
        const edge=edges[next];edge.used=true;current=edge.a[0]===current[0]&&edge.a[1]===current[1]?edge.b:edge.a;points.push(current);
      }
      if(points.length<6)continue;
      // Remove collinear pixels while retaining the actual closed letter geometry.
      const scaled=points.map(([x,y])=>[x*.5-pad,y*.5-baseline]),simple=[scaled[0]];
      for(let i=1;i<scaled.length-1;i++){
        const a=simple[simple.length-1],b=scaled[i],c=scaled[i+1];
        if(Math.abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))>.001)simple.push(b);
      }
      simple.push(scaled[scaled.length-1]);let length=0;const lengths=[0];
      for(let i=1;i<simple.length;i++){length+=Math.hypot(simple[i][0]-simple[i-1][0],simple[i][1]-simple[i-1][1]);lengths.push(length);}
      if(length>6)paths.push({points:simple,lengths,length});
    }
    return paths.sort((a,b)=>b.length-a.length);
  }
function makeGlyph(char){
    measure.font=font;const advance=measure.measureText(char).width;
    const mask=surface(advance+pad*2+8,157),m=mask.getContext('2d',{willReadFrequently:true});m.font=font;m.fillStyle='#fff';m.fillText(char,pad,baseline);
    const image=m.getImageData(0,0,mask.width,mask.height),paths=extractContours(image.data,mask.width,mask.height);
    return{mask,paths,advance,length:paths.reduce((sum,p)=>sum+p.length,0)};
  }
function trace(g,progress){
    let budget=g.length*clamp(progress,0,1),head=null;ctx.beginPath();
    for(const path of g.paths){
      if(budget<=0)break;const points=path.points;ctx.moveTo(points[0][0],points[0][1]);head=points[0];
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],length=path.lengths[i]-path.lengths[i-1];
        if(budget>=length){ctx.lineTo(b[0],b[1]);head=b;budget-=length;}
        else{const p=length?budget/length:0;head=[a[0]+(b[0]-a[0])*p,a[1]+(b[1]-a[1])*p];ctx.lineTo(head[0],head[1]);budget=0;break;}
      }
    }
    return head;
  }
function pointAt(g,fraction){
    let budget=g.length*((fraction%1+1)%1);
    for(const path of g.paths){
      if(budget>path.length){budget-=path.length;continue;}
      for(let i=1;i<path.points.length;i++)if(path.lengths[i]>=budget){
        const a=path.points[i-1],b=path.points[i],l=path.lengths[i]-path.lengths[i-1],p=l?(budget-path.lengths[i-1])/l:0;return[a[0]+(b[0]-a[0])*p,a[1]+(b[1]-a[1])*p];
      }
    }
    return g.paths[0]?.points[0]||[0,0];
  }
function backdrop(t){
    ctx.fillStyle='#080c1c';ctx.fillRect(0,0,width,height);
    const g=ctx.createRadialGradient(width*.58,height*.5,0,width*.58,height*.5,width*.7);
    g.addColorStop(0,'#23365865');g.addColorStop(.45,'#20274d30');g.addColorStop(1,'#080c1c00');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
    // Smooth field lines bend around the typography, instead of a rectangular grid.
    ctx.save();ctx.translate(width*.5,height*.65);ctx.rotate(-.11);
    for(let i=0;i<9;i++){
      ctx.beginPath();ctx.ellipse(0,0,width*(.22+i*.037),height*(.09+i*.022),0,0,Math.PI*2);ctx.strokeStyle=i%3===0?'#5578bb13':'#76b7d00a';ctx.lineWidth=.8;ctx.stroke();
    }
    ctx.restore();
    const rnd=random(161);
    for(let i=0;i<36;i++){
      const x=rnd()*width,y=(rnd()*height-t*(2+rnd()*6)+height*20)%height;ctx.fillStyle=i%3===0?'#eca66b55':'#82dfea39';ctx.fillRect(x,y,.6+rnd(),.6+rnd());
    }
    const floor=ctx.createRadialGradient(width*.5,height*.83,0,width*.5,height*.83,width*.35);
    floor.addColorStop(0,'#4dbbd522');floor.addColorStop(1,'#4dbbd500');ctx.save();ctx.translate(0,height*.83);ctx.scale(1,.15);ctx.translate(0,-height*.83);ctx.fillStyle=floor;ctx.fillRect(0,0,width,height*4);ctx.restore();
  }
function fillPlasma(g,hero,age){
    pctx.clearRect(0,0,plasma.width,plasma.height);pctx.drawImage(g.mask,0,0);pctx.globalCompositeOperation='source-in';
    pctx.fillStyle=hero?'#48dcff0d':'#ffd0a00a';pctx.fillRect(0,0,plasma.width,plasma.height);pctx.globalCompositeOperation='source-atop';
    for(let y=24;y<147;y+=4){const brightness=.10+.12*Math.sin(age*3+y*.07);pctx.fillStyle=hero?`rgba(78,229,246,${brightness})`:`rgba(255,180,114,${brightness})`;pctx.fillRect(0,y,plasma.width,.65);}
    pctx.globalCompositeOperation='source-over';ctx.drawImage(plasma,-pad,-baseline);
  }
function glowPoint(point,color,brightness){
    const[x,y]=point,g=ctx.createRadialGradient(x,y,0,x,y,13);
    g.addColorStop(0,'#efffff');g.addColorStop(.07,'#efffff');g.addColorStop(.15,color);g.addColorStop(1,'#51ddfa00');ctx.save();ctx.globalAlpha*=brightness;ctx.fillStyle=g;ctx.fillRect(x-13,y-13,26,26);ctx.restore();
  }
function renderGlyph(g,x,y,scale,progress,hero,phase,exit,index){
    const color=hero?'#58e9f6':'#ffae76';
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.globalAlpha=1-exit;ctx.lineCap='round';ctx.lineJoin='round';
    // A rear luminous contour and connector lines make an airy 3D wire volume.
    ctx.save();ctx.translate(5,10);trace(g,1);ctx.strokeStyle=hero?'#9b80f147':'#9c5b8c36';ctx.lineWidth=1.15;ctx.stroke();ctx.restore();
    ctx.beginPath();g.paths.forEach(path=>{const stride=Math.max(1,Math.floor(path.points.length/6));for(let i=0;i<path.points.length;i+=stride){const p=path.points[i];ctx.moveTo(p[0],p[1]);ctx.lineTo(p[0]+5,p[1]+10);}});ctx.strokeStyle=hero?'#519ab728':'#ab734226';ctx.lineWidth=.7;ctx.stroke();
    fillPlasma(g,hero,phase);
    trace(g,1);ctx.strokeStyle=hero?'#45898a42':'#ae795034';ctx.lineWidth=.8;ctx.stroke();
    if(progress>0){
      trace(g,progress);ctx.strokeStyle=color;ctx.lineWidth=4.1;ctx.globalAlpha=(1-exit)*.17;ctx.shadowColor=color;ctx.shadowBlur=18*settings.glow;ctx.stroke();
      trace(g,progress);ctx.globalAlpha=(1-exit)*.8;ctx.lineWidth=1.85;ctx.shadowBlur=7*settings.glow;ctx.stroke();
      trace(g,progress);ctx.globalAlpha=(1-exit)*.9;ctx.strokeStyle=hero?'#d3ffff':'#ffedcf';ctx.lineWidth=.62;ctx.shadowBlur=0;ctx.stroke();
      if(!reduced.matches){
        const head=pointAt(g,progress<1?progress:.07+phase*.13+index*.11);
        glowPoint(head,color,progress<1?1:.62);
        // Fading pearls follow the exact contour behind the laser head.
        for(let i=1;i<6;i++){const p=pointAt(g,(progress<1?progress:.07+phase*.13+index*.11)-i*.013);ctx.globalAlpha=(1-exit)*(.7-i*.1);ctx.fillStyle=color;ctx.beginPath();ctx.arc(p[0],p[1],.7,0,Math.PI*2);ctx.fill();}
      }
    }
    ctx.restore();
  }
function electricArc(x,y,length,phase){
    if(!settings.arcs||reduced.matches)return;
    ctx.save();ctx.translate(x,y);ctx.beginPath();ctx.moveTo(0,0);
    for(let i=1;i<=12;i++){const xx=i/12*length,amp=Math.sin(i/12*Math.PI)*3.3;ctx.lineTo(xx,Math.sin(i*13.4+phase*2)*amp);}
    ctx.strokeStyle='#63ddec';ctx.shadowColor='#4acaff';ctx.shadowBlur=9*settings.glow;ctx.lineWidth=.6;ctx.globalAlpha=.38;ctx.stroke();ctx.restore();
  }
function renderWord(word,line,local,exit){
    const two=segments[active].words.length>1,hero=!two||line===segments[active].words.length-1,list=[...word].map(char=>glyphs.get(char)),spacing=5;
    const total=list.reduce((sum,g)=>sum+g.advance+spacing,0)-spacing;
    const scale=Math.min(rowFontSize(options.fontSize*(hero?1:.65),segments[active].words.length,height)/base,(width-65)/(total+14));
    const whole=total*scale,baseY=rowBaseline(line,segments[active].words.length,height,options.fontSize);
    const tilt=reduced.matches?0:Math.sin(time*.35)*.012*(settings.power??1);
    ctx.save();ctx.translate(width*.5,baseY-exit*18);ctx.rotate(tilt);let x=-whole*.5-2*scale;
    list.forEach((g,i)=>{
      const age=local-(timingRows[line]?.[i]??0),progress=reduced.matches?1:clamp(age/(.22/(settings.entrySpeed||1)),0,1);
      if(age>=0)renderGlyph(g,x,0,scale,progress,hero,time+i*.2,exit,i);x+=(g.advance+spacing)*scale;
    });
    if(hero&&local>.6)electricArc(-whole*.48,18*scale,whole*.96,local);
    ctx.restore();
  }
 
 return {canvas,aspect:width/height,span:3.2,
  resize(w,h){canvas.width=Math.max(1,Math.round(w));canvas.height=Math.max(1,Math.round(h));},
  render(words,seconds,timings,groupIndex=0){
   active=chunkIndex=groupIndex;
   words=captionRows(words.map(w=>w.toLocaleUpperCase('hr')),options.fontSize,font);
   timingRows=captionGlyphStarts(words,timings);
   const key=JSON.stringify([words,groupIndex]);if(key!==signature){signature=key;segments=chunks=[];segments[groupIndex]={words,cue:0};glyphs.clear();
    for(const char of new Set(words.join('')))glyphs.set(char,makeGlyph(char));
   }
   time=seconds+groupIndex*3.2;ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);ctx.clearRect(0,0,width,height);
   {const local=seconds,exit=reduced.matches?0:0;if(options.backdrop)backdrop(time);
    segments[active].words.forEach((word,i)=>renderWord(word,i,local,exit));
    }
  },dispose(){glyphs.clear();canvas.width=canvas.height=1;}
 };
}
