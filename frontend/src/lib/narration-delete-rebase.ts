import type {Script} from './production';

const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);

/** Rebase only the server's removal of deleted narration references, never another edit. */
export function narrationDeletionRebase(base:Script,remote:Script):string[]|null{
 if(base.id!==remote.id)return null;
 const expected=structuredClone(base),removed=new Set<string>();
 const before=expected.photo_settings.narrationPlan,after=remote.photo_settings.narrationPlan;
 if(before&&after){
  for(const [id,scene] of Object.entries(before.scenes)){
   if(scene.assetId&&after.scenes[id]&&!after.scenes[id].assetId){removed.add(scene.assetId);delete scene.assetId;}
  }
  for(const id of before.backgrounds||[])if(!after.backgrounds?.includes(id))removed.add(id);
  if(before.backgrounds)before.backgrounds=before.backgrounds.filter(id=>!removed.has(id));
 }
 expected.updated_at=remote.updated_at;
 return removed.size&&canonical(expected)===canonical(remote)?[...removed]:null;
}

export function removeNarrationReferences<T extends Script['photo_settings']>(settings:T,ids:string[]):T{
 const next=structuredClone(settings),plan=next.narrationPlan;
 if(plan){
  for(const scene of Object.values(plan.scenes))if(scene.assetId&&ids.includes(scene.assetId))delete scene.assetId;
  if(plan.backgrounds)plan.backgrounds=plan.backgrounds.filter(id=>!ids.includes(id));
 }
 return next;
}
