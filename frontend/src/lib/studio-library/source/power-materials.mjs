export function createPowerMaterials(THREE,renderer){
 const studio=new THREE.Scene();studio.background=new THREE.Color('#0c101b');const panels=[];
 for(const [w,h,x,y,z,col,power]of [[3,12,-7,4,8,'#ffffff',3.2],[11,1.7,0,8,6,'#fff4d6',3],[2,9,7,0,7,'#b4efff',2.3],[8,2,0,-6,6,'#d4b7ff',2],[.8,10,-1,0,8,'#ffffff',4]]){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(col).multiplyScalar(power),side:THREE.DoubleSide,toneMapped:false}));mesh.position.set(x,y,z);mesh.lookAt(0,0,0);studio.add(mesh);panels.push(mesh);}
 const gen=new THREE.PMREMGenerator(renderer),environment=gen.fromScene(studio,.035,.1,90);gen.dispose();panels.forEach(m=>{m.geometry.dispose();m.material.dispose();});
 const tile=document.createElement('canvas');tile.width=tile.height=128;const c=tile.getContext('2d');c.fillStyle='#808080';c.fillRect(0,0,128,128);let seed=314159;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 c.lineWidth=.8;for(let i=0;i<230;i++){const x=random()*128,y=random()*128;c.strokeStyle=random()>.5?'#a3a3a3':'#646464';c.beginPath();c.moveTo(x,y);c.lineTo(x+4+random()*22,y+.2);c.stroke();}
 const bump=new THREE.CanvasTexture(tile);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.repeat.set(3,3);
 function make(kind,p,index,large){
  const tint=large?(kind==='forge'?p.b:p.a):p.ink,metal={forge:1,opal:.22,armor:.90,gel:.06,prism:.72}[kind],rough={forge:.22,opal:.20,armor:.24,gel:.14,prism:.15}[kind];
  const face=new THREE.MeshPhysicalMaterial({color:tint,metalness:metal,roughness:rough,clearcoat:1,clearcoatRoughness:.12,envMap:environment.texture,envMapIntensity:1.0,iridescence:kind==='opal'?1:kind==='prism'?.65:.08,iridescenceIOR:1.32,iridescenceThicknessRange:kind==='opal'?[230,460]:[120,380],bumpMap:bump,bumpScale:kind==='forge'?.012:.006});
  const bevel=new THREE.MeshPhysicalMaterial({color:tint,metalness:kind==='gel'?.12:.90,roughness:.16,clearcoat:1,envMap:environment.texture,envMapIntensity:1.35,iridescence:kind==='opal'?.8:kind==='prism'?.65:0});
  const side=new THREE.MeshPhysicalMaterial({color:kind==='forge'?new THREE.Color(p.b).multiplyScalar(.30):kind==='opal'?p.b:kind==='gel'?p.b:p.dark,metalness:kind==='gel'?.24:.65,roughness:.24,clearcoat:1,envMap:environment.texture,envMapIntensity:.65});
  const rim=new THREE.MeshBasicMaterial({color:kind==='armor'?p.b:p.dark,toneMapped:false});
  const glow=new THREE.MeshBasicMaterial({color:kind==='armor'?p.b:kind==='opal'?p.b:p.a,toneMapped:false});
  return{face,bevel,side,rim,glow,all:[face,bevel,side,rim,glow],update(time,options,still){const shine=Math.max(.2,Math.min(1.8,Number(options.shine)||1)),detail=Math.max(0,Math.min(1,Number(options.texture)||0)),light=Math.max(0,Math.min(1.2,Number(options.glow)||0));face.envMapIntensity=shine*1.4;bevel.envMapIntensity=shine*1.6;face.roughness=rough+detail*.10;face.bumpScale=detail*(kind==='forge'?.025:.013);bevel.emissive.set(p.b);bevel.emissiveIntensity=light*.055;face.envMapRotation.set(0,still?.15:.15+Math.sin(time*.6)*.25,0);bevel.envMapRotation.copy(face.envMapRotation);side.envMapRotation.copy(face.envMapRotation);},dispose(){this.all.forEach(m=>m.dispose());}};
 }
 return{make,environment:environment.texture,dispose(){environment.dispose();bump.dispose();}};
}
