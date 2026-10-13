import assert from 'node:assert/strict';
import {loadTestModule} from './test-ts-module.mjs';
const {captionScopeIds,patchLocalCaptionStyle,setLocalCaptionStyle,localCaptionLook}=await loadTestModule('lib/local-caption-style.ts','work/caption-style-scope-tests');
const {splitCaptionAt}=await loadTestModule('lib/caption-timing.ts','work/caption-style-scope-tests');
let segments=[{id:'a',sourceSceneId:'a',text:'Jedan Dva Tri',start:0,end:3,words:[{text:'Jedan',start:0,end:1},{text:'Dva',start:1,end:2},{text:'Tri',start:2,end:3}]}];
segments=splitCaptionAt(segments,'a',1);
segments=splitCaptionAt(segments,segments[1].id,2);
assert.equal(segments.length,3);
const doc={segments:[...segments,{id:'other',start:3,end:4,text:'Other'}],activeStyle:'clean',captionSettings:{x:50,y:80,textColor:'#ffffff',fontScale:100}};
assert.equal(captionScopeIds(doc.segments,'family:a').length,3);
for(const segment of segments){
 const edited=patchLocalCaptionStyle(doc,segment.id,{textColor:'#ff0000',y:25,reveal:'softBlur'});
 assert.equal(localCaptionLook(edited,edited.segments.find(s=>s.id===segment.id)).settings.textColor,'#ff0000');
 assert.ok(edited.segments.filter(s=>s.id!==segment.id).every(s=>!s.detachedStyle));
 assert.deepEqual(edited.segments.map(s=>[s.text,s.start,s.end]),doc.segments.map(s=>[s.text,s.start,s.end]));
}
const family=patchLocalCaptionStyle(doc,'family:a',{fontSizePx:40,backgroundOpacity:60});
assert.ok(family.segments.slice(0,3).every(s=>s.detachedStyle.settings.fontSizePx===40));
assert.equal(family.segments[3],doc.segments[3]);
const styled=setLocalCaptionStyle(doc,segments[2].id,'box',{...doc.captionSettings,textColor:'#00ff00'});
assert.equal(localCaptionLook(styled,styled.segments[2]).style,'box');
assert.equal(localCaptionLook(styled,styled.segments[0]).style,'clean');
assert.equal(styled.activeStyle,'clean');
console.log('Each of three split captions can change style, colors, position and animation independently or as one family.');
