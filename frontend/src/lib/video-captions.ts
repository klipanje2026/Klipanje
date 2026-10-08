import {captionPlaybackTime} from './caption-clock';
import {activeCaptionSegments} from './caption-selection';
import type { CaptionSettings, Segment, StyleKey } from '../config/captions/presets';

export type VideoCaptions = { topics?: {header:string;keywords:string[]}; segments: Segment[]; activeStyle: StyleKey; captionSettings: CaptionSettings };
export type CaptionClip = { id: string; assetId: string; type: string; start: number; inPoint: number; outPoint: number; layer: number };

// Captions live in source time, so trims, cuts, duplicates and moves follow the video.
export function captionsAtTime<T extends CaptionClip>(clips: T[], documents: Record<string, VideoCaptions>, time: number) {
  return clips.filter(c => c.type === 'video' && time >= c.start && time < c.start + c.outPoint - c.inPoint)
    .sort((a, b) => a.layer - b.layer).flatMap(clip => {
      const document = documents[clip.assetId];
      if (!document) return [];
      const sourceTime = clip.inPoint + time - clip.start;
      const captionTime=captionPlaybackTime(sourceTime);
      return activeCaptionSegments(document.segments,captionTime,document.activeStyle,document.captionSettings,clip.outPoint).map(segment=>({clip,document,segment:segment.frameAnimationStart===undefined?segment:{...segment,frameAnimationStart:Math.max(clip.inPoint,segment.frameAnimationStart),frameAnimationEnd:Math.min(clip.outPoint,segment.frameAnimationEnd??segment.end)},sourceTime,captionTime}));
    });
}

export function timelineCaptions(clips: CaptionClip[], documents: Record<string, VideoCaptions>): VideoCaptions | undefined {
  const first = clips.find(c => c.type === 'video' && documents[c.assetId]);
  if (!first) return;
  const document = documents[first.assetId];
  const segments = clips.filter(c => c.type === 'video').flatMap(clip => (documents[clip.assetId]?.segments ?? []).flatMap(s => {
    const start = Math.max(s.start, clip.inPoint), end = Math.min(s.end, clip.outPoint);
    if (start >= end) return [];
    const offset = clip.start - clip.inPoint;
    return [{ ...s, id: `${clip.id}-${s.id}`, sourceCaptionId:s.sourceCaptionId?`${clip.id}-${s.sourceCaptionId}`:undefined, start: start + offset, end: end + offset,
      words: s.words?.filter(w => w.end > start && w.start < end).map(w => ({ ...w, start: Math.max(start,w.start)+offset, end: Math.min(end,w.end)+offset })) }];
  })).sort((a,b) => a.start-b.start);
  return { ...document, segments };
}

// Convert a visible timeline edit back into source time without losing words outside a trimmed clip.
export function applyTimelineCaptionEdit(source:Segment, prior:Segment, next:Segment, clip:CaptionClip):Segment {
 const metadata={separateStyle:next.separateStyle,inheritedStyle:next.inheritedStyle,lane:next.lane,group:next.group,laneStyle:next.laneStyle,detachedStyle:next.detachedStyle,position:next.position};
 if(next.start===prior.start&&next.end===prior.end)return {...source,...metadata};
 const offset=clip.start-clip.inPoint;
 const length=Math.min(next.end-next.start,clip.outPoint-clip.inPoint);
 const start=Math.max(clip.inPoint,Math.min(clip.outPoint-length,next.start-offset));
 const end=Math.min(clip.outPoint,start+length);
 const moving=Math.abs((next.start-prior.start)-(next.end-prior.end))<.001;
 const delta=moving?start-(prior.start-offset):0;
 return {...source,...metadata,start,end,words:source.words?.map(w=>({...w,start:w.start+delta,end:w.end+delta}))};
}
