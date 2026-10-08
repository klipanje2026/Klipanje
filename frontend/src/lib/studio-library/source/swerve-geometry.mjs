import * as THREE from '../../collection/three.mjs';
import {mxFinish} from './mega-geometry.mjs';
export function buildSwerveGlyph(src,capHeight,support=false){
 const path=new THREE.ShapePath();for(const [op,...args]of src.commands){const v=args.map(n=>n/capHeight);if(op==='M')path.moveTo(...v);else if(op==='L')path.lineTo(...v);else if(op==='Q')path.quadraticCurveTo(...v);else if(op==='C')path.bezierCurveTo(...v);else if(op==='Z')path.currentPath.closePath();}const shapes=path.toShapes(false);if(!shapes.length)return null;
 const depth=support?.022:.30,g=mxFinish(new THREE.ExtrudeGeometry(shapes,{depth,bevelEnabled:true,bevelThickness:support?.0025:.052,bevelSize:support?.002:.042,bevelSegments:support?3:9,curveSegments:support?12:16,steps:1}));g.translate(0,0,-depth/2);g.computeBoundingBox();return g;
}
