import * as THREE from '../../collection/three.mjs';
import {mxFinish} from './mega-geometry.mjs';
const shEpsilon=1e-6;
function shClip(poly,x,above){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=above?a.p[0]>=x:a.p[0]<=x,ib=above?b.p[0]>=x:b.p[0]<=x;if(ia)out.push(a);if(ia!==ib){const t=(x-a.p[0])/(b.p[0]-a.p[0]),mix=(u,v)=>u.map((n,k)=>n+(v[k]-n)*t);out.push({p:mix(a.p,b.p),n:mix(a.n,b.n),u:mix(a.u,b.u)});}}return out;}
function shContours(geometry,x){
 const p=geometry.attributes.position,points=new Map(),edges=new Map(),key=v=>Math.round(v[1]/shEpsilon)+':'+Math.round(v[2]/shEpsilon);
 for(let i=0;i<p.count;i+=3){const vs=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j)]),hits=[];for(let j=0;j<3;j++){const a=vs[j],b=vs[(j+1)%3];if((a[0]<x&&b[0]>=x)||(a[0]>=x&&b[0]<x)){const t=(x-a[0])/(b[0]-a[0]),v=[x,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];if(!hits.some(h=>key(h)===key(v)))hits.push(v);}}
  if(hits.length!==2)continue;const [a,b]=hits.map(v=>{const k=key(v);points.set(k,v);return k;});if(a!==b)edges.set([a,b].sort().join('|'),[a,b]);
 }
 const adjacency=new Map();for(const [a,b]of edges.values()){if(!adjacency.has(a))adjacency.set(a,[]);if(!adjacency.has(b))adjacency.set(b,[]);adjacency.get(a).push(b);adjacency.get(b).push(a);}const visited=new Set(),loops=[];
 for(const [first,next]of edges.values()){const edge=[first,next].sort().join('|');if(visited.has(edge))continue;const loop=[first];let previous=first,current=next;visited.add(edge);let closed=false;
  for(let guard=0;guard<edges.size+1;guard++){if(current===first){closed=true;break;}loop.push(current);const candidates=adjacency.get(current)||[],after=candidates.find(k=>k!==previous&&!visited.has([current,k].sort().join('|')))||candidates.find(k=>k===first);if(!after)break;visited.add([current,after].sort().join('|'));previous=current;current=after;}
  if(closed&&loop.length>=3)loops.push(loop.map(k=>points.get(k)));
 }
 loops.openVertices=[...adjacency.values()].filter(v=>v.length!==2).length;loops.unclosedEdges=edges.size-loops.reduce((sum,loop)=>sum+loop.length,0);return loops;
}
function shSlice(geometry,low,high,index){
 const a=geometry.attributes,buckets=Array.from({length:5},()=>({p:[],n:[],u:[]})),center=(low+high)/2;
 const emit=(v,b)=>{b.p.push(v.p[0]-center,v.p[1],v.p[2]);const normal=new THREE.Vector3(...v.n).normalize();b.n.push(normal.x,normal.y,normal.z);b.u.push(...v.u);};
 for(const group of geometry.groups)for(let i=group.start;i<group.start+group.count;i+=3){let poly=[0,1,2].map(j=>{const k=i+j;return{p:[a.position.getX(k),a.position.getY(k),a.position.getZ(k)],n:[a.normal.getX(k),a.normal.getY(k),a.normal.getZ(k)],u:[a.uv.getX(k),a.uv.getY(k)]};});const role=group.materialIndex===0&&poly[0].n[2]<-.5?4:group.materialIndex;poly=shClip(shClip(poly,low,true),high,false);for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]])emit(v,buckets[role]);}
 let capTriangles=0;const cutPlanes=[];
 for(const [x,direction]of [[low,-1],[high,1]]){const loops=shContours(geometry,x),cut={x,direction,loops:loops.length,openVertices:loops.openVertices,unclosedEdges:loops.unclosedEdges,outlineArea:0,triangleArea:0};for(const loop of loops){const outline=loop.map(v=>new THREE.Vector2(v[1],v[2])),triangles=THREE.ShapeUtils.triangulateShape(outline,[]);cut.outlineArea+=Math.abs(THREE.ShapeUtils.area(outline));for(const triangle of triangles){let vertices=triangle.map(i=>loop[i]),cross=new THREE.Vector3().subVectors(new THREE.Vector3(...vertices[1]),new THREE.Vector3(...vertices[0])).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...vertices[2]),new THREE.Vector3(...vertices[0])));cut.triangleArea+=cross.length()/2;if(cross.x*direction<0)vertices=[vertices[0],vertices[2],vertices[1]];for(const p of vertices)emit({p,n:[direction,0,0],u:[p[1],p[2]]},buckets[3]);capTriangles++;}}cutPlanes.push(cut);}
 const g=new THREE.BufferGeometry(),p=[],n=[],uv=[];let at=0;for(let i=0;i<5;i++){const b=buckets[i];for(const v of b.p)p.push(v);for(const v of b.n)n.push(v);for(const v of b.u)uv.push(v);g.addGroup(at,b.p.length/3,i);at+=b.p.length/3;}g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeBoundingBox();g.userData={low,high,center,index,capTriangles,cutPlanes};return g;
}
export function buildShutterGlyph(src,capHeight,support=false){
 const path=new THREE.ShapePath();for(const [op,...args]of src.commands){const v=args.map(n=>n/capHeight);if(op==='M')path.moveTo(...v);else if(op==='L')path.lineTo(...v);else if(op==='Q')path.quadraticCurveTo(...v);else if(op==='C')path.bezierCurveTo(...v);else if(op==='Z')path.currentPath.closePath();}const shapes=path.toShapes(false);if(!shapes.length)return{geometry:null,slices:null};
 const depth=support?.020:.220,g=mxFinish(new THREE.ExtrudeGeometry(shapes,{depth,bevelEnabled:true,bevelThickness:support?.002:.009,bevelSize:support?.0015:.007,bevelSegments:4,curveSegments:12,steps:1}));g.translate(0,0,-depth/2);g.computeBoundingBox();const b=g.boundingBox,width=b.max.x-b.min.x,cuts=[b.min.x-.0001,...[.24491,.51377,.76239].map(q=>b.min.x+width*q),b.max.x+.0001],slices=support?null:[0,1,2,3].map(i=>shSlice(g,cuts[i],cuts[i+1],i));return{geometry:g,slices};
}
