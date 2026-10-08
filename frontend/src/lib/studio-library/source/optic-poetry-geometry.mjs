import * as THREE from '../../collection/three.mjs';
import {mxFinish} from './mega-geometry.mjs';
export function buildOpticPoetryGlyph(src,capHeight,support=false){
 const path=new THREE.ShapePath(),unit=1/capHeight;
 for(const [op,...args]of src.commands){const v=args.map(n=>n*unit);if(op==='M')path.moveTo(...v);else if(op==='L')path.lineTo(...v);else if(op==='Q')path.quadraticCurveTo(...v);else if(op==='C')path.bezierCurveTo(...v);else if(op==='Z')path.currentPath.closePath();}
 const shapes=path.toShapes(false);if(!shapes.length)return null;
 const depth=support?.055:.38,bevel=support?.003:.018,g=mxFinish(new THREE.ExtrudeGeometry(shapes,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:support?.002:.013,bevelSegments:7,curveSegments:16,steps:1}));
 // A restrained cylindrical camber bends the front and the bevel together.
 const a=g.attributes,buckets=[{p:[],n:[],u:[]},{p:[],n:[],u:[]},{p:[],n:[],u:[]}];
 function vertex(v,n,uv,b){const y=Math.max(0,Math.min(1,v[1])),front=Math.max(0,Math.min(1,(v[2]+bevel)/(depth+2*bevel))),rise=support?0:.060*4*y*(1-y),slope=support?0:.24*(1-2*y),normal=new THREE.Vector3(n[0],n[1]-n[2]*slope*front,n[2]).normalize();b.p.push(v[0],v[1],v[2]+rise*front-depth/2);b.n.push(normal.x,normal.y,normal.z);b.u.push(...uv);}
 function face(vs,ns,uvs,level=0){const lengths=[0,1,2].map(i=>{const j=(i+1)%3;return(vs[i][0]-vs[j][0])**2+(vs[i][1]-vs[j][1])**2;});if(!support&&Math.max(...lengths)>.020&&level<7){const i=lengths.indexOf(Math.max(...lengths)),j=(i+1)%3,k=(i+2)%3,mid=(x,y)=>x.map((n,c)=>(n+y[c])/2),v=mid(vs[i],vs[j]),n=mid(ns[i],ns[j]),u=mid(uvs[i],uvs[j]);face([vs[i],v,vs[k]],[ns[i],n,ns[k]],[uvs[i],u,uvs[k]],level+1);face([v,vs[j],vs[k]],[n,ns[j],ns[k]],[u,uvs[j],uvs[k]],level+1);return;}for(let i=0;i<3;i++)vertex(vs[i],ns[i],uvs[i],buckets[0]);}
 for(const group of g.groups)for(let i=group.start;i<group.start+group.count;i+=3){const vs=[],ns=[],uvs=[];for(let j=0;j<3;j++){const k=i+j;vs.push([a.position.getX(k),a.position.getY(k),a.position.getZ(k)]);ns.push([a.normal.getX(k),a.normal.getY(k),a.normal.getZ(k)]);uvs.push([a.uv.getX(k),a.uv.getY(k)]);}if(group.materialIndex===0)face(vs,ns,uvs);else for(let j=0;j<3;j++)vertex(vs[j],ns[j],uvs[j],buckets[group.materialIndex]);}
 g.dispose();const result=new THREE.BufferGeometry(),p=[],n=[],uv=[];let at=0;for(let i=0;i<3;i++){const b=buckets[i];for(const v of b.p)p.push(v);for(const v of b.n)n.push(v);for(const v of b.u)uv.push(v);result.addGroup(at,b.p.length/3,i);at+=b.p.length/3;}result.setAttribute('position',new THREE.Float32BufferAttribute(p,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));result.computeBoundingBox();return result;
}
