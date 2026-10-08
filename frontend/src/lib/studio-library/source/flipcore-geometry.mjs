import * as THREE from '../../collection/three.mjs';
import {mxFinish} from './mega-geometry.mjs';
export function buildFlipcoreGlyph(src,capHeight,support=false){
 const path=new THREE.ShapePath();for(const [op,...args]of src.commands){const v=args.map(n=>n/capHeight);if(op==='M')path.moveTo(...v);else if(op==='L')path.lineTo(...v);else if(op==='Q')path.quadraticCurveTo(...v);else if(op==='C')path.bezierCurveTo(...v);else if(op==='Z')path.currentPath.closePath();}const shapes=path.toShapes(false);if(!shapes.length)return null;
 const depth=support?.065:.065,g=mxFinish(new THREE.ExtrudeGeometry(shapes,{depth,bevelEnabled:true,bevelThickness:support?.005:.012,bevelSize:support?.004:.010,bevelSegments:support?3:5,curveSegments:support?9:12,steps:1}));g.translate(0,0,-depth/2);g.computeBoundingBox();return g;
}
export function buildFlipcoreTile(width,height=1.34,depth=.46,radius=.105){
 const w=width/2,h=height/2,r=Math.min(radius,w*.40,h*.40),s=new THREE.Shape();s.moveTo(-w+r,-h);s.lineTo(w-r,-h);s.quadraticCurveTo(w,-h,w,-h+r);s.lineTo(w,h-r);s.quadraticCurveTo(w,h,w-r,h);s.lineTo(-w+r,h);s.quadraticCurveTo(-w,h,-w,h-r);s.lineTo(-w,-h+r);s.quadraticCurveTo(-w,-h,-w+r,-h);s.closePath();
 const g=mxFinish(new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.035,bevelSize:.033,bevelSegments:5,curveSegments:12,steps:1}));g.translate(0,0,-depth/2);g.computeBoundingBox();return g;
}
