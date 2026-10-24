export type AudioRoleClip={type:string;audioRole?:string};
export const independentAudio=(clip:AudioRoleClip)=>clip.type==='audio'&&(clip.audioRole==='sound'||clip.audioRole==='music');
/** Sound-only edits must never enter caption syncing or scene ripple/overlap repair. */
export function onlyIndependentAudioChanged<T extends AudioRoleClip&{id:string}>(before:T[],after:T[]){
 const ids=new Set([...before,...after].map(c=>c.id));let changed=false;
 for(const id of ids){const a=before.find(c=>c.id===id),b=after.find(c=>c.id===id);if(a===b||JSON.stringify(a)===JSON.stringify(b))continue;changed=true;if(a&&!independentAudio(a)||b&&!independentAudio(b))return false;}
 return changed;
}
