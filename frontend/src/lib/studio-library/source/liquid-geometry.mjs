import * as THREE from '../../collection/three.mjs';
const liClamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function liFinish(geometry){
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,arrays=[[],[],[]];
  // Degenerate triangles have no area and cannot provide a lighting normal.
  for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);
    if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-18)continue;
    for(let j=0;j<3;j++){arrays[0].push(p.getX(i+j),p.getY(i+j),p.getZ(i+j));arrays[1].push(n.getX(i+j),n.getY(i+j),n.getZ(i+j));arrays[2].push(uv.getX(i+j),uv.getY(i+j));}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arrays[0],3));g.setAttribute('normal',new THREE.Float32BufferAttribute(arrays[1],3));g.setAttribute('uv',new THREE.Float32BufferAttribute(arrays[2],2));geometry.dispose();
  const pn=g.attributes.position,nn=g.attributes.normal,sums=new Map(),keys=[];
  const key=i=>`${Math.round(pn.getX(i)*1e6)},${Math.round(pn.getY(i)*1e6)},${Math.round(pn.getZ(i)*1e6)}`;
  // Angle-weighted bevel normals keep a smooth reflection across curved corners.
  for(let i=0;i<pn.count;i+=3){if(Math.abs(nn.getZ(i))>.999)continue;for(let j=0;j<3;j++){
    const at=i+j,b=i+(j+1)%3,c=i+(j+2)%3,a=new THREE.Vector3().fromBufferAttribute(pn,at),v=new THREE.Vector3().fromBufferAttribute(pn,b).sub(a),w=new THREE.Vector3().fromBufferAttribute(pn,c).sub(a),den=v.length()*w.length();
    const angle=den?Math.acos(liClamp(v.dot(w)/den,-1,1)):0,k=key(at);keys[at]=k;const sum=sums.get(k)||new THREE.Vector3();sum.addScaledVector(new THREE.Vector3().fromBufferAttribute(nn,at),angle);sums.set(k,sum);}}
  // Classify before smoothing: flat front, rounded bevel and deep side walls.
  let last=-1,start=0;for(let i=0;i<nn.count;i+=3){const nz=(nn.getZ(i)+nn.getZ(i+1)+nn.getZ(i+2))/3,type=nz>.999?0:nz>.025?1:2;if(type!==last){if(last>=0)g.addGroup(start,i-start,last);start=i;last=type;}}
  if(last>=0)g.addGroup(start,nn.count-start,last);
  for(let i=0;i<nn.count;i++){const v=sums.get(keys[i]);if(v&&v.lengthSq()>1e-16){v.normalize();nn.setXYZ(i,v.x,v.y,v.z);}}
  // One contiguous bucket per finish: three draw calls per glyph, irrespective
  // of the number of curve segments or bevel triangles.
  const buckets=[{p:[],n:[],u:[]},{p:[],n:[],u:[]},{p:[],n:[],u:[]}],gu=g.attributes.uv;
  for(const group of g.groups){const bucket=buckets[group.materialIndex];for(let i=group.start;i<group.start+group.count;i++){bucket.p.push(pn.getX(i),pn.getY(i),pn.getZ(i));bucket.n.push(nn.getX(i),nn.getY(i),nn.getZ(i));bucket.u.push(gu.getX(i),gu.getY(i));}}
  g.clearGroups();const pos=[],normal=[],coords=[];let offset=0;for(let i=0;i<3;i++){const b=buckets[i],count=b.p.length/3;if(count){g.addGroup(offset,count,i);offset+=count;for(const value of b.p)pos.push(value);for(const value of b.n)normal.push(value);for(const value of b.u)coords.push(value);}}
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(coords,2));
  g.computeBoundingBox();return g;
}




export function buildLiquidGlyph(src,capHeight){
 const unit=1/capHeight,path=new THREE.ShapePath();
 for(const [command,...args]of src.commands){const v=args.map(n=>n*unit);for(let i=0;i<v.length;i+=2)v[i]+=.095*v[i+1];if(command==='M')path.moveTo(...v);else if(command==='L')path.lineTo(...v);else if(command==='Q')path.quadraticCurveTo(...v);else if(command==='C')path.bezierCurveTo(...v);else if(command==='Z')path.currentPath.closePath();}
 const shapes=path.toShapes(false);if(!shapes.length)return null;
 const segments=[];for(const s of shapes)for(const contour of [s,...s.holes]){const points=contour.getPoints(6);for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;if(l>1e-12)segments.push([a.x,a.y,dx,dy,l]);}}
 const mesh=liFinish(new THREE.ExtrudeGeometry(shapes,{depth:.50,bevelEnabled:true,bevelThickness:.10,bevelSize:.060,bevelSegments:6,curveSegments:6,steps:1})),a=mesh.attributes,buckets=[{p:[],n:[],u:[]},{p:[],n:[],u:[]},{p:[],n:[],u:[]}],cache=new Map();

 // A pressure membrane gives each stroke a continuous curved front. The
 // Poisson field avoids ridges where nearest edges meet inside a letter.
 const contours=shapes.map(shape=>[shape,...shape.holes].map(c=>c.getPoints(6)));
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const c of contours.flat())for(const v of c){minX=Math.min(minX,v.x);minY=Math.min(minY,v.y);maxX=Math.max(maxX,v.x);maxY=Math.max(maxY,v.y);}
 const step=1/60,pad=step*2;minX-=pad;minY-=pad;maxX+=pad;maxY+=pad;const cols=Math.ceil((maxX-minX)/step)+1,rows=Math.ceil((maxY-minY)/step)+1,mask=new Uint8Array(cols*rows);let field=new Float32Array(cols*rows),next=new Float32Array(cols*rows);
 function inContour(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
 for(let y=1;y<rows-1;y++)for(let x=1;x<cols-1;x++){const xx=minX+x*step,yy=minY+y*step;mask[y*cols+x]=+contours.some(c=>inContour(xx,yy,c[0])&&!c.slice(1).some(h=>inContour(xx,yy,h)));}
 for(let pass=0;pass<130;pass++){for(let y=1;y<rows-1;y++)for(let x=1;x<cols-1;x++){const i=y*cols+x;if(mask[i])next[i]=(field[i-1]+field[i+1]+field[i-cols]+field[i+cols]+.001)/4;}[field,next]=[next,field];}
 let peak=0;for(const h of field)peak=Math.max(peak,h);const amount=.070/Math.max(.001,peak);
 const sample=(x,y)=>{const gx=Math.max(0,Math.min(cols-1.001,(x-minX)/step)),gy=Math.max(0,Math.min(rows-1.001,(y-minY)/step)),ix=Math.floor(gx),iy=Math.floor(gy),dx=gx-ix,dy=gy-iy,i=iy*cols+ix;return((field[i]*(1-dx)+field[i+1]*dx)*(1-dy)+(field[i+cols]*(1-dx)+field[i+cols+1]*dx)*dy)*amount;};
 function inflated(v){const key=Math.round(v[0]*1e5)+':'+Math.round(v[1]*1e5);if(cache.has(key))return cache.get(key);let closest=1e9,ox=0,oy=0;for(const [x,y,dx,dy,len]of segments){const t=Math.max(0,Math.min(1,((v[0]-x)*dx+(v[1]-y)*dy)/len)),qx=v[0]-x-t*dx,qy=v[1]-y-t*dy,d=qx*qx+qy*qy;if(d<closest){closest=d;ox=qx;oy=qy;}}const distance=Math.sqrt(closest),t=Math.min(1,distance/.038),fade=t*t*(3-2*t),edge=t<1?6*t*(1-t)/.038:0,h=sample(v[0],v[1]),gx=(sample(v[0]+step,v[1])-sample(v[0]-step,v[1]))/(2*step),gy=(sample(v[0],v[1]+step)-sample(v[0],v[1]-step))/(2*step),nx=-gx*fade-(distance?h*edge*ox/distance:0),ny=-gy*fade-(distance?h*edge*oy/distance:0),nl=Math.hypot(nx,ny,1),value={rise:h*fade,n:[nx/nl,ny/nl,1/nl]};cache.set(key,value);return value;}
 function front(x,y,z,depth=0){const lengths=[(x[0]-y[0])**2+(x[1]-y[1])**2,(y[0]-z[0])**2+(y[1]-z[1])**2,(z[0]-x[0])**2+(z[1]-x[1])**2],longest=Math.max(...lengths);if(longest>.0225&&depth<7){const edge=lengths.indexOf(longest),v=[x,y,z],i=edge,j=(edge+1)%3,k=(edge+2)%3,m=v[i].map((n,c)=>(n+v[j][c])/2);front(v[i],m,v[k],depth+1);front(m,v[j],v[k],depth+1);return;}const b=buckets[0];for(const v of [x,y,z]){const d=inflated(v);b.p.push(v[0],v[1],v[2]+d.rise);b.n.push(...d.n);b.u.push(v[0],v[1]);}}
 for(const group of mesh.groups){const b=buckets[group.materialIndex];if(group.materialIndex===0){for(let i=group.start;i<group.start+group.count;i+=3){const v=[];for(let j=0;j<3;j++)v.push([a.position.getX(i+j),a.position.getY(i+j),a.position.getZ(i+j)]);front(...v);}}else for(let i=group.start;i<group.start+group.count;i++){b.p.push(a.position.getX(i),a.position.getY(i),a.position.getZ(i));b.n.push(a.normal.getX(i),a.normal.getY(i),a.normal.getZ(i));b.u.push(a.uv.getX(i),a.uv.getY(i));}}
 mesh.dispose();const geometry=new THREE.BufferGeometry(),p=[],n=[],uv=[];let offset=0;for(let i=0;i<3;i++){const b=buckets[i];for(const v of b.p)p.push(v);for(const v of b.n)n.push(v);for(const v of b.u)uv.push(v);geometry.addGroup(offset,b.p.length/3,i);offset+=b.p.length/3;}geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeBoundingBox();return geometry;
}
