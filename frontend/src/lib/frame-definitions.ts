import type {Asset,Script} from './production';
export type FrameDefinition={source?:string;videoSource?:string;processedSource?:string;kind:'image'|'motion'|'video';prompt:string;duration:number;processing:{enabled:boolean;start:number;speed:number;edge:number;muted:boolean}};
export function frameDefinition(script:Script,id:string,assets:Asset[]):FrameDefinition{
 const saved=script.photo_settings.frameDefinitions?.[id];const segment=script.segments.find(s=>s.id===id);
 const linked=assets.find(a=>!a.metadata.archived&&a.contentType.startsWith('image/')&&a.metadata.scriptId===script.id&&(a.metadata.segmentId===id||a.metadata.segmentIds?.includes(id)));
 return {source:linked?.id,kind:'image',prompt:'',duration:Math.max(.1,(segment?.end||0)-(segment?.start||0)),processing:{enabled:true,start:0,speed:1,edge:1200,muted:true},...saved};
}
export function frameTask(script:Script,id:string,value:FrameDefinition,asset:Asset,origin:string){
 return `Projekat: ${script.project}\nSkripta: ${script.title} (${script.id})\nKadar ${script.segments.findIndex(s=>s.id===id)+1} (${id})\nSlika: ${asset.name}\nMedij: ${asset.id}\nLokalni izvor: ${origin}${asset.url}\nZadatak: ${value.kind==='motion'?'Pokretna slika':value.kind==='video'?'Video generacija':'Zadrži kao sliku'}\nOpis: ${value.prompt}\nTrajanje: ${value.duration.toFixed(1)} s\n${value.processing.enabled?`Završna obrada: MP4, duža stranica ${value.processing.edge} px, brzina ${value.processing.speed.toFixed(1)}×, početak ${value.processing.start.toFixed(1)} s, ${value.processing.muted?'bez zvuka':'sa zvukom'}.`:'Bez dodatne obrade.'}\nSačuvaj rezultat za ovaj kadar u Klipanju.`;
}

export function selectedFrameSource(def:FrameDefinition){return def.processedSource||(def.kind==='image'?def.source:def.videoSource);}
/** Project current choices onto asset associations without mutating historical source media. */
export function resolvedFrameAssets(script:Script,assets:Asset[]):Asset[]{
 const definitions=script.photo_settings.frameDefinitions||{};
 const selections=new Map(Object.entries(definitions).map(([id,def])=>[id,selectedFrameSource(def)]));
 return assets.map(a=>{
  if(a.metadata.scriptId!==script.id||!a.contentType.startsWith('image/')&&!a.contentType.startsWith('video/'))return a;
  const previous=a.metadata.segmentIds||[a.metadata.segmentId||''];
  const ids=script.segments.filter(s=>selections.has(s.id)?selections.get(s.id)===a.id:previous.includes(s.id)).map(s=>s.id);
  const touched=previous.some(id=>selections.has(id))||[...selections.values()].includes(a.id);
  return touched?{...a,metadata:{...a.metadata,segmentId:ids[0]||'',segmentIds:ids,manualFrames:true,...ids.length?{gallery:true}:{}}}:a;
 });
}
export function selectionKey(script:Script){return JSON.stringify(Object.entries(script.photo_settings.frameDefinitions||{}).map(([id,v])=>[id,selectedFrameSource(v)]).sort());}
