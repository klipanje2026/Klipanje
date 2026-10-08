import * as THREE from '../../collection/three.mjs';
import { MeadowTypeRenderer } from './meadow-renderer.mjs';
import { LuxuryThemes } from './luxury-themes-config.mjs';
import { MeadowFont } from './meadow-font.mjs';
import { LuxuryFonts } from './luxury-fonts.mjs';
import { lxgFinish } from './luxury-geometry.mjs';
const lxClamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lxEase=t=>1-(1-lxClamp(t))**3;

// Procedural surfaces use geometric coordinates; no bitmap assets or filters.
const lxSurfaceGLSL=`
 uniform float lxKind,lxTexture,lxFine,lxClock,lxMotion;
 varying vec3 vLX;
 float lxHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float lxNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(lxHash(i),lxHash(i+vec2(1,0)),f.x),mix(lxHash(i+vec2(0,1)),lxHash(i+vec2(1,1)),f.x),f.y);}
 float lxFbm(vec2 p){return .55*lxNoise(p)+.28*lxNoise(p*2.03)+.17*lxNoise(p*4.11);}
 float lxPattern(vec3 p){
  vec2 q=p.xy;float n=lxFbm(q*12.);
  if(lxKind<.5){float layer=sin(q.y*31.+lxFbm(q*3.4)*7.);float pores=smoothstep(.69,.92,lxNoise(q*84.));return .90+.055*layer+.08*n-pores*.20;}
  if(lxKind<1.5){vec2 weave=q*(lxFine>.5?132.:91.);float warp=sin(weave.x)*sin(weave.y);return .93+warp*.034+lxNoise(q*45.)*.06;}
  if(lxKind<2.5){float fibres=lxNoise(q*vec2(122.,17.));return .92+n*.09+fibres*.032;}
  if(lxKind<3.5){float grain=sin(q.x*61.+lxFbm(q*vec2(2.4,.37))*8.);float growth=sin(q.x*17.+lxFbm(q*vec2(1.1,.24))*5.);return .90+grain*.040+growth*.027+lxNoise(q*vec2(62.,4.))*.07;}
  return .986+.012*n;
 }
`;

export class LuxuryCaptionRenderer extends MeadowTypeRenderer {
 constructor(canvas,{theme='stone',palette,...options}={}){
  super(canvas,{density:0,...options});
  this.theme=Object.hasOwn(LuxuryThemes,theme)?theme:'stone';this.palette=palette||Object.keys(LuxuryThemes[this.theme].palettes)[0];
  this.motion=options.motion??1;this.texture=options.texture??1;this.depth=options.depth??1;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const key=this.scene.children.find(o=>o.isDirectionalLight);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-12;key.shadow.camera.right=12;key.shadow.camera.top=8;key.shadow.camera.bottom=-8;key.shadow.camera.near=.5;key.shadow.camera.far=35;key.shadow.bias=-.0003;key.shadow.normalBias=.012;
  this.effects=new THREE.Group();this.scene.add(this.effects);this.effectItems=[];this.motifMaterials=[];this.shaders=[];
  this.createEnvironment();
  for(const material of [this.face,this.bevel,this.side])this.surface(material,true);
  this.active='';
 }
 createGrass(){this.grassLayers=[];}
 createEnvironment(){
  const studio=new THREE.Scene();studio.background=new THREE.Color('#777d7b');
  const panels=[];
  for(const [x,y,z,w,h,color]of [[-5,4,2,4,7,'#f4f0e4'],[4,2,4,2.5,6,'#e4eef0'],[0,6,-3,9,2,'#e3dbcd'],[0,-4,2,8,2,'#414642']]){
   const m=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}),g=new THREE.PlaneGeometry(w,h),mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.lookAt(0,0,0);studio.add(mesh);panels.push(mesh);
  }
  const pmrem=new THREE.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(studio,.08);pmrem.dispose();panels.forEach(m=>{m.geometry.dispose();m.material.dispose();});
  this.scene.environment=this.environment.texture;
 }
 surface(material,fine=false){
  material.envMapIntensity=.40;material.onBeforeCompile=shader=>{
   const uniforms={lxKind:{value:LuxuryThemes[this.theme]?.kind??0},lxTexture:{value:this.texture??1},lxFine:{value:fine?1:0},lxClock:{value:this.activeStill?0:this.time||0},lxMotion:{value:fine||this.activeStill?0:lxClamp(this.motion??1,0,1.8)}};Object.assign(shader.uniforms,uniforms);this.shaders.push(uniforms);
   shader.vertexShader='varying vec3 vLX;uniform float lxKind,lxClock,lxMotion;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    if(lxKind>.5&&lxKind<1.5&&${fine?'false':'true'}){float envelope=sin(clamp(uv.x,0.,1.)*3.14159265);transformed.y+=sin(position.x*1.9-lxClock*.85)*.055*envelope*lxMotion;transformed.z+=sin(position.x*2.3+lxClock*.67)*.055*envelope*lxMotion;}
    vLX=(modelMatrix*vec4(transformed,1.)).xyz;
   `);
   shader.fragmentShader=lxSurfaceGLSL+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float lxSurface=lxPattern(vLX);diffuseColor.rgb*=mix(1.,lxSurface,clamp(lxTexture,0.,1.8));
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    float lxHeight=lxPattern(vLX)*.006*lxTexture;
    vec3 lxSX=dFdx(-vViewPosition),lxSY=dFdy(-vViewPosition),lxR1=cross(lxSY,normal),lxR2=cross(normal,lxSX);
    float lxDet=dot(lxSX,lxR1);
    if(abs(lxDet)>.000001)normal=normalize(abs(lxDet)*normal-sign(lxDet)*(dFdx(lxHeight)*lxR1+dFdy(lxHeight)*lxR2));
   `);
  };
  material.customProgramCacheKey=()=>`luxury-surface-${fine?'face':'motif'}-v1`;return material;
 }
 material(color,roughness=.6,metalness=0){
  const material=this.surface(new THREE.MeshStandardMaterial({color,roughness,metalness,transparent:true,side:THREE.DoubleSide}));this.motifMaterials.push(material);return material;
 }
 mesh(geometry,material,parent=this.effects){const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=this.theme!=='glass';mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 box(w,h,d,material,parent=this.effects){return this.mesh(new THREE.BoxGeometry(w,h,d),material,parent);}
 line(points,radius,material,parent=this.effects){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return this.mesh(new THREE.TubeGeometry(curve,Math.max(12,points.length*14),radius,6,false),material,parent);}
 clearEffects(){
  if(!this.effects)return;this.effects.traverse(o=>o.geometry?.dispose());this.effects.clear();this.motifMaterials.forEach(m=>m.dispose());this.motifMaterials=[];this.effectItems=[];
  this.shaders=this.shaders.filter(u=>u.lxFine.value===1);
 }
 glyph(char){
  const fontKey=['silk','paper'].includes(this.theme)?'serif':['glass','wood'].includes(this.theme)?'regular':'medium',font=fontKey==='medium'?MeadowFont:LuxuryFonts[fontKey],key=fontKey+':'+char;
  if(this.cache.has(key))return this.cache.get(key);const source=font.glyphs[char]||font.glyphs['?'],unit=1/font.capHeight,path=new THREE.ShapePath();
  for(const [name,...values]of source.commands){const p=values.map(n=>n*unit);if(name==='M')path.moveTo(...p);else if(name==='L')path.lineTo(...p);else if(name==='Q')path.quadraticCurveTo(...p);else if(name==='C')path.bezierCurveTo(...p);else if(name==='Z')path.currentPath.closePath();}
  const shapes=path.toShapes(false),geometry=shapes.length?lxgFinish(new THREE.ExtrudeGeometry(shapes,{depth:.066,bevelEnabled:true,bevelThickness:.013,bevelSize:.007,bevelSegments:4,curveSegments:14,steps:1})):null;
  const glyph={geometry,advance:source.advance*unit};this.cache.set(key,glyph);return glyph;
 }
 buildWords(info){
  super.buildWords(info);this.clearEffects();
  const palette=this.currentPalette();this.surfaceMaterial=this.material(palette.surface,this.theme==='silk'?.34:this.theme==='glass'?.14:.73,this.theme==='glass'?.28:0);
  this.shadowMaterial=this.material(palette.shadow,.91,0);this.accentMaterial=this.material(palette.accent,.40,.48);
  let minX=Infinity,maxX=-Infinity,maxY=-Infinity,minY=Infinity;
  for(const word of this.words){
   let right=0;word.group.children.forEach(m=>{m.castShadow=true;m.receiveShadow=true;m.geometry.computeBoundingBox();right=Math.max(right,m.position.x+m.geometry.boundingBox.max.x);});word.w=right*word.scale;word.cx=word.x+word.w/2;
   minX=Math.min(minX,word.x);maxX=Math.max(maxX,word.x+word.w);minY=Math.min(minY,word.y);maxY=Math.max(maxY,word.y+word.scale);
  }
  this.bounds={left:minX,right:maxX,bottom:minY,top:maxY,width:maxX-minX,height:maxY-minY,cx:(minX+maxX)/2,cy:(minY+maxY)/2};
  if(this.theme==='stone')this.createStone();if(this.theme==='silk')this.createSilk();if(this.theme==='paper')this.createPaper();if(this.theme==='wood')this.createWood();if(this.theme==='glass')this.createGlass();
 }
 currentPalette(){const theme=LuxuryThemes[this.theme]||LuxuryThemes.stone;return theme.palettes[this.palette]||Object.values(theme.palettes)[0];}
 createStone(){
  const b=this.bounds,width=b.width+.60,height=b.height+.45,n=7;
  for(let i=0;i<n;i++){
   const x=b.cx-width/2+(i+.5)*width/n,h=height*(.84+.08*Math.cos(i*.8));
   const column=this.box(width/n*.48,h,.48,this.surfaceMaterial);column.position.set(x,b.cy-.035,-.60);column.rotation.set(-.045,-.12,0);this.effectItems.push({kind:'stone',mesh:column,x,y:column.position.y,z:-.60,index:i,n,h});
   const groove=this.box(.010,h*.92,.014,this.accentMaterial);groove.position.set(x+width/n*.16,b.cy-.035,-.335);this.effectItems.push({kind:'stone',mesh:groove,x:groove.position.x,y:groove.position.y,z:-.335,index:i,n,h});
  }
  const plinth=this.box(width+.14,.26,.68,this.surfaceMaterial);plinth.position.set(b.cx,b.bottom-.25,-.10);plinth.rotation.x=.18;this.effectItems.push({kind:'base',mesh:plinth,y:plinth.position.y});
  const lip=this.box(width+.12,.014,.013,this.accentMaterial);lip.position.set(b.cx,b.bottom-.27,.25);this.effectItems.push({kind:'base',mesh:lip,y:lip.position.y});
 }
 ribbonGeometry(width,scale,offset,front){
  const positions=[],uv=[],indices=[],steps=90;
  for(let i=0;i<=steps;i++){
   const u=i/steps,x=(u-.5)*width;
   const arch=Math.sin(u*Math.PI*2+offset),cy=-.19*scale+arch*.49*scale;
   const cz=.10+Math.cos(u*Math.PI*2+offset)*.48;
   const twist=Math.cos(u*Math.PI*2+offset)*1.05;
   for(let j=0;j<5;j++){const v=j/4-.5,band=scale*.40;positions.push(x,cy+v*band*Math.cos(twist),cz+v*band*Math.sin(twist));uv.push(u,j/4);}
   if(i<steps)for(let j=0;j<4;j++){const a=i*5+j,b=a+1,c=a+5,d=a+6;indices.push(a,c,b,b,c,d);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
 }
 createSilk(){
  const b=this.bounds,scale=Math.min(1.55,Math.max(.55,this.words[0]?.scale||1)),width=Math.min(this.viewWidth*.94,b.width+.8),g=this.ribbonGeometry(width,scale,.0,true),ribbon=this.mesh(g,this.surfaceMaterial);ribbon.position.set(b.cx,b.bottom,0);this.effectItems.push({kind:'ribbon',mesh:ribbon,total:g.index.count,y:b.bottom,index:0});
  const points=[];for(let j=0;j<=60;j++){const u=j/60,twist=Math.cos(u*Math.PI*2)*1.05;points.push([b.cx+(u-.5)*width,b.bottom-.19*scale+Math.sin(u*Math.PI*2)*.49*scale-.20*scale*Math.cos(twist),.10+Math.cos(u*Math.PI*2)*.48-.20*scale*Math.sin(twist)]);}
  const edge=this.line(points,.0045,this.accentMaterial);this.effectItems.push({kind:'thread',mesh:edge,total:edge.geometry.index.count,index:0});
 }
 createPaper(){
  const b=this.bounds,width=Math.min(this.viewWidth*.91,b.width+.88),height=b.height+.96;
  this.paperGroup=new THREE.Group();this.paperGroup.position.set(b.cx,b.cy,-.44);this.effects.add(this.paperGroup);
  for(let i=2;i>=0;i--){const panel=this.box(width,height,.047,i===0?this.surfaceMaterial:this.shadowMaterial,this.paperGroup);panel.position.set(i*.055,-i*.062,-i*.068);panel.rotation.z=-i*.018;}
  const rule=this.box(width*.30,.011,.012,this.accentMaterial,this.paperGroup);rule.position.set(-width*.5+.30+width*.15,-height*.5+.24,.036);
  for(const radius of [.15,.12]){const seal=this.mesh(new THREE.TorusGeometry(radius,.009,8,64),this.accentMaterial,this.paperGroup);seal.position.set(width*.5-.32,-height*.5+.29,.043);this.effectItems.push({kind:'seal',mesh:seal});}
  const points=[[-.085,-.02,0],[0,.065,0],[.085,-.02,0],[0,-.08,0],[-.085,-.02,0]];const mark=this.line(points,.008,this.accentMaterial,this.paperGroup);mark.position.set(width*.5-.32,-height*.5+.29,.044);this.effectItems.push({kind:'seal',mesh:mark});
  this.effectItems.push({kind:'paper',mesh:this.paperGroup,y:b.cy,z:-.44});
 }
 createWood(){
  for(const [wordIndex,word]of this.words.entries()){
   const width=word.w+.48,n=Math.max(6,Math.ceil(width/.39)),height=word.scale*1.45;
   for(let i=0;i<n;i++){
    const pivot=new THREE.Group();pivot.position.set(word.cx-width/2+i*width/n,word.y+word.scale*.40,-.29);this.effects.add(pivot);
    const slat=this.box(width/n-.024,height,.12,this.surfaceMaterial,pivot);slat.position.x=width/n*.5;slat.rotation.x=.07;
    const inlay=this.box(.009,height*.96,.013,this.accentMaterial,pivot);inlay.position.set(width/n*.86,0,.073);
    this.effectItems.push({kind:'wood',mesh:pivot,index:i,n,wordIndex});
   }
   const foot=this.box(width+.04,.065,.16,this.shadowMaterial);foot.position.set(word.cx,word.y-word.scale*.34,-.14);this.effectItems.push({kind:'base',mesh:foot,y:foot.position.y});
  }
 }
 createGlass(){
  const p=this.currentPalette();this.surfaceMaterial.opacity=.15;this.surfaceMaterial.depthWrite=false;
  const glass=new THREE.MeshPhysicalMaterial({color:p.surface,roughness:.10,metalness:.1,transparent:true,opacity:.17,depthWrite:false,clearcoat:1,clearcoatRoughness:.08,envMap:this.environment.texture,envMapIntensity:.75});this.motifMaterials.push(glass);
  const b=this.bounds,panels=[{width:b.width+.56,height:b.height+.48,x:b.cx,y:b.cy,z:-.35,angle:.06},{width:b.width+.56,height:.25,x:b.cx,y:b.bottom-.33,z:.25,angle:.10},{width:.65,height:b.height+.72,x:b.right-.30,y:b.cy,z:.35,angle:-.25}];
  panels.forEach(({width,height,x,y,z,angle},j)=>{
    const group=new THREE.Group();this.effects.add(group);const panel=this.box(width,height,.10,glass,group);
    const edgeMaterial=this.material(p.accent,.24,.58);edgeMaterial.opacity=.45;
    for(const side of [-1,1]){const vertical=this.box(.012,height,.020,edgeMaterial,group);vertical.position.set(side*width/2,0,.05);const horizontal=this.box(width,.010,.020,edgeMaterial,group);horizontal.position.set(0,side*height/2,.05);}
    group.position.set(x,y,z);group.rotation.set(-.065,angle,j===0?-.035:0);this.effectItems.push({kind:'glass',mesh:group,x,y,z,index:j,width,height,angle});
  });
 }
 render(seconds,{mode=this.mode,reducedMotion=this.reducedMotion}={}){
  if(this.disposed)return null;this.time=Number.isFinite(seconds)?seconds:0;this.mode=mode==='video'?'video':'stage';this.theme=Object.hasOwn(LuxuryThemes,this.theme)?this.theme:'stone';
  const info=this.locate(this.time),p=this.currentPalette(),stage=this.mode==='stage',still=!!reducedMotion;this.activeStill=still;
  this.background.visible=stage&&!this.transparentStage;this.floor.visible=false;this.text.visible=!!info;if(this.effects)this.effects.visible=!!info;
  this.backMaterial.uniforms.uA.value.set(p.background[0]);this.backMaterial.uniforms.uB.value.set(p.background[1]);
  this.face.color.set(p.text);this.bevel.color.set(p.text).multiplyScalar(.88);this.side.color.set(p.text).multiplyScalar(.52);this.face.roughness=this.theme==='silk'?.47:this.theme==='glass'?.28:.76;
  this.face.envMapIntensity=this.theme==='glass'?.55:.20;this.bevel.envMapIntensity=.60;
  if(info&&this.effects){
   const key=`${this.theme}:${this.palette}:${info.cueIndex}:${info.chunk}:${this.mode}:${this.display}:${this.textSize}`;if(this.active!==key){this.active=key;this.buildWords(info);}
   const tempo=Math.min(1,info.span/3.5),t=still?4:info.local/tempo,motion=still?0:lxClamp(this.motion,0,1.8),exit=still?0:lxClamp((info.local-info.span+.42*tempo)/(.42*tempo));
   const fade=still?1:lxClamp(t/.25)*(1-exit);this.face.opacity=this.bevel.opacity=this.side.opacity=fade;
   for(const word of this.words){
    const q=still?1:lxEase((t-word.index*.11)/.90);
    let rise=.40*(1-q),z=.02,rx=-.10,ry=-.15;
    if(this.theme==='paper'){rise=-.20*(1-q);z=-.416-word.scale*lxClamp(this.depth,.4,1.8)*2.1*.079+.013+(1-q)*.55;rx=0;ry=0;}
    if(this.theme==='silk'){rise=.25*(1-q);rx=-.03;ry=.012*Math.sin(this.time*.55+word.index)*motion;}
    if(this.theme==='glass'){rise=.13*(1-q);ry=-.06;}
    word.group.position.set(word.x,word.y-rise-exit*.12,z);word.group.rotation.set(rx,ry,0);word.group.scale.set(word.scale,word.scale,word.scale*lxClamp(this.depth,.4,1.8)*(this.theme==='paper'?2.1:4));
   }
   for(const mat of this.motifMaterials){mat.opacity=(mat.type==='LineBasicMaterial'?.38:mat===this.surfaceMaterial&&this.theme==='glass'?.15:mat.type==='MeshPhysicalMaterial'?.17:1)*fade;}
   for(const u of this.shaders){u.lxKind.value=LuxuryThemes[this.theme].kind;u.lxTexture.value=lxClamp(this.texture,0,1.8);u.lxClock.value=still?0:this.time;u.lxMotion.value=u.lxFine.value?0:motion;}
   for(const item of this.effectItems){
    const q=still?1:lxEase((t-.08-(item.index||0)*.075)/1.3),mesh=item.mesh;
    if(item.kind==='stone'){mesh.position.y=item.y-(1-q)*.75;mesh.scale.y=.20+.80*q;mesh.rotation.y=(1-q)*-.12;}
    if(item.kind==='base'){mesh.scale.x=still?1:lxEase(t/1.0);mesh.position.y=item.y-.08*(1-q);}
    if(item.kind==='ribbon'){const reveal=still?1:lxClamp((t-.10-item.index*.12)/1.6);mesh.geometry.setDrawRange(0,Math.floor(item.total*reveal/6)*6);mesh.position.y=item.y-(1-q)*.30;}
    if(item.kind==='thread'){mesh.geometry.setDrawRange(0,Math.floor(item.total*(still?1:lxClamp((t-.35)/1.8))/6)*6);}
    if(item.kind==='paper'){mesh.rotation.x=(1-q)*-.22;mesh.position.y=item.y-(1-q)*.38;mesh.position.z=item.z-(1-q)*.20;}
    if(item.kind==='seal'){const seal=still?1:lxEase((t-.8)/.9);mesh.scale.setScalar(.65+.35*seal);mesh.visible=seal>.01;}
    if(item.kind==='wood'){mesh.rotation.y=(1-q)*-1.35+Math.sin((still?0:this.time*.37)+item.index*.18)*.014*motion;}
    if(item.kind==='glass'){mesh.position.x=item.x+(1-q)*-.85+Math.sin((still?0:this.time*.35)+item.index*.85)*.07*motion;mesh.position.y=item.y;mesh.rotation.y=item.angle+Math.sin((still?0:this.time*.25)+item.index)*.025*motion;}
   }
  }
  this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.camera);return info;
 }
 dispose(){if(this.disposed)return;this.clearEffects();this.environment?.dispose();this.scene.children.forEach(o=>o.shadow?.dispose?.());super.dispose();}
}
