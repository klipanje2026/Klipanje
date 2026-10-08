import {trackProduct} from '../../lib/product-analytics';
import {guestDraftKey,finishGuestReturn} from '../../lib/guest-editor';
import {ProjectOpeningOverlay} from '../ProjectOpeningOverlay';
import {StudioIcon} from '../StudioIcon/StudioIcon';
import {useLoadingLeaveGuard} from '../../lib/use-loading-leave-guard';
import {allowEditorLeave} from '../EditorLeaveGuard';
import {saveEditorDraft,loadEditorDraft} from '../../lib/editor-draft';
import {uploadMedia} from '../../lib/media-upload';
import { ProjectErrorDialog } from '../ProjectErrorDialog';
import { collectLatestSnapshot, type ProjectSnapshot } from '../../lib/project-snapshot';
export type { ProjectSnapshot } from '../../lib/project-snapshot';
import {acknowledgeHandoff} from '../../lib/video-studio-handoff';
import { createPortal } from 'react-dom';
import { EditorHeaderPortal } from '../EditorHeaderPortal/EditorHeaderPortal';
import { rememberProject } from '../../lib/recent-projects';
import { useEffect, useLayoutEffect, useRef, useState, useImperativeHandle, type Ref } from 'react';
import { useAuth } from '../../context/auth-context';
import { ApiError, apiFetch, apiJson } from '../../lib/api';
import { cachedMedia, cacheMedia } from '../../lib/project-media-cache';

type Asset = { id: string; name: string; contentType: string; size: number; url: string; previewUrl?: string };
type Project = { updated_at?:string; id: string; name: string; workspace: string;
  state: { version?: number; data?: Record<string, unknown>; files?: { key: string; id: string }[] } };
export type ProjectSaveHandle = {save: () => Promise<boolean>};
type Props = { hasMedia:boolean; autoSaveKey?:string; backgroundFile?: File | null; onPreview?: (url: string) => void; saveHandle?: Ref<ProjectSaveHandle>; kind: 'subtitles' | 'video'; disabled?: boolean; compact?: boolean;
  snapshot: () => Promise<ProjectSnapshot>; restore: (data: Record<string, unknown>, files: Map<string, File>) => void | Promise<void> };

async function readProject(id: string, user: string, signal: AbortSignal) {
      const project = await apiJson<Project>(`/api/projects/${id}`, {signal});
      if (project.state.version !== 1 || !project.state.data || !Array.isArray(project.state.files)) throw new Error('Projekat još nema dovršeno spremanje.');
      const assets = await apiJson<{ assets: Asset[] }>(`/api/projects/${id}/assets`, {signal});
      const files = new Map<string, File>();
      const restored = new Map<string, { file: File; asset: Asset }>();
      const previewId = project.state.files.find(ref => ref.key === 'video')?.id;
      const preview = assets.assets.find(asset => asset.id === previewId);
      const previewBlob = preview ? await cachedMedia(user, `original:${preview.id}`) : null;
      signal.throwIfAborted();
      const pending = [...project.state.files];
      async function worker() {
        for (let ref = pending.shift(); ref; ref = pending.shift()) {
        const asset = assets.assets.find(item => item.id === ref.id);
        if (!asset) throw new Error('Jedna od datoteka projekta nedostaje.');
        let blob = asset.id === previewId ? previewBlob : await cachedMedia(user, `original:${asset.id}`);
        signal.throwIfAborted();
        if (!blob) {
          const response = await apiFetch(asset.url, {signal});
          if (!response.ok) throw new Error(`Nije moguće učitati ${asset.name}.`);
          blob = await response.blob();
          void cacheMedia(user, `original:${asset.id}`, blob);
        }
        const file = new File([blob], asset.name, { type: asset.contentType });
        files.set(ref.key, file); restored.set(ref.key, { file, asset });
        }
      }
      await Promise.all(Array.from({length:Math.min(3,pending.length)}, () => worker()));
      return { project, files, restored };
}

export function ProjectToolbar({ hasMedia, kind, disabled = false, compact = false, snapshot, restore, saveHandle, backgroundFile, autoSaveKey }: Props) {
  const { session } = useAuth();
  const userId=session.user?.id;
  const initialProject=useRef(new URLSearchParams(window.location.search).get('project'));
  const draftKey=()=>userId?`${userId}:${kind}:${currentRef.current?.id||initialProject.current||'unsaved'}`:guestDraftKey(kind);
  const [current, setCurrent] = useState<Project | null>(null);
  const currentRef=useRef<Project|null>(null);
  const [name, setName] = useState(kind === 'subtitles' ? 'Novi titlovi' : 'Novi projekat');
  const [busy, setBusy] = useState(false);
  const [opening,setOpening]=useState(()=>new URLSearchParams(window.location.search).has('project'));
  useLoadingLeaveGuard(opening);
  const saving = useRef(false);
  const saveController=useRef<AbortController|null>(null);
  const saveCancelled=useRef(false);
  const cancellationVersion=useRef(0);
  useEffect(()=>{saveCancelled.current=false;},[backgroundFile,hasMedia]);
  useEffect(()=>{
    const cancel=()=>{cancellationVersion.current++;saveCancelled.current=true;saveController.current?.abort();saving.current=false;pendingSave.current=null;setBusy(false);setMessage('');setBackgroundError('');};
    window.addEventListener('edita-cancel-save',cancel);
    return()=>{window.removeEventListener('edita-cancel-save',cancel);saveController.current?.abort();};
  },[]);
  const loadingProject = useRef(new URLSearchParams(window.location.search).has('project'));
  const pendingSave = useRef<Promise<boolean> | null>(null);
  const saveLatest = useRef<(copy?:boolean,background?:boolean)=>Promise<boolean>>(async()=>false);
  const snapshotLatest = useRef(snapshot);
  useLayoutEffect(()=>{snapshotLatest.current=snapshot;},[snapshot]);
  useEffect(()=>{
    if(!backgroundFile) return;
    let active=true;
    const timer=setTimeout(()=>{void (async()=>{
      if(pendingSave.current) await pendingSave.current;
      if(active) await saveLatest.current(false,true);
    })();},100);
    return()=>{active=false;clearTimeout(timer);};
  },[backgroundFile]);
  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(saving.current){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[]);
  useEffect(()=>{if(!autoSaveKey||disabled)return;const timer=setTimeout(()=>{void saveLatest.current(false,true);},2000);return()=>clearTimeout(timer);},[autoSaveKey,disabled]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [backgroundError,setBackgroundError]=useState('');
  const [errorTitle,setErrorTitle]=useState('Video nije moguće otvoriti');
  const uploaded = useRef(new Map<string, { file: File; asset: Asset }>());
  async function refresh() { window.dispatchEvent(new Event('projects-changed')); }
  useEffect(() => {
    const deleted = (event: Event) => {
      if (current?.id === (event as CustomEvent<string>).detail) { setCurrent(null); currentRef.current=null; uploaded.current.clear(); setMessage('Spremljena kopija je obrisana. Sadržaj editora je zadržan.'); }
    };
    window.addEventListener('project-deleted', deleted);
    return () => window.removeEventListener('project-deleted', deleted);
  }, [current]);
  useEffect(() => {
    if (!message || busy) return;
    const timer = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(timer);
  }, [message, busy]);
  const restoreRef = useRef(restore);

  useEffect(() => { restoreRef.current = restore; }, [restore]);
  useEffect(() => {
    const resume=new URLSearchParams(window.location.search).get('resumeGuest');
    if(resume&&/^[a-f0-9-]{36}$/.test(resume)){
      let active=true;loadingProject.current=true;setOpening(true);
      void loadEditorDraft(guestDraftKey(kind,resume)).then(async draft=>{
        if(!active)return;
        if(!draft)throw new Error('Lokalni video nije dostupan u ovom pregledniku. Nacrt otvori na uređaju na kojem si uređivao.');
        await restoreRef.current(draft.data,draft.files);
        if(!active)return;
        if(userId)await saveEditorDraft(`${userId}:${kind}:unsaved`,{data:draft.data,files:[...draft.files].map(([key,file])=>({key,file}))});
        if(!active)return;
        finishGuestReturn();const url=new URL(window.location.href);url.searchParams.delete('resumeGuest');window.history.replaceState(null,'',url);
        setMessage('Video i izmjene su vraćeni. Možeš preuzeti video.');
      }).catch(cause=>{if(active){finishGuestReturn();setError(cause instanceof Error?cause.message:'Vraćanje nije uspjelo.');}}).finally(()=>{if(active){loadingProject.current=false;setOpening(false);}});
      return()=>{active=false;};
    }
    const id = new URLSearchParams(window.location.search).get('project');
    // A fresh editor stays empty. Recover drafts only for an explicitly opened
    // project or the guest's return from login above.
    if (!id) return;
    let active = true;
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (!active) return;
      setOpening(true); setBusy(true); setMessage('Otvaranje projekta…');
      try {
        const { project, files, restored } = await readProject(id, String(userId), controller.signal);
        if (!active) return;
        const draft=await loadEditorDraft(`${userId}:${kind}:${id}`).catch(()=>undefined);
        if(!active)return;
        const recover=draft&&draft.savedAt>new Date(project.updated_at||0).getTime()&&draft.files.size>0;
        await restoreRef.current(recover?draft.data:project.state.data!,recover?draft.files:files);
        if (!active) return;
        loadingProject.current=false; uploaded.current = restored; currentRef.current=project; setCurrent(project); setName(project.name); setMessage(recover?'Vraćene su lokalno sačuvane izmjene.':'Projekat je otvoren.'); if (userId) rememberProject(userId, project.id);
      } catch (cause) { controller.abort(); if (active) { setErrorTitle('Video nije moguće otvoriti'); setError(cause instanceof ApiError && cause.status === 404 ? 'Odabrani video nije pronađen. Pokušaj dodati novi video sa svog uređaja.' : cause instanceof Error ? cause.message : 'Otvaranje nije uspjelo.'); setMessage(''); } }
      finally { if (active) { setBusy(false); setOpening(false); } }
    });
    return () => { active = false; controller.abort(); };
  }, [userId,kind]);
  useEffect(()=>{if(!autoSaveKey||loadingProject.current)return;const timer=setTimeout(()=>{void snapshotLatest.current().then(value=>saveEditorDraft(draftKey(),value)).catch(()=>setMessage('Lokalna sigurnosna kopija nije dostupna. Spremi projekat na server.'));},700);return()=>clearTimeout(timer);
  // The key follows this editor instance, not unrelated authentication refreshes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[autoSaveKey,userId,kind]);
  async function saveOnce(copy = false, background=false) {
    if (saving.current || loadingProject.current || disabled || saveCancelled.current) return false;
    const controller=new AbortController();saveController.current=controller;const {signal}=controller;
    saving.current = true;trackProduct("save_start");
    setBusy(true); setError('');setBackgroundError(''); setMessage('Spremanje projekta…');
    try {
      const backup=await snapshotLatest.current();
      signal.throwIfAborted();
      if(!userId){await saveEditorDraft(draftKey(),backup);signal.throwIfAborted();setMessage('Nacrt je sačuvan u ovom pregledniku.');return true;}
      await saveEditorDraft(draftKey(),backup).catch(()=>{});
      signal.throwIfAborted();
      let project = copy ? null : currentRef.current;
      if (!name.trim()) throw new Error('Upiši naziv projekta.');
      if (!project) {
        const workspace = session.workspaces[0];
        if (!workspace) throw new Error('Račun nema radni prostor. Administrator ga može dodati.');
        project = await apiJson<Project>('/api/projects', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), workspace: workspace.id, kind, state: {} }) });
        signal.throwIfAborted();uploaded.current.clear(); currentRef.current=project; setCurrent(project);
      }
      let didUpload=false;
      const state = await collectLatestSnapshot(async () => {signal.throwIfAborted();const value=await snapshotLatest.current();signal.throwIfAborted();return value;}, async source => {
        signal.throwIfAborted();
        let existing = uploaded.current.get(source.key);
        if (!existing || existing.file !== source.file) {
          setMessage(`Spremanje datoteke: ${source.file.name}`);
          const asset=await uploadMedia<Asset>(project.id,source.file,setMessage,signal);
          signal.throwIfAborted();
          didUpload=true;
          void cacheMedia(String(session.user?.id), `original:${asset.id}`, source.file);
          existing = { file: source.file, asset }; uploaded.current.set(source.key, existing);
        }
        return existing.asset.id;
      });
      signal.throwIfAborted();
      const updated = await apiJson<Project>(`/api/projects/${project.id}`, { method: 'PATCH', signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), state }) });
      signal.throwIfAborted();currentRef.current=updated; setCurrent(updated);
      const url=new URL(window.location.href);url.searchParams.set('project',updated.id);url.searchParams.delete('new');window.history.replaceState(null,'',url);
      if(session.user)void acknowledgeHandoff(session.user.id,kind).catch(()=>{});
      if(session.user){try{sessionStorage.setItem(`edita-session:${session.user.id}:${kind}`,updated.id);}catch{}}
      // Retain prior assets until project deletion; another open editor may still reference them.
      await refresh(); if (session.user) rememberProject(session.user.id, updated.id); setMessage('Projekat je spremljen.');trackProduct('save_success'); if(backgroundFile&&didUpload)window.dispatchEvent(new Event('edita-upload-complete')); return true;
    } catch (cause) { if(signal.aborted)return false;trackProduct("save_error");const detail=cause instanceof Error?cause.message:'Spremanje nije uspjelo.';if(background)setBackgroundError(detail);else {setErrorTitle('Spremanje nije završeno');setError(detail);}setMessage('');return false; }
    finally { if(saveController.current===controller){saving.current = false;setBusy(false);saveController.current=null;} }
  }
  function save(copy=false,background=false):Promise<boolean> {
    if(pendingSave.current) return pendingSave.current;
    if(!background)saveCancelled.current=false;
    const task=saveOnce(copy,background);pendingSave.current=task;
    void task.finally(()=>{if(pendingSave.current===task)pendingSave.current=null;});
    return task;
  }
  useEffect(()=>{saveLatest.current=save;});
  useImperativeHandle(saveHandle, () => ({save: async () => {
    const version=cancellationVersion.current;
    if(pendingSave.current) await pendingSave.current;
    if(version!==cancellationVersion.current)return false;
    return saveLatest.current();
  }}));
  const [feedbackTarget, setFeedbackTarget] = useState<Element | null>(null);
  useEffect(() => {
    let previous:Element|null=null;
    const update=()=>{
      const next=document.querySelector(kind==='subtitles'?'.subtitle-preview-panel':'.video-studio-main')||document.querySelector('.editor-outlet');
      if(next===previous)return;
      previous?.classList.remove('project-feedback-target');
      next?.classList.add('project-feedback-target');previous=next;setFeedbackTarget(next);
    };
    update();const observer=new MutationObserver(update);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>{observer.disconnect();previous?.classList.remove('project-feedback-target');};
  },[kind]);
  const locked = busy || disabled;
  const feedback = <>{backgroundError&&<span className="project-background-error" role="status">Spremanje na server čeka. Video ostaje otvoren.<button type="button" disabled={busy} title={backgroundError} onClick={()=>void save(false,true)}>Pokušaj ponovo</button></span>}{opening&&<ProjectOpeningOverlay kind={kind}/>}{message && <span className="project-feedback" role="status">{message}</span>}{error && <ProjectErrorDialog title={errorTitle} message={error} onClose={() => setError('')} />}</>;
  if (compact) return <section className="project-toolbar project-toolbar-compact" aria-label="Spremanje projekata">{feedbackTarget ? createPortal(<div className="project-feedback-position">{feedback}</div>, feedbackTarget) : feedback}</section>;
  return <EditorHeaderPortal><section className="project-toolbar" aria-label="Spremanje projekata">
    <label><span className="project-name-label">Naziv</span><input aria-label="Naziv projekta" value={name} maxLength={160} disabled={locked} onChange={event => { setName(event.target.value); setMessage(''); }} /></label>
    <EditorHeaderPortal slot="commands"><div className="project-toolbar project-toolbar-commands">
    <button disabled={locked} title={busy ? 'Spremanje…' : 'Spremi projekat'} aria-label={busy ? 'Spremanje…' : 'Spremi projekat'} onClick={() => void save()}><svg className="studio-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h12l4 4v14H3V3zM7 3v6h9V3M7 21v-8h10v8"/></svg><span className="project-action-label">{busy ? 'Spremanje…' : 'Spremi projekat'}</span></button>
    {(kind==='subtitles'?['subtitles','video']:['video','subtitles']).map(target=><button key={target} className="secondary project-copy" disabled={locked} title={target==='subtitles'?'Napravi novi titl':'Napravi novi edit'} aria-label={target==='subtitles'?'Napravi novi titl':'Napravi novi edit'} onClick={async()=>{if(pendingSave.current)await pendingSave.current;const state=await snapshotLatest.current();if((!current&&!state.files.length)||await saveLatest.current()){allowEditorLeave();window.location.assign(target==='video'?'/video-editor?new=1':'/titlovi?new=1');}}}><StudioIcon name={target==='subtitles'?'newCaptions':'newVideo'}/><span className="project-action-label">{target==='subtitles'?'Napravi novi titl':'Napravi novi edit'}</span></button>)}
    </div></EditorHeaderPortal>
    {feedbackTarget ? createPortal(<div className="project-feedback-position">{feedback}</div>, feedbackTarget) : feedback}
  </section></EditorHeaderPortal>;
}
