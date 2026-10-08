import {saveEditorDraft} from './editor-draft';
import type {ProjectSnapshot} from './project-snapshot';
import {allowEditorLeave} from '../components/EditorLeaveGuard';
const returnKey='edita-guest-return';
export function guestDraftId(){let id=sessionStorage.getItem('edita-guest-draft');if(!id){id=crypto.randomUUID();sessionStorage.setItem('edita-guest-draft',id);}return id;}
export const guestDraftKey=(kind:string,id=guestDraftId())=>`guest:${id}:${kind}`;
export function guestReturn(){try{const path=sessionStorage.getItem(returnKey);return path&&/^\/(titlovi|video-editor)\?/.test(path)?path:null;}catch{return null;}}
export function finishGuestReturn(){sessionStorage.removeItem(returnKey);}
export async function loginForDownload(kind:'subtitles'|'video',snapshot:()=>Promise<ProjectSnapshot>){
 const id=guestDraftId(),value=await snapshot();
 if(!value.files.length)throw new Error('Dodaj video prije preuzimanja.');
 await saveEditorDraft(guestDraftKey(kind,id),value);
 const target=new URL(kind==='subtitles'?'/titlovi':'/video-editor',location.origin);target.searchParams.set('resumeGuest',id);
 const path=target.pathname+target.search;sessionStorage.setItem(returnKey,path);
 // Back from login must reopen this exact draft, not re-import the initial upload.
 history.replaceState(null,'',path);
 allowEditorLeave();location.assign('/login?download=1&next='+encodeURIComponent(path));
}
