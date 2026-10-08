import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import {runInNewContext} from 'node:vm';
const code=ts.transpileModule(await fs.readFile('frontend/src/pages/HomePage/HomePage.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const jsx=(type,props)=>({type,props});
function nodes(tree){if(!tree||typeof tree!=='object')return [];return [tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];}
for(const mode of ['captions','video']){
 let slots=[],cursor=0,saved,finish,route;const exp={};
 const save=(user,file)=>{saved={user,file};return new Promise(resolve=>{finish=resolve;});};
 runInNewContext(code,{exports:exp,window:{location:{assign:url=>{route=url;}}},require:name=>name==='react'?{useState:value=>{const i=cursor++;if(!(i in slots))slots[i]=value;return[slots[i],next=>{slots[i]=next;}];}}:name==='react-router-dom'?{useNavigate:()=>url=>{route=url;}}:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name.includes('auth-context')?{useAuth:()=>({session:{user:{id:17}}})}:name.includes('video-studio-handoff')?{saveSubtitleHandoff:mode==='captions'?save:()=>assert.fail('Wrong handoff'),saveVideoOnlyHandoff:mode==='video'?save:()=>assert.fail('Wrong handoff')}:{}});
 const render=()=>{cursor=0;return exp.HomePage();};let tree=render();if(mode==='video'){nodes(tree).find(n=>n.type==='button'&&n.props.children?.includes('Video editor')).props.onClick();tree=render();}
 const file={name:'source.mp4',type:'video/mp4',size:500000000};
 nodes(tree).find(n=>n.props.onDrop).props.onDrop({preventDefault(){},dataTransfer:{files:[file]}});
 assert.strictEqual(saved.file,file);assert.equal(saved.user,17);assert.equal(route,undefined,'Must finish saving before navigation');finish();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(route,mode==='captions'?'/titlovi?handoff=1&language=bos':'/video-editor?handoff=1');
 assert.equal(new URL(route,'https://edita.ba').searchParams.get('handoff'),'1');
}
console.log('Homepage drop preserves the exact file, waits for storage, and opens both editors with handoff enabled.');
