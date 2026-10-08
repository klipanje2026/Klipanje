import * as THREE from '../../collection/three.mjs';
import {AmplifyCaptionRenderer} from './amplify-captions-renderer.mjs';
import {PowerStyles} from './power-captions-config.mjs';
import {PowerFonts} from './power-fonts.mjs';
import {buildPowerGlyph} from './power-geometry.mjs';
import {createPowerMaterials} from './power-materials.mjs';
const pwClamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const pwTokens=text=>String(text||'').trim().split(/\s+/u).filter(Boolean);
const pwEase=v=>1-Math.pow(1-pwClamp(v),3);
const pwStop=new Set(['a','i','u','je','još','mi','da','se','na','za','do','iz','s','taj','uz','koje','pa','ali','bi','to']);
export class PowerCaptionRenderer extends AmplifyCaptionRenderer{
 constructor(canvas,{style='forge',...options}={}){
  if(!PowerStyles[style])throw new RangeError('Nepoznat stil.');super(canvas,{style:'punch',power:style,dynamics:1,depth:1,shine:1,glow:.45,...options});
  this.glCanvas=document.createElement('canvas');this.gl=new THREE.WebGLRenderer({canvas:this.glCanvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});this.gl.setClearColor(0,0);this.gl.outputColorSpace=THREE.SRGBColorSpace;this.gl.toneMapping=THREE.ACESFilmicToneMapping;this.gl.toneMappingExposure=1.05;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(34,9/16,1,10000);this.camera.position.z=1920/(2*Math.tan(34*Math.PI/360));this.scene.add(new THREE.HemisphereLight('#eaf4ff','#152030',.7));
  const key=new THREE.DirectionalLight('#fff6e8',2.5);key.position.set(-600,900,1300);this.scene.add(key);const rim=new THREE.DirectionalLight('#a3e6ff',1.6);rim.position.set(800,300,900);this.scene.add(rim);
  this.finishes=createPowerMaterials(THREE,this.gl);this.text=new THREE.Group();this.scene.add(this.text);this.glyphs=new Map();this.wordGeometries=new Map();this.items=[];this.activeKey='';this.meshCount=0;this.materialKey='';this.glSize='';this.contextLost=false;
  this.glCanvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.contextLost=true;});
 }
 setOptions({style,power,...options}){power=style||power||this.options.power;if(!PowerStyles[power])throw new RangeError('Nepoznat stil.');return super.setOptions({...options,amplify:'punch',power});}
 setCues(cues){
  if(!Array.isArray(cues))throw new TypeError('Titlovi moraju biti niz.');let previousEnd=-Infinity;
  this.cues=cues.map(cue=>{
   const start=Number(cue.start),end=Number(cue.end);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||start<previousEnd)throw new RangeError('Vremena titlova moraju biti uredna i bez preklapanja.');
   const supplied=Array.isArray(cue.words),tokens=supplied?cue.words.map(w=>String(w.text||'').trim()):pwTokens(cue.text);
   if(tokens.length<1||tokens.some(w=>!w||pwTokens(w).length!==1))throw new RangeError('Titl mora sadržavati tekst.');
   let previousStart=start;
   const words=tokens.map((text,i)=>{const s=supplied?Number(cue.words[i].start):start+(end-start)*i/tokens.length,e=supplied?Number(cue.words[i].end):start+(end-start)*(i+1)/tokens.length;
    if(!Number.isFinite(s)||!Number.isFinite(e)||s<start||s<previousStart||e<=s||e>end)throw new RangeError('Vrijeme svake riječi mora biti unutar bloka.');previousStart=s;return{text,start:s,end:e};});
   previousEnd=end;return{start,end,words,text:tokens.join(' ')};
  });this.cache.clear();this.faces.clear();return this;
 }
 glyph(char,style){
  const cfg=PowerStyles[style],key=style+':'+char;if(this.glyphs.has(key))return this.glyphs.get(key);const font=PowerFonts[cfg.font],src=font.glyphs[char]||font.glyphs['?'],u=1/font.capHeight,path=new THREE.ShapePath();
  const geometry=buildPowerGlyph(src,font.capHeight,cfg);
  const result={geometry,advance:src.advance*u};this.glyphs.set(key,result);return result;
 }
 wordGeometry(text,style){
  const key=style+'|'+text;if(this.wordGeometries.has(key))return this.wordGeometries.get(key);const buckets=[{p:[],n:[],u:[]},{p:[],n:[],u:[]},{p:[],n:[],u:[]}];let cursor=0;
  for(const ch of text){const glyph=this.glyph(ch,style);if(glyph.geometry){const a=glyph.geometry.attributes;for(const group of glyph.geometry.groups){const b=buckets[group.materialIndex];for(let i=group.start;i<group.start+group.count;i++){b.p.push(a.position.getX(i)+cursor,a.position.getY(i),a.position.getZ(i));b.n.push(a.normal.getX(i),a.normal.getY(i),a.normal.getZ(i));b.u.push(a.uv.getX(i),a.uv.getY(i));}}}cursor+=glyph.advance+.035;}
  const geometry=new THREE.BufferGeometry(),pos=[],normals=[],uv=[];let at=0;for(let i=0;i<3;i++){const b=buckets[i];for(const value of b.p)pos.push(value);for(const value of b.n)normals.push(value);for(const value of b.u)uv.push(value);geometry.addGroup(at,b.p.length/3,i);at+=b.p.length/3;}
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeBoundingBox();const b=geometry.boundingBox,width=b.max.x-b.min.x,height=b.max.y-b.min.y;geometry.translate(-(b.min.x+b.max.x)/2,-(b.min.y+b.max.y)/2,-PowerStyles[style].depth/2);geometry.computeBoundingBox();
  const result={geometry,width,height};this.wordGeometries.set(key,result);return result;
 }
 layout(cue){
  const style=this.options.power,cfg=PowerStyles[style],windowSize=Number(this.options.window)===6?6:8,scale=pwClamp(Number(this.options.scale)||1,.8,1.12),dynamics=pwClamp(Number(this.options.dynamics)||0,.4,1.4),key=[cue.text,cue.words.map(w=>w.start+':'+w.end).join(','),style,windowSize,scale,dynamics].join('|');if(this.cache.has(key))return this.cache.get(key);
  const count=Math.ceil(cue.words.length/windowSize),minimum=Math.floor(cue.words.length/count),extra=cue.words.length%count,groups=[];let cursor=0;
  for(let g=0;g<count;g++){
   const n=minimum+(g<extra?1:0),entries=cue.words.slice(cursor,cursor+n).map((w,i)=>({...w,index:cursor+i,slot:i,weight:cfg.weights[i],label:w.text.toLocaleUpperCase('bs')})),rows=[];let at=0,y=0;
   for(const [band,nwords]of cfg.bands.entries()){
    const words=entries.slice(at,at+nwords);if(!words.length)break;at+=words.length;const clean=w=>w.text.toLocaleLowerCase('bs').replace(/[^\p{L}]/gu,''),meaningful=words.filter(w=>!pwStop.has(clean(w))),major=words.reduce((a,b)=>a.weight>b.weight?a:b),candidate=(meaningful.length?meaningful:words).reduce((a,b)=>clean(a).length>clean(b).length?a:b);
    if(candidate!==major&&(pwStop.has(clean(major))||clean(candidate).length>clean(major).length*1.5))[candidate.weight,major.weight]=[major.weight,candidate.weight];
    for(const word of words){if(pwStop.has(clean(word)))word.weight=Math.min(.78,word.weight);const data=this.wordGeometry(word.label,style);word.geometry=data.geometry;word.size=83*scale*(1+(word.weight-1)*dynamics);word.width=data.width*word.size;word.height=data.height*word.size;word.large=word.weight>1.25;word.band=band;}
    let gap=35,width=words.reduce((n,w)=>n+w.width,0)+gap*(words.length-1);if(width>798){const k=798/width;for(const w of words){w.size*=k;w.width*=k;w.height*=k;}gap*=k;width=798;}
    const height=Math.max(...words.map(w=>w.height));let x=0;for(const word of words){word.x=x;word.y=y+height-word.height;word.angle=cfg.tilt*(word.large?1:.4);x+=word.width+gap;}rows.push({words,width,height,y,index:band});y+=height+36;
   }
   let total=y-36,width=Math.max(...rows.map(r=>r.width));for(const row of rows){const offset=cfg.align[row.index]===-1?0:cfg.align[row.index]===1?width-row.width:(width-row.width)/2;for(const word of row.words)word.x+=offset;}
   if(total>448){const k=448/total;for(const word of entries){word.x*=k;word.y*=k;word.size*=k;word.width*=k;word.height*=k;}for(const row of rows){row.y*=k;row.width*=k;row.height*=k;}width*=k;total=448;}
   groups.push({entries,rows,width,total,count:n,index:g,start:entries[0].start,end:cue.words[cursor+n]?.start??cue.end});cursor+=n;
  }
  const result={groups};this.cache.set(key,result);if(this.cache.size>80)this.cache.delete(this.cache.keys().next().value);return result;
 }
 clearItems(){this.text.clear();for(const item of this.items){item.materials.dispose();item.ownedGeometry.forEach(g=>g.dispose());item.ownedMaterials.forEach(m=>m.dispose());}this.items=[];}
 build(group,p){
  this.clearItems();const kind=this.options.power,cfg=PowerStyles[kind];
  for(const word of group.entries){
   const materials=this.finishes.make(kind,p,word.slot,word.large),object=new THREE.Group(),mesh=new THREE.Mesh(word.geometry,[materials.face,materials.bevel,materials.side]),outline=new THREE.Mesh(word.geometry,materials.rim),glow=new THREE.Mesh(word.geometry,materials.glow);outline.position.z=-.12;outline.scale.set(1.022,1.035,.78);glow.position.z=-.10;glow.scale.set(1.025,1.045,.76);object.add(glow,outline,mesh);this.text.add(object);
   const item={word,object,mesh,outline,glow,materials,ownedGeometry:[],ownedMaterials:[],decor:[],particles:[]};
   if(word.large){
    const b=word.geometry.boundingBox,min=b.min,max=b.max,accent=new THREE.MeshPhysicalMaterial({color:kind==='forge'?p.b:p.b,metalness:.7,roughness:.18,clearcoat:1,envMap:this.finishes.environment,envMapIntensity:1.2});item.ownedMaterials.push(accent);
    const add=(geometry,material=accent)=>{const obj=new THREE.Mesh(geometry,material);item.ownedGeometry.push(geometry);item.decor.push(obj);object.add(obj);return obj;};
    if(kind==='forge'){const geo=new THREE.BoxGeometry(max.x-min.x,.035,.10),bar=add(geo);bar.position.set(0,min.y-.11,-.07);const screw=add(new THREE.OctahedronGeometry(.09,0));screw.position.set(max.x+.17,max.y-.06,.04);}
    if(kind==='opal'){const halo=add(new THREE.TorusGeometry(.18,.025,8,32));halo.position.set(max.x+.11,max.y-.08,-.09);halo.rotation.set(.2,.7,.2);}
    if(kind==='armor'){const neon=new THREE.MeshBasicMaterial({color:p.b,toneMapped:false});item.ownedMaterials.push(neon);for(const side of [-1,1]){const rail=add(new THREE.BoxGeometry(.045,max.y-min.y+.13,.075),neon);rail.position.set(side*(max.x+.11),0,-.06);}const bar=add(new THREE.BoxGeometry(max.x-min.x,.045,.08),neon);bar.position.set(0,min.y-.10,-.06);}
    if(kind==='gel'){for(let i=0;i<2;i++){const bead=add(new THREE.SphereGeometry(.07+i*.022,12,8));bead.position.set(max.x+.12+i*.08,min.y+.05+i*.17,.05);item.particles.push(bead);}}
    if(kind==='prism'){for(let i=0;i<2;i++){const shard=add(new THREE.OctahedronGeometry(.10+i*.045,0));shard.position.set((i?1:-1)*(max.x+.15),i?min.y:max.y,-.08);shard.rotation.set(.4,1.1,.2);item.particles.push(shard);}}
   }
   this.items.push(item);
  }
  this.meshCount=this.items.reduce((n,item)=>n+3+item.decor.length,0);
 }
 render(time,{background=null}={}){
  if(this.disposed)return;this.time=time;const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);c.save();c.scale(w/1080,h/1920);if(background&&!this.options.overlayOnly)background(c,1080,1920,time);c.restore();
  const cue=this.cues.find(cue=>time>=cue.start&&time<cue.end);this.pose={seconds:time,style:this.options.power,words:cue?.words.length||0,visibleWords:0,group:0,geometry:true};if(!cue)return;
  const group=this.layout(cue).groups.find(g=>time>=g.start&&time<g.end);if(!group)return;const kind=this.options.power,cfg=PowerStyles[kind],palette=pwClamp(Math.round(this.options.palette)||0,0,cfg.palettes.length-1),p=cfg.palettes[palette],key=[cue.start,group.index,kind,palette,this.options.scale,this.options.dynamics,this.options.window,cue.text].join('|');if(key!==this.activeKey){this.activeKey=key;this.build(group,p);}
  if(this.glSize!==w+':'+h){this.glSize=w+':'+h;this.gl.setPixelRatio(1);this.gl.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  const position=pwClamp(Number(this.options.position)||82,74,85),x=(1080-group.width)/2,y=pwClamp(1920*position/100-group.total/2,1215,1740-group.total),depth=pwClamp(Number(this.options.depth)||1,.25,1.7),motion=this.options.reducedMotion?0:pwClamp(Number(this.options.motion)||0,0,1.5),effects=pwClamp(Number(this.options.effects)||0,0,1.4),still=this.options.reducedMotion||motion===0,flow=still?0:time,exit=still?1:pwClamp((group.end-time)/.12),active=group.entries.filter(w=>w.start<=time).at(-1);this.activeIndex=active?.index;
  const visible=[];
  for(const item of this.items){
   const word=item.word,q=this.progress(time,word);item.object.visible=q>0;if(!q)continue;visible.push(word);const e=pwEase(q),settle=1-e,elastic=still?0:Math.sin(q*Math.PI*3)*(1-q)**2*motion,float=still?0:Math.sin(flow*.8+word.slot*1.7)*(word.large?1.5:.65)*motion;
   let dx=0,dy=14*settle*motion,rx=-.17,ry=-.36,rz=word.angle,sx=1,sy=1;
   if(kind==='forge'){rx-=settle*.44*motion;ry-=settle*.6*motion;dy+=8*elastic;}
   if(kind==='opal'){rx=-.18;ry=.30+Math.sin(flow*.48+word.slot)*.025*motion;dy+=elastic*17;sx+=elastic*.055;sy-=elastic*.055;}
   if(kind==='armor'){dx=(word.slot%2?1:-1)*27*settle*motion;ry=-.32+settle*.35*motion;rx=-.15;}
   if(kind==='gel'){dy+=elastic*22;rx=-.17;ry=-.30;sx+=elastic*.12;sy-=elastic*.15;rz+=elastic*.04;}
   if(kind==='prism'){ry=.35+settle*.62*motion;rx=-.18;dx=18*settle*motion;rz+=settle*.08*motion;}
   item.object.position.set(x+word.x+word.width/2-540+dx,960-(y+word.y+word.height/2+dy)+float,-24*settle*motion);item.object.rotation.set(rx,ry,rz);item.object.scale.set(word.size*sx,word.size*sy,word.size*depth);
   item.materials.update(flow,this.options,still);for(const mat of item.materials.all){mat.transparent=e*exit<.999;mat.opacity=e*exit;}
   item.outline.visible=kind!=='opal';item.glow.visible=kind==='armor'&&Number(this.options.glow)>0;item.glow.material.opacity=Math.min(1,(Number(this.options.glow)||0)*e*exit*.85);item.glow.material.transparent=true;
   for(const mat of item.ownedMaterials){mat.transparent=e*exit<.999;mat.opacity=e*exit;}for(const obj of item.decor){obj.visible=effects>0;obj.scale.setScalar(Math.min(1,effects)*e);}
   item.particles.forEach((obj,i)=>{obj.rotation.x=flow*.7+i;obj.rotation.y=flow*.5+i;obj.position.z=-.06+Math.sin(flow*1.2+i)*.045*motion;});
  }
  this.gl.render(this.scene,this.camera);c.save();c.beginPath();c.rect(w*66/1080,h*1135/1920,w*948/1080,h*655/1920);c.clip();
  const glow=pwClamp(Number(this.options.glow)||0,0,1.2);if(glow&&kind==='armor'){c.save();c.filter=`blur(${3.5*w/1080*glow}px)`;c.globalAlpha=glow*.16;c.globalCompositeOperation='screen';c.drawImage(this.glCanvas,0,0,w,h);c.restore();}c.drawImage(this.glCanvas,0,0,w,h);c.restore();
  this.pose={...this.pose,concept:cfg.concept,visibleWords:visible.length,displayText:visible.map(w=>w.text).join(' '),activeWord:active?.text,activeIndex:active?.index,group:group.index+1,groups:this.layout(cue).groups.length,bounds:{x:x-38,y:y-50,width:group.width+76,height:group.total+100},meshes:this.meshCount,material:kind,depth,contextLost:this.contextLost};
 }
 dispose(){if(this.disposed)return;this.clearItems();for(const value of this.glyphs.values())value.geometry?.dispose();for(const value of this.wordGeometries.values())value.geometry.dispose();this.glyphs.clear();this.wordGeometries.clear();this.finishes.dispose();this.gl.dispose();this.gl.forceContextLoss();super.dispose();}
}
