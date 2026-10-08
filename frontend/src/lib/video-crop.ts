export function cropRect(width:number,height:number,aspect:number,x=50,y=50) {
  const w=Math.min(width,height*aspect), h=w/aspect;
  return {x:(width-w)*Math.max(0,Math.min(100,x))/100,y:(height-h)*Math.max(0,Math.min(100,y))/100,width:w,height:h};
}
export function cropSize(width:number,height:number,aspect:number) {
  const rect=cropRect(width,height,aspect), scale=Math.min(1,1920/Math.max(rect.width,rect.height));
  return {width:Math.max(2,Math.round(rect.width*scale/2)*2),height:Math.max(2,Math.round(rect.height*scale/2)*2)};
}
