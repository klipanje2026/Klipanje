import * as THREE from './vendor/build/three.module.js';
import {FontLoader} from './vendor/examples/jsm/loaders/FontLoader.js';
import {TextGeometry} from './vendor/examples/jsm/geometries/TextGeometry.js';
import {RoomEnvironment} from './vendor/examples/jsm/environments/RoomEnvironment.js';
import {titlePalette} from './title-palettes.mjs';

const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>1-Math.pow(1-clamp(x),4);
const recoil=x=>{x=clamp(x);return x===1?1:1-Math.exp(-7*x)*Math.cos(10*x);};
const seeded=i=>{let n=Math.imul(i+11,374761393);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};

// Partition actual extruded glyph triangles; every piece has real vertices,
// normals and depth. No bitmap text, Canvas 2D shadows or time accumulators.
function pieces(geometry,style){
 const g=geometry.index?geometry.toNonIndexed():geometry;
 g.computeBoundingBox();const box=g.boundingBox,p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv'),bins=new Map();
 for(let i=0;i<p.count;i+=3){
  const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3;
  const key=style==='silk'?Math.min(4,Math.floor((y-box.min.y)/(box.max.y-box.min.y+.0001)*5)):`${Math.floor(x/.19)}:${Math.floor(y/.19)}`;
  if(!bins.has(key))bins.set(key,{v:[],n:[],uv:[],m:[],band:style==='silk'?key:0});
  const b=bins.get(key),material=g.groups.find(q=>i>=q.start&&i<q.start+q.count)?.materialIndex||0;
  b.m.push(material);
  for(let j=0;j<3;j++){b.v.push(p.getX(i+j),p.getY(i+j),p.getZ(i+j));b.n.push(n.getX(i+j),n.getY(i+j),n.getZ(i+j));b.uv.push(uv.getX(i+j),uv.getY(i+j));}
 }
 const result=[];
 for(const b of bins.values()){
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(b.v,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));
  let run=0;for(let t=1;t<=b.m.length;t++)if(t===b.m.length||b.m[t]!==b.m[run]){geo.addGroup(run*3,(t-run)*3,b.m[run]);run=t;}
  geo.computeBoundingBox();const center=geo.boundingBox.getCenter(new THREE.Vector3());geo.translate(-center.x,-center.y,-center.z);geo.computeBoundingSphere();result.push({geometry:geo,center,band:b.band});
 }
 if(g!==geometry)g.dispose();return result;
}

export async function createTitleEffect(canvas,{style='silk',lines,background=true,colors={},fontURL='./assets/edita-studio-sans.typeface.json',font,width=960,height=540}={}){
 const loadedFont=font||await new FontLoader().loadAsync(fontURL);
 const effect=new TitleEffect(canvas,{style,lines:lines||(style==='silk'?['JASAN','STAV.']:['TVOJ','GLAS.']),background,colors,font:loadedFont,width,height});
 await effect.renderer.compileAsync(effect.scene,effect.camera);
 // Populate physical-material and shadow targets before the caller seeks.
 effect.renderAt(2.4);effect.renderAt(2.4);effect.renderAt(0);
 return effect;
}

export class TitleEffect{
 constructor(canvas,{style,lines,background,colors,font,width,height}){
  if(!['silk','crystal'].includes(style))throw Error('Unknown title style');
  this.style=style;this.duration=7.2;this.disposed=false;this.resources=[];this.colors=titlePalette(style,colors);
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(1);
  this.renderer.setClearColor(0x000000,background?1:0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.9;
  this.renderer.shadowMap.enabled=background;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.scene=new THREE.Scene();this.scene.background=background?new THREE.Color('#111820'):null;
  this.camera=new THREE.PerspectiveCamera(32,width/height,.1,150);
  const env=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(env,.03);this.scene.environment=this.environment.texture;env.dispose();pmrem.dispose();
  this.scene.environmentIntensity=.6;
  this.scene.add(new THREE.HemisphereLight('#ffffff','#242c35',.85));
  const key=new THREE.DirectionalLight('#fff9ed',2.3);key.position.set(-4,6,8);key.castShadow=background;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-8,right:8,top:6,bottom:-6,near:1,far:35});key.shadow.bias=-.0006;this.scene.add(key);
  this.rim=new THREE.DirectionalLight('#dce8ef',2.6);this.rim.position.set(5,1,-2);this.scene.add(this.rim);
  const fill=new THREE.DirectionalLight('#ffffff',1.2);fill.position.set(4,-2,6);this.scene.add(fill);
  if(background){
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.ShadowMaterial({color:'#000000',opacity:.2}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.45;floor.receiveShadow=true;this.scene.add(floor);
  }
  this.front=new THREE.MeshPhysicalMaterial(style==='silk'?{color:'#e7e8e6',roughness:.43,metalness:.02,clearcoat:.25,clearcoatRoughness:.36,sheen:.35,sheenColor:'#eaeae5',sheenRoughness:.6}:{color:'#d4e0e8',roughness:.17,metalness:0,clearcoat:.9,clearcoatRoughness:.08,transmission:.2,thickness:.24,ior:1.4});
  this.side=new THREE.MeshStandardMaterial({color:style==='silk'?'#65717a':'#94a8b8',roughness:style==='silk'?.62:.27,metalness:.04});
  this.outlineMaterial=new THREE.LineBasicMaterial({color:'#f3f5ef',transparent:true,opacity:.45});
  this.root=new THREE.Group();this.scene.add(this.root);this.glyphs=[];
  this.font=font;this.setLines(lines);this.setPalette(this.colors);this.resize(width,height);
 }
 setLines(lines){
  const font=this.font,style=this.style;
  const old=new Set();this.root.traverse(o=>{if(o.geometry)old.add(o.geometry);});for(const g of old)g.dispose();this.root.clear();this.glyphs=[];
  let maximum=0,index=0;
  lines.forEach((line,row)=>{
   const glyphs=[];let pen=0;
   for(const ch of [...line.normalize('NFC')]){
    if(ch===' '){pen+=.4;continue;}
    if(!font.data.glyphs[ch])throw Error('Font lacks glyph: '+ch);
    const geo=new TextGeometry(ch,{font,size:1,depth:.26,curveSegments:12,bevelEnabled:true,bevelThickness:.036,bevelSize:.03,bevelSegments:3});geo.computeBoundingBox();
    const center=geo.boundingBox.getCenter(new THREE.Vector3()),glyphWidth=geo.boundingBox.max.x-geo.boundingBox.min.x;geo.translate(-center.x,-.48,-.13);
    const group=new THREE.Group(),chunks=pieces(geo,style).map((part,j)=>{const mesh=new THREE.Mesh(part.geometry,[this.front,this.side]);mesh.position.copy(part.center);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return{...part,mesh,seed:seeded(index*197+j*29),id:index*197+j*29};});
    const shell=new THREE.Group();
    for(const shape of font.generateShapes(ch,1)){
     const points=shape.extractPoints(16);
     for(const ring of [points.shape,...points.holes]){const contour=new THREE.BufferGeometry().setFromPoints(ring.map(p=>new THREE.Vector3(p.x-center.x,p.y-.48,.174)));shell.add(new THREE.LineLoop(contour,this.outlineMaterial));}
    }
    group.add(shell);
    const solid=new THREE.Mesh(geo,[this.front,this.side]);solid.castShadow=true;solid.receiveShadow=true;group.add(solid);
    const data={group,chunks,shell,solid,index:index++,row,x:pen+glyphWidth/2};pen+=glyphWidth+.055;glyphs.push(data);this.glyphs.push(data);this.root.add(group);
   }
   maximum=Math.max(maximum,pen);for(const g of glyphs){g.x-=pen/2;g.y=(lines.length-1)/2*1.35-row*1.35;g.group.position.set(g.x,g.y,0);}
  });
  this.root.scale.setScalar(Math.min((this.requestedFontSize??169)/169*2.1,8.9/Math.max(1,maximum),5.4/Math.max(1,lines.length)/1.35));
 }

 resize(width,height){if(this.disposed)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.position.set(.25,.4,Math.max(11,5.6/(this.camera.aspect*Math.tan(16*Math.PI/180))));this.camera.lookAt(0,0,0);this.camera.updateProjectionMatrix();}
 renderAt(seconds){
  if(this.disposed)return;const t=Math.max(0,seconds),exit=ease((t-6)/1.05);
  this.root.visible=t>.02&&t<this.duration&&exit<.999;this.root.rotation.y=.12+Math.sin(t*.7)*.085;this.root.rotation.x=-.09+Math.sin(t*.45)*.035;this.root.rotation.z=Math.sin(t*.4)*.01;
  for(const g of this.glyphs){
   const age=t-g.index*.045,enter=recoil(age/1.35),pulse=Math.exp(-Math.pow((t-3.9-g.x*.2-g.row*.16)/.33,2));
   g.group.position.set(g.x+(1-enter)*(g.index%2?.23:-.23),g.y+(1-enter)*-.5-exit*.5,0);g.group.rotation.y=(1-enter)*.5-exit*.3;
   const fractured=age<2.15||pulse>.15||exit>.001;g.solid.visible=!fractured;
   for(let j=0;j<g.chunks.length;j++){
    const p=g.chunks[j],local=t-g.index*.045-j*.009,settle=recoil((local-.05)/1.7),free=1-settle+exit;
    p.mesh.visible=fractured;
    if(this.style==='silk'){
     const band=p.band-2,stretch=free*(1+Math.abs(band)*.14);p.mesh.position.copy(p.center);p.mesh.position.x+=Math.sin(band*1.4)*stretch*.24;p.mesh.position.y+=band*stretch*.17;p.mesh.position.z+=Math.cos(band*.8)*stretch*.75+pulse*Math.sin(band)*.08;
     p.mesh.rotation.set(band*stretch*.36+pulse*band*.025,Math.sin(band)*stretch*.3,band*stretch*.09);p.mesh.scale.set(1,Math.max(.07,1-stretch*.1),1);
    }else{
     const a=p.seed*Math.PI*2,r=.8+p.seed*1.7;p.mesh.position.copy(p.center);p.mesh.position.x+=Math.cos(a+t*.12)*free*r;p.mesh.position.y+=Math.sin(a+t*.12)*free*r*.7;p.mesh.position.z+=free*(p.seed-.35)*2.6+pulse*.07;
     p.mesh.rotation.set(free*p.seed*4,free*(1-p.seed)*5,free*(p.seed-.5)*3);p.mesh.scale.setScalar(Math.max(.08,1-free*.3));
    }
   }
   const peel=(1-ease((age-.25)/1.8))*.22+pulse*.065+exit*.13;g.shell.position.set(peel*.22,peel*.16,peel*.8);g.shell.rotation.y=peel*.22;g.shell.scale.setScalar(1+peel*.025);g.shell.visible=true;
  }
  this.rim.position.x=4+Math.sin(t*.9)*2;this.renderer.render(this.scene,this.camera);
 }
 setPalette(colors){this.colors=titlePalette(this.style,{...this.colors,...colors});this.front.color.set(this.colors.font);this.side.color.set(this.colors.side);this.outlineMaterial.color.set(this.colors.border);if(this.front.sheenColor)this.front.sheenColor.set(this.colors.font);this.scene.traverse(o=>{if(o.material?.isShadowMaterial)o.material.color.set(this.colors.shadow);});if(this.scene.background)this.scene.background.set(this.colors.background);}
 getPreset(){return {version:1,engine:'three.js',style:this.style,colors:{...this.colors},duration:this.duration};}
 setBackground(enabled){this.scene.background=enabled?new THREE.Color(this.colors.background):null;this.renderer.setClearAlpha(enabled?1:0);this.scene.children.forEach(o=>{if(o.isMesh&&o.geometry.type==='PlaneGeometry')o.visible=enabled;});}
 dispose(){if(this.disposed)return;this.disposed=true;const materials=new Set(),geometries=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();this.environment.dispose();this.renderer.dispose();}
}
