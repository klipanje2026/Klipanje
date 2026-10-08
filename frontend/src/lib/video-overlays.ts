export type Overlay = {id:string; kind:'text'|'rect'|'ellipse'|'arrow'|'heart'|'star'; text:string; color:string; background:string; x:number; y:number; width:number; height:number; rotation:number; opacity:number; start:number; end:number; bold:boolean; fontFamily?:string; fontSize?:number; italic?:boolean; underline?:boolean; align?:'left'|'center'|'right'; uppercase?:boolean; lineHeight?:number; strokeColor?:string; strokeWidth?:number; shadowColor?:string; shadowBlur?:number; shadowOffset?:number; verticalAlign?:'top'|'middle'|'bottom'; verticalText?:boolean; letterSpacing?:number; backgroundOpacity?:number; shadowOpacity?:number; shadowDistance?:number; shadowAngle?:number; glow?:boolean; animation?:'none'|'fade'|'rise'|'pop'|'slide'|'typewriter'; animationDuration?:number};
export type OverlayPreset = {id:string; category:string; name:string; symbol:string; value:Partial<Overlay>};
export const overlayPresets:OverlayPreset[] = [
 {id:'subtitle',category:'Naslovi',name:'Podnaslov',symbol:'Priča',value:{kind:'text',text:'Mala ideja. Velika priča.',bold:false,height:12}},
 {id:'note',category:'Oznake',name:'Napomena',symbol:'Info',value:{kind:'text',text:'Dobro je znati',background:'#246b72',width:50,height:12}},
 {id:'banner',category:'Oblici',name:'Traka',symbol:'━',value:{kind:'rect',color:'#7256cc',width:80,height:8}},
 {id:'down',category:'Strelice',name:'Dolje',symbol:'↓',value:{kind:'arrow',rotation:90,color:'#e990cf',width:30,height:12}},
 {id:'wow',category:'Naljepnice',name:'Wow',symbol:'WOW!',value:{kind:'text',text:'WOW!',color:'#ffcc52',bold:true,width:40,height:20}},
 {id:'title',category:'Naslovi',name:'Veliki naslov',symbol:'Naslov',value:{kind:'text',text:'Tvoj naslov',bold:true}},
 {id:'simple',category:'Naslovi',name:'Čisti tekst',symbol:'Tekst',value:{kind:'text',text:'Tvoja priča počinje ovdje',bold:false}},
 {id:'highlight',category:'Naslovi',name:'Istaknuti naslov',symbol:'Istakni',value:{kind:'text',text:'Vrijedi pogledati',color:'#171717',background:'#d7fa52',bold:true}},
 {id:'name',category:'Oznake',name:'Ime govornika',symbol:'Ime Prezime',value:{kind:'text',text:'Ime i prezime',background:'#171717',y:80,height:10,width:55}},
 {id:'cta',category:'Oznake',name:'Poziv na akciju',symbol:'Prati me',value:{kind:'text',text:'Prati za više',background:'#7256cc',height:12,width:50}},
 {id:'sale',category:'Oznake',name:'Ponuda',symbol:'−20%',value:{kind:'text',text:'−20%',background:'#ef5565',width:30,height:15}},
 {id:'rect',category:'Oblici',name:'Pravougaonik',symbol:'▰',value:{kind:'rect',color:'#8060d6',width:40,height:20}},
 {id:'circle',category:'Oblici',name:'Krug',symbol:'●',value:{kind:'ellipse',color:'#52c9cc',width:25,height:25}},
 {id:'square',category:'Oblici',name:'Kvadrat',symbol:'■',value:{kind:'rect',color:'#f2bc56',width:25,height:25}},
 {id:'right',category:'Strelice',name:'Desno',symbol:'➜',value:{kind:'arrow',color:'#f2bc56',width:35,height:15}},
 {id:'left',category:'Strelice',name:'Lijevo',symbol:'←',value:{kind:'arrow',rotation:180,color:'#52c9cc',width:35,height:15}},
 {id:'up',category:'Strelice',name:'Gore',symbol:'↑',value:{kind:'arrow',rotation:-90,color:'#e990cf',width:30,height:12}},
 {id:'heart',category:'Naljepnice',name:'Srce',symbol:'♥',value:{kind:'heart',color:'#f2678b',width:25,height:25}},
 {id:'star',category:'Naljepnice',name:'Zvijezda',symbol:'★',value:{kind:'star',color:'#ffcc52',width:25,height:25}},
 {id:'love',category:'Naljepnice',name:'Love',symbol:'love',value:{kind:'text',text:'love',color:'#f6a2ca',bold:true,width:40,height:20}},
];
export function createOverlay(preset:OverlayPreset,time:number,duration:number):Overlay {
 const start=Math.min(time,Math.max(0,duration-.1));
 return {id:crypto.randomUUID(),kind:'text',text:'Tvoj tekst',color:'#ffffff',background:'transparent',x:50,y:50,width:65,height:18,rotation:0,opacity:100,start,end:Math.min(duration,start+5),bold:true,...preset.value};
}
export function restoreOverlays(value:unknown):Overlay[] {
 if(!Array.isArray(value))return [];
 return value.filter((o):o is Overlay=>!!o&&typeof o.id==='string'&&['text','rect','ellipse','arrow','heart','star'].includes(o.kind)&&typeof o.text==='string'&&typeof o.color==='string'&&typeof o.background==='string'&&[o.x,o.y,o.width,o.height,o.rotation,o.opacity,o.start,o.end].every(Number.isFinite)&&o.width>0&&o.height>0&&o.end>o.start);
}
export function drawOverlays(ctx:CanvasRenderingContext2D,items:Overlay[],time:number) {
 for(const o of items){
  if(time<o.start||time>=o.end)continue;
  const w=ctx.canvas.width*o.width/100,h=ctx.canvas.height*o.height/100;
  const motion=overlayMotion(o,time);
  ctx.save();ctx.translate(ctx.canvas.width*(o.x+motion.x)/100,ctx.canvas.height*(o.y+motion.y)/100);ctx.rotate(o.rotation*Math.PI/180);ctx.scale(motion.scale,motion.scale);ctx.globalAlpha=o.opacity/100*motion.alpha;ctx.fillStyle=o.color;
  if(o.kind==='text'){
   if(o.background!=='transparent'){ctx.save();ctx.globalAlpha*=(o.backgroundOpacity??100)/100;ctx.fillStyle=o.background;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,Math.min(h*.16,12));ctx.fill();ctx.restore();}
   const scale=ctx.canvas.width/1280;
   let size=o.fontSize?o.fontSize*scale:Math.min(h*.65/o.text.split('\n').length,ctx.canvas.width*.07);
   const font=()=>`${o.italic?'italic ':''}${o.bold?700:450} ${size}px ${o.fontFamily||'"Manrope Variable",sans-serif'}`;
   ctx.font=font();ctx.letterSpacing=`${(o.letterSpacing||0)*scale}px`;
   const content=o.uppercase?o.text.toLocaleUpperCase():o.text;
   const revealed=motion.characters===undefined?content:Array.from(content).slice(0,motion.characters).join('');
   const text=o.verticalText?Array.from(revealed).join('\n'):revealed;
   const wrap=()=>text.split('\n').flatMap(paragraph=>{
    const lines:string[]=[];let line='';
    for(const word of paragraph.split(' ')){
     const candidate=line?line+' '+word:word;
     if(line&&ctx.measureText(candidate).width>w*.92){lines.push(line);line='';}
     // Split long words too, so side resizing never stretches glyphs.
     for(const char of (line?' ':'')+word){if(line&&ctx.measureText(line+char).width>w*.92){lines.push(line);line='';}line+=char;}
    }
    lines.push(line);return lines;
   });
   let lines=wrap();const spacing=o.lineHeight||1.2;
   for(let n=0;n<8&&lines.length*size*spacing>h*.92;n++){size*=Math.min(.9,h*.92/(lines.length*size*spacing));ctx.font=font();lines=wrap();}
   ctx.fillStyle=o.color;ctx.textAlign=o.align||'center';ctx.textBaseline='middle';ctx.lineJoin='round';
   const x=o.align==='left'?-w*.46:o.align==='right'?w*.46:0;
   ctx.strokeStyle=o.strokeColor||'#171717';ctx.lineWidth=(o.strokeWidth||0)*scale;
   ctx.shadowColor=shadowRgba(o.shadowColor||'#171717',o.shadowOpacity??100);ctx.shadowBlur=(o.glow?Math.max(16,o.shadowBlur||0):(o.shadowBlur||0))*scale;
   const distance=o.shadowDistance??Math.SQRT2*(o.shadowOffset||0),angle=(o.shadowAngle??45)*Math.PI/180;
   ctx.shadowOffsetX=o.glow?0:distance*Math.cos(angle)*scale;ctx.shadowOffsetY=o.glow?0:distance*Math.sin(angle)*scale;
   lines.forEach((line,i)=>{const total=(lines.length-1)*size*spacing;const origin=o.verticalAlign==='top'?-h*.46+size/2:o.verticalAlign==='bottom'?h*.46-size/2-total:-total/2;const y=origin+i*size*spacing;
    if(ctx.lineWidth&&o.strokeWidth)ctx.strokeText(line,x,y);
    ctx.fillText(line,x,y);
    if(o.underline){const tw=ctx.measureText(line).width;const left=o.align==='left'?x:o.align==='right'?x-tw:x-tw/2;ctx.fillRect(left,y+size*.48,tw,Math.max(1,size*.055));}
   });
  }else{
   ctx.scale(w,h);ctx.beginPath();
   if(o.kind==='rect')ctx.rect(-.5,-.5,1,1);
   if(o.kind==='ellipse')ctx.ellipse(0,0,.5,.5,0,0,Math.PI*2);
   if(o.kind==='arrow'){ctx.moveTo(-.5,-.16);ctx.lineTo(.12,-.16);ctx.lineTo(.12,-.5);ctx.lineTo(.5,0);ctx.lineTo(.12,.5);ctx.lineTo(.12,.16);ctx.lineTo(-.5,.16);ctx.closePath();}
   if(o.kind==='heart'){ctx.moveTo(0,.5);ctx.bezierCurveTo(-1,-.12,-.35,-.8,0,-.3);ctx.bezierCurveTo(.35,-.8,1,-.12,0,.5);}
   if(o.kind==='star'){for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?.22:.5;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();}
   ctx.fill();
  }
  ctx.restore();
 }
}

export type OverlayHandle='n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw';
/** Resize around the opposite edge, including rotated boxes. Deltas are stage pixels. */
export function resizeOverlay(o:Overlay,edge:OverlayHandle,dx:number,dy:number,stageWidth:number,stageHeight:number):Overlay {
 const angle=o.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 const localX=dx*c+dy*s,localY=-dx*s+dy*c;
 const originalW=o.width/100*stageWidth,originalH=o.height/100*stageHeight;
 const sx=edge.includes('e')?1:edge.includes('w')?-1:0,sy=edge.includes('s')?1:edge.includes('n')?-1:0;
 const w=sx?Math.max(stageWidth*.03,Math.min(stageWidth*1.5,originalW+sx*localX)):originalW;
 const h=sy?Math.max(stageHeight*.03,Math.min(stageHeight*1.5,originalH+sy*localY)):originalH;
 const shiftX=sx*(w-originalW)/2,shiftY=sy*(h-originalH)/2;
 return {...o,fontSize:o.fontSize&&sx&&sy?Math.max(12,Math.min(240,o.fontSize*Math.min(w/originalW,h/originalH))):o.fontSize,width:w/stageWidth*100,height:h/stageHeight*100,x:o.x+(shiftX*c-shiftY*s)/stageWidth*100,y:o.y+(shiftX*s+shiftY*c)/stageHeight*100};
}

/** Time-based animation shared by preview, selection bounds and export. */
export function overlayMotion(o:Overlay,time:number) {
 const animation=o.animation||(o.kind==='text'?'fade':'none');
 const duration=Math.max(.1,Math.min(o.animationDuration||.6,o.end-o.start));
 const p=Math.max(0,Math.min(1,(time-o.start)/duration)),ease=1-Math.pow(1-p,3);
 return {alpha:animation==='none'||animation==='typewriter'?1:ease,
  x:animation==='slide'?-8*(1-ease):0,y:animation==='rise'?6*(1-ease):0,
  scale:animation==='pop'?.65+.35*ease:1,
  characters:animation==='typewriter'?Math.floor(Array.from(o.text).length*p):undefined};
}

export function shadowRgba(hex:string,opacity:number){
 const match=/^#([a-f0-9]{6})$/i.exec(hex);if(!match)return hex;
 const n=parseInt(match[1],16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${Math.max(0,Math.min(100,opacity))/100})`;
}
export function rotatedOverlayAngle(rotation:number,startAngle:number,nextAngle:number){
 const delta=Math.atan2(Math.sin(nextAngle-startAngle),Math.cos(nextAngle-startAngle))*180/Math.PI;
 return Math.round(((rotation+delta+180)%360+360)%360-180);
}
