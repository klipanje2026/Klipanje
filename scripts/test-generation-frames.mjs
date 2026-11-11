import assert from 'node:assert/strict';import {loadTestModule} from './test-ts-module.mjs';
const {frameDefinition,frameTask}=await loadTestModule('lib/frame-definitions.ts','.local/generation-frame-tests');
const script={id:'s',project:'p',title:'Story',segments:[{id:'a',start:0,end:2.3,text:'Text'},{id:'b',start:2.3,end:5,text:'Next'}],photo_settings:{}};
const image={id:'image',name:'beach.png',url:'/api/assets/image/content',contentType:'image/png',metadata:{scriptId:'s',segmentIds:['a','b']}};
assert.equal(frameDefinition(script,'a',[image]).source,'image');assert.equal(frameDefinition(script,'b',[image]).source,'image');
assert.equal(frameDefinition(script,'a',[{...image,metadata:{...image.metadata,scriptId:'other'}}]).source,undefined);
const choice={...frameDefinition(script,'a',[image]),source:'replacement',kind:'motion',prompt:'Waves',duration:6};script.photo_settings.frameDefinitions={a:choice};
assert.equal(frameDefinition(script,'a',[image]).source,'replacement');
assert.equal(frameDefinition(script,'a',[image]).duration,6);
const restored=JSON.parse(JSON.stringify(script));assert.deepEqual(frameDefinition(restored,'a',[image]),choice);
const task=frameTask(script,'a',choice,image,'http://127.0.0.1:5175');assert.ok(task.includes('Waves'));assert.ok(task.includes('6.0 s'));assert.ok(task.includes('beach.png'));assert.ok(task.includes('1200 px'));
console.log('Frame assignment, shared image, manual override, persistence and chat instructions passed');

const {importGenerationFolder}=await loadTestModule('lib/generation-folder-import.ts','.local/generation-frame-tests');
const found=[];let uploads=0;
async function* entries(){yield {kind:'directory',name:'private'};yield {kind:'file',name:'first.png',getFile:async()=>new File(['same'],'first.png')};yield {kind:'file',name:'renamed.png',getFile:async()=>new File(['same'],'renamed.png')};yield {kind:'file',name:'clip.mp4',getFile:async()=>{throw Error('Must not read video');}};}
const upload=async(file,hash)=>{uploads++;return {id:String(uploads),name:file.name,metadata:{sourceFingerprint:hash}};};
assert.deepEqual(await importGenerationFolder(entries(),[],upload,a=>found.push(a)),{imported:1,skipped:0});
assert.deepEqual(await importGenerationFolder(entries(),found,upload,a=>found.push(a)),{imported:0,skipped:0});assert.equal(uploads,1);
console.log('Folder refresh deduplicates identical bytes and skips subfolders/non-images');
