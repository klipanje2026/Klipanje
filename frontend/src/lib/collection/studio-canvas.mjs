/** Canvas port of the supplied typography. Browser layout measures balanced lines;
 * all visible pixels and deterministic transitions use the shared Canvas pipeline. */
import {createStudioLayout} from './studio-layout.mjs';
import {createDepthStage} from './studio-depth.mjs';
const clamp=n=>Math.max(0,Math.min(1,n)),W=736,H=360;
function bezier(t,x1,y1,x2,y2){const c=(p,a,b)=>3*(1-p)**2*p*a+3*(1-p)*p*p*b+p**3;let lo=0,hi=1,p=t;for(let i=0;i<18;i++){p=(lo+hi)/2;if(c(p,x1,x2)<t)lo=p;else hi=p;}return c(p,y1,y2);}
const profiles={
 depth:{font:'Barlow Condensed',weight:800,size:54,line:1.1,tracking:.2,accent:'#d9ff61',margin:.075},
 karaoke:{font:'DM Sans',weight:700,size:42,line:1.45,tracking:-1.5,accent:'#c0ed58',margin:.015,padding:.09},
 cinema:{font:'Playfair Display',weight:600,size:41,line:1.25,tracking:-1,accent:'#e6c87b',margin:.075},
 neon:{font:'Barlow Condensed',weight:700,size:54,line:1.1,tracking:1,accent:'#c884ff',margin:.075},
 'pop-punch':{font:'Barlow Condensed',weight:900,size:52,line:1.34,tracking:0,accent:'#e8ff5c',margin:.01,padding:.09},
 glass:{font:'DM Sans',weight:500,size:33,line:1.4,tracking:-.7,accent:'#c3fbff',margin:.04},
};
const color=s=>{let v=s.replace('#','');if(v.length===3||v.length===4)v=[...v].map(c=>c+c).join('');return[parseInt(v.slice(0,2),16),parseInt(v.slice(2,4),16),parseInt(v.slice(4,6),16),v.length===8?parseInt(v.slice(6,8),16)/255:1];};
const rgba=v=>`rgba(${v.slice(0,3).map(Math.round).join(',')},${clamp(v[3])})`;
const mix=(a,b,t)=>Array.isArray(a)?a.map((v,i)=>v+(b[i]-v)*t):a+(b-a)*t;
function rounded(c,x,y,w,h,r,fill){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}}
function transition(time,events,initial,value,duration,curve=[.25,.1,.25,1]){
 let from=initial,to=initial,start=-1e6;const at=t=>mix(from,to,bezier(clamp((t-start)/duration),...curve));
 for(const event of events){if(event.time>time)break;const target=value(event);if(JSON.stringify(target)===JSON.stringify(to))continue;const now=at(event.time);from=now;to=target;start=event.time;}return at(time);
}
function states(id,index,source,time,accent){
 const start=index?source[index].start:0,next=source[index+1]?.start??Infinity,arrive=source[index].start-.13;
 const times=[...new Set([Math.max(0,arrive),start,next].filter(Number.isFinite))].sort((a,b)=>a-b);
 const state=t=>({time:t,arrived:t>=arrive,active:t>=start&&t<next,spoken:t>=start});
 const events=times.map(state),active=time>=start&&time<next,motion=transition.bind(null,time,events);
 const curve=id==='pop-punch'?[.34,1.56,.64,1]:[.16,1,.3,1],duration=id==='pop-punch'?.38:.36;
 const transform=s=>id==='depth'?[s.active?-5:s.arrived?0:32,s.active||s.arrived?1+(s.active?.07:0):.82,s.active||s.arrived?0:-38,0]:
  id==='karaoke'?[s.active?-2:0,1,0,0]:id==='cinema'?[s.arrived?0:14,1,0,0]:id==='neon'?[s.arrived?0:15,s.arrived?1:1.12,0,0]:id==='pop-punch'?[0,s.active?1.12:s.arrived?1:.4,0,s.active?-4:s.arrived?0:-14]:[0,1,0,0];
 const opacity=s=>id==='karaoke'?(s.spoken?1:.45):s.arrived?1:id==='cinema'?.15:id==='glass'?.4:0;
 const ink=s=>color(id==='depth'?(s.active?accent:'#f4ffe9'):id==='karaoke'?(s.active?'#132914':'#142c20'):id==='neon'?(s.active?'#ffffff':'#d1baf0'):id==='pop-punch'?(s.active?'#152018':'#ffffff'):s.active?accent:'#ffffff');
 const initial={arrived:false,active:false,spoken:false},clearAccent=[...color(accent).slice(0,3),0];
 return{active,transform:motion(transform(initial),transform,duration,curve),opacity:motion(opacity(initial),opacity,id==='pop-punch'?.2:.25),
  blur:motion(id==='depth'?6:id==='cinema'?3:id==='neon'?10:0,s=>s.arrived?0:id==='depth'?6:id==='cinema'?3:id==='neon'?10:0,.3),
  ink:id==='pop-punch'?ink(state(time)):motion(ink(initial),ink,.18),background:motion(clearAccent,s=>s.active?color(accent):clearAccent,.18)};
}
export function createStudioArtwork(canvas,id,options={}){
 const c=canvas.getContext('2d'),p=profiles[id]?{...profiles[id],size:Number.isFinite(options.fontSizePx)?options.fontSizePx*W/(1080*.92):profiles[id].size}:null;if(!p)throw new Error('Nepoznat stil kolekcije.');
 const layout=createStudioLayout(p,id),depth=id==='depth'?createDepthStage():null,accent=options.highlightColor||p.accent;
 const wordCanvas=document.createElement('canvas'),wc=wordCanvas.getContext('2d');let plate;
 return{canvas,span:6,aspect:W/H,resize(w,h){canvas.width=Math.round(w);canvas.height=Math.round(h);depth?.resize(canvas.width,canvas.height);},
  getBackdrop(){return id==='glass'&&plate?{...plate,radius:14,blur:18,logicalWidth:W,logicalHeight:H}:null;},
  render(words,time,timings){
   c.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);c.clearRect(0,0,W,H);c.textBaseline='alphabetic';c.textAlign='left';
   const source=timings?.length===words.length?timings:words.map((text,i)=>({text,start:.25+i*4.2/words.length,end:.25+(i+1)*4.2/words.length}));
   const active=Math.max(0,source.findLastIndex(w=>w.start<=time)),data=layout.measure(words,active),{size,box}=data;plate=box;
   if(options.collectionBackdrop){const bg=c.createLinearGradient(0,0,W,H);bg.addColorStop(0,id==='karaoke'?'#f1f0e7':'#162a2d');bg.addColorStop(1,id==='karaoke'?'#c6d8cf':'#0b1216');c.fillStyle=bg;c.fillRect(0,0,W,H);}
   if(id==='glass'){
    c.save();c.shadowColor='#00121b40';c.shadowBlur=32;c.shadowOffsetY=12;rounded(c,box.x,box.y,box.width,box.height,14,'#102c36ab');c.restore();
    rounded(c,box.x+.5,box.y+.5,box.width-1,box.height-1,13.5);c.strokeStyle='#dceef03a';c.lineWidth=1;c.stroke();
   }
   if(id==='cinema'){
    c.font='400 9px "DM Sans"';c.letterSpacing='0px';c.textAlign='center';c.fillStyle='#d8be83';c.fillText('S V A K A R I J E Č I M A T E Ž I N U',W/2,data.header.y+8);c.textAlign='left';c.fillStyle='#b59f71';c.fillRect(data.rule.x,data.rule.y,data.rule.width,1);
   }
   if(depth)depth.begin(box,options.collectionDepth??1);
   const items=id==='pop-punch'?[...data.items.filter(i=>i.index!==active),data.items[active]]:data.items;
   for(const item of items){
    if(!item)continue;const st=states(id,item.index,source,time,accent),pad=size*(p.padding||0),margin=60;
    wordCanvas.width=Math.ceil(item.width+margin*2);wordCanvas.height=Math.ceil(item.height+margin*2);
    wc.translate(margin,margin);wc.font=`${id==='cinema'&&st.active?'italic ':''}${p.weight} ${size}px "${p.font}"`;wc.letterSpacing=`${p.tracking}px`;wc.textBaseline='alphabetic';wc.lineJoin='round';
    const baseline=item.baseline-item.y,draw=(x=0,y=0)=>wc.fillText(item.text,pad+x,baseline+y);
    if(id==='depth'){
     const shadows=['#72966b','#64885e','#52784e','#42633e','#35542f','#233e21'];wc.fillStyle='#0009';wc.shadowColor='#0009';wc.shadowBlur=9;wc.shadowOffsetX=9;wc.shadowOffsetY=12;draw();wc.shadowColor='transparent';for(let d=6;d>=1;d--){wc.fillStyle=shadows[d-1];draw(d,d);}
    }else if(id==='karaoke'){
     if(st.active){wc.shadowColor='#192b2020';wc.shadowOffsetY=4;}rounded(wc,0,0,item.width,item.height,6,rgba(st.background));wc.shadowColor='transparent';
    }else if(id==='cinema'&&st.active){wc.shadowColor='#e9ca7a50';wc.shadowBlur=22;}
    else if(id==='neon'){
     wc.fillStyle=rgba(st.ink);for(const blur of st.active?[35,14,4]:[6]){wc.shadowColor=st.active?blur===4?'#ffffff':accent:'#b481ff80';wc.shadowBlur=blur;draw();}wc.shadowBlur=0;
    }else if(id==='pop-punch'){
     if(st.active)rounded(wc,4,5,item.width,item.height,3,'#060d0a');rounded(wc,0,0,item.width,item.height,3,rgba(st.background));if(!st.active){wc.fillStyle='#0e1511';draw(3,3);wc.strokeStyle='#0e1511';wc.lineWidth=1;wc.strokeText(item.text,pad,baseline);}
    }
    wc.fillStyle=rgba(st.ink);draw();if(id==='glass'&&st.active){wc.fillStyle=accent;wc.fillRect(pad,baseline+6,item.width-pad*2,2);}
    if(id==='neon'&&st.active){wc.save();wc.beginPath();wc.rect(0,item.height*.32,item.width,item.height*.28);wc.clip();wc.globalCompositeOperation='screen';wc.globalAlpha=.35;wc.fillStyle='#59ebff';draw(2,-1);wc.restore();}
    const [dy,scale,rx,rotation]=st.transform;
    if(depth){depth.word(wordCanvas,item,margin,{dy,scale,rx,opacity:st.opacity,blur:st.blur});continue;}
    c.save();c.translate(item.x+item.width/2,item.y+item.height/2+dy);c.rotate(rotation*Math.PI/180);c.scale(scale,scale);c.globalAlpha=st.opacity;c.filter=st.blur>.001?`blur(${st.blur*canvas.width/W}px)`:'none';c.drawImage(wordCanvas,-item.width/2-margin,-item.height/2-margin);c.restore();
   }
   if(depth){depth.render();c.drawImage(depth.canvas,0,0,W,H);}
  },dispose(){layout.dispose();depth?.dispose();canvas.width=canvas.height=1;wordCanvas.width=wordCanvas.height=1;}
 };
}
