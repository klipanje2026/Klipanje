const storageKey='edita-beta-notice:dismissed';
const legacyKeys=['settings','text','elements','filters','transitions'].map(section=>`edita-beta-notice:${section}`);
const listeners=new Set<()=>void>();
let dismissedInSession=false;

export function isBetaNoticeDismissed():boolean {
 if(dismissedInSession)return true;
 try {
  return localStorage.getItem(storageKey)==='1'||legacyKeys.some(key=>localStorage.getItem(key)==='1');
 } catch { return false; }
}

export function dismissBetaNotice():void {
 dismissedInSession=true;
 try { localStorage.setItem(storageKey,'1'); } catch { /* Keep dismissed for this session when storage is unavailable. */ }
 listeners.forEach(listener=>listener());
}

export function subscribeBetaNotice(listener:()=>void):()=>void {
 listeners.add(listener);
 const onStorage=(event:StorageEvent)=>{
  if(event.key===storageKey||legacyKeys.includes(event.key||'')) {
   if(event.newValue==='1')dismissedInSession=true;
   listener();
  }
 };
 window.addEventListener('storage',onStorage);
 return()=>{listeners.delete(listener);window.removeEventListener('storage',onStorage);};
}
