import {apiFetch} from './api';
import type {Asset} from './production';
export async function assetFile(asset:Asset){const response=await apiFetch(asset.url);if(!response.ok)throw new Error('Medij nije dostupan: '+asset.name);return new File([await response.blob()],asset.name,{type:asset.contentType});}
export async function mediaDuration(file:File):Promise<number>{
 const url=URL.createObjectURL(file),media=document.createElement(file.type.startsWith('audio/')?'audio':'video');
 return new Promise((resolve,reject)=>{let done=false;const finish=(error?:Error)=>{if(done)return;done=true;clearTimeout(timer);const d=media.duration;media.onloadedmetadata=null;media.onerror=null;media.removeAttribute('src');media.load();URL.revokeObjectURL(url);if(error||!Number.isFinite(d)||d<=0)reject(error||new Error('Trajanje nije dostupno.'));else resolve(d);};const timer=setTimeout(()=>finish(new Error('Medij se nije učitao.')),20000);media.preload='metadata';media.onloadedmetadata=()=>finish();media.onerror=()=>finish(new Error('Medij nije moguće otvoriti.'));media.src=url;});
}
export function timingOptions(duration:number,start:number,end:number,speed:number,target?:number){
 if(![duration,start,end,speed].every(Number.isFinite)||duration<=0||start<0||end>duration+.01||end<=start||speed<=0)throw new Error('Provjeri početak, kraj i brzinu.');
 const rate=target===undefined?speed:(end-start)/target;
 if(!Number.isFinite(rate)||rate<.1||rate>2)throw new Error('Završno trajanje traži brzinu izvan raspona 0,1–2×.');
 return {start,end,speed:rate,output:(end-start)/rate};
}
export async function resizeImage(file:File,maxEdge:number,targetKB:number){
 if(!Number.isFinite(maxEdge)||maxEdge<1||!Number.isFinite(targetKB)||targetKB<=0)throw new Error('Neispravna veličina slike.');
 const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');
 try{let edge=Math.min(maxEdge,Math.max(bitmap.width,bitmap.height)),result:Blob|null=null;
 for(let attempt=0;attempt<8;attempt++){const scale=edge/Math.max(bitmap.width,bitmap.height);canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);
 for(const quality of [.9,.8,.7,.6,.5]){result=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Slika se ne može obraditi.')),'image/webp',quality));if(result.size<=targetKB*1024)return {blob:result,width:canvas.width,height:canvas.height};}
 if(edge<=640)break;edge=Math.max(640,Math.round(edge*.85));}
 if(!result)throw new Error('Obrada slike nije uspjela.');return {blob:result,width:canvas.width,height:canvas.height};
 }finally{bitmap.close();canvas.width=canvas.height=0;}
}
