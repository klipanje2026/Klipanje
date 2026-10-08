/** The reference CSS rotateX/rotateY/perspective projected as textured WebGL planes. */
import * as THREE from './three.mjs';
export function createDepthStage(){
 const canvas=document.createElement('canvas'),renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),group=new THREE.Group(),camera=new THREE.PerspectiveCamera(2*Math.atan(180/900)*180/Math.PI,736/360,.1,3000);camera.position.z=900;scene.add(group);
 const items=[];let used=0,box;
 return{canvas,resize(w,h){renderer.setSize(w,h,false);},begin(rect,depth){box=rect;used=0;group.position.set(rect.x+rect.width/2-368,180-(rect.y+rect.height/2),0);group.rotation.set(-8*depth*Math.PI/180,-7*depth*Math.PI/180,0,'XYZ');},
  word(source,item,margin,state){
   let entry=items[used];if(!entry){const textureCanvas=document.createElement('canvas'),texture=new THREE.CanvasTexture(textureCanvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);group.add(mesh);items.push(entry={mesh,textureCanvas,texture,material});}
   const {mesh,textureCanvas,texture,material}=entry;textureCanvas.width=source.width;textureCanvas.height=source.height;const c=textureCanvas.getContext('2d');c.filter=state.blur>.001?`blur(${state.blur}px)`:'none';c.drawImage(source,0,0);texture.needsUpdate=true;
   mesh.visible=true;mesh.renderOrder=used;material.opacity=state.opacity;mesh.position.set(item.x+item.width/2-(box.x+box.width/2),-(item.y+item.height/2+state.dy-(box.y+box.height/2)),0);mesh.rotation.x=-state.rx*Math.PI/180;
   mesh.scale.set((item.width+2*margin)*state.scale,(item.height+2*margin)*state.scale,1);used++;
  },render(){for(let i=used;i<items.length;i++)items[i].mesh.visible=false;renderer.render(scene,camera);},dispose(){for(const i of items){i.texture.dispose();i.material.dispose();i.mesh.geometry.dispose();}renderer.dispose();renderer.forceContextLoss();}
 };
}
