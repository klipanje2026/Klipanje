import assert from 'node:assert/strict';
import {loadTestModule} from './test-ts-module.mjs';
const {moveCharacterCrop,resizeCharacterCrop}=await loadTestModule('lib/character-crop.ts','work/character-crop-tests');
const body=[372,432,324,576];
assert.deepEqual(moveCharacterCrop(body,40,-25,1536,1024),[412,407,324,576]);
assert.deepEqual(moveCharacterCrop(body,9999,-9999,1536,1024),[1212,0,324,576]);
for(const edge of ['e','s','se'])for(const dx of [-9999,0,100,9999]){
 const box=resizeCharacterCrop(body,dx,dx,edge,true,1536,1024);
 assert.equal(box[2]*16,box[3]*9);assert.ok(box[0]+box[2]<=1536&&box[1]+box[3]<=1024);assert.ok(box[2]>=18);
}
const head=resizeCharacterCrop([96,24,384,384],20,0,'e',false,1536,1024);
assert.equal(head[2],404);assert.equal(head[2],head[3]);
assert.deepEqual(body,[372,432,324,576]);
console.log('Crop dragging and edge resizing preserve bounds and 1:1 / 9:16 ratios.');
