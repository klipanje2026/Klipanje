import {localMediaLanes} from '../../lib/local-media-lanes';
import {localTimelineDuration,timelineClock,extendTimelineRequest,timelineZoomMaximum} from '../../lib/timeline-duration';
import {LocalVideoStorage} from '../../components/LocalVideoStorage';
import {LocalEditorTools,scriptCaptions} from '../../components/LocalEditorTools';
import {StillSceneLayer,drawStillScene,type StillMotion} from '../../lib/still-scenes';
import type {Script} from '../../lib/production';
import {useTimelineHeight} from '../../lib/use-timeline-height';
import {trackProduct,trackExportStyles} from '../../lib/product-analytics';
import {loginForDownload} from '../../lib/guest-editor';
import {PreviewQualityPicker} from '../../components/PreviewQualityPicker';
import {splitCaptionAt,mergeCaptionWithNext} from '../../lib/caption-timing';
import {EditingVideo} from '../../components/EditingVideo';
import {useMediaFrameRate,adjacentFrameTime} from '../../lib/media-frame-step';
import {useLoadingLeaveGuard} from '../../lib/use-loading-leave-guard';
import {customFormats,socialFormats} from '../../config/platform-formats';
import {captionNeedsPerson} from '../../lib/caption-word-roles';
import {captionSounds} from '../../lib/caption-sounds';
import {useCaptionSounds} from '../../lib/use-caption-sounds';
import {needsAudioPreparation} from '../../lib/media-audio-compatibility';
import {glassVideoTransform} from '../../lib/dynamic-glass';
import {deleteCaptionGroup} from '../../lib/caption-selection';
import {ExportOptionsDialog,type ExportOptions} from '../../components/ExportOptionsDialog';
import {captionFamilyScope,editableCaptionSegments,preserveSuggestionRemoval} from '../../lib/caption-selection';
import {BetaNotice} from '../../components/BetaNotice';
import {rememberExport,restoreExport} from '../../lib/export-project';
import {offlineExport} from '../../lib/offline-export';
import {PlatformPreview} from '../../components/PlatformPreview';
import {ExportProgressDialog} from '../../components/ExportProgressDialog';
import {useCaptionShortcuts} from '../../lib/use-caption-shortcuts';
import {CaptionTimeline} from '../../components/CaptionTimeline/CaptionTimeline';
import {CleanAudioPanel} from '../../components/CleanAudioPanel';
import {suggestTopics} from '../../components/TranscriptTopicsPanel';
import {installPlaybackShortcut} from '../../lib/playback-shortcut';
import {SceneEffectsPanel} from '../../components/SceneEffectsPanel';
import {sceneEffectStyle,drawSceneEffects,type SceneEffects} from '../../lib/scene-effects';
import {loadOverlayFonts} from '../../lib/text-fonts';
import {OverlayLibrary} from '../../components/OverlayLibrary';
import {VideoOverlayLayer} from '../../components/VideoOverlayLayer';
import {createOverlay,drawOverlays,restoreOverlays,type Overlay,type OverlayPreset} from '../../lib/video-overlays';
import {setMediaGain} from '../../lib/media-gain';
import {VideoBackgroundLayer} from '../../components/VideoBackgroundLayer';
import {backgrounds,drawVideoBackground} from '../../lib/video-background';
import {VideoVoicePanel} from '../../components/VideoVoicePanel';
import {apiFetch, csrfToken} from '../../lib/api';
import {transcriptionBody, uploadForTranscript, alignTranscriptWords} from '../../lib/transcription-client';
import {wordsToSegments} from '../../lib/transcript-segments';
import {DEFAULT_CAPTION_SETTINGS} from '../../config/captions/presets';
import {LanguageDropdown} from '../../components/LanguageDropdown/LanguageDropdown';
import { AudioVolumeHandle } from "../../components/AudioVolumeHandle";
import { TrackHeightHandle } from '../../components/TrackHeightHandle';
import { EditorLeaveGuard } from '../../components/EditorLeaveGuard';
import { timelineTrackOrder, moveTimelineTrack } from '../../lib/timeline-track-order';
import { TrackGrip } from '../../components/TrackGrip';
import { linkLegacyClips, linkedTo, updateLinked, splitLinked } from '../../lib/linked-clips';

import {PanelResize} from '../../components/PanelResize';
import {AudioWaveform} from '../../components/AudioWaveform';
import { VideoCaptionLayer, drawVideoCaptions } from '../../components/VideoCaptionLayer';
import { VideoCaptionEditor } from '../../components/VideoCaptionEditor';
import { applyTimelineCaptionEdit, timelineCaptions, type VideoCaptions } from '../../lib/video-captions';
import { preparePersonMask } from '../../lib/person-mask';
import { useEditorHistory } from '../../lib/use-editor-history';
import { videoRect, rulerTicks, anchorZoom, clampPlayhead, advancePlayhead, clipAtPlayhead, type VideoTransform } from '../../lib/video-layout';
import { VideoThumbnails } from '../../components/VideoThumbnails';
import { checkExportQuota } from '../../lib/export-quota';
import { prepareBrowserVideo } from "../../lib/prepare-browser-video";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StudioPlayer } from "../../components/StudioPlayer/StudioPlayer";
import { StudioIcon } from "../../components/StudioIcon/StudioIcon";
import { loadVideoStudioHandoff } from "../../lib/video-studio-handoff";
import { ProjectToolbar, type ProjectSnapshot, type ProjectSaveHandle } from '../../components/ProjectToolbar/ProjectToolbar';
import {EditorHeaderPortal} from '../../components/EditorHeaderPortal/EditorHeaderPortal';
import { useAuth } from '../../context/auth-context';

type Asset = { id: string; name: string; type: "video" | "audio" | "image"; url: string; file: File; duration: number; aspectRatio: number };
type Clip = VideoTransform & SceneEffects & StillMotion & { audioRole?:'narration'|'sound'; background?:string; groupId?: string; id: string; assetId: string; name: string; type: "video" | "audio"; start: number; inPoint: number; outPoint: number; volume: number; muted: boolean; layer: number };

function restoreSceneDefaults(value:unknown):StillMotion {
 const v=value&&typeof value==='object'?value as StillMotion:{};
 return {motion:['none','zoom-in','zoom-out','pan','shake'].includes(v.motion||'')?v.motion:'none',imageTransition:['cut','crossfade','fade','slide','slide-left','slide-right','slide-up','slide-down'].includes(v.imageTransition||'')?v.imageTransition:'cut',imageTransitionDuration:typeof v.imageTransitionDuration==='number'&&Number.isFinite(v.imageTransitionDuration)?Math.max(.1,Math.min(3,v.imageTransitionDuration)):.5};
}
function clipLength(clip: Clip) { return Math.max(.1, clip.outPoint - clip.inPoint); }
function timeLabel(value: number) { const minute = Math.floor(value / 60); const second = Math.floor(value % 60).toString().padStart(2, "0"); return `${minute}:${second}`; }

async function readMetadata(file: File, url: string, signal: AbortSignal) {
  const media = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
  return new Promise<{ duration: number; aspectRatio: number }>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); media.onloadeddata=null; media.onerror=null; media.removeAttribute('src'); media.load(); };
    const fail = () => { cleanup(); reject(new Error('Video nema sliku koju preglednik može prikazati.')); };
    const abort = () => { cleanup(); reject(new DOMException('Učitavanje prekinuto','AbortError')); };
    const timer = setTimeout(fail,120000);
    media.onloadeddata = () => {
      if (!Number.isFinite(media.duration) || media.duration <= 0 || (media instanceof HTMLVideoElement && !media.videoWidth)) { fail(); return; }
      const result = {duration:media.duration,aspectRatio:media instanceof HTMLVideoElement ? media.videoWidth/media.videoHeight : 16/9};
      cleanup(); resolve(result);
    };
    media.onerror=fail; signal.addEventListener('abort',abort,{once:true});
    if (signal.aborted) { abort(); return; }
    media.preload='auto'; media.src=url;
  });
}
async function loadAsset(file: File, signal: AbortSignal, progress: (message:string)=>void): Promise<Asset> {
  if(file.type.startsWith('image/')){const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();signal.throwIfAborted();return {id:crypto.randomUUID(),name:file.name,type:'image',file,url,duration:5,aspectRatio:image.naturalWidth/image.naturalHeight};}catch(e){URL.revokeObjectURL(url);throw e;}}
  let playable=file, url=URL.createObjectURL(file);
  try {
    let metadata;
    try { metadata=await readMetadata(file,url,signal);if(file.type.startsWith('video/')&&await needsAudioPreparation(file,signal))throw new Error('Zvuk zahtijeva kompatibilnu kopiju.'); }
    catch (cause) {
      signal.throwIfAborted();
      if (!file.type.startsWith('video/')) throw cause;
      URL.revokeObjectURL(url);
      playable=await prepareBrowserVideo(file,signal,status=>progress(`${status.label}${status.percent === null ? '' : ` · ${status.percent}%`}`));
      url=URL.createObjectURL(playable); metadata=await readMetadata(playable,url,signal);
    }
    return {id:crypto.randomUUID(),name:file.name,type:file.type.startsWith('video/')?'video':'audio',file:playable,url,...metadata};
  } catch(cause) { URL.revokeObjectURL(url); throw cause; }
}

export function VideoStudio({localScript,registerSave}:{localScript?:Script;registerSave?:(save:()=>Promise<boolean>)=>void}={}) {
  const { session } = useAuth();
  const saveHandle = useRef<ProjectSaveHandle>(null);
  useEffect(()=>{registerSave?.(()=>saveHandle.current?.save()??Promise.resolve(false));},[registerSave]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; clipStart: number; width: number; duration:number; startY:number; layer:number; type:Clip["type"]; targetLayer?:number } | null>(null);
  const mediaRefs = useRef(new Map<string, HTMLMediaElement>());


  const playheadRef = useRef(0);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stillImages,setStillImages]=useState<Map<string,HTMLImageElement>>(new Map());
  useEffect(()=>{let active=true;const images=new Map<string,HTMLImageElement>();void Promise.all(assets.filter(a=>a.type==='image').map(a=>new Promise<void>(resolve=>{const image=new Image();image.onload=()=>{images.set(a.id,image);resolve();};image.onerror=()=>resolve();image.src=a.url;}))).then(()=>{if(active)setStillImages(images);});return()=>{active=false;};},[assets]);
  const history = useEditorHistory<{clips:Clip[];frameAspect:number;timelineFloor:number;sceneDefaults:StillMotion;captions:Record<string,VideoCaptions>;overlays:Overlay[]}>({clips:[],frameAspect:0,timelineFloor:0,sceneDefaults:{motion:'none',imageTransition:'cut',imageTransitionDuration:.5},captions:localScript?{__script:scriptCaptions(localScript)}:{},overlays:[]});
  const {clips,frameAspect,timelineFloor,sceneDefaults,captions:storedCaptions,overlays}=history.value;
  const sceneDefaultsRef=useRef(sceneDefaults);sceneDefaultsRef.current=sceneDefaults;
  const prepareCaptions=(docs:Record<string,VideoCaptions>)=>Object.fromEntries(Object.entries(docs).map(([id,d])=>[id,{...d,segments:editableCaptionSegments(d.segments,d.activeStyle,d.captionSettings)}]));
  const captions=prepareCaptions(storedCaptions);
  const [selectedOverlay,setSelectedOverlay]=useState('');
  const setOverlays=(action:React.SetStateAction<Overlay[]>)=>history.set(current=>{const next=typeof action==='function'?action(current.overlays):action;return {...current,overlays:next,timelineFloor:localScript?extendTimelineRequest(Math.max(0,...current.overlays.map(o=>o.end)),Math.max(0,...next.map(o=>o.end)),current.timelineFloor):current.timelineFloor};});
  const changeOverlay=(item:Overlay)=>setOverlays(current=>current.map(o=>o.id===item.id?item:o));
  function selectOverlay(id:string){if(localScript)setTimingCaption(null);setSelectedOverlay(id);setSelectedId('');setPlaying(false);const item=overlays.find(o=>o.id===id);if(item){setPanel(item.kind==='text'?'text':'elements');seek(Math.min(item.end-.001,item.start+(item.animationDuration||.6)));}}
  function addOverlay(preset:OverlayPreset){if(localScript)setTimingCaption(null);const item=createOverlay(preset,playhead,timelineDuration);if(['circle','square','heart','star'].includes(preset.id))item.height=Math.min(100,item.width*previewAspect);setOverlays(current=>[...current,item]);setSelectedOverlay(item.id);setSelectedId('');setPlaying(false);seek(Math.min(item.end-.001,item.start+(item.animationDuration||.6)));}
  function removeOverlay(){setOverlays(current=>current.filter(o=>o.id!==selectedOverlay));setSelectedOverlay('');}
  function orderOverlay(direction:number){setOverlays(current=>{const next=[...current],i=next.findIndex(o=>o.id===selectedOverlay),j=i+direction;if(i>=0&&j>=0&&j<next.length)[next[i],next[j]]=[next[j],next[i]];return next;});}

  const setCaptions=(action:React.SetStateAction<Record<string,VideoCaptions>>)=>history.set(current=>{const before=prepareCaptions(current.captions),next=typeof action==='function'?action(before):action;return {...current,timelineFloor:localScript?extendTimelineRequest(Math.max(0,...(before.__script?.segments||[]).map(s=>s.end)),Math.max(0,...(next.__script?.segments||[]).map(s=>s.end)),current.timelineFloor):current.timelineFloor,captions:Object.fromEntries(Object.entries(next).map(([id,d])=>[id,{...d,segments:preserveSuggestionRemoval(before[id]?.segments||[],d.segments)}]))};});
  const setClips=(action:React.SetStateAction<Clip[]>)=>history.set(current=>{const next=typeof action==='function'?action(current.clips):action;return {...current,clips:next,timelineFloor:localScript?extendTimelineRequest(Math.max(0,...current.clips.map(c=>c.start+clipLength(c))),Math.max(0,...next.map(c=>c.start+clipLength(c))),current.timelineFloor):current.timelineFloor};});
  const setFrameAspect=(value:number)=>history.set(current=>({...current,frameAspect:value}));
  const [panel,setPanel]=useState<'sounds'|'effects'|'start'|'media'|'scripts'|'settings'|'audio'|'captions'|'text'|'elements'|'filters'|'transitions'|null>('media');
  useEffect(()=>{if(panel)trackProduct('section_view',{section:panel});},[panel]);
  const [tool,setTool]=useState<'select'|'hand'>('select');
  const [pan,setPan]=useState({x:0,y:0});
  const panDrag=useRef<{x:number;y:number;cx:number;cy:number}|null>(null);
  const [ratioOpen,setRatioOpen]=useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [captionEditRequest,setCaptionEditRequest]=useState(0);
  const [cleanAudioRequest,setCleanAudioRequest]=useState(0);
  const [zoom, setZoom] = useState(100);
  const [timelineScroll,setTimelineScroll]=useState(0),zoomLimit=useRef(800);
  const stageRef = useRef<HTMLElement>(null);
  const [timelineHidden,setTimelineHidden] = useState(false);
  const [trackOrder,setTrackOrder]=useState<string[]>([]);
  const [timelineHeight,setTimelineHeight,timelineMaximum]=useTimelineHeight(220,150,'.video-studio-workspace');
  const [mediaTrackHeight,setMediaTrackHeight]=useState(52);
  const timelineResize=useRef<{y:number;height:number}|null>(null);
  const [viewZoom,setViewZoom] = useState(100);

  const [timelineWidth,setTimelineWidth] = useState(800);
  const [stageSize,setStageSize] = useState({width:640,height:350});
  useEffect(() => {
    const el = stageRef.current?.querySelector('.studio-player'); if (!el) return;
    const observer = new ResizeObserver(() => setStageSize({width:el.clientWidth,height:el.clientHeight}));
    observer.observe(el); return () => observer.disconnect();
  },[]);
  const transformDrag = useRef<{id:string;x:number;y:number;clientX:number;clientY:number;width:number;height:number} | null>(null);
  useEffect(() => {
    const el = timelineRef.current; if (!el) return;
    const observer = new ResizeObserver(() => setTimelineWidth(el.clientWidth)); observer.observe(el);
    return () => observer.disconnect();
  },[]);
  useEffect(() => {
    const el = timelineRef.current; if (!el) return;
    const wheel = (event:WheelEvent) => {
      if (!event.ctrlKey) return;
      event.stopPropagation();
      event.preventDefault();
      const next = Math.max(100,Math.min(zoomLimit.current,zoom * (event.deltaY < 0 ? 1.15 : 1/1.15)));
      const position = event.clientX - el.getBoundingClientRect().left;
      const scroll = anchorZoom(el.scrollLeft,position,zoom,next);
      setZoom(next); requestAnimationFrame(() => { el.scrollLeft = scroll; });
    };
    el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
  },[zoom]);
  const [captionStyleRequest,setCaptionStyleRequest]=useState(0);
  const [timingCaption,setTimingCaption] = useState<{clipId:string;segmentId:string}|null>(null);
  useEffect(()=>{const clear=(e:PointerEvent)=>{const target=e.target as Element;if(target.closest('button,input,textarea,select,a,dialog,[role=dialog],[role=listbox],.subtitle-customize-panel,.video-studio-media,.video-caption-hit,.caption-timing-clip,.caption-group-row,.timeline-group-tools'))return;setCaptionWord(undefined);};document.addEventListener('pointerdown',clear);return()=>document.removeEventListener('pointerdown',clear);},[]);
  const [selectedId, setSelectedIdRaw] = useState("");
  function setSelectedId(id:string){setSelectedIdRaw(id);if(id){setSelectedOverlay('');if(localScript)setTimingCaption(null);}}
  const [playhead, setPlayhead] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportOptionsOpen,setExportOptionsOpen]=useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [previewMuted,setPreviewMuted]=useState(false);
  const soundEvents=clips.filter(c=>c.type==='video').flatMap(clip=>{const doc=captions[clip.assetId];if(!doc)return [];return captionSounds(doc.segments,doc.captionSettings).filter(event=>event.start>=clip.inPoint&&event.start<clip.outPoint).map(event=>({...event,start:event.start-clip.inPoint+clip.start}));});
  useCaptionSounds(soundEvents,undefined,mediaRefs,playhead,playing);

  const [, setHandoffLoaded] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [importing, setImporting] = useState(false);
  useLoadingLeaveGuard(importing);
  useEffect(()=>{ if(!localScript&&assets.length && !importing) setPlaying(true); },[assets.length,importing]);
  const navigating = useRef(false);
  const importTask = useRef<AbortController | null>(null);
  const [importProgress,setImportProgress]=useState('Učitavanje medija…');
  useEffect(()=>()=>importTask.current?.abort(),[]);




  async function projectSnapshot(): Promise<ProjectSnapshot> {
    return { data: { overlays, clips, zoom, frameAspect, timelineFloor, sceneDefaults, platformGuide, captions:Object.fromEntries(Object.entries(captions).map(([id,d])=>[id,{...d,topics:d.topics||suggestTopics(d.segments.map(s=>s.text).join(' '))}])), trackOrder, timelineHeight, mediaTrackHeight, timelineLayoutVersion:2, assets: assets.map(({ id, name, type, duration, aspectRatio }) => ({ id, name, type, duration, aspectRatio })) },
      files: assets.map(asset => ({ key: asset.id, file: asset.file })) };
  }
  async function restoreProject(data: Record<string, unknown>, files: Map<string, File>) {
    if (!Array.isArray(data.assets) || !Array.isArray(data.clips)) throw new Error('Spremljeni video projekat nije ispravan.');
    const descriptions = data.assets as Omit<Asset, 'file' | 'url'>[];
    setMediaTrackHeight(typeof data.mediaTrackHeight==='number'&&Number.isFinite(data.mediaTrackHeight)?Math.max(40,Math.min(140,data.mediaTrackHeight*(data.timelineLayoutVersion===2?1:.7))):52);
    setTrackOrder(Array.isArray(data.trackOrder)?data.trackOrder.filter((key):key is string=>typeof key==='string'):[]);
    setTimelineHeight(typeof data.timelineHeight==='number'?data.timelineHeight:220);
    const nextClips = linkLegacyClips(data.clips as Clip[]);
    if (!descriptions.every(asset => asset && typeof asset.id === 'string' && files.has(asset.id)
      && ['video', 'audio', 'image'].includes(asset.type) && Number.isFinite(asset.duration) && Number.isFinite(asset.aspectRatio))
      || !nextClips.every(clip => clip && descriptions.some(asset => asset.id === clip.assetId)
        && [clip.start, clip.inPoint, clip.outPoint, clip.volume, clip.layer].every(Number.isFinite))) {
      throw new Error('Projektu nedostaju datoteke ili podaci o klipovima.');
    }
    importTask.current?.abort();
    const task=new AbortController(); importTask.current=task; setImporting(true); setPlaying(false);
    const restored:Asset[]=[];
    try {
      for (const asset of descriptions) restored.push({...await loadAsset(files.get(asset.id)!,task.signal,setImportProgress),id:asset.id,name:asset.name});
      task.signal.throwIfAborted();
      mediaRefs.current.forEach(media=>media.pause()); assets.forEach(asset=>URL.revokeObjectURL(asset.url));
      setAssets(restored); setClips(nextClips); setSelectedId(nextClips[0]?.id || ''); setPlayhead(0); playheadRef.current=0;
      setPlatformGuide(typeof data.platformGuide==='string'?data.platformGuide:'none');
      history.reset({sceneDefaults:restoreSceneDefaults(data.sceneDefaults),timelineFloor:typeof data.timelineFloor==='number'&&Number.isFinite(data.timelineFloor)?Math.max(0,Math.min(21600,data.timelineFloor)):0,overlays:restoreOverlays(data.overlays),clips:nextClips,captions:(data.captions as Record<string,VideoCaptions>) || {},frameAspect:typeof data.frameAspect === 'number' && Number.isFinite(data.frameAspect) && data.frameAspect >= 0 ? data.frameAspect : 0});
      setZoom(typeof data.zoom === 'number' ? Math.max(100,Math.min(324000,data.zoom)) : 100); setError(''); setHandoffLoaded(false);
    } catch(cause) {restored.forEach(asset=>URL.revokeObjectURL(asset.url));throw cause;}
    finally {if(importTask.current===task){importTask.current=null;setImporting(false);}}

  }

  const [platformGuide,setPlatformGuide]=useState('none');
  const [captionScope,setCaptionScope]=useState('all');
  const [captionWord,setCaptionWord]=useState<number>();
  const selected = clips.find((clip) => clip.id === selectedId);
  const captionAssetId=localScript?'__script':selected?.assetId || clips.find(c=>c.type==='video')?.assetId || '';
  const [recognizing,setRecognizing]=useState(false);
  const [recognitionStatus,setRecognitionStatus]=useState('');
  const [captionLanguage,setCaptionLanguage]=useState('bos');
  const recognitionController=useRef<AbortController|null>(null);
  useEffect(()=>()=>recognitionController.current?.abort(),[]);
  async function recognizeCaptions() {
    const asset=assets.find(asset=>asset.id===captionAssetId);
    if(!asset||recognizing||captions[asset.id]?.segments.length)return;
    const controller=new AbortController();recognitionController.current=controller;
    setRecognizing(true);setPlaying(false);setError('');
    try {
      setRecognitionStatus('Priprema zvuka…');
      const {prepareTranscriptionAudio}=await import('../../lib/prepare-transcription-audio');
      const audio=await prepareTranscriptionAudio(asset.file,controller.signal,percent=>setRecognitionStatus(`Priprema zvuka ${Math.round(percent ?? 0)}%`));
      const response=await apiFetch('/api/transcribe',{method:'POST',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])});
      const token=await response.json();
      if(!response.ok||(!token.token&&!token.proxy))throw new Error(token.error||'Prepoznavanje trenutno nije dostupno.');
      const body=transcriptionBody(audio,captionLanguage);body.append('operationId',crypto.randomUUID());
      const result=await uploadForTranscript(token.token||'',body,controller.signal,percent=>setRecognitionStatus(`Slanje zvuka ${Math.round(percent ?? 0)}%`),()=>setRecognitionStatus('Prepoznajemo titlove…'),token.proxy?await csrfToken():undefined);
      controller.signal.throwIfAborted();
      const words=alignTranscriptWords(result.words||[],audio.offset);
      const segments=wordsToSegments(words,words.length===(result.words||[]).length?result.text||'':words.map(w=>w.text||'').join(' '),asset.duration);
      setCaptions(current=>({...current,[asset.id]:{...(current[asset.id]||{activeStyle:'clean',captionSettings:DEFAULT_CAPTION_SETTINGS}),segments}}));
      setRecognitionStatus(segments.length?'Titlovi su spremni.':'U snimku nije prepoznat govor.');
    } catch(error) {if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Prepoznavanje nije uspjelo.');}
    finally {setRecognizing(false);recognitionController.current=null;}
  }

  const selectedAsset = assets.find((asset) => asset.id === selected?.assetId);


  const localDuration=localTimelineDuration(clips.map(c=>c.start+clipLength(c)),localScript?(captions.__script?.segments||[]).map(s=>s.end):[],overlays.map(o=>o.end),timelineFloor);
  const timelineDuration = localScript?localDuration.duration:clips.length?Math.max(.1,...clips.map(c=>c.start+clipLength(c))):10;
  const zoomMaximum=localScript?timelineZoomMaximum(timelineDuration,timelineWidth):800;zoomLimit.current=zoomMaximum;
  useEffect(()=>{if(playheadRef.current>timelineDuration){playheadRef.current=timelineDuration;setPlayhead(timelineDuration);setPlaying(false);}},[timelineDuration]);
  const globalCaptionClip={id:'__script',assetId:'__script',type:'video',start:0,inPoint:0,outPoint:timelineDuration,layer:999};
  const renderCaptionClips=localScript?[globalCaptionClip]:clips;
  const previousStill=(clip:Clip)=>clips.filter(c=>c.type==='video'&&c.layer===clip.layer&&c.start<clip.start&&c.start+clipLength(c)>=clip.start-.05&&stillImages.has(c.assetId)).sort((a,b)=>b.start-a.start)[0];
  const orderedClips = useMemo(() => [...clips].sort((a, b) => b.layer - a.layer || a.start - b.start), [clips]);
  const previewAspect = frameAspect || assets.find((asset) => asset.type !== "audio")?.aspectRatio || 16 / 9;

  const importContext=useRef({userId:session.user?.id,hasAssets:assets.length>0,restore:restoreProject});
  useEffect(()=>{importContext.current={userId:session.user?.id,hasAssets:assets.length>0,restore:restoreProject};});
  const addFiles = useCallback(async (incomingFiles: File[], muteImportedVideo = false, importedAudioStart = 0, importedCaptions?: VideoCaptions, importedOriginalVolume = 100, importedAudioRole:'narration'|'sound'='narration') => {
    if (importTask.current) return false;
    const task=new AbortController(); importTask.current=task;
    setImporting(true); setPlaying(false); setImportProgress('Učitavanje medija…'); setError("");
    try {
    if(incomingFiles.length===1&&!importedCaptions&&importContext.current.userId){
      const saved=await restoreExport(incomingFiles[0],importContext.current.userId).catch(()=>undefined);
      if(task.signal.aborted)return false;
      if(saved?.data.exportSourceKind==='video'&&!importContext.current.hasAssets){await importContext.current.restore(saved.data,saved.files);setPanel('captions');return true;}
      if(saved?.data.exportSourceKind==='subtitles'&&saved.files.get('video')){
        const voice=saved.files.get('voice'),data=saved.data;
        const useVoice=voice&&data.voiceMode!=='original'&&data.voiceMode===data.generatedVoiceMode;
        incomingFiles=[saved.files.get('video')!,...(useVoice?[voice]:[])];
        importedAudioStart=Number(data.generatedVoiceStart)||0;
        importedOriginalVolume=typeof data.originalVolume==='number'?data.originalVolume:100;
        muteImportedVideo=Boolean(data.originalMuted||(useVoice&&(data.voiceMode==='change'||data.narratorMix==='replace')));
        importedCaptions={segments:data.segments as VideoCaptions['segments'],activeStyle:data.activeStyle as VideoCaptions['activeStyle'],captionSettings:data.captionSettings as VideoCaptions['captionSettings']};setPanel('captions');
      }
    }
    const files = incomingFiles.filter((file) => file.type.startsWith("video/") || file.type.startsWith("audio/") || ["image/png","image/jpeg","image/webp"].includes(file.type));
    if (!files.length) { setError("Odaberi sliku, video ili audio datoteku."); return false; }
    for (const file of files) {
      const ready = await loadAsset(file,task.signal,setImportProgress);
    setAssets((current) => [...current, ready]);
    if(ready.type==='video' && importedCaptions) {const restoredCaptions=importedCaptions;setCaptions(current=>({...current,[ready.id]:restoredCaptions}));}
    setClips((current) => {
      let videoCursor = Math.max(0, ...current.filter((clip) => clip.type === "video").map((clip) => clip.start + clipLength(clip)));
      let nextLayer = Math.max(0, ...current.map((clip) => clip.layer)) + 1;
      const additions = [ready].flatMap((asset) => {
        const start = asset.type !== "audio" ? videoCursor : importedAudioStart;
        if (asset.type === "video") videoCursor += asset.duration;
        const videoClip = { ...(asset.type==='image'?sceneDefaultsRef.current:{}),audioRole:asset.type==='audio'?importedAudioRole:undefined,groupId: crypto.randomUUID(), id: crypto.randomUUID(), assetId: asset.id, name: asset.name, type: asset.type === "audio" ? "audio" : "video", start, inPoint: 0, outPoint: asset.duration, volume: 100, muted: asset.type !== "audio", layer: asset.type !== "audio" ? 1 : nextLayer++ } satisfies Clip;
        return asset.type==='video' ? [videoClip,{...videoClip,id:crypto.randomUUID(),type:'audio' as const,audioRole:'sound' as const,name:`Zvuk · ${asset.name}`,muted:muteImportedVideo,volume:importedOriginalVolume,layer:0}] : [videoClip];
      });
      setSelectedId(additions[0]?.id || "");
      return [...current, ...additions];
    });
    }
    return true;
    } catch (cause) { setError(task.signal.aborted ? "Učitavanje je prekinuto." : cause instanceof Error?cause.message:"Datoteku nije moguće otvoriti. Pokušaj ponovo."); return false; }
    finally { if(importTask.current===task) importTask.current=null; setImporting(false); }
  // History setters read the latest document through refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addSources(event: ChangeEvent<HTMLInputElement>) {
    await addFiles([...(event.target.files ?? [])]);
    event.target.value = "";
  }

  const consumedHandoff=useRef(false);
  useEffect(() => {
    if (consumedHandoff.current || !new URLSearchParams(window.location.search).has("handoff") || new URLSearchParams(window.location.search).has("project") || new URLSearchParams(window.location.search).has("new")) return;
    void loadVideoStudioHandoff((session.user?.id??0))
      .then(async (handoff) => {
        if (!handoff || consumedHandoff.current) return;
      consumedHandoff.current=true;
        const loaded=await addFiles([handoff.video, ...(handoff.voice ? [handoff.voice] : [])], handoff.muteOriginal ?? true, handoff.voiceStart ?? 0, handoff.captions, handoff.originalVolume ?? 100);
        if(loaded){setHandoffLoaded(true);if(handoff.captions?.segments.length)setPanel('captions');}else consumedHandoff.current=false;
      })
      .catch(() => setError("Preneseni video nije moguće otvoriti. Dodaj izvore ručno."));
  }, [addFiles, session.user]);

  const sceneLoop=captionScope==='scene'&&timingCaption?(()=>{
    const clip=clips.find(c=>c.id===timingCaption.clipId),segment=clip&&captions[clip.assetId]?.segments.find(s=>s.id===timingCaption.segmentId);
    if(!clip||!segment)return undefined;
    const start=clip.start+Math.max(0,segment.start-clip.inPoint),end=clip.start+Math.min(clip.outPoint-clip.inPoint,segment.end-clip.inPoint);
    return end>start?{start,end}:undefined;
  })():undefined;
  const sceneLoopId=sceneLoop&&timingCaption?`${timingCaption.clipId}:${timingCaption.segmentId}`:undefined;
  useEffect(()=>{if(sceneLoopId)setPlaying(true);},[sceneLoopId]);
  useEffect(()=>{
    if(sceneLoop&&(playhead<sceneLoop.start||playhead>=sceneLoop.end)){
      playheadRef.current=sceneLoop.start;setPlayhead(sceneLoop.start);
    }
  },[playhead,sceneLoop?.start,sceneLoop?.end]);
  useEffect(() => {
    playheadRef.current = playhead;
    for (const clip of clips) {
      const element = mediaRefs.current.get(clip.id);
      if (!element) continue;
      const visibleTime = Math.min(playhead, Math.max(0, timelineDuration - .001));
      const active = visibleTime >= clip.start && visibleTime < clip.start + clipLength(clip);
      const wantedTime = Math.min(clip.outPoint - .001, clip.inPoint + Math.max(0, visibleTime - clip.start));
      element.muted = clip.muted||previewMuted;
      setMediaGain(element,clip.volume/100);
      if (active && Math.abs(element.currentTime - wantedTime) > (playing ? .35 : .01)) element.currentTime = wantedTime;
      if (active && playing) { if (element.paused) void element.play().catch(() => setPlaying(false)); }
      else if (!element.paused) element.pause();
    }
  }, [clips, playhead, playing, timelineDuration,previewMuted]);

  useEffect(() => {
    if (!playing || timelineDuration<=0) return;
    let previous = performance.now();
    let frame = 0;
    const advance = (now: number) => {
      const raw=advancePlayhead(playheadRef.current,previous,now,timelineDuration,repeat);
      const next=sceneLoop&&(raw<sceneLoop.start||raw>=sceneLoop.end)?sceneLoop.start:raw;
      previous = now;
      if (!sceneLoop && !repeat && next >= timelineDuration) {
        playheadRef.current = timelineDuration; setPlayhead(timelineDuration); setPlaying(false); return;
      }
      playheadRef.current = next; setPlayhead(next);
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [playing, timelineDuration, repeat,sceneLoop?.start,sceneLoop?.end]);
  function seek(time: number) { const safe=clampPlayhead(time,timelineDuration); playheadRef.current = safe; setPlayhead(safe); }
  function togglePlayback() {
    if (!clips.length || exporting) return;
    if(!playing&&sceneLoop&&(playheadRef.current<sceneLoop.start||playheadRef.current>=sceneLoop.end))seek(sceneLoop.start);
    else if (!playing && playheadRef.current >= timelineDuration) seek(0);
    setPlaying(current => !current);
  }

  const selectedSound = selected && (selected.type === 'audio' ? selected : clips.find(clip => clip.type === 'audio' && linkedTo(clip, selected)));
  function updateSelectedSound(patch: Pick<Partial<Clip>, 'muted' | 'volume'>) {
    if (!selectedSound || locked) return;
    setClips(current => current.map(clip => clip.id === selectedSound.id ? {...clip, ...patch} : clip));
  }
  function updateSelected(patch: Partial<Clip>) { if (!selectedId) return; setClips((current) => updateLinked(current, selectedId, patch)); }
  function removeSelected() { if (!selectedId || locked) return; setClips((current) => current.filter((clip) => !selected || !linkedTo(clip,selected))); setSelectedId(""); }
  function removeLocalElement() {
    if(locked)return;
    if(selectedOverlay){removeOverlay();return;}
    if(timingCaption?.clipId==='__script'){
      const id=timingCaption.segmentId;
      setCaptions(current=>current.__script?{...current,__script:{...current.__script,segments:current.__script.segments.filter(s=>s.id!==id)}}:current);
      setTimingCaption(null);return;
    }
    removeSelected();
  }
  const scaleDrag=useRef<{x:number;y:number;scale:number;id:string}|null>(null);
  const trimDrag=useRef<{clip:Clip;edge:'start'|'end';x:number;width:number;duration:number}|null>(null);
  function autoSplit(){
    if(!selected)return;const doc=captions[selected.assetId];const cuts=(doc?.segments||[]).map(s=>s.start).filter(t=>t>selected.inPoint+.1&&t<selected.outPoint-.1).sort((a,b)=>a-b);
    if(!cuts.length){setError('Za automatsko razdvajanje prvo pripremi titlove.');return;}
    const parts=splitLinked(clips,selected,[...new Set(cuts)]);
    setClips(parts);setSelectedId(selected.id);setError('');
  }
  function splitSelected() {
    if (!selected || playhead < selected.start + .1 || playhead > selected.start + clipLength(selected) - .1) { setError("Postavi pokazivač unutar odabranog klipa."); return; }
    const next=splitLinked(clips,selected,[selected.inPoint+playhead-selected.start]);
    setClips(next);setSelectedId(next.find(c=>c.type===selected.type&&c.assetId===selected.assetId&&Math.abs(c.start-playhead)<.001)?.id || selected.id);setError('');
  }

  function audioVolumeControl(audio: Clip, selectionId: string) {
    const asset=assets.find(asset=>asset.id===audio.assetId)!;
    return <AudioVolumeHandle volume={audio.volume} muted={audio.muted} onSelect={()=>setSelectedId(selectionId)} onBegin={()=>history.begin()} onEnd={()=>history.end()} onChange={volume=>setClips(current=>current.map(clip=>clip.id===audio.id?{...clip,volume}:clip))}>
      <AudioWaveform normalize file={asset.file} start={audio.inPoint/asset.duration} end={audio.outPoint/asset.duration}/>
    </AudioVolumeHandle>;
  }
  const [dropLayer,setDropLayer]=useState<number|null>(null);
  function beginDrag(event: React.PointerEvent<HTMLButtonElement>, clip: Clip) {
    history.begin();
    event.currentTarget.setPointerCapture(event.pointerId);
    const timeline = event.currentTarget.closest(".video-studio-track-area")?.getBoundingClientRect();
    if (!timeline) return;
    dragRef.current = { id: clip.id, pointerId: event.pointerId, startX: event.clientX, clipStart: clip.start, width: timeline.width, duration:timelineDuration,startY:event.clientY,layer:clip.layer,type:clip.type };
    setSelectedId(clip.id);setPlaying(false);
  }
  function dragClip(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
    if(Math.abs(event.clientX-drag.startX)<4 && Math.abs(event.clientY-drag.startY)<4)return;
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-drop-layer]');
    if(drag.type==='video'&&target){drag.targetLayer=Number(target.dataset.dropLayer);setDropLayer(drag.targetLayer);}
    const delta = ((event.clientX - drag.startX) / drag.width) * drag.duration;
    drag.targetLayer ??= drag.layer;
    setClips((current) => updateLinked(current,drag.id,{start:Math.max(0,Math.round((drag.clipStart+delta)*10)/10)}));
  }
  function endDrag(event: React.PointerEvent<HTMLButtonElement>) { if (dragRef.current?.pointerId === event.pointerId) {const drag=dragRef.current;setClips(current=>current.map(c=>c.id===drag.id?{...c,layer:drag.targetLayer??drag.layer}:c));dragRef.current = null;setDropLayer(null);history.end();} }

  const [preparingExport,setPreparingExport]=useState(false);const exportPending=useRef(false);
  async function exportProject(exportOptions:ExportOptions={quality:"full"}) {
    if (!clips.some((clip) => clip.type === "video") || exporting) { setError("Dodaj najmanje jedan video klip."); return; }
    if(exportPending.current)return;exportPending.current=true;setPreparingExport(true);
    if(!session.user){try{await loginForDownload('video',projectSnapshot);}catch(cause){setError(cause instanceof Error?cause.message:'Montaža nije sačuvana. Ostaješ u editoru.');}finally{exportPending.current=false;setPreparingExport(false);}return;}
    const saved=await saveHandle.current?.save();setPreparingExport(false);exportPending.current=false;
    if(!saved){setError('Spremanje nije uspjelo. Montaža je zadržana; pokušaj ponovo.');return;}
    setPlaying(false); mediaRefs.current.forEach(media => media.pause());
    trackProduct("export_start");setExporting(true); setExportProgress(0); setError("");
    try {
      await loadOverlayFonts(overlays);await document.fonts.ready;
      if(clips.some(c=>c.background&&c.background!=='none')||Object.values(captions).some(d=>captionNeedsPerson(d.activeStyle,d.captionSettings,d.segments)))await preparePersonMask();
      const layer=document.createElement('canvas');
      const sources=clips.filter(clip=>assets.find(a=>a.id===clip.assetId)?.type!=='image').map(clip=>{const asset=assets.find(a=>a.id===clip.assetId);if(!asset)throw new Error('Nedostaje originalna datoteka klipa.');return {id:clip.id,file:asset.file,start:clip.start,inPoint:clip.inPoint,outPoint:clip.outPoint,video:clip.type==='video',volume:clip.muted?0:clip.volume/100};});
      const hasImages=assets.some(a=>a.type==='image');
      if(clips.some(c=>assets.find(a=>a.id===c.assetId)?.type==='image'&&!stillImages.has(c.assetId)))throw new Error('Fotografija još nije učitana. Pokušaj ponovo.');
      const output=await offlineExport({...exportOptions,...hasImages?{width:Math.round((previewAspect<1?1920:1080)*previewAspect/2)*2,height:previewAspect<1?1920:1080,fps:exportOptions.fps||30,preserveLeadingGap:true}:{},textureFills:captions,serifTextures:Object.values(captions).some(d=>d.activeStyle==='testSerif'||d.segments.some(s=>s.detachedStyle?.style==='testSerif'||s.laneStyle?.style==='testSerif'||s.titleStyle==='testSerif'||Object.values(s.wordStyles||{}).some(w=>w.style==='testSerif'))),goldTextures:Object.values(captions).some(d=>d.activeStyle==='goldMesh'||d.segments.some(s=>s.detachedStyle?.style==='goldMesh'||s.laneStyle?.style==='goldMesh'||s.titleStyle==='goldMesh'||Object.values(s.wordStyles||{}).some(w=>w.style==='goldMesh'))),sounds:soundEvents,clips:sources,duration:timelineDuration,aspect:previewAspect,sourceTiming:clips.filter(c=>c.type==='video').length===1&&clips.find(c=>c.type==='video')?.start===0&&clipLength(clips.find(c=>c.type==='video')!)>=timelineDuration,progress:setExportProgress,draw:(ctx,time,frames)=>{
        ctx.fillStyle='#07070b';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
        for(const clip of [...clips].filter(c=>frames.has(c.id)||(stillImages.has(c.assetId)&&time>=c.start&&time<c.start+clipLength(c))).sort((a,b)=>a.layer-b.layer)){
          if(stillImages.has(clip.assetId)){drawStillScene(ctx,stillImages,clip,time,previewAspect,previousStill(clip));continue;}
          const frame=frames.get(clip.id)!,rect=videoRect(frame.videoWidth/frame.videoHeight,previewAspect,glassVideoTransform(clip,captions[clip.assetId],clip.inPoint+time-clip.start)),w=ctx.canvas.width,h=ctx.canvas.height;
          drawSceneEffects(ctx,clip,frame.currentTime,time-clip.start,clipLength(clip),rect.x/100*w,rect.y/100*h,rect.width/100*w,rect.height/100*h,()=>drawVideoBackground(ctx,frame,clip.background||'none',rect.x/100*w,rect.y/100*h,rect.width/100*w,rect.height/100*h));
        }
        drawOverlays(ctx,overlays,time);
        drawVideoCaptions(ctx,layer,renderCaptionClips,captions,time,id=>frames.get(id));
      }});
        await checkExportQuota(output);if(session.user)await rememberExport(output,(session.user?.id??0),'video',await projectSnapshot()).catch(()=>{});const url=URL.createObjectURL(output),link=document.createElement('a');link.href=url;link.download=exportOptions.filename||(localScript?localScript.title+'.mp4':'klipanje-video.mp4');link.click();trackProduct("export_success");const exportedStyles=new Set<string>();for(const clip of clips.filter(c=>c.type==='video')){const doc=captions[clip.assetId];if(doc)trackExportStyles(doc.segments.filter(s=>s.end>clip.inPoint&&s.start<clip.outPoint),doc.activeStyle,exportedStyles);}setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(error){trackProduct('export_error');setError(error instanceof Error?error.message:'Izvoz nije uspio. Montaža je sačuvana.');}finally{setExporting(false);}
  }

  const locked = exporting || recognizing;
  function undoVideoEdit(){
    const clip=clips.find(c=>c.id===timingCaption?.clipId),doc=clip?captions[clip.assetId]:undefined;
    const selected=doc?.segments.find(s=>s.id===timingCaption?.segmentId);
    if(document.activeElement?.closest('.caption-timing-scroll,.video-studio-track-scroll')||!clip||selected?.role!=='title'){history.undo();return;}
    const scope=captionFamilyScope(selected.sourceCaptionId||selected.id),assetId=clip.assetId;
    history.undoScoped(value=>scope.pick(value.captions[assetId]?.segments||[]),(value,before)=>({...value,captions:{...value.captions,[assetId]:{...value.captions[assetId],segments:scope.merge(value.captions[assetId]?.segments||[],before.captions[assetId]?.segments||[])}}}));
  }
  useCaptionShortcuts({enabled:!locked,split:()=>{},scope:()=>{},undo:undoVideoEdit,redo:history.redo});
  useCaptionShortcuts({enabled:panel!=='captions'&&!locked&&Boolean(captionAssetId),scope:()=>{setCaptionWord(undefined);},split:()=>{const doc=captions[captionAssetId];if(!doc)return;const id=timingCaption?.segmentId||doc.segments[0]?.id;setCaptions(current=>({...current,[captionAssetId]:{...doc,segments:doc.segments.map(s=>s.id===id?{...s,wordsSeparated:!s.wordsSeparated}:s)}}));}});
  let lanes = [...new Set(orderedClips.filter(c=>c.type==='video').map(c=>c.layer))].map(layer=>({key:`video-${layer}`,label:`Video ${layer}`,clips:clips.filter(c=>c.type==='video'&&c.layer===layer),audio:false}));

  for (const clip of orderedClips.filter(c=>c.type==='audio'&&!clips.some(v=>v.type==='video'&&linkedTo(v,c)))) lanes.push({key:clip.id,label:'Audio',clips:[clip],audio:true});
  const captionClips=clips.filter(c=>c.type==='video'&&captions[c.assetId]?.segments.length);
  if(localScript)lanes=localMediaLanes(orderedClips);
  const orderedTrackKeys=localScript?['images','narration','captions','sounds','effects']:timelineTrackOrder(trackOrder,lanes.map(l=>l.key),captionClips.length>0);
  function moveTrack(id:string,target:string){setTrackOrder(moveTimelineTrack(orderedTrackKeys,id,target));}
  const ticks = rulerTicks(timelineDuration,timelineWidth*zoom/100,localScript?{start:timelineScroll/(timelineWidth*zoom/100)*timelineDuration,end:(timelineScroll+timelineWidth)/(timelineWidth*zoom/100)*timelineDuration}:undefined);
  function dragVideo(event:React.PointerEvent<HTMLVideoElement|HTMLCanvasElement>,clip:Clip) {
    if(locked || tool==='hand') return;
    history.begin();event.preventDefault();event.stopPropagation();setPlaying(false);setSelectedId(clip.id);
    const box=event.currentTarget.parentElement!.getBoundingClientRect();
    transformDrag.current={id:clip.id,x:clip.x??50,y:clip.y??50,clientX:event.clientX,clientY:event.clientY,width:box.width,height:box.height};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveVideo(event:React.PointerEvent<HTMLVideoElement|HTMLCanvasElement>) {
    const drag=transformDrag.current;if(!drag)return;
    setClips(current=>current.map(c=>c.id===drag.id?{...c,x:Math.max(-100,Math.min(200,drag.x+(event.clientX-drag.clientX)/drag.width*100)),y:Math.max(-100,Math.min(200,drag.y+(event.clientY-drag.clientY)/drag.height*100))}:c));
  }
  function seekPointer(event:React.PointerEvent<HTMLElement>) {
    if(locked)return; const rect=event.currentTarget.getBoundingClientRect();setPlaying(false);seek(Math.max(0,Math.min(timelineDuration,(event.clientX-rect.left)/rect.width*timelineDuration)));
  }
  function detachAudio() {
    if(!selected||selected.type!=='video'||selected.muted)return;
    setClips(current=>[...current.map(c=>c.id===selected.id?{...c,muted:true}:c),{...selected,id:crypto.randomUUID(),type:'audio',name:`Zvuk · ${selected.name}`,layer:0}]);
  }
  function duplicateSelected() {if(selected){const groupId=crypto.randomUUID();setClips(current=>[...current,...current.filter(c=>linkedTo(c,selected)).map(c=>({...c,id:crypto.randomUUID(),groupId,start:c.start+clipLength(selected)}))]);}}
  const frameRate=useMediaFrameRate(assets.find(a=>a.id===selected?.assetId)?.file);
  const frameStep=useRef((direction:number)=>{setPlaying(false);seek(adjacentFrameTime(playhead,direction,frameRate,timelineDuration));});
  useEffect(()=>{frameStep.current=direction=>{setPlaying(false);seek(adjacentFrameTime(playhead,direction,frameRate,timelineDuration));};});
  const playbackShortcut = useRef({toggle: togglePlayback, enabled: !locked && clips.length > 0});
  useEffect(() => { playbackShortcut.current = {toggle: togglePlayback, enabled: !locked && clips.length > 0}; });
  useEffect(() => installPlaybackShortcut(window, () => playbackShortcut.current.toggle(), () => playbackShortcut.current.enabled,direction=>frameStep.current(direction)), []);
  async function fullscreenPreview() {
    try {if(document.fullscreenElement) await document.exitFullscreen();else await stageRef.current?.requestFullscreen();setViewZoom(100);}catch{setError('Preglednik ne dopušta prikaz preko cijelog ekrana.');}
  }
  useEffect(()=>{
    const remove=(event:KeyboardEvent)=>{
      if(!['Delete','Backspace'].includes(event.key)||event.repeat||event.ctrlKey||event.metaKey||event.altKey||locked||(!selectedId&&!selectedOverlay&&!(localScript&&timingCaption?.clipId==='__script'))||document.querySelector('dialog[open]'))return;
      const target=event.target instanceof Element?event.target:null;
      if(target?.closest('input,textarea,select,[contenteditable=true],[role=textbox]'))return;
      event.preventDefault();event.stopPropagation();if(localScript){removeLocalElement();return;}if(panel==='captions'&&captionScope.startsWith('group:')){setCaptions(current=>Object.fromEntries(Object.entries(current).map(([id,doc])=>[id,{...doc,segments:deleteCaptionGroup(doc.segments,captionScope.slice(6))}])));return;}if(selectedOverlay)removeOverlay();else if(timingCaption){const clip=clips.find(c=>c.id===timingCaption.clipId);if(clip)setCaptions(current=>{const doc=current[clip.assetId];if(!doc)return current;return {...current,[clip.assetId]:{...doc,segments:doc.segments.filter(s=>s.id!==timingCaption.segmentId)}};});}else void removeSelected();
    };
    window.addEventListener('keydown',remove,true);
    return()=>window.removeEventListener('keydown',remove,true);
  });
  return <main style={{'--media-track-height':`${mediaTrackHeight}px`} as React.CSSProperties} onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();}} onDrop={e=>{if(e.defaultPrevented)return;e.preventDefault();if(e.dataTransfer.files.length&&!locked)void addFiles([...e.dataTransfer.files]);}} className={`video-studio-app${assets.length?' has-media':''}${localScript?' local-edita-video':''}`} onKeyDown={event=>{if((event.target as HTMLElement).closest('textarea,input:not([type=range]):not([type=number]):not([type=color]),[contenteditable=true]'))return;if((event.ctrlKey||event.metaKey)&&event.code==='KeyB'){event.preventDefault();if(!locked)splitSelected();}}}>
    <EditorLeaveGuard active={Boolean(assets.length||clips.length)} bypass={()=>navigating.current} onSave={()=>saveHandle.current?.save()??Promise.resolve(false)}/>
    {exportOptionsOpen&&<ExportOptionsDialog defaultName={localScript?.title||"klipanje-video"} onClose={()=>setExportOptionsOpen(false)} onExport={options=>{setExportOptionsOpen(false);void exportProject(options);}}/>}{(preparingExport||exporting)&&<ExportProgressDialog message={preparingExport?'Spremamo montažu prije izvoza…':'Izvoz videa je u toku…'} progress={exporting?exportProgress:undefined}/>}{localScript?<LocalVideoStorage script={localScript} snapshot={projectSnapshot} restore={restoreProject} saveHandle={saveHandle} disabled={locked} changeKey={!importing?JSON.stringify({clips,captions,overlays,frameAspect,timelineFloor,sceneDefaults,zoom,trackOrder,timelineHeight,assets:assets.map(a=>a.id)}):undefined}/>:<ProjectToolbar hasMedia={assets.length>0||clips.length>0||importing} autoSaveKey={assets.length&&!importing?JSON.stringify({overlays,clips,captions,frameAspect,platformGuide,trackOrder,timelineHeight,mediaTrackHeight,assets:assets.map(a=>a.id)}):undefined} saveHandle={saveHandle} kind="video" snapshot={projectSnapshot} restore={restoreProject} disabled={locked} />}

    <input ref={inputRef} hidden multiple type="file" accept="video/*,audio/*,image/png,image/jpeg,image/webp" onChange={event => void addSources(event)} disabled={locked}/>
    {importing && <div className="video-import-status" role="status">{importProgress}<button onClick={()=>importTask.current?.abort()}>Prekini</button></div>}
    <section className={`video-studio-workspace ${assets.length||localScript?'has-sources':''}${panel?'':' panel-closed'}`}>
      {<nav className="video-tool-rail" aria-label="Alati video editora">{(localScript?([['start','settings','Početak'],['media','video','Mediji'],['audio','sound','Naracija'],['sounds','music','Zvukovi'],['captions','captions','Titlovi'],['transitions','transitions','Pokreti'],['effects','filters','Efekti']] as const):([['media','video','Mediji'],['settings','settings','Video'],['audio','play','Zvuk'],['captions','captions','Titlovi'],['text','text','Tekst'],['elements','elements','Elementi'],['filters','filters','Filteri'],['transitions','transitions','Prijelazi']] as const)).map(([id,icon,label])=><button key={id} aria-label={label} title={label} disabled={!localScript&&!assets.length&&id!=="media"} aria-pressed={panel===id} onClick={()=>setPanel(panel===id?null:id)}><StudioIcon name={icon}/><span>{label}</span></button>)}</nav>}
      {panel && <aside className="video-studio-media" onPointerDownCapture={event=>{if((event.target as HTMLElement).matches('input[type=range]'))history.begin();}} onPointerUpCapture={history.end} onPointerCancelCapture={history.end}>
        <PanelResize selector=".video-studio-app" variable="--video-panel-width"/><div className="video-panel-heading"><strong>{panel==='start'?'Početak':panel==='scripts'?'Skripta':panel==='media'?'Mediji':panel==='audio'?'Naracija':panel==='sounds'?'Zvukovi':panel==='effects'?'Efekti':panel==='captions'?'Titlovi':panel==='text'?'Tekst':panel==='elements'?'Elementi':panel==='filters'?'Filteri':panel==='transitions'?(localScript?'Pokreti':'Prijelazi'):'Podešavanja videa'}</strong><button aria-label="Zatvori podešavanja" onClick={()=>setPanel(null)}>×</button></div>
        {localScript?<><LocalEditorTools defaults={sceneDefaults} onDefaults={value=>history.set(current=>({...current,sceneDefaults:value}))} timelineDuration={timelineDuration} timelineMinimum={localDuration.minimum} onTimelineDuration={value=>history.set(current=>({...current,timelineFloor:value}))} panel={panel} script={localScript} selected={selected} isImage={selectedAsset?.type==='image'} document={captions.__script||scriptCaptions(localScript)} onCaptions={doc=>setCaptions(current=>({...current,__script:doc}))} onPatch={updateSelected} onRemove={removeSelected} onAdd={(files,start=0,role='narration')=>addFiles(files,false,start,undefined,100,role)} onSeek={time=>{setPlaying(false);seek(time);}} disabled={locked||importing}/>{panel==='effects'&&<><p>Odaberi sliku ili video na timelineu za primjenu efekta.</p><SceneEffectsPanel mode="filters" clip={selected?.type==='video'?selected:undefined} disabled={locked} time={playhead} onChange={updateSelected} onPreview={time=>{seek(time);setPlaying(true);}}/></>}</>:<>
        <BetaNotice section={panel}/>
        {(panel==='filters'||panel==='transitions')&&<SceneEffectsPanel key={panel} mode={panel} clip={selected?.type==='video'?selected:undefined} disabled={locked} time={playhead} onChange={updateSelected} onPreview={time=>{seek(time);setPlaying(true);}}/>}
        {(panel==='text'||panel==='elements')&&<OverlayLibrary key={panel} mode={panel} items={overlays} selected={selectedOverlay} onSelect={selectOverlay} onAdd={addOverlay} onChange={changeOverlay} onRemove={removeOverlay} onDuplicate={()=>{const item=overlays.find(o=>o.id===selectedOverlay);if(item){const copy={...item,id:crypto.randomUUID(),x:Math.min(100,item.x+3),y:Math.min(100,item.y+3)};setOverlays(current=>[...current,copy]);setSelectedOverlay(copy.id);}}} onOrder={orderOverlay} duration={timelineDuration} disabled={locked}/>}
        {panel==='media' && <button className="video-add-source" disabled={importing||locked} onClick={()=>inputRef.current?.click()}><StudioIcon name="plus"/><span>Ubaci video ili zvuk</span></button>}
        {(panel==='media'||panel==='audio') && <div className="video-studio-assets"><h3>Mediji <span>{assets.length}</span></h3>{assets.filter(asset=>panel!=='audio'||clips.some(c=>c.assetId===asset.id&&c.type==='audio')).map(asset => <button className={selected?.assetId === asset.id ? 'active' : ''} key={asset.id} type="button" onClick={() => setSelectedId(clips.find(clip => clip.assetId === asset.id && (panel!=='audio'||clip.type==='audio'))?.id || '')}><span className="video-asset-preview">{asset.type === 'video' ? <VideoThumbnails url={asset.url} start={0} end={Math.min(.25,asset.duration)}/> : <StudioIcon name="sound"/>}</span><div><strong>{asset.name}</strong><small>{timeLabel(asset.duration)}</small></div></button>)}</div>}
        {selected && (panel==='settings'||panel==='audio') && <details open className="video-studio-clip-settings"><summary>Podešavanja klipa</summary><fieldset disabled={locked}><p title={selected.name}>{selected.name}</p><label>Početak na liniji<input type="number" min="0" step=".1" value={selected.start.toFixed(1)} onChange={event => updateSelected({start:Math.max(0,Number(event.target.value))})}/></label><div className="video-studio-trim"><label>Od<input type="number" min="0" step=".1" value={selected.inPoint.toFixed(1)} onChange={event => updateSelected({inPoint:Math.max(0,Math.min(Number(event.target.value),selected.outPoint-.1))})}/></label><label>Do<input type="number" min=".1" step=".1" value={selected.outPoint.toFixed(1)} onChange={event => updateSelected({outPoint:Math.max(selected.inPoint+.1,Math.min(Number(event.target.value),selectedAsset?.duration || selected.outPoint))})}/></label></div><CleanAudioPanel openRequest={cleanAudioRequest} file={selectedAsset?.file||null} disabled={locked||!selectedSound} onApply={async(file,offset)=>{if(!selectedSound)return;if(Math.abs(offset)>.001)throw new Error('Ovaj zapis ima pomjeren početak zvuka. Čišćenje bez gubitka sinhronizacije još nije podržano.');const target=selectedSound;const asset=await loadAsset(file,new AbortController().signal,()=>{});if(asset.duration<target.outPoint-.1)throw new Error('Očišćeni zvuk je kraći od odabrane scene. Original je sačuvan.');setAssets(current=>[...current,asset]);setClips(current=>current.map(c=>c.id===target.id?{...c,assetId:asset.id,name:'Očišćeni govor',inPoint:Math.max(0,c.inPoint-offset),outPoint:c.outPoint,start:c.start+Math.max(0,offset-c.inPoint),muted:false}:c));}}/><label>Glasnoća · {selectedSound?.volume ?? 0}%<input type="range" min="0" max="150" value={selectedSound?.volume ?? 0} onChange={event => updateSelectedSound({volume:Number(event.target.value)})}/></label><label className="video-studio-mute"><input type="checkbox" checked={selectedSound?.muted ?? true} onChange={event => updateSelectedSound({muted:event.target.checked})}/>Isključi zvuk</label><button className="video-studio-remove" onClick={removeSelected}>Ukloni klip</button></fieldset></details>}

        {panel==='captions' && <VideoCaptionEditor styleRequest={captionStyleRequest} editRequest={captionEditRequest} selectedId={timingCaption?.segmentId} word={captionWord} onWord={setCaptionWord} scope={captionScope} onScope={setCaptionScope} time={selected?Math.max(selected.inPoint,playhead-selected.start+selected.inPoint):0} duration={assets.find(a=>a.id===captionAssetId)?.duration||10} onSelect={id=>{setCaptionWord(undefined);const clip=selected?.type==='video'&&selected.assetId===captionAssetId?selected:clips.find(c=>c.type==='video'&&c.assetId===captionAssetId);if(clip){const chosen=captions[captionAssetId]?.segments.find(s=>s.id===id);setPlaying(false);if(chosen)seek(clip.start+Math.max(0,Math.min(clip.outPoint-clip.inPoint-.001,chosen.start-clip.inPoint)));setTimingCaption({clipId:clip.id,segmentId:id});setSelectedId(clip.id);}}} document={captions[captionAssetId]} recognitionControls={!captions[captionAssetId]?.segments.length ? <div className="video-caption-recognize"><LanguageDropdown variant="voice" label="Jezik govora" value={captionLanguage} onChange={setCaptionLanguage} disabled={recognizing} options={[{value:'bos',label:'Bosanski'},{value:'srp',label:'Srpski'},{value:'hrv',label:'Hrvatski'},{value:'slv',label:'Slovenski'},{value:'sqi',label:'Albanski'},{value:'auto',label:'Automatski'}]}/><button disabled={locked||recognizing||!captionAssetId} onClick={()=>void recognizeCaptions()}>{recognizing?recognitionStatus:'Prepoznaj titlove'}</button>{recognizing&&<button onClick={()=>recognitionController.current?.abort()}>Otkaži</button>}</div> : null} onRecognize={()=>void recognizeCaptions()} voicePanel={<VideoVoicePanel disabled={locked||importing} file={assets.find(a=>a.id===captionAssetId)?.file} transcript={captions[captionAssetId]?.segments.map(s=>s.text).join(' ')||''} sourceTime={selected?Math.max(selected.inPoint,playhead-selected.start+selected.inPoint):0} sourceEnd={selected?.outPoint} time={playhead} onAdd={async(file,start,replace)=>{
 const target=selectedSound;const ready=await loadAsset(file,new AbortController().signal,()=>{});
 history.begin();setAssets(current=>[...current,ready]);setClips(current=>{
  let next=current;
  if(replace&&target){const end=start+ready.duration;const others=new Set(current.filter(c=>!linkedTo(c,target)).map(c=>c.id));next=splitLinked(current,target,[target.inPoint+start-target.start,target.inPoint+end-target.start]).map(c=>c.type==='audio'&&!others.has(c.id)&&c.start>=start-.1&&c.start+clipLength(c)<=end+.1?{...c,muted:true}:c);}
  return [...next,{id:crypto.randomUUID(),assetId:ready.id,name:ready.name,type:'audio',start,inPoint:0,outPoint:ready.duration,volume:100,muted:false,layer:1+Math.max(0,...next.map(c=>c.layer))}];
 });history.end();
}}/>} disabled={locked||recognizing} onChange={document=>setCaptions(current=>({...current,[captionAssetId]:document}))} />}
        {panel==='settings' && selected?.type==='video' && <section className="video-background-tools"><h3>Ukloni pozadinu</h3><p>Izdvoji osobu i postavi novu pozadinu. Najbolje radi uz dobro osvjetljenje i jasno vidljivu osobu.</p><div>{backgrounds.map(item=><button disabled={locked} aria-pressed={(selected.background||'none')===item.id} key={item.id} onClick={()=>updateSelected({background:item.id})}><i style={{background:item.colors.length?`linear-gradient(135deg,${item.colors.join(',')})`:item.id==='transparent'?'repeating-conic-gradient(#b8bfcc 0% 25%,#eff1f5 0% 50%) 0/12px 12px':'var(--ui-raised)'}}/>{item.name}</button>)}</div><small>„Bez pozadine“ otkriva video slojeve ispod. Samostalni MP4 izvoz koristi crnu podlogu.</small></section>}
        {panel==='settings' && selected?.type==='video' && <div className="video-transform-settings"><label>Veličina videa · {Math.round((selected.scale??1)*100)}%<input aria-label="Veličina video sloja" type="range" min=".1" max="4" step=".05" value={selected.scale??1} disabled={locked} onChange={event=>updateSelected({scale:Number(event.target.value)})}/></label><button disabled={locked} onClick={()=>updateSelected({x:50,y:50,scale:1})}>Vrati položaj</button></div>}
        {panel!=='captions' && <p className="video-studio-tool-hint">Odaberi klip na vremenskoj liniji da ga dotjeraš.</p>}</>}
      </aside>}
      <section className={`video-studio-main tool-${tool}`} ref={stageRef} style={{'--stage-zoom':viewZoom/100,'--pan-x':`${pan.x}px`,'--pan-y':`${pan.y}px`,'--frame-width':`${Math.min(stageSize.width,(Math.max(1,stageSize.height-20))*previewAspect)}px`,'--frame-height':`${Math.min(Math.max(1,stageSize.height-20),stageSize.width/previewAspect)}px`} as React.CSSProperties}>
        <EditorHeaderPortal slot="tools"><div className="video-studio-preview-heading">
          <PreviewQualityPicker/><div className="video-ratio-picker"><button title="Format" aria-label="Omjer kadra" aria-expanded={ratioOpen} onClick={()=>setRatioOpen(!ratioOpen)}><StudioIcon name="ratio"/> <span>Format</span><StudioIcon name="chevron"/></button>{ratioOpen&&<><button className="ratio-dismiss" aria-label="Zatvori izbor formata" onClick={()=>setRatioOpen(false)}/><div className="video-ratio-menu" role="menu">{!localScript&&<strong className="format-group">Social media</strong>}{(localScript?[]:socialFormats).map(({id,label})=><button key={id} role="menuitemradio" aria-checked={platformGuide===id} onClick={()=>{setPlatformGuide(id);setFrameAspect(9/16);setRatioOpen(false);}}>{label} · 9:16</button>)}{!localScript&&<strong className="format-group">Custom</strong>}{(localScript?[{ratio:9/16,label:"9:16",hint:"TikTok · Shorts · Reels"},{ratio:16/9,label:"16:9",hint:"YouTube"},{ratio:1,label:"1:1",hint:"Instagram objava"}]:customFormats).map(({ratio,label,hint})=><button key={ratio} role="menuitemradio" aria-checked={platformGuide==='none'&&frameAspect===ratio} disabled={locked} onClick={()=>{setPlatformGuide('none');setFrameAspect(Number(ratio));setRatioOpen(false);}}><span className="ratio-shape" style={{aspectRatio:ratio||16/9}}/><span>{label}<small>{hint}</small></span>{platformGuide==='none'&&frameAspect===ratio&&<b>✓</b>}</button>)}</div></>}</div>
          <div className="video-preview-tools"><button type="button" aria-label="Ponovo učitaj video" title="Ponovo učitaj pregled videa; montaža ostaje ista" disabled={locked} onClick={()=>{setPlaying(false);stageRef.current?.querySelectorAll('video').forEach(video=>{const time=video.currentTime;video.addEventListener('loadedmetadata',()=>{video.currentTime=Math.min(time,Math.max(0,video.duration-.01));},{once:true});video.load();});}}>↻</button><button disabled={!selected||selected.type!=='video'||locked} aria-label="Auto kadar" title="Auto kadar — automatski popuni i centriraj video" onClick={()=>{if(!selected)return;const a=assets.find(a=>a.id===selected.assetId)!;updateSelected({x:50,y:50,scale:Math.max(a.aspectRatio/previewAspect,previewAspect/a.aspectRatio)});}} className="video-auto-action"><StudioIcon name="frame"/><span>Auto kadar</span></button>
            <button aria-label="Odabir i pomjeranje videa" aria-pressed={tool==='select'} onClick={()=>setTool('select')}><StudioIcon name="pointer"/></button>
            <button aria-label="Ruka za pomjeranje pregleda" aria-pressed={tool==='hand'} onClick={()=>setTool('hand')}><StudioIcon name="hand"/></button>
            <select title="Zoom pregleda · 100% uklapa video" aria-label="Zoom pregleda" value={viewZoom} onChange={event=>{setViewZoom(Number(event.target.value));if(Number(event.target.value)===100)setPan({x:0,y:0});}}>{[25,50,75,95,100,125,150,200].map(v=><option key={v} value={v}>{`${v}%`}</option>)}</select>
            <span className="video-toolbar-divider"/>
            <button aria-label="Poništi izmjenu" title="Poništi (Ctrl+Z / ⌘Z)" disabled={!history.canUndo||locked} onClick={undoVideoEdit}><StudioIcon name="undo"/></button>
            <button aria-label="Ponovi izmjenu" title="Ponovi (Ctrl+Shift+Z)" disabled={!history.canRedo||locked} onClick={history.redo}><StudioIcon name="redo"/></button>
            <button aria-label="Video preko cijelog ekrana" onClick={()=>void fullscreenPreview()}>⛶</button>
            <button className="video-add-media" aria-label="Dodaj medije" title="Dodaj medije" disabled={locked||importing} onClick={()=>inputRef.current?.click()}><StudioIcon name="plus"/></button>
            <button aria-label="Izvezi video" title="Izvezi video" className="video-export-primary" disabled={!clips.some(c=>c.type==='video')||locked||importing} onClick={()=>setExportOptionsOpen(true)}><StudioIcon name="download"/><span>Izvezi video</span></button>
          </div>
        </div>
        </EditorHeaderPortal><div className="video-stage-wrap" onPointerDownCapture={event=>{if(!(event.target as HTMLElement).closest('.video-overlay-layer,button,input,select'))setSelectedOverlay('');if(tool!=='hand'||(event.target as HTMLElement).closest('button,input,select'))return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);panDrag.current={x:pan.x,y:pan.y,cx:event.clientX,cy:event.clientY};}} onPointerMove={event=>{const d=panDrag.current;if(d)setPan({x:d.x+event.clientX-d.cx,y:d.y+event.clientY-d.cy});}} onPointerUp={()=>{panDrag.current=null;}} onPointerCancel={()=>{panDrag.current=null;}}>
        <div id="video-editor-feedback" className="video-editor-feedback"/><StudioPlayer showControls={false} playing={playing} enabled={Boolean(clips.length)} time={playhead} duration={timelineDuration} repeat={repeat} onRepeat={() => setRepeat(value => !value)} onToggle={togglePlayback} onSeek={seek} onAdd={() => inputRef.current?.click()} onDrop={files => void addFiles(files)} hasMedia={Boolean(assets.length)} busy={locked} aspect={previewAspect} emptyContent={localScript?<div className="studio-player-empty"><span className="studio-player-upload-icon"><StudioIcon name="video"/></span><h1>Složi svoju priču.</h1><p>Dodaj fotografije iz projekta ili s računara.<br/>Skripte i naracija su u lijevom panelu.</p><button onClick={()=>inputRef.current?.click()}>+ Dodaj slike ili video</button><small>PNG, JPG, WebP · MP4, MOV · MP3, WAV</small></div>:undefined}>
          {clips.map(clip => {
            const asset = assets.find(item => item.id === clip.assetId); if (!asset) return null;
            const visibleTime = Math.min(playhead,Math.max(0,timelineDuration-.001));
            const active = visibleTime >= clip.start && visibleTime < clip.start + clipLength(clip);
            const ref = (node: HTMLMediaElement | null) => { if (node) mediaRefs.current.set(clip.id, node); else mediaRefs.current.delete(clip.id); };
            const rect=videoRect(asset.aspectRatio,previewAspect,glassVideoTransform(clip,captions[clip.assetId],clip.inPoint+playhead-clip.start));
            if(asset.type==='image')return active?<StillSceneLayer key={clip.id} images={stillImages} clip={clip} time={visibleTime} aspect={previewAspect} previous={previousStill(clip)} onPointerDown={event=>dragVideo(event,clip)} onPointerMove={moveVideo} onPointerUp={()=>{transformDrag.current=null;history.end();}}/>:null;
            return clip.type === 'audio' ? <audio key={clip.id} ref={ref} src={asset.url} preload="auto"/> : <EditingVideo file={asset.file} aria-label={`Pomjeri video: ${clip.name}`} className={`${active ? 'active' : ''}${selectedId===clip.id?' selected-video':''}`} style={{...sceneEffectStyle(clip,clip.inPoint+visibleTime-clip.start,visibleTime-clip.start,clipLength(clip)),filter:`${String(sceneEffectStyle(clip,clip.inPoint+visibleTime-clip.start,visibleTime-clip.start,clipLength(clip)).filter||'').replace('none','')} blur(.2px)`,...(!active||(clip.background&&clip.background!=='none')?{opacity:0}:{}),zIndex:clip.layer,left:`${rect.x}%`,top:`${rect.y}%`,width:`${rect.width}%`,height:`${rect.height}%`}} key={clip.id} ref={ref} src={asset.url} preload="auto" playsInline onPointerDown={event=>dragVideo(event,clip)} onPointerMove={moveVideo} onPointerUp={()=>{transformDrag.current=null;history.end();}} onPointerCancel={()=>{transformDrag.current=null;history.end();}}/>;
          })}

          {orderedClips.filter(clip=>clip.type==='video'&&clip.background&&clip.background!=='none'&&clipAtPlayhead(clip,playhead,timelineDuration)).map(clip=>{const asset=assets.find(a=>a.id===clip.assetId);if(!asset)return null;const rect=videoRect(asset.aspectRatio,previewAspect,glassVideoTransform(clip,captions[clip.assetId],clip.inPoint+playhead-clip.start));return <VideoBackgroundLayer key={clip.id} id={clip.id} background={clip.background!} mediaRefs={mediaRefs} style={{...sceneEffectStyle(clip,clip.inPoint+playhead-clip.start,playhead-clip.start,clipLength(clip)),zIndex:clip.layer,left:`${rect.x}%`,top:`${rect.y}%`,width:`${rect.width}%`,height:`${rect.height}%`}}/>;})}
          {selected?.type==='video'&&playhead>=selected.start&&playhead<selected.start+clipLength(selected)&&(()=>{const asset=assets.find(a=>a.id===selected.assetId)!;const rect=videoRect(asset.aspectRatio,previewAspect,glassVideoTransform(selected,captions[selected.assetId],selected.inPoint+playhead-selected.start));return <button className="video-scale-handle" aria-label="Povuci za veličinu videa" style={{left:`${rect.x+rect.width}%`,top:`${rect.y+rect.height}%`}} onPointerDown={e=>{if(locked)return;e.stopPropagation();history.begin();scaleDrag.current={x:e.clientX,y:e.clientY,scale:selected.scale??1,id:selected.id};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const d=scaleDrag.current;if(d)setClips(current=>current.map(c=>c.id===d.id?{...c,scale:Math.max(.1,Math.min(4,d.scale+(e.clientX-d.x+e.clientY-d.y)/300))}:c));}} onPointerUp={()=>{scaleDrag.current=null;history.end();}} onPointerCancel={()=>{scaleDrag.current=null;history.end();}}/>;})()}
          <VideoOverlayLayer items={overlays} time={Math.min(playhead,Math.max(0,timelineDuration-.001))} aspect={previewAspect} selected={selectedOverlay} disabled={locked||tool==='hand'} onSelect={id=>{setSelectedOverlay(id);setSelectedId('');setPlaying(false);const item=overlays.find(o=>o.id===id);if(item)setPanel(item.kind==='text'?'text':'elements');}} onChange={changeOverlay} onBegin={history.begin} onEnd={history.end}/>
          {platformGuide!=='none'&&<PlatformPreview platform={platformGuide}/>}<VideoCaptionLayer onEdit={()=>setCaptionEditRequest(v=>v+1)} editable={panel==='captions'&&!locked} scope={captionScope} onBegin={history.begin} onEnd={history.end} onSelect={(clipId,segmentId,word)=>{setPlaying(false);setSelectedId(clipId);setTimingCaption({clipId,segmentId});setCaptionWord(word);const clip=clips.find(c=>c.id===clipId);if(clip)setCaptionStyleRequest(v=>v+1);setPanel('captions');}} onChange={(id,doc)=>setCaptions(current=>({...current,[id]:doc}))} clips={renderCaptionClips} documents={captions} time={Math.min(playhead,Math.max(0,timelineDuration-.001))} aspect={previewAspect} mediaRefs={mediaRefs}/>
          {assets.length > 0 && !assets.some(asset => asset.type !== 'audio') && <div className="video-studio-audio-preview"><span>♫</span><strong>Audio pregled</strong></div>}
        </StudioPlayer>
        </div>
    {overlays.some(o=>o.id===selectedOverlay)&&<aside className="overlay-floating-inspector" aria-label="Uređivanje odabranog sloja" onPointerDownCapture={event=>{if((event.target as HTMLElement).matches('input[type=range]'))history.begin();}} onPointerUpCapture={history.end} onPointerCancelCapture={history.end}><OverlayLibrary view="inspector" mode={overlays.find(o=>o.id===selectedOverlay)?.kind==='text'?'text':'elements'} items={overlays} selected={selectedOverlay} onSelect={selectOverlay} onAdd={addOverlay} onChange={changeOverlay} onRemove={removeOverlay} onDuplicate={()=>{const item=overlays.find(o=>o.id===selectedOverlay);if(item){const copy={...item,id:crypto.randomUUID(),x:Math.min(100,item.x+3),y:Math.min(100,item.y+3)};setOverlays(current=>[...current,copy]);setSelectedOverlay(copy.id);}}} onOrder={orderOverlay} duration={timelineDuration} disabled={locked}/></aside>}

      </section>
    <section style={{height:timelineHidden?64:timelineHeight,'--timeline-max-height':`${timelineMaximum}px`} as React.CSSProperties} className={`video-studio-timeline${timelineHidden?' is-hidden':''}`}>
      <div className="timeline-height-handle" role="separator" aria-label="Visina timeline editora" aria-orientation="horizontal" aria-valuenow={timelineHeight} tabIndex={0} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();setTimelineHeight(h=>h+(e.key==='ArrowUp'?20:-20));}}} onPointerDown={e=>{e.preventDefault();timelineResize.current={y:e.clientY,height:timelineHeight};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const d=timelineResize.current;if(d)setTimelineHeight(d.height+d.y-e.clientY);}} onPointerUp={()=>{timelineResize.current=null;}} onPointerCancel={()=>{timelineResize.current=null;}}><span/></div>
      <div className="video-studio-timeline-head">
{localScript?<>
        <div className="video-timeline-actions">
          <button title="Ukloni odabrani element" aria-label="Ukloni odabrani element" disabled={(!selected&&!selectedOverlay&&timingCaption?.clipId!=='__script')||locked} onClick={removeLocalElement}><StudioIcon name="trash"/></button>
          <button title={selectedSound?.muted?'Uključi zvuk elementa':'Isključi zvuk elementa'} disabled={!selectedSound||locked} aria-label="Zvuk odabranog elementa" onClick={()=>updateSelectedSound({muted:!selectedSound?.muted})}><StudioIcon name={selectedSound?.muted?"mute":"sound"}/></button>
          <button title="Vrati položaj videa" disabled={!selected||locked} aria-label="Vrati položaj videa" onClick={()=>updateSelected({x:50,y:50,scale:1})}><StudioIcon name="reset"/></button>
        </div>
</>:<>
        <div className="video-timeline-actions">
          <button hidden={!!localScript} title="Automatski razdvoji po početku titlova" disabled={!selected||locked} onClick={autoSplit} className="video-auto-action"><StudioIcon name="spark"/><span>Auto rez</span></button><button title="Presijeci na pokazivaču (Ctrl+B)" aria-label="Presijeci klip" disabled={!selected||locked} onClick={splitSelected}>✂</button>
          <button title="Dupliciraj klip" aria-label="Dupliciraj klip" disabled={!selected||locked} onClick={duplicateSelected}><StudioIcon name="copy"/></button>
          <button title="Ukloni klip" aria-label="Ukloni odabrani klip" disabled={!selected||locked} onClick={removeSelected}><StudioIcon name="trash"/></button>
          <button title={exporting?`Izvoz ${exportProgress}%`:"Preuzmi video"} aria-label="Preuzmi video" disabled={!clips.some(c=>c.type==='video')||locked||importing} onClick={()=>setExportOptionsOpen(true)}><StudioIcon name="download"/><span>Izvezi video</span></button>
          <button title={selectedSound?.muted ? 'Uključi zvuk klipa' : 'Isključi zvuk klipa'} aria-label={selectedSound?.muted ? 'Uključi zvuk klipa' : 'Isključi zvuk klipa'} aria-pressed={selectedSound?.muted ?? false} disabled={!selectedSound || locked} onClick={() => updateSelectedSound({muted: !selectedSound?.muted})}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/>{selectedSound?.muted ? <path d="m16 9 6 6m0-6-6 6"/> : <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>}</svg></button>
          <button title="Odvoji zvuk od videa" aria-label="Odvoji zvuk od videa" disabled={!selected||selected.type!=='video'||selected.muted||locked} onClick={detachAudio}>♫</button>
          <button title="Vrati položaj videa" aria-label="Vrati položaj videa" disabled={!selected||locked} onClick={()=>updateSelected({x:50,y:50,scale:1})}>↺</button>
        </div>
</>}
        <div className="video-timeline-transport"><button aria-label="Vrati video na početak" disabled={locked||!clips.length} onClick={()=>{setPlaying(false);seek(0);}}><StudioIcon name="skipStart"/></button><button title={playing?'Pause | Space':'Play | Space'} aria-label={playing?'Pauziraj vremensku liniju':'Pusti vremensku liniju'} disabled={locked||!clips.length} onClick={togglePlayback}><StudioIcon name={playing?'pause':'play'}/></button><button type="button" aria-label={previewMuted?'Uključi zvuk pregleda':'Isključi zvuk pregleda'} title={previewMuted?'Uključi zvuk':'Mute'} aria-pressed={previewMuted} onClick={()=>setPreviewMuted(v=>!v)}><StudioIcon name={previewMuted?'mute':'sound'}/></button><button type="button" aria-label="Ponavljaj video" title="Ponavljaj video" aria-pressed={repeat} disabled={locked||!clips.length} onClick={()=>setRepeat(value=>!value)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/></svg></button>{!localScript&&<button className="clean-audio-shortcut" title="Clean Audio" aria-label="Clean Audio" disabled={!selectedSound||locked} onClick={()=>{setPanel("audio");setCleanAudioRequest(v=>v+1);}}><StudioIcon name="spark"/></button>}<strong>{timelineClock(playhead)}</strong><span>/ {timelineClock(timelineDuration)}</span></div>
        <div className="video-studio-zoom"><button aria-label="Zoom out vremenske linije" disabled={zoom<=100} onClick={()=>setZoom(v=>Math.max(100,v/1.25))}>−</button><input aria-label="Zoom vremenske linije" type="range" min="100" max={zoomMaximum} step="1" value={Math.min(zoom,zoomMaximum)} onChange={event=>setZoom(Number(event.target.value))}/><button aria-label="Zoom in vremenske linije" disabled={zoom>=zoomMaximum} onClick={()=>setZoom(v=>Math.min(zoomMaximum,v*1.25))}>+</button><button className="timeline-fit" title="Uklopi cijeli timeline" aria-label="Uklopi cijeli timeline" onClick={()=>{setZoom(100);if(timelineRef.current)timelineRef.current.scrollLeft=0;}}>Fit</button><button aria-label={timelineHidden?'Prikaži timeline':'Sakrij timeline'} title={timelineHidden?'Prikaži timeline':'Sakrij timeline'} aria-expanded={!timelineHidden} onClick={()=>setTimelineHidden(v=>!v)}><StudioIcon name={timelineHidden?"timelineShow":"timelineHide"}/></button></div>
      </div>
      <div className={`video-studio-track-scroll${zoom===100?' is-fit':''}`} title="Scroll: gore/dolje · Ctrl + scroll: zoom · Shift + scroll: lijevo/desno" ref={timelineRef} onScroll={e=>setTimelineScroll(e.currentTarget.scrollLeft)} tabIndex={0} onPointerDownCapture={e=>{if(!(e.target instanceof Element&&e.target.closest('input,textarea,select')))e.currentTarget.focus({preventScroll:true});}} hidden={timelineHidden}>
        <div className="video-studio-track-area" style={{width:`${zoom}%`}}>
          <div className="video-timeline-ruler" aria-label="Vrijeme na vremenskoj liniji" onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);seekPointer(event);}} onPointerMove={event=>{if(event.buttons===1)seekPointer(event);}}>{ticks.map(t=><span key={t.time} style={{left:`${t.percent}%`,transform:t.percent>95?'translateX(-100%)':undefined}}>{timeLabel(t.time)}{t.time%1 ? `.${Math.round(t.time%1*10)}`:''}</span>)}</div>
          {localScript&&<div data-track-key="captions" style={{order:2}} className="video-caption-shared-timeline subtitle-app local-caption-lane"><span className="local-track-label">Titlovi</span><CaptionTimeline allowGroups={false} compact segments={captions.__script?.segments||[]} duration={timelineDuration} zoom={100} time={playhead} selected={timingCaption?.clipId==='__script'?(captions.__script?.segments||[]).findIndex(s=>s.id===timingCaption.segmentId):-1} groupStyle={captions.__script?.activeStyle} groupSettings={captions.__script?.captionSettings} onBegin={history.begin} onEnd={history.end} onSeek={time=>{setPlaying(false);seek(time);}} onSelect={index=>{setPanel('captions');setSelectedId('');setSelectedOverlay('');const segment=captions.__script?.segments[index];setTimingCaption(segment?{clipId:'__script',segmentId:segment.id}:null);setPlaying(false);}} onChange={segments=>setCaptions(current=>({...current,__script:{...current.__script,segments}}))}/></div>}
          {!localScript&&captionClips.length>0&&<div data-track-key="captions" className="video-caption-shared-timeline subtitle-app" style={{order:orderedTrackKeys.indexOf('captions')}}><TrackGrip id="captions" label="Titlovi" move={moveTrack}/><CaptionTimeline canMergePair={(a,b)=>clips.some(c=>a.startsWith(c.id+'-')&&b.startsWith(c.id+'-'))} onMerge={id=>{const clip=clips.find(c=>id.startsWith(c.id+'-'));if(!clip)return;setCaptions(current=>{const doc=current[clip.assetId];if(!doc)return current;return {...current,[clip.assetId]:{...doc,segments:mergeCaptionWithNext(doc.segments,id.slice(clip.id.length+1))}};});}} onSplit={(id,time)=>{const clip=clips.find(c=>id.startsWith(c.id+'-'));if(!clip)return;const segmentId=id.slice(clip.id.length+1);setCaptions(current=>{const doc=current[clip.assetId];if(!doc)return current;return {...current,[clip.assetId]:{...doc,segments:splitCaptionAt(doc.segments,segmentId,time-clip.start+clip.inPoint)}};});}} groupStyle={captions[captionAssetId]?.activeStyle} groupSettings={captions[captionAssetId]?.captionSettings} compact segments={timelineCaptions(clips,captions)?.segments||[]} duration={timelineDuration} zoom={100} time={playhead} selected={(timelineCaptions(clips,captions)?.segments||[]).findIndex(s=>s.id===`${timingCaption?.clipId}-${timingCaption?.segmentId}`)} onBegin={history.begin} onEnd={history.end} onSeek={time=>{setPlaying(false);seek(time);}} onSelect={(index)=>{if(index<0){setCaptionWord(undefined);return;}const item=timelineCaptions(clips,captions)?.segments[index];const clip=item&&clips.find(c=>item.id.startsWith(c.id+'-'));if(clip&&item){setPanel('captions');setCaptionStyleRequest(v=>v+1);setSelectedId(clip.id);setTimingCaption({clipId:clip.id,segmentId:item.id.slice(clip.id.length+1)});setCaptionWord(undefined);setPlaying(false);}}} onEdit={index=>{if(index<0){setCaptionWord(undefined);return;}const item=timelineCaptions(clips,captions)?.segments[index];const clip=item&&clips.find(c=>item.id.startsWith(c.id+'-'));if(clip&&item){setPanel('captions');setCaptionEditRequest(v=>v+1);setSelectedId(clip.id);setTimingCaption({clipId:clip.id,segmentId:item.id.slice(clip.id.length+1)});}}} onChange={next=>{
            const before=timelineCaptions(clips,captions)?.segments||[];
            setCaptions(current=>{const result={...current};for(const prior of before.filter(s=>!next.some(n=>n.id===s.id))){const clip=clips.find(c=>prior.id.startsWith(c.id+'-'));if(clip){const id=prior.id.slice(clip.id.length+1);result[clip.assetId]={...result[clip.assetId],segments:result[clip.assetId].segments.filter(s=>s.id!==id)};}}for(const item of next){const prior=before.find(s=>s.id===item.id);if(!prior||JSON.stringify(prior)===JSON.stringify(item))continue;const clip=clips.find(c=>item.id.startsWith(c.id+'-'));if(!clip)continue;const id=item.id.slice(clip.id.length+1);result[clip.assetId]={...result[clip.assetId],segments:result[clip.assetId].segments.map(s=>s.id===id?applyTimelineCaptionEdit(s,prior,item,clip):s)};}return result;});
          }}/></div>}

          {localScript&&<div className="video-studio-track local-effects-lane" style={{order:4}}><span className="local-track-label">Efekti</span>{!clips.some(c=>c.filter)&&<span className="local-empty-lane">Efekti odabranih kadrova</span>}{clips.filter(c=>c.type==='video'&&c.filter).map(c=><button key={c.id} title="Uredi efekat kadra" style={{left:`${(c.start+Math.max(0,c.filter!.start-c.inPoint))/timelineDuration*100}%`,width:`${Math.max(.1,Math.min(c.outPoint,c.filter!.end)-Math.max(c.inPoint,c.filter!.start))/timelineDuration*100}%`}} onClick={()=>{setSelectedId(c.id);setPanel('effects');}}><StudioIcon name="filters"/>{c.filter!.id}</button>)}</div>}
          {overlays.map(o=><div className={`video-studio-track overlay-track overlay-track-${o.kind==='text'?'text':o.kind==='heart'||o.kind==='star'?'sticker':'shape'}`} key={o.id} style={{order:orderedTrackKeys.length+1}}><button className={selectedOverlay===o.id?'active':''} style={{left:`${o.start/timelineDuration*100}%`,width:`${(o.end-o.start)/timelineDuration*100}%`}} onClick={()=>selectOverlay(o.id)} title={o.kind==='text'?o.text:'Uredi element'}><StudioIcon name={o.kind==='text'?'text':o.kind==='heart'||o.kind==='star'?'sticker':'elements'}/>{o.kind==='text'&&<strong>{o.text}</strong>}</button></div>)}
          {lanes.map(lane=><div data-track-key={lane.key} style={{order:orderedTrackKeys.indexOf(lane.key)}} data-drop-layer={lane.audio?undefined:lane.clips[0]?.layer} className={`video-studio-track ${localScript?'local-media-lane ':''}${lane.audio?'audio':'video combined-media'}${!lane.audio&&dropLayer===lane.clips[0]?.layer?' drop-active':''}`} key={lane.key} onPointerDown={e=>{if(e.target===e.currentTarget)seekPointer(e);}}>{localScript?<span className="local-track-label">{lane.label}</span>:<TrackGrip id={lane.key} label={lane.audio?'Zvuk':'Video i zvuk'} move={moveTrack}/>} {!lane.clips.length&&<span className="local-empty-lane">{lane.audio?'Dodaj audio u ovu stazu':'Dodaj slike u ovu stazu'}</span>}{!lane.audio&&<>{(['top','bottom'] as const).map(edge=><TrackHeightHandle key={edge} edge={edge} height={mediaTrackHeight} onChange={setMediaTrackHeight}/>)}</>}{lane.clips.filter(clip=>clip.start<timelineDuration).map(clip=><button key={clip.id} className={`${selectedId===clip.id?'active selected-clip':''}${clipAtPlayhead(clip,playhead,timelineDuration)?' at-playhead':''}${clip.muted&&lane.audio?' muted':''}`} disabled={locked} style={{left:`${clip.start/timelineDuration*100}%`,width:`${clipLength(clip)/timelineDuration*100}%`}} onClick={()=>{setSelectedId(clip.id);}} onPointerDown={event=>beginDrag(event,clip)} onPointerMove={dragClip} onPointerUp={endDrag} onPointerCancel={endDrag}>
            {!lane.audio&&clip.filter&&<span className="clip-filter-marker" title="Filter scene" style={{left:`${Math.max(0,clip.filter.start-clip.inPoint)/clipLength(clip)*100}%`,width:`${Math.max(0,Math.min(clip.outPoint,clip.filter.end)-Math.max(clip.inPoint,clip.filter.start))/clipLength(clip)*100}%`}}/>}{!lane.audio&&clip.transition&&<span className="clip-transition-marker" title="Prijelaz na početku scene" style={{width:`${Math.min(1,clip.transition.duration/clipLength(clip))*100}%`}}><StudioIcon name="transitions"/></span>}{lane.audio && audioVolumeControl(clip,clip.id)}
            {!lane.audio && <>{assets.find(a=>a.id===clip.assetId)?.type==='image'?<img className="local-image-thumbnails" src={assets.find(a=>a.id===clip.assetId)!.url} alt=""/>:<VideoThumbnails url={assets.find(a=>a.id===clip.assetId)!.url} start={clip.inPoint} end={clip.outPoint}/>}{(()=>{const audio=clips.find(c=>c.type==='audio'&&linkedTo(c,clip));return audio&&!localScript?<span className={`combined-audio${audio.muted?' muted':''}`}>{audioVolumeControl(audio,clip.id)}</span>:null;})()}</>}
            {(['start','end'] as const).map(edge=><span key={edge} className={`clip-trim-handle ${edge}`} role="slider" tabIndex={0} aria-label={edge==='start'?'Skrati početak klipa':'Skrati kraj klipa'} aria-valuenow={edge==='start'?clip.inPoint:clip.outPoint}
 onPointerDown={e=>{e.stopPropagation();e.preventDefault();history.begin();const rect=e.currentTarget.closest('.video-studio-track-area')!.getBoundingClientRect();trimDrag.current={clip:{...clip},edge,x:e.clientX,width:rect.width,duration:timelineDuration};e.currentTarget.setPointerCapture(e.pointerId);}}
 onPointerMove={e=>{const d=trimDrag.current;if(!d)return;e.stopPropagation();const delta=(e.clientX-d.x)/d.width*d.duration;const asset=assets.find(a=>a.id===d.clip.assetId)!;const patch=d.edge==='start'?{inPoint:Math.max(Math.max(0,d.clip.inPoint-d.clip.start),Math.min(d.clip.outPoint-.1,d.clip.inPoint+delta)),start:d.clip.start+Math.max(-Math.min(d.clip.inPoint,d.clip.start),Math.min(d.clip.outPoint-d.clip.inPoint-.1,delta))}:{outPoint:Math.max(d.clip.inPoint+.1,Math.min(asset.type==='image'?600:asset.duration,d.clip.outPoint+delta))};setClips(current=>updateLinked(current,d.clip.id,patch));}}
 onPointerUp={e=>{e.stopPropagation();trimDrag.current=null;history.end();}} onPointerCancel={()=>{trimDrag.current=null;history.end();}}/>)}
            <strong>{clip.groupId?'↔ ':''}{lane.audio?'♫ ':''}{clip.name}</strong><small>{lane.audio&&clip.muted?'Bez zvuka':lane.audio?`${clip.volume}%`:timeLabel(clipLength(clip))}</small>
          </button>)}</div>)}

          {!lanes.length&&<div className="video-studio-empty-track">Dodaj slike ili video da počneš uređivati.</div>}
          <div className="video-studio-playhead" role="slider" tabIndex={0} aria-label="Pokazivač vremena" aria-valuemin={0} aria-valuemax={timelineDuration} aria-valuenow={playhead} style={{left:`${playhead/timelineDuration*100}%`}} onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();seek(Math.max(0,Math.min(timelineDuration,playhead+(event.key==='ArrowRight'?.1:-.1))));}}} onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);setPlaying(false);}} onPointerMove={event=>{if(event.buttons!==1||locked)return;const r=event.currentTarget.parentElement!.getBoundingClientRect();seek(Math.max(0,Math.min(timelineDuration,(event.clientX-r.left)/r.width*timelineDuration)));}} />
        </div>
      </div>
    </section>
    </section>
    {error && <div className="video-studio-error" role="alert">{error}<button onClick={() => setError('')}>Zatvori</button></div>}
  </main>;
}
