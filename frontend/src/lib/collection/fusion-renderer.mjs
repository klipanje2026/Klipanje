/** FUSION CAPS — reusable transparent, textured, animated video captions.
 * ES module, no JavaScript dependencies. Canvas2D relief and extrusion combine
 * brushed metal, opal interference, glass facets, ink accents and kinetic words.
 * Load Archivo Black in your page, or supply fontFamily. All times are seconds.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const random=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const surface=(w,h)=>{const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;};
const gradient=(ctx,stops,x,y,xx,yy)=>{const g=ctx.createLinearGradient(x,y,xx,yy);stops.forEach(([p,color])=>g.addColorStop(p,color));return g;};

export function parseSrt(source){
  if(typeof source!=='string'||!source.trim())throw new Error('Unesi SRT tekst s vremenima i titlovima.');
  const stamp=value=>{const m=value.trim().match(/^(\d{1,3}):(\d{2}):(\d{2})[,.](\d{1,3})$/);if(!m||+m[2]>59||+m[3]>59)throw new Error('Neispravno SRT vrijeme: '+value);return +m[1]*3600+ +m[2]*60+ +m[3]+Number(m[4].padEnd(3,'0'))/1000;};
  const blocks=source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim().split(/\n\s*\n/),cues=[];
  for(const block of blocks){const lines=block.split('\n'),at=lines.findIndex(line=>line.includes('-->'));if(at<0)throw new Error('SRT blok nema vremensku oznaku.');
    const match=lines[at].match(/^\s*(\d{1,3}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,3}:\d{2}:\d{2}[,.]\d{1,3})/);if(!match)throw new Error('Neispravan SRT vremenski raspon.');
    const start=stamp(match[1]),end=stamp(match[2]),text=lines.slice(at+1).join(' ').replace(/<[^>]*>/g,'').trim();if(end<=start||!text)throw new Error('Svaki titl treba tekst i završetak nakon početka.');cues.push({start,end,text});
  }
  return cues.sort((a,b)=>a.start-b.start);
}

export class FusionCaptionRenderer {
  constructor(canvas,{width=1920,height=1080,intensity=1,fontFamily='Archivo Black'}={}){
    if(!(canvas instanceof HTMLCanvasElement))throw new TypeError('Potreban je canvas element.');
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});if(!this.ctx)throw new Error('Canvas2D nije dostupan.');
    this.fontFamily=fontFamily;this.font=`180px "${fontFamily}"`;this.intensity=clamp(Number(intensity)||1,.5,1.5);this.cues=[];this.sprites=new Map();this._detach=null;this._lastTime=0;
    this._measure=surface(1,1).getContext('2d');this._shine=surface(500,320);this._shineCtx=this._shine.getContext('2d');this.setSize(width,height);
  }
  async ready(){
    await document.fonts.ready;try{const faces=await document.fonts.load(`180px "${this.fontFamily.replace(/["\\]/g,'')}"`);if(faces.length)this.font=`180px "${this.fontFamily.replace(/["\\]/g,'')}"`;}catch{}
    this.sprites.clear();this.render(this._lastTime);return this;
  }
  setSize(width,height){
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<64||height<64||width>8192||height>8192)throw new RangeError('Rezolucija treba biti između 64 i 8192 piksela.');
    this.canvas.width=Math.round(width);this.canvas.height=Math.round(height);this.width=this.canvas.width;this.height=this.canvas.height;this.render(this._lastTime);return this;
  }
  setIntensity(value){this.intensity=clamp(Number(value)||1,.5,1.5);this.render(this._lastTime);return this;}
  setCues(cues){
    if(!Array.isArray(cues))throw new TypeError('Titlovi trebaju biti niz.');
    this.cues=cues.map(cue=>{
      const start=Number(cue.start),end=Number(cue.end),text=String(cue.text||'').trim();if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||!text)throw new Error('Neispravan titl: provjeri tekst i početak/završetak.');
      let words;
      if(Array.isArray(cue.words)&&cue.words.length){
        words=cue.words.map(word=>{const s=Number(word.start),e=Number(word.end),t=String(word.text||'');if(!t||!Number.isFinite(s)||!Number.isFinite(e)||s<start||e> end||e<=s)throw new Error('Vremena riječi moraju biti unutar titla.');return{text:t,start:s,end:e};}).sort((a,b)=>a.start-b.start);
      }else{
        const tokens=text.split(/\s+/),weights=tokens.map(t=>Math.max(2,Math.sqrt(t.length)*2)),sum=weights.reduce((a,b)=>a+b,0);let cursor=start;
        words=tokens.map((t,i)=>{const s=cursor;cursor=i===tokens.length-1?end:cursor+(end-start)*weights[i]/sum;return{text:t,start:s,end:cursor};});
      }
      return{start,end,text,words,explicitWords:!!cue.words};
    }).sort((a,b)=>a.start-b.start);
    this.render(this._lastTime);return this;
  }
  getCues(){return this.cues.map(c=>({start:c.start,end:c.end,text:c.text,...(c.explicitWords?{words:c.words.map(w=>({...w}))}:{})}));}
  getCueAt(time){for(let i=this.cues.length-1;i>=0;i--)if(time>=this.cues[i].start&&time<this.cues[i].end)return this.cues[i];return null;}
  attachVideo(video){
    if(!(video instanceof HTMLVideoElement))throw new TypeError('Potreban je video element.');this._detach?.();let live=true,handle=0,usingVideoFrame=false;
    const cancel=()=>{if(!handle)return;if(usingVideoFrame)video.cancelVideoFrameCallback?.(handle);else cancelAnimationFrame(handle);handle=0;};
    const paint=()=>{if(live)this.render(video.currentTime);};
    const frame=(_now,meta)=>{handle=0;if(!live)return;this.render(meta?.mediaTime??video.currentTime);if(!video.paused&&!video.ended)schedule();};
    const schedule=()=>{if(handle||!live)return;usingVideoFrame=typeof video.requestVideoFrameCallback==='function';handle=usingVideoFrame?video.requestVideoFrameCallback(frame):requestAnimationFrame(frame);};
    const onPlay=()=>{paint();schedule();},onStop=()=>{cancel();paint();};
    const listeners=[['play',onPlay],['pause',onStop],['ended',onStop],['seeking',paint],['seeked',paint],['timeupdate',paint],['loadedmetadata',paint]];
    listeners.forEach(([name,fn])=>video.addEventListener(name,fn));paint();if(!video.paused)schedule();
    const detach=()=>{live=false;cancel();listeners.forEach(([name,fn])=>video.removeEventListener(name,fn));if(this._detach===detach)this._detach=null;};this._detach=detach;return detach;
  }
  destroy(){this._detach?.();this.sprites.clear();this.ctx.clearRect(0,0,this.width,this.height);}
  _glyph(char,material){
    const key=this.font+'|'+char+'|'+material;if(this.sprites.has(key))return this.sprites.get(key);
    const pad=56,baseline=230;this._measure.font=this.font;const advance=this._measure.measureText(char).width;
    const mask=surface(advance+pad*2+55,320),m=mask.getContext('2d',{willReadFrequently:true});m.font=this.font;m.fillStyle='#fff';m.fillText(char,pad,baseline);
    const image=m.getImageData(0,0,mask.width,mask.height),pixels=image.data,w=mask.width,h=mask.height,distance=new Float32Array(w*h);
    for(let i=0;i<distance.length;i++)distance[i]=pixels[i*4+3]>127?9999:0;
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(distance[i])distance[i]=Math.min(distance[i],distance[i-1]+1,distance[i-w]+1,distance[i-w-1]+1.414,distance[i-w+1]+1.414);}
    for(let y=h-2;y>0;y--)for(let x=w-2;x>0;x--){const i=y*w+x;if(distance[i])distance[i]=Math.min(distance[i],distance[i+1]+1,distance[i+w]+1,distance[i+w+1]+1.414,distance[i+w-1]+1.414);}
    const d=new Float32Array(w*h),kernel=[1,2,1];
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(!distance[i])continue;let sum=0;for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)sum+=distance[i+yy*w+xx]*kernel[yy+1]*kernel[xx+1];d[i]=sum/16;}
    const rnd=random(char.codePointAt(0)*331+(material==='gold'?443:716)),palette=material==='gold'?
      [[255,235,164],[178,93,21],[70,31,12],[253,202,85],[176,98,28]]:material==='opal'?
      [[207,255,235],[80,191,225],[55,33,112],[239,186,253],[83,210,214]]:
      [[236,250,255],[105,171,192],[21,44,68],[218,248,254],[91,159,191]];
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x,k=i*4;if(!pixels[k+3])continue;const depth=d[i],gx=(d[i+1]-d[i-1])*.5,gy=(d[i+w]-d[i-w])*.5;
      const slope=2.8*Math.cos(clamp(depth/15,0,1)*Math.PI/2),nx=-gx*slope,ny=-gy*slope,len=Math.hypot(nx,ny,1),N=[nx/len,ny/len,1/len];
      const diffuse=Math.max(0,N[0]*-.36+N[1]*-.61+N[2]*.707),spec=Math.pow(Math.max(0,N[0]*-.22+N[1]*-.38+N[2]*.898),21);
      const pos=clamp((y-78)/156,0,.999)*4,idx=Math.floor(pos),mix=pos-idx,brush=(Math.sin(y*1.7+x*.036)*.6+(rnd()-.5)*1.4)*3;
      for(let c=0;c<3;c++){
        let dye=palette[idx][c]*(1-mix)+palette[idx+1][c]*mix;
        if(material==='opal')dye*=.82+.23*(.5+.5*Math.cos(x*.016+y*.01+c*2.094));
        pixels[k+c]=clamp(dye*(.51+diffuse*.60)+spec*142+brush,0,255);
      }
    }
    const face=surface(w,h),f=face.getContext('2d');f.putImageData(image,0,0);f.globalCompositeOperation='source-atop';
    // Fine engraving and translucent facets share one shaded face.
    f.strokeStyle=material==='gold'?'#f8d99244':'#b4e1f036';f.lineWidth=.6;
    for(let n=0;n<3;n++){const x=pad+advance*rnd(),y=95+rnd()*125;f.beginPath();f.moveTo(x-12,y);f.lineTo(x+14,y-8);f.lineTo(x+5,y+11);f.stroke();}
    for(let n=0;n<4;n++){f.beginPath();f.moveTo(pad+rnd()*advance,65+rnd()*175);f.lineTo(pad+rnd()*advance,65+rnd()*175);f.lineTo(pad+rnd()*advance,65+rnd()*175);f.closePath();f.fillStyle=n%2?'#7bbce514':'#ffffff18';f.fill();}
    f.globalCompositeOperation='source-over';const sprite=surface(w,h),s=sprite.getContext('2d');s.font=this.font;s.lineJoin='round';
    s.shadowColor='#000000db';s.shadowBlur=16;s.shadowOffsetY=9;s.fillStyle='#070b16';s.fillText(char,pad+9,baseline+17);s.shadowBlur=0;s.shadowOffsetY=0;
    for(let z=20;z>0;z--){s.fillStyle=gradient(s,material==='gold'?[[0,'#735830'],[.4,'#372b19'],[.58,'#b77b25'],[1,'#352719']]:[[0,'#32586e'],[.4,'#152632'],[.6,'#6493a6'],[1,'#10202c']],0,80,0,270);s.fillText(char,pad+z*.53,baseline+z*.73);}
    s.strokeStyle='#060c16';s.lineWidth=3;s.strokeText(char,pad,baseline);s.drawImage(face,0,0);
    if(material!=='chrome'){s.strokeStyle=material==='gold'?'#ffd0828f':'#b4ffee9c';s.lineWidth=.8;s.strokeText(char,pad,baseline);}
    const glyph={sprite,mask,advance,pad,baseline};this.sprites.set(key,glyph);return glyph;
  }
  _drawGlyph(g,x,y,scale,rotation,alpha,phase,active){
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(rotation);c.scale(scale,scale);c.globalAlpha=alpha;c.drawImage(g.sprite,-g.pad,-g.baseline);
    if(active){
      const p=this._shineCtx;p.clearRect(0,0,this._shine.width,this._shine.height);p.drawImage(g.mask,0,0);p.globalCompositeOperation='source-in';
      const pos=g.pad+g.advance*(.5+Math.sin(phase)*.65);p.fillStyle=gradient(p,[[0,'#ffffff00'],[.5,'#f1fcff9c'],[1,'#ffffff00']],pos-21,0,pos+21,16);p.fillRect(0,0,this._shine.width,this._shine.height);p.globalCompositeOperation='source-over';
      c.globalCompositeOperation='screen';c.globalAlpha=alpha*.5*this.intensity;c.drawImage(this._shine,-g.pad,-g.baseline);
    }c.restore();
  }
  render(time){
    this._lastTime=Number.isFinite(time)?Math.max(0,time):0;const c=this.ctx,W=this.width,H=this.height;c.clearRect(0,0,W,H);
    const cue=this.getCueAt(this._lastTime);if(!cue)return;
    const current=cue.words.findIndex(w=>this._lastTime>=w.start&&this._lastTime<w.end),cursor=current>=0?current:Math.max(0,cue.words.findLastIndex(w=>w.start<=this._lastTime));
    const chunkIndex=Math.floor(cursor/3),words=cue.words.slice(chunkIndex*3,chunkIndex*3+3),chunkStart=words[0].start,chunkEnd=words.at(-1).end;
    const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion:reduce)').matches;
    const size=Math.min(H*.091,W*.112),maxWidth=W*.83,scale=size/180,space=size*.28;
    const layouts=words.map((word,i)=>{const globalIndex=chunkIndex*3+i,active=globalIndex===current,theme=active?(globalIndex%3===1?'gold':'opal'):'chrome';const glyphs=[...word.text].map(ch=>this._glyph(ch,theme));const width=glyphs.reduce((sum,g)=>sum+g.advance*scale,0)+Math.max(0,glyphs.length-1)*size*.012;return{word,glyphs,width,active,index:globalIndex,theme};});
    const rows=[[]];let rowWidth=0;
    layouts.forEach(item=>{if(rows.at(-1).length&&rowWidth+space+item.width>maxWidth){rows.push([]);rowWidth=0;}rows.at(-1).push(item);rowWidth+=item.width+(rowWidth?space:0);});
    const topBaseline=H*.79-(rows.length-1)*size*1.12;
    const opacity=reduced?1:Math.min(clamp((this._lastTime-chunkStart)/.10,0,1),clamp((chunkEnd-this._lastTime)/.11,0,1));
    rows.forEach((row,rowIndex)=>{
      const natural=row.reduce((sum,item)=>sum+item.width,0)+space*(row.length-1),fit=Math.min(1,maxWidth/(natural+size*.2)),rowScale=scale*fit,rowSize=size*fit,rowSpace=space*fit;
      let x=(W-natural*fit)/2-rowSize*.026,baseline=topBaseline+rowIndex*size*1.12;
      // A quiet ink/glass shadow supports the face on bright or busy footage.
      c.save();c.globalAlpha=opacity;c.fillStyle='#03071080';c.shadowColor='#000000b0';c.shadowBlur=rowSize*.14;c.beginPath();c.roundRect(x-rowSize*.18,baseline-rowSize*.81,natural*fit+rowSize*.39,rowSize*.98,rowSize*.12);c.fill();c.restore();
      for(const item of row){
        const wordWidth=item.width*fit,age=this._lastTime-item.word.start,localProgress=clamp(age/Math.max(.01,item.word.end-item.word.start),0,1);
        if(item.active){
          c.save();c.globalAlpha=opacity;c.fillStyle=gradient(c,item.theme==='gold'?[[0,'#291b12'],[.6,'#382718'],[1,'#251322']]:[[0,'#072f3b'],[.6,'#122235'],[1,'#241638']],x,0,x+wordWidth,0);
          c.beginPath();c.moveTo(x-rowSize*.08,baseline-rowSize*.73);c.lineTo(x+wordWidth+rowSize*.06,baseline-rowSize*.75);c.lineTo(x+wordWidth+rowSize*.08,baseline+rowSize*.13);c.lineTo(x-rowSize*.12,baseline+rowSize*.12);c.closePath();c.fill();
          c.strokeStyle=gradient(c,[[0,'#79f1eb00'],[.30,item.theme==='gold'?'#ffbe62':'#8cffee'],[.70,'#d9a2ff'],[1,'#c47eff00']],x,0,x+wordWidth,0);c.shadowColor=item.theme==='gold'?'#d29131':'#7ddbdf';c.shadowBlur=rowSize*.09*this.intensity;c.lineWidth=rowSize*.027;
          c.beginPath();c.moveTo(x,baseline+rowSize*.14);c.bezierCurveTo(x+wordWidth*.24,baseline+rowSize*.21,x+wordWidth*.72,baseline+rowSize*.07,x+wordWidth,baseline+rowSize*.13);c.stroke();c.restore();
        }
        let gx=x;item.glyphs.forEach((g,i)=>{
          const entryAge=this._lastTime-chunkStart-i*.026,entry=reduced?1:clamp(entryAge/.36,0,1),ease=1-(1-entry)**3;
          const bounce=reduced||!item.active?0:Math.exp(-Math.max(age,0)*13)*Math.sin(Math.max(age,0)*21)*rowSize*.095*this.intensity;
          const lift=(1-ease)*rowSize*.23-bounce,angle=reduced?0:(1-ease)*-.15+(item.active?Math.sin(age*7+i*.3)*Math.exp(-Math.max(age,0)*9)*.012*this.intensity:0);
          this._drawGlyph(g,gx,baseline+lift,rowScale*(item.active&&!reduced?1+Math.max(0,Math.sin(age*12))*Math.exp(-Math.max(age,0)*10)*.03*this.intensity:1),angle,opacity*(reduced?1:clamp(entryAge/.09,0,1)),reduced?.8:this._lastTime*3+i*.36,item.active);
          gx+=(g.advance+180*.012)*rowScale;
        });
        if(item.active&&!reduced){
          const r=random(item.index*271+123);c.save();c.globalCompositeOperation='screen';c.globalAlpha=opacity;
          for(let i=0;i<5;i++){const phase=r(),life=(age*.78+phase)%1,xx=x+wordWidth*r(),yy=baseline-rowSize*.64-life*rowSize*.19,s=rowSize*(.018+r()*.013)*Math.sin(life*Math.PI)*this.intensity;
            c.fillStyle=item.theme==='gold'?'#fff1b9':'#b9faff';c.shadowColor=item.theme==='gold'?'#ffc556':'#8cffec';c.shadowBlur=s*2;c.beginPath();c.moveTo(xx-s*2,yy);c.lineTo(xx,yy-s);c.lineTo(xx+s*2,yy);c.lineTo(xx,yy+s);c.closePath();c.fill();}
          // A short light streak follows the karaoke progression.
          const sx=x+wordWidth*localProgress;c.fillStyle='#f8ffff';c.shadowColor='#adffee';c.shadowBlur=rowSize*.12;c.beginPath();c.arc(sx,baseline+rowSize*.13,rowSize*.022,0,Math.PI*2);c.fill();c.restore();
        }
        x+=wordWidth+rowSpace;
      }
    });
  }
}
