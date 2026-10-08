import * as THREE from './three.mjs';
import { HyperPopRenderer } from './hyper-renderer.mjs';
import { HyperPalettes } from './hyper-palettes.mjs';

export const HyperMarks = Object.freeze({
  auto:'Miks po riječima', underline:'Podvlaka', frame:'Iscrtani okvir',
  marker:'3D marker', orbit:'Kružni potez', brackets:'Uglovi + skener', burst:'Linije + bljesak'
});

const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const ease=n=>1-(1-clamp(n))**3;
const combinations=[['underline','frame'],['marker','orbit'],['brackets','underline'],['frame','burst'],['burst','marker'],['orbit','frame'],['underline','brackets'],['marker','underline']];

// Real geometry: a rounded, lit tube, its ink extrusion, and a narrow glossy ridge.
// Draw ranges reveal the stroke; nothing depends on a wall-clock animation timer.
export class HyperMarksRenderer extends HyperPopRenderer {
  constructor(canvas,options={}){
    super(canvas,options);
    this.effect=Object.hasOwn(HyperMarks,options.effect)?options.effect:'auto';
    this.annotations=[];this.markGeometries=[];this.markMaterials=[];this.markKey='';
    this.white=new THREE.Color('#fff4df');
  }

  clearMarks(){
    if(!this.annotations)return;
    this.annotations.forEach(a=>a.root.removeFromParent());
    this.markGeometries.forEach(g=>g.dispose());this.markMaterials.forEach(m=>m.dispose());
    this.annotations=[];this.markGeometries=[];this.markMaterials=[];this.markKey='';
  }
  clearWords(){this.clearMarks();super.clearWords();}
  buildWords(info,mode){
    super.buildWords(info,mode);
    const video=mode==='video',two=info.words.length>1;
    // Reserve real glyph heights (including Č/Ž accents) and the strokes around
    // them. The two words occupy separate bands at every aspect ratio.
    for(let line=0;line<info.words.length;line++){
      const letters=this.letters.filter(l=>l.line===line);if(!letters.length)continue;
      const bounds=this.wordBounds(letters),height=bounds.max.y-bounds.min.y,hero=letters[0].hero;
      const maxHeight=hero?(video?1.65:2.4):(video?.78:1.02);
      const maxWidth=Math.max(.3,Math.min(this.viewWidth*(hero?.72:.49),this.viewWidth-(hero?2.10:1.55)));
      const factor=Math.min(1,maxHeight/height,maxWidth/(bounds.max.x-bounds.min.x));
      const center=bounds.getCenter(new THREE.Vector3()),targetY=hero?(video?-2.50:(two?-.46:.25)):(video?-.43:2.23);
      for(const l of letters){l.x=center.x+(l.x-center.x)*factor;l.y=targetY+(l.y-center.y)*factor;l.scale*=factor;}
      if(hero){this.heroWidth*=factor;this.heroY=targetY;this.heroScale*=factor;}
    }
    this.buildMarks(info);
  }

  wordBounds(letters){
    const bounds=new THREE.Box3();
    for(const l of letters){const g=l.group.children[0].geometry;g.computeBoundingBox();const b=g.boundingBox.clone();b.min.multiply(new THREE.Vector3(l.scale,l.scale*l.stretch,1));b.max.multiply(new THREE.Vector3(l.scale,l.scale*l.stretch,1));b.translate(new THREE.Vector3(l.x,l.y,0));bounds.union(b);}
    return bounds;
  }

  material(role,{ink=false,opacity=1}={}){
    const m=new THREE.MeshPhysicalMaterial({color:ink?'#160b24':'#ffffff',metalness:ink?.02:.18,roughness:ink?.6:.23,clearcoat:ink?0:1,clearcoatRoughness:.17,envMap:this.materials.bevel.envMap,envMapIntensity:.65,transparent:true,opacity,depthWrite:opacity===1});
    m.userData={role,ink,baseOpacity:opacity};this.markMaterials.push(m);return m;
  }
  geometry(g){this.markGeometries.push(g);return g;}

  stroke(a,points,radius,role,delay=0,duration=.6){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
    const segments=Math.max(24,Math.min(150,Math.ceil(curve.getLength()*15))),radial=8;
    const root=new THREE.Group();a.root.add(root);
    const meshes=[];
    for(const [r,z,mat] of [[radius*1.6,-radius*.85,this.material('ink',{ink:true})],[radius,0,this.material(role)],[radius*.20,radius*.93,this.material('white')]]){
      const g=this.geometry(new THREE.TubeGeometry(curve,segments,r,radial,false));
      const mesh=new THREE.Mesh(g,mat);mesh.position.z=z;root.add(mesh);meshes.push(mesh);
    }
    const head=new THREE.Mesh(this.geometry(new THREE.SphereGeometry(radius*1.20,12,8)),this.material('white'));root.add(head);
    const item={curve,meshes,head,segments,radial,delay,duration,root};a.strokes.push(item);return item;
  }
  ray(a,p1,p2,role,delay=.55){return this.stroke(a,[p1,p2],a.thickness*.59,role,delay,.28);}
  sparkle(a,x,y,size,delay){
    this.ray(a,[x-size,y,.25],[x+size,y,.25],'white',delay);
    this.ray(a,[x,y-size,.25],[x,y+size,.25],'third',delay+.08);
  }
  roundedBox(w,h,r){
    const points=[],corners=[[w/2-r,h/2-r,0], [w/2-r,-h/2+r,-Math.PI/2],[-w/2+r,-h/2+r,-Math.PI],[-w/2+r,h/2-r,-Math.PI*1.5]];
    for(const [x,y,angle]of corners)for(let j=0;j<=10;j++){const t=angle+Math.PI/2-j*Math.PI/20;points.push([x+r*Math.cos(t),y+r*Math.sin(t),.20]);}
    points.push(points[0]);return points;
  }
  buildMarks(info){
    this.clearMarks();this.markKey=this.effect;
    const combination=combinations[(info.chunk+info.cueIndex*4)%combinations.length];
    info.words.forEach((word,line)=>{
      const letters=this.letters.filter(l=>l.line===line);if(!letters.length)return;
      const bounds=this.wordBounds(letters);
      const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),hero=letters[0].hero;
      const root=new THREE.Group();root.position.set(center.x,center.y,0);this.text.add(root);
      const a={root,word,line,hero,kind:this.effect==='auto'?combination[hero?1:0]:this.effect,width:size.x,height:size.y,thickness:hero?.073:.047,strokes:[],plates:[],scan:null};
      this.annotations.push(a);this.makeAccent(a);
    });
  }
  makeAccent(a){
    const {width:w,height:h,thickness:r}=a,pad=a.hero?.23:.17,l=-w/2-pad,right=w/2+pad,b=-h/2-pad,top=h/2+pad;
    if(a.kind==='underline'){
      this.stroke(a,[[l,b+.02,.18],[l+w*.22,b-.035,.18],[right-w*.25,b+.018,.18],[right+.08,b+.12,.18]],r*1.25,'third',.24,.66);
      this.stroke(a,[[l+w*.10,b-.22,.13],[l+w*.5,b-.20,.13],[right-w*.08,b-.13,.13]],r*.40,'second',.55,.65);
      this.sparkle(a,right+.18,b+.21,r*2,.86);
    }else if(a.kind==='frame'){
      this.stroke(a,this.roundedBox(w+pad*2,h+pad*2,Math.min(.17,h*.14)),r,'third',.27,.98);
      this.ray(a,[l-.07,top+.16,.21],[l+w*.22,top+.19,.21],'second',.55);
      this.ray(a,[right-w*.18,b-.17,.21],[right+.04,b-.17,.21],'second',1.0);
      this.sparkle(a,right+.08,top+.06,r*2.3,1.28);
    }else if(a.kind==='marker'){
      const x=w/2+pad*1.2,y=h*.42,shape=new THREE.Shape();
      shape.moveTo(-x+.12,-y);shape.lineTo(x-.12,-y+.035);shape.quadraticCurveTo(x+.09,-y+.07,x+.11,-y+.20);shape.lineTo(x+.24,y-.18);shape.quadraticCurveTo(x+.22,y+.04,x-.02,y);shape.lineTo(-x+.12,y+.015);shape.lineTo(-x-.14,y-.16);shape.lineTo(-x-.18,-y+.15);shape.closePath();
      const g=this.geometry(new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:true,bevelSegments:3,bevelSize:.028,bevelThickness:.028,curveSegments:12,steps:1}));
      const mat=this.material('second');
      mat.onBeforeCompile=shader=>{
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 markLocal;').replace('#include <begin_vertex>','#include <begin_vertex>\nmarkLocal=position;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 markLocal;').replace('#include <color_fragment>','#include <color_fragment>\nfloat hatch=smoothstep(.80,.88,fract((markLocal.x+markLocal.y)*10.));diffuseColor.rgb*=1.-hatch*.22;');
      };
      mat.customProgramCacheKey=()=> 'hyper-marker-hatch-v1';
      const plate=new THREE.Mesh(g,mat);plate.position.z=-1.45;plate.rotation.z=-.045;a.root.add(plate);
      const shadow=new THREE.Mesh(g,this.material('ink',{ink:true}));shadow.position.set(.025,-.045,-1.57);shadow.rotation.z=-.045;shadow.scale.set(1.025,1.10,1);a.root.add(shadow);
      a.plates.push({mesh:plate,x:0,y:0},{mesh:shadow,x:.025,y:-.045});
      this.ray(a,[right+.11,-h*.25,.24],[right+.32,-h*.12,.24],'third',.7);
      this.ray(a,[right+.14,h*.02,.24],[right+.40,h*.12,.24],'white',.77);
      this.ray(a,[l-.22,-h*.05,.24],[l-.09,h*.14,.24],'first',.9);
    }else if(a.kind==='orbit'){
      const points=[];for(let j=0;j<=96;j++){const t=-Math.PI*.20+j*Math.PI*2.10/96;points.push([Math.cos(t)*(w/2+pad+.02),Math.sin(t)*(h/2+pad+.07),.23]);}
      this.stroke(a,points,r*.93,'second',.29,1.05);
      this.stroke(a,[[l+.15,b-.14,.22],[0,b-.18,.22],[right+.05,b+.07,.22]],r*.48,'third',.84,.64);
      this.sparkle(a,l-.12,top-.02,r*2.3,1.15);
    }else if(a.kind==='brackets'){
      const arm=Math.min(w*.20,.58);
      for(const [sx,sy]of [[-1,1],[1,1],[1,-1],[-1,-1]])this.stroke(a,[[sx*(w/2+pad-arm),sy*(h/2+pad),.23],[sx*(w/2+pad),sy*(h/2+pad),.23],[sx*(w/2+pad),sy*(h/2+pad-.27),.23]],r,sx===sy?'third':'second',.30+(sy<0?.23:0),.55);
      const scan=new THREE.Mesh(this.geometry(new THREE.BoxGeometry(w+.12,.024,.018)),this.material('white',{opacity:.7}));scan.position.z=1.0;a.root.add(scan);a.scan=scan;
      this.ray(a,[l+.11,b-.14,.23],[l+Math.min(.7,w*.3),b-.14,.23],'first',.85);
    }else{
      this.stroke(a,[[l,b+.03,.20],[l+w*.25,b-.05,.20],[l+w*.52,b+.07,.20],[right,b+.08,.20]],r,'third',.22,.70);
      const rays=[[right+.12,h*.30,right+.46,h*.49],[right+.20,h*.06,right+.63,h*.12],[right+.14,-h*.23,right+.49,-h*.41],[l-.12,h*.23,l-.39,h*.37],[l-.12,-h*.10,l-.46,-h*.15]];
      rays.forEach((p,i)=>this.ray(a,[p[0],p[1],.23],[p[2],p[3],.23],i%2?'second':'first',.47+i*.09));
      this.sparkle(a,right+.44,top-.02,r*2.5,.95);
    }
  }

  beforeRender(info,{reducedMotion:still}){
    // The old floating field is replaced by graphics anchored to each word.
    this.field.visible=false;if(!info)return;
    if(this.markKey!==this.effect)this.buildMarks(info);
    const palette=HyperPalettes[this.palette]||HyperPalettes.candy;
    for(const m of this.markMaterials){if(m.userData.ink)continue;const slot={first:0,second:1,third:2}[m.userData.role];m.color.set(slot===undefined?'#fff4df':palette.colors[slot]);if(slot!==undefined)m.color.lerp(this.white,.06);}
    const tempo=Math.min(1,info.span/2.8),t=still?1.9:info.local/tempo,exit=still?0:clamp((info.local-info.span+.38*tempo)/(.38*tempo));
    const flow=still?0:this.time;
    for(const a of this.annotations){
      const age=t-a.line*.13,fade=still?1:clamp((age-.20)/.20)*(1-exit),enter=still?1:ease((age-.18)/.65);
      a.root.visible=fade>.002;a.root.scale.set(1-(1-enter)*.06,1-(1-enter)*.06,1);
      a.root.rotation.z=(still?0:Math.sin(flow*1.35+a.line)*.008)-(1-enter)*.055;
      for(const s of a.strokes){
        const q=still?1:ease((age-s.delay)/s.duration),count=Math.floor(q*s.segments)*s.radial*6;
        s.root.visible=q>.001;s.meshes.forEach(mesh=>{mesh.geometry.setDrawRange(0,count);mesh.material.opacity=fade;});
        s.head.visible=q>.001&&q<.994;s.head.position.copy(s.curve.getPointAt(q));s.head.position.z+=a.thickness*.85;s.head.material.opacity=fade;
      }
      const open=still?1:ease((age-.18)/.66);
      a.plates.forEach(({mesh,x,y})=>{mesh.scale.x=open;mesh.position.x=x-a.width*(1-open)*.5;mesh.position.y=y;mesh.material.opacity=fade;});
      if(a.scan){const progress=still?1:clamp((age-.70)/.9);a.scan.visible=!still&&progress>0&&progress<1;a.scan.position.y=(progress-.5)*(a.height+.14);a.scan.material.opacity=Math.sin(progress*Math.PI)*.58*fade;}
    }
  }
  dispose(){this.clearMarks();super.dispose();}
}
