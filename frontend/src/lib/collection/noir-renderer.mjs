/** ATELIER NOIR — real beveled typography with procedural studio materials.
 * ES module; Three.js 0.169.0, local noir-material.js, Google Font Cinzel700.
 * const subs = new NoirCaptionRenderer(canvas);
 * subs.setCues([{start:0,end:6,text:'Your caption here'}]); await subs.ready();
 * subs.render(seconds,{mode:'video'}); // transparent overlay, stable video clock
 */
import * as THREE from './three.mjs';
import { createNoirMaterials } from './noir-material.mjs';

const nrClamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const nrBase=400,nrPad=44,nrBaseline=442;
function nrArea(p){let a=0;for(let i=0,j=p.length-1;i<p.length;j=i++)a+=p[j][0]*p[i][1]-p[i][0]*p[j][1];return a/2;}
function nrInside(poly,p){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
}return hit;}
function nrSimplify(points,tolerance=.55){
  if(points.length<4)return points;
  const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;let max=0,index=0;
  for(let i=1;i<points.length-1;i++){const p=points[i],t=den?nrClamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den,0,1):0;
    const d=(p[0]-a[0]-dx*t)**2+(p[1]-a[1]-dy*t)**2;if(d>max){max=d;index=i;}}
  if(max>tolerance*tolerance)return nrSimplify(points.slice(0,index+1),tolerance).slice(0,-1).concat(nrSimplify(points.slice(index),tolerance));
  return[a,b];
}
function nrContours(mask,w,h){
  const edges=new Map(),on=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x];
  const add=(x,y,xx,yy)=>{const k=x+','+y;let e=edges.get(k);if(!e){e=[];edges.set(k,e);}e.push([xx,yy]);};
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(on(x,y)){
    if(!on(x,y-1))add(x,y,x+1,y);if(!on(x+1,y))add(x+1,y,x+1,y+1);
    if(!on(x,y+1))add(x+1,y+1,x,y+1);if(!on(x-1,y))add(x,y+1,x,y);
  }
  const contours=[];
  while(edges.size){const first=edges.keys().next().value,points=[first.split(',').map(Number)];let at=first;
    for(let n=0;n<30000;n++){const e=edges.get(at);if(!e?.length)break;const p=e.pop();if(!e.length)edges.delete(at);points.push(p);at=p.join(',');if(at===first)break;}
    if(points.length>5){const poly=nrSimplify(points).slice(0,-1).map(([x,y])=>[(x-nrPad)/nrBase,(nrBaseline-y)/nrBase]);if(poly.length>=3&&Math.abs(nrArea(poly))>.00002)contours.push(poly);}
  }
  const outers=contours.filter(p=>nrArea(p)<0),holes=contours.filter(p=>nrArea(p)>0);
  const shapes=outers.map(p=>{const s=new THREE.Shape(p.map(([x,y])=>new THREE.Vector2(x,y)));s.closePath();return s;});
  for(const p of holes){let parent=-1,small=Infinity;outers.forEach((o,i)=>{const a=Math.abs(nrArea(o));if(a<small&&nrInside(o,p[0])){parent=i;small=a;}});
    if(parent>=0){const path=new THREE.Path(p.map(([x,y])=>new THREE.Vector2(x,y)));path.closePath();shapes[parent].holes.push(path);}}
  return shapes;
}
// Keep face, rounded bevel and vertical depth as three genuinely different materials.
function nrMaterialGroups(geometry){
  const normals=geometry.attributes.normal;geometry.clearGroups();let start=0,previous=-1;
  for(let i=0;i<normals.count;i+=3){const z=(normals.getZ(i)+normals.getZ(i+1)+normals.getZ(i+2))/3;
    const material=z>.998?0:z>.02?1:2;
    if(material!==previous){if(previous>=0)geometry.addGroup(start,i-start,previous);start=i;previous=material;}}
  if(previous>=0)geometry.addGroup(start,normals.count-start,previous);return geometry;
}
function nrPolishBevel(geometry){
  const p=geometry.attributes.position,n=geometry.attributes.normal,sums=new Map(),keys=new Array(p.count);
  const key=i=>`${Math.round(p.getX(i)*1e5)},${Math.round(p.getY(i)*1e5)},${Math.round(p.getZ(i)*1e5)}`;
  for(let i=0;i<p.count;i+=3){
    const nz=n.getZ(i);if(Math.abs(nz)>.998)continue;
    for(let j=0;j<3;j++){
      const at=i+j,b=i+(j+1)%3,c=i+(j+2)%3;
      const bx=p.getX(b)-p.getX(at),by=p.getY(b)-p.getY(at),bz=p.getZ(b)-p.getZ(at);
      const cx=p.getX(c)-p.getX(at),cy=p.getY(c)-p.getY(at),cz=p.getZ(c)-p.getZ(at);
      const denom=Math.hypot(bx,by,bz)*Math.hypot(cx,cy,cz),angle=denom?Math.acos(nrClamp((bx*cx+by*cy+bz*cz)/denom,-1,1)):0;
      const k=key(at);keys[at]=k;let v=sums.get(k);if(!v){v=[0,0,0];sums.set(k,v);}v[0]+=n.getX(at)*angle;v[1]+=n.getY(at)*angle;v[2]+=n.getZ(at)*angle;
    }
  }
  for(let i=0;i<n.count;i++){const v=sums.get(keys[i]);if(v){const len=Math.hypot(...v)||1;n.setXYZ(i,v[0]/len,v[1]/len,v[2]/len);}}
  n.needsUpdate=true;return geometry;
}
function nrClone(material,opacity=1){const m=material.clone();m.onBeforeCompile=material.onBeforeCompile;m.customProgramCacheKey=material.customProgramCacheKey;m.transparent=true;m.opacity=opacity;return m;}

// The glyph's own distance field rounds the face of every stem. Studio cards
// then reflect across curved surfaces instead of lighting one flat text plane.
function nrReliefTexture(mask,w,h){
  const d=new Float32Array(w*h),diag=Math.SQRT2;
  for(let i=0;i<d.length;i++)d[i]=mask[i]?1000:0;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(d[i])d[i]=Math.min(d[i],d[i-1]+1,d[i-w]+1,d[i-w-1]+diag,d[i-w+1]+diag);}
  let max=1;
  for(let y=h-2;y>=1;y--)for(let x=w-2;x>=1;x--){const i=y*w+x;if(d[i])d[i]=Math.min(d[i],d[i+1]+1,d[i+w]+1,d[i+w+1]+diag,d[i+w-1]+diag);if(d[i]>max)max=d[i];}
  const smooth=new Float32Array(w*h);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;
    smooth[i]=(d[i]*4+(d[i-1]+d[i+1]+d[i-w]+d[i+w])*2+d[i-w-1]+d[i-w+1]+d[i+w-1]+d[i+w+1])/16;}
  const c=document.createElement('canvas');c.width=w;c.height=h;const cx=c.getContext('2d'),image=cx.createImageData(w,h),radius=Math.max(3,max*.70);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x,j=i*4;let nx=0,ny=0;
    if(mask[i]&&x>0&&y>0&&x<w-1&&y<h-1){
      const profile=.88*Math.exp(-smooth[i]/radius),dx=(smooth[i+1]-smooth[i-1])*.5,dy=(smooth[i+w]-smooth[i-w])*.5;
      nx=-dx*profile;ny=dy*profile;
      // Fine brushed grooves and a barely visible engraved curved grain.
      ny+=.012*Math.sin(y*2.25+x*.017)+.013*Math.sin(y*.23+x*.08+Math.sin(x*.022)*2.4);
    }
    const len=Math.hypot(nx,ny,1);image.data[j]=Math.round((nx/len*.5+.5)*255);image.data[j+1]=Math.round((ny/len*.5+.5)*255);image.data[j+2]=Math.round((1/len*.5+.5)*255);image.data[j+3]=255;
  }
  cx.putImageData(image,0,0);const texture=new THREE.CanvasTexture(c);texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  texture.repeat.set(nrBase/w,nrBase/h);texture.offset.set(nrPad/w,1-nrBaseline/h);return texture;
}

export class NoirCaptionRenderer {
  constructor(canvas,{reducedMotion=false,depth=1,pixelRatio=Math.min(Math.max(globalThis.devicePixelRatio||1,1.6),2)}={}){
    this.canvas=canvas;this.reducedMotion=reducedMotion;this.depth=depth;this.pixelRatio=pixelRatio;this.font='700 400px Cinzel, Georgia, serif';
    this.cues=[];this.cache=new Map();this.letters=[];this.active='';this.time=0;this.mode='studio';this.disposed=false;this.pointer={x:0,y:0};
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setClearColor(0x000000,0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.98;
    this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-7,7,4.4,-4.4,.1,70);this.camera.position.set(0,0,20);
    this.materials=createNoirMaterials(THREE,this.renderer);this.text=new THREE.Group();this.reflection=new THREE.Group();this.scene.add(this.text,this.reflection);
    this.scene.add(new THREE.HemisphereLight('#eaf3ff','#181922',.42));
    const key=new THREE.DirectionalLight('#fff2dd',1.05);key.position.set(-4,5,8);this.scene.add(key);
    const fill=new THREE.DirectionalLight('#a9c2e3',.55);fill.position.set(6,-1,6);this.scene.add(fill);
    this.studio=new THREE.Group();this.scene.add(this.studio);this.setupStudio();this.resize();this.readyPromise=this.loadFont();
  }
  setupStudio(){
    this.backgroundMaterial=new THREE.ShaderMaterial({depthWrite:false,depthTest:false,toneMapped:false,uniforms:{uTime:{value:0},uAspect:{value:1}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform float uTime,uAspect;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){vec2 p=(vUv-.5)*vec2(uAspect,1.);vec3 color=vec3(.035,.052,.079);
          float upper=exp(-dot((p-vec2(-.30,.30))*vec2(.8,1.2),(p-vec2(-.30,.30))*vec2(.8,1.2))*3.);
          color+=vec3(.025,.028,.031)*upper;
          float fold=p.y+.23+p.x*.15+.065*sin(p.x*2.8+uTime*.065);
          color+=vec3(.034,.048,.067)*exp(-pow(fold/.20,2.))*smoothstep(-.65,.3,p.x);
          color+=vec3(.020,.024,.030)*exp(-pow((fold+.018)/.012,2.))*.22;
          color+=vec3(.018,.013,.007)*exp(-dot(p-vec2(-.6,.17),p-vec2(-.6,.17))*6.);
          color+=(hash(gl_FragCoord.xy)-.5)*.0020;
          float vignette=1.-smoothstep(.20,1.0,length(p*vec2(.7,1.)))*.40;color*=vignette;
          gl_FragColor=vec4(color,1.);
        }`});
    this.background=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.backgroundMaterial);this.background.renderOrder=-10;this.background.position.z=-4;this.studio.add(this.background);
    const shadowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;float a=exp(-dot(p*vec2(1.05,2.7),p*vec2(1.05,2.7))*2.4)*.40;gl_FragColor=vec4(.0,.0,.0,a);}'});
    this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),shadowMaterial);this.shadow.position.set(0,-1.42,-.95);this.studio.add(this.shadow);
    this.line=new THREE.Mesh(new THREE.PlaneGeometry(1,.012),nrClone(this.materials.trim,.68));this.line.position.set(0,.99,-.3);this.studio.add(this.line);
  }
  async loadFont(){

    try{const fonts=await document.fonts.load('700 400px Cinzel','ABCDEFGHIJKLMNOPQRSTUVWXYZČĆĐŠŽabcdefghijklmnopqrstuvwxyzčćđšž');
      if(fonts.length&&!this.disposed){this.font='700 400px Cinzel, Georgia, serif';this.clearCache();this.active='';this.render(this.time,{mode:this.mode});}}
    catch{}return this;
  }
  ready(){return this.readyPromise;}
  resize(width=this.canvas.clientWidth||736,height=this.canvas.clientHeight||500,pixelRatio=this.pixelRatio){
    this.width=Math.max(1,width);this.height=Math.max(1,height);this.pixelRatio=nrClamp(pixelRatio,1,2);this.renderer.setPixelRatio(this.pixelRatio);this.renderer.setSize(this.width,this.height,false);
    this.viewHeight=8.8;this.viewWidth=this.viewHeight*this.width/this.height;this.camera.left=-this.viewWidth/2;this.camera.right=this.viewWidth/2;this.camera.top=4.4;this.camera.bottom=-4.4;this.camera.updateProjectionMatrix();
    this.background.scale.set(this.viewWidth,this.viewHeight,1);this.backgroundMaterial.uniforms.uAspect.value=this.width/this.height;
    this.active='';return this;
  }
  setCues(cues){
    this.cues=(cues||[]).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start&&typeof c.text==='string').map(c=>{
      const words=c.text.slice(0,1000).trim().split(/\s+/).filter(Boolean).map(w=>w.replace(/[.,!?;:„“"()]/g,'').toLocaleUpperCase()),groups=[];
      for(let i=0;i<words.length;i+=2)groups.push(words.slice(i,i+2));return{...c,text:c.text.slice(0,1000),groups};}).sort((a,b)=>a.start-b.start);this.active='';return this;
  }
  getDuration(){return this.cues.reduce((n,c)=>Math.max(n,c.end),0);}
  locate(time){
    const cueIndex=this.cues.findIndex(c=>time>=c.start&&time<c.end);if(cueIndex<0)return null;
    const cue=this.cues[cueIndex];if(!cue.groups.length)return null;const span=(cue.end-cue.start)/cue.groups.length;
    const chunk=Math.min(cue.groups.length-1,Math.floor((time-cue.start)/span));return{cueIndex,chunk,span,local:time-cue.start-chunk*span,words:cue.groups[chunk],text:cue.text};
  }
  glyph(char){
    if(this.cache.has(char))return this.cache.get(char);
    const maskCanvas=document.createElement('canvas'),ctx=maskCanvas.getContext('2d',{willReadFrequently:true});ctx.font=this.font;const advance=ctx.measureText(char).width;
    maskCanvas.width=Math.ceil(advance+nrPad*2);maskCanvas.height=560;ctx.font=this.font;ctx.fillStyle='#fff';ctx.fillText(char,nrPad,nrBaseline);
    const data=ctx.getImageData(0,0,maskCanvas.width,maskCanvas.height).data,mask=new Uint8Array(maskCanvas.width*maskCanvas.height);
    for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3]>127?1:0;
    const shapes=nrContours(mask,maskCanvas.width,maskCanvas.height);
    const geometry=shapes.length?nrPolishBevel(nrMaterialGroups(new THREE.ExtrudeGeometry(shapes,{depth:.155,bevelEnabled:true,bevelThickness:.025,bevelSize:.010,bevelSegments:4,curveSegments:8,steps:1}))):null;
    const normalMap=nrReliefTexture(mask,maskCanvas.width,maskCanvas.height);
    const g={geometry,normalMap,advance:advance/nrBase};this.cache.set(char,g);return g;
  }
  clearWords(){
    this.text.clear();this.reflection.clear();for(const item of this.letters){item.mats.forEach(m=>m.dispose());item.reflectionMats?.forEach(m=>m.dispose());}this.letters=[];
  }
  clearCache(){this.clearWords();for(const g of this.cache.values()){g.geometry?.dispose();g.normalMap?.dispose();}this.cache.clear();}
  buildWords(info,mode){
    this.clearWords();const video=mode==='video',two=info.words.length>1;this.heroWidth=1;this.heroCenter=0;
    info.words.forEach((word,line)=>{
      const glyphs=[...word].map(c=>this.glyph(c)),hero=!two||line===1,spacing=.020;
      const total=glyphs.reduce((s,g)=>s+g.advance+spacing,0)-spacing;
      const avail=this.viewWidth*(video?.85:hero?.82:.44);
      const scale=Math.min(hero?(video?1.60:3.25):(video?.83:1.52),avail/Math.max(total,.1));
      const y=video?(hero?-2.79:-1.32):(hero?-1.16:1.48),center=video?0:hero?.10:-this.viewWidth*.045;
      if(hero){this.heroWidth=total*scale;this.heroCenter=center;this.shadow.scale.set(this.heroWidth*1.15,.48,1);this.shadow.position.x=center;}
      let x=-total*scale/2+center;
      glyphs.forEach((g,i)=>{
        if(!g.geometry){x+=(g.advance+spacing)*scale;return;}
        const mats=[this.materials.face,this.materials.bevel,this.materials.side].map(m=>nrClone(m));mats[0].normalMap=g.normalMap;mats[0].normalScale.set(.85,.85);const mesh=new THREE.Mesh(g.geometry,mats);
        this.text.add(mesh);const item={mesh,mats,x,y,scale,index:i,line,hero};
        if(hero&&!video){const reflectionMats=[this.materials.face,this.materials.bevel,this.materials.side].map(m=>{const clone=nrClone(m,.063);clone.depthWrite=false;return clone;});reflectionMats[0].normalMap=g.normalMap;reflectionMats[0].normalScale.set(.85,.85);
          const reflectionMesh=new THREE.Mesh(g.geometry,reflectionMats);this.reflection.add(reflectionMesh);item.reflectionMesh=reflectionMesh;item.reflectionMats=reflectionMats;}
        this.letters.push(item);x+=(g.advance+spacing)*scale;
      });
    });
    this.line.scale.x=Math.min(1.65,this.viewWidth*.20);this.line.position.x=-this.viewWidth*.045;
  }
  render(time,{mode=this.mode,reducedMotion=this.reducedMotion}={}){
    if(this.disposed)return null;this.time=Number.isFinite(time)?time:0;this.mode=mode==='video'?'video':'studio';
    const info=this.locate(this.time),studio=this.mode==='studio';this.studio.visible=studio&&!this.transparentStage;this.reflection.visible=studio&&!!info;this.text.visible=!!info;
    if(!info){this.renderer.render(this.scene,this.camera);return null;}
    const key=info.cueIndex+':'+info.chunk+':'+this.mode;if(this.active!==key){this.active=key;this.buildWords(info,this.mode);}
    const still=!!reducedMotion,tempo=Math.min(1,info.span/2.4),t=still?1.7:info.local/tempo;
    const exitSpan=.30*tempo,exit=still?0:nrClamp((info.local-info.span+exitSpan)/exitSpan,0,1);
    const sweep=still?.5:nrClamp((t-.76)/1.14,0,1);
    this.materials.update(still?0:this.time,{sweep,still,extent:this.heroWidth,center:this.heroCenter});
    this.backgroundMaterial.uniforms.uTime.value=still?0:this.time;
    this.text.rotation.set(studio?-.105+this.pointer.y*.018:-.045,studio?-.14+this.pointer.x*.032:-.045,0);
    this.reflection.rotation.y=this.text.rotation.y;
    this.letters.forEach(item=>{
      const age=t-item.index*.060-item.line*.11,q=still?1:nrClamp(age/.62,0,1),ease=1-(1-q)**3,opacity=still?1:nrClamp(age/.21,0,1)*(1-exit);
      const recede=1-ease;item.mesh.visible=opacity>.002;
      item.mesh.position.set(item.x+exit*.09,item.y-recede*.42+exit*.16,-.180-recede*.45-exit*.20);
      item.mesh.rotation.set(recede*.075,(-recede*.13)+(exit*.13),0);
      item.mesh.scale.set(item.scale,item.scale,item.scale*nrClamp(this.depth,.45,1.8));item.mats.forEach(m=>m.opacity=opacity);
      if(item.reflectionMesh){const reflection=item.reflectionMesh;reflection.visible=opacity>.03;
        reflection.position.set(item.x,-1.44-recede*.05,-.45);reflection.scale.set(item.scale,-item.scale*.19,item.scale*.35);
        item.reflectionMats.forEach(m=>m.opacity=opacity*.052);}
    });
    const lineReveal=still?1:nrClamp((t-.38)/.65,0,1);this.line.scale.x=Math.min(1.65,this.viewWidth*.20)*lineReveal;this.line.material.opacity=.55*(1-exit);
    this.renderer.render(this.scene,this.camera);return info;
  }
  attachVideo(video,{mode='video'}={}){
    this.detachVideo?.();let id=0,dead=false;const rvfc=typeof video.requestVideoFrameCallback==='function';
    const paint=()=>{if(!dead)this.render(video.currentTime,{mode});};
    const cancel=()=>{if(id){rvfc?video.cancelVideoFrameCallback(id):cancelAnimationFrame(id);id=0;}};
    const tick=(_,metadata)=>{if(dead)return;this.render(metadata?.mediaTime??video.currentTime,{mode});if(!video.paused&&!video.ended)id=rvfc?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);};
    const start=()=>{cancel();paint();if(!video.paused&&!video.ended)id=rvfc?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);};
    const stop=()=>{cancel();paint();};video.addEventListener('play',start);video.addEventListener('pause',stop);video.addEventListener('ended',stop);video.addEventListener('seeked',paint);video.addEventListener('loadedmetadata',paint);start();
    this.detachVideo=()=>{dead=true;cancel();video.removeEventListener('play',start);video.removeEventListener('pause',stop);video.removeEventListener('ended',stop);video.removeEventListener('seeked',paint);video.removeEventListener('loadedmetadata',paint);};return this.detachVideo;
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.detachVideo?.();this.clearCache();this.materials.dispose();
    this.studio.traverse(obj=>{obj.geometry?.dispose();if(obj.material)obj.material.dispose();});this.renderer.dispose();
  }
}
