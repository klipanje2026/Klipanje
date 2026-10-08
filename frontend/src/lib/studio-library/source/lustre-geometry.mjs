import * as THREE from '../../collection/three.mjs';
import {mxFinish} from './mega-geometry.mjs';
// A shallow cylindrical camber keeps reflections continuous across the face.
// Every surface is deformed by the same field, so the bevel joins the side wall.
export function buildLustreGlyph(src,capHeight){
 const path=new THREE.ShapePath(),unit=1/capHeight;
 for(const [op,...args]of src.commands){const v=args.map(n=>n*unit);if(op==='M')path.moveTo(...v);else if(op==='L')path.lineTo(...v);else if(op==='Q')path.quadraticCurveTo(...v);else if(op==='C')path.bezierCurveTo(...v);else if(op==='Z')path.currentPath.closePath();}
 const shapes=path.toShapes(false);if(!shapes.length)return null;
 const original=mxFinish(new THREE.ExtrudeGeometry(shapes,{depth:.46,bevelEnabled:true,bevelThickness:.026,bevelSize:.020,bevelSegments:7,curveSegments:12,steps:1})),a=original.attributes,buckets=[{p:[],n:[],u:[]},{p:[],n:[],u:[]},{p:[],n:[],u:[]}];
 function vertex(v,n,uv,b){const y=Math.max(0,Math.min(1,v[1])),front=Math.max(0,Math.min(1,(v[2]+.026)/.512)),rise=.07*4*y*(1-y),slope=v[1]>0&&v[1]<1?.28*(1-2*y):0,stretch=1+rise/.512,nz=n[2]/stretch,normal=new THREE.Vector3(n[0],n[1]-nz*slope*front,nz).normalize();b.p.push(v[0],v[1],v[2]+rise*front);b.n.push(normal.x,normal.y,normal.z);b.u.push(...uv);}
 function face(vs,ns,uvs,depth=0){const lengths=[0,1,2].map(i=>{const j=(i+1)%3;return(vs[i][0]-vs[j][0])**2+(vs[i][1]-vs[j][1])**2;}),longest=Math.max(...lengths);if(longest>.025&&depth<7){const i=lengths.indexOf(longest),j=(i+1)%3,k=(i+2)%3,mid=(v,w)=>v.map((n,c)=>(n+w[c])/2),v=mid(vs[i],vs[j]),n=mid(ns[i],ns[j]),u=mid(uvs[i],uvs[j]);face([vs[i],v,vs[k]],[ns[i],n,ns[k]],[uvs[i],u,uvs[k]],depth+1);face([v,vs[j],vs[k]],[n,ns[j],ns[k]],[u,uvs[j],uvs[k]],depth+1);return;}for(let i=0;i<3;i++)vertex(vs[i],ns[i],uvs[i],buckets[0]);}
 for(const group of original.groups){for(let i=group.start;i<group.start+group.count;i+=3){const vs=[],ns=[],uvs=[];for(let j=0;j<3;j++){const k=i+j;vs.push([a.position.getX(k),a.position.getY(k),a.position.getZ(k)]);ns.push([a.normal.getX(k),a.normal.getY(k),a.normal.getZ(k)]);uvs.push([a.uv.getX(k),a.uv.getY(k)]);}if(group.materialIndex===0)face(vs,ns,uvs);else for(let j=0;j<3;j++)vertex(vs[j],ns[j],uvs[j],buckets[group.materialIndex]);}}
 original.dispose();const geo=new THREE.BufferGeometry(),p=[],n=[],uv=[];let at=0;for(let i=0;i<3;i++){const b=buckets[i];for(const v of b.p)p.push(v);for(const v of b.n)n.push(v);for(const v of b.u)uv.push(v);geo.addGroup(at,b.p.length/3,i);at+=b.p.length/3;}geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.translate(0,0,-.23);geo.computeBoundingBox();return geo;
}
