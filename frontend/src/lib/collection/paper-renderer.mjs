/** PAPER SCULPT — carved, layered paper captions, rendered with real geometry.
 * ES module. Dependencies: Three.js 0.169.0 and Bowlby One SC (Google Fonts).
 * setCues([{start:0,end:13.6,text:'Your sentence'}]); await ready();
 * render(seconds,{mode:'video'}) produces a transparent RGBA overlay.
 */
import * as THREE from './three.mjs';

const psClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const psRandom=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
function psArea(p){let a=0;for(let i=0,j=p.length-1;i<p.length;j=i++)a+=p[j][0]*p[i][1]-p[i][0]*p[j][1];return a/2;}
function psContains(poly,p){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
}return hit;}
function psSimplify(points,tolerance=.48){
  if(points.length<4)return points;
  const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],denom=dx*dx+dy*dy;let max=0,index=0;
  for(let i=1;i<points.length-1;i++){const p=points[i],t=denom?psClamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/denom,0,1):0;
    const d=(p[0]-a[0]-dx*t)**2+(p[1]-a[1]-dy*t)**2;if(d>max){max=d;index=i;}}
  if(max>tolerance*tolerance)return psSimplify(points.slice(0,index+1),tolerance).slice(0,-1).concat(psSimplify(points.slice(index),tolerance));
  return[a,b];
}
// Trace connected material regions, including letter counters and inset cutouts.
function psShapes(mask,w,h){
  const edges=new Map(),on=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x];
  const add=(x,y,xx,yy)=>{const k=x+','+y;let e=edges.get(k);if(!e){e=[];edges.set(k,e);}e.push([xx,yy]);};
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(on(x,y)){
    if(!on(x,y-1))add(x,y,x+1,y);if(!on(x+1,y))add(x+1,y,x+1,y+1);
    if(!on(x,y+1))add(x+1,y+1,x,y+1);if(!on(x-1,y))add(x,y+1,x,y);
  }
  const contours=[];
  while(edges.size){const first=edges.keys().next().value,points=[first.split(',').map(Number)];let at=first;
    for(let n=0;n<40000;n++){const e=edges.get(at);if(!e?.length)break;const p=e.pop();if(!e.length)edges.delete(at);points.push(p);at=p.join(',');if(at===first)break;}
    if(points.length>5){const p=psSimplify(points).slice(0,-1).map(([x,y])=>[(x-24)/200,(238-y)/200]);if(p.length>=3&&Math.abs(psArea(p))>.00005)contours.push(p);}
  }
  const outers=contours.filter(p=>psArea(p)<0),holes=contours.filter(p=>psArea(p)>0);
  const shapes=outers.map(p=>{const s=new THREE.Shape(p.map(([x,y])=>new THREE.Vector2(x,y)));s.closePath();return s;});
  for(const p of holes){let parent=-1,small=Infinity;outers.forEach((o,i)=>{const area=Math.abs(psArea(o));if(area<small&&psContains(o,p[0])){parent=i;small=area;}});
    if(parent>=0){const hole=new THREE.Path(p.map(([x,y])=>new THREE.Vector2(x,y)));hole.closePath();shapes[parent].holes.push(hole);}}
  return shapes;
}
function psDistance(mask,w,h){
  const d=new Float32Array(w*h);for(let i=0;i<d.length;i++)d[i]=mask[i]?1000:0;
  const diagonal=Math.SQRT2;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(d[i])d[i]=Math.min(d[i],d[i-1]+1,d[i-w]+1,d[i-w-1]+diagonal,d[i-w+1]+diagonal);}
  for(let y=h-2;y>=1;y--)for(let x=w-2;x>=1;x--){const i=y*w+x;if(d[i])d[i]=Math.min(d[i],d[i+1]+1,d[i+w]+1,d[i+w+1]+diagonal,d[i+w-1]+diagonal);}
  return d;
}
function psPaperTexture(){
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d'),r=psRandom(87431),pixels=ctx.createImageData(512,512);
  for(let i=0;i<pixels.data.length;i+=4){const n=236+Math.floor(r()*19);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=n;pixels.data[i+3]=255;}
  ctx.putImageData(pixels,0,0);ctx.lineWidth=.6;
  for(let i=0;i<2600;i++){const x=r()*512,y=r()*512,a=r()*6.28,len=2+r()*14;ctx.strokeStyle=i%3?'rgba(112,108,102,.10)':'rgba(255,255,249,.65)';
    ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+Math.cos(a)*len*.4,y+Math.sin(a)*len*.7,x+Math.cos(a)*len,y+Math.sin(a)*len);ctx.stroke();}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2.2,2.2);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

export class PaperSculptRenderer {
  constructor(canvas,{reducedMotion=false,depth=1,pixelRatio=Math.min(globalThis.devicePixelRatio||1,1.75)}={}){
    this.canvas=canvas;this.reducedMotion=reducedMotion;this.depth=depth;this.pixelRatio=pixelRatio;this.font='200px "Bowlby One SC", sans-serif';
    this.cues=[];this.cache=new Map();this.letters=[];this.active='';this.time=0;this.mode='showcase';this.width=736;this.height=500;this.disposed=false;this.viewTilt={x:0,y:0};
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setClearColor(0x000000,0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.VSMShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-7,7,4.5,-4.5,.1,80);this.camera.position.set(0,0,20);
    this.textGroup=new THREE.Group();this.scene.add(this.textGroup);this.texture=psPaperTexture();
    const palette=['#fff4dc','#456ce2','#8895e8','#f6e7b8','#dca94d','#a297d7','#696fba'];
    this.materials=palette.map((color,i)=>{
      const face=new THREE.MeshStandardMaterial({color,map:this.texture,bumpMap:this.texture,bumpScale:.007,roughness:1,metalness:0});
      const edge=new THREE.MeshStandardMaterial({color:new THREE.Color(color).multiplyScalar(i? .74:.83),map:this.texture,roughness:1,metalness:0});return[face,edge];});
    this.shellMaterials=[new THREE.MeshStandardMaterial({color:'#f5ead1',map:this.texture,roughness:1}),new THREE.MeshStandardMaterial({color:'#bdac91',map:this.texture,roughness:1})];
    this.fiberMaterial=new THREE.LineBasicMaterial({color:'#a89b82',transparent:true,opacity:.28,depthWrite:false});
    this.scene.add(new THREE.HemisphereLight('#fff5df','#aaa5c3',2.0));
    const key=new THREE.DirectionalLight('#fff5e0',2.2);key.position.set(-3,4,18);key.castShadow=true;
    key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-12;key.shadow.camera.right=12;key.shadow.camera.top=9;key.shadow.camera.bottom=-9;
    key.shadow.camera.near=1;key.shadow.camera.far=45;key.shadow.bias=-.00006;key.shadow.normalBias=.005;key.shadow.radius=3;key.shadow.blurSamples=6;this.scene.add(key);
    const fill=new THREE.DirectionalLight('#babdff',.7);fill.position.set(5,-2,5);this.scene.add(fill);
    this.backdrop=new THREE.Group();this.scene.add(this.backdrop);
    this.floor=new THREE.Mesh(new THREE.PlaneGeometry(60,40),new THREE.MeshStandardMaterial({color:'#e7dfce',map:this.texture,roughness:1}));
    this.floor.position.z=-1.45;this.backdrop.add(this.floor);
    this.shadowPlane=new THREE.Mesh(new THREE.PlaneGeometry(40,30),new THREE.ShadowMaterial({color:'#29294b',opacity:.22}));
    this.shadowPlane.position.z=-1.44;this.shadowPlane.receiveShadow=true;this.scene.add(this.shadowPlane);
    this.makePaperCorners();this.resize();
    this.readyPromise=this.loadFont();
  }
  async loadFont(){

    try{const fonts=await document.fonts.load('200px "Bowlby One SC"','ABCDEFGHIJKLMNOPQRSTUVWXYZČĆĐŠŽabcdefghijklmnopqrstuvwxyzčćđšž');if(fonts.length&&!this.disposed){this.font='200px "Bowlby One SC", sans-serif';this.clearCache();this.active='';this.render(this.time,{mode:this.mode});}}catch{}
    return this;
  }
  ready(){return this.readyPromise;}
  makePaperCorners(){
    this.cornerGroups=[];
    for(let corner=0;corner<2;corner++){
      const group=new THREE.Group();this.backdrop.add(group);this.cornerGroups.push(group);
      for(let i=0;i<7;i++){
        const shape=new THREE.Shape();const rad=2.4-i*.16;
        shape.moveTo(-3,-2.9);shape.lineTo(3,-2.9);shape.lineTo(3,-2.55);
        shape.bezierCurveTo(1.0,-2.55,1.7,rad*.38,-.1,rad*.47);
        shape.bezierCurveTo(-1.6,rad*.60,-1.1,-1.3,-3,-1.35);shape.closePath();
        const geometry=new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelThickness:.006,bevelSize:.007,bevelSegments:1,curveSegments:35});
        const color=i===3?'#aeb9d7':i===5?'#d7bf8b':'#e7ddc7';
        const mat=new THREE.MeshStandardMaterial({color,map:this.texture,roughness:1});const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=mesh.receiveShadow=true;
        mesh.position.set(i*.08,-i*.10,-.63+i*.055);group.add(mesh);
      }
      group.rotation.z=corner?Math.PI+.12:-.14;group.scale.setScalar(corner?.88:1);
    }
  }
  resize(width=this.canvas.clientWidth||736,height=this.canvas.clientHeight||500,pixelRatio=this.pixelRatio){
    this.width=Math.max(1,width);this.height=Math.max(1,height);this.pixelRatio=psClamp(pixelRatio,1,2);
    this.renderer.setPixelRatio(this.pixelRatio);this.renderer.setSize(this.width,this.height,false);
    this.viewHeight=8.8;this.viewWidth=this.viewHeight*this.width/this.height;
    this.camera.left=-this.viewWidth/2;this.camera.right=this.viewWidth/2;this.camera.top=this.viewHeight/2;this.camera.bottom=-this.viewHeight/2;this.camera.updateProjectionMatrix();
    this.cornerGroups[0].position.set(-this.viewWidth*.54,-3.78,0);this.cornerGroups[1].position.set(this.viewWidth*.51,4.6,0);
    this.active='';
  }
  setCues(cues){
    this.cues=(cues||[]).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start&&typeof c.text==='string').map(c=>{
      const words=c.text.trim().split(/\s+/).filter(Boolean).map(w=>w.replace(/[.,!?;:„“"()]/g,'').toLocaleUpperCase());const groups=[];
      for(let i=0;i<words.length;i+=2)groups.push(words.slice(i,i+2));return{...c,text:c.text.slice(0,1000),groups};}).sort((a,b)=>a.start-b.start);
    this.active='';return this;
  }
  getDuration(){return this.cues.reduce((max,c)=>Math.max(max,c.end),0);}
  locate(time){
    const cueIndex=this.cues.findIndex(c=>time>=c.start&&time<c.end);if(cueIndex<0)return null;
    const cue=this.cues[cueIndex];if(!cue.groups.length)return null;
    const span=(cue.end-cue.start)/cue.groups.length,chunk=Math.min(cue.groups.length-1,Math.floor((time-cue.start)/span));
    return{cueIndex,chunk,words:cue.groups[chunk],local:time-cue.start-chunk*span,span,text:cue.text};
  }
  glyph(char){
    if(this.cache.has(char))return this.cache.get(char);
    const c=document.createElement('canvas'),ctx=c.getContext('2d',{willReadFrequently:true});ctx.font=this.font;const advance=ctx.measureText(char).width;
    c.width=Math.ceil(advance+48);c.height=300;ctx.font=this.font;ctx.fillStyle='#fff';ctx.fillText(char,24,238);
    const image=ctx.getImageData(0,0,c.width,c.height).data,mask=new Uint8Array(c.width*c.height);
    for(let i=0;i<mask.length;i++)mask[i]=image[i*4+3]>127?1:0;
    const dist=psDistance(mask,c.width,c.height);let max=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=y*c.width+x;
      // Slightly irregular contour spacing makes the interior look cut by hand.
      dist[i]*=1+.065*Math.sin(x*.047+y*.058)+.035*Math.sin(y*.137-x*.043);if(dist[i]>max)max=dist[i];}
    const steps=[0,.29,.43,.55,.67,.79,.90,1000].map((n,i)=>i===7?n:max*n);
    const slices=[];
    for(let layer=0;layer<7;layer++){
      const band=new Uint8Array(mask.length);for(let i=0;i<band.length;i++)band[i]=mask[i]&&dist[i]>steps[layer]&&dist[i]<=steps[layer+1]?1:0;
      const shapes=psShapes(band,c.width,c.height);if(!shapes.length)continue;
      const geometry=new THREE.ExtrudeGeometry(shapes,{depth:.031,bevelEnabled:true,bevelThickness:.0035,bevelSize:.002,bevelSegments:1,curveSegments:2,steps:1});
      slices.push({geometry,layer,z:.21-layer*.044});
    }
    const shapes=psShapes(mask,c.width,c.height);const shell=shapes.length?new THREE.ExtrudeGeometry(shapes,{depth:.045,bevelEnabled:true,bevelSize:.004,bevelThickness:.008,bevelSegments:1,curveSegments:2}):null;
    const fiberPoints=[],r=psRandom(char.codePointAt(0)*9767);
    for(let n=0;n<6000&&fiberPoints.length<540;n++){
      const x=Math.floor(r()*c.width),y=Math.floor(r()*c.height),i=y*c.width+x;
      if(dist[i]<2||dist[i]>steps[1]-1)continue;
      const angle=.6+(r()-.5)*1.7,len=2+r()*7,xx=x+Math.cos(angle)*len,yy=y+Math.sin(angle)*len;
      const end=Math.floor(yy)*c.width+Math.floor(xx);if(!mask[end]||dist[end]>steps[1]-1)continue;
      fiberPoints.push((x-24)/200,(238-y)/200,0,(xx-24)/200,(238-yy)/200,0);
    }
    const fibers=new THREE.BufferGeometry();fibers.setAttribute('position',new THREE.Float32BufferAttribute(fiberPoints,3));
    const result={advance:advance/200,slices,shell,fibers};this.cache.set(char,result);return result;
  }
  clearWords(){this.textGroup.clear();this.letters=[];}
  clearCache(){this.clearWords();for(const g of this.cache.values()){g.slices.forEach(s=>s.geometry.dispose());g.shell?.dispose();g.fibers?.dispose();}this.cache.clear();}
  buildWords(info,mode){
    this.clearWords();const video=mode==='video',words=info.words;
    const avail=this.viewWidth*(video?.88:.89);
    words.forEach((word,line)=>{
      const chars=[...word],glyphs=chars.map(c=>this.glyph(c)),spacing=.047;
      const total=glyphs.reduce((s,g)=>s+g.advance+spacing,0)-spacing;
      const hero=words.length===1||line===1;
      const scale=Math.min(hero?(video?1.42:2.75):(video?.85:1.22),avail/Math.max(total,.1));
      const y=video?(hero?-2.54:-1.1):(hero?-1.35:.84);
      let x=-total*scale/2;
      glyphs.forEach((g,i)=>{
        const group=new THREE.Group();this.textGroup.add(group);const pieces=[];
        if(g.shell){const shell=new THREE.Mesh(g.shell,this.shellMaterials);shell.position.z=-.135;shell.castShadow=shell.receiveShadow=true;group.add(shell);pieces.push({mesh:shell,layer:8,z:-.135});}
        for(const s of g.slices){const mesh=new THREE.Mesh(s.geometry,this.materials[s.layer]);mesh.castShadow=mesh.receiveShadow=true;mesh.position.z=s.z;group.add(mesh);pieces.push({mesh,layer:s.layer,z:s.z});}
        const fiberMesh=new THREE.LineSegments(g.fibers,this.fiberMaterial);fiberMesh.position.z=.246;group.add(fiberMesh);pieces.push({mesh:fiberMesh,layer:0,z:.246});
        this.letters.push({group,pieces,x,y,scale,index:i,line,seed:chars[i].codePointAt(0)*.137+i*2.93,hero});x+=(g.advance+spacing)*scale;
      });
    });
  }
  render(time,{mode=this.mode,reducedMotion=this.reducedMotion}={}){
    if(this.disposed)return null;
    this.time=Number.isFinite(time)?time:0;this.mode=mode==='video'?'video':'showcase';const info=this.locate(this.time);
    this.backdrop.visible=this.mode==='showcase'&&!this.transparentStage;this.shadowPlane.visible=true;
    if(!info){this.textGroup.visible=false;this.renderer.render(this.scene,this.camera);return null;}
    this.textGroup.visible=true;const key=info.cueIndex+':'+info.chunk+':'+this.mode;
    if(key!==this.active){this.active=key;this.buildWords(info,this.mode);}
    const still=!!reducedMotion,t=still?1.55:info.local,tempo=Math.min(1,info.span/2.3);
    const exitSpan=.35*tempo,exit=still?0:psClamp((t-info.span+exitSpan)/exitSpan,0,1);
    this.textGroup.rotation.set(this.mode==='video'?-.035:-.10+this.viewTilt.y*.04,this.mode==='video'?-.025:-.135+this.viewTilt.x*.065,0);
    this.letters.forEach(item=>{
      const age=t/tempo-item.index*.027-item.line*.13;
      const q=still?1:psClamp(age/.92,0,1),open=(1-q)**3;
      const spring=still?0:Math.sin(Math.max(0,age-.60)*16)*Math.exp(-Math.max(0,age-.60)*8)*.023*psClamp(age*2,0,1);
      item.group.position.set(item.x+open*Math.sin(item.seed)*.40+exit*.4,item.y-open*.78+spring,open*.55-exit*.30);
      item.group.rotation.set(open*-.30,open*(item.index%2?-.32:.32),open*Math.sin(item.seed)*.18+exit*.04);
      item.group.scale.set(item.scale,item.scale,item.scale*psClamp(this.depth,.45,1.8));
      item.group.visible=still||age>-.01;
      item.pieces.forEach(({mesh,layer,z})=>{
        const sheetQ=still?1:psClamp((age-layer*.030)/.86,0,1),fan=(1-sheetQ)**2.7+exit**2;
        mesh.position.set((layer-3)*fan*.052,(layer-3)*fan*.07,z+(layer-3)*fan*.135);
        mesh.rotation.set(fan*(layer-3)*.017,fan*(layer-3)*.025,fan*(layer-3)*.034);
      });
    });
    this.renderer.render(this.scene,this.camera);return info;
  }
  attachVideo(video,{mode='video'}={}){
    this.detachVideo?.();let id=0,disposed=false,rvfc=typeof video.requestVideoFrameCallback==='function';
    const paint=()=>{if(!disposed)this.render(video.currentTime,{mode});};
    const tick=(_,metadata)=>{if(disposed)return;this.render(metadata?.mediaTime??video.currentTime,{mode});if(!video.paused&&!video.ended)id=rvfc?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);};
    const cancel=()=>{if(id){rvfc?video.cancelVideoFrameCallback(id):cancelAnimationFrame(id);id=0;}};
    const start=()=>{cancel();paint();if(!video.paused&&!video.ended)id=rvfc?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);};
    const stop=()=>{cancel();paint();};
    video.addEventListener('play',start);video.addEventListener('pause',stop);video.addEventListener('ended',stop);video.addEventListener('seeked',paint);video.addEventListener('loadedmetadata',paint);start();
    this.detachVideo=()=>{disposed=true;cancel();video.removeEventListener('play',start);video.removeEventListener('pause',stop);video.removeEventListener('ended',stop);video.removeEventListener('seeked',paint);video.removeEventListener('loadedmetadata',paint);};
    return this.detachVideo;
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.detachVideo?.();this.clearCache();
    this.scene.traverse(obj=>{if(obj.geometry)obj.geometry.dispose();if(obj.material){const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>m.dispose());}});
    this.materials.flat().forEach(m=>m.dispose());this.shellMaterials.forEach(m=>m.dispose());this.fiberMaterial.dispose();this.texture.dispose();this.renderer.dispose();
  }
}
