import {applyPresetCaptionStyle} from './preset-caption-style';
import {isPresetCaptionStyle} from '../config/captions/style-library';
import {captionWordRoles,captionRenderSegment,ignoresCaptionTitles} from './caption-word-roles';
import type {Segment,CaptionSettings,StyleKey} from '../config/captions/presets';
export function detachCaption(segment:Segment,style:StyleKey,settings:CaptionSettings):Segment{return {...segment,detachedStyle:segment.detachedStyle||segment.laneStyle||{style,settings:{...settings}}};}
export function captionTitle(segment:Segment,word:number|undefined,style:StyleKey,settings:CaptionSettings,lane:number):Segment {
 const text=segment.text.trim().split(/\s+/),timing=word===undefined?undefined:segment.words?.[word];
 const start=timing?.start??(word===undefined?segment.start:segment.start+word/text.length*(segment.end-segment.start));
 return {id:crypto.randomUUID(),text:word===undefined?segment.text:text[word],start,end:Math.max(start+.1,Math.min(segment.end,start+2.5)),role:'title',manualTitleLayout:true,lane:Math.max(1,lane),sourceCaptionId:segment.id,sourceWord:word,detachedStyle:{style,settings:titleSettingsForStyle(style,settings)},words:undefined};
}
/** Manual headings replace the existing heading slot belonging to this speech caption. */
export function replaceCaptionTitle(segments:Segment[],source:Segment,title:Segment):Segment[]{
 const belongs=(s:Segment)=>s.role==='title'&&(s.sourceCaptionId===source.id||(!s.sourceCaptionId&&s.start>=source.start&&s.start<source.end));
 const slot=segments.find(belongs),preset=slot?.detachedStyle;
 const replacement:Segment={...title,id:slot?.id??title.id,sourceCaptionId:source.id,standaloneTitle:false,suggestedTitle:false,suggestedForStyle:undefined,
  start:source.start,end:source.end,position:slot?.position,titleOverrides:slot?.titleOverrides,
  detachedStyle:preset?{style:preset.style,settings:{...preset.settings}}:title.detachedStyle};
 return [...segments.filter(s=>!belongs(s)).map(s=>s.id===source.id?{...s,suppressSuggestions:true}:s),replacement];
}
/** Replace only automatic suggestions within the explicitly selected editing scope. */
export function replaceScopedCaptionSuggestions(segments:Segment[],source:Segment,scope:string,kind:'title'|'word'):Segment[]{
 const ids=new Set(segments.filter(s=>s.role!=='title'&&(scope==='scene'?s.id===source.id:scope.startsWith('group:')?s.group?.id===scope.slice(6):scope==='all'||!s.group)).map(s=>s.id));
 return segments.filter(s=>!(kind==='title'&&s.suggestedTitle&&s.sourceCaptionId&&ids.has(s.sourceCaptionId)&&s.sourceCaptionId!==source.id)).map(s=>{
  if(!ids.has(s.id))return s;
  if(kind==='word')return s.keywordWord===undefined&&!Object.keys(s.wordStyles||{}).length?{...s,keywordWord:null}:s;
  return s.headingWord===undefined?{...s,headingWord:null}:s;
 });
}
export function newCaptionLane(segments:Segment[],time:number,duration:number,style:StyleKey='clean',settings?:CaptionSettings):Segment[]{
 const start=Math.min(Math.max(0,time),Math.max(0,duration-.1));
 const lane=1+Math.max(0,...segments.filter(s=>s.role!=='title').map(s=>s.lane||0));
 return [...segments.map(s=>s.role==='title'?{...s,lane:Math.max(lane+1,s.lane||0)}:s),{id:crypto.randomUUID(),text:'Novi titl',start,end:Math.max(start+.1,Math.min(duration,start+2)),lane,laneStyle:settings?{style,settings:{...settings}}:undefined}];
}

// Explicit group edits include its individual captions; unrelated detached captions stay independent.
export function styleCaptionLane(segments:Segment[],lane:number,style:StyleKey,settings:CaptionSettings,groupId?:string,preservePosition=false):Segment[]{
 if(isPresetCaptionStyle(style)){const ids=segments.filter(s=>s.role!=='title'&&(s.lane||0)===lane&&(!s.detachedStyle||s.separateStyle===false||!!groupId)&&s.group?.id===groupId).map(s=>s.id);return applyPresetCaptionStyle(segments,ids,style,settings,preservePosition);}
 return segments.map(s=>s.role==='title'||(s.lane||0)!==lane||(s.detachedStyle&&s.separateStyle!==false&&!groupId)||s.group?.id!==groupId?s:{...s,detachedStyle:s.separateStyle!==false?s.detachedStyle:undefined,laneStyle:{style,settings:{...settings}},position:preservePosition?s.position:undefined});
}

export function groupCaptions(segments:Segment[],ids:string[],name:string,style:StyleKey,settings:CaptionSettings):Segment[]{
 const chosen=segments.filter(s=>ids.includes(s.id));if(!chosen.length)return segments;
 const lane=chosen[0].lane||0;if(chosen.some(s=>(s.lane||0)!==lane))return segments;
 const count=new Set(segments.flatMap(s=>s.group?[s.group.id]:[])).size;
 const colors=new Set(segments.flatMap(s=>s.group?[s.group.color]:[]));let index=count,color='';
 do{color=`hsl(${(index++*137.508+205)%360} 65% 42%)`;}while(colors.has(color));
 const group={id:crypto.randomUUID(),name:name.trim()||`Grupa ${count+1}`,color};
 return segments.map(s=>ids.includes(s.id)?{...s,inheritedStyle:s.group?s.inheritedStyle:s.laneStyle,group,detachedStyle:s.detachedStyle,position:undefined,laneStyle:{style,settings:{...settings}}}:s);
}
export function ungroupCaptions(segments:Segment[],groupId:string):Segment[]{return segments.map(s=>s.group?.id===groupId?{...s,group:undefined,detachedStyle:s.detachedStyle||s.laneStyle}:s);}

export function addCaptionsToGroup(segments:Segment[],ids:string[],groupId:string):Segment[]{
 const source=segments.find(s=>s.group?.id===groupId&&!s.detachedStyle)||segments.find(s=>s.group?.id===groupId);if(!source)return segments;
 const style=source.laneStyle||source.detachedStyle;
 return segments.map(s=>ids.includes(s.id)&&(s.lane||0)===(source.lane||0)?{...s,inheritedStyle:s.group?s.inheritedStyle:s.laneStyle,group:source.group,laneStyle:style,detachedStyle:s.detachedStyle,position:undefined}:s);
}

/** Dropping onto another caption joins its group, preserving speech timing. */
export function dropCaptionIntoGroup(segments:Segment[],sourceId:string,targetId:string,style:StyleKey,settings:CaptionSettings):Segment[]{
 const source=segments.find(s=>s.id===sourceId),target=segments.find(s=>s.id===targetId);if(!source||!target||sourceId===targetId)return segments;
 const moved=segments.map(s=>s.id===sourceId?{...s,lane:target.lane||0}:s);
 if(target.group)return addCaptionsToGroup(moved,[sourceId],target.group.id);
 const preset=target.detachedStyle||target.laneStyle;
 return groupCaptions(moved,[sourceId,targetId],'',preset?.style||style,preset?.settings||settings);
}

/** Resize membership by caption centers; speech timing and other lanes stay intact. */
export function resizeCaptionGroup(segments:Segment[],groupId:string,start:number,end:number):Segment[]{
 const source=segments.find(s=>s.group?.id===groupId);if(!source)return segments;
 const preset=source.laneStyle||source.detachedStyle;
 if(!segments.some(s=>(s.lane||0)===(source.lane||0)&&(s.start+s.end)/2>=start&&(s.start+s.end)/2<=end))return segments;
 return segments.map(s=>{if((s.lane||0)!==(source.lane||0))return s;const center=(s.start+s.end)/2;
 if(center>=start&&center<=end){return {...s,inheritedStyle:s.group?s.inheritedStyle:s.laneStyle,group:source.group,laneStyle:preset};}
 return s.group?.id===groupId?{...s,group:undefined,detachedStyle:s.detachedStyle||s.laneStyle}:s;});
}

export function nextCaptionGroup(segments:Segment[],selectedId:string|undefined,style:StyleKey,settings:CaptionSettings){
 const selected=segments.find(s=>s.id===selectedId)||segments[0];if(!selected)return segments;
 const candidates=segments.filter(s=>!s.group&&s.role!=='title'&&(s.lane||0)===(selected.lane||0)).sort((a,b)=>a.start-b.start);
 const next=candidates.find(s=>s.start>=selected.start)||candidates[0];if(!next)return segments;
 return groupCaptions(segments,[next.id],'',style,settings);
}

/** Reset formatting while preserving transcript and speech timing. */
export function resetCaptionFormatting(segments:Segment[]):Segment[]{return segments.filter(s=>s.role!=='title').map(s=>({...s,lane:0,group:undefined,laneStyle:undefined,detachedStyle:undefined,wordStyles:undefined,wordOffsets:undefined,position:undefined,wordsSeparated:false}));}
/** A keyword gets an independent typography variant without duplicating a template's full-screen decorations. */
export function keywordPreset(style:StyleKey,settings:CaptionSettings){
 if(['testSerif','smokeSerif','captionsScript','goldMesh','prismWords','premiumOrangeV4','metallicCompactV2','dynamicGlass'].includes(style))return {style,settings:{...settings}};
 if(style==='trackingStack')return {style,settings:{...settings,fontWeight:900}};
 if(style==='sketchNote')return {style:'sketchNote' as StyleKey,settings:{...settings,backgroundOpacity:100,wordMode:'all' as const,reveal:'none' as const,secondaryFontFamily:settings.fontFamily,secondaryFontScale:settings.fontScale}};
 if(style==='goldBold')return {style:'clean' as StyleKey,settings:{...settings,textColor:settings.highlightColor,fontFamily:settings.fontFamily,fontScale:settings.fontScale,backgroundOpacity:0,outlineWidth:0,wordMode:'all' as const,reveal:'fade' as const,revealDuration:.18}};
 const boxed=['sketchNote','paperCut','boldHeader','newsHighlight','bigKeyword','sweepTitle'].includes(style);
 return {style:(boxed?'box':'clean') as StyleKey,settings:{...settings,wordMode:'all' as const,reveal:'none' as const,behindPerson:false,animation:'none' as const,fontScale:Math.min(600,settings.fontScale*(style==='bigKeyword'?1.55:1.15)),textColor:boxed?'#111111':settings.highlightColor,backgroundColor:settings.highlightColor,backgroundOpacity:boxed?100:0,outlineWidth:style==='primeFrame'?1:0,letterSpacing:style==='mistWords'?12:settings.letterSpacing}};
}

export function titleSettingsForStyle(style:StyleKey,settings:CaptionSettings):CaptionSettings {
 if(isPresetCaptionStyle(style))return {...settings,position:'top',x:50,y:28};
 if(['testSerif','smokeSerif','captionsScript','goldMesh'].includes(style))return {...settings,position:'top',x:50,y:24,...settings.titleAppearance};
 return {...settings,behindPerson:true,position:'top',x:style==='verticalTitle'?10:50,y:style==='vistaRise'?8:style==='popCollage'?16:style==='sketchNote'?25:style==='verticalTitle'?34:style==='stackedHeadlines'?42:28,fontScale:settings.secondaryFontScale??160,rotation:style==='verticalTitle'?-90:0,textColor:settings.backgroundOpacity>0?settings.backgroundColor:settings.highlightColor,fontFamily:settings.secondaryFontFamily||settings.fontFamily,uppercase:style==='verticalTitle'||settings.uppercase,reveal:'none',wordMode:'all',...settings.secondaryStyle,...settings.titleAppearance};
}
// Resolve manual titles before every preview/export; saved speech timing stays intact.
export function resolveCaptionSuggestions(segments:Segment[]):Segment[]{
 const manual=segments.filter(t=>t.role==='title'&&!t.suggestedTitle);
 segments=segments.filter(s=>!s.suggestedTitle||!manual.some(t=>t.sourceCaptionId===s.sourceCaptionId&&!!t.sourceCaptionId||!t.sourceCaptionId&&t.start<s.end&&t.end>s.start));
 return segments.map(s=>{
  if(s.role==='title'){const own=s.detachedStyle||s.laneStyle;return !s.manualTitleLayout&&own?{...s,manualTitleLayout:true,detachedStyle:{style:own.style,settings:{...titleSettingsForStyle(own.style,own.settings),...(s.position||{})}}}:s;}
  const titles=segments.filter(t=>t.role==='title'&&(t.sourceCaptionId===s.id||(!t.sourceCaptionId&&t.start>=s.start&&t.start<s.end)));
  const automaticTitleOnly=!s.suppressSuggestions&&titles.length>0&&titles.every(t=>t.suggestedTitle)&&!Object.keys(s.wordStyles||{}).length;
  const keywordWord=automaticTitleOnly&&s.keywordWord===undefined?captionWordRoles(s,(s.detachedStyle||s.laneStyle)?.settings).keyword:s.keywordWord;
  return {...s,keywordWord,suppressSuggestions:s.suppressSuggestions||titles.length>0||Object.keys(s.wordStyles||{}).length>0,hiddenTitleWords:titles.flatMap(t=>t.sourceWord===undefined?[]:[t.sourceWord])};
 });
}

/** Restore a title's original timing without touching its source caption. */
export function resetTitleTiming(title:Segment,segments:Segment[]):Segment {
 const source=segments.find(s=>s.id===title.sourceCaptionId);if(!source)return title;
 const words=source.text.trim().split(/\s+/),index=title.sourceWord;
 const start=index===undefined?source.start:source.words?.[index]?.start??source.start+index/words.length*(source.end-source.start);
 return {...title,start,end:Math.max(start+.1,Math.min(source.end,start+2.5)),position:undefined};
}

/** Suggested headers are editable clips, but manual titles replace them per caption. */
export function editableCaptionSegments(segments:Segment[],style:StyleKey,settings:CaptionSettings):Segment[]{
 const headerStyles:StyleKey[]=['sketchNote','vistaRise','popCollage','verticalTitle','sweepTitle','editorialHeader','boldHeader','stackedHeadlines','underlinedEditorial'];
 const bases=segments.filter(s=>!s.suggestedTitle);
 const hasManual=(source:Segment)=>bases.some(t=>t.role==='title'&&(t.sourceCaptionId===source.id||(!t.sourceCaptionId&&t.start>=source.start&&t.start<source.end)));
 const result=[...bases];
 for(const source of bases){
  if(source.role==='title'||source.headingWord===null||(source.suppressSuggestions&&!Object.keys(source.wordStyles||{}).length)||hasManual(source))continue;
  const preset=(source.separateStyle===false?undefined:source.detachedStyle)||source.laneStyle||{style,settings};
  if(!headerStyles.includes(preset.style)||!source.text.trim())continue;
  const heading=captionWordRoles(source).title;if(heading<0)continue;
  const prior=segments.find(t=>t.suggestedTitle&&t.sourceCaptionId===source.id&&t.suggestedForStyle===preset.style);
  if(prior){result.push(prior);continue;}
  result.push({id:`suggested-title:${source.id}`,text:source.text.trim().split(/\s+/)[heading],start:source.start,end:source.end,role:'title',lane:1,sourceCaptionId:source.id,sourceWord:heading,suggestedTitle:true,suggestedForStyle:preset.style,manualTitleLayout:true,detachedStyle:{style:preset.style,settings:titleSettingsForStyle(preset.style,preset.settings)}});
 }
 const frameRanges=new Map<string,{start:number;end:number}>();
 const lanes=new Map<number,{range:{start:number;end:number};signature:string}>();
 for(const s of bases.filter(s=>s.role!=='title').sort((a,b)=>a.start-b.start)){
  const own=(s.separateStyle===false?undefined:s.detachedStyle)||s.laneStyle||{style,settings},lane=s.lane||0;
  if(!['primeFrame','lensFrame',...headerStyles].includes(own.style)){lanes.delete(lane);continue;}
  const repeat=own.settings.effectPlayback==='repeat';
  const signature=JSON.stringify([own.style,s.group?.id||'all',own.settings.highlightColor,own.settings.effectIdle,own.settings.effectIdleColor]);
  const prior=lanes.get(lane);
  const range=!repeat&&prior&&prior.signature===signature?prior.range:{start:s.start,end:s.end};
  range.end=Math.max(range.end,s.end);frameRanges.set(s.id,range);
  if(repeat)lanes.delete(lane);else lanes.set(lane,{range,signature});
 }
 return result.map(s=>{
  if(s.standaloneTitle)return s;
  if(s.role!=='title')return {...s,frameAnimationStart:frameRanges.get(s.id)?.start,frameAnimationEnd:frameRanges.get(s.id)?.end};
  const source=bases.find(parent=>parent.id===s.sourceCaptionId);
  if(!source)return resolveCaptionSuggestions([s])[0];
  const preset=(source.separateStyle===false?undefined:source.detachedStyle)||source.laneStyle||{style,settings};
  const titleStyle=s.titleStyle||preset.style;
  const defaults=titleSettingsForStyle(titleStyle,preset.settings);
  const own=s.detachedStyle?.settings;
  const layout=own&&s.detachedStyle?.style===titleStyle?{x:own.x,y:own.y,rotation:own.rotation,fontScale:(own.secondaryFontScale??160)===(preset.settings.secondaryFontScale??160)?own.fontScale:defaults.fontScale,position:own.position}:{};
  return {...s,frameAnimationStart:frameRanges.get(source.id)?.start,frameAnimationEnd:frameRanges.get(source.id)?.end,manualTitleLayout:true,detachedStyle:{style:titleStyle,settings:{...defaults,...layout,...preset.settings.titleAppearance,...s.titleOverrides}}};
 });
}
export function preserveSuggestionRemoval(before:Segment[],after:Segment[]):Segment[]{
 const removed=new Set(before.filter(s=>s.role==='title'&&!after.some(t=>t.id===s.id)).map(s=>s.sourceCaptionId));
 return after.map(s=>removed.has(s.id)?{...s,suppressSuggestions:true,headingWord:null}:s);
}

/** A heading and its speech caption share typography; their geometry and timing remain independent. */
export function captionStyleOwner(segments:Segment[],segment:Segment|undefined):Segment|undefined {
 return segment?.role==='title'&&!segment.standaloneTitle?(segments.find(s=>s.id===segment.sourceCaptionId)||segment):segment;
}

export function captionFamilyScope(id:string){
 const belongs=(s:Segment)=>s.id===id||s.sourceCaptionId===id;
 return {
  pick:(segments:Segment[])=>segments.filter(belongs),
  merge:(current:Segment[],before:Segment[])=>{
   const prior=before.filter(belongs),seen=new Set<string>();
   const result=current.flatMap(s=>{if(!belongs(s))return [s];const restored=prior.find(p=>p.id===s.id);if(restored)seen.add(s.id);return restored?[restored]:[];});
   return [...result,...prior.filter(s=>!seen.has(s.id))];
  }
 };
}

export function captionSelectionScope(segments:Segment[],index:number,container=false):string {
 const source=captionStyleOwner(segments,segments[index]);
 if(!container&&segments[index])return 'scene';
 return source?.group?`group:${source.group.id}`:'all';
}

/** Keep decorative layers visible through pauses without showing a stale speech caption. */
export function activeCaptionSegments(segments:Segment[],time:number,style:StyleKey,settings:CaptionSettings,duration?:number):Segment[]{
 const resolved=resolveCaptionSuggestions(segments).map(s=>{const key=(s.detachedStyle||s.laneStyle)?.style||style;if(key!=='curvyBackdrop'||s.role==='title')return s;const title=segments.find(t=>t.role==='title'&&t.sourceCaptionId===s.id);return title?.sourceWord!==undefined?{...s,headingWord:title.sourceWord}:s;}).filter(s=>{const parent=s.role==='title'?segments.find(source=>source.id===s.sourceCaptionId):undefined;const key=((parent||s).detachedStyle||(parent||s).laneStyle)?.style||style;return s.role!=='title'||!s.suggestedTitle||!ignoresCaptionTitles(key);}).map(s=>captionRenderSegment(s,(s.detachedStyle||s.laneStyle)?.style||style)),active=resolved.filter(s=>time>=s.start&&time<s.end);
 if(style==='underlinedEditorial'&&resolved.length){
  const headings=resolved.filter(s=>s.role==='title').sort((a,b)=>a.start-b.start);
  const title=headings.find(s=>time>=s.start&&time<s.end)??headings.filter(s=>s.start<=time).at(-1)??headings[0],source=title??resolved.find(s=>!s.effectOnly);
  const end=duration!==undefined&&Number.isFinite(duration)&&duration>0?duration:Math.max(...resolved.map(s=>s.frameAnimationEnd??s.end));
  if(source&&(title||captionWordRoles(source).title>=0)&&time>=0&&time<end){
   const tokens=source.text.trim().split(/\s+/),chosen=captionWordRoles(source).title;
   const text=title?title.text:tokens[chosen!==undefined&&chosen>=0?Math.min(tokens.length-1,chosen):tokens.reduce((best,word,i)=>word.length>tokens[best].length?i:best,0)];
   for(let i=active.length-1;i>=0;i--)if(active[i].role==='title')active.splice(i,1);
   active.unshift({...source,id:'persistent-underline-'+source.id,text,start:0,end,role:'title',effectOnly:false,words:undefined,wordStyles:undefined,hiddenTitleWords:undefined,position:title?.position??{x:settings.x,y:28},detachedStyle:{style:'underlinedEditorial',settings:{...settings,...settings.titleAppearance,...title?.titleOverrides,behindPerson:true}},laneStyle:undefined,separateStyle:true});
  }
 }
 const runs=new Set<string>();
 for(const source of resolved.filter(s=>s.role!=='title')){
  const own=(source.separateStyle===false?undefined:source.detachedStyle)||source.laneStyle||{style,settings};
  if(own.settings.effectPlayback==='repeat'||source.frameAnimationStart===undefined||source.frameAnimationEnd===undefined||time<source.frameAnimationStart||time>=source.frameAnimationEnd)continue;
  const key=`${source.lane||0}:${source.frameAnimationStart}:${source.frameAnimationEnd}`;
  if(runs.has(key))continue;runs.add(key);
  if(active.some(s=>s.role!=='title'&&s.frameAnimationStart===source.frameAnimationStart&&s.frameAnimationEnd===source.frameAnimationEnd))continue;
  const previous=resolved.filter(s=>s.role!=='title'&&s.frameAnimationStart===source.frameAnimationStart&&s.frameAnimationEnd===source.frameAnimationEnd&&s.start<=time).sort((a,b)=>a.start-b.start).at(-1)||source;
  if(['primeFrame','lensFrame','vistaRise','popCollage'].includes(own.style))active.push({...previous,effectOnly:true});
  if(own.style!=='primeFrame'&&own.style!=='lensFrame'&&own.style!=='underlinedEditorial')for(const title of resolved.filter(s=>s.role==='title'&&s.sourceCaptionId===previous.id)){if(!active.some(s=>s.id===title.id))active.push({...title,effectOnly:true});}
 }
 return active;
}

/** Remove the shared group style while retaining each caption's explicit override. */
export function deleteCaptionGroup(segments:Segment[],groupId:string):Segment[]{
 return segments.map(s=>s.group?.id===groupId?{...s,group:undefined,laneStyle:s.inheritedStyle,inheritedStyle:undefined}:s);
}

export function updateTitleStyles(segments:Segment[],patch:Partial<CaptionSettings>):Segment[]{
 return segments.map(s=>s.role==='title'?{...s,position:('x' in patch||'y' in patch||'position' in patch)?undefined:s.position,titleOverrides:{...s.titleOverrides,...patch},detachedStyle:s.detachedStyle?{...s.detachedStyle,settings:{...s.detachedStyle.settings,...patch}}:s.detachedStyle}:s);
}
