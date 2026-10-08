/** TITANIUM EDGE — genuine vector typography with crisp physical 3D surfaces.
 * Font outlines are embedded, licensed Barlow Condensed ExtraBold curves.
 * No raster text contours, texture noise, blur or chromatic distortion.
 */
import * as THREE from './three.mjs';
import { TitaniumFont } from './titanium-font.mjs';
import { createTitaniumMaterials } from './titanium-material.mjs';

const teClamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const teEase=t=>1-(1-teClamp(t,0,1))**3;
function teClone(source){const m=source.clone();m.onBeforeCompile=source.onBeforeCompile;m.customProgramCacheKey=source.customProgramCacheKey;m.transparent=true;return m;}
function teFinish(geometry){
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
    const angle=den?Math.acos(teClamp(v.dot(w)/den,-1,1)):0,k=key(at);keys[at]=k;const sum=sums.get(k)||new THREE.Vector3();sum.addScaledVector(new THREE.Vector3().fromBufferAttribute(nn,at),angle);sums.set(k,sum);}}
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

export class TitaniumCaptionRenderer {
  constructor(canvas,{reducedMotion=false,depth=1,power=1,pixelRatio=Math.min(Math.max(globalThis.devicePixelRatio||1,2),2.5)}={}){
    this.canvas=canvas;this.depth=depth;this.power=power;this.reducedMotion=reducedMotion;this.pixelRatio=pixelRatio;this.pointer={x:0,y:0};this.cache=new Map();this.letters=[];this.cues=[];this.time=0;this.mode='stage';this.active='';this.disposed=false;
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setClearColor(0x000000,0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.98;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog('#121e2e',24,65);this.camera=new THREE.PerspectiveCamera(28,1,.1,90);this.camera.position.set(0,.13,8.4/(2*Math.tan(14*Math.PI/180)));this.camera.lookAt(0,.13,0);
    this.materials=createTitaniumMaterials(THREE,this.renderer);this.text=new THREE.Group();this.scene.add(this.text);
    this.scene.add(new THREE.HemisphereLight('#d4eaff','#101a36',.42));
    this.key=new THREE.DirectionalLight('#edf8ff',1.35);this.key.position.set(-4,7,7);this.key.castShadow=true;this.key.shadow.mapSize.set(2048,2048);this.key.shadow.camera.left=-12;this.key.shadow.camera.right=12;this.key.shadow.camera.top=8;this.key.shadow.camera.bottom=-8;this.key.shadow.camera.near=.1;this.key.shadow.camera.far=35;this.key.shadow.bias=-.00025;this.key.shadow.normalBias=.012;this.scene.add(this.key);
    const fill=new THREE.DirectionalLight('#7eacff',.65);fill.position.set(5,1,5);this.scene.add(fill);
    const rim=new THREE.DirectionalLight('#79efff',.8);rim.position.set(0,3,-5);this.scene.add(rim);
    this.setupStage();this.resize();this.readyPromise=Promise.resolve(this);
  }
  ready(){return this.readyPromise;}
  setupStage(){
    this.backMaterial=new THREE.ShaderMaterial({depthWrite:false,uniforms:{uAspect:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform float uAspect;void main(){vec2 p=(vUv-.5)*vec2(uAspect,1.);float soft=exp(-dot(p-vec2(-.34,.25),p-vec2(-.34,.25))*3.6);vec3 color=mix(vec3(.003,.006,.015),vec3(.024,.048,.082),soft);gl_FragColor=vec4(color,1.);#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
    this.background=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.backMaterial);this.background.position.z=-7;this.scene.add(this.background);
    this.floorMaterial=new THREE.MeshStandardMaterial({color:'#070e1c',roughness:.64,metalness:.08,envMap:this.materials.face.envMap,envMapIntensity:.14,transparent:true,depthWrite:false});
    this.floorMaterial.onBeforeCompile=shader=>{shader.vertexShader='varying float vTitaniumFloorDepth;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvTitaniumFloorDepth = -mvPosition.z;');shader.fragmentShader='varying float vTitaniumFloorDepth;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a *= 1.0 - smoothstep(23.0, 60.0, vTitaniumFloorDepth);\n#include <opaque_fragment>');};
    this.floor=new THREE.Mesh(new THREE.PlaneGeometry(200,180),this.floorMaterial);this.floor.rotation.x=-Math.PI/2;this.floor.position.set(0,-2.48,-35);this.floor.receiveShadow=true;this.scene.add(this.floor);
    this.effects=new THREE.Group();this.scene.add(this.effects);this.rails=new THREE.Group();this.effects.add(this.rails);
    this.railMaterial=new THREE.MeshBasicMaterial({color:'#133b53',transparent:true,opacity:.55});this.runnerMaterial=new THREE.MeshBasicMaterial({color:'#7de8ff',transparent:true,opacity:.8});
    for(let i=0;i<2;i++){const rail=new THREE.Mesh(new THREE.BoxGeometry(1,.012,.015),this.railMaterial);rail.position.set(0,-1.4-i*.105,-.55);this.rails.add(rail);}
    this.runner=new THREE.Mesh(new THREE.BoxGeometry(.8,.018,.025),this.runnerMaterial);this.runner.position.set(0,-1.4,-.50);this.rails.add(this.runner);
    // Sharp, short-lived star glints. They never blur or distort the letter edges.
    this.glintGeometry=new THREE.PlaneGeometry(1,1);this.glints=[];
    for(let i=0;i<4;i++){const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uAlpha:{value:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform float uAlpha;void main(){vec2 p=abs((vUv-.5)*2.);float core=exp(-dot(p,p)*180.);float a=exp(-p.x*p.x*780.)*max(0.,1.-p.y);float b=exp(-p.y*p.y*780.)*max(0.,1.-p.x);float alpha=clamp(core+a+b,0.,1.)*uAlpha;gl_FragColor=vec4(vec3(.8,.95,1.),alpha);}`});
      const glint=new THREE.Mesh(this.glintGeometry,material);glint.renderOrder=6;this.effects.add(glint);this.glints.push(glint);}
  }
  resize(width=this.canvas.clientWidth||736,height=this.canvas.clientHeight||560,pixelRatio=this.pixelRatio){
    this.width=Math.max(1,width);this.height=Math.max(1,height);this.pixelRatio=teClamp(pixelRatio,1,3);this.renderer.setPixelRatio(this.pixelRatio);this.renderer.setSize(this.width,this.height,false);
    this.viewHeight=8.4;this.viewWidth=this.viewHeight*this.width/this.height;this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();this.background.scale.set(this.viewWidth*1.5,this.viewHeight*1.5,1);this.backMaterial.uniforms.uAspect.value=this.camera.aspect;this.active='';return this;
  }
  setCues(cues){this.cues=(cues||[]).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start&&typeof c.text==='string').map(c=>{
    const words=c.text.slice(0,1000).trim().split(/\s+/).filter(Boolean).map(w=>w.replace(/[.,!?;:„“"()]/g,'').toLocaleUpperCase()),groups=[];for(let i=0;i<words.length;i+=2)groups.push(words.slice(i,i+2));return{...c,text:c.text.slice(0,1000),groups};}).sort((a,b)=>a.start-b.start);this.active='';return this;}
  getDuration(){return this.cues.reduce((n,c)=>Math.max(n,c.end),0);}
  locate(time){const cueIndex=this.cues.findIndex(c=>time>=c.start&&time<c.end);if(cueIndex<0)return null;const cue=this.cues[cueIndex];if(!cue.groups.length)return null;const span=(cue.end-cue.start)/cue.groups.length,chunk=Math.min(cue.groups.length-1,Math.floor((time-cue.start)/span));return{cueIndex,chunk,span,local:time-cue.start-chunk*span,words:cue.groups[chunk],text:cue.text};}
  glyph(char){
    if(this.cache.has(char))return this.cache.get(char);const source=TitaniumFont.glyphs[char]||TitaniumFont.glyphs['?'],path=new THREE.ShapePath(),unit=1/TitaniumFont.capHeight;
    for(const command of source.commands){const [name,...v]=command;const p=v.map(n=>n*unit);if(name==='M')path.moveTo(...p);else if(name==='L')path.lineTo(...p);else if(name==='Q')path.quadraticCurveTo(...p);else if(name==='C')path.bezierCurveTo(...p);else if(name==='Z')path.currentPath.closePath();}
    const shapes=path.toShapes(false),geometry=shapes.length?teFinish(new THREE.ExtrudeGeometry(shapes,{depth:.52,bevelEnabled:true,bevelThickness:.037,bevelSize:.026,bevelSegments:6,curveSegments:20,steps:1})):null;
    const lines=[];for(const shape of shapes)for(const points of [shape.getPoints(32),...shape.holes.map(h=>h.getPoints(32))])for(const z of [.105,.31])for(let i=1;i<points.length;i++)lines.push(points[i-1].x,points[i-1].y,z,points[i].x,points[i].y,z);
    const inlay=new THREE.BufferGeometry();inlay.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));const g={geometry,inlay,advance:source.advance*unit};this.cache.set(char,g);return g;
  }
  clearWords(){this.text.clear();for(const l of this.letters){l.mats.forEach(m=>m.dispose());l.inlay.material.dispose();}this.letters=[];}
  clearCache(){this.clearWords();for(const g of this.cache.values()){g.geometry?.dispose();g.inlay.dispose();}this.cache.clear();}
  buildWords(info,mode){
    this.clearWords();const video=mode==='video',two=info.words.length>1;this.heroWidth=1;this.heroY=-1.10;this.heroScale=1;
    info.words.forEach((word,line)=>{const glyphs=[...word].map(c=>this.glyph(c)),hero=!two||line===1,spacing=.013,total=glyphs.reduce((n,g)=>n+g.advance+spacing,0)-spacing,available=this.viewWidth*(hero?.85:.57);
      const scale=Math.min(hero?(video?1.45:2.66):(video?.71:1.10),available/Math.max(.1,total)),y=video?(hero?-2.9:-1.30):(hero?-1.08:2.05),center=hero?0:-this.viewWidth*.026;
      if(hero){this.heroWidth=total*scale;this.heroY=y;this.heroScale=scale;}
      let x=-total*scale/2+center;glyphs.forEach((g,index)=>{if(!g.geometry){x+=(g.advance+spacing)*scale;return;}
        const group=new THREE.Group(),mats=[this.materials.face,this.materials.bevel,this.materials.side].map(teClone),mesh=new THREE.Mesh(g.geometry,mats);mesh.castShadow=true;mesh.receiveShadow=false;group.add(mesh);
        const inlay=new THREE.LineSegments(g.inlay,new THREE.LineBasicMaterial({color:'#41b8df',transparent:true,opacity:.5}));group.add(inlay);this.text.add(group);
        this.letters.push({group,mats,inlay,x,y,scale,index,line,hero,count:glyphs.length});x+=(g.advance+spacing)*scale;});});
    this.rails.children.slice(0,2).forEach(m=>m.scale.x=this.heroWidth*.92);this.rails.position.y=this.heroY-.25+1.4;this.rails.position.z=-.7;
  }
  render(time,{mode=this.mode,reducedMotion=this.reducedMotion}={}){
    if(this.disposed)return null;this.time=Number.isFinite(time)?time:0;this.mode=mode==='video'?'video':'stage';const stage=this.mode==='stage',info=this.locate(this.time),still=!!reducedMotion;
    this.background.visible=stage&&!this.transparentStage;this.floor.visible=stage&&!this.transparentStage;this.effects.visible=stage&&!!info;this.text.visible=!!info;this.key.castShadow=stage;
    if(info){const key=`${info.cueIndex}:${info.chunk}:${this.mode}`;if(this.active!==key){this.active=key;this.buildWords(info,this.mode);}
      const tempo=Math.min(1,info.span/2.6),t=still?1.9:info.local/tempo,exit=still?0:teClamp((info.local-info.span+.36*tempo)/(.36*tempo),0,1),power=teClamp(this.power,.45,1.7),phase=still?.5:teClamp((t-.65)/2.0,0,1);
      this.materials.update(still?0:this.time,{phase,still,extent:this.heroWidth,center:0,intensity:power});
      // The settled angle reveals real extrusion walls without foreshortening words.
      this.text.rotation.set(stage?.075+this.pointer.y*.015:.035,stage?-.22+this.pointer.x*.025:-.11,stage?-.022:0);
      const depth=teClamp(this.depth,.5,1.8);
      this.letters.forEach(l=>{const age=t-l.index*Math.min(.045,.4/l.count)-l.line*.13,q=still?1:teEase(age/1.03),travel=1-q,alpha=still?1:teClamp(age/.22,0,1)*(1-exit);
        l.group.visible=alpha>.002;l.group.position.set(l.x+exit*.12,l.y-travel*.65+exit*.20,-.72-travel*1.6-exit*.65);
        l.group.scale.set(l.scale,l.scale,l.scale*depth);l.group.rotation.set(travel*.22,-travel*.6+exit*.14,travel*.035*(l.index%2?1:-1));
        l.mats.forEach(m=>m.opacity=alpha);l.inlay.material.opacity=alpha*(.34+.11*Math.sin(phase*Math.PI))*power;});
      this.runner.position.x=(phase-.5)*this.heroWidth*.95;this.runnerMaterial.opacity=still?.45:(1-exit)*(.45+.35*Math.sin(phase*Math.PI));this.railMaterial.opacity=(1-exit)*.42;
      this.glints.forEach((g,i)=>{const p=still?0:Math.max(0,1-Math.abs(t-(1.14+i*.23))/.21)*(1-exit);g.material.uniforms.uAlpha.value=p*.58;g.visible=p>.002;
        g.position.set((i/3-.5)*this.heroWidth*.80,this.heroY+this.heroScale*(i%2?.83:.13),.91*depth);g.scale.setScalar(.35+power*.14);});
    }
    this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.camera);return info;
  }
  attachVideo(video,{mode='video'}={}){
    this.detachVideo?.();let id=0,dead=false;const rvfc=typeof video.requestVideoFrameCallback==='function',paint=()=>{if(!dead)this.render(video.currentTime,{mode});};
    const cancel=()=>{if(id){rvfc?video.cancelVideoFrameCallback(id):cancelAnimationFrame(id);id=0;}};
    const tick=(_,metadata)=>{if(dead)return;this.render(metadata?.mediaTime??video.currentTime,{mode});if(!video.paused&&!video.ended)id=rvfc?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);};
    const start=()=>{cancel();paint();if(!video.paused&&!video.ended)id=rvfc?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);},stop=()=>{cancel();paint();};
    video.addEventListener('play',start);video.addEventListener('pause',stop);video.addEventListener('ended',stop);video.addEventListener('seeked',paint);video.addEventListener('loadedmetadata',paint);start();
    this.detachVideo=()=>{dead=true;cancel();video.removeEventListener('play',start);video.removeEventListener('pause',stop);video.removeEventListener('ended',stop);video.removeEventListener('seeked',paint);video.removeEventListener('loadedmetadata',paint);};return this.detachVideo;
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.detachVideo?.();this.clearCache();this.materials.dispose();this.background.geometry.dispose();this.backMaterial.dispose();this.floor.geometry.dispose();this.floorMaterial.dispose();this.rails.children.forEach(m=>m.geometry.dispose());this.railMaterial.dispose();this.runnerMaterial.dispose();this.glintGeometry.dispose();this.glints.forEach(g=>g.material.dispose());this.key.shadow.map?.dispose();this.renderer.dispose();}
}
