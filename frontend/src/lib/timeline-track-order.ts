const captions='captions';
export function timelineTrackOrder(saved:string[],media:string[],hasCaptions:boolean):string[]{
 const ordered=[...new Set([...saved.filter(k=>media.includes(k)),...media])];
 if(!hasCaptions)return ordered;
 const captionIndex=saved.findIndex(k=>k===captions||k.startsWith('captions-'));
 const lastMedia=Math.max(-1,...saved.map((k,i)=>media.includes(k)?i:-1));
 return captionIndex>lastMedia&&lastMedia>=0?[...ordered,captions]:[captions,...ordered];
}
export function moveTimelineTrack(order:string[],id:string,target:string):string[]{
 const from=order.indexOf(id);if(from<0)return order;
 const to=target==='up'?from-1:target==='down'?from+1:order.indexOf(target);
 if(to<0||to>=order.length||to===from)return order;
 const media=order.filter(k=>k!==captions);
 const captionBottom=order.at(-1)===captions;
 if(id===captions)return to>from?[...media,captions]:[captions,...media];
 const destination=order[to]===captions?(captionBottom?media.length-1:0):media.indexOf(order[to]);
 media.splice(media.indexOf(id),1);media.splice(destination,0,id);
 return !order.includes(captions)?media:captionBottom?[...media,captions]:[captions,...media];
}
