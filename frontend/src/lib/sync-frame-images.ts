import type {Asset,Script} from './production';
import {resolvedFrameAssets} from './frame-definitions';

type Visual={id:string;assetId:string;type:string;name?:string;start:number;inPoint:number;outPoint:number;layer:number;captionId?:string;segmentIds?:string[];composition?:unknown};
type Caption={id:string;sourceSceneId?:string;start:number;end:number};

export async function syncFrameImages(data:Record<string,unknown>,script:Script,assets:Asset[],load:(asset:Asset)=>Promise<string>){
 const clips=[...data.clips as Visual[]];
 const descriptions=data.assets as {id:string;type:string}[];
 const captions=(data.captions as {__script?:{segments:Caption[]}})?.__script?.segments||[];
 const images=resolvedFrameAssets(script,assets).filter(a=>a.contentType.startsWith('image/')&&a.metadata.scriptId===script.id&&!a.metadata.archived&&a.metadata.gallery!==false);
 const source=new Map(captions.map(c=>[c.id,c.sourceSceneId||c.id]));
 let ambiguous=0;
 for(const scene of script.segments){
  const options=images.filter(a=>(a.metadata.segmentIds||[a.metadata.segmentId]).includes(scene.id));
  if(options.length>1){ambiguous++;continue;}
  if(!options.length)continue;
  const family=captions.filter(c=>(c.sourceSceneId||c.id)===scene.id);
  const span=(c:Visual)=>[...(c.segmentIds||[]),...(c.captionId?[c.captionId]:[])].map(id=>source.get(id)||id);
  const linked=clips.filter(c=>c.type==='video'&&span(c).includes(scene.id));
  const asset=options[0];
  if(linked.length){
   if(linked.length!==1)continue;
   const c=linked[0];
   if(c.composition||span(c).some(id=>id!==scene.id)||!descriptions.some(d=>d.id===c.assetId&&d.type==='image'))continue;
   clips[clips.indexOf(c)]={...c,assetId:await load(asset),name:asset.name};
  }else if(family.length){
   const start=Math.min(...family.map(c=>c.start)),end=Math.max(...family.map(c=>c.end));
   // Existing unlinked footage may be an intentional manual placement.
   if(clips.some(c=>c.type==='video'&&c.start<end-.001&&c.start+c.outPoint-c.inPoint>start+.001))continue;
   clips.push({id:crypto.randomUUID(),assetId:await load(asset),type:'video',name:asset.name,start,inPoint:0,outPoint:Math.max(.1,end-start),layer:1,segmentIds:family.map(c=>c.id),...{volume:0,muted:true}});
  }
 }
 data.clips=clips;
 return ambiguous;
}
