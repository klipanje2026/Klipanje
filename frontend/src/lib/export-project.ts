import {saveEditorDraft,loadEditorDraft} from './editor-draft';
import type {ProjectSnapshot} from './project-snapshot';
async function key(file:Blob,userId:number){
 const sample=await new Blob([file.slice(0,65536),file.slice(-65536)]).arrayBuffer();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',sample))).map(n=>n.toString(16).padStart(2,'0')).join('');
 return `export-source:${userId}:${file.size}:${hash}`;
}
export async function rememberExport(output:Blob,userId:number,kind:'video'|'subtitles',snapshot:ProjectSnapshot){
 await saveEditorDraft(await key(output,userId),{...snapshot,data:{...snapshot.data,exportSourceKind:kind}});
}
export async function restoreExport(file:File,userId:number){return loadEditorDraft(await key(file,userId));}
