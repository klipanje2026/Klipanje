import * as THREE from '../../collection/three.mjs';
import {LustreFont} from './lustre-font.mjs';
import {LustreStyles} from './lustre-config.mjs';
import {buildLustreGlyph} from './lustre-geometry.mjs';
import {createLustreMaterials} from './lustre-materials.mjs';
import {drawPortraitVideo} from './lustre-background.mjs';
const lcClamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)),lcEase=n=>1-(1-lcClamp(n))**3;
const lcWords=text=>String(text||'').trim().split(/\s+/u).filter(Boolean);
const lcStops=new Set(['a','i','u','je','još','mi','da','se','na','za','do','iz','s','taj','uz','koje','kada','im','pa','ali','bi','to']);
export class LustreCaptionRenderer{
 constructor(canvas,options={}){
  if(!canvas?.getContext)throw new TypeError('Potreban je canvas.');this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});this.options={style:'lustre-cut',palette:0,window:8,scale:1,position:81,depth:1,shine:1,texture:.5,motion:1,effects:1,dynamics:1,reducedMotion:false,...options};
  this.cues=[];this.cache=new Map();this.glyphs=new Map();this.words=new Map();this.items=[];this.disposed=false;this.contextLost=false;this.key='';this.glSize='';
  this.glCanvas=document.createElement('canvas');this.gl=new THREE.WebGLRenderer({canvas:this.glCanvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});this.gl.setClearColor(0,0);this.gl.outputColorSpace=THREE.SRGBColorSpace;this.gl.toneMapping=THREE.ACESFilmicToneMapping;this.gl.toneMappingExposure=.90;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(34,9/16,1,10000);this.camera.position.z=1920/(2*Math.tan(34*Math.PI/360));this.text=new THREE.Group();this.scene.add(this.text,new THREE.HemisphereLight('#f4f6ff','#101721',.35));
  const key=new THREE.DirectionalLight('#f5f7ff',.6);key.position.set(-600,900,1000);const rim=new THREE.DirectionalLight('#bcd9ed',.6);rim.position.set(900,200,900);this.scene.add(key,rim);this.finishes=createLustreMaterials(THREE,this.gl);
  this.glCanvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.contextLost=true;});
 }
 ready(){return Promise.resolve(this);}
 setOptions(options){if(options.style&&options.style!=='lustre-cut')throw new RangeError('Nepoznat stil.');this.options={...this.options,...options};return this;}
 setCues(cues){
  if(!Array.isArray(cues))throw new TypeError('Titlovi moraju biti niz.');let previousEnd=-Infinity;
  const checked=cues.map(cue=>{const start=Number(cue.start),end=Number(cue.end);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||start<previousEnd)throw new RangeError('Vremena moraju biti uredna i bez preklapanja.');const supplied=Array.isArray(cue.words),tokens=supplied?cue.words.map(w=>String(w.text||'').trim()):lcWords(cue.text);if(tokens.length<1||tokens.some(w=>lcWords(w).length!==1))throw new RangeError('Blok mora imati od 1 do 24 riječi.');let previous=start;const words=tokens.map((text,i)=>{const s=supplied?Number(cue.words[i].start):start+(end-start)*i/tokens.length,e=supplied?Number(cue.words[i].end):start+(end-start)*(i+1)/tokens.length;if(!Number.isFinite(s)||!Number.isFinite(e)||s<start||s<previous||e<=s||e>end)throw new RangeError('Vrijeme riječi mora biti unutar bloka.');previous=s;return{text,start:s,end:e};});previousEnd=end;return{start,end,words,text:tokens.join(' ')};});
  this.cues=checked;this.cache.clear();this.key='';return this;
 }
 glyph(char){if(this.glyphs.has(char))return this.glyphs.get(char);const src=LustreFont.glyphs[char]||LustreFont.glyphs['?'],geometry=buildLustreGlyph(src,LustreFont.capHeight),result={geometry,advance:src.advance/LustreFont.capHeight};this.glyphs.set(char,result);return result;}
 word(text){
  if(this.words.has(text))return this.words.get(text);let cursor=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;const letters=[];
  for(const char of text){const glyph=this.glyph(char);if(glyph.geometry){const b=glyph.geometry.boundingBox;minX=Math.min(minX,cursor+b.min.x);maxX=Math.max(maxX,cursor+b.max.x);minY=Math.min(minY,b.min.y);maxY=Math.max(maxY,b.max.y);letters.push({geometry:glyph.geometry,x:cursor,index:letters.length});}cursor+=glyph.advance+.025;}
  const result={letters,minX,minY,maxY,width:maxX-minX,height:maxY-minY};this.words.set(text,result);return result;
 }
 layout(cue){
  const scale=lcClamp(Number(this.options.scale)||1,.8,1.12),dynamics=lcClamp(Number(this.options.dynamics)||1,.4,1.4),windowSize=Number(this.options.window)===6?6:8,key=[cue.text,cue.words.map(w=>w.start+':'+w.end).join(','),scale,dynamics,windowSize].join('|');if(this.cache.has(key))return this.cache.get(key);
  const count=Math.ceil(cue.words.length/windowSize),min=Math.floor(cue.words.length/count),extra=cue.words.length%count,groups=[];let cursor=0;
  for(let g=0;g<count;g++){const n=min+(g<extra?1:0),entries=cue.words.slice(cursor,cursor+n).map((w,i)=>({...w,index:cursor+i,slot:i,label:w.text.toLocaleUpperCase('bs')})),counts=n<=3?[n]:n<=6?[Math.ceil(n/2),Math.floor(n/2)]:[3,3,n-6],rows=[];let at=0,y=0;
   for(let band=0;band<counts.length;band++){const words=entries.slice(at,at+counts[band]);at+=words.length;const score=w=>{const clean=w.text.toLocaleLowerCase('bs').replace(/[^\p{L}]/gu,'');return clean.length-(lcStops.has(clean)?50:0);},hero=words.reduce((best,w)=>score(w)>score(best)?w:best);let gap=34;
    for(const word of words){word.data=this.word(word.label);word.large=word===hero;word.size=112*scale*(word.large?1+.48*dynamics:1-.20*dynamics);word.width=word.data.width*word.size;word.height=word.data.height*word.size;word.band=band;}
    let width=words.reduce((sum,w)=>sum+w.width,0)+gap*(words.length-1);if(width>842){const k=842/width;width=842;gap*=k;for(const w of words){w.size*=k;w.width*=k;w.height*=k;}}
    const height=Math.max(...words.map(w=>w.height));let x=0;for(const word of words){word.x=x;word.y=y+height-word.height;word.angle=band===1?-.018:.012;x+=word.width+gap;}rows.push({words,width,height,y});y+=height+34;
   }
   let total=y-34,width=Math.max(...rows.map(r=>r.width));for(let i=0;i<rows.length;i++){const offset=i%2?width-rows[i].width:0;for(const w of rows[i].words)w.x+=offset;}
   if(total>484){const k=484/total;for(const w of entries){w.x*=k;w.y*=k;w.size*=k;w.width*=k;w.height*=k;}for(const row of rows){row.width*=k;row.height*=k;row.y*=k;}total=484;width*=k;}
   groups.push({entries,rows,width,total,count:n,index:g,start:entries[0].start,end:cue.words[cursor+n]?.start??cue.end});cursor+=n;
  }
  const result={groups};this.cache.set(key,result);if(this.cache.size>80)this.cache.delete(this.cache.keys().next().value);return result;
 }
 clear(){this.text.clear();for(const item of this.items){item.finish.dispose();item.decorGeometry.forEach(g=>g.dispose());}this.items=[];}
 build(group,p){
  this.clear();for(const word of group.entries){const finish=this.finishes.make(p,word.large),object=new THREE.Group(),letters=[],decor=[],decorGeometry=[];finish.uniforms.width.value=word.data.width;this.text.add(object);
   for(const letter of word.data.letters){const group=new THREE.Group(),mesh=new THREE.Mesh(letter.geometry,[finish.face,finish.bevel,finish.side]),inlay=new THREE.Mesh(letter.geometry,finish.accent);inlay.scale.set(1.011,1.011,.055);inlay.position.z=-.206;group.add(inlay,mesh);object.add(group);letters.push({...letter,object:group,inlay});}
   if(word.large&&word.band===1){const geo=new THREE.BoxGeometry(word.data.width,.025,.045),line=new THREE.Mesh(geo,finish.accent);line.position.set(0,-word.data.height/2-.085,-.11);object.add(line);decor.push(line);decorGeometry.push(geo);}
   this.items.push({word,finish,object,letters,decor,decorGeometry});
  }
 }
 render(time,{background=null}={}){
  if(this.disposed)return;this.time=time;const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);if(background&&!this.options.overlayOnly){c.save();c.scale(w/1080,h/1920);background(c,1080,1920,time);c.restore();}
  const cue=this.cues.find(v=>time>=v.start&&time<v.end);this.pose={seconds:time,style:'lustre-cut',words:cue?.words.length||0,visibleWords:0,geometry:true,group:0};if(!cue)return;const layout=this.layout(cue),group=layout.groups.find(g=>time>=g.start&&time<g.end);if(!group)return;
  const palettes=LustreStyles['lustre-cut'].palettes,palette=lcClamp(Math.round(this.options.palette)||0,0,palettes.length-1),p=palettes[palette],key=[cue.start,group.index,palette,this.options.scale,this.options.dynamics,this.options.window,cue.text].join('|');if(key!==this.key){this.key=key;this.build(group,p);}
  if(this.glSize!==w+':'+h){this.glSize=w+':'+h;this.gl.setPixelRatio(1);this.gl.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  const depth=lcClamp(Number(this.options.depth)||1,.25,1.6),motion=this.options.reducedMotion?0:lcClamp(Number(this.options.motion)||0,0,1.5),still=this.options.reducedMotion||motion===0,flow=still?0:time,exit=still?1:lcClamp((group.end-time)/.16),position=lcClamp(Number(this.options.position)||81,74,85),x=(1080-group.width)/2,y=lcClamp(1920*position/100-group.total/2,1205,1750-group.total),effects=lcClamp(Number(this.options.effects)||0,0,1.4),visible=[];let meshes=0;
  for(const item of this.items){const word=item.word,age=time-word.start,shown=age>=0;item.object.visible=shown;if(!shown)continue;visible.push(word);const q=still?1:lcClamp(age/.24),e=lcEase(q),float=still?0:Math.sin(flow*.75+word.slot)*.8*motion;item.object.position.set(x+word.x+word.width/2-540,960-y-word.y-word.height/2+float,0);item.object.rotation.set(word.large?-.24:-.03,word.large?-.22:-.03,word.angle);item.object.scale.set(word.size,word.size,word.size*depth*(word.large?1:.38));item.finish.uniforms.scale.value=word.size;item.finish.uniforms.base.value.set(item.object.position.x-word.width/2,item.object.position.y-word.height/2);item.finish.update(still?1.5:age,this.options,still);
   for(const mat of item.finish.all){mat.transparent=e*exit<.999;mat.opacity=e*exit;}
   for(const letter of item.letters){const cq=still?1:lcClamp((age-letter.index*.012*motion)/.22),ce=lcEase(cq),settle=1-ce;letter.object.visible=cq>0;letter.object.position.set(letter.x-word.data.minX-word.data.width/2,-word.data.height/2-word.data.minY-settle*.18*motion,settle*.22*motion);letter.object.rotation.set(-settle*.8*motion,settle*.16*motion,0);letter.object.scale.setScalar(.88+.12*ce);letter.inlay.visible=word.large&&effects>0;meshes+=2;}
   for(const line of item.decor){line.visible=effects>0;const grow=still?1:lcEase(lcClamp(age/.55));line.scale.set(grow,Math.min(1,effects),1);line.position.x=word.data.width*(grow-1)/2;meshes++;}
  }
  this.gl.render(this.scene,this.camera);c.save();c.beginPath();c.rect(w*62/1080,h*1135/1920,w*956/1080,h*655/1920);c.clip();c.shadowColor='#000000b3';c.shadowBlur=10*w/1080;c.shadowOffsetY=7*w/1080;c.shadowOffsetX=3*w/1080;c.drawImage(this.glCanvas,0,0,w,h);c.restore();
  const active=group.entries.filter(v=>v.start<=time).at(-1);this.pose={...this.pose,concept:LustreStyles['lustre-cut'].concept,visibleWords:visible.length,displayText:visible.map(v=>v.text).join(' '),activeWord:active?.text,activeIndex:active?.index,group:group.index+1,groups:layout.groups.length,depth,meshes,contextLost:this.contextLost,bounds:{x:x-36,y:y-35,width:group.width+72,height:group.total+85}};
 }
 attachVideo(video,{background=false,onFrame=null}={}){this.detachVideo?.();let active=true,id=null,raf=null;const render=t=>{if(!active)return;this.render(t,{background:background?(c,w,h)=>drawPortraitVideo(c,video,w,h):null});onFrame?.(t);},tick=(_,metadata)=>{render(metadata.mediaTime);if(active)id=video.requestVideoFrameCallback(tick);},fallback=()=>{if(!active)return;render(video.currentTime);raf=requestAnimationFrame(fallback);},sync=()=>render(video.currentTime);for(const event of ['seeked','pause','loadeddata','timeupdate'])video.addEventListener(event,sync);if(video.requestVideoFrameCallback)id=video.requestVideoFrameCallback(tick);else raf=requestAnimationFrame(fallback);this.detachVideo=()=>{active=false;if(id!==null)video.cancelVideoFrameCallback(id);if(raf!==null)cancelAnimationFrame(raf);for(const event of ['seeked','pause','loadeddata','timeupdate'])video.removeEventListener(event,sync);};sync();return this.detachVideo;}
 dispose(){if(this.disposed)return;this.detachVideo?.();this.clear();for(const glyph of this.glyphs.values())glyph.geometry?.dispose();this.glyphs.clear();this.words.clear();this.cache.clear();this.finishes.dispose();this.gl.dispose();this.gl.forceContextLoss();this.disposed=true;}
}
