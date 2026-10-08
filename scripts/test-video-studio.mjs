import {loadTestModule} from './test-ts-module.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';
import postcss from 'postcss';
await fs.mkdir('work/video-tests',{recursive:true});
for(const [source,name] of [['frontend/src/lib/video-layout.ts','layout'],['frontend/theme-plugin.ts','theme']]) {
 const code=ts.transpileModule(await fs.readFile(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 await fs.writeFile(`work/video-tests/${name}.mjs`,code);
}
const {videoRect,rulerTicks,anchorZoom,advancePlayhead,clampPlayhead,clipAtPlayhead}=await import('../work/video-tests/layout.mjs');
const {default:theme}=await import('../work/video-tests/theme.mjs');
for(const source of [16/9,9/16,1]) for(const frame of [16/9,9/16,1,4/5]) {
 const rect=videoRect(source,frame,{});
 assert.ok(rect.width<=100.00001&&rect.height<=100.00001);
 assert.ok(Math.abs(rect.width/rect.height*frame-source)<.00001);
 const moved=videoRect(source,frame,{x:70,y:30,scale:2});
 assert.equal(moved.width,rect.width*2);
 assert.ok(Math.abs(moved.x+moved.width/2-70)<.00001);
 assert.ok(Math.abs(moved.y+moved.height/2-30)<.00001);
}
for(const duration of [.1,4,60,3600]) {
 const ticks=rulerTicks(duration,800);
 assert.equal(ticks[0].time,0);
 assert.ok(ticks.every(t=>t.percent>=0&&t.percent<=100));
 assert.ok(ticks.length<=12);
}
assert.equal((anchorZoom(200,100,100,200)+100)/2,300);
const css=(await postcss([theme()]).process('body{background:#fff;color:#172130} @media(min-width:1px){.panel{border:1px solid #ddd}} @keyframes a{from{color:#000}}',{from:undefined})).css;
assert.ok(css.includes('body{background:#fff;color:#172130}'));
assert.ok(css.includes(':root[data-theme="dark"] body'));
assert.ok(css.includes(':root[data-theme="dark"] .panel'));
assert.ok(css.includes(':root[data-theme="dark"][data-palette="dark"] body'));
assert.ok(css.includes('rgba(32,32,32,1)'));
assert.ok(css.includes('@keyframes a{from{color:#000}}'));
assert.ok(!css.includes('filter:'));
console.log('Video geometry, zoom anchoring, ruler and theme regression checks passed.');

await fs.writeFile('work/video-tests/caption-word-roles.mjs',ts.transpileModule(await fs.readFile('frontend/src/lib/caption-word-roles.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText);
const captionCode=ts.transpileModule(await fs.readFile('frontend/src/lib/video-captions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
await fs.writeFile('work/video-tests/caption-selection.mjs',ts.transpileModule(await fs.readFile('frontend/src/lib/caption-selection.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace("'./caption-word-roles'","'./caption-word-roles.mjs'"));
await fs.writeFile('work/video-tests/captions.mjs',captionCode.replace("'./caption-selection'","'./caption-selection.mjs'"));
const {captionsAtTime,timelineCaptions,applyTimelineCaptionEdit}=await loadTestModule('lib/video-captions.ts','work/video-tests/modules');
const document={activeStyle:'clean',captionSettings:{textColor:'#ffffff'},segments:[{id:'s',start:2,end:4,text:'Prati video',words:[{text:'Prati',start:2,end:3},{text:'video',start:3,end:4}]}]};
const source={id:'clip',assetId:'source',type:'video',start:10,inPoint:2.5,outPoint:3.5,layer:1};
const documents={source:document};
assert.equal(captionsAtTime([source],documents,9).length,0);
assert.equal(captionsAtTime([source],documents,10.2)[0].sourceTime,2.6999999999999993);
assert.equal(captionsAtTime([source],documents,11).length,0);
const cut=[{...source,outPoint:3},{...source,id:'second',start:10.5,inPoint:3}];
assert.equal(captionsAtTime(cut,documents,10.75)[0].clip.id,'second');
const copy={...source,id:'copy',start:20};
assert.equal(captionsAtTime([copy],documents,20.25)[0].segment.text,'Prati video');
assert.equal(captionsAtTime([],documents,10.2).length,0);
const returned=timelineCaptions([source,copy],documents);
assert.deepEqual(returned.segments.map(s=>[s.start,s.end]),[[10,11],[20,21]]);
assert.deepEqual(returned.segments[0].words.map(w=>[w.start,w.end]),[[10,10.5],[10.5,11]]);
assert.equal(returned.activeStyle,'clean');
assert.equal(timelineCaptions([],documents),undefined);
assert.deepEqual(document.segments[0].words.map(w=>w.start),[2,3]);
console.log('Caption trims, cuts, moves, duplicates and return timing passed.');

{
 const {captionPlaybackTime,captionOutputTime}=await loadTestModule('lib/caption-clock.ts','work/video-tests/modules');
 assert.equal(captionPlaybackTime(1.9),2);
 assert.equal(captionOutputTime(.05),0);
 assert.equal(captionOutputTime(2),1.9);
 const clip={...source,start:0,inPoint:0,outPoint:8};
 assert.equal(captionsAtTime([clip],documents,1.89).length,0);
 const early=captionsAtTime([clip],documents,1.9)[0];
 assert.equal(early.segment.id,'s');assert.equal(early.sourceTime,1.9);assert.equal(early.captionTime,2);
 assert.equal(captionsAtTime([clip],documents,3.91).length,0);
 assert.equal(document.segments[0].start,2,'Rendering must not accumulate a shift in saved captions');
 assert.equal(captionsAtTime([clip],documents,1.9)[0].captionTime,2);
 const {exportRange}=await loadTestModule('lib/export-range.ts','work/video-tests/modules');
 assert.deepEqual(exportRange([{start:2,inPoint:2,outPoint:10}],10),{start:2,duration:8});
 assert.deepEqual(exportRange([{start:3,inPoint:5,outPoint:9},{start:9,inPoint:0,outPoint:2}],11),{start:3,duration:8});
 assert.deepEqual(exportRange([{start:0,inPoint:5,outPoint:9}],4),{start:0,duration:4});
 assert.deepEqual(exportRange([{start:3,inPoint:3,outPoint:9},{start:0,inPoint:0,outPoint:9}],9),{start:0,duration:9},'Keep an earlier audio clip');
 const {timelineMaximum,clampTimelineHeight}=await loadTestModule('lib/timeline-size.ts','work/video-tests/modules');
 for(const space of [320,450,600,900]) {
  const max=timelineMaximum(space),height=clampTimelineHeight(9999,180,max);
  assert.ok(height<=space-240,'Even a large drag must leave preview space');
  assert.ok(height<=max);assert.ok(clampTimelineHeight(-999,180,max)<=max);
 }
 assert.ok(clampTimelineHeight(400,180,timelineMaximum(450))<clampTimelineHeight(400,180,timelineMaximum(900)),'A resized window reclamps the dock');
 console.log('Caption lead, source-time preservation, trimmed export range and preview-safe timeline limits passed.');
}

assert.equal(advancePlayhead(0,100,98,12,false),0,'An early animation timestamp cannot make the video negative');
assert.equal(advancePlayhead(11.9,0,200,12,false),12);
assert.ok(Math.abs(advancePlayhead(11.9,0,200,12,true)-.1)<.0001);
assert.equal(advancePlayhead(0,0,50,0,true),0);
assert.equal(clampPlayhead(-1,12),0);
assert.equal(clampPlayhead(NaN,12),0);
assert.ok(clipAtPlayhead({start:2,inPoint:4,outPoint:6},3,10));
assert.ok(!clipAtPlayhead({start:2,inPoint:4,outPoint:6},4,10));
console.log('Playback bounds and active-clip boundary checks passed.');

const selectionCode=ts.transpileModule(await fs.readFile('frontend/src/lib/caption-selection.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
await fs.writeFile('work/video-tests/selection.mjs',selectionCode.replace("'./caption-word-roles'","'./caption-word-roles.mjs'"));
const {captionTitle,newCaptionLane,detachCaption,styleCaptionLane,groupCaptions,ungroupCaptions,addCaptionsToGroup,dropCaptionIntoGroup,resizeCaptionGroup,nextCaptionGroup,resetCaptionFormatting,keywordPreset}=await loadTestModule('lib/caption-selection.ts','work/video-tests/modules');
const independent=detachCaption(document.segments[0],'clean',document.captionSettings);
const heading=captionTitle(independent,1,'clean',document.captionSettings,1);
assert.equal(heading.start,3);assert.equal(heading.text,'video');assert.equal(heading.role,'title');
const multi=JSON.parse(JSON.stringify({...document,segments:[independent,heading]}));
assert.equal(captionsAtTime([{...source,inPoint:0,outPoint:8,start:0}],{source:multi},3.2).length,2);
const lanes=newCaptionLane(multi.segments,3,8);assert.ok(lanes.find(s=>s.role==='title').lane>lanes.at(-1).lane);
const moved=applyTimelineCaptionEdit(document.segments[0],returned.segments[0],{...returned.segments[0],start:10.5,end:11.5},source);
assert.ok(moved.start>=source.inPoint&&moved.end<=source.outPoint);
assert.equal(moved.words.length,document.segments[0].words.length);
assert.deepEqual(multi.segments[0].detachedStyle,independent.detachedStyle);
console.log('Detached styles, title timing, simultaneous captions, lane order and clipped timeline edits passed.');
const wavCode=ts.transpileModule(await fs.readFile('frontend/src/lib/voice-wav.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
await fs.writeFile('work/video-tests/voice-wav.mjs',wavCode);
const {audioBufferSegmentToWav,audioBuffersToWav}=await import('../work/video-tests/voice-wav.mjs');
const samples=Float32Array.from({length:16000},(_,i)=>Math.sin(i/12)*.5);
const audio={sampleRate:16000,length:16000,numberOfChannels:1,getChannelData:()=>samples};
const chunk=await audioBufferSegmentToWav(audio,.25,.75,16000).arrayBuffer();
assert.equal(chunk.byteLength,44+8000*2);assert.equal(new DataView(chunk).getUint32(24,true),16000);
const joined=await audioBuffersToWav([audio,audio]).arrayBuffer();assert.equal(joined.byteLength,44+32000*2);
console.log('Voice-change WAV slicing and joined duration passed.');

const laneFixture=[{id:'a',lane:0,text:'A',start:0,end:2},{id:'b',lane:1,text:'B',start:0,end:2},{id:'c',lane:1,text:'C',start:2,end:4},{id:'special',lane:1,text:'Special',start:4,end:5,detachedStyle:{style:'neon',settings:{x:30}}}];
const changedLane=styleCaptionLane(laneFixture,1,'clean',{x:60});
assert.strictEqual(changedLane[0],laneFixture[0]);assert.strictEqual(changedLane[3],laneFixture[3]);
assert.equal(changedLane[1].laneStyle.settings.x,60);assert.equal(changedLane[2].laneStyle.settings.x,60);
const changedMain=styleCaptionLane(changedLane,0,'word',{x:15});assert.equal(changedMain[1].laneStyle.settings.x,60);
assert.equal(JSON.parse(JSON.stringify(changedMain))[1].laneStyle.settings.x,60);
console.log('Caption lane styles stay isolated, preserve detached styles and survive serialization.');

const groupFixture=Array.from({length:12},(_,i)=>({id:`g${i}`,text:`Caption ${i}`,start:i,end:i+1,lane:0}));
const grouped=groupCaptions(groupFixture,['g0','g1','g2','g3','g4','g5'],'Uvod','clean',{x:50});
const second=groupCaptions(grouped,['g6','g7'],'Kraj','word',{x:20});
assert.notEqual(second[0].group.color,second[6].group.color);
const protectedCaption={...second[8],detachedStyle:{style:'neon',settings:{x:90}}};second[8]=protectedCaption;
const ordinary=styleCaptionLane(second,0,'box',{x:10});
assert.strictEqual(ordinary[0],second[0]);assert.strictEqual(ordinary[6],second[6]);assert.strictEqual(ordinary[8],protectedCaption);assert.equal(ordinary[9].laneStyle.style,'box');
const groupEdit=styleCaptionLane(ordinary,0,'focus',{x:70},ordinary[0].group.id);
for(let i=0;i<6;i++)assert.equal(groupEdit[i].laneStyle.settings.x,70);
assert.equal(groupEdit[6].laneStyle.settings.x,20);assert.equal(groupEdit[9].laneStyle.settings.x,10);
const individuallyEdited=groupEdit.map((s,i)=>i===1?detachCaption(s,'focus',{x:70}):s);
const again=styleCaptionLane(individuallyEdited,0,'neon',{x:30},groupEdit[0].group.id);assert.deepEqual(again[1].detachedStyle,individuallyEdited[1].detachedStyle,'Independent styles survive shared group edits');assert.equal(again[1].laneStyle.style,'neon');
const ungrouped=ungroupCaptions(again,again[0].group.id);assert.equal(ungrouped[0].group,undefined);assert.equal(ungrouped[0].detachedStyle.style,'neon');assert.strictEqual(styleCaptionLane(ungrouped,0,'clean',{x:5})[0],ungrouped[0]);
assert.deepEqual(JSON.parse(JSON.stringify(again))[0].group,again[0].group);
assert.ok(groupCaptions(groupFixture,['g0'],'One','clean',{})[0].group);
assert.strictEqual(groupCaptions([{...groupFixture[0],lane:1},groupFixture[1]],['g0','g1'],'Cross lane','clean',{})[0].group,undefined);
console.log('Caption groups: separate colors, ordinary/group/individual isolation, ungroup preservation and persistence passed.');

const extended=addCaptionsToGroup(grouped,['g6'],grouped[0].group.id);
assert.equal(extended[6].group.id,grouped[0].group.id);assert.deepEqual(extended[6].laneStyle,grouped[0].laneStyle);
const crossLane=addCaptionsToGroup([...grouped,{id:'outside',lane:2,text:'Outside',start:0,end:1}],['outside'],grouped[0].group.id);assert.equal(crossLane.at(-1).group,undefined);
const clippedBefore={...document.segments[0],start:source.start,end:source.start+1};
const metadataOnly=applyTimelineCaptionEdit(document.segments[0],clippedBefore,{...clippedBefore,group:grouped[0].group,laneStyle:grouped[0].laneStyle},source);
assert.equal(metadataOnly.start,document.segments[0].start);assert.equal(metadataOnly.end,document.segments[0].end);assert.deepEqual(metadataOnly.words,document.segments[0].words);assert.equal(metadataOnly.group.id,grouped[0].group.id);
console.log('Timeline grouping preserves trimmed source timing and words, adds members and respects lane boundaries.');

const dropFixture=[{id:'low',text:'Lower',lane:1,start:5,end:7,words:[{text:'Lower',start:5,end:7}]},{id:'upper',text:'Upper',lane:0,start:0,end:2}];
const dropped=dropCaptionIntoGroup(dropFixture,'low','upper','clean',{x:50});
assert.equal(dropped[0].lane,0);assert.equal(dropped[0].group.id,dropped[1].group.id);assert.equal(dropped[0].start,5);assert.deepEqual(dropped[0].words,dropFixture[0].words);
const joinedDrop=dropCaptionIntoGroup([...dropped,{id:'third',text:'Third',lane:2,start:8,end:9}],'third','upper','neon',{x:5});assert.equal(joinedDrop[2].group.id,dropped[0].group.id);assert.deepEqual(joinedDrop[2].laneStyle,dropped[1].laneStyle);assert.equal(joinedDrop[2].start,8);
assert.strictEqual(dropCaptionIntoGroup(dropFixture,'low','missing','clean',{}),dropFixture);
console.log('Cross-lane caption drops create/join groups without changing speech times or word timing.');

const rangeFixture=[{id:'a',text:'A',start:0,end:1},{id:'b',text:'B',start:1,end:2},{id:'c',text:'C',start:2,end:3},{id:'d',text:'D',start:1,end:2,lane:1}];
const initialGroup=groupCaptions(rangeFixture,['a','b'],'Range','clean',document.captionSettings),rangeId=initialGroup[0].group.id;
const expandedGroup=resizeCaptionGroup(initialGroup,rangeId,0,3);
assert.equal(expandedGroup[2].group.id,rangeId);assert.equal(expandedGroup[3].group,undefined);
const contractedGroup=resizeCaptionGroup(expandedGroup,rangeId,1,3);
assert.equal(contractedGroup[0].group,undefined);assert.ok(contractedGroup[0].detachedStyle);
assert.deepEqual(contractedGroup.map(s=>[s.start,s.end]),rangeFixture.map(s=>[s.start,s.end]));
console.log('Resizable group ranges preserve speech timing, release styles and isolate lanes.');

const firstRange=groupCaptions(rangeFixture,['a','b'],'First','clean',document.captionSettings);
const nextRange=nextCaptionGroup(firstRange,'a','clean',document.captionSettings);
assert.ok(nextRange[2].group);assert.notEqual(nextRange[2].group.id,nextRange[0].group.id);
const claimed=resizeCaptionGroup(nextRange,nextRange[0].group.id,0,3);
assert.equal(claimed[2].group.id,claimed[0].group.id);
assert.deepEqual(claimed.map(s=>[s.start,s.end]),rangeFixture.map(s=>[s.start,s.end]));
console.log('New groups choose free captions; adjacent group boundaries transfer membership without moving speech.');

{
 const words={0:{text:'A',...keywordPreset('paperCut',{fontScale:100,highlightColor:'#ffff00'})}};
 const source=[{id:'a',text:'A B',start:0,end:2,lane:0,wordStyles:words},{id:'title',text:'A',start:0,end:1,role:'title',lane:1}];
 const styled=styleCaptionLane(source,0,'prism',{fontScale:180});
 assert.strictEqual(styled[0].wordStyles,words,'Global caption style preserves independent keywords');
 assert.strictEqual(styled[1],source[1],'Global caption style never edits titles');
 const reset=resetCaptionFormatting(styled);assert.equal(reset.length,1);assert.equal(reset[0].text,'A B');assert.equal(reset[0].end,2);assert.equal(reset[0].wordStyles,undefined);assert.equal(reset[0].laneStyle,undefined);
 const t=captionTitle(source[0],1,'clean',{fontScale:100},1);assert.equal(t.sourceCaptionId,'a');assert.equal(t.sourceWord,1);assert.equal(t.lane,1);
 console.log('Reset preserves speech; titles and keyword styles remain isolated from main captions.');
}

{
 const {resolveCaptionSuggestions,titleSettingsForStyle}=await loadTestModule('lib/caption-selection.ts','work/video-tests/modules');
 const speech={id:'manual-source',text:'Original chosen title',start:0,end:3};
 const config={fontFamily:'Arial',highlightColor:'#fff',fontScale:100};
 const title=captionTitle(speech,1,'verticalTitle',config,1);
 const resolved=resolveCaptionSuggestions([speech,title,{...speech,id:'other'}]);
 assert.equal(resolved[0].suppressSuggestions,true);
 assert.deepEqual(resolved[0].hiddenTitleWords,[1]);
 assert.equal(resolved[2].suppressSuggestions,false,'Other captions keep suggestions');
 assert.equal(resolved[1].text,'chosen');
 assert.equal(resolved[1].detachedStyle.settings.rotation,-90);
 assert.equal(titleSettingsForStyle('verticalTitle',config).rotation,-90);
 assert.equal(resolveCaptionSuggestions([{...speech,wordStyles:{1:{text:'chosen',style:'clean',settings:config}}}])[0].suppressSuggestions,true);
 assert.equal(speech.suppressSuggestions,undefined,'Resolving preview/export never mutates saved text');
}
console.log('Manual headers and keywords override suggestions only for their source caption.');

{
 const {editableCaptionSegments,preserveSuggestionRemoval,resolveCaptionSuggestions}=await loadTestModule('lib/caption-selection.ts','work/video-tests/modules');
 const config={fontFamily:'Georgia',fontScale:100,highlightColor:'#fff'};
 const speech={id:'suggest-source',text:'Hello world',start:0,end:4};
 const initial=editableCaptionSegments([speech],'verticalTitle',config);
 const title=initial.find(s=>s.suggestedTitle);
 assert.ok(title&&title.role==='title'&&title.sourceCaptionId===speech.id);
 const edited=initial.map(s=>s.id===title.id?{...s,end:8,position:{x:55,y:40},text:'Edited'}:s);
 assert.deepEqual(editableCaptionSegments(edited,'verticalTitle',config).find(s=>s.id===title.id),edited[1]);
 assert.equal(resolveCaptionSuggestions(initial)[0].suppressSuggestions,true,'Only one header is painted');
 const manual={...title,id:'manual',suggestedTitle:false,text:'Mine'};
 const replaced=editableCaptionSegments([...initial,manual],'verticalTitle',config);
 assert.equal(replaced.filter(s=>s.role==='title').length,1);
 assert.equal(replaced.find(s=>s.role==='title').text,'Mine');
 const deleted=preserveSuggestionRemoval(initial,[speech]);
 assert.equal(editableCaptionSegments(deleted,'verticalTitle',config).length,1,'Deleted suggestions stay removed');
 assert.equal(editableCaptionSegments(initial,'clean',config).length,1,'Changing template clears its suggestions');
 assert.equal(editableCaptionSegments(initial,'verticalTitle',config)[1].id,title.id,'Suggestion identity is stable');
}

{
 const {editableCaptionSegments,captionStyleOwner}=await loadTestModule('lib/caption-selection.ts','work/video-tests/modules');
 const config={fontFamily:'Georgia',secondaryFontFamily:'Roboto',fontScale:100,highlightColor:'#ffffff'};
 const speech={id:'linked-source',text:'Shared style',start:0,end:4};
 const initial=editableCaptionSegments([speech],'verticalTitle',config);
 const title={...initial[1],position:{x:70,y:30},end:8};
 assert.equal(captionStyleOwner(initial,title).id,speech.id);
 const changed={...speech,detachedStyle:{style:'verticalTitle',settings:{...config,secondaryFontFamily:'Caveat',highlightColor:'#ff0000'}}};
 const linked=editableCaptionSegments([changed,title],'verticalTitle',config);
 assert.equal(linked[1].detachedStyle.settings.fontFamily,'Caveat');
 assert.equal(linked[1].detachedStyle.settings.textColor,'#ff0000');
 assert.deepEqual(linked[1].position,{x:70,y:30});
 assert.equal(linked[1].end,8);
 const manual={...title,suggestedTitle:false};
 assert.equal(editableCaptionSegments([changed,manual],'verticalTitle',config)[1].detachedStyle.settings.fontFamily,'Caveat');
}

{
 const {editableCaptionSegments,preserveSuggestionRemoval,resolveCaptionSuggestions}=await loadTestModule('lib/caption-selection.ts','work/video-tests/modules');
 const source={id:'delete-source',text:'Keep this word',start:0,end:3};
 const config={fontFamily:'Georgia',fontScale:100,highlightColor:'#fff'};
 const title={id:'manual-delete',role:'title',sourceCaptionId:source.id,sourceWord:0,text:'Keep',start:0,end:3};
 const removed=preserveSuggestionRemoval([source,title],[source]);
 const resolved=resolveCaptionSuggestions(editableCaptionSegments(removed,'verticalTitle',config));
 assert.equal(resolved.length,1);
 assert.equal(resolved[0].text,'Keep this word');
 assert.deepEqual(resolved[0].hiddenTitleWords,[]);
 assert.equal(resolved[0].suppressSuggestions,true,'Deleting a manual header does not regenerate a suggested one');
}

{
 const {editableCaptionSegments}=await loadTestModule('lib/caption-selection.ts','work/video-tests/modules');
 const settings={highlightColor:'#aabbcc',fontFamily:'Roboto',fontScale:100};
 const items=[{id:'frame1',text:'One',start:0,end:2},{id:'frame2',text:'Two',start:2,end:4},{id:'frame3',text:'Three',start:4,end:6,detachedStyle:{style:'clean',settings}},{id:'frame4',text:'Four',start:6,end:8},{id:'frame5',text:'Five',start:10,end:12}];
 const result=editableCaptionSegments(items,'primeFrame',settings);
 assert.equal(result[0].frameAnimationStart,0);
 assert.equal(result[1].frameAnimationStart,0,'Same borders continue across captions');
 assert.equal(result[3].frameAnimationStart,6,'Different intervening style resets border entrance');
 assert.equal(result[4].frameAnimationStart,6,'Idle borders continue through pauses');
 assert.equal(result[3].frameAnimationEnd,12);
 const {activeCaptionSegments,captionSelectionScope}=await loadTestModule('lib/caption-selection.ts','work/video-tests/modules');
 const gap=activeCaptionSegments(result,9,'primeFrame',settings);
 assert.equal(gap.length,1);assert.equal(gap[0].effectOnly,true);
 const repeat=editableCaptionSegments(items,'primeFrame',{...settings,effectPlayback:'repeat'});
 assert.equal(repeat[1].frameAnimationStart,2);assert.equal(activeCaptionSegments(repeat,9,'primeFrame',settings).length,0);
 const grouped=[{...items[0],group:{id:'g',name:'G'}},items[1],items[2],{id:'title',role:'title',sourceCaptionId:items[0].id}];
 assert.equal(captionSelectionScope(grouped,0),'scene');
 assert.equal(captionSelectionScope(grouped,1),'scene');
 assert.equal(captionSelectionScope([{...grouped[0],separateStyle:true,detachedStyle:{style:'clean',settings}}],0),'scene');
 assert.equal(captionSelectionScope(grouped,3),'scene');
 assert.equal(captionSelectionScope(grouped,0,true),'group:g');
 assert.equal(captionSelectionScope(grouped,1,true),'all');
 assert.equal(captionSelectionScope(grouped,2,true),'all');
 assert.equal(captionSelectionScope(grouped,3,true),'group:g');
}

{
 const {editableCaptionSegments}=await loadTestModule('lib/caption-selection.ts','work/video-tests/modules');
 const config={fontFamily:'Georgia',fontScale:100,highlightColor:'#ffffff'};
 const source={id:'owner',text:'My title',start:0,end:2};
 const title={id:'custom-header',role:'title',sourceCaptionId:'owner',text:'My',start:0,end:2,titleOverrides:{rotation:23,fontScale:155,fontFamily:'Roboto'}};
 const result=editableCaptionSegments([source,title],'verticalTitle',config);
 assert.equal(result[1].detachedStyle.settings.rotation,23);
 assert.equal(result[1].detachedStyle.settings.fontScale,155);
 assert.equal(result[1].detachedStyle.settings.fontFamily,'Roboto');
 assert.equal(result[0].detachedStyle,undefined,'Header settings do not change speech settings');
 const grouped=editableCaptionSegments([{...source,group:{id:'a'}},{...source,id:'next',start:2,end:4,group:{id:'b'}}],'primeFrame',config);
 assert.equal(grouped[0].frameAnimationEnd,2,'A new group has its own border entrance and exit');
 assert.equal(grouped[1].frameAnimationStart,2);
}

{
 const {deleteCaptionGroup,groupCaptions,titleSettingsForStyle}=await loadTestModule('lib/caption-selection.ts','work/video-tests/modules');
 const base={id:'delete-member',text:'Keep',start:0,end:2,laneStyle:{style:'clean',settings:{fontScale:100}}};
 const group=groupCaptions([base],['delete-member'],'Test','primeFrame',{fontScale:120});
 const custom={...group[0],detachedStyle:{style:'paperCut',settings:{fontScale:150}},separateStyle:true};
 const removed=deleteCaptionGroup([custom],custom.group.id);
 assert.equal(removed.length,1);assert.equal(removed[0].group,undefined);
 assert.deepEqual(removed[0].laneStyle,base.laneStyle);
 assert.deepEqual(removed[0].detachedStyle,custom.detachedStyle);
 const secondary=titleSettingsForStyle('verticalTitle',{fontFamily:'Georgia',highlightColor:'#ffff00',secondaryFontFamily:'Roboto',secondaryFontScale:190,secondaryStyle:{underline:true,textColor:'#abcdef'}});
 assert.equal(secondary.fontFamily,'Roboto');assert.equal(secondary.fontScale,190);assert.equal(secondary.textColor,'#abcdef');assert.equal(secondary.rotation,-90);assert.equal(secondary.underline,true);
}

{
 const {titleSettingsForStyle,updateTitleStyles,editableCaptionSegments}=await loadTestModule('lib/caption-selection.ts','work/video-tests/modules');
 const settings={textColor:'#fff',highlightColor:'#ffff00',backgroundColor:'#cabb99',backgroundOpacity:100,fontScale:100,x:50,y:87.5};
 assert.equal(titleSettingsForStyle('boldHeader',settings).textColor,'#cabb99');
 assert.equal(titleSettingsForStyle('boldHeader',{...settings,backgroundOpacity:0}).textColor,'#ffff00');
 const speech={id:'speech',text:'This is speech',start:0,end:2,suppressSuggestions:true};
 const title={id:'title',role:'title',text:'Title',sourceCaptionId:'speech',start:0,end:2,detachedStyle:{style:'boldHeader',settings}};
 const changed=updateTitleStyles([speech,title,{...title,id:'second'}],{x:20,fontScale:130});
 assert.equal(changed[0],speech);
 const resolved=editableCaptionSegments(changed,'boldHeader',settings);
 for(const item of resolved.filter(s=>s.role==='title')){assert.equal(item.detachedStyle.settings.x,20);assert.equal(item.detachedStyle.settings.fontScale,130);}
 console.log('Title background colour inheritance and shared title geometry survive resolution.');
}

// A custom title replaces the generated slot, including its geometry, after serialization.
{
 const {replaceCaptionTitle,editableCaptionSegments,resolveCaptionSuggestions}=await loadTestModule('lib/caption-selection.ts','work/video-tests/modules');
 const source={id:'title-source',start:0,end:4,text:'Stara prica traje',words:[{text:'Stara',start:0,end:1},{text:'prica',start:1,end:2},{text:'traje',start:2,end:4}]};
 const settings={...document.captionSettings,secondaryFontScale:160};
 const initial=editableCaptionSegments([source],'sketchNote',settings);
 const old=initial.find(s=>s.role==='title');old.detachedStyle.settings.x=37;
 const custom={...captionTitle(source,1,'sketchNote',settings,1),text:'Nova prica'};
 const replaced=replaceCaptionTitle(initial,source,custom);
 const restored=editableCaptionSegments(JSON.parse(JSON.stringify(replaced)),'sketchNote',settings);
 assert.equal(restored.filter(s=>s.role==='title').length,1);
 assert.equal(restored.find(s=>s.role==='title').text,'Nova prica');
 assert.equal(restored.find(s=>s.role==='title').detachedStyle.settings.x,37);
 assert.equal(restored.find(s=>s.role==='title').suggestedTitle,false);
 assert.deepEqual(restored.find(s=>s.id===source.id).words,source.words);
 const legacy=resolveCaptionSuggestions([...replaced,{...old,id:'legacy-suggestion'}]);
 assert.equal(legacy.filter(s=>s.role==='title').length,1);
}
console.log('Manual titles replace generated slots without duplicate headings or speech changes.');
