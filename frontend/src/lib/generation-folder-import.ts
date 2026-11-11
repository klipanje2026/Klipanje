import type {Asset} from './production';
export type FolderFile={name:string;kind:'file';getFile:()=>Promise<File>};
export async function importGenerationFolder(entries:AsyncIterable<FolderFile|{name:string;kind:'directory'}>,existing:Asset[],upload:(file:File,hash:string)=>Promise<Asset>,onAsset:(asset:Asset)=>void){
 const known=new Set(existing.map(a=>a.metadata.sourceFingerprint).filter(Boolean));let imported=0,skipped=0;
 for await(const entry of entries){
  if(entry.kind!=='file'||! /\.(png|jpe?g|webp)$/i.test(entry.name))continue;
  const file=await entry.getFile();if(!file.size||file.size>50*1024*1024){skipped++;continue;}
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(v=>v.toString(16).padStart(2,'0')).join('');
  if(known.has(hash))continue;
  const type=/\.png$/i.test(file.name)?'image/png':/\.webp$/i.test(file.name)?'image/webp':'image/jpeg';
  const asset=await upload(new File([file],file.name,{type}),hash);known.add(hash);onAsset(asset);imported++;
 }
 return {imported,skipped};
}
