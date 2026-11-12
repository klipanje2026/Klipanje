type TransferJob = {id:string;title:string;video_url:string|null};
export function transferToKlipanje(job:TransferJob):Promise<void>{
 return new Promise((resolve,reject)=>{
  const origin='http://127.0.0.1:5175';
  let target:Window|null=null, file:File|null=null, ready=false;
  const send=()=>{if(ready&&file)target?.postMessage({type:'klipanje-media',file},origin);};
  const clean=()=>{clearTimeout(timer);window.removeEventListener('message',receive);};
  const receive=(event:MessageEvent)=>{
   if(event.origin!==origin||event.source!==target)return;
   if(event.data?.type==='klipanje-ready'){ready=true;send();}
   if(event.data?.type==='klipanje-received'){clean();resolve();}
  };
  const timer=setTimeout(()=>{clean();reject(new Error('Prijenos nije potvrđen. Prijavi se u Klipanje pa pokušaj ponovo.'));},120000);
  window.addEventListener('message',receive);
  target=window.open(origin+'/lokalni-uvoz','_blank');
  if(!target){clean();reject(new Error('Preglednik je blokirao otvaranje Klipanja. Dopusti novi tab za ovu aplikaciju.'));return;}
  if(!job.video_url){clean();reject(new Error('Video još nije završen.'));return;}
  const url=new URL(job.video_url,location.origin);
  if(url.origin!==location.origin||(!url.pathname.startsWith('/media/')&&!/^\/api\/creative\/videos\/[0-9a-f-]+\/$/.test(url.pathname))){clean();reject(new Error('Nepodržana adresa videa.'));return;}
  fetch(url).then(r=>{if(!r.ok)throw new Error('Video nije dostupan.');return r.blob();}).then(blob=>{
   file=new File([blob],(job.title.replace(/[\\/:*?"<>|]/g,'-')||job.id)+'.mp4',{type:'video/mp4'});send();
  }).catch(e=>{clean();reject(e);});
 });
}
