import {VideoGenContext,VideoGenGallery} from './VideoGenBridge';
import {MotionImages} from './EffectCraftWorkspace';
import {ImportMedia} from './ImportMedia';
export const tools = [
 {path:'/videogen-kontekst',Component:VideoGenContext},
 {path:'/videogen-galerija',Component:VideoGenGallery},
 {path:'/slike-s-pokretima',label:'Slike s pokretima',Component:MotionImages},
 {path:'/videogen',label:'VideoGen',href:'http://127.0.0.1:5176/'},
 {path:'/lokalni-uvoz',Component:ImportMedia},
];
