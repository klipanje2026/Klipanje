import assert from 'node:assert/strict';
import {loadTestModule} from './test-ts-module.mjs';
const {narrationDeletionRebase:rebase,removeNarrationReferences:clean}=await loadTestModule('lib/narration-delete-rebase.ts','.local/narration-fix/tests');
const base={id:'s',title:'Story',content:'Keep',segments:[{id:'a',start:0,end:5}],updated_at:'old',storyboard:{clips:['protected']},photo_settings:{narrationPlan:{voices:{narrator:'one'},scenes:{a:{assetId:'old-a',text:'spoken'},b:{assetId:'keep'}},backgrounds:['old-bg','keep-bg']}}};
const remote=structuredClone(base);delete remote.photo_settings.narrationPlan.scenes.a.assetId;remote.photo_settings.narrationPlan.backgrounds=['keep-bg'];remote.updated_at='new';
assert.deepEqual(rebase(base,remote),['old-a','old-bg']);
const local=structuredClone(base.photo_settings);local.narrationPlan.voices.narrator='new-voice';local.narrationPlan.scenes.a.assetId='new-take';
assert.equal(clean(local,['old-a','old-bg']).narrationPlan.scenes.a.assetId,'new-take');assert.equal(clean(local,['old-a']).narrationPlan.voices.narrator,'new-voice');assert.equal(base.photo_settings.narrationPlan.scenes.a.assetId,'old-a');
for(const mutate of [s=>s.content='different',s=>s.segments[0].end=6,s=>s.storyboard.clips.push('new'),s=>s.photo_settings.narrationPlan.voices.narrator='other',s=>s.photo_settings.narrationPlan.scenes.a.text='changed']){const changed=structuredClone(remote);mutate(changed);assert.equal(rebase(base,changed),null);}
assert.equal(rebase(base,{...base,updated_at:'new'}),null);
console.log('PASS: deletion-only rebase; preserved replacement voice/take/text/timing/montage; rejects concurrent edits.');
