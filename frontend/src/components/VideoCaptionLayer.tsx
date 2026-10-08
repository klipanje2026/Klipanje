import {isPresetCaptionStyle} from '../config/captions/style-library';
import {captionNeedsPerson} from '../lib/caption-word-roles';
import {prepareCollectionResources} from '../lib/collection-captions';
import {usePersonMaskScan} from '../lib/use-person-mask-scan';
import {glassVideoTransform} from '../lib/dynamic-glass';
import {updateTitleStyles} from '../lib/caption-selection';
import {resolveCaptionSuggestions} from '../lib/caption-selection';
import type {FrameSource} from '../lib/frame-source';
import {styleCaptionLane} from '../lib/caption-selection';
import { useEffect, useRef, useState } from 'react';
import type { VideoCaptions, CaptionClip } from '../lib/video-captions';
import { captionsAtTime } from '../lib/video-captions';
import {type CaptionBounds } from '../lib/caption-renderer';
import { preparePersonMask, drawPersonCaption } from '../lib/person-mask';
import { videoRect, type VideoTransform } from '../lib/video-layout';

export function drawVideoCaptions(context: CanvasRenderingContext2D, layer: HTMLCanvasElement, clips: (CaptionClip & VideoTransform)[], documents: Record<string, VideoCaptions>, time: number, videoFor: (id:string)=>FrameSource|undefined) {
  layer.width=context.canvas.width; layer.height=context.canvas.height;
  const ink=layer.getContext('2d')!;
  const hits:{assetId:string;clipId:string;segmentId:string;bounds:CaptionBounds}[]=[];
  for (const item of captionsAtTime(clips,documents,time)) {
    ink.clearRect(0,0,layer.width,layer.height);
    const video=videoFor(item.clip.id),rect=video&&video.videoWidth?videoRect(video.videoWidth/video.videoHeight,layer.width/layer.height,glassVideoTransform(item.clip,item.document,item.sourceTime)):undefined;
    const bounds=drawPersonCaption(ink,item.segment,item.captionTime,item.document.activeStyle,item.document.captionSettings,video,50,50,rect);
    if(bounds)hits.push({assetId:item.clip.assetId,clipId:item.clip.id,segmentId:item.segment.id,bounds});
    context.drawImage(layer,0,0);
  }
  return hits;
}

export function VideoCaptionLayer({clips,documents,time,aspect,mediaRefs,editable=false,scope="all",onChange,onSelect,onEdit,onBegin,onEnd}:{editable?:boolean;scope?:string;onChange?:(id:string,d:VideoCaptions)=>void;onSelect?:(clipId:string,segmentId:string,word?:number,container?:boolean)=>void;onEdit?:()=>void;onBegin?:()=>void;onEnd?:()=>void;clips:(CaptionClip & VideoTransform)[];documents:Record<string,VideoCaptions>;time:number;aspect:number;mediaRefs:React.RefObject<Map<string,HTMLMediaElement>>}) {
  const [hits,setHits]=useState<ReturnType<typeof drawVideoCaptions>>([]);
  const [guides,setGuides]=useState<{x:boolean;y:number|null}>({x:false,y:null});
  const gesture=useRef<{x:number;y:number;box:DOMRect;hit:ReturnType<typeof drawVideoCaptions>[number];doc:VideoCaptions;word?:number;mode:string}|null>(null);
  const ref=useRef<HTMLCanvasElement>(null);
  const buffer=useRef<HTMLCanvasElement|null>(null);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState('');
  const [collectionReady,setCollectionReady]=useState(0);
  useEffect(()=>{let active=true;prepareCollectionResources(documents).then(()=>{if(active)setCollectionReady(v=>v+1);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[documents]);
  const behind=Object.values(documents).some(d=>captionNeedsPerson(d.activeStyle,d.captionSettings,d.segments));
  const scanStatus=usePersonMaskScan(behind&&ready,undefined,mediaRefs);
  useEffect(()=>{if(!behind)return;let active=true;void preparePersonMask().then(()=>{if(active)setReady(true);}).catch(()=>{if(active)setError('Izdvajanje osobe nije dostupno. Pokušaj ponovo prije izvoza.');});return()=>{active=false;};},[behind]);
  useEffect(()=>{
    const canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
    canvas.width=1280;canvas.height=Math.round(1280/aspect);
    buffer.current??=document.createElement('canvas');
    if(behind&&!ready)return;
    setHits(drawVideoCaptions(ctx,buffer.current,clips,documents,time,id=>mediaRefs.current.get(id) as HTMLVideoElement|undefined));
  },[clips,documents,time,aspect,mediaRefs,behind,ready,collectionReady]);

  const begin=(e:React.PointerEvent<HTMLElement>,hit:typeof hits[number],word?:number,mode='move')=>{if(!documents[hit.assetId]?.segments.some(s=>s.id===hit.segmentId))return;e.preventDefault();e.stopPropagation();if(e.ctrlKey||e.metaKey){onSelect?.(hit.clipId,hit.segmentId,undefined,true);return;}onBegin?.();onSelect?.(hit.clipId,hit.segmentId,word);gesture.current={x:e.clientX,y:e.clientY,box:ref.current!.getBoundingClientRect(),hit,doc:documents[hit.assetId],word,mode};e.currentTarget.setPointerCapture(e.pointerId);};
  const move=(e:React.PointerEvent<HTMLElement>)=>{const g=gesture.current;if(!g||!e.currentTarget.hasPointerCapture(e.pointerId))return;e.stopPropagation();const dx=(e.clientX-g.x)/g.box.width*100,dy=(e.clientY-g.y)/g.box.height*100;const selected=resolveCaptionSuggestions(g.doc.segments).find(s=>s.id===g.hit.segmentId)!;const settings={...(selected.detachedStyle?.settings||selected.laneStyle?.settings||g.doc.captionSettings),...selected.position};
    let x=g.hit.bounds.x+dx,y=g.hit.bounds.y+dy;const gx=Math.abs(x-50)<1.5,gy=[25,50,75].find(point=>Math.abs(y-point)<1.5);if(gx)x=50;if(gy!==undefined)y=gy;setGuides({x:gx,y:gy??null});
    // Bounds describe the visible ink, which need not be centered on the renderer anchor.
    x+=settings.x-g.hit.bounds.x;y+=settings.y-g.hit.bounds.y;
    if(g.word!==undefined){const old=selected.wordOffsets?.[g.word];onChange?.(g.hit.assetId,{...g.doc,segments:g.doc.segments.map(s=>s.id!==selected.id?s:{...s,wordOffsets:{...s.wordOffsets,[g.word!]:{text:s.text.trim().split(/\s+/)[g.word!],x:(old?.x||0)+dx,y:(old?.y||0)+dy}}})});return;}
    const preset=isPresetCaptionStyle(selected.detachedStyle?.style||selected.laneStyle?.style||g.doc.activeStyle);
    const resizedScale=Math.max(preset?10:40,Math.min(preset?400:600,settings.fontScale+dx*3));
    const next=g.mode==='resize'?{...settings,fontScale:resizedScale,fontSizePx:preset?settings.fontSizePx:settings.fontSizePx?settings.fontSizePx*resizedScale/Math.max(1,settings.fontScale):undefined}:g.mode==='rotate'?{...settings,rotation:Math.round(settings.rotation+dx*3)}:{...settings,x:Math.max(-200,Math.min(300,x)),y:Math.max(-200,Math.min(300,y))};
    if(scope==='titles'&&selected.role==='title'){const patch=g.mode==='resize'?{fontScale:next.fontScale,fontSizePx:next.fontSizePx}:g.mode==='rotate'?{rotation:next.rotation}:{x:next.x,y:next.y};for(const [id,doc] of Object.entries(documents))onChange?.(id,{...doc,segments:updateTitleStyles(doc.segments,patch)});}
    else if(scope!=='scene'&&selected.role!=='title'&&!selected.detachedStyle)onChange?.(g.hit.assetId,{...g.doc,segments:styleCaptionLane(g.doc.segments,0,selected.laneStyle?.style||g.doc.activeStyle,next,scope.startsWith('group:')?scope.slice(6):undefined,g.mode!=='move')});
    else onChange?.(g.hit.assetId,{...g.doc,segments:g.doc.segments.map(s=>s.id!==selected.id?s:{...s,position:undefined,titleOverrides:s.role==='title'?{...s.titleOverrides,x:next.x,y:next.y,rotation:next.rotation,fontScale:next.fontScale,fontSizePx:next.fontSizePx}:s.titleOverrides,detachedStyle:{style:s.detachedStyle?.style||s.laneStyle?.style||g.doc.activeStyle,settings:next}})});
  };
  const end=(e:React.PointerEvent<HTMLElement>)=>{gesture.current=null;setGuides({x:false,y:null});onEnd?.();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);};
  return <><canvas className="video-caption-layer" ref={ref} aria-label="Titlovi u video editoru"/>{editable&&<div className="video-caption-handles">{hits.flatMap(hit=>{const segment=documents[hit.assetId]?.segments.find(s=>s.id===hit.segmentId);if(!segment)return [];return (segment.wordsSeparated?hit.bounds.words.map(w=>({...w,word:w.index})):[{...hit.bounds,word:undefined}]).map((bounds,i)=><div key={hit.clipId+hit.segmentId+i} role="button" tabIndex={0} aria-label={`Pomjeri titl: ${segment.text}`} className="video-caption-hit" style={{left:`${bounds.x}%`,top:`${bounds.y}%`,width:`${bounds.width}%`,height:`${bounds.height}%`,transform:`translate(-50%,-50%) rotate(${bounds.rotation}deg)`}} onPointerDown={e=>begin(e,hit,bounds.word)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onDoubleClick={()=>{onSelect?.(hit.clipId,hit.segmentId,bounds.word);onEdit?.();}}>{bounds.word===undefined&&<><button title="Promijeni veličinu titla" className="caption-resize-knob" onPointerDown={e=>begin(e,hit,undefined,'resize')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>↘</button><button title="Rotiraj titl" className="caption-rotate-knob" onPointerDown={e=>begin(e,hit,undefined,'rotate')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>↻</button></>}</div>);})}{guides.x&&<div className="caption-center-guide vertical"/>}{guides.y!==null&&<div className="caption-center-guide horizontal" style={{top:`${guides.y}%`}}/>}</div>}{scanStatus&&<span className="caption-mask-scan-status" role="status">{scanStatus}</span>}{error&&<span role="status">{error}</span>}</>;
}
