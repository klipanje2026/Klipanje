"use client";
import {captionPlaybackTime} from '../../lib/caption-clock';
import {captionNeedsPerson} from '../../lib/caption-word-roles';
import {usePersonMaskScan} from '../../lib/use-person-mask-scan';
import {captionCamera} from '../../lib/dynamic-glass';
import {activeCaptionSegments} from '../../lib/caption-selection';

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { CaptionSettings, Segment, StyleKey } from "../../config/captions/presets";
import { cropSize } from "../../lib/video-crop";
import { captionFrameKey } from "../../lib/caption-renderer";
import type { CaptionBounds } from "../../lib/caption-renderer";
import { preparePersonMask, drawPersonCaption } from '../../lib/person-mask';

export function CaptionCanvas({ segments, fallback, time, style, settings, aspect, videoRef, onBounds, onTitleSelect, cropX = 50, cropY = 50 }: {
  segments: Segment[]; fallback?: Segment; time: number; style: StyleKey;
  settings: CaptionSettings; aspect: number; videoRef: RefObject<HTMLVideoElement | null>;
  onBounds: (bounds: CaptionBounds | null) => void;
  onTitleSelect?:(id:string)=>void;
  cropX?: number; cropY?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [titleBounds,setTitleBounds]=useState<CaptionBounds[]>([]);
  const [maskStatus, setMaskStatus] = useState('');
  const [maskReady, setMaskReady] = useState(false);
  const behind=captionNeedsPerson(style,settings,segments);
  const scanStatus=usePersonMaskScan(!!behind&&maskReady,videoRef);
  useEffect(() => {
    if (!behind) return;
    let cancelled = false;
    preparePersonMask().then(() => { if (!cancelled) { setMaskReady(true); setMaskStatus(''); } })
      .catch(() => { if (!cancelled) setMaskStatus('Efekat nije dostupan. Isključi „Iza osobe“ ili ponovo uključi za pokušaj.'); });
    return () => { cancelled = true; };
  }, [behind]);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const video = videoRef.current;
    const sourceWidth = video?.videoWidth || 1280;
    const sourceHeight = video?.videoHeight || sourceWidth / aspect;
    const size=cropSize(sourceWidth,sourceHeight,aspect);
    canvas.width=size.width; canvas.height=size.height;
    const layer=document.createElement('canvas');layer.width=canvas.width;layer.height=canvas.height;const ink=layer.getContext('2d')!;
    let raf = 0;
    let lastFrame = "";
    let lastBounds = "";
    const draw = () => {
      const playbackTime = captionPlaybackTime(video && !video.paused ? video.currentTime : time);
      const segment = segments.find((item) => playbackTime >= item.start && playbackTime < item.end)
        ?? (!video || video.paused ? fallback : undefined);
      const camera=captionCamera(segments,style,settings,playbackTime),cameraZoom=camera.scale;
      if(video){video.style.scale=String(cameraZoom);video.style.translate=`${camera.dx*100}% ${camera.dy*100}%`;}
      const active=activeCaptionSegments(segments,playbackTime,style,settings,video?.duration);
      if(segment&&!active.some(s=>s.id===segment.id))active.push(segment);
      const frame = active.map(s=>captionFrameKey(s, playbackTime, style, settings)).join('|') + (behind ? `:${Math.round(playbackTime * 30)}:${video?.readyState}` : '');
      if (frame !== lastFrame) {
        lastFrame = frame;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let bounds:CaptionBounds|null=null;const titles:CaptionBounds[]=[];
        for(const item of active){
          ink.clearRect(0,0,canvas.width,canvas.height);
          const drawn=drawPersonCaption(ink,item,playbackTime,style,settings,maskReady||(item.detachedStyle?.style||item.laneStyle?.style||style)==='collectionGlass'||(item.detachedStyle?.style||item.laneStyle?.style||style).startsWith('collectionStudio')?video:null,cropX,cropY,undefined,cameraZoom);
          if(item.role==='title'&&drawn&&item.id!==fallback?.id)titles.push(drawn);
          if(item.id===(fallback?.id||segment?.id))bounds=drawn;
          ctx.drawImage(layer,0,0);
        }
        setTitleBounds(current=>JSON.stringify(current)===JSON.stringify(titles)?current:titles);
        const key = JSON.stringify(bounds);
        if (key !== lastBounds) { lastBounds = key; onBounds(bounds); }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {cancelAnimationFrame(raf);if(video){video.style.scale='';video.style.translate='';}};
  }, [segments, fallback, time, style, settings, aspect, videoRef, onBounds, cropX, cropY, maskReady, behind]);
  return <><canvas ref={ref} className="subtitle-caption-canvas" aria-hidden="true" />
    {onTitleSelect&&titleBounds.map(b=><button key={b.segmentId} type="button" className="caption-title-select-hit" aria-label="Odaberi naslov u videu" style={{position:'absolute',left:`${b.x}%`,top:`${b.y}%`,width:`${b.width}%`,height:`${b.height}%`,transform:`translate(-50%,-50%) rotate(${b.rotation}deg)`}} onPointerDown={e=>{e.stopPropagation();onTitleSelect(b.segmentId);}}/>)}
    {scanStatus&&<span className="caption-mask-scan-status" role="status">{scanStatus}</span>}
    {behind && (maskStatus || !maskReady || !videoRef.current) && <span className="caption-mask-status" role="status">{maskStatus || (!videoRef.current ? 'Ubaci video za prikaz iza osobe' : 'Pripremam izdvajanje osobe…')}</span>}</>;
}
