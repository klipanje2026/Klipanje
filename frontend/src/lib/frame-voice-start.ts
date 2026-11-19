type Frame = {start:number; groupId?:string; captionId?:string; segmentIds?:string[]};
type Voice = {type:string; start:number; inPoint:number; outPoint:number; groupId?:string; audioRole?:string; narrationSegmentIds?:string[]};
type Caption = {id:string; sourceSceneId?:string; start:number};

export function frameVoiceStart(frame:Frame, clips:Voice[], captions:Caption[]){
  const ids=new Set([...(frame.segmentIds||[]),...(frame.captionId?[frame.captionId]:[])]);
  const linked=captions.filter(s=>ids.has(s.id)||!!s.sourceSceneId&&ids.has(s.sourceSceneId));
  const matches=(id:string)=>ids.has(id)||linked.some(s=>s.id===id||s.sourceSceneId===id);
  const voices=clips.filter(c=>c.type==='audio'&&c.audioRole!=='sound'&&c.audioRole!=='music');
  const exact=voices.filter(c=>c.narrationSegmentIds?.some(matches));
  const candidates=exact.length?exact:voices.filter(c=>frame.groupId&&c.groupId===frame.groupId&&!c.narrationSegmentIds?.length);
  if(!candidates.length)return frame.start;
  const voice=candidates.reduce((a,b)=>Math.abs(a.start-frame.start)<=Math.abs(b.start-frame.start)?a:b);
  const firstId=voice.narrationSegmentIds?.[0];
  if(firstId&&!matches(firstId)&&linked.length){
    return Math.min(voice.start+voice.outPoint-voice.inPoint,Math.max(voice.start,Math.min(...linked.map(s=>s.start))));
  }
  return voice.start;
}
