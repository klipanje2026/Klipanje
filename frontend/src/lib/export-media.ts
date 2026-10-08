export function loadExportMedia(media:HTMLMediaElement,url:string,timeoutMs=60000):Promise<void>{
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);media.removeEventListener('loadeddata',ready);media.removeEventListener('error',failed);};
  const ready=()=>{cleanup();resolve();};const failed=()=>{cleanup();reject(new Error('Izvorni snimak nije moguće pripremiti za izvoz. Izmjene ostaju sačuvane.'));};
  const timer=setTimeout(()=>{cleanup();reject(new Error('Učitavanje videa za izvoz je isteklo. Pokušaj ponovo.'));},timeoutMs);
  media.addEventListener('loadeddata',ready);media.addEventListener('error',failed);media.src=url;media.preload='auto';media.load();
 });
}
