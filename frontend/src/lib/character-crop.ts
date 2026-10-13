export function moveCharacterCrop(box:number[],dx:number,dy:number,width:number,height:number){
 return [Math.max(0,Math.min(width-box[2],Math.round(box[0]+dx))),Math.max(0,Math.min(height-box[3],Math.round(box[1]+dy))),box[2],box[3]];
}
export function resizeCharacterCrop(box:number[],dx:number,dy:number,edge:'e'|'s'|'se',body:boolean,width:number,height:number){
 const rw=body?9:1,rh=body?16:1;
 const change=edge==='s'?dy/rh:edge==='e'?dx/rw:Math.abs(dx/rw)>=Math.abs(dy/rh)?dx/rw:dy/rh;
 const unit=Math.max(body?2:16,Math.min(Math.round(box[2]/rw+change),Math.floor(Math.min((width-box[0])/rw,(height-box[1])/rh))));
 return [box[0],box[1],unit*rw,unit*rh];
}
