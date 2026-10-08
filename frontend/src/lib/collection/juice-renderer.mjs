/** JUICE JAM — layered candy typography, elastic motion and procedural graphics. */
import * as THREE from './three.mjs';
import { HyperFonts } from './hyper-fonts.mjs';
import { HyperPalettes } from './hyper-palettes.mjs';
import { createJuiceMaterials } from './juice-material.mjs';

const hpClamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hpEase=t=>1-(1-hpClamp(t,0,1))**3;
function hpClone(source){const m=source.clone();m.onBeforeCompile=source.onBeforeCompile;m.customProgramCacheKey=source.customProgramCacheKey;m.transparent=true;return m;}
function hpFinish(geometry){
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
    const angle=den?Math.acos(hpClamp(v.dot(w)/den,-1,1)):0,k=key(at);keys[at]=k;const sum=sums.get(k)||new THREE.Vector3();sum.addScaledVector(new THREE.Vector3().fromBufferAttribute(nn,at),angle);sums.set(k,sum);}}
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

export class JuiceJamRenderer {
  constructor(canvas,{reducedMotion=false,depth=1,power=1,font='bubble',palette='mango',pixelRatio=Math.min(Math.max(globalThis.devicePixelRatio||1,1.7),2)}={}){
    this.canvas=canvas;this.depth=depth;this.power=power;this.font=font;this.palette=palette;this.reducedMotion=reducedMotion;this.pixelRatio=pixelRatio;this.pointer={x:0,y:0};this.cache=new Map();this.letters=[];this.cues=[];this.time=0;this.mode='stage';this.active='';this.disposed=false;
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});this.renderer.setClearColor(0,0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(30,1,.1,80);this.camera.position.z=8.7/(2*Math.tan(Math.PI/12));this.materials=createJuiceMaterials(THREE,this.renderer);
    this.text=new THREE.Group();this.scene.add(this.text);this.scene.add(new THREE.HemisphereLight('#f6e6ff','#171029',.72));const key=new THREE.DirectionalLight('#fff4de',1.1);key.position.set(-4,6,7);this.scene.add(key);const fill=new THREE.DirectionalLight('#83eaff',.6);fill.position.set(5,0,4);this.scene.add(fill);
    this.setupStage();this.resize();this.readyPromise=Promise.resolve(this);
  }
  ready(){return this.readyPromise;}
  setupStage(){
    this.backMaterial=new THREE.ShaderMaterial({depthWrite:false,uniforms:{uTime:{value:0},uAspect:{value:1},uBgA:{value:new THREE.Color()},uBgB:{value:new THREE.Color()},uBgC:{value:new THREE.Color()},uBgLine:{value:new THREE.Color()}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float uTime,uAspect;uniform vec3 uBgA,uBgB,uBgC,uBgLine;void main(){vec2 p=(vUv-.5)*vec2(uAspect,1.);float a=atan(p.y,p.x);float r=length(p);float rays=smoothstep(.70,.76,.5+.5*sin(a*10.+uTime*.075));vec3 color=mix(uBgA,uBgB,exp(-r*r*3.));color+=uBgC*rays*exp(-r*r*2.);float line=smoothstep(.46,.49,abs(fract((p.x+p.y)*3.5)-.5));color+=uBgLine*line;gl_FragColor=vec4(color,1.);\n#include <colorspace_fragment>\n}`});
    this.background=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.backMaterial);this.background.position.z=-6;this.scene.add(this.background);
    this.field=new THREE.Group();this.scene.add(this.field);this.fieldItems=[];this.fieldGeometries=[];
    const star=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.19:.44;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?star.lineTo(x,y):star.moveTo(x,y);}star.closePath();
    const bolt=new THREE.Shape();bolt.moveTo(0,.48);bolt.bezierCurveTo(.07,.27,.34,.04,.31,-.14);bolt.bezierCurveTo(.28,-.42,-.28,-.42,-.31,-.14);bolt.bezierCurveTo(-.34,.04,-.07,.27,0,.48);bolt.closePath();
    const geometries=[new THREE.TorusGeometry(.28,.080,8,20),new THREE.ExtrudeGeometry(star,{depth:.13,bevelEnabled:true,bevelSize:.024,bevelThickness:.024,bevelSegments:2,steps:1}),new THREE.ExtrudeGeometry(bolt,{depth:.10,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:2,steps:1})];this.fieldGeometries=geometries;
    let seed=34951;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<24;i++){const mesh=new THREE.Mesh(geometries[i%3],[this.materials.cyan,this.materials.pink,this.materials.orange][i%3]);this.field.add(mesh);this.fieldItems.push({mesh,angle:rand()*Math.PI*2,scale:.27+rand()*.40,phase:rand()*6,drift:rand()*.3,z:-.75-rand()*1.4,index:i});}
  }
  resize(width=this.canvas.clientWidth||736,height=this.canvas.clientHeight||560,pixelRatio=this.pixelRatio){this.width=Math.max(1,width);this.height=Math.max(1,height);this.pixelRatio=hpClamp(pixelRatio,1,3);this.renderer.setPixelRatio(this.pixelRatio);this.renderer.setSize(this.width,this.height,false);this.viewHeight=8.7;this.viewWidth=this.viewHeight*this.width/this.height;this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();this.background.scale.set(this.viewWidth*1.55,this.viewHeight*1.55,1);this.backMaterial.uniforms.uAspect.value=this.camera.aspect;this.active='';return this;}
  setCues(cues){this.cues=(cues||[]).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start&&typeof c.text==='string').map(c=>{const words=c.text.slice(0,1000).trim().split(/\s+/).filter(Boolean).map(w=>w.replace(/[.,!?;:„“"()]/g,'').toLocaleUpperCase()),groups=[];for(let i=0;i<words.length;i+=2)groups.push(words.slice(i,i+2));return{...c,text:c.text.slice(0,1000),groups};}).sort((a,b)=>a.start-b.start);this.active='';return this;}
  getDuration(){return this.cues.reduce((n,c)=>Math.max(n,c.end),0);}
  locate(time){const cueIndex=this.cues.findIndex(c=>time>=c.start&&time<c.end);if(cueIndex<0)return null;const cue=this.cues[cueIndex];if(!cue.groups.length)return null;const span=(cue.end-cue.start)/cue.groups.length,chunk=Math.min(cue.groups.length-1,Math.floor((time-cue.start)/span));return{cueIndex,chunk,span,local:time-cue.start-chunk*span,words:cue.groups[chunk],text:cue.text};}
  glyph(char,fontKey){const key=fontKey+':'+char;if(this.cache.has(key))return this.cache.get(key);const font=HyperFonts[fontKey]||HyperFonts.comic,source=font.glyphs[char]||font.glyphs['?'],unit=1/font.capHeight,path=new THREE.ShapePath();
    for(const [name,...v]of source.commands){const p=v.map(n=>n*unit);if(name==='M')path.moveTo(...p);else if(name==='L')path.lineTo(...p);else if(name==='Q')path.quadraticCurveTo(...p);else if(name==='C')path.bezierCurveTo(...p);else if(name==='Z')path.currentPath.closePath();}
    const shapes=path.toShapes(false),geometry=shapes.length?hpFinish(new THREE.ExtrudeGeometry(shapes,{depth:.30,bevelEnabled:true,bevelThickness:.056,bevelSize:.036,bevelSegments:5,curveSegments:14,steps:1})):null;
    if(geometry)geometry.translate(-source.advance*unit/2,-.5,0);const g={geometry,advance:source.advance*unit};this.cache.set(key,g);return g;}
  clearWords(){this.text.clear();for(const l of this.letters)l.mats.forEach(m=>m.dispose());this.letters=[];}
  clearCache(){this.clearWords();for(const g of this.cache.values())g.geometry?.dispose();this.cache.clear();}
  buildWords(info,mode){this.clearWords();const video=mode==='video',two=info.words.length>1;this.heroWidth=5;this.heroY=-.6;
    info.words.forEach((word,line)=>{const hero=!two||line===1,font=hero?(HyperFonts[this.font]?this.font:'comic'):'block',glyphs=[...word].map(c=>this.glyph(c,font)),spacing=.008,total=glyphs.reduce((n,g)=>n+g.advance+spacing,0)-spacing,scale=Math.min(hero?(video?1.32:1.92):(video?.70:1.02),this.viewWidth*(hero?.79:.51)/Math.max(.1,total)),stretch=hero?1.18:1.00,y=video?(hero?-2.75:-1.2):(hero?-1.17:1.52),center=hero?0:-this.viewWidth*.055;
      if(hero){this.heroWidth=total*scale;this.heroY=y+scale*stretch*.50;this.heroScale=scale;}
      let x=-total*scale/2+center;glyphs.forEach((g,index)=>{if(!g.geometry){x+=(g.advance+spacing)*scale;return;}
        const group=new THREE.Group(),mats=[this.materials.face,this.materials.bevel,this.materials.side].map(hpClone),front=new THREE.Mesh(g.geometry,mats);group.add(front);
        const layers=[];for(let j=0;j<3;j++){const material=hpClone([this.materials.ink,this.materials.orange,this.materials.cyan][j]),mesh=new THREE.Mesh(g.geometry,material);mesh.position.set(.010+j*.035,-.016-j*.013,-.24+j*.095);mesh.scale.set(j===0?1.075:1.045,j===0?1.075:1.045,.12);group.add(mesh);mats.push(material);layers.push(mesh);}
        this.text.add(group);this.letters.push({group,mats,layers,x:x+g.advance*scale/2,y:y+scale*stretch*.50,scale,stretch,index,line,hero,count:glyphs.length,phase:index*1.43+line*.86});x+=(g.advance+spacing)*scale;});});
  }
  render(time,{mode=this.mode,reducedMotion=this.reducedMotion}={}){
    if(this.disposed)return null;this.time=Number.isFinite(time)?time:0;this.mode=mode==='video'?'video':'stage';const stage=this.mode==='stage',info=this.locate(this.time),still=!!reducedMotion;
    this.background.visible=stage&&!this.transparentStage;this.text.visible=!!info;this.field.visible=false;this.backMaterial.uniforms.uTime.value=still?0:this.time;
    const palette=HyperPalettes[this.palette]||HyperPalettes.candy;['A','B','C','Line'].forEach((key,i)=>this.backMaterial.uniforms['uBg'+key].value.set(palette.background[i]));
    if(info){const key=`${info.cueIndex}:${info.chunk}:${this.mode}:${this.font}`;if(this.active!==key){this.active=key;this.buildWords(info,this.mode);}
      const power=hpClamp(this.power,.45,1.7),tempo=Math.min(1,info.span/2.8),t=still?1.9:info.local/tempo,exit=still?0:hpClamp((info.local-info.span+.38*tempo)/(.38*tempo),0,1),phase=still?.5:hpClamp((t-.6)/2.1,0,1),flow=still?0:this.time;
      this.materials.update(flow,{still,phase,extent:this.heroWidth,power,palette:this.palette});
      this.text.rotation.set(-.12+this.pointer.y*.018,-.22+this.pointer.x*.03,-.025);
      this.letters.forEach(l=>{const age=t-l.index*Math.min(.05,.4/l.count)-l.line*.13,q=still?1:hpClamp(age/.92,0,1),ease=still?1:1-Math.pow(1-q,3),open=1-ease;
        const arch=l.hero?.10*Math.cos((l.index/Math.max(1,l.count-1)-.5)*Math.PI):0;const bounce=still?0:Math.sin(q*Math.PI*3)*(1-q)**2*.30*power,wave=still?0:Math.sin(flow*2.15+l.phase)*.070*power,alpha=still?1:hpClamp(age/.16,0,1)*(1-exit);
        l.group.visible=alpha>.002;l.group.position.set(l.x+open*Math.sin(l.phase)*.35,l.y+arch-open*.75+bounce+wave+exit*Math.sin(l.phase)*.28,-.48-open*1.9-exit*.8);
        l.group.scale.set(l.scale*(1-open*.20),l.scale*l.stretch*(1+open*.17+bounce*.09),l.scale*hpClamp(this.depth,.5,1.8));
        l.group.rotation.set(open*.48,open*Math.cos(l.phase)*.60+exit*.35,(still?0:Math.sin(flow*1.35+l.phase)*.037)+open*Math.sin(l.phase)*.30);
        l.mats[4].color.copy(this.materials.orange.color);l.mats[5].color.copy(this.materials.cyan.color);
        l.mats.forEach(m=>m.opacity=alpha);l.layers.forEach((mesh,j)=>{mesh.position.x=.010+j*.035+(still?0:Math.sin(flow*1.3+l.phase+j)*.006)*power+open*(j-1)*.14;mesh.position.y=-.016-j*.013-open*j*.055;});});
      const radiusX=Math.min(this.viewWidth*.42,this.heroWidth*.5+.9),radiusY=stage?2.05:1.0,centreY=stage?.6:this.heroY+.35,fieldAlpha=still?1:hpClamp(t/.48,0,1)*(1-exit);
      this.fieldItems.forEach(item=>{const {mesh,angle,phase:indexPhase,scale,z,index}=item,a=angle+(still?0:flow*.11),burst=still?0:(1-hpClamp(t/1.2,0,1))*.65;
        mesh.visible=fieldAlpha>.005;mesh.position.set(Math.cos(a)*radiusX*(1+burst*.18),centreY+Math.sin(a)*radiusY*(1+burst*.30),z);mesh.scale.setScalar(scale*fieldAlpha*(stage?1:.65));mesh.rotation.set(indexPhase+flow*.3,flow*.32+index*.4,a+flow*.13);});
    }
    this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.camera);return info;
  }
  attachVideo(video,{mode='video'}={}){
    this.detachVideo?.();let id=0,dead=false;const rvfc=typeof video.requestVideoFrameCallback==='function',paint=()=>{if(!dead)this.render(video.currentTime,{mode});};const cancel=()=>{if(id){rvfc?video.cancelVideoFrameCallback(id):cancelAnimationFrame(id);id=0;}};
    const tick=(_,metadata)=>{if(dead)return;this.render(metadata?.mediaTime??video.currentTime,{mode});if(!video.paused&&!video.ended)id=rvfc?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);};const start=()=>{cancel();paint();if(!video.paused&&!video.ended)id=rvfc?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);},stop=()=>{cancel();paint();};
    video.addEventListener('play',start);video.addEventListener('pause',stop);video.addEventListener('ended',stop);video.addEventListener('seeked',paint);video.addEventListener('loadedmetadata',paint);start();
    this.detachVideo=()=>{dead=true;cancel();video.removeEventListener('play',start);video.removeEventListener('pause',stop);video.removeEventListener('ended',stop);video.removeEventListener('seeked',paint);video.removeEventListener('loadedmetadata',paint);};return this.detachVideo;
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.detachVideo?.();this.clearCache();this.materials.dispose();this.background.geometry.dispose();this.backMaterial.dispose();this.fieldGeometries.forEach(g=>g.dispose());this.renderer.dispose();}
}
