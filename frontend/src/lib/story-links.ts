type Clip={id:string;type:string;groupId?:string;captionId?:string;segmentIds?:string[];narrationSegmentIds?:string[];sceneSlice?:{index:number;count:number};frameStrength?:number;preserveLinkedTiming?:boolean;linksDetached?:boolean};
const ids=(c:Clip)=>[...c.segmentIds||[],...c.narrationSegmentIds||[],...c.captionId?[c.captionId]:[]];
/** Dissolve all explicit and legacy edges in the selected component, without retiming. */
export function detachStoryLinks<T extends Clip>(clips:T[],selectedId:string):T[]{
 const chosen=clips.find(c=>c.id===selectedId);if(!chosen)return clips;
 const members=new Set([chosen.id]),scenes=new Set(ids(chosen)),groups=new Set(chosen.groupId?[chosen.groupId]:[]);
 let changed=true;while(changed){changed=false;for(const c of clips)if(!members.has(c.id)&&(!!c.groupId&&groups.has(c.groupId)||ids(c).some(id=>scenes.has(id)))){members.add(c.id);ids(c).forEach(id=>scenes.add(id));if(c.groupId)groups.add(c.groupId);changed=true;}}
 return clips.map(c=>members.has(c.id)?{...c,groupId:undefined,captionId:undefined,segmentIds:undefined,narrationSegmentIds:undefined,sceneSlice:undefined,frameStrength:undefined,preserveLinkedTiming:undefined,linksDetached:true}:c);
}
export function connectStoryLinks<T extends Clip>(clips:T[],selectedIds:string[],captionIds:string[],groupId:string):T[]{
 return clips.map(c=>selectedIds.includes(c.id)?{...c,groupId,captionId:undefined,sceneSlice:undefined,preserveLinkedTiming:true,linksDetached:false,...c.type==='audio'?{narrationSegmentIds:captionIds}:{segmentIds:captionIds}}:c);
}

/** A media trim never copies source times into its linked image or voice. */
export function patchStoryClip<T extends Clip>(clips:T[],id:string,patch:Partial<T>):T[]{
 const timing=Object.prototype.hasOwnProperty.call(patch,'inPoint')||Object.prototype.hasOwnProperty.call(patch,'outPoint');
 return clips.map(c=>c.id===id?{...c,...patch,...timing?{preserveLinkedTiming:true}:{}}:c);
}
