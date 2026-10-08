import {apiJson,csrfToken,ApiError} from './api';
import {recordFailure} from './diagnostics';
function retryDelay(ms:number,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{signal?.throwIfAborted();const abort=()=>{clearTimeout(timer);reject(signal?.reason);};const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);signal?.addEventListener('abort',abort,{once:true});});}
export async function uploadMedia<T>(projectId:string,file:File,progress:(message:string)=>void,signal?:AbortSignal):Promise<T>{
 signal?.throwIfAborted();
 const requestSignal=()=>signal?AbortSignal.any([signal,AbortSignal.timeout(300000)]):AbortSignal.timeout(300000);
 if(file.size>32*1024*1024){
  type Session={multipart:boolean;id:string;partSize:number;parts?:string[];projectId?:string};
  // Re-selecting the same file can resume confirmed parts, including after reload.
  const sample=new Uint8Array(await new Blob([file.slice(0,65536),file.slice(-65536)]).arrayBuffer());
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',sample))).map(v=>v.toString(16).padStart(2,'0')).join('');
  signal?.throwIfAborted();
  const key=`upload:${projectId}:${file.name}:${file.size}:${file.lastModified}:${digest}`;
  let session:Session|undefined;
  let saved:string|null=null;try{saved=sessionStorage.getItem(key);}catch{/* Storage can be disabled. */}
  if(saved){try{session=await apiJson<Session>(`/api/uploads/${saved}`,{signal});if(session.projectId!==projectId)session=undefined;}catch(error){if(!(error instanceof ApiError)||![404,410].includes(error.status))throw error;}}
  session??=await apiJson<Session>(`/api/projects/${projectId}/uploads`,{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file.name,contentType:file.type,size:file.size})});
  if(session.multipart)try{sessionStorage.setItem(key,session.id);}catch{/* Retry still works in this call. */}
  if(session.multipart){
   try{
    for(let offset=0,part=1;offset<file.size;offset+=session.partSize,part++){
     signal?.throwIfAborted();
     if(session.parts?.includes(String(part)))continue;
     const body=new FormData();body.append('file',file.slice(offset,offset+session.partSize),'part');
     let failure:unknown;
     for(let attempt=0;attempt<5;attempt++){try{await apiJson(`/api/uploads/${session.id}/parts/${part}`,{method:'POST',body,signal:requestSignal()});failure=undefined;break;}catch(error){signal?.throwIfAborted();failure=error;if(attempt<4)await retryDelay(500*(attempt+1),signal);}}
     if(failure)throw failure;
     progress(`Spremanje videa ${Math.round(Math.min(file.size,offset+session.partSize)/file.size*100)}% · nastavi uređivati`);
    }
    let completionError:unknown;
    for(let attempt=0;attempt<5;attempt++){try{const result=await apiJson<T>(`/api/uploads/${session.id}`,{method:'POST',signal:requestSignal()});try{sessionStorage.removeItem(key);}catch{/* optional storage */}return result;}catch(error){signal?.throwIfAborted();completionError=error;if(attempt<4)await retryDelay(500*(attempt+1),signal);}}
    throw completionError;
   }catch(error){signal?.throwIfAborted();throw new Error(`${error instanceof Error?error.message:'Prenos je prekinut.'} Ponovi spremanje: poslani dijelovi ostaju sačuvani 24 sata.`);}
  }
 }
 const body=new FormData();body.append('file',file);const token=await csrfToken();
 signal?.throwIfAborted();
 return new Promise<T>((resolve,reject)=>{const xhr=new XMLHttpRequest(),started=performance.now();xhr.open('POST',`/api/projects/${projectId}/assets`);xhr.setRequestHeader('X-CSRFToken',token);try{if(localStorage.getItem('edita-product-analytics')==='yes')xhr.setRequestHeader('X-Product-Analytics','1');}catch{/* optional */}xhr.responseType='json';xhr.timeout=30*60*1000;
  const abort=()=>xhr.abort();signal?.addEventListener('abort',abort,{once:true});
  xhr.onloadend=()=>signal?.removeEventListener('abort',abort);
  xhr.onabort=()=>reject(signal?.reason??new DOMException('Spremanje je prekinuto.','AbortError'));
  xhr.upload.onprogress=event=>{if(event.lengthComputable)progress(`Spremanje videa ${Math.round(event.loaded/event.total*100)}% · nastavi uređivati`);};
  xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300)resolve(xhr.response);else{recordFailure('/api/assets','upload',started,new Response(null,{status:xhr.status||502}));reject(new Error(xhr.response?.error||(xhr.status===413?'Video je prevelik za jedan prenos. Pokušaj ponovo nakon osvježavanja aplikacije.':`Spremanje nije uspjelo (${xhr.status}). Video ostaje otvoren lokalno.`)));}};
  xhr.onerror=()=>reject(new Error('Veza je prekinuta. Video ostaje otvoren lokalno.'));
  xhr.ontimeout=()=>reject(new Error('Spremanje je trajalo predugo. Video ostaje otvoren lokalno.'));xhr.send(body);
 });
}
