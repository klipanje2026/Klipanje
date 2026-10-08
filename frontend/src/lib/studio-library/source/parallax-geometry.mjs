import * as THREE from '../../collection/three.mjs';
import {mxFinish} from './mega-geometry.mjs';
export function buildParallaxGlyph(src,capHeight,support=false){
 const path=new THREE.ShapePath();for(const [op,...args]of src.commands){const v=args.map(n=>n/capHeight);if(op==='M')path.moveTo(...v);else if(op==='L')path.lineTo(...v);else if(op==='Q')path.quadraticCurveTo(...v);else if(op==='C')path.bezierCurveTo(...v);else if(op==='Z')path.currentPath.closePath();}const shapes=path.toShapes(false);if(!shapes.length)return null;
 const depth=support?.065:.46,g=mxFinish(new THREE.ExtrudeGeometry(shapes,{depth,bevelEnabled:true,bevelThickness:support?.005:.021,bevelSize:support?.004:.017,bevelSegments:support?3:6,curveSegments:support?9:14,steps:1}));g.translate(0,0,-depth/2);g.computeBoundingBox();return g;
}
export function buildParallaxOrbit(){
 const curve=new THREE.CubicBezierCurve3(new THREE.Vector3(-438,-527,-104),new THREE.Vector3(-154,-264,120),new THREE.Vector3(211,-730,95),new THREE.Vector3(450,-488,-108)),g=new THREE.TubeGeometry(curve,128,2.1,8,false);g.userData={steps:128};return g;
}
