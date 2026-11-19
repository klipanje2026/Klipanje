import {initialStoryPlan,compileStoryPlan,spokenText} from './preeditor';
import type {Asset,Script} from './production';
import {audioDuration} from './media-duration';

export async function imageMontage(script:Script,assets:Asset[]){
  // Image projects use the links on the images themselves as the source of truth.
  const source={...script,photo_settings:{...script.photo_settings,frameDefinitions:{}}};
  const media=assets.filter(a=>a.contentType.startsWith('audio/')||a.contentType.startsWith('image/'))
    .map(a=>a.contentType.startsWith('image/')?{...a,metadata:{...a.metadata,gallery:true}}:a);
  const plan=initialStoryPlan(source,media);
  if(!script.segments.length)throw new Error('Prvo podijeli skriptu u intervale.');
  for(const block of plan.blocks){
    const scene=script.segments.find(s=>s.id===block.sourceIds[0]);
    if(!block.imageIds.length&&scene)throw new Error('Poveži sliku s kadrom '+(script.segments.indexOf(scene)+1)+'.');
    if(scene&&!block.audioIds.length){
      block.duration=Math.max(.1,scene.end-scene.start);
      if(spokenText(scene.text)){block.captionIds=[scene.id];block.filler=false;}
    }
  }
  const durations:Record<string,number>={};
  const needed=new Set([...plan.blocks.flatMap(b=>b.audioIds),...source.photo_settings.narrationPlan?.backgrounds||[]]);
  for(const id of needed){
    const asset=media.find(a=>a.id===id);
    if(!asset)throw new Error('Odabrani zvuk više nije dostupan.');
    durations[id]=asset.metadata.narration?.duration||asset.metadata.mediaDuration||await audioDuration(asset.url);
  }
  return compileStoryPlan(plan,source,media,durations,true);
}
