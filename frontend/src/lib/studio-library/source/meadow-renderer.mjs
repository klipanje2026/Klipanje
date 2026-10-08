import * as THREE from '../../collection/three.mjs';
import { MeadowFont } from './meadow-font.mjs';
import { MeadowPalettes } from './meadow-palettes.mjs';
const mdClamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mdEase=t=>1-(1-mdClamp(t,0,1))**3;
function mdClone(source){const m=source.clone();m.onBeforeCompile=source.onBeforeCompile;m.customProgramCacheKey=source.customProgramCacheKey;m.transparent=true;return m;}
function mdFinish(geometry){
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,arrays=[[],[],[]];
  // Degenerate triangles have no area and cannot provide a lighting normal.
  for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);
    if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-18)continue;
    for(let j=0;j<3;j++){arrays[0].push(p.getX(i+j),p.getY(i+j),p.getZ(i+j));arrays[1].push(n.getX(i+j),n.getY(i+j),n.getZ(i+j));arrays[2].push(uv.getX(i+j),uv.getY(i+j));}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arrays[0],3));g.setAttribute('normal',new THREE.Float32BufferAttribute(arrays[1],3));g.setAttribute('uv',new THREE.Float32BufferAttribute(arrays[2],2));geometry.dispose();
  const pn=g.attributes.position,nn=g.attributes.normal,sums=new Map(),keys=[];
  const key=i=>`${Math.round(pn.getX(i)*1e6)},${Math.round(pn.getY(i)*1e6)},${Math.round(pn.getZ(i)*1e6)}`;
  // Angle-weighted bevel normals keep a smooth reflection across curved corners.
  for(let i=0;i<pn.count;i+=3){if(Math.abs(nn.getZ(i))>.999)continue;for(let j=0;j<3;j++){
    const at=i+j,b=i+(j+1)%3,c=i+(j+2)%3,a=new THREE.Vector3().fromBufferAttribute(pn,at),v=new THREE.Vector3().fromBufferAttribute(pn,b).sub(a),w=new THREE.Vector3().fromBufferAttribute(pn,c).sub(a),den=v.length()*w.length();
    const angle=den?Math.acos(mdClamp(v.dot(w)/den,-1,1)):0,k=key(at);keys[at]=k;const sum=sums.get(k)||new THREE.Vector3();sum.addScaledVector(new THREE.Vector3().fromBufferAttribute(nn,at),angle);sums.set(k,sum);}}
  // Classify before smoothing: flat front, rounded bevel and deep side walls.
  let last=-1,start=0;for(let i=0;i<nn.count;i+=3){const nz=(nn.getZ(i)+nn.getZ(i+1)+nn.getZ(i+2))/3,type=nz>.999?0:nz>.025?1:2;if(type!==last){if(last>=0)g.addGroup(start,i-start,last);start=i;last=type;}}
  if(last>=0)g.addGroup(start,nn.count-start,last);
  for(let i=0;i<nn.count;i++){const v=sums.get(keys[i]);if(v&&v.lengthSq()>1e-16){v.normalize();nn.setXYZ(i,v.x,v.y,v.z);}}
  // One contiguous bucket per finish: three draw calls per glyph, irrespective
  // of the number of curve segments or bevel triangles.
  const buckets=[{p:[],n:[],u:[]},{p:[],n:[],u:[]},{p:[],n:[],u:[]}],gu=g.attributes.uv;
  for(const group of g.groups){const bucket=buckets[group.materialIndex];for(let i=group.start;i<group.start+group.count;i++){bucket.p.push(pn.getX(i),pn.getY(i),pn.getZ(i));bucket.n.push(nn.getX(i),nn.getY(i),nn.getZ(i));bucket.u.push(gu.getX(i),gu.getY(i));}}
  g.clearGroups();const pos=[],normal=[],coords=[];let offset=0;for(let i=0;i<3;i++){const b=buckets[i],count=b.p.length/3;if(count){g.addGroup(offset,count,i);offset+=count;for(const value of b.p)pos.push(value);for(const value of b.n)normal.push(value);for(const value of b.u)coords.push(value);}}
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(coords,2));
  g.computeBoundingBox();return g;
}

export class MeadowTypeRenderer {
 constructor(canvas,{palette='forest',display='pair',direction='left',wind=1,density=1,growth=1,textSize=1,depth=1,reducedMotion=false,pixelRatio=Math.min(globalThis.devicePixelRatio||1.7,2)}={}){
  Object.assign(this,{canvas,palette,display,direction,wind,density,growth,textSize,depth,reducedMotion,pixelRatio});
  this.cues=[];this.cache=new Map();this.words=[];this.time=0;this.mode='stage';this.active='';this.disposed=false;
  this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});this.renderer.setClearColor(0,0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.07;
  this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-6,6,4.7,-4.7,.1,40);this.camera.position.set(0,0,15);
  this.scene.add(new THREE.HemisphereLight('#f4f0de','#2b362c',1.45));const key=new THREE.DirectionalLight('#fff4d8',1.8);key.position.set(-4,6,7);this.scene.add(key);const fill=new THREE.DirectionalLight('#dde8df',.38);fill.position.set(5,2,5);this.scene.add(fill);
  this.face=new THREE.MeshStandardMaterial({color:'#e1dfd2',roughness:.86,metalness:0,transparent:true});this.bevel=this.face.clone();this.side=this.face.clone();this.text=new THREE.Group();this.scene.add(this.text);
  this.createStage();this.createGrass();this.resize();
 }
 ready(){return Promise.resolve(this);}
 createStage(){
  this.backMaterial=new THREE.ShaderMaterial({depthWrite:false,uniforms:{uA:{value:new THREE.Color()},uB:{value:new THREE.Color()},uAspect:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform vec3 uA,uB;uniform float uAspect;void main(){vec2 p=(vUv-.5)*vec2(uAspect,1.);float light=exp(-dot(p-vec2(-.2,.25),p-vec2(-.2,.25))*2.3);vec3 c=mix(uA,uB,light*.78);float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);c*=.995+grain*.01;gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}`});
  this.background=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.backMaterial);this.background.position.z=-3;this.scene.add(this.background);
  this.floorMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uColor:{value:new THREE.Color()},uFade:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform vec3 uColor;uniform float uFade;void main(){float side=1.-smoothstep(.36,.50,abs(vUv.x-.5));float depth=pow(sin(vUv.y*3.14159265),.8);vec3 c=uColor*(.62+.30*vUv.y);gl_FragColor=vec4(c,side*depth*.62*uFade);\n#include <colorspace_fragment>\n}`});
  this.floor=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.floorMaterial);this.floor.position.z=-1.2;this.scene.add(this.floor);
 }
 createGrass(){
  const vertex=`
   attribute vec3 aRoot;attribute float aHeight,aWidth,aLean,aPhase,aTone,aAngle;
   uniform float uTime,uWind,uProgress,uDirection,uWidth,uRoot,uFade,uDensity,uVideo,uHeight;
   varying vec2 vBlade;varying float vTone,vAlive,vLight;
   void main(){
    float along=aRoot.x+.5;if(uDirection>0.5&&uDirection<1.5)along=1.-along;
    float grow=clamp((uProgress-along*.66)/.34,0.,1.);if(uDirection>1.5)grow=clamp(uProgress*1.30-aPhase*.040,0.,1.);
    grow=grow*grow*(3.-2.*grow);float v=position.y;
    float gust=sin(uTime*1.05-aRoot.x*3.7)+.35*sin(uTime*2.13+aPhase+aRoot.x*9.);
    float flutter=sin(uTime*3.1+aPhase+v*4.)*.04;
    float bend=(aLean+gust*.18*uWind)*aHeight*uHeight*pow(v,1.8)*grow;
    float width=aWidth*pow(max(0.,1.-v),.8)*(.45+.55*sin(v*3.14159265));
    vec3 p=vec3(aRoot.x*uWidth,uRoot+aRoot.y,aRoot.z);
    p.y+=v*aHeight*uHeight*grow*uVideo;
    p.x+=bend*uVideo+position.x*width*cos(aAngle)*grow;
    p.z+=position.x*width*sin(aAngle+v*.32)*grow-abs(position.x)*width*.16*grow+sin(v*3.14159265)*.025+aHeight*v*v*.055*grow+flutter*v*v*uWind;
    vBlade=vec2(position.x,v);vTone=aTone;vAlive=step(aTone,uDensity)*step(.001,grow)*uFade;
    vLight=.76+.15*cos(aAngle)+position.x*.055;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
   }`;
  const fragment=`
   uniform vec3 uBase,uTip,uDry;varying vec2 vBlade;varying float vTone,vAlive,vLight;
   void main(){if(vAlive<.003)discard;vec3 c=mix(uBase,uTip,pow(vBlade.y,.8));c=mix(c,uDry,smoothstep(.65,.98,vTone)*.32);
    float vein=exp(-abs(vBlade.x)*12.);float fibres=.98+.025*sin(vBlade.y*85.+vTone*31.);
    c*=vLight*fibres+vein*.035;gl_FragColor=vec4(c,vAlive);\n#include <colorspace_fragment>\n}`;
  this.grassLayers=[];
  let seed=78123;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(const front of [false,true]){
   const positions=[],indices=[],steps=14;
   for(let y=0;y<=steps;y++)for(const x of [-1,0,1])positions.push(x,y/steps,0);
   for(let y=0;y<steps;y++)for(let x=0;x<2;x++){const a=y*3+x,b=a+1,c=a+3,d=a+4;indices.push(a,c,b,b,c,d);}
   const geometry=new THREE.InstancedBufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
   const data={aRoot:[],aHeight:[],aWidth:[],aLean:[],aPhase:[],aTone:[],aAngle:[]};
   const count=front?320:850;
   for(let i=0;i<count;i++){
    const x=(i+random()*.85)/count-.5,cluster=.75+.25*Math.sin(x*19.+1.4);
    data.aRoot.push(x,(random()-.5)*.08,random()*.26);data.aTone.push(random());
    const h=front?.70+Math.pow(random(),1.8)*1.8:1.05+Math.pow(random(),.65)*1.9;
    data.aHeight.push(h*cluster);data.aWidth.push((front?.026:.024)+random()*.045);data.aLean.push((random()-.5)*.24);data.aPhase.push(random()*6.28);data.aAngle.push((random()-.5)*1.65);
   }
   for(const [name,array]of Object.entries(data))geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(array),name==='aRoot'?3:1));
   geometry.instanceCount=count;
   const material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,transparent:true,depthWrite:true,uniforms:{uTime:{value:0},uWind:{value:1},uProgress:{value:0},uDirection:{value:0},uWidth:{value:10},uRoot:{value:-1.8},uFade:{value:1},uDensity:{value:1},uVideo:{value:1},uHeight:{value:1},uBase:{value:new THREE.Color()},uTip:{value:new THREE.Color()},uDry:{value:new THREE.Color()}}});
   const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.position.z=front?.30:-.68;this.scene.add(mesh);this.grassLayers.push({mesh,geometry,material,front});
  }
 }
 resize(width=this.canvas.clientWidth||736,height=this.canvas.clientHeight||520,pixelRatio=this.pixelRatio){
  this.width=Math.max(1,width);this.height=Math.max(1,height);this.pixelRatio=mdClamp(pixelRatio,1,3);this.renderer.setPixelRatio(this.pixelRatio);this.renderer.setSize(this.width,this.height,false);this.viewHeight=8.4;this.viewWidth=this.viewHeight*this.width/this.height;
  this.camera.left=-this.viewWidth/2;this.camera.right=this.viewWidth/2;this.camera.top=4.2;this.camera.bottom=-4.2;this.camera.updateProjectionMatrix();this.background.scale.set(this.viewWidth,this.viewHeight,1);this.backMaterial.uniforms.uAspect.value=this.width/this.height;this.active='';return this;
 }
 setCues(cues){this.cues=(cues||[]).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start&&typeof c.text==='string'&&c.text.trim()).map(c=>({...c,text:c.text.slice(0,1000),words:c.text.slice(0,1000).trim().split(/\s+/)})).sort((a,b)=>a.start-b.start);this.active='';return this;}
 getDuration(){return this.cues.reduce((max,c)=>Math.max(max,c.end),0);}
 locate(time){const cueIndex=this.cues.findIndex(c=>time>=c.start&&time<c.end);if(cueIndex<0)return null;const cue=this.cues[cueIndex],n=this.display==='sentence'?cue.words.length:this.display==='triple'?3:2,count=Math.ceil(cue.words.length/n),span=(cue.end-cue.start)/count,chunk=Math.min(count-1,Math.floor((time-cue.start)/span));return{cueIndex,chunk,span,local:time-cue.start-chunk*span,words:cue.words.slice(chunk*n,chunk*n+n),text:cue.text};}
 glyph(char){
  if(this.cache.has(char))return this.cache.get(char);const source=MeadowFont.glyphs[char]||MeadowFont.glyphs['?'],unit=1/MeadowFont.capHeight,path=new THREE.ShapePath();
  for(const [name,...values]of source.commands){const p=values.map(n=>n*unit);if(name==='M')path.moveTo(...p);else if(name==='L')path.lineTo(...p);else if(name==='Q')path.quadraticCurveTo(...p);else if(name==='C')path.bezierCurveTo(...p);else if(name==='Z')path.currentPath.closePath();}
  const shapes=path.toShapes(false),geometry=shapes.length?mdFinish(new THREE.ExtrudeGeometry(shapes,{depth:.048,bevelEnabled:true,bevelThickness:.009,bevelSize:.007,bevelSegments:3,curveSegments:12,steps:1})):null;
  const glyph={geometry,advance:source.advance*unit};this.cache.set(char,glyph);return glyph;
 }
 clearWords(){this.text.clear();this.words=[];}
 buildWords(info){
  this.clearWords();const sentence=this.display==='sentence',video=this.mode==='video';
  const measure=text=>[...text].reduce((sum,ch)=>sum+this.glyph(ch).advance+.012,0);
  let lines=sentence?[info.words]:[info.words];
  let targetScale=(video?(sentence?.87:1.36):(sentence?1.05:1.65))*mdClamp(this.textSize,.75,1.3);const maxWidth=this.viewWidth*.84;
  if(sentence){
   const wrap=()=>{const result=[];let line=[],size=0;for(const word of info.words){const w=measure(word+' ');if(line.length&&((size+w)*targetScale>maxWidth)){result.push(line);line=[];size=0;}line.push(word);size+=w;}if(line.length)result.push(line);return result;};
   lines=wrap();const wanted=this.viewWidth<7?3:2;for(let i=0;lines.length>wanted&&i<20;i++){targetScale*=.90;lines=wrap();}
  }
  const longest=Math.max(...lines.map(line=>measure(line.join(' ')))),scale=Math.min(targetScale,maxWidth/longest),gap=scale*1.45;
  const bottom=video?-2.43:-.52;
  let widest=0;
  lines.forEach((line,lineIndex)=>{
   const total=measure(line.join(' '));let x=-total*scale/2;const y=bottom+(lines.length-1-lineIndex)*gap;
   line.forEach((word,index)=>{
    const group=new THREE.Group(),w=measure(word);this.text.add(group);
    let localX=0;for(const ch of word){const g=this.glyph(ch);if(g.geometry){const mesh=new THREE.Mesh(g.geometry,[this.face,this.bevel,this.side]);mesh.position.x=localX;group.add(mesh);}localX+=g.advance+.012;}
    const item={group,x,y,scale,lineIndex,index};this.words.push(item);x+=(w+this.glyph(' ').advance+.012)*scale;
   });widest=Math.max(widest,total*scale);
  });
  this.grassWidth=Math.min(this.viewWidth*.88,Math.max(widest+1.6,this.viewWidth*.58));this.rootY=video?-3.50:-1.78;
  this.frontHeight=Math.min(1,(bottom-this.rootY+scale*.45)/(2.5*(video?.78:1)));
  this.floor.position.y=this.rootY-.08;this.floor.scale.set(this.grassWidth+1.4,.48,1);
 }
 render(seconds,{mode=this.mode,reducedMotion=this.reducedMotion}={}){
  if(this.disposed)return null;this.time=Number.isFinite(seconds)?seconds:0;this.mode=mode==='video'?'video':'stage';const info=this.locate(this.time),stage=this.mode==='stage',still=!!reducedMotion;
  this.background.visible=stage&&!this.transparentStage;this.floor.visible=stage&&!this.transparentStage&&!!info;this.text.visible=!!info;this.grassLayers.forEach(l=>l.mesh.visible=!!info);
  const palette=MeadowPalettes[this.palette]||MeadowPalettes.forest;this.backMaterial.uniforms.uA.value.set(palette.background[0]);this.backMaterial.uniforms.uB.value.set(palette.background[1]);this.floorMaterial.uniforms.uColor.value.set(palette.floor);
  this.face.color.set(palette.text);this.bevel.color.set(palette.text).multiplyScalar(.96);this.side.color.set(palette.text).multiplyScalar(.68);
  if(info){
   const key=`${info.cueIndex}:${info.chunk}:${this.mode}:${this.display}:${this.textSize}`;if(key!==this.active){this.active=key;this.buildWords(info);}
   const tempo=Math.min(1,info.span/3.3),t=still?3:info.local/tempo,exit=still?0:mdClamp((info.local-info.span+.42*tempo)/(.42*tempo),0,1),enter=still?1:mdEase(t/.85);
   const fade=still?1:mdClamp(t/.32,0,1)*(1-exit);this.face.opacity=this.bevel.opacity=this.side.opacity=fade;
   this.words.forEach(word=>{const q=still?1:mdEase((t-word.index*.12)/.85);word.group.position.set(word.x,word.y-(1-q)*.46-exit*.12,-.015-(1-q)*.03);word.group.scale.set(word.scale,word.scale,word.scale*mdClamp(this.depth,.4,1.8));});
   const progress=still?1:mdClamp((t-.10)/(1.95/mdClamp(this.growth,.5,1.7)),0,1);
   for(const layer of this.grassLayers){const u=layer.material.uniforms;u.uTime.value=still?0:this.time*.78;u.uWind.value=still?0:mdClamp(this.wind,0,2.2);u.uProgress.value=progress;u.uDirection.value=this.direction==='right'?1:this.direction==='rise'?2:0;u.uWidth.value=this.grassWidth;u.uRoot.value=this.rootY;u.uFade.value=fade;u.uDensity.value=mdClamp(this.density,.3,1);u.uVideo.value=stage?1:.78;u.uHeight.value=layer.front?this.frontHeight:1;u.uBase.value.set(palette.grass[0]);u.uTip.value.set(palette.grass[1]);u.uDry.value.set(palette.grass[2]);}
   this.floorMaterial.uniforms.uFade.value=fade;
  }
  this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.camera);return info;
 }
 attachVideo(video,{mode='video'}={}){
  this.detachVideo?.();let id=0,dead=false;const rvfc=typeof video.requestVideoFrameCallback==='function',paint=()=>{if(!dead)this.render(video.currentTime,{mode});};
  const cancel=()=>{if(id){rvfc?video.cancelVideoFrameCallback(id):cancelAnimationFrame(id);id=0;}};
  const tick=(_,data)=>{if(dead)return;this.render(data?.mediaTime??video.currentTime,{mode});if(!video.paused&&!video.ended)id=rvfc?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);};
  const start=()=>{cancel();paint();if(!video.paused&&!video.ended)id=rvfc?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);};const stop=()=>{cancel();paint();};
  for(const [event,callback]of [['play',start],['pause',stop],['ended',stop],['seeked',paint],['loadedmetadata',paint]])video.addEventListener(event,callback);start();
  this.detachVideo=()=>{dead=true;cancel();for(const [event,callback]of [['play',start],['pause',stop],['ended',stop],['seeked',paint],['loadedmetadata',paint]])video.removeEventListener(event,callback);};return this.detachVideo;
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.detachVideo?.();this.clearWords();for(const g of this.cache.values())g.geometry?.dispose();this.cache.clear();this.face.dispose();this.bevel.dispose();this.side.dispose();this.grassLayers.forEach(l=>{l.geometry.dispose();l.material.dispose();});this.background.geometry.dispose();this.backMaterial.dispose();this.floor.geometry.dispose();this.floorMaterial.dispose();this.renderer.dispose();}
}
