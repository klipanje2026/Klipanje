/** REALITY RIFT — volumetric fractured captions with procedural alien chrome.
 * Real diagonal mesh cuts, luminous cross-sections, spatial assembly, GPU portal,
 * braided energy trails, shockwave, bloom and chromatic lens split. No image assets.
 * Renderer: setCues([{start,end,text}]), await ready(), render(seconds,{mode:'video'}).
 * Video mode is a transparent caption overlay. Stage mode adds the dimensional field.
 */
import * as THREE from './three.mjs';
import { createRiftMaterials } from './rift-material.mjs';
import { createRiftEffects } from './rift-effects.mjs';

const rfClamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rfBase=400,rfPad=44,rfBaseline=442;
function rfArea(p){let a=0;for(let i=0,j=p.length-1;i<p.length;j=i++)a+=p[j][0]*p[i][1]-p[i][0]*p[j][1];return a/2;}
function rfInside(poly,p){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
}return hit;}
function rfSimplify(points,tolerance=.55){
  if(points.length<4)return points;
  const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;let max=0,index=0;
  for(let i=1;i<points.length-1;i++){const p=points[i],t=den?rfClamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den,0,1):0;
    const d=(p[0]-a[0]-dx*t)**2+(p[1]-a[1]-dy*t)**2;if(d>max){max=d;index=i;}}
  if(max>tolerance*tolerance)return rfSimplify(points.slice(0,index+1),tolerance).slice(0,-1).concat(rfSimplify(points.slice(index),tolerance));
  return[a,b];
}
function rfContours(mask,w,h){
  const edges=new Map(),on=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x];
  const add=(x,y,xx,yy)=>{const k=x+','+y;let e=edges.get(k);if(!e){e=[];edges.set(k,e);}e.push([xx,yy]);};
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(on(x,y)){
    if(!on(x,y-1))add(x,y,x+1,y);if(!on(x+1,y))add(x+1,y,x+1,y+1);
    if(!on(x,y+1))add(x+1,y+1,x,y+1);if(!on(x-1,y))add(x,y+1,x,y);
  }
  const contours=[];
  while(edges.size){const first=edges.keys().next().value,points=[first.split(',').map(Number)];let at=first;
    for(let n=0;n<30000;n++){const e=edges.get(at);if(!e?.length)break;const p=e.pop();if(!e.length)edges.delete(at);points.push(p);at=p.join(',');if(at===first)break;}
    if(points.length>5){const poly=rfSimplify(points).slice(0,-1).map(([x,y])=>[(x-rfPad)/rfBase,(rfBaseline-y)/rfBase]);if(poly.length>=3&&Math.abs(rfArea(poly))>.00002)contours.push(poly);}
  }
  const outers=contours.filter(p=>rfArea(p)<0),holes=contours.filter(p=>rfArea(p)>0);
  const shapes=outers.map(p=>{const s=new THREE.Shape(p.map(([x,y])=>new THREE.Vector2(x,y)));s.closePath();return s;});
  for(const p of holes){let parent=-1,small=Infinity;outers.forEach((o,i)=>{const a=Math.abs(rfArea(o));if(a<small&&rfInside(o,p[0])){parent=i;small=a;}});
    if(parent>=0){const path=new THREE.Path(p.map(([x,y])=>new THREE.Vector2(x,y)));path.closePath();shapes[parent].holes.push(path);}}
  return shapes;
}
// Keep face, rounded bevel and vertical depth as three genuinely different materials.
function rfMaterialGroups(geometry){
  const normals=geometry.attributes.normal;geometry.clearGroups();let start=0,previous=-1;
  for(let i=0;i<normals.count;i+=3){const z=(normals.getZ(i)+normals.getZ(i+1)+normals.getZ(i+2))/3;
    const material=z>.998?0:z>.02?1:2;
    if(material!==previous){if(previous>=0)geometry.addGroup(start,i-start,previous);start=i;previous=material;}}
  if(previous>=0)geometry.addGroup(start,normals.count-start,previous);return geometry;
}
function rfPolishBevel(geometry){
  const p=geometry.attributes.position,n=geometry.attributes.normal,sums=new Map(),keys=new Array(p.count);
  const key=i=>`${Math.round(p.getX(i)*1e5)},${Math.round(p.getY(i)*1e5)},${Math.round(p.getZ(i)*1e5)}`;
  for(let i=0;i<p.count;i+=3){
    const nz=n.getZ(i);if(Math.abs(nz)>.998)continue;
    for(let j=0;j<3;j++){
      const at=i+j,b=i+(j+1)%3,c=i+(j+2)%3;
      const bx=p.getX(b)-p.getX(at),by=p.getY(b)-p.getY(at),bz=p.getZ(b)-p.getZ(at);
      const cx=p.getX(c)-p.getX(at),cy=p.getY(c)-p.getY(at),cz=p.getZ(c)-p.getZ(at);
      const denom=Math.hypot(bx,by,bz)*Math.hypot(cx,cy,cz),angle=denom?Math.acos(rfClamp((bx*cx+by*cy+bz*cz)/denom,-1,1)):0;
      const k=key(at);keys[at]=k;let v=sums.get(k);if(!v){v=[0,0,0];sums.set(k,v);}v[0]+=n.getX(at)*angle;v[1]+=n.getY(at)*angle;v[2]+=n.getZ(at)*angle;
    }
  }
  for(let i=0;i<n.count;i++){const v=sums.get(keys[i]);if(v){const len=Math.hypot(...v);if(len>1e-8)n.setXYZ(i,v[0]/len,v[1]/len,v[2]/len);}}
  n.needsUpdate=true;return geometry;
}
function rfClone(material,opacity=1){const m=material.clone();m.onBeforeCompile=material.onBeforeCompile;m.customProgramCacheKey=material.customProgramCacheKey;m.transparent=true;m.opacity=opacity;return m;}

// The glyph's own distance field rounds the face of every stem. Studio cards
// then reflect across curved surfaces instead of lighting one flat text plane.
function rfReliefTexture(mask,w,h){
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
  texture.repeat.set(rfBase/w,rfBase/h);texture.offset.set(rfPad/w,1-rfBaseline/h);return texture;
}

// Pixel contours can leave duplicate bevel vertices. Drop collapsed triangles
// before smoothing so zero normals never enter physical lighting calculations.
function rfTriangleArea(a,b,c){const ax=b.x-a.x,ay=b.y-a.y,az=b.z-a.z,bx=c.x-a.x,by=c.y-a.y,bz=c.z-a.z;return Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx);}
function rfCleanGeometry(geometry){
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,pos=[],normal=[],coords=[];
  for(let i=0;i<p.count;i+=3){const v=[0,1,2].map(j=>({x:p.getX(i+j),y:p.getY(i+j),z:p.getZ(i+j)}));if(rfTriangleArea(...v)<1e-10)continue;
    for(let j=0;j<3;j++){pos.push(v[j].x,v[j].y,v[j].z);normal.push(n.getX(i+j),n.getY(i+j),n.getZ(i+j));coords.push(uv.getX(i+j),uv.getY(i+j));}}
  const clean=new THREE.BufferGeometry();clean.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));clean.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));clean.setAttribute('uv',new THREE.Float32BufferAttribute(coords,2));geometry.dispose();return clean;
}
// Clip real triangles into diagonal slabs. UVs and normals travel with the cut.
function rfClipPolygon(poly,boundary,slope,greater){
  const out=[];for(let j=0;j<poly.length;j++){
    const a=poly[j],b=poly[(j+1)%poly.length],da=a.x+slope*a.y-boundary,db=b.x+slope*b.y-boundary;
    const ina=greater?da>=-1e-7:da<=1e-7,inb=greater?db>=-1e-7:db<=1e-7;
    if(ina)out.push(a);
    if(ina!==inb){const t=da/(da-db),v={};for(const k of ['x','y','z','nx','ny','nz','u','v'])v[k]=a[k]+(b[k]-a[k])*t;out.push(v);}
  }return out;
}
function rfCutRuns(mask,w,h,boundary,slope){
  const runs=[],step=1/rfBase;let start=null;
  for(let y=-.2;y<=1.2;y+=step){const x=boundary-slope*y,px=Math.round(x*rfBase+rfPad),py=Math.round(rfBaseline-y*rfBase);
    const on=px>=0&&py>=0&&px<w&&py<h&&mask[py*w+px];
    if(on&&start===null)start=y;if(!on&&start!==null){if(y-start>step*1.4)runs.push([start,y-step*.4]);start=null;}}
  return runs;
}
function rfSlabs(geometry,mask,w,h){
  geometry.computeBoundingBox();const b=geometry.boundingBox,slope=.32;
  const lo=b.min.x+slope*b.min.y,hi=b.max.x+slope*b.max.y,span=hi-lo,bounds=[lo-.02,lo+span*.24,lo+span*.49,lo+span*.76,hi+.02];
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,triMaterial=new Uint8Array(p.count/3);
  for(const group of geometry.groups)for(let i=group.start;i<group.start+group.count;i+=3)triMaterial[i/3]=group.materialIndex;
  const parts=[];
  for(let part=0;part<4;part++){
    const buckets=[[],[],[],[]],a=bounds[part],z=bounds[part+1];
    for(let i=0;i<p.count;i+=3){let poly=[];
      for(let j=0;j<3;j++){const k=i+j;poly.push({x:p.getX(k),y:p.getY(k),z:p.getZ(k),nx:n.getX(k),ny:n.getY(k),nz:n.getZ(k),u:uv.getX(k),v:uv.getY(k)});}
      poly=rfClipPolygon(poly,a,slope,true);if(poly.length<3)continue;poly=rfClipPolygon(poly,z,slope,false);if(poly.length<3)continue;
      for(let j=1;j<poly.length-1;j++)if(rfTriangleArea(poly[0],poly[j],poly[j+1])>1e-10)buckets[triMaterial[i/3]].push(poly[0],poly[j],poly[j+1]);
    }
    // Cross-sections close each slab with an emissive internal wall.
    for(const [boundary,sign,internal] of [[a,-1,part>0],[z,1,part<3]])if(internal){
      for(const [y1,y2] of rfCutRuns(mask,w,h,boundary,slope)){
        const x1=boundary-slope*y1,x2=boundary-slope*y2,len=Math.hypot(1,slope),nx=sign/len,ny=sign*slope/len;
        const vertex=(x,y,zz)=>({x,y,z:zz,nx,ny,nz:0,u:y*2,v:zz*3});
        const v0=vertex(x1,y1,b.min.z),v1=vertex(x2,y2,b.min.z),v2=vertex(x2,y2,b.max.z),v3=vertex(x1,y1,b.max.z);
        buckets[3].push(v0,v1,v2,v0,v2,v3);
        // Hairline exposed core on the front of each cut, also visible in the hold.
        if(sign>0){const width=.0018,xshift=width/len,yshift=width*slope/len;
          const s0={...vertex(x1-xshift,y1-yshift,b.max.z+.0012),nx:0,ny:0,nz:1},s1={...vertex(x2-xshift,y2-yshift,b.max.z+.0012),nx:0,ny:0,nz:1};
          const s2={...vertex(x2+xshift,y2+yshift,b.max.z+.0012),nx:0,ny:0,nz:1},s3={...vertex(x1+xshift,y1+yshift,b.max.z+.0012),nx:0,ny:0,nz:1};buckets[3].push(s0,s1,s2,s0,s2,s3);}
      }
    }
    const pos=[],normal=[],coords=[],g=new THREE.BufferGeometry();let start=0;
    buckets.forEach((verts,material)=>{if(!verts.length)return;for(const v of verts){pos.push(v.x,v.y,v.z);const len=Math.hypot(v.nx,v.ny,v.nz)||1;normal.push(v.nx/len,v.ny/len,v.nz/len);coords.push(v.u,v.v);}g.addGroup(start,verts.length,material);start+=verts.length;});
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(coords,2));
    if(pos.length)parts.push({geometry:g,index:part});else g.dispose();
  }return parts;
}

export class RealityRiftRenderer {
  constructor(canvas,{reducedMotion=false,depth=1,power=1,pixelRatio=Math.min(Math.max(globalThis.devicePixelRatio||1,1.35),1.8)}={}){
    this.canvas=canvas;this.reducedMotion=reducedMotion;this.depth=depth;this.power=power;this.pixelRatio=pixelRatio;this.font='400 400px "Rammetto One", Impact, sans-serif';
    this.cache=new Map();this.cues=[];this.letters=[];this.time=0;this.active='';this.mode='stage';this.disposed=false;this.pointer={x:0,y:0};
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,premultipliedAlpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setClearColor(0x000000,0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.98;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(30,1,.1,80);this.camera.position.z=8.8/(2*Math.tan(Math.PI/12));
    this.text=new THREE.Group();this.scene.add(this.text);this.materials=createRiftMaterials(THREE,this.renderer);
    this.effects=createRiftEffects(THREE);this.scene.add(this.effects.group);
    this.scene.add(new THREE.HemisphereLight('#b6dcff','#20114e',.38));const key=new THREE.DirectionalLight('#d8faff',1.12);key.position.set(-4,5,7);this.scene.add(key);
    const fill=new THREE.DirectionalLight('#b699ff',.75);fill.position.set(5,-2,5);this.scene.add(fill);
    this.setupBackground();this.setupPost();this.resize();this.readyPromise=this.loadFont();
  }
  setupBackground(){
    this.backgroundMaterial=new THREE.ShaderMaterial({depthWrite:false,toneMapped:false,uniforms:{uTime:{value:0},uAspect:{value:1},uEnergy:{value:1}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform float uTime,uAspect,uEnergy;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){vec2 p=(vUv-.5)*vec2(uAspect,1.);float r=length(p*vec2(.65,1.));float a=atan(p.y,p.x);
          vec3 c=vec3(.006,.009,.023);float field=exp(-r*r*6.);
          c+=vec3(.022,.010,.063)*field;
          float arc=sin(a*3.+sin(r*9.-uTime*.3)*1.1+uTime*.12);
          float radial=(r-.52)/.18;float flow=pow(max(0.,arc),14.)*exp(-radial*radial);
          c+=mix(vec3(.065,.015,.21),vec3(.006,.065,.14),.5+.5*sin(a+uTime*.18))*flow*.55;
          c+=vec3(.005,.018,.012)*exp(-dot(p-vec2(-.65,.1),p-vec2(-.65,.1))*4.);
          c+=(hash(gl_FragCoord.xy)-.5)*.0005;gl_FragColor=vec4(c,1.);
        }`});
    this.background=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.backgroundMaterial);this.background.position.z=-8;this.scene.add(this.background);
  }
  setupPost(){
    // Supersampling avoids inconsistent HDR multisample resolves on software GPUs.
    this.sourceTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});this.glowTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
    this.postScene=new THREE.Scene();this.postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
    this.blurMaterial=new THREE.ShaderMaterial({toneMapped:false,depthTest:false,depthWrite:false,uniforms:{uMap:{value:this.sourceTarget.texture},uStep:{value:new THREE.Vector2(1,1)}},vertexShader:vertex,
      fragmentShader:`varying vec2 vUv;uniform sampler2D uMap;uniform vec2 uStep;
        vec3 bright(vec2 uv){vec3 c=texture2D(uMap,uv).rgb;float peak=max(c.r,max(c.g,c.b));return c*max(0.,peak-.75)/max(peak,.001);}
        void main(){vec3 c=bright(vUv)*.20;
          c+=(bright(vUv+uStep*vec2(1.,0.))+bright(vUv-uStep*vec2(1.,0.))+bright(vUv+uStep*vec2(0.,1.))+bright(vUv-uStep*vec2(0.,1.)))*.13;
          c+=(bright(vUv+uStep*vec2(1.,1.))+bright(vUv+uStep*vec2(-1.,1.))+bright(vUv+uStep*vec2(1.,-1.))+bright(vUv-uStep))* .07;
          gl_FragColor=vec4(c,1.);
        }`});
    this.finalMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{uMap:{value:this.sourceTarget.texture},uGlow:{value:this.glowTarget.texture},uSplit:{value:0},uPower:{value:1}},vertexShader:vertex,
      fragmentShader:`varying vec2 vUv;uniform sampler2D uMap,uGlow;uniform float uSplit,uPower;
        void main(){vec4 source=texture2D(uMap,vUv);vec3 color=source.rgb;
          color.r=mix(color.r,texture2D(uMap,vUv+vec2(uSplit,0.)).r,clamp(abs(uSplit)*180.,0.,.65));
          color.b=mix(color.b,texture2D(uMap,vUv-vec2(uSplit,0.)).b,clamp(abs(uSplit)*180.,0.,.65));
          vec3 glow=texture2D(uGlow,vUv).rgb;color+=glow*.31*uPower;
          float halo=max(glow.r,max(glow.g,glow.b))*.18*uPower;float alpha=max(source.a,clamp(halo,0.,1.));
          // Render-target blending stores premultiplied radiance. Convert to
          // straight color before display transfer and canvas alpha compositing.
          gl_FragColor=vec4(alpha>.00001?color/max(alpha,.00001):vec3(0.),alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
    this.postQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.finalMaterial);this.postScene.add(this.postQuad);
  }
  async loadFont(){

    try{const fonts=await document.fonts.load('400 400px "Rammetto One"','ABCDEFGHIJKLMNOPQRSTUVWXYZČĆĐŠŽabcdefghijklmnopqrstuvwxyzčćđšž');if(fonts.length&&!this.disposed){this.font='400 400px "Rammetto One", Impact, sans-serif';this.clearCache();this.active='';this.render(this.time,{mode:this.mode});}}catch{}return this;
  }
  ready(){return this.readyPromise;}
  resize(width=this.canvas.clientWidth||736,height=this.canvas.clientHeight||560,pixelRatio=this.pixelRatio){
    this.width=Math.max(1,width);this.height=Math.max(1,height);this.pixelRatio=rfClamp(pixelRatio,1,2);this.renderer.setPixelRatio(this.pixelRatio);this.renderer.setSize(this.width,this.height,false);
    this.viewHeight=8.8;this.viewWidth=this.viewHeight*this.width/this.height;this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();
    this.background.scale.set(this.viewWidth*1.55,this.viewHeight*1.55,1);this.backgroundMaterial.uniforms.uAspect.value=this.camera.aspect;this.effects.resize(this.viewWidth,this.viewHeight);
    const size=this.renderer.getDrawingBufferSize(new THREE.Vector2());this.sourceTarget.setSize(size.x,size.y);this.glowTarget.setSize(Math.max(1,Math.round(size.x/3)),Math.max(1,Math.round(size.y/3)));this.blurMaterial.uniforms.uStep.value.set(5/size.x,5/size.y);
    this.active='';return this;
  }
  setCues(cues){
    this.cues=(cues||[]).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start&&typeof c.text==='string').map(c=>{
      const words=c.text.slice(0,1000).trim().split(/\s+/).filter(Boolean).map(w=>w.replace(/[.,!?;:„“"()]/g,'').toLocaleUpperCase()),groups=[];
      for(let i=0;i<words.length;i+=2)groups.push(words.slice(i,i+2));return{...c,text:c.text.slice(0,1000),groups};}).sort((a,b)=>a.start-b.start);this.active='';return this;
  }
  getDuration(){return this.cues.reduce((n,c)=>Math.max(n,c.end),0);}
  locate(time){const cueIndex=this.cues.findIndex(c=>time>=c.start&&time<c.end);if(cueIndex<0)return null;const cue=this.cues[cueIndex];if(!cue.groups.length)return null;
    const span=(cue.end-cue.start)/cue.groups.length,chunk=Math.min(cue.groups.length-1,Math.floor((time-cue.start)/span));return{cueIndex,chunk,span,local:time-cue.start-chunk*span,words:cue.groups[chunk],text:cue.text};}
  glyph(char){
    if(this.cache.has(char))return this.cache.get(char);
    const c=document.createElement('canvas'),ctx=c.getContext('2d',{willReadFrequently:true});ctx.font=this.font;const advance=ctx.measureText(char).width;c.width=Math.ceil(advance+rfPad*2);c.height=560;
    ctx.font=this.font;ctx.fillStyle='#fff';ctx.fillText(char,rfPad,rfBaseline);const data=ctx.getImageData(0,0,c.width,c.height).data,mask=new Uint8Array(c.width*c.height);for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3]>127?1:0;
    const shapes=rfContours(mask,c.width,c.height),geometry=shapes.length?rfPolishBevel(rfMaterialGroups(rfCleanGeometry(new THREE.ExtrudeGeometry(shapes,{depth:.24,bevelEnabled:true,bevelThickness:.030,bevelSize:.014,bevelSegments:4,curveSegments:8,steps:1})))):null;
    const parts=geometry?rfSlabs(geometry,mask,c.width,c.height):[],normalMap=rfReliefTexture(mask,c.width,c.height),g={geometry,parts,normalMap,advance:advance/rfBase};this.cache.set(char,g);return g;
  }
  clearWords(){this.text.clear();for(const item of this.letters){item.pieces.forEach(p=>p.mats.forEach(m=>m.dispose()));item.core.material.dispose();}this.letters=[];}
  clearCache(){this.clearWords();for(const g of this.cache.values()){g.geometry?.dispose();g.parts.forEach(p=>p.geometry.dispose());g.normalMap.dispose();}this.cache.clear();}
  buildWords(info,mode){
    this.clearWords();const video=mode==='video',two=info.words.length>1;this.heroWidth=1;this.heroY=-1.03;this.heroCenter=0;
    info.words.forEach((word,line)=>{
      const chars=[...word],glyphs=chars.map(c=>this.glyph(c)),hero=!two||line===1,spacing=.024;
      const total=glyphs.reduce((s,g)=>s+g.advance+spacing,0)-spacing,avail=this.viewWidth*(video?.86:hero?.86:.48);
      const scale=Math.min(hero?(video?1.44:3.35):(video?.80:1.65),avail/Math.max(total,.1));const stretch=hero?1.20:1.08;
      const y=video?(hero?-2.87:-1.23):(hero?-1.18:1.35),center=hero?0:-this.viewWidth*.035;
      if(hero){this.heroWidth=total*scale;this.heroY=y;this.heroCenter=center;}
      let x=-total*scale/2+center;
      glyphs.forEach((g,i)=>{
        if(!g.geometry){x+=(g.advance+spacing)*scale;return;}
        const group=new THREE.Group();this.text.add(group);const pieces=[];
        for(const part of g.parts){const mats=[this.materials.face,this.materials.bevel,this.materials.side,this.materials.core].map(m=>rfClone(m));mats[0].normalMap=g.normalMap;mats[0].normalScale.set(.90,.90);
          mats[3].side=THREE.DoubleSide;const mesh=new THREE.Mesh(part.geometry,mats);group.add(mesh);pieces.push({mesh,mats,part:part.index});}
        const coreMaterial=rfClone(this.materials.core,.15);const core=new THREE.Mesh(g.geometry,coreMaterial);group.add(core);core.position.z=-.055;core.scale.set(1.012,1.012,.91);
        this.letters.push({group,pieces,core,x,y,scale,stretch,index:i,line,hero,count:chars.length,seed:chars[i].codePointAt(0)*.117+i*2.23});x+=(g.advance+spacing)*scale;
      });
    });
  }
  render(time,{mode=this.mode,reducedMotion=this.reducedMotion}={}){
    if(this.disposed)return null;this.time=Number.isFinite(time)?time:0;this.mode=mode==='video'?'video':'stage';const stage=this.mode==='stage',info=this.locate(this.time);
    this.background.visible=stage&&!this.transparentStage;this.effects.group.visible=stage&&!!info;this.text.visible=!!info;
    const still=!!reducedMotion,power=rfClamp(this.power,.45,1.7);
    if(info){const key=info.cueIndex+':'+info.chunk+':'+this.mode;if(this.active!==key){this.active=key;this.buildWords(info,this.mode);}
      const tempo=Math.min(1,info.span/2.7),t=still?1.9:info.local/tempo,exitSpan=.4*tempo,exit=still?0:rfClamp((info.local-info.span+exitSpan)/exitSpan,0,1),phase=still?.5:rfClamp((t-.76)/1.80,0,1);
      this.materials.update(still?0:this.time,{phase,still,extent:this.heroWidth,center:this.heroCenter,intensity:power});
      this.effects.update(still?0:this.time,{local:still?1.9:info.local,span:info.span,still,extent:this.heroWidth,heroY:this.heroY,intensity:power});
      this.text.rotation.set(stage?-.13+this.pointer.y*.025:-.04,stage?-.11+this.pointer.x*.045:-.03,0);
      this.letters.forEach(item=>{
        const stagger=Math.min(.036,.36/Math.max(1,item.count)),age=t-item.index*stagger-item.line*.14,q=still?1:rfClamp(age/1.14,0,1),open=(1-q)**3,alpha=still?1:rfClamp(age/.20,0,1)*(1-exit);
        item.group.visible=alpha>.002;
        item.group.position.set(item.x+exit*Math.sin(item.seed)*.26,item.y-open*.38,-.28-exit*.45);
        item.group.scale.set(item.scale,item.scale*item.stretch,item.scale*rfClamp(this.depth,.5,1.8));
        item.pieces.forEach(({mesh,mats,part})=>{const angle=item.seed+part*1.82,travel=(open+exit**1.6)*power,gap=q*q*(1-exit)*(part-1.5)*.004;
          mesh.position.set(Math.cos(angle)*travel*(.45+part*.11)+gap,Math.sin(angle)*travel*.75+gap*.32,(part-1.4)*travel*.92);
          mesh.rotation.set(travel*Math.sin(angle)*.74,travel*Math.cos(angle)*.92,travel*(part-1.5)*.30);mesh.scale.setScalar(1-open*.24);
          mats.forEach(m=>m.opacity=alpha);});
        item.core.material.opacity=alpha*(still?.13:.15+.10*open);item.core.visible=still||age>.28;
      });
      const impulse=still?0:Math.exp(-Math.max(0,t-.78)*12)*Math.sin(Math.max(0,t-.78)*40)*.035*power;
      this.camera.position.x=impulse;this.camera.position.y=impulse*.45;
      this.finalMaterial.uniforms.uSplit.value=still?0:(openEffect(t)*.0023+exit*.0035)*power;
    }else{this.camera.position.x=this.camera.position.y=0;this.finalMaterial.uniforms.uSplit.value=0;}
    this.backgroundMaterial.uniforms.uTime.value=still?0:this.time;this.finalMaterial.uniforms.uPower.value=power;
    this.renderer.setRenderTarget(this.sourceTarget);this.renderer.render(this.scene,this.camera);this.postQuad.material=this.blurMaterial;this.renderer.setRenderTarget(this.glowTarget);this.renderer.render(this.postScene,this.postCamera);
    this.postQuad.material=this.finalMaterial;this.renderer.setRenderTarget(null);this.renderer.render(this.postScene,this.postCamera);return info;
  }
  attachVideo(video,{mode='video'}={}){
    this.detachVideo?.();let id=0,dead=false;const rvfc=typeof video.requestVideoFrameCallback==='function',paint=()=>{if(!dead)this.render(video.currentTime,{mode});};
    const cancel=()=>{if(id){rvfc?video.cancelVideoFrameCallback(id):cancelAnimationFrame(id);id=0;}};
    const tick=(_,metadata)=>{if(dead)return;this.render(metadata?.mediaTime??video.currentTime,{mode});if(!video.paused&&!video.ended)id=rvfc?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);};
    const start=()=>{cancel();paint();if(!video.paused&&!video.ended)id=rvfc?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);},stop=()=>{cancel();paint();};
    video.addEventListener('play',start);video.addEventListener('pause',stop);video.addEventListener('ended',stop);video.addEventListener('seeked',paint);video.addEventListener('loadedmetadata',paint);start();
    this.detachVideo=()=>{dead=true;cancel();video.removeEventListener('play',start);video.removeEventListener('pause',stop);video.removeEventListener('ended',stop);video.removeEventListener('seeked',paint);video.removeEventListener('loadedmetadata',paint);};return this.detachVideo;
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.detachVideo?.();this.clearCache();this.materials.dispose();this.effects.dispose();this.background.geometry.dispose();this.backgroundMaterial.dispose();this.sourceTarget.dispose();this.glowTarget.dispose();this.blurMaterial.dispose();this.finalMaterial.dispose();this.postQuad.geometry.dispose();this.renderer.dispose();}
}
function openEffect(t){return (1-rfClamp((t-.40)/1.05,0,1))**2;}
