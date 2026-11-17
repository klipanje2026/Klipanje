import assert from 'node:assert/strict';
import {loadTestModule} from './test-ts-module.mjs';
const {resolvedFrameAssets}=await loadTestModule('lib/frame-definitions.ts','.local/editor-gallery-tests');
const {completedFrames}=await loadTestModule('lib/completed-frames.ts','.local/editor-gallery-tests');
const script={id:'s',segments:[{id:'a',text:'One',start:0,end:1},{id:'b',text:'Two',start:1,end:2}],photo_settings:{frameDefinitions:{a:{kind:'image',source:'chosen'},b:{kind:'image',source:'chosen'}},narrationPlan:{scenes:{a:{assetId:'voice'},b:{assetId:'voice'}}}}};
const image={id:'chosen',contentType:'image/png',metadata:{scriptId:'s',gallery:false,segmentIds:['a']}};
const voice={id:'voice',contentType:'audio/wav',metadata:{purpose:'narration',scriptId:'s',segmentIds:['a','b'],narration:{segmentIds:['a','b'],text:'One Two',duration:2,words:[]}}};
const assets=[image,voice,{...image,id:'unused',metadata:{scriptId:'s',gallery:false}}];
const before=JSON.stringify({script,assets});
const visible=resolvedFrameAssets(script,assets).filter(a=>a.contentType==='image/png'&&a.metadata.gallery!==false);
assert.deepEqual(visible.map(a=>a.id),['chosen']);
assert.deepEqual(visible[0].metadata.segmentIds,['a','b']);
const result=completedFrames(assets,script);
assert.deepEqual(result.ids,['a','b']);
assert.equal(result.entries.filter(e=>!e.audio).length,1);
assert.deepEqual(result.entries.find(e=>!e.audio).ids,['a','b']);
assert.equal(JSON.stringify({script,assets}),before);
console.log('Selected generation is visible and imports across both frames; unused originals and saved data unchanged.');

