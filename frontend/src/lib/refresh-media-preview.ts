/** Reload only the decoder, with bounded listeners and no project/page reload. */
export function refreshMediaPreview(media:HTMLMediaElement,time:number,signal:AbortSignal):Promise<void>{
 return new Promise((resolve,reject)=>{
  let positioned=false,finished=false;
  const finish=(error?:Error)=>{if(finished)return;finished=true;clearTimeout(timer);for(const event of ['loadedmetadata','canplay','seeked'])media.removeEventListener(event,ready);media.removeEventListener('error',failed);signal.removeEventListener('abort',aborted);if(error)reject(error);else resolve();};
  const failed=()=>finish(new Error('Medij nije moguće učitati. Provjeri izvornu datoteku.'));
  const aborted=()=>finish(new DOMException('Prekinuto','AbortError'));
  const ready=()=>{if(media.readyState<1)return;if(!positioned){positioned=true;media.currentTime=Math.max(0,Math.min(time,Number.isFinite(media.duration)?Math.max(0,media.duration-.001):time));}if(!media.seeking&&media.readyState>=2)finish();};
  const timer=setTimeout(()=>finish(new Error('Priprema pregleda traje predugo. Montaža je sačuvana u editoru; pokušaj ponovo.')),15000);
  if(signal.aborted){aborted();return;}
  signal.addEventListener('abort',aborted,{once:true});media.addEventListener('error',failed,{once:true});
  for(const event of ['loadedmetadata','canplay','seeked'])media.addEventListener(event,ready);
  try{media.pause();media.preload='auto';media.load();ready();}catch(error){finish(error instanceof Error?error:new Error(String(error)));}
 });
}
