import {needsAudioPreparation} from '../../lib/media-audio-compatibility';
import { LanguageDropdown } from '../LanguageDropdown/LanguageDropdown';
import { prepareBrowserVideo } from '../../lib/prepare-browser-video';
import { useEffect, useRef, useState } from 'react';
import { StudioIcon } from '../StudioIcon/StudioIcon';
import { StudioPlayer } from '../StudioPlayer/StudioPlayer';
import { EditorHeaderPortal } from '../EditorHeaderPortal/EditorHeaderPortal';
import { saveVideoOnlyHandoff } from '../../lib/video-studio-handoff';
import { useAuth } from '../../context/auth-context';
type Props = { file: File | null; videoUrl: string; chooseFile: (file?: File) => void; onAnalyze: () => void; onDemo: () => void; language: string; setLanguage: (value: string) => void; languages: {value: string; label: string}[]; onMetadata: (video: HTMLVideoElement) => void; error: string };
export function WorkspaceUpload({ file, videoUrl, chooseFile, onAnalyze, onDemo, language, setLanguage, languages, onMetadata, error }: Props) {
  const { session } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [transferring, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [needsPreparation, setNeedsPreparation] = useState(false);
  const attempted = useRef<File | null>(null);
  const preparationController = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const [stopped, setStopped] = useState(false);
  const [progress, setProgress] = useState<{label:string;percent:number|null}>({label:'Učitavanje videa',percent:null});
  const busy = transferring || preparing;
  const [transferError, setTransferError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [aspect, setAspect] = useState(16 / 9);
  const [repeat, setRepeat] = useState(false);
  const [ready, setReady] = useState(false);
  const loading = Boolean(file && !ready && !previewError && !stopped);
  useEffect(()=>{if(!file||stopped||attempted.current===file)return;const task=new AbortController();void needsAudioPreparation(file,task.signal).then(needs=>{if(needs&&!task.signal.aborted)setNeedsPreparation(true);}).catch(()=>{});return()=>task.abort();},[file,stopped]);
  function cancelLoading() {
    stoppedRef.current = true; setStopped(true);
    preparationController.current?.abort();
    setPreparing(false); setNeedsPreparation(false); setPlaying(false); setReady(false);
    video.current?.pause(); video.current?.removeAttribute('src'); video.current?.load();
  }
  useEffect(() => {
    if (!loading && !preparing) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const leave = () => preparationController.current?.abort();
    const approve = () => {window.removeEventListener('beforeunload',warn);leave();};
    const followLink = (event: MouseEvent) => {
      if(event.defaultPrevented)return;
      const link = (event.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0 || link.href === location.href) return;
      if (!window.confirm('Učitavanje videa će se prekinuti ako napustiš editor. Želiš li izaći?')) { event.preventDefault(); event.stopPropagation(); }
      else { window.removeEventListener('beforeunload', warn); leave(); }
    };
    window.addEventListener('beforeunload', warn); window.addEventListener('pagehide', leave);window.addEventListener('edita-leave-approved',approve);
    document.addEventListener('click', followLink, true);
    return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener('pagehide', leave);window.removeEventListener('edita-leave-approved',approve); document.removeEventListener('click', followLink, true); };
  }, [loading, preparing]);
  useEffect(() => {
    if (!file || ready || stopped || previewError || preparing || needsPreparation) return;
    const timeout = window.setTimeout(() => {
      if (attempted.current === file) setPreviewError('Pregled nije moguće otvoriti. Pokušaj ponovo ili odaberi drugi video.');
      else setNeedsPreparation(true);
    }, 12000);
    return () => window.clearTimeout(timeout);
  }, [file, ready, stopped, previewError, preparing, needsPreparation]);
  useEffect(() => {
    if (!needsPreparation || !file || attempted.current === file) return;
    const controller = new AbortController();
    preparationController.current = controller;
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      attempted.current = file; setPreparing(true); setPreviewError('');
      try {
        const compatible = await prepareBrowserVideo(file, controller.signal, value => { if (!controller.signal.aborted) setProgress(value); });
        if (controller.signal.aborted) return;
        attempted.current = compatible; setPreparing(false); setNeedsPreparation(false); setReady(false); setTime(0); setProgress({label:'Otvaranje videa',percent:null}); chooseFile(compatible);
      } catch (cause) { if (!controller.signal.aborted) { setPreparing(false); setNeedsPreparation(false); setPreviewError(cause instanceof Error ? cause.message : 'Priprema videa nije uspjela.'); } }
    });
    return () => controller.abort();
  }, [needsPreparation, file, chooseFile]);
  function requestPreparation() {
    if (stoppedRef.current || preparing || needsPreparation) return;
    if (file && attempted.current === file) { setPreviewError('Prikaz ove datoteke nije uspio. Promijeni video ili pokušaj ponovo.'); return; }
    setNeedsPreparation(true);
  }
  function selectFile(next?: File) {
    if (!next || busy) return;
    if (!next.type.startsWith("video/")) { chooseFile(next); return; }
    stoppedRef.current = false; setStopped(false); setProgress({label:'Učitavanje videa',percent:null});
    video.current?.pause(); setPlaying(false); setTime(0); setReady(false); setPreviewError(''); setTransferError(''); setNeedsPreparation(false); attempted.current = null; chooseFile(next);
  }
  async function toggle() {
    const media = video.current; if (!media || !ready) return;
    if (!media.paused) { media.pause(); return; }
    try { if (media.ended) media.currentTime = 0; await media.play(); }
    catch { requestPreparation(); }
  }
  async function transfer() {
    if (busy || loading || stopped) return;
    if (!file) { window.location.assign('/video-editor?handoff=1'); return; }
    setBusy(true); setTransferError(''); video.current?.pause();
    try {
      await saveVideoOnlyHandoff(session.user?.id??0, file); window.location.assign('/video-editor?handoff=1');
    } catch { setTransferError('Video nije moguće prenijeti. Pokušaj ponovo.'); setBusy(false); }
  }
  return <section className={`workspace-upload${file ? "" : " is-empty"}`}>
    <EditorHeaderPortal slot="action"><button disabled={busy || loading || stopped} onClick={() => void transfer()}><StudioIcon name="video"/>Prebaci na video editor<StudioIcon name="arrow"/></button></EditorHeaderPortal>
    {!file && <div className="workspace-upload-heading"><h1>Dodaj video.<br/><span>Uredi svoje titlove.</span></h1></div>}
    <div className="workspace-upload-language"><LanguageDropdown label="Jezik govora i titlova" value={language} onChange={setLanguage} options={languages} disabled={busy}/><small>Odaberi jezik prije dodavanja videa.</small></div>
    <div className="workspace-upload-canvas">
      <StudioPlayer playing={playing} enabled={ready} time={time} duration={duration} repeat={repeat} onRepeat={() => setRepeat(value => !value)} onToggle={() => void toggle()} onSeek={value => { if (video.current) { video.current.currentTime = value; setTime(value); } }} onAdd={() => input.current?.click()} onDrop={files => selectFile(files[0])} hasMedia={Boolean(videoUrl)} busy={busy} aspect={aspect} addLabel="Promijeni video"
        emptyContent={<div className="studio-player-empty workspace-upload-empty"><span className="studio-player-upload-icon"><StudioIcon name="captions"/></span><h2>Ubaci video ovdje</h2><p>Prevuci video ili ga odaberi sa svog uređaja.<br/>Automatski titlovi koriste tvoj ElevenLabs račun.<br/>Projekti i datoteke čuvaju se lokalno.</p><button onClick={() => input.current?.click()}>Ubaci video <StudioIcon name="arrow"/></button><small>MP4, MOV, WebM</small></div>}>
        {videoUrl && <video ref={video} key={videoUrl} className="active" src={videoUrl} playsInline preload="auto" loop={repeat}
          onLoadedMetadata={event => { if (stoppedRef.current) return; const media = event.currentTarget; setTime(0); setPlaying(false); setDuration(Number.isFinite(media.duration) ? media.duration : 0); setAspect(media.videoWidth > 0 ? media.videoWidth / Math.max(1,media.videoHeight) : 16/9); onMetadata(media); }}
          onLoadedData={event => { if (!stoppedRef.current && event.currentTarget.videoWidth > 0) { setReady(true); setPreviewError(''); } }} onTimeUpdate={event => setTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setReady(false); setPlaying(false); requestPreparation(); }}/>}
        {(loading || preparing) && <div className="workspace-loading-overlay" role="status" aria-live="polite"><span className="workspace-loading-spinner"/><strong>{progress.label}</strong>{progress.percent !== null ? <><progress max="100" value={progress.percent} aria-label={progress.label}/><span>{progress.percent}%</span></> : <small>Molimo sačekaj. Priprema većeg videa može potrajati.</small>}<button onClick={cancelLoading}>Prekini učitavanje</button></div>}
        {stopped && <div className="workspace-loading-overlay"><strong>Učitavanje je prekinuto</strong><p>Možeš odabrati drugi video.</p><button onClick={() => input.current?.click()}>Ubaci video</button></div>}
        {ready && file && !busy && !playing && <button className="workspace-video-captions" onClick={onAnalyze}><StudioIcon name="captions"/>Dodaj titlove<StudioIcon name="arrow"/></button>}
      </StudioPlayer>
      <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm" hidden disabled={busy} onChange={event => { selectFile(event.target.files?.[0]); event.target.value = ''; }}/>
      <div className="workspace-upload-below"><div className="workspace-upload-file"><StudioIcon name="video"/><span>{file ? file.name : 'Tvoj video, tvoje riječi.'}<small>{ready ? 'Spreman za sljedeći korak' : !file ? 'Prvo odaberi video za titlove.' : ''}</small></span></div><button className="workspace-continue" disabled={!file || busy || !ready} onClick={() => { video.current?.pause(); onAnalyze(); }}><StudioIcon name="captions"/>Dodaj titlove<StudioIcon name="arrow"/></button></div>
    </div>
    {(error || transferError || previewError) && <p className="workspace-upload-error" role="alert">{error || transferError || previewError}{previewError && file && !preparing && <button onClick={() => { attempted.current = null; setPreviewError(''); setNeedsPreparation(true); }}>Pripremi video ponovo</button>}</p>}
    <div className="workspace-upload-bottom"><span>Klipanje · lokalni editor</span><button disabled={busy || loading} onClick={onDemo}>Otvori primjer <StudioIcon name="arrow"/></button></div>
  </section>;
}
