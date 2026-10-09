import {apiJson} from './api';
export type Interval={id:string;start:number;end:number;text:string;prompt?:string};
export type Character={id:string;name:string;description:string;referenceId?:string};
export type Production={script_count?:number;image_count?:number;audio_count?:number;id:string;name:string;workspace:string;brief:{description?:string;series?:string;characters?:Character[];model?:string;style?:string;desired?:string;avoid?:string;storyRules?:string;notes?:{id:string;title:string;text:string}[]};updated_at:string};
export type Chapter={id:string;project:string;title:string};
export type PhotoPrompt={id:string;text:string;segment:string};
export type Script={id:string;project:string;chapter?:string|null;title:string;content:string;segments:Interval[];image_prompt:string;photo_settings:{provider?:string;model?:string;style?:string;desired?:string;avoid?:string;storyRules?:string;notes?:{id:string;title:string;text:string}[];size?:string;quality?:string;prompt?:string;references?:string[];format?:string;prompts?:Record<string,{id:string;text:string}[]>;generationPrompts?:PhotoPrompt[];frameCounts?:Record<string,number>;referenceFrames?:Record<string,string[]>};storyboard:Record<string,unknown>;updated_at:string};
export type Asset={id:string;name:string;contentType:string;url:string;metadata:{audioRole?:'narration'|'sound';gallery?:boolean;aspect?:string;style?:string;references?:string[];estimatedUsd?:number|null;purpose?:string;scriptId?:string;segmentId?:string;prompt?:string;model?:string};size:number};
export const jsonBody=(body:unknown,method='POST')=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
export async function uploadAsset(project:string,file:File,metadata:Asset['metadata']){const body=new FormData();body.append('file',file);body.append('metadata',JSON.stringify(metadata));return apiJson<Asset>(`/api/projects/${project}/assets`,{method:'POST',body});}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name.replace(/[\\/:*?"<>|]/g,'-');a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
export const timeLabel=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${(seconds%60).toFixed(1).padStart(4,'0')}`;
