import {captionPlaybackTime,captionOutputTime} from '../../lib/caption-clock';
import {useTimelineHeight} from '../../lib/use-timeline-height';
import {AssetLibrary} from '../../components/AssetLibrary';
import {trackProduct,trackExportStyles} from '../../lib/product-analytics';
import {reportEditorFailure} from '../../lib/diagnostics';
import {MediaRepairTools} from '../../components/MediaRepairTools';
import {resetFailedCollectionResources,prepareCollectionResources} from '../../lib/collection-captions';
import {formatCaptionNumbers} from '../../lib/caption-numbers';
import {loginForDownload} from '../../lib/guest-editor';
import {PreviewQualityPicker} from '../../components/PreviewQualityPicker';
import {CaptionNumberToggle} from '../../components/CaptionNumberToggle';
import {CaptionTimingShift} from '../../components/CaptionTimingShift';
import {isPresetCaptionStyle} from '../../config/captions/style-library';
import {applyPresetCaptionStyle} from '../../lib/preset-caption-style';
import {CaptionWordLink} from '../../components/CaptionWordLink';
import {CaptionQuickToolbar} from '../../components/CaptionQuickToolbar';
import {customFormats,isSocialFormat,platformFormatOptions} from '../../config/platform-formats';
import {captionNeedsPerson} from '../../lib/caption-word-roles';
import {NarratorTimeline} from '../../components/NarratorTimeline';
import {captionSounds} from '../../lib/caption-sounds';
import {useCaptionSounds} from '../../lib/use-caption-sounds';
import {preparedBrowserFile} from '../../lib/prepare-browser-video';
import {captionCamera} from '../../lib/dynamic-glass';
import {updateTitleStyles} from '../../lib/caption-selection';
import {VideoThumbnails} from '../../components/VideoThumbnails';
import {CaptionIndividualToggle} from '../../components/CaptionIndividualToggle';
import {CaptionWordsPanel} from '../../components/CaptionWordsPanel';
import {ExportOptionsDialog,type ExportOptions} from '../../components/ExportOptionsDialog';
import {deleteCaptionGroup,titleSettingsForStyle,activeCaptionSegments,captionFamilyScope,captionStyleOwner,editableCaptionSegments,preserveSuggestionRemoval,resolveCaptionSuggestions,resetTitleTiming} from '../../lib/caption-selection';
import {CaptionScopePicker} from '../../components/CaptionScopePicker';
import {rememberExport} from '../../lib/export-project';
import type {FrameSource} from '../../lib/frame-source';
import {offlineExport} from '../../lib/offline-export';
import {styleCaptionLane} from '../../lib/caption-selection';
import {ExportProgressDialog} from '../../components/ExportProgressDialog';
import {audioBufferSegmentToWav,audioBuffersToWav} from '../../lib/voice-wav';
import {parseSubtitleText} from '../../lib/caption-files';
import {CaptionSelectionTools} from '../../components/CaptionSelectionTools';
import {useCaptionShortcuts} from '../../lib/use-caption-shortcuts';
import {useEditorHistory} from '../../lib/use-editor-history';
import {CaptionSettingsPanel} from '../../components/CaptionSettingsPanel';
import {CleanAudioPanel} from '../../components/CleanAudioPanel';
import {suggestTopics,type TranscriptTopics} from '../../components/TranscriptTopicsPanel';
import {PlatformPreview} from '../../components/PlatformPreview';
import {formatSeconds} from '../../lib/format-seconds';
import {AudioVolumeHandle} from '../../components/AudioVolumeHandle';
import {AudioPlayer} from '../../components/AudioPlayer';
import {SubtitleVoicePlayback} from '../../components/SubtitleVoicePlayback';
import {wordsToSegments} from "../../lib/transcript-segments";
import { EditorLeaveGuard, allowEditorLeave } from '../../components/EditorLeaveGuard';
import { StudioIcon } from "../../components/StudioIcon/StudioIcon";
import {AudioWaveform} from '../../components/AudioWaveform';

import { csrfToken } from '../../lib/api';
import { checkExportQuota } from '../../lib/export-quota';
import { CaptionTimeline } from '../../components/CaptionTimeline/CaptionTimeline';
import { SubtitlePlayback } from '../../components/SubtitlePlayback/SubtitlePlayback';
import { reorderCaptions } from '../../lib/caption-timing';
import { cropRect } from "../../lib/video-crop";
import { useNavigate } from "react-router-dom";
import { SaveBeforeLeaving } from "../../components/SaveBeforeLeaving/SaveBeforeLeaving";
import { LanguageDropdown } from "../../components/LanguageDropdown/LanguageDropdown";
import { WorkspaceUpload } from '../../components/WorkspaceUpload/WorkspaceUpload';
import { LoadingVideo } from '../../components/LoadingVideo/LoadingVideo';
import { SubtitleIcon as Icon } from '../../components/SubtitleIcon/SubtitleIcon';
import {CaptionStylePicker} from '../../components/CaptionStylePicker';
import { InspectorPanel } from '../../components/InspectorPanel/InspectorPanel';
import { apiFetch } from "../../lib/api";
import { ProjectToolbar, type ProjectSnapshot, type ProjectSaveHandle } from "../../components/ProjectToolbar/ProjectToolbar";
import { useAuth } from '../../context/auth-context';

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { saveVideoOnlyHandoff, saveVideoStudioHandoff, loadVideoStudioHandoff } from "../../lib/video-studio-handoff";
import { CaptionCanvas } from "../../components/CaptionCanvas/CaptionCanvas";
import { CaptionWordHandles } from "../../components/CaptionWordHandles/CaptionWordHandles";
import { EditorInspector } from "../../components/EditorInspector/EditorInspector";
import { VideoPreviewStage } from "../../components/VideoPreviewStage/VideoPreviewStage";
import { TranscriptionStatus } from "../../components/TranscriptionStatus/TranscriptionStatus";
import { alignTranscriptWords, transcriptionBody, uploadForTranscript } from "../../lib/transcription-client";
import type { AnalysisStatus, PreparedAudio } from "../../lib/transcription-client";
import type { InspectorTab } from "../../lib/editor-layout";
import { templates, visibleTemplates, DEFAULT_CAPTION_SETTINGS, settingsForTemplate } from "../../config/captions/presets";
import type { StyleKey, CaptionPosition, CaptionSettings, Segment, CaptionTemplate } from "../../config/captions/presets";
import { captionFrameKey } from "../../lib/caption-renderer";
import { preparePersonMask, drawPersonCaption } from '../../lib/person-mask';
import type { CaptionBounds } from "../../lib/caption-renderer";

function initialTemplate() {
  const key = new URLSearchParams(window.location.search).get('style');
  return templates.find(template => template.key === key) ?? templates.find(template => template.key === 'clean')!;
}

type Phase = "upload" | "processing" | "editing";
type VoiceMode = "original" | "change" | "narrator";
type VoiceOption = {
  id: string;
  name: string;
  gender: string;
  accent: string;
  useCase: string;
  description: string;
  previewUrl: string;
  language?: string;
};
declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: Record<string, unknown>,
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}

const demoSegments: Segment[] = [
  {
    id: "demo-1",
    start: 0,
    end: 2.8,
    text: "Dobra priča ne treba komplikovane riječi.",
  },
  {
    id: "demo-2",
    start: 2.8,
    end: 5.6,
    text: "Treba jasan glas i titlove koji prate ritam.",
  },
  {
    id: "demo-3",
    start: 5.6,
    end: 8.4,
    text: "Zato svaki detalj možeš pregledati i popraviti.",
  },
];


const languageOptions = [
  { value: "bos", label: "Bosanski" },
  { value: "hrv", label: "Hrvatski" },
  { value: "srp", label: "Srpski" },
  { value: "eng", label: "Engleski" },
  { value: "deu", label: "Njemački" },
  { value: "auto", label: "Automatski prepoznaj" },
];


function secondsLabel(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = (value % 60).toFixed(1).padStart(4, "0");
  return `${minutes}:${seconds}`;
}
function srtTime(value: number, vtt = false) {
  const msAll = Math.max(0, Math.round(value * 1000));
  const h = Math.floor(msAll / 3600000)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((msAll % 3600000) / 60000)
    .toString()
    .padStart(2, "0");
  const s = Math.floor((msAll % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  const ms = (msAll % 1000).toString().padStart(3, "0");
  return `${h}:${m}:${s}${vtt ? "." : ","}${ms}`;
}

export function SubtitleStudio() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const saveHandle = useRef<ProjectSaveHandle>(null);
  const [videoEditorPrompt,setVideoEditorPrompt]=useState(false);
  async function openVideoEditor() {
    if (!file || isOpeningStudio) return;
    setIsOpeningStudio(true); setVideoEditorPrompt(false);
    try {
      if(generatedVoiceUrl && generatedVoiceMode===voiceMode) await transferGeneratedVoice();
      else await saveVideoOnlyHandoff((session.user?.id??0),file, {segments, activeStyle, captionSettings,topics:topics||suggestTopics(segments.map(s=>s.text).join(' '))},originalMuted,originalVolume);
      navigate('/video-editor?handoff=1');
    }
    catch { setError('Video nije prenesen. Oslobodi prostor u pregledniku i pokušaj ponovo.'); setIsOpeningStudio(false); }
  }
  const draggedCaption = useRef<string | null>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const voicePreviewRef = useRef<HTMLAudioElement | null>(null);
  const generatedPlayerRef = useRef<HTMLAudioElement | null>(null);
  const captionDragPointer = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    anchorDeltaX: number;
    anchorDeltaY: number;
  } | null>(null);
  const captionTransformGesture = useRef<{
    mode: "resize" | "rotate";
    pointerId: number;
    centerX: number;
    centerY: number;
    startDistance: number;
    startAngle: number;
    startScale: number;
    startRotation: number;
  } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [repairBusy,setRepairBusy]=useState(false);
  const [repairedPreview,setRepairedPreview]=useState<{original:File;file:File;url:string}|null>(null);
  const repairResume=useRef<{time:number;playing:boolean}|null>(null);
  useEffect(()=>()=>{if(repairedPreview)URL.revokeObjectURL(repairedPreview.url);},[repairedPreview]);
  const activeRepair=repairedPreview?.original===file?repairedPreview:null;
  const [backgroundFile,setBackgroundFile] = useState<File|null>(null);
  const exportPending = useRef(false);
  const [duration, setDuration] = useState(9);
  const [uploadNotice,setUploadNotice]=useState(false);
  useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const done=()=>{setUploadNotice(true);clearTimeout(timer);timer=setTimeout(()=>setUploadNotice(false),6500);};window.addEventListener('edita-upload-complete',done);return()=>{clearTimeout(timer);window.removeEventListener('edita-upload-complete',done);};},[]);
  const [phase, setPhase] = useState<Phase>("upload");
  const [analysis, setAnalysis] = useState<AnalysisStatus | null>(null);
  const analysisController = useRef<AbortController | null>(null);
  const preparedAudio = useRef<{ file: File; audio: PreparedAudio } | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(100);
  const analysisStarter = useRef<((source: File) => Promise<void>) | null>(null);
  const [topics,setTopics]=useState<TranscriptTopics>();
  const captionHistory=useEditorHistory<{segments:Segment[];style:StyleKey;settings:CaptionSettings}>({segments:[],style:initialTemplate().key,settings:settingsForTemplate(initialTemplate())});
  const {segments:storedSegments,style:activeStyle,settings:captionSettings}=captionHistory.value;
  const segments=useMemo(()=>editableCaptionSegments(storedSegments,activeStyle,captionSettings),[storedSegments,activeStyle,captionSettings]);
  const updateCaptionHistory=captionHistory.set;
  const resetCaptionHistory=captionHistory.reset;
  const setSegments=useCallback((action:React.SetStateAction<Segment[]>)=>updateCaptionHistory(current=>{const before=editableCaptionSegments(current.segments,current.style,current.settings);return {...current,segments:preserveSuggestionRemoval(before,typeof action==='function'?action(before):action)};}),[updateCaptionHistory]);
  const setActiveStyle=useCallback((style:StyleKey)=>updateCaptionHistory(current=>({...current,style})),[updateCaptionHistory]);
  const setCaptionSettings=useCallback((action:React.SetStateAction<CaptionSettings>)=>updateCaptionHistory(current=>({...current,settings:typeof action==='function'?action(current.settings):action})),[updateCaptionHistory]);
  const [dockHeight,setDockHeight,dockMaximum]=useTimelineHeight(290,180,'.subtitle-preview-panel',phase==='editing');
  const [dockHidden,setDockHidden]=useState(false);
  const [leaveUpload,setLeaveUpload]=useState(false);
  const dockResize=useRef<{y:number;height:number}|null>(null);
  const [activeSegment, setActiveSegment] = useState(-1);
  useEffect(()=>{const clear=(e:PointerEvent)=>{const target=e.target as Element;if(target.closest('button,input,textarea,select,a,dialog,[role=dialog],[role=listbox],.subtitle-customize-panel,.subtitle-inspector,.subtitle-overlay,.caption-title-handles,.caption-word-handles,.caption-timing-clip,.caption-group-row,.timeline-group-tools'))return;setSelectedWord(null);setCaptionSelected(false);};document.addEventListener('pointerdown',clear);return()=>document.removeEventListener('pointerdown',clear);},[]);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState("");
  const [preparingExport,setPreparingExport]=useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [exportOptionsOpen,setExportOptionsOpen]=useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderError, setRenderError] = useState("");
  const [videoAspect, setVideoAspect] = useState(16 / 9);
  const [outputFormat,setOutputFormat]=useState('9:16');
  const [cropX,setCropX]=useState(50), [cropY,setCropY]=useState(50);
  const outputAspect=outputFormat==='original'?videoAspect:(customFormats.find(format=>format.id===outputFormat)?.ratio||16/9);
  const [languageCode, setLanguageCode] = useState(()=>new URLSearchParams(window.location.search).get("language")||"bos");

  const [captionBounds, setCaptionBounds] = useState<CaptionBounds | null>(null);
  const [positionScope, setPositionScope] = useState('all');
  const [centerGuides,setCenterGuides]=useState<{x:boolean;y:number|null}>({x:false,y:null});
  const [selectedWord, setSelectedWord] = useState<{ segmentId: string; index: number } | null>(null);
  const separatedSegment = activeSegment<0?undefined:resolveCaptionSuggestions(segments)[activeSegment];
  const selectedWordData = selectedWord?.segmentId === separatedSegment?.id ? selectedWord : null;
  const styleOwner=captionStyleOwner(segments,separatedSegment);
  const scopeSegment=(positionScope==='scene'||positionScope==='titles')?styleOwner:segments.find(s=>s.role!=='title'&&(!s.detachedStyle||positionScope.startsWith('group:'))&&(s.lane||0)===0&&(positionScope.startsWith('group:')?s.group?.id===positionScope.slice(6):!s.group));
  const sourceSettings=((positionScope==='scene'||positionScope==='titles')?scopeSegment?.detachedStyle?.settings:undefined)||scopeSegment?.laneStyle?.settings||captionSettings;
  const editedSettings=((positionScope==='scene'||positionScope==='titles')&&separatedSegment?.role==='title'?separatedSegment.detachedStyle?.settings:undefined)||(selectedWordData&&!separatedSegment?.wordStyles?.[selectedWordData.index]?.linked&&separatedSegment?.wordStyles?.[selectedWordData.index]?.settings)||(positionScope==='scene'?scopeSegment?.detachedStyle?.settings:undefined)||scopeSegment?.laneStyle?.settings||captionSettings;
  const editedStyle=((positionScope==='titles'||positionScope==='scene')&&separatedSegment?.role==='title'?separatedSegment.detachedStyle?.style:undefined)||(selectedWordData&&!separatedSegment?.wordStyles?.[selectedWordData.index]?.linked&&separatedSegment?.wordStyles?.[selectedWordData.index]?.style)||(positionScope==='scene'?scopeSegment?.detachedStyle?.style:undefined)||scopeSegment?.laneStyle?.style||activeStyle;
  function changeScope(value:string){if(value==='word')return;setSelectedWord(null);setPositionScope(value);if(value==='scene'&&activeSegment<0){const index=segments.findIndex(s=>currentTime>=s.start&&currentTime<s.end);setActiveSegment(index>=0?index:0);}if(value.startsWith('group:')){const index=segments.findIndex(s=>s.group?.id===value.slice(6)&&s.role!=='title');if(index>=0){setActiveSegment(index);setCurrentTime(segments[index].start);if(videoRef.current)videoRef.current.currentTime=segments[index].start;}}}
  const scopePicker=<CaptionScopePicker title={separatedSegment?.role==='title'} segments={segments} value={positionScope} word={!!selectedWordData} onChange={changeScope}/>;
  function setEditedSettings(update: React.SetStateAction<CaptionSettings>) {
    if(isPresetCaptionStyle(editedStyle)&&separatedSegment&&(positionScope==='scene'||selectedWordData)){const next=typeof update==='function'?update(editedSettings):update;setSelectedWord(null);setSegments(current=>applyPresetCaptionStyle(current,[separatedSegment.id],editedStyle,next,true,true));return;}
    if (!selectedWordData) {
      if(positionScope==='titles'){const next=typeof update==='function'?update(editedSettings):update;const patch=Object.fromEntries(Object.entries(next).filter(([key,value])=>value!==editedSettings[key as keyof CaptionSettings]));setSegments(current=>updateTitleStyles(current,patch));return;}
      if(positionScope==='scene'&&separatedSegment?.role==='title'){const next=typeof update==='function'?update(editedSettings):update;setSegments(current=>current.map(s=>s.id===separatedSegment.id?{...s,titleOverrides:{...s.titleOverrides,...Object.fromEntries(Object.entries(next).filter(([key,value])=>value!==editedSettings[key as keyof CaptionSettings]))},detachedStyle:{style:editedStyle,settings:next}}:s));return;}
    if(separatedSegment&&(positionScope==='scene'))setSegments(current=>current.map(s=>s.id!==styleOwner?.id?s:{...s,separateStyle:true,detachedStyle:{style:s.detachedStyle?.style||s.laneStyle?.style||activeStyle,settings:typeof update==='function'?update(s.detachedStyle?.settings||s.laneStyle?.settings||captionSettings):update}}));
      else {const next=typeof update==='function'?update(editedSettings):update;setSegments(current=>styleCaptionLane(current,0,editedStyle,next,positionScope.startsWith('group:')?positionScope.slice(6):undefined,next.x===editedSettings.x&&next.y===editedSettings.y&&next.position===editedSettings.position));}return;
    }
    const { segmentId, index } = selectedWordData;
    setSegments(current => current.map(segment => {
      if (segment.id !== segmentId) return segment;
      const prior = segment.wordStyles?.[index];
      const settings = typeof update === 'function' ? update(prior?.settings ?? editedSettings) : update;
      return { ...segment, wordStyles: { ...segment.wordStyles, [index]: { linked:false, text: segment.text.trim().split(/\s+/)[index], style: prior?.style ?? editedStyle, settings } } };
    }));
  }

  const toggleWords=()=>{setSelectedWord(null);setSegments(current=>current.map(s=>s.id===separatedSegment?.id?{...s,wordsSeparated:!s.wordsSeparated}:s));};

  function undoCaptionEdit(){
    if(document.activeElement?.closest('.caption-timing-scroll,.subtitle-timeline')||separatedSegment?.role!=='title'){captionHistory.undo();return;}
    const scope=captionFamilyScope(separatedSegment.sourceCaptionId||separatedSegment.id);
    captionHistory.undoScoped(value=>scope.pick(value.segments),(value,before)=>({...value,segments:scope.merge(value.segments,before.segments)}));
  }
  useCaptionShortcuts({remove:()=>{if(positionScope.startsWith('group:')){setSegments(current=>deleteCaptionGroup(current,positionScope.slice(6)));return;}if(segments[activeSegment]){setSegments(current=>current.filter((_,i)=>i!==activeSegment));setActiveSegment(Math.max(0,activeSegment-1));setSelectedWord(null);}},split:toggleWords,scope:()=>{setSelectedWord(null);},undo:undoCaptionEdit,redo:captionHistory.redo,enabled:phase==='editing'&&!isRendering});
  const handleCaptionBounds = useCallback((bounds: CaptionBounds | null) => {
    setCaptionBounds((current) => JSON.stringify(current) === JSON.stringify(bounds) ? current : bounds);
  }, []);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [styleSaved, setStyleSaved] = useState(false);
  const [platformGuide, setPlatformGuide] = useState("instagram");


  const [cleanAudioRequest,setCleanAudioRequest]=useState(0);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("styles");
  useEffect(()=>{trackProduct("section_view",{section:inspectorTab});},[inspectorTab]);
  const [captionSelected, setCaptionSelected] = useState(false);
  const [captionSection,setCaptionSection]=useState<{view:'menu'|'text'|'animation'|'style';id:number}>();
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("original");
  const [voiceText, setVoiceText] = useState("");
  const [generatedVoiceUrl, setGeneratedVoiceUrl] = useState("");
  const [generatedVoiceMode, setGeneratedVoiceMode] = useState<
    "change" | "narrator" | null
  >(null);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isOpeningStudio, setIsOpeningStudio] = useState(false);
  const [voiceGenerationProgress, setVoiceGenerationProgress] = useState(0);
  const [voiceError, setVoiceError] = useState("");
  const [narratorMix, setNarratorMix] = useState<"mix" | "replace">("mix");
  const [originalVolume, setOriginalVolume] = useState(100);
  const [narratorStart, setNarratorStart] = useState(0);
  const [voiceStability, setVoiceStability] = useState(55);
  const [voiceSimilarity, setVoiceSimilarity] = useState(75);
  const [voiceSpeed, setVoiceSpeed] = useState(100);
  const [voiceChangeDuration, setVoiceChangeDuration] = useState(10);
  const [generatedVoiceStart, setGeneratedVoiceStart] = useState(0);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState("");
  const [originalMuted, setOriginalMuted] = useState(false);
  const [previewMuted,setPreviewMuted]=useState(false);
  const savedVoiceFile = useRef<{ url: string; file: File } | null>(null);

  async function projectSnapshot(): Promise<ProjectSnapshot> {
    const files: ProjectSnapshot['files'] = file ? [{ key: 'video', file }] : [];
    if (generatedVoiceUrl) {
      if (savedVoiceFile.current?.url !== generatedVoiceUrl) {
        const audio = await fetch(generatedVoiceUrl).then(response => response.blob());
        const wav = audio.type.includes('wav');
        savedVoiceFile.current = { url: generatedVoiceUrl, file: new File([audio], wav ? 'narator.wav' : 'narator.mp3', { type: audio.type || 'audio/mpeg' }) };
      }
      files.push({ key: 'voice', file: savedVoiceFile.current.file });
    }
    return { files, data: { videoName: file?.name, topics:topics||suggestTopics(segments.map(s=>s.text).join(' ')), segments, activeStyle, captionSettings, duration, videoAspect, languageCode, outputFormat,platformGuide,cropX,cropY,
      phase: phase === 'upload' ? 'upload' : 'editing', voiceMode, voiceText, selectedVoiceId,
      generatedVoiceMode, generatedVoiceStart, narratorMix, originalVolume, originalMuted, narratorStart,
      voiceStability, voiceSimilarity, voiceSpeed, voiceChangeDuration } };
  }
  function restoreProject(data: Record<string, unknown>, files: Map<string, File>) {
    if (!Array.isArray(data.segments) || !data.captionSettings || typeof data.captionSettings !== 'object'
      || typeof data.activeStyle !== 'string' || !templates.some(template => template.key === data.activeStyle)
      || !data.segments.every(segment => segment && typeof segment.text === 'string' && Number.isFinite(segment.start) && Number.isFinite(segment.end))) {
      throw new Error('Spremljeni titlovi nisu u podržanom formatu.');
    }
    analysisController.current?.abort(); analysisController.current = null; preparedAudio.current = null;
    videoRef.current?.pause(); voicePreviewRef.current?.pause();
    setAnalysis(null); setError(''); setRenderError(''); setVoiceError('');
    const video = files.get('video');
    setFile(video || null);
    setVideoUrl(current => { if (current) URL.revokeObjectURL(current); return video ? URL.createObjectURL(video) : ''; });
    const voice = files.get('voice');
    if (generatedVoiceUrl) URL.revokeObjectURL(generatedVoiceUrl);
    const voiceUrl = voice ? URL.createObjectURL(voice) : '';
    setGeneratedVoiceUrl(voiceUrl); savedVoiceFile.current = voice ? { url: voiceUrl, file: voice } : null;
    setTopics(data.topics&&typeof data.topics==='object'&&Array.isArray((data.topics as TranscriptTopics).keywords)?data.topics as TranscriptTopics:undefined);
    captionHistory.reset({segments:data.segments as Segment[],style:data.activeStyle as StyleKey,settings:{...DEFAULT_CAPTION_SETTINGS,...data.captionSettings as CaptionSettings}});
    setDuration(typeof data.duration === 'number' && data.duration > 0 ? data.duration : 9);
    setVideoAspect(typeof data.videoAspect === 'number' && data.videoAspect > 0 ? data.videoAspect : 16 / 9);
    setPlatformGuide(typeof data.platformGuide==='string'&&isSocialFormat(data.platformGuide)?data.platformGuide:'none');
    setOutputFormat(typeof data.outputFormat === 'string' && ['original','9:16','1:1','4:5','16:9'].includes(data.outputFormat) ? data.outputFormat : 'original');
    setCropX(typeof data.cropX==='number'?Math.max(0,Math.min(100,data.cropX)):50);setCropY(typeof data.cropY==='number'?Math.max(0,Math.min(100,data.cropY)):50);
    setLanguageCode(typeof data.languageCode === 'string' ? data.languageCode : 'bos');
    setActiveSegment(0); setCurrentTime(0); setCaptionSelected(false);
    setPhase(data.phase === 'upload' ? 'upload' : 'editing');
    setVoiceMode(voice && (data.voiceMode === 'change' || data.voiceMode === 'narrator') ? data.voiceMode : 'original');
    setGeneratedVoiceMode(voice && (data.generatedVoiceMode === 'change' || data.generatedVoiceMode === 'narrator') ? data.generatedVoiceMode : null);
    setVoiceText(typeof data.voiceText === 'string' ? data.voiceText : '');
    setSelectedVoiceId(typeof data.selectedVoiceId === 'string' ? data.selectedVoiceId : '');
    setNarratorMix(data.narratorMix === 'replace' ? 'replace' : 'mix');
    setOriginalMuted(data.originalMuted === true);
    setOriginalVolume(Number(data.originalVolume ?? 100)); setNarratorStart(Number(data.narratorStart ?? 0));
    setGeneratedVoiceStart(Number(data.generatedVoiceStart ?? 0)); setVoiceStability(Number(data.voiceStability ?? 55));
    setVoiceSimilarity(Number(data.voiceSimilarity ?? 75)); setVoiceSpeed(Number(data.voiceSpeed ?? 100));
    setVoiceChangeDuration(Number(data.voiceChangeDuration ?? 10));
  }
  const projectToolbar = <>{exportOptionsOpen&&<ExportOptionsDialog defaultName={`${file?.name.replace(/\.[^.]+$/, "")||"edita-video"}-sa-titlovima`} onClose={()=>setExportOptionsOpen(false)} onExport={options=>{setExportOptionsOpen(false);void exportVideo(options);}}/>}{(preparingExport||isRendering)&&<ExportProgressDialog message={preparingExport?'Spremamo izmjene prije izvoza…':'Izvoz videa je u toku…'} progress={isRendering?renderProgress:undefined}/>}<EditorLeaveGuard active={Boolean(file)} onSave={()=>saveHandle.current?.save()??Promise.resolve(false)}/><ProjectToolbar hasMedia={Boolean(file)} autoSaveKey={file&&phase==='editing'?JSON.stringify({segments,captionSettings,activeStyle,outputFormat,platformGuide,cropX,cropY,voiceMode,originalVolume,originalMuted,generatedVoiceStart,generatedVoiceUrl}):undefined} backgroundFile={backgroundFile} saveHandle={saveHandle} kind="subtitles" onPreview={url => setVideoUrl(url)} snapshot={projectSnapshot} restore={restoreProject}
    disabled={isRendering || isGeneratingVoice || isOpeningStudio} /></>;
  function editCaption(index:number){
    const segment=segments[index];if(!segment)return;
    videoRef.current?.pause();seekTo(index);setInspectorTab('captions');setActiveSegment(index);setSelectedWord(null);
    requestAnimationFrame(()=>{const input=Array.from(document.querySelectorAll<HTMLElement>('[data-caption-id]')).find(el=>el.dataset.captionId===segment.id)?.querySelector('textarea');input?.scrollIntoView({block:'nearest'});input?.focus({preventScroll:true});if(input)input.setSelectionRange(input.value.length,input.value.length);});
  }
  const waitingForCaptions = phase === "processing" || analysis?.stage === "error" || analysis?.stage === "cancelled";
  const sampleSegments = useMemo<Segment[]>(() => [{ id: "style-preview-only", text: "Titlovi u pripremi", start: 0, end: Math.max(duration, 1) }], [duration]);

  const activeCaptionSegment = useMemo(() => {
    const chosen=segments[activeSegment];if(chosen&&currentTime>=chosen.start&&currentTime<chosen.end)return chosen;
    const timed = segments.findIndex(
      (s) => currentTime >= s.start && currentTime < s.end,
    );
    return segments[timed >= 0 ? timed : activeSegment];
  }, [activeSegment, currentTime, segments]);
  const activeCaption = activeCaptionSegment?.text ?? "";
  const filteredVoices = voices;
  const selectedVoice = voices.find((voice) => voice.id === selectedVoiceId);
  const overlayStyle = {
    display: captionBounds ? "block" : "none",
    left: `${captionBounds?.x ?? captionSettings.x}%`,
    top: `${captionBounds?.y ?? captionSettings.y}%`,
    width: `${captionBounds?.width ?? 0}%`,
    height: `${captionBounds?.height ?? 0}%`,
    transform: `translate(-50%, -50%) rotate(${captionBounds?.rotation ?? captionSettings.rotation}deg)`,
  } as React.CSSProperties;

  function moveCaption(event: React.PointerEvent<HTMLDivElement>) {
    const frame = event.currentTarget.parentElement?.getBoundingClientRect();
    const drag = captionDragPointer.current;
    if (!frame || !drag || drag.pointerId !== event.pointerId) return;
    let x = Math.max(
      -200,
      Math.min(
        300,
        ((event.clientX + drag.offsetX - frame.left) / frame.width) * 100,
      ),
    );
    let y = Math.max(
      -200,
      Math.min(
        300,
        ((event.clientY + drag.offsetY - frame.top) / frame.height) * 100,
      ),
    );
    const snapY=[25,50,75].find(point=>Math.abs(y-point)<1.5);setCenterGuides({x:Math.abs(x-50)<1.5,y:snapY??null});if(Math.abs(x-50)<1.5)x=50;if(snapY!==undefined)y=snapY;
    x += drag.anchorDeltaX;
    y += drag.anchorDeltaY;
    const position: CaptionPosition = y < 34 ? "top" : y > 67 ? "bottom" : "middle";
    if(positionScope==='titles'){setSegments(current=>updateTitleStyles(current,{x,y,position}));}
    else if (positionScope === 'scene') {
      setSegments(current => current.map(segment => segment.id === captionBounds?.segmentId ? { ...segment, separateStyle:true, detachedStyle:{style:segment.detachedStyle?.style||segment.laneStyle?.style||activeStyle,settings:{...(segment.detachedStyle?.settings||segment.laneStyle?.settings||captionSettings),x,y,position}}, position:undefined, ...(segment.role==='title'?{titleOverrides:{...segment.titleOverrides,x,y,position}}:{}) } : segment));
    } else {
      setSegments(current=>styleCaptionLane(current,0,editedStyle,{...editedSettings,x,y,position},positionScope.startsWith('group:')?positionScope.slice(6):undefined));
    }
  }

  function moveWord(segmentId: string, index: number, dx: number, dy: number) {
    setSegments(current => current.map(segment => {
      if (segment.id !== segmentId) return segment;
      const text = segment.text.trim().split(/\s+/)[index];
      const old = segment.wordOffsets?.[index];
      return { ...segment, wordOffsets: { ...segment.wordOffsets, [index]: {
        text, x: (old?.text === text ? old.x : 0) + dx, y: (old?.text === text ? old.y : 0) + dy,
      } } };
    }));
  }

  function startCaptionDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    if((event.ctrlKey||event.metaKey)&&captionBounds){const index=segments.findIndex(s=>s.id===captionBounds.segmentId);setActiveSegment(index);setSelectedWord(null);setCaptionSelected(true);return;}
    setInspectorTab('settings');captionHistory.begin();if(captionBounds){const index=segments.findIndex(s=>s.id===captionBounds.segmentId);setActiveSegment(index);}setCaptionSelected(true);
    const caption = event.currentTarget.getBoundingClientRect();
    const target = resolveCaptionSuggestions(segments).find(segment=>segment.id===captionBounds?.segmentId);
    const anchor = {...(target?.detachedStyle?.settings||target?.laneStyle?.settings||captionSettings),...target?.position};
    captionDragPointer.current = {
      pointerId: event.pointerId,
      anchorDeltaX: anchor.x-(captionBounds?.x??anchor.x),
      anchorDeltaY: anchor.y-(captionBounds?.y??anchor.y),
      offsetX: caption.left + caption.width / 2 - event.clientX,
      offsetY: caption.top + caption.height / 2 - event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function continueCaptionDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (captionDragPointer.current?.pointerId === event.pointerId) moveCaption(event);
  }

  function stopCaptionDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (captionDragPointer.current?.pointerId !== event.pointerId) return;
    captionHistory.end();setCenterGuides({x:false,y:null});captionDragPointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function startCaptionTransform(
    event: React.PointerEvent<HTMLButtonElement>,
    mode: "resize" | "rotate",
  ) {
    event.preventDefault();
    event.stopPropagation();
    if((event.ctrlKey||event.metaKey)&&captionBounds){const index=segments.findIndex(s=>s.id===captionBounds.segmentId);setActiveSegment(index);setSelectedWord(null);setCaptionSelected(true);return;}
    setInspectorTab('settings');captionHistory.begin();if(captionBounds){const index=segments.findIndex(s=>s.id===captionBounds.segmentId);setActiveSegment(index);}setCaptionSelected(true);
    const caption = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!caption) return;
    const centerX = caption.left + caption.width / 2;
    const centerY = caption.top + caption.height / 2;
    captionTransformGesture.current = {
      mode,
      pointerId: event.pointerId,
      centerX,
      centerY,
      startDistance: Math.max(1, Math.hypot(event.clientX - centerX, event.clientY - centerY)),
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
      startScale: editedSettings.fontScale,
      startRotation: editedSettings.rotation,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function continueCaptionTransform(event: React.PointerEvent<HTMLButtonElement>) {
    const gesture = captionTransformGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (gesture.mode === "resize") {
      const distance = Math.max(
        1,
        Math.hypot(event.clientX - gesture.centerX, event.clientY - gesture.centerY),
      );
      const fontScale = Math.round(
        Math.max(isPresetCaptionStyle(editedStyle)?10:40, Math.min(isPresetCaptionStyle(editedStyle)?400:600, gesture.startScale * (distance / gesture.startDistance))),
      );
      setEditedSettings(current=>({...current,fontScale,fontSizePx:isPresetCaptionStyle(editedStyle)?current.fontSizePx:current.fontSizePx?current.fontSizePx*fontScale/Math.max(1,current.fontScale):undefined}));
      return;
    }
    const angle = Math.atan2(event.clientY - gesture.centerY, event.clientX - gesture.centerX);
    let angleDelta = angle - gesture.startAngle;
    if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
    const rawRotation = gesture.startRotation + (angleDelta * 180) / Math.PI;
    const rotation = Math.round(((rawRotation + 180) % 360 + 360) % 360 - 180);
      setEditedSettings(current=>({...current,rotation}));
  }

  function stopCaptionTransform(event: React.PointerEvent<HTMLButtonElement>) {
    const gesture = captionTransformGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    captionHistory.end();captionTransformGesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function playVoicePreview(voice: VoiceOption) {
    if (!voice.previewUrl) return;
    setVoicePreviewUrl(voice.previewUrl);
    if(voicePreviewRef.current?.src===voice.previewUrl)void voicePreviewRef.current.play().catch(()=>setVoiceError('Uzorak nije moguće pustiti.'));
  }

  async function generateVoice(nextMode: "change" | "narrator") {
    if (waitingForCaptions) return;
    if (!selectedVoiceId) {
      setVoiceError("Prvo odaberi glas.");
      return;
    }
    if (nextMode === "change" && !file) {
      setVoiceError("Za promjenu glasa prvo učitaj video.");
      return;
    }
    if (nextMode === "narrator" && !voiceText.trim()) {
      setVoiceError("Upiši tekst koji narator treba pročitati.");
      return;
    }

    setIsGeneratingVoice(true);
    setVoiceGenerationProgress(4);
    setVoiceError("");
    let decodeContext: AudioContext | undefined;
    try {
      let response: Response;
      if (nextMode === "change") {
        decodeContext = new AudioContext();
        let sourceAudio: AudioBuffer;
        try {
          sourceAudio = await decodeContext.decodeAudioData(await file!.arrayBuffer());
        } catch {
          await decodeContext.close();
          throw new Error(
            "Preglednik nije mogao izdvojiti zvuk iz ovog videa. Probaj MP4, MOV ili WebM sa standardnim AAC/Opus zvukom.",
          );
        }
        const conversionStart = voiceChangeDuration
          ? Math.min(Math.max(0, videoRef.current?.currentTime ?? 0), Math.max(0, sourceAudio.duration - 0.1))
          : 0;
        const conversionEnd = voiceChangeDuration
          ? Math.min(sourceAudio.duration, conversionStart + voiceChangeDuration)
          : sourceAudio.duration;
        const conversionDuration = Math.max(0.1, conversionEnd - conversionStart);
        const chunkSeconds = 270;
        const chunkCount = Math.ceil(conversionDuration / chunkSeconds);
        const convertedChunks: AudioBuffer[] = [];
        for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
          const start = conversionStart + chunkIndex * chunkSeconds;
          const end = Math.min(conversionEnd, start + chunkSeconds);
          const body = new FormData();
          body.append(
            "audio",
            audioBufferSegmentToWav(sourceAudio, start, end, 16000),
            `glas-${chunkIndex + 1}.wav`,
          );
          body.append("model_id", "eleven_multilingual_sts_v2");
          body.append("remove_background_noise", "false");
          body.append(
            "voice_settings",
            JSON.stringify({
              stability: voiceStability / 100,
              similarity_boost: voiceSimilarity / 100,
              style: 0,
              use_speaker_boost: true,
            }),
          );
          response = await apiFetch(
            `/api/voice-change?voiceId=${encodeURIComponent(selectedVoiceId)}`,
            { method: "POST", body },
          );
          if (!response.ok) {
            const result = (await response.json().catch(() => ({}))) as {
              error?: string;
            };
            await decodeContext.close();
            throw new Error(result.error || `Promjena glasa nije uspjela u dijelu ${chunkIndex + 1}.`);
          }
          convertedChunks.push(
            await decodeContext.decodeAudioData(await response.arrayBuffer()),
          );
          setVoiceGenerationProgress(
            Math.round(((chunkIndex + 1) / chunkCount) * 92),
          );
        }
        const audio = audioBuffersToWav(convertedChunks);
        await decodeContext.close();
        const nextUrl = URL.createObjectURL(audio);
        setGeneratedVoiceUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return nextUrl;
        });
        setGeneratedVoiceMode(nextMode);
        setGeneratedVoiceStart(conversionStart);
        setVoiceMode(nextMode);
        setVoiceGenerationProgress(100);
        return;
      } else {
        response = await apiFetch("/api/narration", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            voiceId: selectedVoiceId,
            text: voiceText.trim(),
            stability: voiceStability / 100,
            similarity: voiceSimilarity / 100,
            speed: voiceSpeed / 100,
          }),
        });
      }

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error || "Pravljenje glasa nije uspjelo.");
      }
      const audio = await response.blob();
      if (!audio.size) throw new Error("ElevenLabs nije vratio zvuk.");
      const nextUrl = URL.createObjectURL(audio);
      setGeneratedVoiceUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
      setGeneratedVoiceMode(nextMode);
      setGeneratedVoiceStart(Math.max(0, narratorStart));
      setVoiceMode(nextMode);
      setVoiceGenerationProgress(100);
    } catch (generationError) {
      setVoiceError(
        generationError instanceof Error
          ? (generationError instanceof TypeError ? "Veza sa serverom je prekinuta. Provjeri vezu i pokušaj ponovo." : generationError.message)
          : "Pravljenje glasa nije uspjelo.",
      );
    } finally {
      if (decodeContext && decodeContext.state !== "closed") await decodeContext.close().catch(() => {});
      setIsGeneratingVoice(false);
    }
  }

  async function transferGeneratedVoice() {
    if(!file)return;
    await saveVideoStudioHandoff((session.user?.id??0),file,generatedVoiceUrl,
      originalMuted||voiceMode==='change'||narratorMix==='replace',generatedVoiceStart,
      {segments,activeStyle,captionSettings,topics:topics||suggestTopics(segments.map(s=>s.text).join(' '))},narratorMix==='mix'?originalVolume:100);
  }
  async function openGeneratedVoiceInStudio() {
    if (!file || !generatedVoiceUrl) return;
    setIsOpeningStudio(true);
    setVoiceError("");
    try {
      await transferGeneratedVoice();
      allowEditorLeave(); window.location.assign("/video-editor?handoff=1");
    } catch {
      setVoiceError("Nije moguće prenijeti video u studio. Oslobodi prostor u pregledniku i pokušaj ponovo.");
      setIsOpeningStudio(false);
    }
  }
  const chooseFile = useCallback((nextFile?: File) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("video/")) {
      setError("Odaberi video u MP4, MOV ili WebM formatu.");
      return;
    }
    analysisController.current?.abort();
    analysisController.current = null;
    preparedAudio.current = null;
    trackProduct("media_selected");
    setBackgroundFile(null);
    setAnalysis(null);
    resetCaptionHistory({segments:[],style:initialTemplate().key,settings:settingsForTemplate(initialTemplate())});setTopics(undefined);
    setActiveSegment(0);
    setCurrentTime(0);
    setVideoAspect(16 / 9);
    setFile(nextFile);
    setPlatformGuide('instagram');setOutputFormat('9:16');
    setVideoUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(nextFile);
    });
    setError("");
    void analysisStarter.current?.(nextFile);
  }, [resetCaptionHistory]);
  const consumedHandoff=useRef(false);
  useEffect(() => {
    if (consumedHandoff.current || !new URLSearchParams(window.location.search).has('handoff') || new URLSearchParams(window.location.search).has('project') || new URLSearchParams(window.location.search).has('new')) return;
    void loadVideoStudioHandoff((session.user?.id??0), 'subtitles').then(handoff => {
      if (!handoff || consumedHandoff.current) return;
      consumedHandoff.current=true;
      if (handoff.captions) {restoreProject({...handoff.captions, phase:'editing'}, new Map([['video',handoff.video]]));setBackgroundFile(handoff.video);}
      else chooseFile(handoff.video);
    })
      .catch(() => setError('Preneseni video nije moguće otvoriti. Pokušaj ponovo iz video studija.'));
    // Consume once per signed-in user; restoring changes editor state, not this handoff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user, chooseFile]);
  async function startAnalysis(source = file) {
    if (!source || analysisController.current) return;
    const controller = new AbortController();
    analysisController.current = controller;
    trackProduct("recognition_start");
    const signal = controller.signal;
    const startedAt = Date.now();
    const update = (value: Partial<AnalysisStatus>) => {
      if (analysisController.current === controller && !signal.aborted)
        setAnalysis((current) => ({ stage: "preparing", startedAt, ...current, ...value }));
    };
    setPhase("processing");
    setAnalysis({ stage: "preparing", startedAt });
    // Keep current captions until replacement recognition succeeds.
    setInspectorTab("styles");
    setError("");
    try {
      let audio = preparedAudio.current?.file === source ? preparedAudio.current.audio : undefined;
      if (!audio) {
        const { prepareTranscriptionAudio } = await import("../../lib/prepare-transcription-audio");
        audio = await prepareTranscriptionAudio(source, signal, (percent) => update({ percent }));
        signal.throwIfAborted();
        preparedAudio.current = { file: source, audio };
      }
      update({ stage: "connecting", percent: undefined, audioOnly: audio.audioOnly, uploadBytes: audio.blob.size, originalBytes: source.size });
      // Mint after preparation: a single-use token must not age while a large file is read.
      const tokenResponse = await apiFetch("/api/transcribe", { method: "POST", signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) });
      const tokenResult = (await tokenResponse.json()) as {
        token?: string;
        proxy?: boolean;
        error?: string;
      };
      if (!tokenResponse.ok || (!tokenResult.token && !tokenResult.proxy))
        throw new Error(
          tokenResult.error ||
            "Servis za transkripciju trenutno nije dostupan.",
        );
      signal.throwIfAborted();
      update({ stage: "uploading", percent: 0 });
      const body = transcriptionBody(audio, languageCode);
      body.append("operationId",crypto.randomUUID());
      const result = await uploadForTranscript(tokenResult.token || "", body, signal,
        (percent) => update({ stage: "uploading", percent }),
        () => { update({ stage: "recognizing", percent: undefined }); setBackgroundFile(source); }, tokenResult.proxy ? await csrfToken() : undefined);
      signal.throwIfAborted();
      if (analysisController.current !== controller) return;
      const alignedWords = alignTranscriptWords(result.words || [], audio.offset);
      const actualDuration = videoRef.current?.duration;
      const nextSegments = wordsToSegments(
        alignedWords,
        // Full text must not restore words removed with a negative codec/edit-list offset.
        alignedWords.length === (result.words || []).length ? result.text || "" : alignedWords.map((word) => word.text || "").join(" "),
        actualDuration && Number.isFinite(actualDuration) ? actualDuration : duration,
      );
      setSegments(nextSegments);setTopics(undefined);trackProduct("recognition_success");
      setActiveSegment(0);
      update({ stage: "done", percent: undefined, message: nextSegments.length ? undefined : "U snimku nije prepoznat govor. Možeš ručno dodati ili uvesti titlove." });
      setPhase("editing");
    } catch (analysisError) {
      if (signal.aborted || analysisController.current !== controller) return;
      trackProduct("recognition_error");
      setPhase("editing");
      update({ stage: "error", percent: undefined, message: analysisError instanceof Error && analysisError.name === "TimeoutError"
        ? "Povezivanje traje predugo. Provjeri internet i pokušaj ponovo."
        : analysisError instanceof Error ? analysisError.message : "Došlo je do greške. Pokušaj ponovo." });
    } finally {
      if (analysisController.current === controller) { analysisController.current = null; setBackgroundFile(source); }
    }
  }
  useEffect(() => { analysisStarter.current = startAnalysis; });
  function cancelAnalysis() {
    trackProduct("recognition_cancel");
    analysisController.current?.abort();
    analysisController.current = null;
    setAnalysis((current) => current ? { ...current, stage: "cancelled", percent: undefined } : null);
    setPhase("editing");
  }
  function returnToUpload() {
    analysisController.current?.abort();
    analysisController.current = null;
    setPhase("upload");
  }
  function openDemo() {
    analysisController.current?.abort();
    analysisController.current = null;
    setAnalysis(null);
    setSegments(demoSegments);
    setError("");
    setPhase("editing");
  }
  function updateSegment(id: string, text: string) {
    setSegments((current) =>
      current.map((segment) =>
        segment.id === id ? { ...segment, text, wordOffsets: undefined, wordStyles: undefined } : segment,
      ),
    );
  }
  function addSegment() {
    const last = segments.filter(s=>(s.lane||0)===(0)).at(-1);
    const start = Math.min(last?.end ?? 0,Math.max(0,duration-.1));
    setSegments((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        start,
        end: Math.min(start + 2.5, duration || start + 2.5),
        text: "Novi titl",lane:0,laneStyle:separatedSegment?.laneStyle,
      },
    ]);
  }

  function replaceAll() {
    if (!findText) return;
    const expression = new RegExp(
      findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "gi",
    );
    setSegments((current) =>
      current.map((segment) => ({
        ...segment,
        text: segment.text.replace(expression, replaceText),
      })),
    );
  }
  function selectTemplate(template: CaptionTemplate) {
    if(isPresetCaptionStyle(template.key)&&separatedSegment&&(selectedWordData||positionScope==='scene')){setSelectedWord(null);const next=settingsForTemplate(template,sourceSettings);setSegments(current=>applyPresetCaptionStyle(current,[separatedSegment.id],template.key,next,true,true));return;}
    if (selectedWordData) {
      const { segmentId, index } = selectedWordData;
      setSegments(current => current.map(segment => segment.id !== segmentId ? segment : { ...segment, wordStyles: { ...segment.wordStyles,
        [index]: { linked:false, text: segment.text.trim().split(/\s+/)[index], style: template.key, settings: settingsForTemplate(template, editedSettings) },
      } }));
      return;
    }
    if(positionScope==='titles'){const next=settingsForTemplate(template,editedSettings);setSegments(current=>current.map(s=>s.role==='title'?{...s,titleStyle:template.key,titleOverrides:{...s.titleOverrides,...next},position:undefined,detachedStyle:{style:template.key,settings:next}}:s));return;}
    if(separatedSegment?.role==='title'&&positionScope==='scene'){const next=settingsForTemplate(template,editedSettings);setSegments(current=>current.map(s=>s.id===separatedSegment.id?{...s,titleStyle:template.key,titleOverrides:{...s.titleOverrides,...next},separateStyle:true,detachedStyle:{style:template.key,settings:next}}:s));return;}
    if(separatedSegment&&(positionScope==='scene')) {setSegments(current=>current.map(s=>s.id===styleOwner?.id?{...s,position:undefined,separateStyle:true,detachedStyle:{style:template.key,settings:settingsForTemplate(template,sourceSettings)}}:s));return;}
    setSegments(current=>styleCaptionLane(current,0,template.key,settingsForTemplate(template,editedSettings),positionScope.startsWith('group:')?positionScope.slice(6):undefined));
  }
  async function importSubtitles(event: ChangeEvent<HTMLInputElement>) {
    const subtitleFile = event.target.files?.[0];
    if (!subtitleFile) return;
    try {
      const imported = parseSubtitleText(
        await subtitleFile.text(),
        subtitleFile.name,
        duration,
      );
      if (!imported.length)
        throw new Error("Titlovi nisu prepoznati u datoteci.");
      setSegments(imported);
      setActiveSegment(0);
      setCurrentTime(0);
      setRenderError("");
    } catch (importError) {
      setRenderError(
        importError instanceof Error
          ? importError.message
          : "Uvoz titlova nije uspio.",
      );
    } finally {
      event.target.value = "";
    }
  }
  function saveStyle() {
    localStorage.setItem(
      `titl-caption-style:${session.user?.id}`,
      JSON.stringify({ style: editedStyle, settings: editedSettings }),
    );
    setStyleSaved(true);
    window.setTimeout(() => setStyleSaved(false), 1800);
  }
  function loadStyle() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`titl-caption-style:${session.user?.id}`) || "",
      ) as { style?: StyleKey; settings?: Partial<CaptionSettings> };
      if (!saved.style || !saved.settings || !templates.some(template=>template.key===saved.style)) throw new Error('Invalid style');
      const style=saved.style,settings={...editedSettings,...saved.settings};
      if(positionScope==='scene'&&separatedSegment)setSegments(current=>current.map(s=>s.id===styleOwner?.id?{...s,detachedStyle:{style,settings}}:s));
      else setSegments(current=>styleCaptionLane(current,0,style,settings,positionScope.startsWith('group:')?positionScope.slice(6):undefined));
    } catch {
      setRenderError("Nema sačuvanog stila na ovom uređaju.");
    }
  }
  function seekTo(index: number) {
    setActiveSegment(index);setSelectedWord(null);
    const target = segments[index]?.start ?? 0;
    setCurrentTime(target);
    if (videoRef.current) videoRef.current.currentTime = target;
  }
  function exportCaptions(format: "srt" | "vtt" | "txt") {
    if (waitingForCaptions) return;
    const vtt = format === "vtt";
    const content =
      format === "txt"
        ? segments.map((segment) => segment.text).join("\n")
        : `${vtt ? "WEBVTT\n\n" : ""}${segments.map((segment, index) => `${vtt ? "" : `${index + 1}\n`}${srtTime(captionOutputTime(segment.start), vtt)} --> ${srtTime(captionOutputTime(segment.end), vtt)}\n${segment.text}\n`).join("\n")}`;
    const blob = new Blob([content], {
      type:
        format === "txt"
          ? "text/plain"
          : vtt
            ? "text/vtt"
            : "application/x-subrip",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${file?.name.replace(/\.[^.]+$/, "") || "titlovi"}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  useCaptionSounds(captionSounds(segments,captionSettings),videoRef);
  async function exportVideo(exportOptions:ExportOptions={quality:"full"}) {
    if (waitingForCaptions) return;
    if (!file || !videoUrl || isRendering || repairBusy || exportPending.current) return;
    if(!session.user){exportPending.current=true;setPreparingExport(true);try{await loginForDownload('subtitles',projectSnapshot);}catch(cause){setRenderError(cause instanceof Error?cause.message:'Video nije sačuvan. Ostaješ u editoru.');}finally{exportPending.current=false;setPreparingExport(false);}return;}
    if (voiceMode === "change" && voiceChangeDuration > 0) {
      setRenderError("Kratki glas je samo test. Za završni izvoz odaberi ‘Cijeli video’ i napravi glas ponovo.");
      return;
    }
    if (
      voiceMode !== "original" &&
      (!generatedVoiceUrl || generatedVoiceMode !== voiceMode)
    ) {
      setRenderError("Prvo napravi odabrani glas ili naratora.");
      return;
    }
    exportPending.current=true;setPreparingExport(true);videoRef.current?.pause();
    setRenderError('Čekam završetak uploada i spremam izmjene…');
    let saved=false;
    try{saved=!!await saveHandle.current?.save();}
    catch(cause){setRenderError(cause instanceof Error?cause.message:'Spremanje prije izvoza nije uspjelo. Pokušaj ponovo.');return;}
    finally{exportPending.current=false;setPreparingExport(false);}
    if(!saved){setRenderError('Spremanje nije završeno. Izmjene ostaju u editoru; pokušaj ponovo.');return;}
    trackProduct("export_start");
    setIsRendering(true);
    setRenderProgress(0);
    setRenderError("");
    try {
      if(captionNeedsPerson(activeStyle,captionSettings,segments))await preparePersonMask();
      await document.fonts.ready;
      const includeOriginal=voiceMode==='original'||(voiceMode==='narrator'&&narratorMix==='mix');
      const sources=[{id:'original',file:preparedBrowserFile(file),start:0,inPoint:0,outPoint:duration,video:true,volume:includeOriginal&&!originalMuted?originalVolume/100:0}];
      if(voiceMode!=='original'&&generatedVoiceUrl){const response=await fetch(generatedVoiceUrl);if(!response.ok)throw new Error('Generisani glas nije dostupan.');const blob=await response.blob();sources.push({id:'voice',file:new File([blob],'voice',{type:blob.type}),start:generatedVoiceStart,inPoint:0,outPoint:Math.max(0,duration-generatedVoiceStart),video:false,volume:1});}
      const layer=document.createElement('canvas');let cache:{context:CanvasRenderingContext2D;key:string}|undefined;
      const output=await offlineExport({...exportOptions,textureFills:{activeStyle,captionSettings,segments},serifTextures:activeStyle==='testSerif'||segments.some(s=>s.detachedStyle?.style==='testSerif'||s.laneStyle?.style==='testSerif'||s.titleStyle==='testSerif'||Object.values(s.wordStyles||{}).some(w=>w.style==='testSerif')),goldTextures:activeStyle==='goldMesh'||segments.some(s=>s.detachedStyle?.style==='goldMesh'||s.laneStyle?.style==='goldMesh'||s.titleStyle==='goldMesh'||Object.values(s.wordStyles||{}).some(w=>w.style==='goldMesh')),sounds:captionSounds(segments,captionSettings),clips:sources,duration,aspect:outputAspect,sourceTiming:true,progress:setRenderProgress,draw:(ctx,time,frames)=>{
        const frame=frames.get('original');if(!frame)throw new Error('Nedostaje kadar originalnog videa.');
        if(!cache){layer.width=ctx.canvas.width;layer.height=ctx.canvas.height;cache={context:layer.getContext('2d')!,key:''};}
        frame.currentTime=time;drawBurnedFrame(ctx,frame,segments,activeStyle,captionSettings,cache,cropX,cropY,duration);
      }});
      await checkExportQuota(output);
      if(session.user)await rememberExport(output,(session.user?.id??0),'subtitles',await projectSnapshot()).catch(()=>{});
      const url=URL.createObjectURL(output),link=document.createElement('a');link.href=url;link.download=exportOptions.filename||`${file.name.replace(/\.[^.]+$/, '')}-sa-titlovima.mp4`;link.click();trackProduct("export_success");trackExportStyles(segments,activeStyle);setTimeout(()=>URL.revokeObjectURL(url),60000);
    } catch(error){trackProduct("export_error");reportEditorFailure("export");setRenderError(error instanceof Error?error.message:'Izvoz nije uspio. Izmjene su sačuvane.');}
    finally{setIsRendering(false);}
  }

  useEffect(() => {
    return () => { analysisController.current?.abort(); preparedAudio.current = null; };
  }, []);

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);



  useEffect(() => {
    if (phase !== "editing" || waitingForCaptions || inspectorTab !== "voice" || voices.length) return;
    const controller = new AbortController();
    void apiFetch("/api/voices", { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as {
          voices?: VoiceOption[];
          error?: string;
        };
        if (!response.ok) throw new Error(result.error || "Glasovi nisu dostupni.");
        const nextVoices = result.voices ?? [];
        setVoices(nextVoices);
        setSelectedVoiceId((current) => current || nextVoices[0]?.id || "");
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setVoiceError(
          loadError instanceof Error ? loadError.message : "Glasovi nisu dostupni.",
        );
      });
    return () => controller.abort();
  }, [phase, waitingForCaptions, inspectorTab, voices.length]);


  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: "configure_subtitle_style",
          title: "Postavi stil titlova",
          description:
            "Postavlja vidljivi stil titlova u otvorenom Titl uređivaču.",
          inputSchema: {
            type: "object",
            properties: {
              style: {
                type: "string",
                enum: visibleTemplates.map((template) => template.key),
              },
            },
            required: ["style"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input: unknown) {
            const style = (input as { style?: StyleKey })?.style;
            if (!style || !templates.some((template) => template.key === style))
              throw new Error("Nepoznat stil titlova.");
            setActiveStyle(style);
            const template = templates.find((item) => item.key === style)!;
            setCaptionSettings((current) => settingsForTemplate(template, current));
            return { style };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [setActiveStyle,setCaptionSettings]);

  if (phase !== "upload")
    return (
      <main className="subtitle-app subtitle-editor-page" onPointerDownCapture={e=>{if((e.target as HTMLElement).closest('input[type=range],.caption-word-handle'))captionHistory.begin();}} onPointerUpCapture={captionHistory.end} onPointerCancelCapture={captionHistory.end}>
        {projectToolbar}

        <SaveBeforeLeaving open={leaveUpload} title="Vratiti se na početak?" description="Spremi izmjene prije izlaska iz videa." saveLabel="Spremi i izađi" continueLabel="Izađi bez spremanja" onCancel={()=>setLeaveUpload(false)} onSave={()=>saveHandle.current?.save()??Promise.resolve(false)} onContinue={()=>{setLeaveUpload(false);returnToUpload();}}/>
        <SaveBeforeLeaving open={videoEditorPrompt} title="Nastavi u Video editoru?" description="Video, tekst titlova i odabrani stil prenose se zajedno. U Video editoru možeš nastaviti mijenjati titlove i uključiti ih u preuzeti video." onCancel={()=>setVideoEditorPrompt(false)} onContinue={()=>void openVideoEditor()} onSave={()=>saveHandle.current?.save() ?? Promise.resolve(false)} />

        <div className={`subtitle-editor-shell${dockHidden?' caption-dock-hidden':''}`}>
          <EditorInspector activeTab={inspectorTab} onTabChange={setInspectorTab}
            status={<>{selectedWordData && <div className="subtitle-word-editing">Riječ: <b>{separatedSegment?.text.trim().split(/\s+/)[selectedWordData.index]}</b><button type="button" onClick={() => setSelectedWord(null)}>Uredi cijeli titl</button>{separatedSegment&&<CaptionWordLink segment={separatedSegment} index={selectedWordData.index} style={editedStyle} settings={editedSettings} onChange={next=>setSegments(current=>current.map(s=>s.id===next.id?next:s))}/> }</div>}</>}>
            <InspectorPanel id="media" activeTab={inspectorTab}><div className="caption-source-panel"><h2>Izvorni video</h2><div className="caption-source-file"><StudioIcon name="video"/><div><strong>{file?.name||'Video za titlove'}</strong><small>{duration>0?Math.floor(duration/60)+':'+String(Math.floor(duration%60)).padStart(2,'0'):''}</small></div></div><button type="button" disabled={waitingForCaptions||isRendering} onClick={()=>setLeaveUpload(true)}><StudioIcon name="plus"/> Odaberi drugi video</button>{session.user&&inspectorTab==='media'&&<AssetLibrary/>}</div></InspectorPanel>
            <InspectorPanel id="captions" activeTab={inspectorTab}><button type="button" className="caption-recognize-again" disabled={!file||waitingForCaptions||isRendering||repairBusy} title="Ponovo prepoznaj govor; uspješan rezultat zamjenjuje postojeće titlove" onClick={()=>void startAnalysis()}>{waitingForCaptions?"Prepoznavanje…":"Prepoznaj titlove"}</button><CaptionNumberToggle disabled={!segments.length||isRendering} onApply={mode=>{setSelectedWord(null);setSegments(current=>formatCaptionNumbers(current,mode));}}/>
            {waitingForCaptions && <p className="subtitle-wait-note">Ovdje će stići prepoznate riječi. U karticama Stilovi i Postavke već možeš pripremiti njihov izgled.</p>}
            <fieldset className="subtitle-pending-fields" disabled={waitingForCaptions}>
            <div className="subtitle-transcript-panel">
            <div className="subtitle-transcript-head">
              <div>
                <span>
                  <Icon name="sparkle" />
                </span>
                <div>
                  <strong>Tekst titlova</strong>
                </div>
              </div>
              <em>{segments.length} scena</em>
            </div>
            <CaptionTimingShift segments={segments} duration={duration} disabled={isRendering} onBegin={captionHistory.begin} onEnd={captionHistory.end} onChange={setSegments}/><div className="subtitle-caption-file-actions" role="group" aria-label="Uvoz i izvoz titlova">
            <button
              type="button"
              disabled={isRendering}
              onClick={() => subtitleInputRef.current?.click()}
            >
              Uvezi
            </button>
            <input
              ref={subtitleInputRef}
              type="file"
              accept=".srt,.vtt,.txt,.ass,.ssa"
              onChange={(event) => void importSubtitles(event)}
              hidden
            />
            <button
              type="button"
              disabled={isRendering}
              onClick={() => exportCaptions("txt")}
            >
              TXT
            </button>
            <button
              type="button"
              disabled={isRendering}
              onClick={() => exportCaptions("vtt")}
            >
              VTT
            </button>
            <button
              type="button"
              disabled={isRendering}
              onClick={() => exportCaptions("srt")}
            >
              SRT
            </button>

            </div>
            <div className="subtitle-edit-toolbar">

              <div className="subtitle-find-tools">
                <input
                  aria-label="Pronađi tekst"
                  placeholder="Pronađi"
                  value={findText}
                  onChange={(event) => setFindText(event.target.value)}
                />
                <input
                  aria-label="Zamijeni tekst"
                  placeholder="Zamijeni sa"
                  value={replaceText}
                  onChange={(event) => setReplaceText(event.target.value)}
                />
                <button type="button" onClick={replaceAll}>
                  Zamijeni sve
                </button>
              </div>
            </div>
            <CaptionWordsPanel segments={segments} selectedId={separatedSegment?.id} scope="all" style={editedStyle} settings={sourceSettings} onChange={setSegments}/><div className="subtitle-segment-list subtitle-text-rows">
              {segments.map((segment,index) => <article key={segment.id} data-caption-id={segment.id} className={index === activeSegment ? 'active' : ''} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='move';}} onDrop={event=>{event.preventDefault();if(draggedCaption.current){setSegments(current=>reorderCaptions(current,draggedCaption.current!,segment.id));draggedCaption.current=null;}}}>
                <button className="subtitle-reorder-grip" type="button" title="Povuci za promjenu redoslijeda" aria-label={`Premjesti titl ${index+1}`} onPointerDown={event=>{event.preventDefault();draggedCaption.current=segment.id;event.currentTarget.setPointerCapture(event.pointerId);}} onPointerUp={event=>{const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-caption-id]')?.getAttribute('data-caption-id');const source=draggedCaption.current;if(source&&target)setSegments(current=>reorderCaptions(current,source,target));draggedCaption.current=null;event.currentTarget.releasePointerCapture(event.pointerId);}} onPointerCancel={()=>{draggedCaption.current=null;}} onKeyDown={event=>{if(event.altKey&&(event.key==='ArrowUp'||event.key==='ArrowDown')){event.preventDefault();const next=segments[index+(event.key==='ArrowUp'?-1:1)];if(next)setSegments(current=>reorderCaptions(current,segment.id,next.id));}}}><svg viewBox="0 0 16 24" aria-hidden="true"><path d="M5 6h.01M11 6h.01M5 12h.01M11 12h.01M5 18h.01M11 18h.01"/></svg></button>
                <textarea rows={1} aria-label={`Tekst titla ${index+1}`} value={segment.text} onFocus={() => seekTo(index)} onChange={event => updateSegment(segment.id,event.target.value)} />
{<CaptionSelectionTools duration={duration} segments={segments} selected={index} style={editedStyle} settings={editedSettings} onChange={next=>{setSegments(next);if(next.length>segments.length){const time=next.at(-1)!.start;setCurrentTime(time);if(videoRef.current)videoRef.current.currentTime=time;}}} onSelect={index=>{setActiveSegment(index);if(segments[index])editCaption(index);}} word={selectedWordData?.index} onWord={index=>setSelectedWord(index===undefined||!separatedSegment?null:{segmentId:separatedSegment.id,index})}/>}

              </article>)}
            </div>
            <button
              className="subtitle-add-segment"
              type="button"
              onClick={addSegment}
            >
              <Icon name="plus" /> Dodaj novi titl
            </button>
            </div>
            </fieldset>
            </InspectorPanel>
            <InspectorPanel id="styles" activeTab={inspectorTab}>
            <CaptionStylePicker onEdit={t=>{selectTemplate(t);setInspectorTab("settings");setCaptionSection({view:"style",id:Date.now()});}} currentSettings={editedSettings} scopeLabel={scopePicker} activeStyle={selectedWordData?separatedSegment?.wordStyles?.[selectedWordData.index]?.style||activeStyle:editedStyle} onSelect={selectTemplate} playing={inspectorTab === "styles"}/>
            </InspectorPanel>
            <InspectorPanel id="settings" activeTab={inspectorTab}>

            <CaptionSettingsPanel onVariant={selectTemplate} editingTitle={separatedSegment?.role==='title'} hasTitles={segments.some(s=>s.role==='title'&&(positionScope!=='scene'||s.sourceCaptionId===styleOwner?.id||s.id===separatedSegment?.id))} openSection={captionSection} individualTools={styleOwner&&separatedSegment?.role!=='title'?<CaptionIndividualToggle segment={styleOwner} style={editedStyle} settings={sourceSettings} onChange={next=>{setSegments(current=>current.map(s=>s.id===next.id?next:s));}}/>:undefined} wordTools={<CaptionWordsPanel segments={segments} selectedId={separatedSegment?.id} scope={positionScope} style={editedStyle} settings={sourceSettings} onChange={setSegments}/>} editedSettings={editedSettings} setEditedSettings={setEditedSettings} activeStyle={editedStyle} scopeLabel={scopePicker} onReset={()=>{captionHistory.begin();const defaults=settingsForTemplate(templates.find(t=>t.key===editedStyle)!);if(positionScope==='scene'&&separatedSegment?.role==='title'){setSegments(current=>current.map(s=>s.id===separatedSegment.id?{...resetTitleTiming(s,current),titleOverrides:undefined,detachedStyle:{style:editedStyle,settings:titleSettingsForStyle(editedStyle,sourceSettings)}}:s));}else{setEditedSettings(defaults);if(positionScope==='scene')setSegments(current=>current.map(s=>s.id===separatedSegment?.id?{...resetTitleTiming(s,current),position:undefined}:s));}captionHistory.end();}} text={activeCaptionSegment?.text||''} actions={<><button onClick={saveStyle}>{styleSaved?'Sačuvano':'Sačuvaj moj stil'}</button><button onClick={loadStyle}>Vrati sačuvani</button></>}/>
            </InspectorPanel>
            <InspectorPanel id="voice" activeTab={inspectorTab}>
            {waitingForCaptions && <p className="subtitle-wait-note">Alati za glas bit će dostupni kada obrada titlova završi.</p>}
            <fieldset className="subtitle-pending-fields" disabled={waitingForCaptions}>
            <CleanAudioPanel openRequest={cleanAudioRequest} file={file} disabled={isGeneratingVoice||isRendering} onApply={async(audio,offset)=>{if(generatedVoiceUrl)URL.revokeObjectURL(generatedVoiceUrl);const url=URL.createObjectURL(audio);savedVoiceFile.current={url,file:audio};setGeneratedVoiceUrl(url);setGeneratedVoiceMode('change');setVoiceMode('change');setGeneratedVoiceStart(Math.max(0,offset));setOriginalMuted(false);}}/><div className="subtitle-voice-panel">
              <div className="subtitle-voice-head">
                <div>
                  <strong>Glas i naracija</strong>
                </div>
              </div>
              <div className="voice-compact-actions"><button type="button" title={originalMuted?'Uključi originalni zvuk':'Isključi originalni zvuk'} aria-label={originalMuted?'Uključi originalni zvuk':'Isključi originalni zvuk'} aria-pressed={originalMuted} disabled={isGeneratingVoice} onClick={()=>setOriginalMuted(value=>!value)}><StudioIcon name={originalMuted?'mute':'sound'}/></button><button type="button" title="Vrati originalni glas" aria-label="Vrati originalni glas" disabled={(voiceMode==='original'&&!originalMuted)||isGeneratingVoice} onClick={()=>{setVoiceMode('original');setOriginalMuted(false);setVoicePreviewUrl('');voicePreviewRef.current?.pause();}}><StudioIcon name="undo"/></button></div>
              <label className="subtitle-original-level">Glasnoća originala · {originalVolume}%<input aria-label="Glasnoća originalnog zvuka" type="range" min="0" max="150" value={originalVolume} onChange={event=>setOriginalVolume(Number(event.target.value))}/></label>
              <div className="subtitle-voice-tabs" role="group" aria-label="Način zvuka">
                <button
                  className={voiceMode === "change" ? "active" : ""}
                  type="button"
                  onClick={() => setVoiceMode("change")}
                >
                  Voice changer
                </button>
                <button
                  className={voiceMode === "narrator" ? "active" : ""}
                  type="button"
                  onClick={() => setVoiceMode("narrator")}
                >
                  Narator
                </button>
              </div>
              {voiceMode === "original" ? (
                <p className="subtitle-voice-empty">
                  {originalMuted ? "Originalni zvuk je isključen u pregledu i izvozu." : "Video zadržava svoj originalni zvuk. Odaberi drugi način kada želiš novi glas."}
                </p>
              ) : (
                <>
                  <div className="subtitle-voice-picker">
                    <LanguageDropdown variant="voice" placeholder="Nema dostupnih glasova" label="Glas" value={selectedVoiceId} onChange={value=>{voicePreviewRef.current?.pause();setVoicePreviewUrl("");setSelectedVoiceId(value);}}
                      disabled={!filteredVoices.length || isGeneratingVoice}
                      options={filteredVoices.map(voice => ({value:voice.id,label:voice.name}))} />
                    <button
                      type="button"
                      disabled={!selectedVoice?.previewUrl || isGeneratingVoice}
                      onClick={() => selectedVoice && playVoicePreview(selectedVoice)}
                    >
                      <Icon name="play" /> Poslušaj
                    </button>
                  </div>
                  {voicePreviewUrl&&<AudioPlayer ref={voicePreviewRef} autoPlay src={voicePreviewUrl} onPlay={()=>videoRef.current?.pause()}/>}
                  <div className="subtitle-voice-settings">
                    <label>
                      <span>Stabilnost <b>{voiceStability}%</b></span>
                      <input type="range" min="0" max="100" value={voiceStability} onChange={(event) => setVoiceStability(Number(event.target.value))} />
                    </label>
                    <label>
                      <span>Sličnost <b>{voiceSimilarity}%</b></span>
                      <input type="range" min="0" max="100" value={voiceSimilarity} onChange={(event) => setVoiceSimilarity(Number(event.target.value))} />
                    </label>
                    {voiceMode === "narrator" && (
                      <label>
                        <span>Brzina <b>{voiceSpeed}%</b></span>
                        <input type="range" min="70" max="120" value={voiceSpeed} onChange={(event) => setVoiceSpeed(Number(event.target.value))} />
                      </label>
                    )}
                  </div>
                  {voiceMode === "change" ? (
                    <div className="subtitle-voice-change-tools">
                      <div className="subtitle-voice-test-row">
                        <LanguageDropdown label="Obrada od trenutne pozicije" value={String(voiceChangeDuration)} onChange={value=>setVoiceChangeDuration(Number(value))}
                          disabled={isGeneratingVoice} options={[{value:"5",label:"Test 5 sekundi"},{value:"10",label:"Test 10 sekundi"},{value:"20",label:"Test 20 sekundi"},{value:"60",label:"Test 1 minuta"},{value:"0",label:"Cijeli video"}]} />
                      </div>
                      <div className="subtitle-voice-action">
                        <p>Novi glas prati postojeći govor i emociju. Za probu koristi 5–20 sekundi; cijeli video odaberi tek kada si zadovoljan.</p>
                        <button type="button" disabled={!file || isGeneratingVoice || !selectedVoiceId} onClick={() => void generateVoice("change")}>
                          <Icon name="sparkle" /> {isGeneratingVoice ? `Mijenjamo glas… ${voiceGenerationProgress}%` : voiceChangeDuration ? `Testiraj ${voiceChangeDuration}s` : "Promijeni cijeli glas"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="subtitle-narrator-tools">
                      <label>
                        <span>Tekst naratora</span>
                        <textarea maxLength={10000} value={voiceText} onChange={(event) => setVoiceText(event.target.value)} placeholder="Upiši tekst koji narator treba pročitati…" />
                      </label>
                      <div className="subtitle-narrator-row">
                        <button type="button" onClick={() => setVoiceText(segments.map((segment) => segment.text).join(" "))}>
                          Uzmi tekst iz titlova
                        </button>
                        <label>
                          <span>Početak</span>
                          <input type="number" min="0" max={Math.max(0, duration)} step="0.1" value={formatSeconds(narratorStart)} onChange={(event) => setNarratorStart(Number(event.target.value))} />
                          <em>s</em>
                        </label>
                      </div>
                      <div className="subtitle-narrator-mix">
                        <label><input type="radio" name="narrator-mix" checked={narratorMix === "mix"} onChange={() => setNarratorMix("mix")} /> Preko originala</label>
                        <label><input type="radio" name="narrator-mix" checked={narratorMix === "replace"} onChange={() => setNarratorMix("replace")} /> Zamijeni original</label>
                        {narratorMix === "mix" && (
                          <label className="subtitle-original-volume">
                            <span>Original {originalVolume}%</span>
                            <input type="range" min="0" max="150" value={originalVolume} onChange={(event) => setOriginalVolume(Number(event.target.value))} />
                          </label>
                        )}
                      </div>
                      <button className="subtitle-generate-narrator" type="button" disabled={isGeneratingVoice || !selectedVoiceId || !voiceText.trim()} onClick={() => void generateVoice("narrator")}>
                        <Icon name="sparkle" /> {isGeneratingVoice ? "Pravimo naratora…" : "Napravi naratora"}
                      </button>
                    </div>
                  )}
                  {isGeneratingVoice && (
                    <div className="subtitle-voice-progress" role="status">
                      <i style={{ width: `${voiceGenerationProgress}%` }} />
                    </div>
                  )}
                  {voiceError && <div className="subtitle-voice-error" role="alert">{voiceError}</div>}
                  {generatedVoiceUrl && generatedVoiceMode === voiceMode && (
                    <div className="subtitle-generated-audio">
                      <span>Zvuk je spreman</span>
                      <AudioPlayer ref={generatedPlayerRef} src={generatedVoiceUrl} onPlay={()=>videoRef.current?.pause()}/>
                      <button type="button" disabled={!file||isOpeningStudio} onClick={()=>{voicePreviewRef.current?.pause();const video=videoRef.current;if(video){video.currentTime=Math.min(generatedVoiceStart,Math.max(0,duration-.1));void video.play().catch(()=>setVoiceError('Pokreni video za pregled naracije.'));}}}><StudioIcon name="play"/> Pusti uz titlove</button>
                      <button type="button" disabled={isOpeningStudio} onClick={() => void openGeneratedVoiceInStudio()}>
                        {isOpeningStudio ? "Otvaramo studio…" : "Otvori u Video studiju →"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            </fieldset>
            </InspectorPanel>
          </EditorInspector>
          <SubtitleVoicePlayback muted={previewMuted} videoRef={videoRef} videoUrl={videoUrl||''}
            src={generatedVoiceMode===voiceMode?generatedVoiceUrl:''} start={generatedVoiceStart}
            originalVolume={originalMuted||previewMuted?0:generatedVoiceUrl&&generatedVoiceMode===voiceMode?(voiceMode==='change'||narratorMix==='replace'?0:originalVolume/100):originalVolume/100}/>
          <section className="subtitle-preview-panel">
           {captionSelected&&<CaptionQuickToolbar onSettings={()=>{setInspectorTab('settings');setCaptionSection({view:'menu',id:Date.now()});document.getElementById('inspector-panel-settings')?.scrollTo({top:0});}} settings={editedSettings} onChange={setEditedSettings} onEdit={()=>setInspectorTab('captions')} onStyles={()=>setInspectorTab('styles')} onAnimation={()=>{setInspectorTab('settings');setCaptionSection({view:'animation',id:Date.now()});}} onClose={()=>setCaptionSelected(false)}/>}
            <div className="subtitle-preview-notices">{analysis && <TranscriptionStatus key={analysis.stage} status={analysis} onCancel={cancelAnalysis} onRetry={() => void startAnalysis()} />}{uploadNotice && <span className="subtitle-upload-done" role="status">✓ Uploadovanje završeno</span>}<div id="subtitle-upload-feedback" /></div>

            <div className={`subtitle-preview-area${outputAspect >= 1 ? ' is-landscape' : ''}`}>
            <VideoPreviewStage tools={<MediaRepairTools onCaptions={()=>void startAnalysis()} captionsBusy={waitingForCaptions} file={file} disabled={isRendering||preparingExport||isGeneratingVoice} onBusy={setRepairBusy} onExportRepair={async()=>{resetFailedCollectionResources();await prepareCollectionResources({segments,activeStyle,captionSettings});}} onPrepared={prepared=>{if(!file)return;const video=videoRef.current;repairResume.current={time:video?.currentTime??currentTime,playing:!!video&&!video.paused};video?.pause();setRepairedPreview({original:file,file:prepared,url:URL.createObjectURL(prepared)});setRenderError('');}}/>}
              aspect={outputAspect}
              onPointerDown={(event) => {
                const target = event.target as HTMLElement;
                if (!target.closest(".subtitle-overlay")){setCaptionSelected(false);setSelectedWord(null);}
              }}
            >
              {videoUrl ? (
                <LoadingVideo editingPreview autoPlay
                  className="subtitle-cropped-video" style={{"--crop-position":`${cropX}% ${cropY}%`} as React.CSSProperties}
                  key={videoUrl}
                  file={activeRepair?.file||file}
                  ref={videoRef}
                  muted={originalMuted||previewMuted}
                  onPlay={()=>{voicePreviewRef.current?.pause();generatedPlayerRef.current?.pause();}}
                  src={activeRepair?.url||videoUrl}
                  controls={platformGuide === "none"} controlsList="nofullscreen"
                  playsInline
                  onLoadedMetadata={(event) => {
                    const saved=repairResume.current;if(saved){repairResume.current=null;event.currentTarget.currentTime=Math.min(saved.time,Math.max(0,event.currentTarget.duration-.001));if(saved.playing)void event.currentTarget.play().catch(()=>{});}
                    setDuration(event.currentTarget.duration || 9);
                    setVideoAspect(
                      event.currentTarget.videoWidth /
                        Math.max(event.currentTarget.videoHeight, 1),
                    );
                  }}
                  onTimeUpdate={(event) =>
                    setCurrentTime(event.currentTarget.currentTime)
                  }
                />
              ) : (
                <div className="subtitle-demo-frame">
                  <Icon name="play" />
                  <span>Demo pregled</span>
                </div>
              )}
              <CaptionCanvas
                onTitleSelect={id=>{const index=segments.findIndex(s=>s.id===id);if(index>=0){videoRef.current?.pause();setActiveSegment(index);setSelectedWord(null);setInspectorTab('settings');setCaptionSelected(true);}}} segments={waitingForCaptions ? sampleSegments : segments} fallback={waitingForCaptions ? sampleSegments[0] : activeCaptionSegment} time={currentTime}
                style={activeStyle} settings={captionSettings} aspect={outputAspect}
                videoRef={videoRef} onBounds={handleCaptionBounds} cropX={cropX} cropY={cropY}
              />
              {waitingForCaptions && <span className="subtitle-sample-label">Uzorak stila · nije transkripcija</span>}
              {separatedSegment?.wordsSeparated && !waitingForCaptions && <>
                <div className="subtitle-word-drag-surface" onPointerDown={event => { event.preventDefault(); videoRef.current?.pause(); setSelectedWord(null); }} />
                <CaptionWordHandles bounds={captionBounds} onMove={moveWord} selected={selectedWordData?.index} onSelect={(segmentId,index) => { videoRef.current?.pause(); setActiveSegment(segments.findIndex(s=>s.id===segmentId));setSelectedWord({segmentId,index}); }} />
              </>}
              <div
                className={`subtitle-overlay${captionSelected ? " is-selected" : ""}`}
                style={separatedSegment?.wordsSeparated ? { display: 'none' } : overlayStyle}
                role="button"
                tabIndex={0}
                aria-label="Povuci titl na željenu poziciju u videu"
                onDoubleClick={()=>editCaption(segments.findIndex(s=>s.id===activeCaptionSegment?.id))} onPointerDown={startCaptionDrag}
                onPointerMove={continueCaptionDrag}
                onPointerUp={stopCaptionDrag}
                onPointerCancel={stopCaptionDrag}
              >
                <span className="subtitle-accessible-caption">{waitingForCaptions ? sampleSegments[0].text : activeCaption}</span>
                <button
                  className="subtitle-transform-handle rotate"
                  type="button"
                  aria-label="Rotiraj titl"
                  title="Rotiraj"
                  onPointerDown={(event) => startCaptionTransform(event, "rotate")}
                  onPointerMove={continueCaptionTransform}
                  onPointerUp={stopCaptionTransform}
                  onPointerCancel={stopCaptionTransform}
                />
                <button
                  className="subtitle-transform-handle resize north-west"
                  type="button"
                  aria-label="Promijeni veličinu titla"
                  title="Promijeni veličinu"
                  onPointerDown={(event) => startCaptionTransform(event, "resize")}
                  onPointerMove={continueCaptionTransform}
                  onPointerUp={stopCaptionTransform}
                  onPointerCancel={stopCaptionTransform}
                />
                <button
                  className="subtitle-transform-handle resize north-east"
                  type="button"
                  aria-label="Promijeni veličinu titla"
                  title="Promijeni veličinu"
                  onPointerDown={(event) => startCaptionTransform(event, "resize")}
                  onPointerMove={continueCaptionTransform}
                  onPointerUp={stopCaptionTransform}
                  onPointerCancel={stopCaptionTransform}
                />
                <button
                  className="subtitle-transform-handle resize south-west"
                  type="button"
                  aria-label="Promijeni veličinu titla"
                  title="Promijeni veličinu"
                  onPointerDown={(event) => startCaptionTransform(event, "resize")}
                  onPointerMove={continueCaptionTransform}
                  onPointerUp={stopCaptionTransform}
                  onPointerCancel={stopCaptionTransform}
                />
                <button
                  className="subtitle-transform-handle resize south-east"
                  type="button"
                  aria-label="Promijeni veličinu titla"
                  title="Promijeni veličinu"
                  onPointerDown={(event) => startCaptionTransform(event, "resize")}
                  onPointerMove={continueCaptionTransform}
                  onPointerUp={stopCaptionTransform}
                  onPointerCancel={stopCaptionTransform}
                />
              </div>
              {centerGuides.x&&<div className="caption-center-guide vertical"/>}{centerGuides.y!==null&&<div className="caption-center-guide horizontal" style={{top:`${centerGuides.y}%`}}/>}
              {platformGuide !== "none" && <PlatformPreview platform={platformGuide}/>}
            </VideoPreviewStage>
            {isRendering && (
              <div className="subtitle-render-status" role="status">
                <span>
                  <i style={{ width: `${renderProgress}%` }} />
                </span>
                <strong>Ugrađujemo titlove u video… {renderProgress}%</strong>
                <small>
                  Ostani na ovoj stranici dok se gotov video ne preuzme.
                </small>
              </div>
            )}
            {renderError && (
              <div className="subtitle-render-error" role="alert">
                {renderError}
              </div>
            )}
        <div className="subtitle-preview-actions">
          <div className="subtitle-export-actions">
            <button
              className="primary"
              type="button"
              disabled={!file || isRendering || waitingForCaptions}
              onClick={() => setExportOptionsOpen(true)}
            >
              <Icon name="download" />{" "}
              {isRendering ? `${renderProgress}%` : "Preuzmi video"}
            </button>
          </div>
        <div className="subtitle-continue-bottom"><button className="workspace-caption-action" disabled={!file || phase === 'processing' || isRendering || isGeneratingVoice || isOpeningStudio} onClick={()=>setVideoEditorPrompt(true)}><StudioIcon name="arrow"/><span>{isOpeningStudio ? 'Otvaramo video…' : 'Nastavi u editor'}</span></button></div>
        </div>
        </div>
        <div className="subtitle-bottom-dock resizable-caption-dock" style={{height:dockHidden?64:dockHeight,'--timeline-max-height':`${dockMaximum}px`} as React.CSSProperties}><div className="caption-dock-resize" role="separator" aria-label="Visina uređivača titlova" aria-orientation="horizontal" tabIndex={0} onKeyDown={e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setDockHeight(h=>h+(e.key==='ArrowUp'?20:-20));}}} onPointerDown={e=>{e.preventDefault();dockResize.current={y:e.clientY,height:dockHeight};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const d=dockResize.current;if(d)setDockHeight(d.height+d.y-e.clientY);}} onPointerUp={()=>{dockResize.current=null;}} onPointerCancel={()=>{dockResize.current=null;}}/><div className="caption-dock-content">
          <div className="subtitle-under-video-tools"><header className="subtitle-editor-bar">
          <button
            type="button"
            onClick={()=>setLeaveUpload(true)}
            aria-label="Nazad na upload"
          >
            <Icon name="back" />
          </button>
          <div className="subtitle-file-name">
            <strong>{file?.name || "Probni video"}</strong>
            <span>{phase === "processing" ? "Obrada traje · izgled možeš uređivati" : "Uređivanje u ovoj sesiji"}</span>
          </div>

</header>
            <div className="subtitle-control-groups"><div className="subtitle-playback-tools"><SubtitlePlayback loopId={positionScope==='scene'?separatedSegment?.id:undefined} loop={positionScope==='scene'&&separatedSegment?{start:separatedSegment.start,end:separatedSegment.end}:undefined} muted={previewMuted} onMute={()=>setPreviewMuted(v=>!v)} file={file} videoRef={videoRef} source={videoUrl || ''} disabled={isRendering} /><button type="button" className="clean-audio-shortcut" disabled={!file||isRendering} onClick={()=>{setInspectorTab("voice");setCleanAudioRequest(v=>v+1);}}>✧ Clean Audio</button></div>
              <div className="subtitle-tools-top">
            <div className="subtitle-crop-controls"><LanguageDropdown icon={<StudioIcon name="devices"/>} label="Format i platforma" value={platformGuide==='none'?outputFormat:platformGuide} onChange={value=>{const platform=isSocialFormat(value);setPlatformGuide(platform?value:'none');setOutputFormat(platform?'9:16':value);}} options={platformFormatOptions}/><PreviewQualityPicker/>
              {outputFormat !== 'original' && <details className="subtitle-crop-popover"><summary title="Prilagodi kadar" aria-label="Prilagodi kadar">↔</summary><div><label>Vodoravno<input aria-label="Vodoravni pomak kadra" type="range" min="0" max="100" value={cropX} onChange={event=>setCropX(Number(event.target.value))}/></label><label>Uspravno<input aria-label="Uspravni pomak kadra" type="range" min="0" max="100" value={cropY} onChange={event=>setCropY(Number(event.target.value))}/></label><button onClick={()=>{setCropX(50);setCropY(50);}}>Centar</button></div></details>}
            </div>
              </div>
              <div className="subtitle-tools-bottom">
              <div className="subtitle-word-actions"><button title="Poništi (Ctrl+Z / ⌘Z)" disabled={!captionHistory.canUndo} onClick={undoCaptionEdit}>↶</button><button title="Ponovi (Ctrl+Shift+Z / ⇧⌘Z)" disabled={!captionHistory.canRedo} onClick={captionHistory.redo}>↷</button>
                <button type="button" aria-label={separatedSegment?.wordsSeparated?'Spoji titl':'Razdvoji na riječi'} title={`${separatedSegment?.wordsSeparated?'Spoji titl':'Razdvoji na riječi'} (Ctrl+Alt+W)`} disabled={!separatedSegment||waitingForCaptions} onClick={toggleWords}><StudioIcon name={separatedSegment?.wordsSeparated?'joinWords':'splitWords'}/></button>

              </div>
            <div className="subtitle-platform-picker" title="Svi titlovi / ovaj titl (Ctrl+Alt+A)">
              {scopePicker}              <button className="subtitle-reset-position" type="button" title="Vrati položaje ovog titla" aria-label="Vrati položaje ovog titla" onClick={() => setSegments(current => current.map(segment => segment.id === captionBounds?.segmentId ? { ...segment, wordOffsets: undefined, position: undefined } : segment))}><svg className="subtitle-tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></svg></button><button type="button" title={dockHidden?"Prikaži timeline":"Sakrij timeline"} aria-label={dockHidden?"Prikaži timeline":"Sakrij timeline"} onClick={()=>setDockHidden(v=>!v)}><StudioIcon name={dockHidden?"timelineShow":"timelineHide"}/></button>

            </div>
              </div>
            </div>
            </div><div className="subtitle-timeline">
              <div className="subtitle-timeline-head">
                <span>0:00</span><div id="subtitle-timeline-group-tools"/>
                <strong>{waitingForCaptions ? "Titlovi će se pojaviti nakon obrade" : "Govor i titlovi"}</strong>
                <div className="subtitle-timeline-zoom"><span>{secondsLabel(duration)}</span><button aria-label="Zoom out vremenske linije" disabled={timelineZoom === 100} onClick={() => setTimelineZoom(value => Math.max(100,value-25))}>−</button><input aria-label="Zoom vremenske linije" type="range" min="100" max="400" step="25" value={timelineZoom} onChange={event => setTimelineZoom(Number(event.target.value))}/><button aria-label="Zoom in vremenske linije" disabled={timelineZoom === 400} onClick={() => setTimelineZoom(value => Math.min(400,value+25))}>+</button><button className="timeline-fit" title="Uklopi cijeli timeline bez horizontalnog skrolanja" onClick={()=>setTimelineZoom(100)}>Fit</button></div>
              </div>

              <CaptionTimeline onGroupSelect={id=>{const index=segments.findIndex(s=>s.group?.id===id);if(index>=0)setActiveSegment(index);setInspectorTab('settings');}} narration={generatedVoiceUrl&&generatedVoiceMode==='narrator'?<NarratorTimeline src={generatedVoiceUrl} start={generatedVoiceStart} duration={duration} active={voiceMode==='narrator'} onMove={start=>{setGeneratedVoiceStart(start);setNarratorStart(start);}} onSeek={time=>{videoRef.current?.pause();if(videoRef.current)videoRef.current.currentTime=time;setCurrentTime(time);}}/>:undefined} groupToolsTarget="subtitle-timeline-group-tools" groupStyle={editedStyle} groupSettings={editedSettings} onBegin={captionHistory.begin} onEnd={captionHistory.end} onEdit={editCaption} onZoom={setTimelineZoom} waveform={<div className="subtitle-media-track">{videoUrl&&<VideoThumbnails url={videoUrl} start={0} end={duration}/>}<div className="subtitle-timeline-sound" onPointerDown={event=>event.stopPropagation()}><button type="button" aria-label={originalMuted?'Uključi originalni zvuk':'Isključi originalni zvuk'} onClick={()=>setOriginalMuted(value=>!value)}><StudioIcon name={originalMuted?'mute':'sound'}/></button><AudioVolumeHandle volume={originalVolume} muted={originalMuted} onChange={setOriginalVolume} onBegin={()=>{}} onEnd={()=>{}} onSelect={()=>{}}><AudioWaveform normalize file={file}/></AudioVolumeHandle></div></div>} time={currentTime} onSeek={time=>{videoRef.current?.pause();if(videoRef.current)videoRef.current.currentTime=time;setCurrentTime(time);}} segments={segments} duration={duration} zoom={timelineZoom} selected={activeSegment} onSelect={(index) => { videoRef.current?.pause(); setCaptionSelected(index>=0); if(index>=0)setActiveSegment(index);setSelectedWord(null);if(index>=0)setInspectorTab('settings'); }} onChange={setSegments} />
            </div></div></div>          </section>

        </div>
      </main>
    );

  return <main className="subtitle-app workspace-upload-page" onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();}} onDrop={e=>{if(e.defaultPrevented||!e.dataTransfer.files.length)return;e.preventDefault();chooseFile(e.dataTransfer.files[0]);}}>
    {projectToolbar}
    <WorkspaceUpload file={file} videoUrl={videoUrl} chooseFile={chooseFile} onAnalyze={() => void startAnalysis()} onDemo={openDemo}
      language={languageCode} setLanguage={setLanguageCode} languages={languageOptions} error={error}
      onMetadata={video => { setDuration(video.duration || 9); setVideoAspect(video.videoWidth / Math.max(1, video.videoHeight)); }} />
  </main>;
}

function drawBurnedFrame(
  context: CanvasRenderingContext2D,
  video: FrameSource,
  segments: Segment[],
  style: StyleKey,
  settings: CaptionSettings,
  captionCache: { context: CanvasRenderingContext2D; key: string; layer?: HTMLCanvasElement },
  cropX=50,cropY=50,videoDuration?:number,
) {
  const { width, height } = context.canvas;
  context.fillStyle = "#050509";
  context.fillRect(0, 0, width, height);
  const crop=cropRect(video.videoWidth,video.videoHeight,width/height,cropX,cropY);
  const captionTime=captionPlaybackTime(video.currentTime);
  const camera=captionCamera(segments,style,settings,captionTime),cameraZoom=camera.scale;
  context.drawImage(video,crop.x,crop.y,crop.width,crop.height,((1-cameraZoom)/2+camera.dx)*width,((1-cameraZoom)/2+camera.dy)*height,width*cameraZoom,height*cameraZoom);
  const visible=activeCaptionSegments(segments,captionTime,style,settings,videoDuration);
  const key=visible.map(s=>captionFrameKey(s,captionTime,style,settings)).join('|');
  if (key !== captionCache.key || visible.some(s=>(s.detachedStyle?.settings||s.laneStyle?.settings||settings).behindPerson)) {
    captionCache.key = key;
    captionCache.context.clearRect(0, 0, width, height);
    captionCache.layer??=document.createElement('canvas');const layer=captionCache.layer;
    if(layer.width!==width||layer.height!==height){layer.width=width;layer.height=height;}
    const ink=layer.getContext('2d')!;
    for(const item of visible){ink.clearRect(0,0,width,height);drawPersonCaption(ink,item,captionTime,style,settings,video,cropX,cropY,undefined,cameraZoom);captionCache.context.drawImage(layer,0,0);}
  }
  context.drawImage(captionCache.context.canvas, 0, 0);
}
