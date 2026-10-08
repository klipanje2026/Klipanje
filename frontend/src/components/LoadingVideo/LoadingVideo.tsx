import {useEditingPreview} from '../../lib/use-editing-preview';
import {useLoadingLeaveGuard} from '../../lib/use-loading-leave-guard';
import {needsAudioPreparation} from '../../lib/media-audio-compatibility';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject, type VideoHTMLAttributes } from 'react';
import { downloadDiagnostics, recordMediaFailure } from '../../lib/diagnostics';
import { prepareBrowserVideo, type VideoPreparationProgress } from '../../lib/prepare-browser-video';

type Props = VideoHTMLAttributes<HTMLVideoElement> & {editingPreview?:boolean;deferPreparation?:boolean;file: File | null; ref: RefObject<HTMLVideoElement | null>};
export function LoadingVideo({file, ref, src, onLoadedData, onError, deferPreparation=false, editingPreview=false, ...props}: Props) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useLoadingLeaveGuard(Boolean(src)&&!ready&&!error);
  const [preparedUrl, setPreparedUrl] = useState('');
  const preview=useEditingPreview(file,preparedUrl||src,ref,editingPreview);
  const [retry, setRetry] = useState(0);
  const [progress, setProgress] = useState<VideoPreparationProgress>({label:'Učitavanje videa',percent:null});
  const controller = useRef<AbortController | null>(null);
  const attempted = useRef(false);
  const resumeTime = useRef(0);
  const resumePlaying = useRef(false);
  useLayoutEffect(()=>{
    controller.current?.abort();controller.current=null;attempted.current=false;resumeTime.current=0;resumePlaying.current=false;
    setPreparedUrl('');setReady(false);setError('');setProgress({label:'Učitavanje videa',percent:null});
  },[file,src]);
  useEffect(() => {
    const media = ref.current;
    if (!media) return;
    const checkReady = () => {
      if (!media.error && media.readyState >= 2 && media.videoWidth > 0 && media.videoHeight > 0) {
        setReady(true); setError('');
        if(resumeTime.current>0){media.currentTime=Number.isFinite(media.duration)?Math.min(resumeTime.current,Math.max(0,media.duration-.01)):resumeTime.current;resumeTime.current=0;}
        if(resumePlaying.current){resumePlaying.current=false;void media.play().catch(()=>{});}
      }
    };
    const unavailable=()=>{setReady(false);};
    media.addEventListener('emptied',unavailable);
    media.addEventListener('error',unavailable);
    checkReady();
    media.addEventListener('canplay', checkReady);
    media.addEventListener('playing', checkReady);
    media.addEventListener('loadeddata', checkReady);
    media.addEventListener('resize', checkReady);
    return () => {
      media.removeEventListener('emptied',unavailable);media.removeEventListener('error',unavailable);
      media.removeEventListener('canplay', checkReady);
      media.removeEventListener('playing', checkReady);
      media.removeEventListener('loadeddata', checkReady);
      media.removeEventListener('resize', checkReady);
    };
  }, [ref, src, preparedUrl, retry]);
  // A paused native video can lose its composited frame when its viewport is
  // resized/minimized. Re-present that exact frame without reloading the source.
  useEffect(()=>{
    const media=ref.current;if(!media)return;
    let timer:ReturnType<typeof setTimeout>|undefined;
    let width=media.clientWidth,height=media.clientHeight;
    const repaint=()=>{
      if(timer)clearTimeout(timer);
      timer=setTimeout(()=>{
        if(document.hidden||!media.isConnected||media.clientWidth<=0||media.clientHeight<=0||
          !media.paused||media.seeking||media.readyState<2||media.error||!Number.isFinite(media.currentTime))return;
        // Assigning currentTime invokes the media seek algorithm even at the same
        // time; a CSS resize alone does not ask a paused decoder for a new frame.
        try{media.currentTime=media.currentTime;}catch{/* Source may be changing. */}
      },120);
    };
    const observer=new ResizeObserver(()=>{
      const nextWidth=media.clientWidth,nextHeight=media.clientHeight;
      if(nextWidth===width&&nextHeight===height)return;
      width=nextWidth;height=nextHeight;repaint();
    });
    observer.observe(media);
    document.addEventListener('visibilitychange',repaint);
    document.addEventListener('fullscreenchange',repaint);
    window.addEventListener('pageshow',repaint);
    return()=>{if(timer)clearTimeout(timer);observer.disconnect();document.removeEventListener('visibilitychange',repaint);document.removeEventListener('fullscreenchange',repaint);window.removeEventListener('pageshow',repaint);};
  },[ref,preview.src]);
  const prepare = useCallback(async () => {
    if (controller.current || attempted.current) return;
    if (!file) { setError('Pregled nije dostupan. Osvježi prikaz.'); return; }
    attempted.current = true;
    const media = ref.current;
    const keepPreview=!!media&&media.readyState>=2&&media.videoWidth>0&&!media.error;
    if (media) {
      if(!keepPreview)recordMediaFailure(media);
      resumeTime.current = Number.isFinite(media.currentTime) ? media.currentTime : resumeTime.current;
      resumePlaying.current=resumePlaying.current||!media.paused;
      if(!keepPreview)media.pause();
    }
    const task = new AbortController(); controller.current = task;
    if(!keepPreview)setReady(false); setError('');
    try {
      const result = await prepareBrowserVideo(file, task.signal, setProgress);
      if (!task.signal.aborted) { if(keepPreview&&ref.current){resumeTime.current=ref.current.currentTime;resumePlaying.current=!ref.current.paused;} setPreparedUrl(URL.createObjectURL(result)); setProgress({label:'Otvaranje videa',percent:null}); }
    } catch (cause) { if (!task.signal.aborted) setError(cause instanceof Error ? cause.message : 'Pregled nije uspio.'); }
    finally { if (controller.current === task) controller.current = null; }
  }, [file, ref]);
  useEffect(()=>{
    if(!file||preparedUrl)return;
    const task=new AbortController();
    void needsAudioPreparation(file,task.signal).then(needs=>{if(!task.signal.aborted&&needs)void prepare();}).catch(()=>{});
    return()=>task.abort();
  },[file,preparedUrl,prepare]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => () => { if (preparedUrl) URL.revokeObjectURL(preparedUrl); }, [preparedUrl]);
  useEffect(() => {
    if (ready || error) return;
    const timer = setTimeout(() => {
      if (ref.current && ref.current.readyState >= 2 && ref.current.videoWidth > 0) { setReady(true); setError(''); return; }
      if(deferPreparation && !controller.current){setError('Pregled se nije otvorio u ovom pregledniku. Pripremi kompatibilan pregled ili pokušaj ponovo.');return;}
      if (attempted.current && !controller.current) setError('Video nije moguće prikazati. Osvježi pregled.');
      else void prepare();
    }, file && file.size > 128*1024*1024 ? 120000 : 30000);
    return () => clearTimeout(timer);
  }, [ready, error, prepare, preparedUrl, retry, deferPreparation, ref, file]);
  function refresh() {
    controller.current?.abort(); controller.current = null;
    resumeTime.current=ref.current?.currentTime||0; resumePlaying.current=!!ref.current&&!ref.current.paused; attempted.current = false; setError(''); setReady(false);
    setProgress({label:'Učitavanje videa',percent:null});
    // Retry the already playable source immediately; conversion is only a fallback.
    // Keep an existing compatible preview instead of returning to an unsupported original.
    ref.current?.load();
    setRetry(value => value + 1);
  }
  return <>
    <video {...props} ref={ref} src={preview.src} preload="auto"
      onProgress={event => {
        const media = event.currentTarget;
        if (!controller.current && Number.isFinite(media.duration) && media.duration > 0 && media.buffered.length) {
          const percent = Math.min(100,Math.round(media.buffered.end(media.buffered.length-1)/media.duration*100));
          setProgress(percent === 100 ? {label:'Otvaranje slike videa',percent:null} : {label:'Učitavanje pregleda videa',percent});
        }
        props.onProgress?.(event);
      }}
      onLoadedData={event => { if (event.currentTarget.videoWidth > 0) {setReady(true); setError(''); if(resumeTime.current > 0) { event.currentTarget.currentTime=Math.min(resumeTime.current,Math.max(0,event.currentTarget.duration-.01)); resumeTime.current=0; }} onLoadedData?.(event); }}
      onError={event => { if(deferPreparation){setError('Preglednik ne može otvoriti ovaj video. Pripremi kompatibilan pregled; titlove možeš uređivati odmah.');onError?.(event);return;} if (attempted.current && !controller.current) setError('Pregled nije uspio. Osvježi prikaz.'); else void prepare(); onError?.(event); }}/>
    
    {!ready && <div className="edita-video-loading" role="status">
      {!error && <span className="workspace-loading-spinner"/>}
      <strong>{error || progress.label}</strong>
      {!error && progress.percent !== null && <><progress max="100" value={progress.percent}/><span>{progress.percent}%</span></>}
      
      {error && <button type="button" className="video-diagnostics" onClick={downloadDiagnostics}>Preuzmi dijagnostiku pregleda</button>}
      {!controller.current && <button onClick={refresh}>↻ Ponovo učitaj video</button>}
      {deferPreparation && file && error && !controller.current && <button onClick={() => { attempted.current = false; void prepare(); }}>Pripremi kompatibilan pregled</button>}
      {controller.current && <button onClick={() => { controller.current?.abort(); controller.current=null; setError('Učitavanje pregleda je prekinuto.'); }}>Prekini pregled</button>}
    </div>}
  </>;
}
